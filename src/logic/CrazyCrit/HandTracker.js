export class HandTracker {
    constructor() {
        this.lastMockTime = 0;
        this.videoElement = null;
    }

    async init() {
        console.log('📷 初始化简易摄像头...');
        
        // 1. 寻找 DOM 中的视频元素 (根据 main.js 的逻辑，通常 ID 是 ar-camera-feed)
        // 如果找不到，就尝试找页面上第一个 video 标签
        this.videoElement = document.getElementById('ar-camera-feed') || document.querySelector('video');

        if (!this.videoElement) {
            console.error("❌ 找不到视频元素 (id='ar-camera-feed')，无法显示画面");
            return;
        }

        // 2. 手动请求摄像头权限并播放
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: {
                    facingMode: 'user', // 前置摄像头
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            });
            
            this.videoElement.srcObject = stream;
            // 必须手动 play，否则画面是黑的
            this.videoElement.onloadedmetadata = () => {
                this.videoElement.play();
                console.log("✅ 摄像头画面已启动");
            };
        } catch (err) {
            console.error("❌ 摄像头启动失败:", err);
            alert("无法启动摄像头，请检查权限");
        }
    }

    detect() {
        const now = Date.now();
        
        // --- 模拟逻辑：每 2 秒自动触发一次暴击 ---
        // 这样即使没有 AI 识别，你也能看到鬼畜动画效果
        if (now - this.lastMockTime > 2000) {
            this.lastMockTime = now;
            console.log('⚔️ [模拟信号] 触发暴击！');
            return { type: 'WAVE' };
        }

        return { type: 'NONE' };
    }
}