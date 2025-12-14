import { Hands } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';

export class HandTracker {
    constructor() {
        this.hands = null;
        this.camera = null;
        this.videoElement = null;
        this.latestResults = null;
    }

    async init() {
        console.log("🖐️ 启动真实手势识别...");

        // 1. 创建视频元素
        this.videoElement = document.createElement('video');
        
        // >>> 关键修改：不再隐藏，而是把它放到最底层铺满全屏 <<<
        // this.videoElement.style.display = 'none'; // 删掉这行
        Object.assign(this.videoElement.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            objectFit: 'cover', // 保持比例铺满，可能会有裁剪
            zIndex: '-1' // 放在最底层 (app 容器下面)
        });

        // 插入到 body 中
        document.body.appendChild(this.videoElement);

        // 2. 初始化 MediaPipe
        this.hands = new Hands({locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        }});

        this.hands.setOptions({
            maxNumHands: 1,
            modelComplexity: 1,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });

        this.hands.onResults((results) => {
            this.latestResults = results;
        });

        // 3. 启动摄像头
        this.camera = new Camera(this.videoElement, {
            onFrame: async () => {
                await this.hands.send({image: this.videoElement});
            },
            // 尝试请求更高的分辨率，让画面更清晰
            width: 1280,
            height: 720
        });

        await this.camera.start();
    }

    detect() {
        const data = {
            gesture: { type: 'NONE' },
            handCenter: null
        };

        if (this.latestResults && this.latestResults.multiHandLandmarks.length > 0) {
            const landmarks = this.latestResults.multiHandLandmarks[0];
            
            // 获取手掌中心 (中指根部)
            data.handCenter = {
                x: landmarks[9].x, 
                y: landmarks[9].y
            };

            // 简单的挥手判定 (大拇指和小拇指距离远 = 张开手)
            const thumb = landmarks[4];
            const pinky = landmarks[20];
            // 计算两点间距离
            const spread = Math.sqrt(Math.pow(thumb.x - pinky.x, 2) + Math.pow(thumb.y - pinky.y, 2));
            
            // 阈值调整：0.25 比较容易触发
            if (spread > 0.25) {
                data.gesture.type = 'WAVE';
            }
        }

        return data;
    }
}