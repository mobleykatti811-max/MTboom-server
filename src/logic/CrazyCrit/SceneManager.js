import * as THREE from 'three';
// 导入我们刚刚重构的暴富战神类
import { CrazyCrit3D } from './CrazyCrit3D.js';

/**
 * 🚀 [MTboom 视觉总指挥：SceneManager 终极资源回收版]
 * * 职责：
 * 1. 物理级震屏：直接操作 THREE.Camera 的坐标，实现比 CSS 抖动更具冲击力的 3D 震感 。
 * 2. 交互状态同步：作为中转站，将 HandTracker 的信号精准传导给演员 。
 * 3. 视觉滤镜控制：在暴击连击达到阈值时，开启全屏反色和色相旋转，搞炸用户心态。
 * 4. 彻底销毁：监控所有注入的 DOM 和渲染器内存，确保回主页后手机不发烫、不卡顿 。
 */
export class SceneManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.clock = new THREE.Clock();
        
        // 核心演员实例
        this.actor = null;

        // --- 爆炸视觉配置 ---
        this.shakeIntensity = 0;   // 实时震动强度
        this.baseZ = 6;            // 相机初始深度
        this.chaosBgId = `mt-bg-chaos-${Math.floor(Math.random() * 9999)}`;
        
        // 用于回收的弹幕 ID 追踪
        this.bulletIdCounter = 0;
        this.activeBullets = new Set();
    }

    /**
     * 初始化 3D 舞台与背景干扰系统
     */
    init() {
        // 1. 创建 3D 场景
        this.scene = new THREE.Scene();

        // 2. 创建透视相机 (FOV 设为 80 增加广角拉伸感，让震动更显眼)
        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(80, aspect, 0.1, 100);
        this.camera.position.z = this.baseZ;

        // 3. 创建渲染器 (追求下沉市场的像素感，关闭抗锯齿)
        this.renderer = new THREE.WebGLRenderer({ 
            canvas: this.canvas, 
            antialias: false, 
            alpha: true 
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        // 4. 环境光与点光源 (为战神的材质增加一点金属反光感)
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        this.scene.add(ambientLight);
        
        const flashLight = new THREE.PointLight(0xff0000, 2, 20);
        flashLight.position.set(2, 2, 2);
        this.scene.add(flashLight);

        // 5. 实例化战神演员
        this.actor = new CrazyCrit3D(this.scene);
        
        // 6. 注入搞心态的底层背景干扰
        this._injectChaoticBackground();

        window.addEventListener('resize', () => this.onResize());

        console.log('🎬 [SceneManager] 舞台准备就绪，背景污染已同步注入');
        return this.actor.init();
    }

    /**
     * 核心渲染循环：这里控制“震动”与“恢复”的平衡 
     */
    render(gesture, beat) {
        if (!this.actor || !this.renderer) return;
        
        const time = this.clock.getElapsedTime();

        // A. 状态分发：将手势传入演员 
        this.actor.setInteraction(gesture);
        this.actor.update(time, beat);

        // B. 动态反馈逻辑：解决“没挥手也震”的问题
        if (this.actor.isCrazy) {
            // 震动强度随演员的 comboCount 线性增长
            this.shakeIntensity = Math.min(this.actor.comboCount * 0.04, 0.6) + (beat * 0.2);
            
            // 物理震动：随机偏移相机位置 
            this.camera.position.x = (Math.random() - 0.5) * this.shakeIntensity;
            this.camera.position.y = (Math.random() - 0.5) * this.shakeIntensity;
            this.camera.position.z = this.baseZ + (Math.random() - 0.5) * this.shakeIntensity;

            // C. 视觉污染：高频闪烁 Canvas 滤镜
            const isFlashFrame = Math.sin(Date.now() * 0.1) > 0;
            if (this.actor.comboCount > 15) {
                // 连击越高，颜色越乱
                this.canvas.style.filter = isFlashFrame ? `invert(1) hue-rotate(${time * 180}deg)` : 'none';
            } else {
                this.canvas.style.filter = isFlashFrame ? 'contrast(200%)' : 'none';
            }

            // D. 随机发射搞心态弹幕
            if (Math.random() > 0.96) this._spawnFakeBulletChat();

        } else {
            // --- 待机平稳模式 ---
            // 使用 lerp 算法让相机平滑地回到原点坐标 (0, 0, 6)
            this.camera.position.lerp(new THREE.Vector3(0, 0, this.baseZ), 0.15);
            
            // 关闭所有全屏滤镜
            this.canvas.style.filter = 'none';
            
            // 重置震动强度
            this.shakeIntensity = 0;
        }

        // 执行 Three.js 渲染
        this.renderer.render(this.scene, this.camera);
    }

    /**
     * 注入一个布满“致富诱导”符号的底层背景
     */
    _injectChaoticBackground() {
        if (document.getElementById(this.chaosBgId)) return;

        const bg = document.createElement('div');
        bg.id = this.chaosBgId;
        Object.assign(bg.style, {
            position: 'fixed', inset: '0', zIndex: '-1',
            backgroundColor: '#000', overflow: 'hidden', pointerEvents: 'none'
        });
        
        // 随机撒满底噪符号
        const symbols = ['￥', '$', 'BTC', '777', 'WIN'];
        for (let i = 0; i < 25; i++) {
            const span = document.createElement('span');
            span.innerText = symbols[Math.floor(Math.random() * symbols.length)];
            Object.assign(span.style, {
                position: 'absolute',
                left: Math.random() * 100 + '%',
                top: Math.random() * 100 + '%',
                color: '#1a1a1a',
                fontSize: '20px',
                transform: `rotate(${Math.random() * 360}deg)`
            });
            bg.appendChild(span);
        }
        document.body.appendChild(bg);
    }

    /**
     * 发射搞心态虚假弹幕
     */
    _spawnFakeBulletChat() {
        const texts = ['这爆率太高了！', '老板疯了？', '我也想中玛莎拉蒂', '前面的带带我', '绝了！', '已经提现了！'];
        const bullet = document.createElement('div');
        const id = `bullet-${this.bulletIdCounter++}`;
        bullet.id = id;
        this.activeBullets.add(id);

        Object.assign(bullet.style, {
            position: 'fixed', right: '-200px', top: (15 + Math.random() * 70) + '%',
            color: '#fff', fontSize: '20px', fontWeight: 'bold', zIndex: '15000',
            whiteSpace: 'nowrap', textShadow: '2px 2px #f00', pointerEvents: 'none',
            transition: 'transform 4s linear'
        });
        bullet.innerText = texts[Math.floor(Math.random() * texts.length)];
        document.body.appendChild(bullet);

        // 动画启动
        requestAnimationFrame(() => {
            bullet.style.transform = `translateX(-${window.innerWidth + 400}px)`;
        });

        // 自动回收
        setTimeout(() => {
            bullet.remove();
            this.activeBullets.delete(id);
        }, 4100);
    }

    onResize() {
        if (!this.camera || !this.renderer) return;
        const width = window.innerWidth;
        const height = window.innerHeight;
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    /**
     * 🚿 终极清理机制：解决回主页元素残留的关键 
     */
    dispose() {
        console.log('🧹 [SceneManager] 正在强力回收 3D 舞台资源...');

        // 1. 停止渲染逻辑，销毁演员
        if (this.actor) {
            this.actor.dispose();
            this.actor = null;
        }

        // 2. 移除背景层
        const bg = document.getElementById(this.chaosBgId);
        if (bg) bg.remove();

        // 3. 清理所有正在飞行的弹幕
        this.activeBullets.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.remove();
        });
        this.activeBullets.clear();

        // 4. 彻底释放渲染器内存 
        if (this.renderer) {
            this.renderer.dispose();
            this.renderer.forceContextLoss(); // 强制丢失上下文，释放 GPU
            this.renderer = null;
        }

        // 5. 移除窗口监听
        window.removeEventListener('resize', () => this.onResize());
        
        // 6. 重置 Canvas 滤镜
        this.canvas.style.filter = 'none';

        console.log('✅ [SceneManager] 舞台已拆除，无残留。');
    }
}