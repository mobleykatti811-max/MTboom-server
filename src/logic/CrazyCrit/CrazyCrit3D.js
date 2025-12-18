import * as THREE from 'three';

// ✅ 这里的类名必须是 CrazyCrit3D，否则 SceneManager 引用会报错
export class CrazyCrit3D {
    constructor(scene) {
        this.scene = scene;
        this.sprite = null;
        
        // 状态变量
        this.isCrazy = false; 
        this.crazyTimer = 0;
        this.lastDamageTime = 0;
    }

    async init() {
        return new Promise((resolve) => {
            // --- 纯代码绘制像素贴图 (无需 3D 文件) ---
            const canvas = document.createElement('canvas');
            canvas.width = 64; canvas.height = 64;
            const ctx = canvas.getContext('2d');
            
            // 绘制像素小人 (红黄配色)
            ctx.fillStyle = '#ff0000'; // 身体
            ctx.fillRect(16, 16, 32, 32); 
            ctx.fillStyle = '#ffff00'; // 武器
            ctx.fillRect(40, 10, 10, 40);
            ctx.fillStyle = '#000000'; // 墨镜
            ctx.fillRect(20, 24, 20, 4);

            const texture = new THREE.CanvasTexture(canvas);
            // 像素化滤镜，保证清晰马赛克风格
            texture.magFilter = THREE.NearestFilter; 
            texture.minFilter = THREE.NearestFilter;

            // 创建 Sprite (2D纸片人)
            const material = new THREE.SpriteMaterial({ map: texture, color: 0xffffff });
            this.sprite = new THREE.Sprite(material);
            this.sprite.position.set(0, 0, 0);
            this.sprite.scale.set(3, 3, 1); 

            this.scene.add(this.sprite);
            console.log('🔥 鬼畜战神(CrazyCrit) 像素体已生成');
            resolve();
        });
    }

    update(time, beat) {
        if (!this.sprite) return;

        if (this.isCrazy) {
            // --- 暴击模式 ---
            this.crazyTimer -= 0.016;
            if (this.crazyTimer <= 0) this.isCrazy = false;

            // 疯狂抖动
            const shake = 0.5 + beat * 0.5; 
            this.sprite.position.x = (Math.random() - 0.5) * shake;
            this.sprite.position.y = (Math.random() - 0.5) * shake;

            // 随机大小 + 颜色爆闪
            const s = 3 + Math.random() * 1.5;
            this.sprite.scale.set(s, s, 1);
            this.sprite.material.color.setHSL(Math.random(), 1.0, 0.5);

            // 蹦数字
            if (Date.now() - this.lastDamageTime > 200) {
                this.spawnDamage();
                this.lastDamageTime = Date.now();
            }
        } else {
            // --- 待机模式 ---
            this.sprite.position.lerp(new THREE.Vector3(0, 0, 0), 0.1);
            const idleScale = 3 + beat * 0.5;
            this.sprite.scale.lerp(new THREE.Vector3(idleScale, idleScale, 1), 0.1);
            this.sprite.material.color.setHex(0xffffff);
        }
    }

    setInteraction(gesture) {
        if (gesture.type === 'WAVE') {
            this.isCrazy = true;
            this.crazyTimer = 1.0; 
        }
    } 

    spawnDamage() {
        const val = Math.floor(Math.random() * 99999 + 999);
        const el = document.createElement('div');
        el.innerText = `暴击 -${val}`;
        Object.assign(el.style, {
            position: 'fixed',
            left: (50 + (Math.random() - 0.5) * 40) + '%',
            top: (50 + (Math.random() - 0.5) * 40) + '%',
            color: '#ffff00',
            textShadow: '3px 3px #ff0000',
            fontSize: '40px',
            fontWeight: '900',
            pointerEvents: 'none',
            zIndex: '9999',
            transition: 'all 0.8s ease-out',
            transform: 'translate(-50%, -50%) scale(0.5)'
        });
        document.body.appendChild(el);
        requestAnimationFrame(() => {
            el.style.transform = 'translate(-50%, -150%) scale(1.5)';
            el.style.opacity = '0';
        });
        setTimeout(() => el.remove(), 800);
    }
}