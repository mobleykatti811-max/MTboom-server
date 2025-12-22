import * as THREE from 'three';

/**
 * 🎰 [MTboom 核心演员：暴富战神 - 最终版]
 * * 修改核心点：
 * 1. 彻底修复交互错位：只有接收到 WAVE 信号才触发暴击，不挥手时完全静止。
 * 2. 增强资源回收：通过 dispose() 彻底移除 DOM 挂件、纹理缓存和 Sprite 实例。
 * 3. 视觉内容翻倍：增加“财运指数”、“金条雨”和“假装在赚钱”的数值膨胀系统。
 */
export class CrazyCrit3D {
    constructor(scene) {
        this.scene = scene;
        this.sprite = null;
        this.texture = null;
        
        // --- 核心逻辑变量 ---
        this.isCrazy = false; 
        this.comboCount = 0;      // 连击数
        this.totalWealth = 0;     // 累计虚假财富
        this.lastActionTime = 0;  // 上次接收手势时间
        this.vipLevel = 0;        // 尊贵 VIP 等级
        
        // --- 资源 ID 追踪 (用于销毁) ---
        this.uiLayerId = `mt-wealth-layer-${Math.floor(Math.random() * 10000)}`;
        this.domElements = [];    // 追踪动态生成的 DOM
    }

    /**
     * 初始化：生成像素形象并注入下沉市场 UI
     */
    async init() {
        return new Promise((resolve) => {
            // 1. 动态生成战神贴图 (代码生成，无需外部资源)
            const canvas = document.createElement('canvas');
            canvas.width = 128; canvas.height = 128;
            const ctx = canvas.getContext('2d');
            
            // 绘制“暴富”配色像素人
            ctx.fillStyle = '#ff0000'; // 红色主体
            ctx.fillRect(32, 32, 64, 64); 
            ctx.fillStyle = '#ffd700'; // 纯金长剑
            ctx.fillRect(96, 10, 16, 100);
            ctx.fillStyle = '#000000'; // 黑超墨镜
            ctx.fillRect(45, 45, 40, 12);
            ctx.fillStyle = '#ffffff'; // 牙齿闪光
            ctx.fillRect(55, 65, 6, 6);

            this.texture = new THREE.CanvasTexture(canvas);
            this.texture.magFilter = THREE.NearestFilter; 
            this.texture.minFilter = THREE.NearestFilter;

            const material = new THREE.SpriteMaterial({ 
                map: this.texture, 
                transparent: true,
                color: 0xffffff 
            });
            this.sprite = new THREE.Sprite(material);
            this.sprite.scale.set(4, 4, 1); 
            this.scene.add(this.sprite);

            // 2. 注入全局 UI 挂件
            this._injectWealthUI();
            
            console.log('💎 [CrazyCrit3D] 战神已初始化，准备开始暴富之旅');
            resolve();
        });
    }

    /**
     * 每一帧的渲染逻辑
     */
    update(time, beat) {
        if (!this.sprite) return;

        const now = Date.now();
        
        // --- 核心修复：衰减逻辑 ---
        // 如果 1.2 秒没有接收到手势，自动进入待机模式，停止震动
        if (now - this.lastActionTime > 1200) {
            this.isCrazy = false;
            this.comboCount = 0;
            const comboEl = document.getElementById('mt-combo-text');
            if (comboEl) comboEl.style.opacity = '0';
        }

        if (this.isCrazy) {
            // --- 暴击抖动模式 ---
            const intensity = 0.2 + (this.comboCount * 0.03) + beat;
            this.sprite.position.x = (Math.random() - 0.5) * intensity;
            this.sprite.position.y = (Math.random() - 0.5) * intensity;
            
            // 色相爆闪
            this.sprite.material.color.setHSL((time * 5) % 1, 1.0, 0.5);
            
            // 缩放压迫感
            const s = 4 + Math.sin(time * 40) * 0.8;
            this.sprite.scale.set(s, s, 1);
        } else {
            // --- 待机恢复模式 ---
            this.sprite.position.lerp(new THREE.Vector3(0, 0, 0), 0.1);
            this.sprite.scale.lerp(new THREE.Vector3(4 + beat * 0.5, 4 + beat * 0.5, 1), 0.1);
            this.sprite.material.color.setHex(0xffffff);
        }
    }

    /**
     * 手势触发接口：这里是“爽点”来源
     */
    setInteraction(gesture) {
        if (gesture.type === 'WAVE') {
            this.isCrazy = true;
            this.lastActionTime = Date.now();
            this.comboCount++;
            
            // 挥手动作与数值增长强绑定
            this.spawnWealthBurst();
            this.spawnDamageText();
            
            // 连击升级逻辑
            if (this.comboCount % 10 === 0) {
                this.upgradeVIP();
            }
        }
    }

