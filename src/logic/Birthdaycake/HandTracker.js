import { FilesetResolver, FaceLandmarker } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.9/+esm";

/**
 * HandTracker (Special Face Edition for Birthday Cake)
 * 这是一个为了"吹气"功能特化的追踪器。
 * 虽然类名叫 HandTracker（为了兼容主程序接口），但它实际上运行的是 FaceLandmarker。
 */
export class HandTracker {
    constructor() {
        this.landmarker = null;
        this.video = null;
        this.lastVideoTime = -1;
        
        // 遵循主框架的数据结构，但核心是 isBlowing
        this.gestureData = {
            isPinching: false,
            fingerCount: 0,
            handPresent: false,
            isBlowing: false // ✅ 核心字段：吹气状态
        };
    }

    async init() {
        try {
            const vision = await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
            );

            // ✅ 关键修改：加载 FaceLandmarker 而不是 HandLandmarker
            this.landmarker = await FaceLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
                    delegate: "GPU"
                },
                runningMode: "VIDEO",
                numFaces: 1,
                minFaceDetectionConfidence: 0.5,
                minFacePresenceConfidence: 0.5,
                minTrackingConfidence: 0.5,
                outputFaceBlendshapes: true // ✅ 必须开启：这是检测嘴型的关键
            });

            await this._setupCamera();
            console.log("🌬️ FaceTracker: 吹气检测模型已就绪");
        } catch (e) {
            console.error("❌ Tracker Init Error:", e);
        }
    }

    detect() {
        if (!this.landmarker || !this.video) return this.gestureData;

        const now = performance.now();
        if (this.video.currentTime !== this.lastVideoTime) {
            this.lastVideoTime = this.video.currentTime;
            
            // 检测面部
            const results = this.landmarker.detectForVideo(this.video, now);
            
            // 如果检测到了人脸，且有 Blendshapes 数据
            if (results && results.faceBlendshapes && results.faceBlendshapes.length > 0) {
                this.gestureData.handPresent = true; // 这里借用字段表示“有人”
                
                // 获取面部肌肉参数 (Blendshapes)
                const shapes = results.faceBlendshapes[0].categories;
                
                // 查找特定的形状系数：mouthPucker (嘟嘴) 和 mouthFunnel (漏斗嘴)
                const pucker = shapes.find(s => s.categoryName === 'mouthPucker')?.score || 0;
                const funnel = shapes.find(s => s.categoryName === 'mouthFunnel')?.score || 0;

                // 阈值判断：如果嘟嘴程度超过 0.4，判定为正在吹气
                // 你可以在控制台打印 pucker 的值来调试灵敏度
                this.gestureData.isBlowing = (pucker > 0.4 || funnel > 0.4);

            } else {
                this.gestureData.handPresent = false;
                this.gestureData.isBlowing = false;
            }
        }
        return this.gestureData;
    }

    _setupCamera() {
        return new Promise((resolve) => {
            let video = document.getElementById("ar-camera-feed-hidden");
            if (!video) {
                // 创建一个隐藏的 video 元素用于分析，不干扰主界面 AR 视频流
                video = document.createElement("video");
                video.id = "ar-camera-feed-hidden";
                video.style.display = "none";
                video.autoplay = true;
                video.playsInline = true;
                document.body.appendChild(video);
            }
            if (!navigator.mediaDevices) { resolve(); return; }
            
            navigator.mediaDevices.getUserMedia({ 
                video: { 
                    facingMode: "user", 
                    width: 640, 
                    height: 480 
                } 
            }).then(stream => { 
                video.srcObject = stream; 
                video.onloadedmetadata = () => { 
                    video.play(); 
                    this.video = video; 
                    resolve(); 
                }; 
            }).catch((err) => {
                console.error("Camera access denied:", err);
                resolve();
            });
        });
    }

    dispose() {
        if (this.video && this.video.srcObject) {
            this.video.srcObject.getTracks().forEach(t => t.stop());
        }
        if (this.landmarker) this.landmarker.close();
    }
}