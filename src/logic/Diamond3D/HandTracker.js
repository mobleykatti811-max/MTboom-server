import { FilesetResolver, HandLandmarker } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0';

/**
 * HandTracker - 双手比心版 (带防崩溃保护)
 * 核心升级：
 * 1. numHands: 2 -> 开启双手追踪，准备识别比心。
 * 2. _checkHeartGesture -> 新增比心判定算法。
 * 3. 保留了防崩溃逻辑，HTTP 环境下不会卡死。
 */
export class HandTracker {
    constructor() {
        this.landmarker = null;
        this.video = null;
        this.lastVideoTime = -1;
        this.results = undefined;
        
        // --- 状态存储 ---
        this.gestureData = {
            x: 0.5,           
            y: 0.5,           
            speed: 0,         
            isOpen: false,    
            openness: 0,
            // [新增] 比心状态
            isHeart: false 
        };

        this.lastPos = { x: 0.5, y: 0.5, time: 0 };
    }

    async init() {
        try {
            const vision = await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
            );

            this.landmarker = await HandLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
                    delegate: "GPU"
                },
                runningMode: "VIDEO",
                // [核心修改] 允许检测 2 只手
                numHands: 2, 
                minHandDetectionConfidence: 0.75, 
                minHandPresenceConfidence: 0.75,
                minTrackingConfidence: 0.75
            });

            await this._setupCamera();
            console.log("🖐️ HandTracker: 双手模式启动");
        } catch (error) {
            console.warn("⚠️ HandTracker 初始化受限 (可能是网络或权限问题)，但这不影响 3D 显示。", error);
        }
    }

    detect() {
        // 如果没有初始化成功，直接返回默认数据，不要报错
        if (!this.landmarker || !this.video) return this.gestureData;

        try {
            if (this.video.currentTime !== this.lastVideoTime) {
                this.lastVideoTime = this.video.currentTime;
                this.results = this.landmarker.detectForVideo(this.video, performance.now());
            }

            // 默认重置比心状态
            this.gestureData.isHeart = false;

            if (this.results && this.results.landmarks.length > 0) {
                const hands = this.results.landmarks;

                // --- A. 比心检测 ---
                // 只有当检测到两只手时，才去算有没有比心
                if (hands.length === 2) {
                    this.gestureData.isHeart = this._checkHeartGesture(hands[0], hands[1]);
                }

                // --- B. 基础交互 (旋转/爆灯) ---
                // 我们依然只用"第一只手"来控制旋转，避免逻辑打架
                this._processPrimaryHand(hands[0]);

            } else {
                // 没手时的归零逻辑
                this.gestureData.speed *= 0.8; 
                if (Math.abs(this.gestureData.speed) < 0.1) this.gestureData.speed = 0;
                this.gestureData.isOpen = false;
            }
        } catch (e) {
            // 忽略偶尔的丢帧错误
        }

        return this.gestureData;
    }

    _setupCamera() {
        return new Promise((resolve) => {
            // 1. 找 UI 上的 video 标签
            let video = document.getElementById("ar-camera-feed");
            if (!video) {
                video = document.createElement("video");
                video.style.display = "none";
            }
            video.setAttribute("playsinline", "");
            
            // [防崩溃保护]
            // 如果浏览器不支持摄像头(比如在 HTTP 下)，直接放行，不要死在这里
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                console.warn("🚫 当前环境不支持摄像头 API (请使用 HTTPS 或 localhost)");
                resolve(); 
                return;
            }

            // 2. 尝试打开摄像头
            navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } } 
            }).then((stream) => {
                video.srcObject = stream;
                video.onloadedmetadata = () => { video.play(); this.video = video; resolve(); };
            }).catch(err => {
                console.warn("🚫 摄像头权限被拒绝:", err);
                resolve(); // 即使被拒也放行，保证程序不崩
            });
        });
    }

    // [新增] 比心判定算法
    _checkHeartGesture(handA, handB) {
        // 获取两只手的关键点：拇指尖(4) 和 食指尖(8)
        const tipA1 = handA[4]; // 手A 拇指
        const tipA2 = handA[8]; // 手A 食指
        const tipB1 = handB[4]; // 手B 拇指
        const tipB2 = handB[8]; // 手B 食指

        // 计算"交叉距离"：检测是否指尖对指尖
        // 拇指找拇指，食指找食指
        const distThumb = this._dist3d(tipA1, tipB1);
        const distIndex = this._dist3d(tipA2, tipB2);

        // 阈值判定：这个值需要调试，0.15 比较容易触发
        if (distThumb < 0.15 && distIndex < 0.15) {
            return true;
        }
        return false;
    }

    // 原有的单手处理逻辑
    _processPrimaryHand(landmarks) {
        const wrist = landmarks[0];
        const indexTip = landmarks[8];
        const thumbTip = landmarks[4];
        const middleRoot = landmarks[9];

        const currentX = 1.0 - wrist.x; 
        const currentY = 1.0 - wrist.y;

        // 开合度
        const handSize = this._dist(wrist, middleRoot);
        const pinchDist = this._dist(thumbTip, indexTip);
        let ratio = pinchDist / (handSize * 1.2);
        ratio = Math.min(Math.max(ratio, 0), 1);
        this.gestureData.openness += (ratio - this.gestureData.openness) * 0.2;
        this.gestureData.isOpen = this.gestureData.openness > 0.7;

        // 速度 (带防抖)
        const now = performance.now();
        const dt = now - this.lastPos.time;
        if (dt > 80) { 
            const dx = currentX - this.lastPos.x;
            const dy = currentY - this.lastPos.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            
            let rawSpeedX = (dx / dt) * 3000;
            if (dist < 0.025) rawSpeedX = 0; // 死区

            this.lastPos = { x: currentX, y: currentY, time: now };
            this.gestureData.speed += (rawSpeedX - this.gestureData.speed) * 0.15;
            this.gestureData.speed = Math.max(-25, Math.min(25, this.gestureData.speed));
        }
    }

    _dist(p1, p2) {
        return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
    }
    
    // 3D 距离 (包含 Z 轴，判定比心更准)
    _dist3d(p1, p2) {
        return Math.sqrt(
            Math.pow(p1.x - p2.x, 2) + 
            Math.pow(p1.y - p2.y, 2) + 
            Math.pow(p1.z - p2.z, 2)
        );
    }
}