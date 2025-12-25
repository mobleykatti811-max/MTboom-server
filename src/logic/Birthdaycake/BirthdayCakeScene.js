import * as THREE from 'three';

export class BirthdayCakeScene {
    constructor(scene, camera, renderer) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        
        this.cakeGroup = new THREE.Group(); 
        this.photoGroup = new THREE.Group(); 
        this.particles = null; 
        this.borderParticles = null; 
        this.bgParticles = null; 
        
        // --- 核心配置：支持动态槽位 ---
        this.maxSlots = 6; 
        this.photoSlots = []; 
        this.loadedCount = 0; 
        
        this.state = 'CAKE'; 
        this.candles = []; 
        this.pipingMeshes = []; 
        
        // 🔴 初始状态设为熄灭，等待用户点击点亮
        this.isLit = false; 
        this.currentLightIntensity = 0.0; 

        // 🟢 【新增信号通道】：用于通知外部（SceneManager -> main.js）吹气成功
        this.onBlowingSuccess = null; 

        this.explosionTime = 0; 
        this.clock = new THREE.Clock();
    }

    /**
     * 初始化场景
     */
    async init() {
        this._buildBackgroundEnvironment();
        this.scene.add(this.cakeGroup);
        this._buildCakeMesh();
        this._buildParticleSystem();

        // 🟢 预建 6 个隐藏照片槽位
        this._buildPhotoFrames();

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        this.scene.add(ambientLight);
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(5, 10, 7);
        this.scene.add(dirLight);

        this.candleLight = new THREE.PointLight(0xffa500, 0, 10);
        this.candleLight.position.set(0, 2, 0);
        this.scene.add(this.candleLight);

        console.log("🎂 蛋糕场景就绪，等待交互信号...");
    }

    // ==========================================
    // 🧱 核心构建逻辑 (保持已有内容不删减)
    // ==========================================

    _buildBackgroundEnvironment() {
        const particleCount = 2000;
        const geometry = new THREE.BufferGeometry();
        const positions = [];
        const sizes = [];
        for (let i = 0; i < particleCount; i++) {
            positions.push((Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20, -5 + (Math.random() - 0.5) * 10);
            sizes.push(Math.random());
        }
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
        const material = new THREE.ShaderMaterial({
            uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(0xffd700) } },
            vertexShader: `
                attribute float size;
                varying float vOpacity;
                uniform float uTime;
                void main() {
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    float blink = 0.5 + 0.5 * sin(uTime * 2.0 + position.x * 10.0);
                    vOpacity = blink;
                    gl_PointSize = size * (20.0 / -mvPosition.z);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                uniform vec3 uColor;
                varying float vOpacity;
                void main() {
                    vec2 uv = gl_PointCoord - vec2(0.5);
                    if(length(uv) > 0.5) discard;
                    gl_FragColor = vec4(uColor, vOpacity * 0.8);
                }
            `,
            transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
        });
        this.bgParticles = new THREE.Points(geometry, material);
        this.scene.add(this.bgParticles);
    }

    _buildCakeMesh() {
        const baseGeometry = new THREE.CylinderGeometry(2, 2, 1.5, 32);
        const baseMaterial = new THREE.MeshLambertMaterial({ color: 0xffd166 });
        const base = new THREE.Mesh(baseGeometry, baseMaterial);
        base.position.y = -1;
        this.cakeGroup.add(base);
        const topGeometry = new THREE.CylinderGeometry(1.6, 1.6, 1, 32);
        const topMaterial = new THREE.MeshLambertMaterial({ color: 0xfdfcdc });
        const topLayer = new THREE.Mesh(topGeometry, topMaterial);
        topLayer.position.y = 0.25;
        this.cakeGroup.add(topLayer);
        this._createCreamPiping(1.6, 0.75);
        this._createCandle(0, 0.9);
        this._createCandle(-0.7, 0.7);
        this._createCandle(0.7, 0.7);
    }

    _createCreamPiping(radius, height) {
        const pipingCount = 24;
        const dollopGeometry = new THREE.SphereGeometry(0.2, 16, 16);
        dollopGeometry.scale(1, 0.8, 1);
        const dollopMaterial = new THREE.MeshLambertMaterial({ color: 0xfdfcdc });
        for (let i = 0; i < pipingCount; i++) {
            const angle = (i / pipingCount) * Math.PI * 2;
            const x = (radius - 0.1) * Math.cos(angle);
            const z = (radius - 0.1) * Math.sin(angle);
            const dollop = new THREE.Mesh(dollopGeometry, dollopMaterial);
            dollop.position.set(x, height, z);
            this.cakeGroup.add(dollop);
        }
    }

    _createCandle(x, z) {
        const geometry = new THREE.CylinderGeometry(0.1, 0.1, 0.8, 12);
        const material = new THREE.MeshStandardMaterial({ color: 0xff3333 });
        const candle = new THREE.Mesh(geometry, material);
        candle.position.set(x, 1.15, z);
        this.cakeGroup.add(candle);
        const fireGeo = new THREE.SphereGeometry(0.15, 8, 8);
        const fireMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
        const fire = new THREE.Mesh(fireGeo, fireMat);
        fire.position.y = 0.5;
        candle.add(fire);
        this.candles.push({ mesh: candle, fire: fire });
    }

    _buildParticleSystem() {
        const particleCount = 1500;
        const geometry = new THREE.BufferGeometry();
        const positions = [];
        const velocities = []; 
        for (let i = 0; i < particleCount; i++) {
            const x = (Math.random() - 0.5) * 3;
            const y = (Math.random() - 0.5) * 2;
            const z = (Math.random() - 0.5) * 3;
            positions.push(x, y, z);
            const speed = 0.05 + Math.random() * 0.1;
            velocities.push(x * speed, y * speed, z * speed); 
        }
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.userData = { velocities: velocities };
        const material = new THREE.PointsMaterial({
            color: 0xffd700, size: 0.15, transparent: true, opacity: 0, blending: THREE.AdditiveBlending
        });
        this.particles = new THREE.Points(geometry, material);
        this.scene.add(this.particles);
    }

    _buildPhotoFrames() {
        this.photoGroup.visible = false;
        this.photoGroup.scale.set(0, 0, 0); 
        this.photoSlots = []; 

        const photoGeo = new THREE.PlaneGeometry(1, 1);
        const photoMat = new THREE.MeshBasicMaterial({ 
            side: THREE.DoubleSide,
            transparent: true,
            visible: false
        });

        for (let i = 0; i < this.maxSlots; i++) {
            const mesh = new THREE.Mesh(photoGeo, photoMat.clone());
            mesh.name = `photo_slot_${i}`;
            this.photoGroup.add(mesh);
            this.photoSlots.push(mesh);
        }

        const borderGeo = new THREE.BufferGeometry();
        const borderMat = new THREE.PointsMaterial({
            color: 0xffd700, size: 0.12, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending
        });
        this.borderParticles = new THREE.Points(borderGeo, borderMat);
        this.photoGroup.add(this.borderParticles);

        this.scene.add(this.photoGroup);
    }

    updatePhoto(index, imageUrl) {
        if (index < 0 || index >= this.maxSlots) return;
        
        const loader = new THREE.TextureLoader();
        loader.load(imageUrl, (texture) => {
            texture.colorSpace = THREE.SRGBColorSpace;
            const mesh = this.photoSlots[index];
            if (mesh) {
                const imgAspect = texture.image.width / texture.image.height;
                const slotAspect = 3.4 / 4.6;
                if (imgAspect > slotAspect) {
                    texture.repeat.set(slotAspect / imgAspect, 1);
                    texture.offset.set((1 - slotAspect / imgAspect) / 2, 0);
                } else {
                    texture.repeat.set(1, imgAspect / slotAspect);
                    texture.offset.set(0, (1 - imgAspect / slotAspect) / 2);
                }
                mesh.material.map = texture;
                mesh.material.visible = true;
                mesh.material.needsUpdate = true;
                this.loadedCount = this.photoSlots.filter(m => m.material.map).length;
                this._rearrangeLayout();
            }
        });
    }

    _rearrangeLayout() {
        const count = this.loadedCount;
        if (count === 0) return;
        const unitW = 3.4, unitH = 4.6;
        let scale = 1.0, positions = [];

        if (count === 1) { scale = 1.6; positions = [{ x: 0, y: 0 }]; }
        else if (count === 2) { scale = 1.2; positions = [{ x: -unitW * 0.4 * scale, y: 0 }, { x: unitW * 0.4 * scale, y: 0 }]; }
        else if (count <= 4) {
            scale = 0.9; const gap = 0.3; const ox = (unitW * scale + gap) / 2, oy = (unitH * scale + gap) / 2;
            positions = [{ x: -ox, y: oy }, { x: ox, y: oy }, { x: -ox, y: -oy }, { x: ox, y: -oy }];
        } else {
            scale = 0.7; const gap = 0.2; const ox = unitW * scale + gap, oy = (unitH * scale + gap) / 2;
            positions = [{ x: -ox, y: oy }, { x: 0, y: oy }, { x: ox, y: oy }, { x: -ox, y: -oy }, { x: 0, y: -oy }, { x: ox, y: -oy }];
        }

        let activeIdx = 0;
        this.photoSlots.forEach((mesh) => {
            if (mesh.material.visible && activeIdx < positions.length) {
                const pos = positions[activeIdx];
                mesh.position.set(pos.x, pos.y, 0.02);
                mesh.scale.set(unitW * scale, unitH * scale, 1);
                activeIdx++;
            }
        });
        this._updateBorderParticles(count, scale, unitW, unitH);
    }

    _updateBorderParticles(count, scale, unitW, unitH) {
        let boundsW, boundsH;
        if (count === 1) { boundsW = unitW * scale; boundsH = unitH * scale; }
        else if (count === 2) { boundsW = unitW * scale * 2; boundsH = unitH * scale; }
        else if (count <= 4) { boundsW = unitW * scale * 2.2; boundsH = unitH * scale * 2.2; }
        else { boundsW = unitW * scale * 3.3; boundsH = unitH * scale * 2.2; }

        const borderPositions = [];
        for (let i = 0; i < 800; i++) {
            borderPositions.push((Math.random() - 0.5) * (boundsW + 0.5), (Math.random() - 0.5) * (boundsH + 0.5), -0.1 + (Math.random() - 0.5) * 0.2);
        }
        this.borderParticles.geometry.setAttribute('position', new THREE.Float32BufferAttribute(borderPositions, 3));
        this.borderParticles.geometry.userData.initialPositions = [...borderPositions];
    }
    
    // ==========================================
    // 🎮 交互逻辑：吹气判定与信号发射
    // ==========================================

    handleTap() {
        if (this.state === 'CAKE') {
            this.isLit = true;
        }
    }

    update(gestureData, beat) {
        const delta = this.clock.getDelta();
        const elapsed = this.clock.getElapsedTime();

        if (this.bgParticles) {
            this.bgParticles.rotation.y += 0.0005; 
            this.bgParticles.rotation.z += 0.0002;
            this.bgParticles.material.uniforms.uTime.value = elapsed;
        }

        if (this.state === 'CAKE') {
            // 吹气检测
            if (this.isLit && gestureData && gestureData.isBlowing) {
                this.isLit = false;
                
                // 🔴 【核心修改】：在吹气那一刻，向外部发射信号
                if (typeof this.onBlowingSuccess === 'function') {
                    console.log("🌬️ 物理世界检测到吹气成功！发射信号通知 DOM...");
                    this.onBlowingSuccess(); 
                }

                setTimeout(() => {
                    this.state = 'EXPLODING';
                    this.explosionTime = elapsed;
                    this.cakeGroup.visible = false; 
                    this.particles.material.opacity = 1; 
                }, 800); 
            }

            const targetIntensity = this.isLit ? 1.0 : 0.0;
            this.currentLightIntensity = THREE.MathUtils.lerp(this.currentLightIntensity, targetIntensity, 0.05);
            
            if (this.candleLight) {
                const breathe = 1.0 + Math.sin(elapsed * 3) * 0.1; 
                this.candleLight.intensity = this.currentLightIntensity * breathe;
            }
            
            this.candles.forEach((c) => {
                const targetScale = this.isLit ? 1.0 : 0.0;
                const newScale = THREE.MathUtils.lerp(c.fire.scale.x, targetScale, 0.1);
                c.fire.scale.setScalar(newScale);
                c.fire.visible = newScale > 0.01; 
            });
        }
        else if (this.state === 'EXPLODING') {
            const positions = this.particles.geometry.attributes.position.array;
            const velocities = this.particles.geometry.userData.velocities;
            for (let i = 0; i < positions.length; i += 3) {
                positions[i] += velocities[i] * 4.0;     
                positions[i+1] += velocities[i+1] * 4.0; 
                positions[i+2] += velocities[i+2] * 4.0; 
            }
            this.particles.geometry.attributes.position.needsUpdate = true;
            if (elapsed - this.explosionTime > 2.0) this.state = 'FORMING';
        }
        else if (this.state === 'FORMING' || this.state === 'DONE') {
            if (this.state === 'FORMING') {
                this.particles.material.opacity = THREE.MathUtils.lerp(this.particles.material.opacity, 0, 0.05);
                this.photoGroup.visible = true;
                const newScale = THREE.MathUtils.lerp(this.photoGroup.scale.x, 1.0, 0.05);
                this.photoGroup.scale.setScalar(newScale);
                this.photoGroup.rotation.y = Math.sin((1 - newScale) * Math.PI) * 0.3;
                if (Math.abs(1 - newScale) < 0.01) this.state = 'DONE';
            }

            if (this.borderParticles && this.borderParticles.geometry.attributes.position) {
                const positions = this.borderParticles.geometry.attributes.position.array;
                const initials = this.borderParticles.geometry.userData.initialPositions;
                if (initials) {
                    for(let i = 0; i < positions.length; i+=3) {
                        positions[i] = initials[i] + Math.sin(elapsed * 2 + initials[i+1]) * 0.05; 
                        positions[i+1] = initials[i+1] + Math.cos(elapsed * 1.5 + initials[i]) * 0.05; 
                    }
                    this.borderParticles.geometry.attributes.position.needsUpdate = true;
                }
            }
        }
    }

    dispose() {
        this.scene.traverse((object) => {
            if (object.isMesh || object.isPoints) {
                object.geometry.dispose();
                if (object.material.isMaterial) object.material.dispose();
            }
        });
        this.photoSlots = [];
    }
}