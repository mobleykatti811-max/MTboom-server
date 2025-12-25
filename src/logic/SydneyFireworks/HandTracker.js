import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

/**
 * HandTracker - 魔法手势版
 * * 核心升级：
 * 1. 新增 fingerCount (手指计数)：识别伸出了几根手指 (0-5)。
 * 2. 依然保留 isPinching 供基础逻辑使用。
 */
export class HandTracker {
    constructor() {
        this.landmarker = null;
        this.video = null;
        this.lastVideoTime = -1;
        this.isDisposed = false;

        // --- 输出数据 ---
        this.gestureData = {
            isPinching: false,
            fingerCount: 0, // 新增：当前伸出的手指数量
            handPresent: false
        };
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
            console.log("🖐️ HandTracker: 魔法手势识别已就绪");
        } catch (e) {
            console.error("HandTracker Init Error:", e);
        }
    }

    detect() {
        if (!this.landmarker || !this.video || this.isDisposed) return this.gestureData;

        const now = performance.now();
        if (this.video.currentTime !== this.lastVideoTime) {
            this.lastVideoTime = this.video.currentTime;
            const results = this.landmarker.detectForVideo(this.video, now);
            
            if (results && results.landmarks.length > 0) {
                this.gestureData.handPresent = true;
                this._processHand(results.landmarks[0]);
            } else {
                this.gestureData.handPresent = false;
                this.gestureData.fingerCount = 0;
                this.gestureData.isPinching = false;
            }
        }
        return this.gestureData;
    }

    _processHand(landmarks) {
        // 1. 计算捏合 (保留原有逻辑作为备用)
        const thumbTip = landmarks[4];
        const indexTip = landmarks[8];
        const indexBase = landmarks[5];
        const wrist = landmarks[0];
        
        const pinchDist = this._dist(thumbTip, indexTip);
        const palmSize = this._dist(wrist, indexBase);
        const pinchRatio = pinchDist / palmSize;
        
        // 简单阈值判断捏合
        this.gestureData.isPinching = pinchRatio < 0.35;

        // 2. ✅ 核心升级：数手指 (Finger Counting)
        // 我们判断指尖 (Tip) 是否明显高于指根关节 (PIP/MCP)
        // 注意：Web 坐标系中 Y 轴向下是正，所以 "高" 意味着 y 值更 "小"
        
        let count = 0;
        
        // 拇指 (4) 判断比较特殊，通常判断 x 轴偏移
        // 这里简化：如果拇指尖 离 小指根(17) 比较远，算张开
        const pinkyBase = landmarks[17];
        if (this._dist(thumbTip, pinkyBase) > palmSize * 0.8) {
             count++;
        }

        // 其他四指：食指(8), 中指(12), 无名指(16), 小指(20)
        // 对应的指根关节：5, 9, 13, 17
        const fingerIndices = [8, 12, 16, 20];
        const knuckleIndices = [5, 9, 13, 17];

        for (let i = 0; i < 4; i++) {
            const tip = landmarks[fingerIndices[i]];
            const knuckle = landmarks[knuckleIndices[i]];
            
            // 同样利用参照物：如果指尖到手腕的距离 > 指根到手腕的距离，说明伸直了
            if (this._dist(tip, wrist) > this._dist(knuckle, wrist) * 1.1) {
                count++;
            }
        }
        
        this.gestureData.fingerCount = count;
    }

    _dist(p1, p2) {
        return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
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

    dispose() {
        this.isDisposed = true;
        if (this.video) {
            if(this.video.srcObject) this.video.srcObject.getTracks().forEach(t=>t.stop());
            this.video.remove();
        }
        if (this.landmarker) this.landmarker.close();
    }
}