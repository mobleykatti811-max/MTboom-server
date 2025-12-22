import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class Muyu3D {
    constructor(scene, onHit) {
        this.scene = scene;
        this.onHit = onHit; 
        this.group = new THREE.Group();
        this.muyuMesh = null; 
        
        // 棒槌相关
        this.hammerPivot = null;
        this.baseAngle = -0.2; // 初始角度（稍微抬起）
        this.hitAngle = 0.6;   // 敲击到底的角度
        this.hammerAngle = this.baseAngle; 
        this.targetHammerAngle = this.baseAngle;
        
        // 木鱼弹性动画变量
        this.scaleSpring = { val: 1.0, vel: 0 }; 
        
        // 状态锁
        this.isHit = false;
        this.lastHitTime = 0;

        // 浮动文字数组，用于在 update 中统一管理动画
        this.floatingTexts = [];
    }

    init() {
        this._loadWoodenFishModel();
        this._createRealisticHammer();
        
        // 整体位置调整
        this.group.scale.set(0.7, 0.7, 0.7);
        this.group.position.set(0, -0.5, 0);
        this.group.rotation.x = 0.1; 
        this.group.rotation.y = -0.4; // 稍微侧一点，让棒槌不挡住木鱼
        this.scene.add(this.group);
    }

    _loadWoodenFishModel() {
        const loader = new GLTFLoader();
        // 确保路径正确
        loader.load('/assets/3D/WoodenFish3D.glb', (gltf) => {
            this.muyuMesh = gltf.scene;
            this.muyuMesh.traverse(child => { 
                if (child.isMesh) {
                    child.material.transparent = false;
                    child.castShadow = true;
                    child.receiveShadow = true;
                } 
            });
            // 初始缩放
            this.muyuMesh.scale.set(10, 10, 10); 
            this.group.add(this.muyuMesh);
        });
    }

    _createRealisticHammer() {
        this.hammerPivot = new THREE.Group();
        // 调整轴心位置：放在木鱼左上方
        this.hammerPivot.position.set(-3.5, 3.5, 0); 
        this.group.add(this.hammerPivot);
        
        // 棒身
        const handleGeo = new THREE.CylinderGeometry(0.15, 0.2, 4.5, 32); // 增加面数更圆滑
        const handleMat = new THREE.MeshStandardMaterial({ color: 0xdcb35c, roughness: 0.3 });
        const handle = new THREE.Mesh(handleGeo, handleMat);
        // 修改：棒身向下延伸
        handle.position.y = -1.5; 
        
        // 棒头
        const headGeo = new THREE.SphereGeometry(0.8, 32, 32); //稍微变大一点
        const headMat = new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 0.2, metalness: 0.1 });
        const head = new THREE.Mesh(headGeo, headMat);
        // 修改：棒头在棒身的最底端
        head.position.set(0, -3.8, 0); 

        // 组合
        const hammer = new THREE.Group();
        hammer.add(handle); 
        hammer.add(head);
        
        // 关键修改：整体旋转 180度 或 调整内部坐标，这里我们直接重置位置
        // 让棒槌自然下垂，准备敲击
        this.hammerPivot.add(hammer);
        
        // 设置初始角度，稍微抬起
        this.hammerPivot.rotation.z = -0.5; 
        this.baseAngle = -0.5; // 更新基础角度
        this.hitAngle = 0.5;   // 更新敲击目标角度
    }

    // 🟢 核心修复：判定逻辑优化
    setInteraction(data) {
        if (!this.group || !data.isPresent) return;

        // --- 🟢 修复：恢复木鱼跟随手势旋转 ---
        // 根据水平速度(vx)旋转木鱼 (Y轴)
        if (Math.abs(data.vx) > 0.5) {
            // 0.03 是灵敏度，可微调
            this.group.rotation.y += data.vx * 0.03; 
        }
        // 根据垂直速度(vy)轻微倾斜木鱼 (X轴)，增加立体感
        if (Math.abs(data.vy) > 0.5) {
             // 限制倾斜角度，防止翻面
            const targetX = 0.1 + data.vy * 0.02;
            this.group.rotation.x += (targetX - this.group.rotation.x) * 0.1;
        }

        // --- 棒槌与敲击逻辑 (保持之前的优化) ---
        if (!this.isHit) {
            const sway = Math.max(-0.3, Math.min(0.3, data.vx * 0.05));
            this.targetHammerAngle = this.baseAngle + sway;
        }

        const now = Date.now();
        if (now - this.lastHitTime < 200) return;

        const isDownwardStrike = data.vy < -1.5; 
        const isNotHorizontalSwipe = Math.abs(data.vx) < 6.0;

        if (isDownwardStrike && isNotHorizontalSwipe) {
            this.triggerBonk();
            this.lastHitTime = now;
        }
    }

    triggerBonk() {
        this.isHit = true;
        
        // 1. 棒槌敲击动画
        this.hammerAngle = this.hitAngle; // 瞬间设为敲击位置 (瞬移产生打击感)
        this.targetHammerAngle = this.baseAngle; // 目标设为回弹
        
        // 2. 木鱼弹性动画 (负值代表被压扁)
        this.scaleSpring.vel = -15.0; 

        // 3. 触发文字和回调
        this._emitFloatingText();
        if (this.onHit) this.onHit();

        // 4. 重置状态
        setTimeout(() => {
            this.isHit = false;
        }, 150);
    }

    _emitFloatingText() {
        const canvas = document.createElement('canvas');
        canvas.width = 512; 
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        
        // 绘制发光文字
        ctx.shadowColor = "rgba(23, 53, 201, 1)";
        ctx.shadowBlur = 15;
        ctx.fillStyle = '#3ab7f1ff'; 
        ctx.font = 'bold 100px "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('功德 +1', 256, 150);
        
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ 
            map: texture, 
            transparent: true,
            opacity: 1.0,
            depthTest: false, // 🟢 关键：确保文字永远显示在模型前面，不会穿模
            depthWrite: false
        });
        
        const sprite = new THREE.Sprite(material);
        // 随机一点点水平偏移，让文字不重叠
        const randX = (Math.random() - 0.5) * 2.0;
        sprite.position.set(randX, 3.5, 0); 
        sprite.scale.set(4, 2, 1);
        
        this.group.add(sprite);
        
        // 加入管理数组
        this.floatingTexts.push({
            mesh: sprite,
            age: 0,
            velocity: 0.08 // 上升速度
        });
    }

    update(time, beatValue = 0) {
        const dt = 0.016;

        // --- 1. 棒槌动画 (插值) ---
        // 增加回弹速度 (25.0) 让棒槌迅速归位
        const diff = this.targetHammerAngle - this.hammerAngle;
        this.hammerAngle += diff * 25.0 * dt;
        if (this.hammerPivot) {
            this.hammerPivot.rotation.z = this.hammerAngle;
        }

        // --- 2. 木鱼弹性物理 (Spring Physics) ---
        // 模拟果冻效果：F = -kx - cv
        const stiffness = 120.0; // 劲度系数
        const damping = 8.0;     // 阻尼
        const displacement = this.scaleSpring.val - 1.0; // 偏离平衡位置的量
        
        const force = -stiffness * displacement - damping * this.scaleSpring.vel;
        this.scaleSpring.vel += force * dt;
        this.scaleSpring.val += this.scaleSpring.vel * dt;

        if (this.muyuMesh) {
            const s = this.scaleSpring.val;
            // Y轴缩放 s，XZ轴反向缩放保持体积感，产生挤压变形效果
            const buldge = 1.0 + (1.0 - s) * 0.5;
            this.muyuMesh.scale.set(10 * buldge, 10 * s, 10 * buldge);
        }

        // --- 3. 浮动文字动画更新 ---
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const item = this.floatingTexts[i];
            item.age += dt;
            item.mesh.position.y += item.velocity;
            item.mesh.material.opacity = 1.0 - (item.age / 1.0); // 1秒内淡出

            if (item.age >= 1.0) {
                this.group.remove(item.mesh);
                item.mesh.material.map.dispose();
                item.mesh.material.dispose();
                this.floatingTexts.splice(i, 1);
            }
        }
    }
}