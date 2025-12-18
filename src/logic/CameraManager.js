/**
 * 全局摄像头管理器
 * 负责统一申请权限、处理横竖屏分辨率、管理视频流生命周期
 */
export class CameraManager {
    static async start() {
        const video = document.getElementById("ar-camera-feed");
        if (!video) {
            console.error("❌ 找不到摄像头 DOM 元素 #ar-camera-feed");
            return;
        }

        // 1. 如果流已经在跑了，就别重新申请了，节省性能
        if (video.srcObject && video.srcObject.active) {
            console.log("📷 摄像头流已存在，复用中...");
            if (video.paused) video.play();
            return;
        }

        // 2. 智能计算分辨率 (横竖屏适配)
        const isPortrait = window.innerHeight > window.innerWidth;
        const constraints = {
            audio: false,
            video: {
                facingMode: "user",
                // 动态调整：竖屏要高>宽，横屏要宽>高
                width: { ideal: isPortrait ? 720 : 1280 },
                height: { ideal: isPortrait ? 1280 : 720 }
            }
        };

        console.log(`📷 正在启动摄像头 (模式: ${isPortrait ? '竖屏' : '横屏'})...`);

        try {
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            video.srcObject = stream;
            
            // 等待元数据加载完毕，确保尺寸正确
            await new Promise((resolve) => {
                video.onloadedmetadata = () => {
                    video.play();
                    resolve();
                };
            });
            console.log("✅ 摄像头启动成功");
        } catch (err) {
            console.error("❌ 摄像头启动失败:", err);
            alert("无法启动摄像头，请检查权限设置。\n" + err.message);
            throw err; // 抛出错误让上层处理
        }
    }

    static stop() {
        const video = document.getElementById("ar-camera-feed");
        if (video && video.srcObject) {
            const tracks = video.srcObject.getTracks();
            tracks.forEach(track => {
                track.stop(); // 彻底关闭硬件占用
            });
            video.srcObject = null;
            console.log("🛑 摄像头已关闭");
        }
    }
}