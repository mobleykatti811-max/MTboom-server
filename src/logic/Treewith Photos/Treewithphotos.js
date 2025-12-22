import * as THREE from 'three';

/**
 * TreeWithPhotos - 密度增强与随机分布修复版
 */
export class TreeWithPhotos {
    constructor(scene) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.scene.add(this.group);

        this.cards = []; 
        this.balls = null;
        this.particleData = []; 
        
        // 🟢 密度控制核心变量
        this.maxCount = 20000;     // 最大粒子基数（解决单薄问题）
        this.currentCount = 10000;  // 默认显示数量
        
        this.highlightedIndex = -1; 
        this.isInteracting = false; 
        this.lockStartTime = 0;
        this.minDisplayDuration = 1.5; 
        this.cooldownEndTime = 0;
        
        this.dissolveSystem = null;     
        this.dissolveTargetIndex = -1;  
        this.dissolveProgress = 0;      
        this.dissolveVelocities = []; 

        this.photoTextures = []; 
        this.textureLoader = new THREE.TextureLoader();
    }

    // 🟢 新增：供滑块调用的接口
    updateDensity(factor) {
        if (!this.balls) return;
        this.currentCount = Math.floor(this.maxCount * factor);
        // 核心：直接修改 InstancedMesh 的渲染计数
        this.balls.count = this.currentCount;
    }

    async init(photoUrls = null, blessing = null) {
        this.blessing = blessing; // 🟢 存一下即可
        if (photoUrls && photoUrls.length > 0) {
            for (const url of photoUrls) {
                try {
                    const tex = await this.textureLoader.loadAsync(url);
                    tex.colorSpace = THREE.SRGBColorSpace; 
                    this.photoTextures.push(tex);
                } catch (e) {
                    console.error("照片加载失败:", e);
                }
            }
        }

        this._createParticleTree();
        await this._createPhotoSpiral(); 
        this.group.position.y = -4.5; 
    }

    _createParticleTree() {
        // 使用最大基数创建
        const count = this.maxCount;
        const geo = new THREE.IcosahedronGeometry(0.1, 0); 
        const mat = new THREE.MeshStandardMaterial({
            color: 0xffffff, roughness: 0.3, metalness: 0.7, emissiveIntensity: 1.2 
        });

        this.balls = new THREE.InstancedMesh(geo, mat, count);
        this.balls.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.balls.frustumCulled = false; 

        const dummy = new THREE.Object3D();
        const treeHeight = 17; 
        const baseRadius = 8.5;  
        
        // 1. 🟢 预生成所有粒子的数据
        const rawParticles = [];
        for (let i = 0; i < count; i++) {
            const yRatio = Math.pow(Math.random(), 1.2); 
            const y = yRatio * treeHeight; 
            const maxRadiusAtY = baseRadius * (1 - yRatio);
            const r = maxRadiusAtY * Math.sqrt(Math.random()) * 0.95; 
            const angle = Math.random() * Math.PI * 2;
            
            const scaleBase = Math.random();
            const scale = Math.pow(scaleBase, 2.5) * 1.6 + 0.25;

            const seed = Math.random();
            let colorHex = 0x000000;
            let type = 0;
            if (seed > 0.94) { colorHex = 0xfffee0; type = 3; } 
            else if (seed > 0.82) { colorHex = 0xffaa00; type = 2; } 
            else if (seed > 0.70) { colorHex = 0xd41111; type = 1; } 
            else { type = 0; } // 绿色部分由下面的 HSL 逻辑处理

            rawParticles.push({
                pos: new THREE.Vector3(Math.cos(angle) * r, y, Math.sin(angle) * r),
                rot: new THREE.Vector3(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI),
                scale: scale,
                colorHex: colorHex,
                type: type,
                speedOffset: Math.random() * 0.5 + 0.5
            });
        }

        // 2. 🟢 关键：洗牌算法（Shuffle）打乱顺序
        // 这样当我们设置 balls.count 时，消失的是随机分布的粒子，而不是从树顶向下消失
        for (let i = rawParticles.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [rawParticles[i], rawParticles[j]] = [rawParticles[j], rawParticles[i]];
        }

        // 3. 应用数据到 InstancedMesh
        const color = new THREE.Color();
        this.particleData = [];

        rawParticles.forEach((data, i) => {
            dummy.position.copy(data.pos);
            dummy.rotation.set(data.rot.x, data.rot.y, data.rot.z);
            dummy.scale.setScalar(data.scale);
            dummy.updateMatrix();
            this.balls.setMatrixAt(i, dummy.matrix);

            if (data.type === 0) {
                const greenHue = 0.25 + Math.random() * 0.15; 
                const lightness = 0.05 + Math.random() * 0.2; 
                color.setHSL(greenHue, 0.6, lightness);
            } else {
                color.setHex(data.colorHex);
            }
            this.balls.setColorAt(i, color);

            const hsl = {}; color.getHSL(hsl);
            this.particleData.push({
                h: hsl.h, s: hsl.s, l: hsl.l, type: data.type, speedOffset: data.speedOffset
            });
        });

        // 4. 设置初始显示密度
        this.balls.count = this.currentCount;
        
        this.balls.instanceMatrix.needsUpdate = true;
        this.balls.instanceColor.needsUpdate = true;
        this.group.add(this.balls);
    }

