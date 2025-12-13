import { FilesetResolver, HandLandmarker } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0';

/**
 * HandTracker - 禅意互动版 (Pro)
 * 升级内容：
 * 1. 增加 vx, vy 方向向量，支持区分上下左右挥手。
 * 2. 保持原有的合十判定。
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
            speed: 0,         // 总速度 (magnitude)
            vx: 0,            // [新增] 水平速度 (+右, -左)
            vy: 0,            // [新增] 垂直速度 (+上, -下)
            isOpen: false,    
            openness: 0,      
            
            isPrayer: false,  
            isPresent: false  
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
                numHands: 2, 
                minHandDetectionConfidence: 0.75, 
                minHandPresenceConfidence: 0.75,
                minTrackingConfidence: 0.75
            });

            await this._setupCamera();
            console.log("🖐️ HandTracker: 方向感知模式启动");
        } catch (error) {
            console.warn("⚠️ HandTracker 初始化受限:", error);
        }
    }

    detect() {
        if (!this.landmarker || !this.video) return this.gestureData;

        try {
            if (this.video.currentTime !== this.lastVideoTime) {
                this.lastVideoTime = this.video.currentTime;
                this.results = this.landmarker.detectForVideo(this.video, performance.now());
            }

            this.gestureData.isPrayer = false;
            this.gestureData.isPresent = false;

            if (this.results && this.results.landmarks.length > 0) {
                const hands = this.results.landmarks;
                this.gestureData.isPresent = true;

                if (hands.length === 2) {
                    this.gestureData.isPrayer = this._checkPrayerGesture(hands[0], hands[1]);
                }

                this._processPrimaryHand(hands[0]);

            } else {
                // 阻尼归零
                this.gestureData.speed *= 0.8; 
                this.gestureData.vx *= 0.8;
                this.gestureData.vy *= 0.8;
                if (Math.abs(this.gestureData.speed) < 0.1) {
                    this.gestureData.speed = 0;
                    this.gestureData.vx = 0;
                    this.gestureData.vy = 0;
                }
                this.gestureData.isOpen = false;
                this.gestureData.openness *= 0.9;
            }
        } catch (e) {
            // ignore
        }

        return this.gestureData;
    }

    _setupCamera() {
        return new Promise((resolve) => {
            let video = document.getElementById("ar-camera-feed");
            if (!video) {
                video = document.createElement("video");
                video.style.display = "none"; 
                document.body.appendChild(video);
            }
            video.setAttribute("playsinline", "");
            video.id = "ar-camera-feed";
            
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                resolve(); return;
            }

            navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } } 
            }).then((stream) => {
                video.srcObject = stream;
                video.onloadedmetadata = () => { video.play(); this.video = video; resolve(); };
            }).catch(err => {
                resolve(); 
            });
        });
    }

    _checkPrayerGesture(handA, handB) {
        const wristDist = this._dist3d(handA[0], handB[0]);
        const tipDist = this._dist3d(handA[8], handB[8]);
        return (wristDist < 0.2 && tipDist < 0.2);
    }

    _processPrimaryHand(landmarks) {
        const wrist = landmarks[0];
        const indexTip = landmarks[8];
        const thumbTip = landmarks[4];
        const middleRoot = landmarks[9];

        // 1. 坐标 (注意：MediaPipe Y轴向下为正，但为了直观，我们这里 1.0 - y 让上方为 1)
        const currentX = 1.0 - wrist.x; 
        const currentY = 1.0 - wrist.y;

        // 2. 开合度
        const handSize = this._dist(wrist, middleRoot);
        const pinchDist = this._dist(thumbTip, indexTip);
        let ratio = pinchDist / (handSize * 1.2);
        ratio = Math.min(Math.max(ratio, 0), 1);
        this.gestureData.openness += (ratio - this.gestureData.openness) * 0.2;
        this.gestureData.isOpen = this.gestureData.openness > 0.7;

        // 3. 速度与方向计算
        const now = performance.now();
        const dt = now - this.lastPos.time;
        
        if (dt > 50) { 
            const dx = currentX - this.lastPos.x;
            const dy = currentY - this.lastPos.y; // 向上移动 dy > 0
            
            const dist = Math.sqrt(dx*dx + dy*dy);
            
            // 计算分量速度 (单位：屏幕比例/秒 * 系数)
            let rawVx = (dx / dt) * 5000;
            let rawVy = (dy / dt) * 5000;
            let rawSpeed = (dist / dt) * 5000; 

            if (dist < 0.005) {
                rawSpeed = 0; rawVx = 0; rawVy = 0;
            }

            this.lastPos = { x: currentX, y: currentY, time: now };
            
            // 平滑处理
            const smooth = 0.3;
            this.gestureData.speed += (rawSpeed - this.gestureData.speed) * smooth;
            this.gestureData.vx += (rawVx - this.gestureData.vx) * smooth;
            this.gestureData.vy += (rawVy - this.gestureData.vy) * smooth;
        }
        
        this.gestureData.x = currentX;
        this.gestureData.y = currentY;
    }

    _dist(p1, p2) {
        return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
    }
    
    _dist3d(p1, p2) {
        return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2) + Math.pow(p1.z - p2.z, 2));
    }
}