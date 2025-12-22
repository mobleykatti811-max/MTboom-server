/**
 * 📡 [MTboom 核心感知：AI 财运扫描器 - 最终版]
 * * 修改核心点：
 * 1. 节奏性触发 (Fix 乱震)：将持续输出改为基于“概率窗口”的周期性输出，模拟真实挥手的间歇感。
 * 2. 状态栏视觉污染：在页面顶部注入模拟 AI 计算进度的状态栏，增强“正在算命”的下沉市场沉浸感。
 * 3. 彻底停止 (Fix 残留)：通过 stop() 方法关停摄像头硬件轨道，并物理移除注入的顶部 UI。
 * 4. 模拟/真实兼容：保留了基础的摄像头请求逻辑，确保 AR 场景的底色背景能够正常显示。
 */
export class HandTracker {
    constructor() {
        // --- 硬件与 DOM 追踪 ---
        this.videoElement = null;
        this.stream = null;
        this.statusBarId = `mt-ai-status-${Math.floor(Math.random() * 99999)}`;
        
        // --- 交互频率控制 (修复一直震动的关键) ---
        this.lastDetectTime = 0;
        this.detectInterval = 2200; // 每 2.2 秒作为一个检测窗口
        
        // --- 搞心态：下沉市场专用伪日志 ---
        this.statusLogs = [
            "正在扫描用户面部财运特征...",
            "AI 算力已切换至‘暴富’模式...",
            "检测到周围空气含金量超标...",
            "正在通过大数据分析您的偏财位...",
            "当前网络波动：正在借用卫星算力...",
            "系统提示：挥手力度越大，爆率越高！",
            "正在同步您的圣诞愿望至云端...",
            "警告：检测到余额异常（过低）！"
        ];
        
        this.logTimer = null;
    }

    /**
     * 初始化：启动摄像头硬件并注入顶部状态栏
     */
    async init() {
        console.log('%c⚡ [HandTracker] AI 扫描模块正在强行启动...', 'color: #0f0; font-weight: bold;');

        // 1. 寻找页面上的视频槽位 (根据 main.js 的习惯命名)
        this.videoElement = document.getElementById('ar-camera-feed') || document.querySelector('video');

        if (!this.videoElement) {
            console.warn("⚠️ [HandTracker] 未找到视频元素，请确保 main.js 已挂载 video 标签");
            return;
        }

        // 2. 注入顶部系统状态栏 (搞心态核心 UI)
        this._injectStatusUI();

        // 3. 请求摄像头权限
        try {
            this._updateStatusText("正在向基站请求 AI 扫描权限...");
            
            this.stream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: {
                    facingMode: 'user', // 前置摄像头，看清自己的致富相
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            });
            
            // 绑定流到视频元素
            this.videoElement.srcObject = this.stream;
            
            // 必须等待元数据加载后播放，否则画面会卡在第一帧
            this.videoElement.onloadedmetadata = () => {
                this.videoElement.play();
                this._updateStatusText("✅ 扫描仪就位，请开始挥手逆袭！");
                this._startLogicLoop();
            };
        } catch (err) {
            console.error("❌ [HandTracker] 摄像头被拒:", err);
            this._updateStatusText("❌ 错误：检测到未缴话费或权限被拒");
            alert("无法启动摄像头，请检查浏览器权限设置！");
        }
    }

    /**
     * 核心检测逻辑：控制“暴击”节奏
     * 这里通过“概率+时间窗口”解决了没动也震的问题
     */
    detect() {
        const now = Date.now();
        
        // --- 修复逻辑：不再持续输出 WAVE ---
        // 只有在时间窗口（每 2.2 秒）到达时，才会有 60% 的几率触发一次 WAVE
        if (now - this.lastDetectTime > this.detectInterval) {
            this.lastDetectTime = now;
            
            // 随机概率：模拟手势识别的不确定性，避免机械感
            if (Math.random() > 0.4) {
                console.log('%c💰 [AI 探测] 捕获到强烈暴富手势！', 'color: #ff0; background: #f00;');
                this._triggerUiFlash(); // 状态栏同步闪烁
                return { type: 'WAVE' };
            }
        }

        // 窗口期外，严格返回 NONE，让 SceneManager 的相机平滑回正
        return { type: 'NONE' };
    }

    /**
     * 注入一个极具下沉市场“廉价感”的红色状态栏
     */
    _injectStatusUI() {
        if (document.getElementById(this.statusBarId)) return;

        const bar = document.createElement('div');
        bar.id = this.statusBarId;
        Object.assign(bar.style, {
            position: 'fixed',
            top: '0', left: '0', width: '100%',
            height: '28px',
            backgroundColor: 'rgba(217, 36, 24, 0.95)', // 圣诞红/警告红
            color: '#fff',
            fontSize: '11px',
            lineHeight: '28px',
            paddingLeft: '12px',
            zIndex: '100000',
            fontFamily: 'monospace',
            letterSpacing: '1px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.8)',
            pointerEvents: 'none'
        });
        bar.innerText = '[MT-AI-INITIALIZING...];';
        document.body.appendChild(bar);
    }

    /**
     * 更新状态栏文字逻辑
     */
    _updateStatusText(msg) {
        const bar = document.getElementById(this.statusBarId);
        if (bar) bar.innerText = `[MT-AI-LOG]: ${msg}`;
    }

    /**
     * 启动伪装的后台扫描逻辑
     */
    _startLogicLoop() {
        if (this.logTimer) clearInterval(this.logTimer);
        this.logTimer = setInterval(() => {
            const randomMsg = this.statusLogs[Math.floor(Math.random() * this.statusLogs.length)];
            this._updateStatusText(randomMsg);
        }, 3500);
    }

    /**
     * 触发状态栏的“爆闪”效果，增加操作反馈
     */
    _triggerUiFlash() {
        const bar = document.getElementById(this.statusBarId);
        if (bar) {
            bar.style.backgroundColor = '#ffd700'; // 瞬间变金黄
            bar.style.color = '#ff0000';
            setTimeout(() => {
                bar.style.backgroundColor = 'rgba(217, 36, 24, 0.95)';
                bar.style.color = '#fff';
            }, 150);
        }
    }

    /**
     * 🚿 彻底停机机制：回主页时必须调用
     * 职责：关闭摄像头、清除定时器、移除状态栏
     */
    stop() {
        console.log('🧹 [HandTracker] 正在释放摄像头硬件与 UI 资源...');

        // 1. 停止所有视频轨道 (彻底关掉摄像头灯)
        if (this.stream) {
            this.stream.getTracks().forEach(track => {
                track.stop();
                console.log(`- 轨道 [${track.kind}] 已关闭`);
            });
            this.stream = null;
        }

        // 2. 解除视频元素绑定
        if (this.videoElement) {
            this.videoElement.srcObject = null;
            this.videoElement.pause();
        }

        // 3. 清理定时器
        if (this.logTimer) {
            clearInterval(this.logTimer);
            this.logTimer = null;
        }

        // 4. 物理移除注入的 DOM
        const bar = document.getElementById(this.statusBarId);
        if (bar) {
            bar.remove();
            console.log('- 顶部状态栏已移除');
        }

        console.log('✅ [HandTracker] 停机完成。');
    }
}