    /**
     * 注入下沉风格 UI
     */
    _injectWealthUI() {
        const container = document.createElement('div');
        container.id = this.uiLayerId;
        Object.assign(container.style, {
            position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: '9999'
        });
        container.innerHTML = `
            <div id="mt-vip-box" style="position:absolute; top:50px; left:20px; background:linear-gradient(to bottom, #ff0, #f80); color:#fff; padding:4px 12px; border:2px solid #fff; font-weight:900; font-style:italic; box-shadow: 0 0 10px #f00;">VIP 0</div>
            <div id="mt-gold-val" style="position:absolute; top:90px; left:20px; color:#ffd700; font-size:26px; font-weight:bold; text-shadow:2px 2px #000;">财运余额: 0.00</div>
            <div id="mt-combo-text" style="position:absolute; bottom:15%; width:100%; text-align:center; color:#ff0000; font-size:60px; font-weight:900; text-shadow:3px 3px #fff; opacity:0; transition: transform 0.1s;">0 COMBO</div>
        `;
        document.body.appendChild(container);
    }

    /**
     * 弹出暴击文字：修复“乱跳”问题，只有挥手才弹
     */
    spawnDamageText() {
        const slogans = ['暴富！', '金条+1', '逆袭！', '一刀999', '爽！', '核心算力提升'];
        const text = slogans[Math.floor(Math.random() * slogans.length)];
        
        const el = document.createElement('div');
        el.innerText = text;
        Object.assign(el.style, {
            position: 'fixed', left: (40 + Math.random() * 20) + '%', top: (40 + Math.random() * 20) + '%',
            color: '#ff0', fontSize: '32px', fontWeight: '900', textShadow: '2px 2px #f00',
            zIndex: '10001', whiteSpace: 'nowrap', pointerEvents: 'none',
            transition: 'all 0.6s ease-out', transform: 'translate(-50%, -50%) scale(0.5)'
        });
        document.body.appendChild(el);
        this.domElements.push(el);

        const comboEl = document.getElementById('mt-combo-text');
        if (comboEl) {
            comboEl.innerText = `${this.comboCount} COMBO`;
            comboEl.style.opacity = '1';
            comboEl.style.transform = `scale(${1 + Math.min(this.comboCount * 0.05, 1.5)})`;
        }

        requestAnimationFrame(() => {
            el.style.transform = 'translate(-50%, -200%) scale(1.5)';
            el.style.opacity = '0';
        });
        setTimeout(() => {
            el.remove();
            this.domElements = this.domElements.filter(d => d !== el);
        }, 600);
    }

    /**
     * 金币雨效果
     */
    spawnWealthBurst() {
        this.totalWealth += Math.random() * 888;
        const goldEl = document.getElementById('mt-gold-val');
        if (goldEl) goldEl.innerText = `财运余额: ${this.totalWealth.toFixed(2)}`;

        const coin = document.createElement('div');
        coin.innerText = '💰';
        coin.style.position = 'fixed';
        coin.style.left = Math.random() * 100 + 'vw';
        coin.style.top = '-50px';
        coin.style.fontSize = '30px';
        coin.style.zIndex = '9998';
        coin.style.transition = 'all 1s ease-in';
        document.body.appendChild(coin);
        this.domElements.push(coin);

        requestAnimationFrame(() => {
            coin.style.top = '110vh';
            coin.style.transform = `rotate(${Math.random() * 360}deg)`;
        });
        setTimeout(() => {
            coin.remove();
            this.domElements = this.domElements.filter(d => d !== coin);
        }, 1000);
    }

    /**
     * VIP 进阶
     */
    upgradeVIP() {
        this.vipLevel++;
        const badge = document.getElementById('mt-vip-box');
        if (badge) {
            badge.innerText = `VIP ${this.vipLevel}`;
            badge.style.transform = 'scale(1.5)';
            setTimeout(() => badge.style.transform = 'scale(1)', 200);
        }
    }

    /**
     * 🚿 彻底清理函数：切回主页时调用
     */
    dispose() {
        console.log('🧹 [CrazyCrit3D] 正在执行资源终极清理...');
        
        // 1. 移除 UI 大层
        const container = document.getElementById(this.uiLayerId);
        if (container) container.remove();

        // 2. 清理残留的动态 DOM
        this.domElements.forEach(el => {
            if (el && el.parentNode) el.remove();
        });
        this.domElements = [];

        // 3. 销毁 3D 资源
        if (this.sprite) {
            this.scene.remove(this.sprite);
            if (this.sprite.material) {
                if (this.sprite.material.map) this.sprite.material.map.dispose();
                this.sprite.material.dispose();
            }
        }
        if (this.texture) this.texture.dispose();
        
        console.log('✅ [CrazyCrit3D] 清理完成，内存已释放');
    }
}