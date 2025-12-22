import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

/**
 * HandTracker - 防抖动稳定版
 * 1. 引入“滞后阈值” (Hysteresis)：防止抓取/松开在临界点反复横跳
 * 2. 只有当手真正张开时，才触发“烟花爆炸”
 * 3. 速度算法平滑处理，避免误触旋转
 */
export class HandTracker {
    constructor() {
        this.landmarker = null;
        this.video = null;
        this.lastVideoTime = -1;
        this.results = undefined;
        this.isDisposed = false;

        this.gestureData = {
            speed: 0,         // 旋转速度
            isGrabbing: false // 是否握拳
        };

        this.lastPos = { x: 0.5, time: 0 };
        
        // --- 防抖动状态 ---
        // 只有当距离 < enterThreshold 时才变成 true
        // 只有当距离 > exitThreshold 时才变成 false
        // 中间状态保持不变
        this._currentGrabState = false; 
    }

    async init() {
        if (this.isDisposed) return;
        try {
            const vision = await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
            );
            if (this.isDisposed) return;

            this.landmarker = await HandLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
                    delegate: "GPU"
                },
                runningMode: "VIDEO",
                numHands: 1, 
                minHandDetectionConfidence: 0.6,
                minHandPresenceConfidence: 0.6,
                minTrackingConfidence: 0.6
            });

            await this._setupCamera();
            console.log("🖐️ HandTracker: 防抖动稳定版已启动");
        } catch (e) {
            console.error(e);
        }
    }

    detect() {
        if (!this.landmarker || !this.video || this.isDisposed) return this.gestureData;

        const now = performance.now();
        if (this.video.currentTime !== this.lastVideoTime) {
            this.lastVideoTime = this.video.currentTime;
            this.results = this.landmarker.detectForVideo(this.video, now);
        }

        if (this.results && this.results.landmarks.length > 0) {
            this._processHand(this.results.landmarks[0]);
        } else {
            // 无手时，速度归零，并重置抓取状态
            this.gestureData.speed *= 0.9;
            this.gestureData.isGrabbing = false;
            this._currentGrabState = false;
        }

        return this.gestureData;
    }

    dispose() {
        this.isDisposed = true;
        if (this.video) {
            if(this.video.srcObject) this.video.srcObject.getTracks().forEach(t=>t.stop());
            this.video.remove();
        }
        if (this.landmarker) this.landmarker.close();
    }

    _setupCamera() {
        return new Promise((resolve) => {
            let video = document.getElementById("ar-camera-feed-hidden");
            if (!video) {
                video = document.createElement("video");
                video.id = "ar-camera-feed-hidden";
                video.style.display = "none";
                video.autoplay = true;
                video.playsInline = true;
                document.body.appendChild(video);
            }
            if (!navigator.mediaDevices) { resolve(); return; }
            navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 640, height: 480 } })
                .then(stream => { video.srcObject = stream; video.onloadedmetadata = () => { video.play(); this.video = video; resolve(); }; })
                .catch(() => resolve());
        });
    }

    _processHand(landmarks) {
        const wrist = landmarks[0];
        const indexTip = landmarks[8];
        const indexBase = landmarks[5]; 
        const middleTip = landmarks[12];
        
        // --- 1. 速度计算 (保持柔和) ---
        const now = performance.now();
        const currentX = 1.0 - wrist.x;
        const dt = now - this.lastPos.time;

        if (dt > 30) {
            const dx = currentX - this.lastPos.x;
            
            // 降低灵敏度，只有明显挥手才旋转
            if (Math.abs(dx) > 0.003) {
                // 倍率 1500，手感较“重”，不会乱飘
                this.gestureData.speed += (dx * 1500 - this.gestureData.speed) * 0.3;
            } else {
                this.gestureData.speed *= 0.8;
            }
            // 限制最大速度
            this.gestureData.speed = Math.max(-30, Math.min(30, this.gestureData.speed));
            
            this.lastPos = { x: currentX, time: now };
        }

        // --- 2. 握拳判定 (防抖动核心) ---
        const wristToIndexTip = this._dist(wrist, indexTip);
        const wristToMiddleTip = this._dist(wrist, middleTip);
        const wristToIndexBase = this._dist(wrist, indexBase);

        // 计算归一化距离 (消除手离摄像头远近的影响)
        // 使用 "指尖到手腕距离" 除以 "手掌长度"
        const indexFoldRatio = wristToIndexTip / wristToIndexBase;
        const middleFoldRatio = wristToMiddleTip / wristToIndexBase;
        
        // 取两个手指中弯曲得厉害的那个
        const foldRatio = Math.min(indexFoldRatio, middleFoldRatio);

        // 阈值设定：
        // 值越小，说明手指越弯曲（握拳）
        // 值越大，说明手指越直（张开）
        
        const GRAB_ENTER_THRESHOLD = 1.05; // 必须捏得比较紧 (< 1.05) 才能触发抓取
        const GRAB_EXIT_THRESHOLD = 1.15;  // 必须张得比较开 (> 1.35) 才能触发松开

        if (this._currentGrabState) {
            // 当前是【抓取】状态：检测是否松开
            if (foldRatio > GRAB_EXIT_THRESHOLD) {
                this._currentGrabState = false; // 确实松开了 -> 触发爆炸
            }
        } else {
            // 当前是【松开】状态：检测是否抓取
            if (foldRatio < GRAB_ENTER_THRESHOLD) {
                this._currentGrabState = true;  // 确实抓住了 -> 触发放大
            }
        }

        this.gestureData.isGrabbing = this._currentGrabState;
    }

    _dist(p1, p2) {
        return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
    }
}