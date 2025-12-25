import * as THREE from 'three';

/**
 * TreeWithPhotos - 修复照片灰暗问题版
 */
export class TreeWithPhotos {
    constructor(scene) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.scene.add(this.group);

        this.cards = []; 
        this.balls = null;
        this.particleData = []; 
        
        // 密度控制变量
        this.maxCount = 20000;     
        this.currentCount = 10000;  
        
        this.highlightedIndex = -1; 
        this.isInteracting = false; 
        this.lockStartTime = 0;
        this.minDisplayDuration = 1.5; 
        this.cooldownEndTime = 0;
        
        // 活动队列，支持多个爆开效果并行
        this.activeDissolves = []; 

        // 为了兼容性保留旧变量名
        this.dissolveTargetIndex = -1; 

        this.photoTextures = []; 
        this.textureLoader = new THREE.TextureLoader();
    }

    // 供滑块调用的接口
    updateDensity(factor) {
        if (!this.balls) return;
        this.currentCount = Math.floor(this.maxCount * factor);
        this.balls.count = this.currentCount;
    }

    async init(photoUrls = null, blessing = null) {
        this.blessing = blessing; 
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
        
        const rawParticles = [];
        for (let i = 0; i < count; i++) {
            const yRatio = Math.pow(Math.random(), 1.2); 
            const y = yRatio * treeHeight; 
            const maxRadiusAtY = baseRadius * (1 - yRatio);
            const r = maxRadiusAtY * Math.sqrt(Math.random()) * 0.95; 
            const angle = Math.random() * Math.PI * 2;
            const scale = Math.pow(Math.random(), 2.5) * 1.6 + 0.25;

            const seed = Math.random();
            let colorHex = 0x000000;
            let type = 0;
            if (seed > 0.94) { colorHex = 0xfffee0; type = 3; } 
            else if (seed > 0.82) { colorHex = 0xffaa00; type = 2; } 
            else if (seed > 0.70) { colorHex = 0xd41111; type = 1; } 

            rawParticles.push({
                pos: new THREE.Vector3(Math.cos(angle) * r, y, Math.sin(angle) * r),
                rot: new THREE.Vector3(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI),
                scale: scale, colorHex: colorHex, type: type, speedOffset: Math.random() * 0.5 + 0.5
            });
        }

        for (let i = rawParticles.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [rawParticles[i], rawParticles[j]] = [rawParticles[j], rawParticles[i]];
        }

        const color = new THREE.Color();
        this.particleData = [];
        rawParticles.forEach((data, i) => {
            dummy.position.copy(data.pos);
            dummy.rotation.set(data.rot.x, data.rot.y, data.rot.z);
            dummy.scale.setScalar(data.scale);
            dummy.updateMatrix();
            this.balls.setMatrixAt(i, dummy.matrix);

            if (data.type === 0) {
                color.setHSL(0.25 + Math.random() * 0.15, 0.6, 0.05 + Math.random() * 0.2);
            } else {
                color.setHex(data.colorHex);
            }
            this.balls.setColorAt(i, color);
            const hsl = {}; color.getHSL(hsl);
            this.particleData.push({ h: hsl.h, s: hsl.s, l: hsl.l, type: data.type, speedOffset: data.speedOffset });
        });

        this.balls.count = this.currentCount;
        this.balls.instanceMatrix.needsUpdate = true;
        this.balls.instanceColor.needsUpdate = true;
        this.group.add(this.balls);
    }

    update(time, beat, gesture) {
        // A. 旋转逻辑
        if (this.highlightedIndex === -1 && this.activeDissolves.length === 0) {
            let rotationStep = 0.002; 
            if (gesture && gesture.speed) rotationStep += gesture.speed * 0.0005;
            this.group.rotation.y += rotationStep;
        }

        // B. 交互逻辑
        const inCooldown = (time < this.cooldownEndTime);
        const isGrabbing = gesture && gesture.isGrabbing;

        if (isGrabbing && !inCooldown) {
            if (!this.isInteracting) {
                this.isInteracting = true; 
                if (this._toggleHighlight()) this.lockStartTime = time;
            }
        } else if (this.isInteracting) {
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
        this.balls.scale.setScalar(1.0 + beat * 0.02);
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

    _toggleHighlight() {
        if (this.highlightedIndex !== -1) return false;
        let bestIdx = -1; let maxZ = -99999;
        const worldPos = new THREE.Vector3();
        
        const dissolvingIndices = this.activeDissolves.map(d => d.targetIndex);

        this.cards.forEach((card, idx) => {
            if (dissolvingIndices.includes(idx)) return;
            card.mesh.getWorldPosition(worldPos);
            if (worldPos.z > maxZ) { maxZ = worldPos.z; bestIdx = idx; }
        });
        if (bestIdx !== -1) { this.highlightedIndex = bestIdx; return true; }
        return false;
    }

    _triggerDissolve(index, currentTime) {
        const card = this.cards[index];
        card.mesh.visible = false;
        
        const { system, velocities } = this._createDissolveParticles(card.mesh.position.clone(), card.mesh.rotation.clone());
        
        this.activeDissolves.push({
            system: system,
            velocities: velocities,
            targetIndex: index,
            progress: 0,
            startWorld: system.position.clone()
        });

        this.highlightedIndex = -1; 
    }

    _createDissolveParticles(pos, rot) {
        const particleCount = 1800; 
        const geo = new THREE.BufferGeometry();
        const positions = [];
        const velocities = []; 
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
            velocities.push({ x: explodeDir.x*speed, y: explodeDir.y*speed, z: explodeDir.z*speed, offsetX: vec.x, offsetY: vec.y, offsetZ: vec.z });
        }
        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        const mat = new THREE.PointsMaterial({ color: 0xffd700, size: 0.07, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
        const system = new THREE.Points(geo, mat);
        system.position.copy(pos);
        system.scale.set(3.5, 3.5, 3.5); 
        this.group.add(system);
        
        return { system, velocities };
    }

    _updateDissolve(time) {
        for (let i = this.activeDissolves.length - 1; i >= 0; i--) {
            const d = this.activeDissolves[i];
            d.progress += 0.006; 
            
            const card = this.cards[d.targetIndex];
            const targetPos = card.basePos; 
            const startWorld = d.startWorld; 
            const positions = d.system.geometry.attributes.position;
            const explodePhaseRatio = 0.25;
            
            let explosionStrength = 0; 
            let moveRatio = 0; 
            let scaleRatio = 3.5;      

            if (d.progress < explodePhaseRatio) {
                const t = d.progress / explodePhaseRatio;
                explosionStrength = Math.sin(t * Math.PI / 2) * 1.5; 
            } else {
                const t = (d.progress - explodePhaseRatio) / (1 - explodePhaseRatio);
                const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
                explosionStrength = 1.5 * (1 - ease); 
                moveRatio = ease;
                scaleRatio = 3.5 * (1 - ease) + 1.0 * ease;
            }

            const currentCenter = new THREE.Vector3().lerpVectors(startWorld, targetPos, moveRatio);
            const localCenter = currentCenter.clone().sub(startWorld);

            for (let j = 0; j < positions.count; j++) {
                const vel = d.velocities[j];
                const baseX = vel.offsetX * (scaleRatio / 3.5);
                const baseY = vel.offsetY * (scaleRatio / 3.5);
                const baseZ = vel.offsetZ * (scaleRatio / 3.5); 
                const burstX = vel.x * explosionStrength;
                const burstY = vel.y * explosionStrength;
                const burstZ = vel.z * explosionStrength; 

                positions.setXYZ(j, localCenter.x + baseX + burstX, localCenter.y + baseY + burstY, localCenter.z + baseZ + burstZ);
            }
            
            positions.needsUpdate = true;
            
            if (d.progress >= 1.0) {
                this._finishDissolveInstance(d, time);
                this.activeDissolves.splice(i, 1);
            }
        }
    }

    _finishDissolveInstance(d, currentTime) {
        this.group.remove(d.system);
        d.system.geometry.dispose();
        d.system.material.dispose();
        
        const card = this.cards[d.targetIndex];
        card.mesh.visible = true;
        card.mesh.position.copy(card.basePos);
        card.mesh.rotation.copy(card.baseQuat);
        card.mesh.scale.set(1, 1, 1);
        card.mesh.material.depthTest = true;
        card.mesh.renderOrder = 0;
        
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
            const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ 
                map: currentTexture,
                // 🔴 核心修复：将默认自发光改回黑色（不发光），强度改为0
                emissive: 0x000000,       
                emissiveIntensity: 0 
            }));
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
        const dissolvingIndices = this.activeDissolves.map(d => d.targetIndex);

        this.cards.forEach((card, idx) => {
            if (dissolvingIndices.includes(idx)) return;
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