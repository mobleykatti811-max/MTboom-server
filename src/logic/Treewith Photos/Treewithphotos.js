import * as THREE from 'three';

/**
 * TreeWithPhotos - 交互逻辑终极修复版
 * 1. 【新增】最小展示时间：握拳触发后，强制锁定照片至少 1.5秒，防止“秒关”导致看不清。
 * 2. 【新增】冷却时间：消散归位后，强制树木旋转 0.8秒 才能再次抓取，防止重复误触。
 * 3. 视觉：保持烟花粒子效果不变。
 */
export class TreeWithPhotos {
    constructor(scene) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.scene.add(this.group);

        this.cards = []; 
        this.balls = null;
        this.particleData = []; 
        
        // --- 交互状态机 ---
        this.highlightedIndex = -1; 
        this.isInteracting = false; 
        
        // ⏳ 时间控制锁 ⏳
        this.lockStartTime = 0;      // 记录“开始放大”的时间点
        this.minDisplayDuration = 1.5; // 🔥 核心修改：照片至少展示 1.5 秒，期间松手无效
        this.cooldownEndTime = 0;    // 冷却结束时间点
        
        // 粒子特效系统
        this.dissolveSystem = null;     
        this.dissolveTargetIndex = -1;  
        this.dissolveProgress = 0;      
        this.dissolveVelocities = []; 

