import * as THREE from 'three';

/**
 * MuyuBun - 仿真布丁小木鱼 (Pro Max版)
 * 1. 旋转灵敏度提升 8 倍。
 * 2. 修复敲击动画，确保木槌能“砸”到木鱼表面。
 * 3. 支持“双手合十”自动连击接口。
 */
export class Muyu3D {
    constructor(scene) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.muyuMesh = null;
        this.hammerMesh = null;
        this.hammerPivot = null;

        // 动画物理状态
        this.hammerAngle = -0.4; 
        this.targetHammerAngle = -0.4;
        this.scaleSpring = { val: 1.0, vel: 0 }; 
        this.isHit = false;

        this.stars = [];
    }

    init() {
        console.log("🍮 MuyuBun: 正在制作特大号布丁木鱼...");

        this._createRealisticMuyu();
        this._createRealisticHammer();
        this._createStarParticles(); 

        // 保持之前的大尺寸
        this.group.scale.set(0.7, 0.7, 0.7);
        this.group.position.set(0, -0.5, 0);
        
        this.group.rotation.x = 0.2; 
        this.group.rotation.y = -0.5;
        this.scene.add(this.group);
    }

    update(time, beatValue = 0) {
        const dt = 0.016;

        // --- 0. 外部强制敲击 (用于双手合十) ---
        if (beatValue > 0.5 && !this.isHit) {
            // 强制触发一次敲击动画
            this.targetHammerAngle = 0.5; 
            this.triggerBonk();
            this.isHit = true;
            // 迅速回弹
            setTimeout(() => { this.targetHammerAngle = -0.4; this.isHit = false; }, 100);
        }

        // --- 1. 木槌动画跟随 ---
        const diff = this.targetHammerAngle - this.hammerAngle;
        // 加快插值速度 (10.0 -> 20.0)，让敲击更干脆
        this.hammerAngle += diff * 20.0 * dt;
        
        // [关键修改] 放宽角度限制，允许木槌砸得更深
        // 0.1 -> 0.6 (允许砸进木头里)
        if(this.hammerAngle > 0.6) this.hammerAngle = 0.6; 
        if(this.hammerAngle < -1.5) this.hammerAngle = -1.5; // 允许抬得更高

        if (this.hammerPivot) {
            this.hammerPivot.rotation.z = this.hammerAngle;
        }

        // --- 2. Q弹物理 (本体变形) ---
        const springForce = (1.0 - this.scaleSpring.val) * 20.0; // 增加回弹力度
        const damping = this.scaleSpring.vel * 0.6; // 减少阻尼，让它多晃两下
        this.scaleSpring.vel += (springForce - damping) * dt;
        this.scaleSpring.val += this.scaleSpring.vel * dt;

        if (this.muyuMesh) {
            const squash = this.scaleSpring.val;
            // 压扁时横向变宽，纵向变短
            const stretch = 1.0 + (1.0 - squash) * 0.6;
            this.muyuMesh.scale.set(stretch, 0.8 * squash, stretch);
        }

        // --- 3. 星星粒子更新 ---
        this.stars.forEach(star => {
            if (!star.visible) return;
            star.position.add(star.velocity);
            star.velocity.y -= 0.015; // 加重力
            star.scale.multiplyScalar(0.92);
            if (star.scale.x < 0.1) star.visible = false;
        });
    }

    /**
     * 核心交互逻辑
     */
    setInteraction(data) {
        if (!this.group) return;

        // [修改 1] 旋转灵敏度提升
        // 0.005 -> 0.04 (提升8倍)
        if (Math.abs(data.vx) > 0.5) {
            this.group.rotation.y += data.vx * 0.04; 
        }

        // [修改 2] 敲击判定
        // vy < -3.0 (向下挥手)
        if (data.vy < -3.0) {
            // [关键] 目标角度设为 0.5，让它真的“砸”下去
            this.targetHammerAngle = 0.5;
            
            if (!this.isHit) {
                this.triggerBonk();
                this.isHit = true; 
            }
        } 
        else if (data.vy > 2.0) {
            // 向上挥手 -> 抬起
            this.targetHammerAngle = -1.2; 
            this.isHit = false; // 重置状态，准备下一次敲击
        } else {
            // 手停住时 -> 回到待机
            // 如果没在敲击状态，就复位
            if (Math.abs(this.hammerAngle - 0.5) > 0.1) {
                this.targetHammerAngle = -0.4;
            }
        }
    }

    triggerBonk() {
        // 施加巨大的向下的力，产生明显压扁
        this.scaleSpring.vel = -8.0; 
        this._emitStars();
    }

    // ==========================================
    // 渲染构建 (保持不变)
    // ==========================================
    _createRealisticMuyu() {
        const geo = new THREE.SphereGeometry(1.5, 64, 64); 
        const gradientTexture = this._generateGradientTexture();
        const mat = new THREE.MeshPhysicalMaterial({
            map: gradientTexture, color: 0xffffff, roughness: 0.15,            
            metalness: 0.0, clearcoat: 1.0, clearcoatRoughness: 0.1,    
            reflectivity: 1.0, ior: 1.5,                   
        });
        this.muyuMesh = new THREE.Mesh(geo, mat);
        this.muyuMesh.scale.y = 0.85; 
        this.group.add(this.muyuMesh);

        const mouthGeo = new THREE.CapsuleGeometry(0.15, 1.4, 16, 16);
        const mouthMat = new THREE.MeshBasicMaterial({ color: 0xcc5500 }); 
        const mouth = new THREE.Mesh(mouthGeo, mouthMat);
        mouth.rotation.z = Math.PI / 2;
        mouth.position.set(0, -0.3, 1.35); 
        mouth.scale.set(1, 1, 0.8);
        this.muyuMesh.add(mouth);
    }

    _createRealisticHammer() {
        this.hammerPivot = new THREE.Group();
        // 调整 Pivot 位置，让它更容易砸中中心
        this.hammerPivot.position.set(2.6, 0.8, 0); 
        this.group.add(this.hammerPivot);

        const handleGeo = new THREE.CylinderGeometry(0.12, 0.12, 2.2, 32);
        const handleMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.3, clearcoat: 0.5 });
        const handle = new THREE.Mesh(handleGeo, handleMat);
        handle.position.y = 1.0;
        handle.rotation.z = -0.2; 

        const headGeo = new THREE.SphereGeometry(0.5, 32, 32);
        const headMat = new THREE.MeshPhysicalMaterial({ color: 0xffaa44, roughness: 0.2, clearcoat: 0.8 });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.set(-0.3, 2.0, 0); 
        head.scale.y = 0.8; 

        const hammer = new THREE.Group();
        hammer.add(handle);
        hammer.add(head);
        // 调整初始偏移
        hammer.position.set(0, -1.5, 0);

        this.hammerPivot.add(hammer);
        this.hammerMesh = hammer;
    }

    _generateGradientTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 1; canvas.height = 128; 
        const ctx = canvas.getContext('2d');
        const grd = ctx.createLinearGradient(0, 0, 0, 128);
        grd.addColorStop(0.0, '#ffcc00'); 
        grd.addColorStop(0.4, '#ff9966'); 
        grd.addColorStop(1.0, '#fff5e6'); 
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, 1, 128);
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace; 
        texture.needsUpdate = true;
        return texture;
    }

    _createStarParticles() {
        const starGeo = new THREE.IcosahedronGeometry(0.2, 0); // 星星稍微大一点
        const starMat = new THREE.MeshBasicMaterial({ color: 0xffffaa });
        for (let i = 0; i < 15; i++) {
            const star = new THREE.Mesh(starGeo, starMat);
            star.visible = false;
            this.scene.add(star);
            this.stars.push(star);
        }
    }

    _emitStars() {
        let count = 0;
        this.stars.forEach(star => {
            if (star.visible || count >= 5) return;
            star.visible = true;
            const worldPos = new THREE.Vector3();
            this.muyuMesh.getWorldPosition(worldPos);
            // 从木鱼顶部喷发
            star.position.copy(worldPos);
            star.position.y += 0.8; 
            star.scale.set(1,1,1);
            // 爆发范围更大
            star.velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 0.8,
                Math.random() * 0.5 + 0.4,
                (Math.random() - 0.5) * 0.8
            );
            count++;
        });
    }
}