// Treewithphotos.js -> update 方法

// Treewithphotos.js

update(time, beat, gesture) {
    // --- A. 旋转逻辑 ---
    if (this.highlightedIndex === -1 && this.dissolveTargetIndex === -1) {
        let rotationStep = 0.002; 
        if (gesture && gesture.speed) rotationStep += gesture.speed * 0.0005;
        this.group.rotation.y += rotationStep;
    }

    // --- B. 交互逻辑 (核心修改) ---
    const inCooldown = (time < this.cooldownEndTime);
    
    // 🟢 最小修改：判定握拳为“张开度小于 0.25”
    const isGrabbing = gesture && gesture.isGrabbing;

    if (isGrabbing && !inCooldown) {
        if (!this.isInteracting) {
            this.isInteracting = true; 
            if (this._toggleHighlight()) this.lockStartTime = time;
        }
    } else if (this.isInteracting) {
       // 只有展示时间满 1.5s 且手松开了（isGrabbing 变回 false）才消失
        if (time - this.lockStartTime > this.minDisplayDuration) {
            this.isInteracting = false;
            if (this.highlightedIndex !== -1) {
                this._triggerDissolve(this.highlightedIndex, time);
            }
        }
    }

    this._animateTree(time, beat, this.group.rotation.y);
    this._animateCards(time);
    this._updateDissolve(time);
}

    _animateTree(time, beat, currentRotation) {
        if (!this.balls) return;
        const s = 1.0 + beat * 0.02;
        this.balls.scale.setScalar(s);
        const hueShiftFactor = currentRotation * 0.1;
        const tempColor = new THREE.Color();
        // 🟢 注意：只循环当前显示的 count 即可
        for (let i = 0; i < this.balls.count; i++) {
            const data = this.particleData[i];
            let newH = data.h;
            if (data.type > 0) newH = (data.h + hueShiftFactor * data.speedOffset) % 1.0;
            tempColor.setHSL(newH, data.s, data.l);
            this.balls.setColorAt(i, tempColor);
        }
        this.balls.instanceColor.needsUpdate = true;
    }

    // ... 保持原有 _toggleHighlight, _triggerDissolve, _finishDissolve, _createDissolveParticles, _updateDissolve, _addStar, _createPhotoSpiral, _animateCards, _createPlaceholderTexture 逻辑完全不变 ...
    
    _toggleHighlight() {
        if (this.highlightedIndex !== -1) return false;
        let bestIdx = -1; let maxZ = -99999;
        const worldPos = new THREE.Vector3();
        this.cards.forEach((card, idx) => {
            if (idx === this.dissolveTargetIndex) return;
            card.mesh.getWorldPosition(worldPos);
            if (worldPos.z > maxZ) { maxZ = worldPos.z; bestIdx = idx; }
        });
        if (bestIdx !== -1) { this.highlightedIndex = bestIdx; return true; }
        return false;
    }

    _triggerDissolve(index, currentTime) {
        const card = this.cards[index];
        card.mesh.visible = false;
        this._createDissolveParticles(card.mesh.position.clone(), card.mesh.rotation.clone());
        this.dissolveTargetIndex = index;
        this.highlightedIndex = -1; 
        this.dissolveProgress = 0;
    }

    _createDissolveParticles(pos, rot) {
        const particleCount = 1800; 
        const geo = new THREE.BufferGeometry();
        const positions = [];
        this.dissolveVelocities = [];
        const vec = new THREE.Vector3();
        const euler = new THREE.Euler(rot.x, rot.y, rot.z);
        for(let i=0; i<particleCount; i++) {
            const localX = (Math.random() - 0.5) * 1.2;
            const localY = (Math.random() - 0.5) * 1.5;
            const localZ = (Math.random() - 0.5) * 0.2; 
            vec.set(localX, localY, localZ).applyEuler(euler);
            positions.push(vec.x, vec.y, vec.z);
            const explodeDir = new THREE.Vector3((Math.random()-0.5), (Math.random()-0.5), (Math.random()-0.5)).normalize();
            const speed = Math.random() * 1.2 + 0.3; 
            this.dissolveVelocities.push({ x: explodeDir.x*speed, y: explodeDir.y*speed, z: explodeDir.z*speed, offsetX: vec.x, offsetY: vec.y, offsetZ: vec.z });
        }
        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        const mat = new THREE.PointsMaterial({ color: 0xffd700, size: 0.07, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
        this.dissolveSystem = new THREE.Points(geo, mat);
        this.dissolveSystem.position.copy(pos);
        this.dissolveSystem.scale.set(3.5, 3.5, 3.5); 
        this.group.add(this.dissolveSystem);
    }

    _updateDissolve(time) {
            if (this.dissolveTargetIndex === -1 || !this.dissolveSystem) return;
            this.dissolveProgress += 0.006; 
            const card = this.cards[this.dissolveTargetIndex];
            const targetPos = card.basePos; 
            const startWorld = this.dissolveSystem.position; 
            const positions = this.dissolveSystem.geometry.attributes.position;
            const explodePhaseRatio = 0.25;
            
            let explosionStrength = 0; 
            let moveRatio = 0; 
            let scaleRatio = 3.5;      

            if (this.dissolveProgress < explodePhaseRatio) {
                const t = this.dissolveProgress / explodePhaseRatio;
                explosionStrength = Math.sin(t * Math.PI / 2) * 1.5; 
            } else {
                const t = (this.dissolveProgress - explodePhaseRatio) / (1 - explodePhaseRatio);
                const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
                explosionStrength = 1.5 * (1 - ease); 
                moveRatio = ease;
                scaleRatio = 3.5 * (1 - ease) + 1.0 * ease;
            }

            const currentCenter = new THREE.Vector3().lerpVectors(startWorld, targetPos, moveRatio);
            const localCenter = currentCenter.clone().sub(startWorld);

            for (let i = 0; i < positions.count; i++) {
                const vel = this.dissolveVelocities[i];

                // 🟢 核心修复：定义 Z 轴所需的变量
                const baseX = vel.offsetX * (scaleRatio / 3.5);
                const baseY = vel.offsetY * (scaleRatio / 3.5);
                const baseZ = vel.offsetZ * (scaleRatio / 3.5); 

                const burstX = vel.x * explosionStrength;
                const burstY = vel.y * explosionStrength;
                const burstZ = vel.z * explosionStrength; 

                // 🟢 核心修复：应用所有轴的位移
                positions.setXYZ(
                    i, 
                    localCenter.x + baseX + burstX, 
                    localCenter.y + baseY + burstY, 
                    localCenter.z + baseZ + burstZ 
                );
            }
            
            positions.needsUpdate = true;
            if (this.dissolveProgress >= 1.0) this._finishDissolve(time);
        }

    _finishDissolve(currentTime) {
        if (this.dissolveSystem) {
            this.group.remove(this.dissolveSystem);
            this.dissolveSystem.geometry.dispose();
            this.dissolveSystem.material.dispose();
            this.dissolveSystem = null;
        }
        const card = this.cards[this.dissolveTargetIndex];
        card.mesh.visible = true;
        card.mesh.position.copy(card.basePos);
        card.mesh.rotation.copy(card.baseQuat);
        card.mesh.scale.set(1, 1, 1);
        card.mesh.material.depthTest = true;
        card.mesh.renderOrder = 0;
        this.dissolveTargetIndex = -1;
        this.cooldownEndTime = currentTime + 0.8; 
    }

    _addStar(y) {
        const shape = new THREE.Shape();
        const outerRadius = 1.2; const innerRadius = 0.5;
        for (let i = 0; i < 10; i++) {
            const angle = (i / 10) * Math.PI * 2;
            const radius = (i % 2 === 0) ? outerRadius : innerRadius;
            if (i === 0) shape.moveTo(Math.cos(angle)*radius, Math.sin(angle)*radius);
            else shape.lineTo(Math.cos(angle)*radius, Math.sin(angle)*radius);
        }
        const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.3, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.1 });
        geo.center(); 
        const star = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0xffaa00, emissiveIntensity: 0.6 }));
        star.rotation.x = Math.PI / 2; star.position.set(0, y + 0.5, 0);
        this.group.add(star);
    }

    async _createPhotoSpiral() {
        const photoCount = 60; 
        const geometry = new THREE.BoxGeometry(1.2, 1.5, 0.05);
        const treeHeight = 17; const baseRadius = 9.0; 
        for (let i = 0; i < photoCount; i++) {
            let currentTexture = this.photoTextures.length > 0 ? this.photoTextures[i % this.photoTextures.length] : this._createPlaceholderTexture();
            const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ map: currentTexture }));
            const t = i / photoCount; 
            const y = t * (treeHeight - 1) + 0.5; 
            const radius = baseRadius * (1 - t) + 0.5; 
            const angle = i * 0.6; 
            mesh.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
            mesh.lookAt(0, y, 0); mesh.rotateY(Math.PI); 
            this.cards.push({ mesh: mesh, basePos: mesh.position.clone(), baseQuat: mesh.quaternion.clone() });
            this.group.add(mesh);
        }
        this._addStar(treeHeight);
    }

    _animateCards(time) {
        const groupRot = this.group.rotation.y;
        this.cards.forEach((card, idx) => {
            if (idx === this.dissolveTargetIndex) return;
            const mesh = card.mesh;
            if (idx === this.highlightedIndex) {
                const targetDist = 8; 
                mesh.position.lerp(new THREE.Vector3(Math.sin(-groupRot)*targetDist, 6.0, Math.cos(-groupRot)*targetDist), 0.15);
                mesh.rotation.set(0, -groupRot, 0); 
                mesh.scale.lerp(new THREE.Vector3(3.5, 3.5, 3.5), 0.15);
                mesh.material.depthTest = false; 
                mesh.renderOrder = 999; 
            } else {
                mesh.position.lerp(card.basePos.clone().add(new THREE.Vector3(0, Math.sin(time*1.5+idx)*0.1, 0)), 0.1);
                mesh.quaternion.slerp(card.baseQuat, 0.1);
                mesh.scale.lerp(new THREE.Vector3(1, 1, 1), 0.1);
                mesh.material.depthTest = true;
                mesh.renderOrder = 0;
            }
        });
    }

    _createPlaceholderTexture() {
        const cvs = document.createElement('canvas');
        cvs.width = 256; cvs.height = 320;
        const ctx = cvs.getContext('2d');
        ctx.fillStyle = '#fdfdfd'; ctx.fillRect(0,0,256,320); 
        const tex = new THREE.CanvasTexture(cvs);
        tex.colorSpace = THREE.SRGBColorSpace;
        return tex;
    }
}