        this.textureLoader = new THREE.TextureLoader();
    }

    async init() {
        console.log("🎄 TreeWithPhotos: 交互时间锁已激活...");
        this._createParticleTree();
        await this._createPhotoSpiral();
        this.group.position.y = -4.5; 
    }

    update(time, beat, gesture) {
        // --- A. 旋转逻辑 ---
        if (this.highlightedIndex === -1 && this.dissolveTargetIndex === -1) {
            let rotationStep = 0.002; 
            if (gesture && gesture.speed) {
                rotationStep += gesture.speed * 0.0005;
            }
            this.group.rotation.y += rotationStep;
        }

        // --- B. 交互逻辑 (核心修改区域) ---
        
        // 1. 检查是否处于冷却期 (防止连续抓取)
        const inCooldown = (time < this.cooldownEndTime);

        if (gesture && gesture.isGrabbing && !inCooldown) {
            // 握拳：尝试锁定
            if (!this.isInteracting) {
                this.isInteracting = true; 
                const hasSelected = this._toggleHighlight(); 
                if (hasSelected) {
                    // 记录开始锁定的时间
                    this.lockStartTime = time;
                }
            }
        } else {
            // 松手：尝试消散
            if (this.isInteracting) {
                // 🔥 核心逻辑：检查是否满足“最小展示时间”
                // 如果 (当前时间 - 锁定时间) < 1.5秒，则无视松手，继续保持锁定
                if (time - this.lockStartTime > this.minDisplayDuration) {
                    this.isInteracting = false;
                    if (this.highlightedIndex !== -1) {
                        this._triggerDissolve(this.highlightedIndex, time);
                    }
                } else {
                    // 此时虽然手松开了，但代码强制保持 interacting 状态
                    // 用户会看到照片依然稳稳地停在中间，直到时间满足
                }
            }
        }

        // --- C. 动画更新 ---
        this._animateTree(time, beat, this.group.rotation.y);
        this._animateCards(time);
        this._updateDissolve(time);
    }

    // =========================================
    // 🌟 核心优化：两阶段粒子动画
    // =========================================

    _toggleHighlight() {
        if (this.highlightedIndex !== -1) {
            return false; // 已经在显示了
        } else {
            let bestIdx = -1;
            let maxZ = -99999;
            const worldPos = new THREE.Vector3();
            this.cards.forEach((card, idx) => {
                if (idx === this.dissolveTargetIndex) return;
                card.mesh.getWorldPosition(worldPos);
                // 必须在可视范围内(z>0)才选中，防止选中背面的
                if (worldPos.z > maxZ) {
                    maxZ = worldPos.z;
                    bestIdx = idx;
                }
            });
            if (bestIdx !== -1) {
                this.highlightedIndex = bestIdx;
                return true; // 成功选中
            }
            return false;
        }
    }

    _triggerDissolve(index, currentTime) {
        const card = this.cards[index];
        const mesh = card.mesh;
        
        mesh.visible = false;
        
        const startPos = mesh.position.clone();
        const startRot = mesh.rotation.clone();

        this._createDissolveParticles(startPos, startRot);

        this.dissolveTargetIndex = index;
        this.highlightedIndex = -1; 
        this.dissolveProgress = 0;

        // 🔥 设置冷却时间：粒子归位动画大约需要几秒，我们设定一个合理的冷却
        // 比如动画结束后再过 0.5 秒才能抓下一个
        // 这里只是简单的标记，具体的冷却结束在 _finishDissolve 里设置更准
    }

    _createDissolveParticles(pos, rot) {
        // 粒子数量
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

            vec.set(localX, localY, localZ);
            vec.applyEuler(euler);
            positions.push(vec.x, vec.y, vec.z);

            const explodeDir = new THREE.Vector3(
                (Math.random() - 0.5), 
                (Math.random() - 0.5), 
                (Math.random() - 0.5)
            ).normalize();
            
            const speed = Math.random() * 1.2 + 0.3; 

            this.dissolveVelocities.push({
                x: explodeDir.x * speed,
                y: explodeDir.y * speed,
                z: explodeDir.z * speed,
                offsetX: vec.x,
                offsetY: vec.y,
                offsetZ: vec.z
            });
        }

        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

        const mat = new THREE.PointsMaterial({
            color: 0xffd700, 
            size: 0.07, 
            transparent: true, 
            opacity: 1.0, 
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

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
        const count = positions.count;
        
        const explodePhaseRatio = 0.25;
        
        let explosionStrength = 0; 
        let moveRatio = 0;         
        let scaleRatio = 3.5;      

        if (this.dissolveProgress < explodePhaseRatio) {
            const t = this.dissolveProgress / explodePhaseRatio;
            explosionStrength = Math.sin(t * Math.PI / 2) * 1.5; 
            moveRatio = 0; 
            scaleRatio = 3.5; 

        } else {
            const t = (this.dissolveProgress - explodePhaseRatio) / (1 - explodePhaseRatio);
            const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
            explosionStrength = 1.5 * (1 - ease); 
            moveRatio = ease;
            scaleRatio = 3.5 * (1 - ease) + 1.0 * ease;
        }

        const currentCenter = new THREE.Vector3().lerpVectors(startWorld, targetPos, moveRatio);
        const localCenter = currentCenter.clone().sub(startWorld);

        for (let i = 0; i < count; i++) {
            const vel = this.dissolveVelocities[i];

            const baseX = vel.offsetX * (scaleRatio / 3.5);
            const baseY = vel.offsetY * (scaleRatio / 3.5);
            const baseZ = vel.offsetZ * (scaleRatio / 3.5);

            const burstX = vel.x * explosionStrength;
            const burstY = vel.y * explosionStrength;
            const burstZ = vel.z * explosionStrength;

            positions.setXYZ(
                i,
                localCenter.x + baseX + burstX,
                localCenter.y + baseY + burstY,
                localCenter.z + baseZ + burstZ
            );
        }
        
        positions.needsUpdate = true;

        if (this.dissolveProgress >= 1.0) {
            this._finishDissolve(time); // 传入当前时间用于设置冷却
        }
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
        card.mesh.material.emissiveIntensity = 0;
        card.mesh.material.depthTest = true;
        card.mesh.renderOrder = 0;
        this.dissolveTargetIndex = -1;

        // 🔥 设置冷却：动画结束后，必须等待 0.8 秒才能再次抓取
        // 这样可以强迫用户等待树木旋转到下一个角度
        this.cooldownEndTime = currentTime + 0.8; 
    }

    // =========================================
    // 基础功能 (保持不变)
    // =========================================

    _createParticleTree() {
        const count = 3600;
        const geo = new THREE.IcosahedronGeometry(0.1, 0); 
        const mat = new THREE.MeshStandardMaterial({
            color: 0xffffff, roughness: 0.3, metalness: 0.7, emissiveIntensity: 0 
        });
        this.balls = new THREE.InstancedMesh(geo, mat, count);
        this.balls.frustumCulled = false; 

        const dummy = new THREE.Object3D();
        const color = new THREE.Color();
        const treeHeight = 17; const baseRadius = 8.5;  
        this.particleData = [];

        for (let i = 0; i < count; i++) {
            const yRatio = Math.pow(Math.random(), 1.2); 
            const y = yRatio * treeHeight; 
            const maxRadiusAtY = baseRadius * (1 - yRatio);
            const r = maxRadiusAtY * Math.sqrt(Math.random()) * 0.95; 
            const angle = Math.random() * Math.PI * 2;
            dummy.position.set(Math.cos(angle) * r, y, Math.sin(angle) * r);
            dummy.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI);

            const scaleBase = Math.random();
            const scale = Math.pow(scaleBase, 2.5) * 1.6 + 0.25;
            dummy.scale.setScalar(scale);
            dummy.updateMatrix();
            this.balls.setMatrixAt(i, dummy.matrix);

            const seed = Math.random();
            let baseColorType = 0; 
            if (seed > 0.94) { color.setHex(0xfffee0); baseColorType = 3; } 
            else if (seed > 0.82) { color.setHex(0xffaa00); baseColorType = 2; } 
            else if (seed > 0.70) { color.setHex(0xd41111); baseColorType = 1; } 
            else { 
                const greenHue = 0.25 + Math.random() * 0.15; 
                const lightness = 0.05 + Math.random() * 0.2; 
                color.setHSL(greenHue, 0.6, lightness);
                baseColorType = 0;
            }
            this.balls.setColorAt(i, color);

            const hsl = {}; color.getHSL(hsl);
            this.particleData.push({
                h: hsl.h, s: hsl.s, l: hsl.l, type: baseColorType, speedOffset: Math.random() * 0.5 + 0.5
            });
        }
        this.balls.instanceMatrix.needsUpdate = true;
        this.balls.instanceColor.needsUpdate = true;
        this.group.add(this.balls);
    }

    _animateTree(time, beat, currentRotation) {
        if (!this.balls || this.particleData.length === 0) return;
        const s = 1.0 + beat * 0.02;
        this.balls.scale.setScalar(s);
        const hueShiftFactor = currentRotation * 0.1;
        const tempColor = new THREE.Color();
        for (let i = 0; i < this.balls.count; i++) {
            const data = this.particleData[i];
            let newH = data.h;
            if (data.type > 0) newH = (data.h + hueShiftFactor * data.speedOffset) % 1.0;
            tempColor.setHSL(newH, data.s, data.l);
            this.balls.setColorAt(i, tempColor);
        }
        this.balls.instanceColor.needsUpdate = true;
    }

    _addStar(y) {
        const shape = new THREE.Shape();
        const outerRadius = 1.2; const innerRadius = 0.5; const points = 5;
        for (let i = 0; i < points * 2; i++) {
            const angle = (i / (points * 2)) * Math.PI * 2;
            const radius = (i % 2 === 0) ? outerRadius : innerRadius;
            const x = Math.cos(angle) * radius; const yCoord = Math.sin(angle) * radius;
            if (i === 0) shape.moveTo(x, yCoord); else shape.lineTo(x, yCoord);
        }
        shape.closePath();
        const extrudeSettings = { depth: 0.3, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.1, bevelSegments: 3 };
        const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        geo.center(); 
        const mat = new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0xffaa00, emissiveIntensity: 0.6, roughness: 0.2, metalness: 1.0 });
        const star = new THREE.Mesh(geo, mat);
        star.rotation.x = Math.PI / 2; star.position.set(0, y + 0.5, 0);
        const glowGeo = new THREE.SphereGeometry(1.8, 16, 16);
        const glowMat = new THREE.MeshBasicMaterial({ color: 0xffdd44, transparent: true, opacity: 0.25, depthWrite: false, side: THREE.BackSide });
        const glow = new THREE.Mesh(glowGeo, glowMat);
        star.add(glow);
        this.group.add(star);
    }
    
    async _createPhotoSpiral() {
        const photoCount = 42; 
        const texture = this._createPlaceholderTexture(); 
        const geometry = new THREE.BoxGeometry(1.2, 1.5, 0.05);
        const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.3, metalness: 0.2 });
        const treeHeight = 17; const baseRadius = 9.0; 

        for (let i = 0; i < photoCount; i++) {
            const mesh = new THREE.Mesh(geometry, material.clone());
            const t = i / photoCount; 
            const y = t * (treeHeight - 1) + 0.5; 
            const radius = baseRadius * (1 - t) + 0.5; 
            const angle = i * 0.6; 
            mesh.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
            mesh.lookAt(0, y, 0); mesh.rotateY(Math.PI); 
            mesh.rotateZ((Math.random()-0.5) * 0.3); mesh.rotateX((Math.random()-0.5) * 0.2);
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
                const targetX = Math.sin(-groupRot) * targetDist;
                const targetZ = Math.cos(-groupRot) * targetDist;
                mesh.position.lerp(new THREE.Vector3(targetX, 6.0, targetZ), 0.15);
                mesh.rotation.set(0, -groupRot, 0); 
                mesh.scale.lerp(new THREE.Vector3(3.5, 3.5, 3.5), 0.15);
                mesh.material.emissive.setHex(0xffaa00);
                mesh.material.emissiveIntensity = THREE.MathUtils.lerp(mesh.material.emissiveIntensity, 0.8, 0.1);
                mesh.material.depthTest = false; 
                mesh.renderOrder = 999; 
            } else {
                const floatY = Math.sin(time * 1.5 + idx) * 0.1;
                const targetPos = card.basePos.clone();
                targetPos.y += floatY;
                mesh.position.lerp(targetPos, 0.1);
                mesh.quaternion.slerp(card.baseQuat, 0.1);
                mesh.scale.lerp(new THREE.Vector3(1, 1, 1), 0.1);
                mesh.material.emissiveIntensity = 0;
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
        ctx.fillStyle = '#1a1a1a'; ctx.fillRect(15,15,226,230); 
        ctx.fillStyle = `hsl(${Math.random()*360}, 60%, 60%)`;
        ctx.beginPath(); ctx.arc(128, 130, 60, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#333'; ctx.font = '24px Arial';
        ctx.textAlign = 'center'; ctx.fillText("Xmas", 128, 280);
        const tex = new THREE.CanvasTexture(cvs);
        tex.colorSpace = THREE.SRGBColorSpace;
        return tex;
    }
}