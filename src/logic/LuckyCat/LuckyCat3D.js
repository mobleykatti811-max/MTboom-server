import * as THREE from 'three';

export class LuckyCat3D {
    constructor(scene, id) {
        this.scene = scene;
        this.id = id; 
        this.model = null;
        
        // 基础配置
        this.baseScaleValue = 2.0; 

        // 运动参数
        this.speed = 0; 
        this.baseSpeed = 0.1 + Math.random() * 0.2; 
        
        // 旋转参数
        this.rotationSpeed = (Math.random() - 0.5) * 0.1; 
        this.initialRotationY = -Math.PI / 2;

        // 动感光波管理
        this.waves = []; 
        this.waveGeometry = new THREE.RingGeometry(0.2, 0.4, 16); 
    }

    setup(modelClone) {
        this.model = modelClone;
        this.model.scale.set(this.baseScaleValue, this.baseScaleValue, this.baseScaleValue);
        
        this.model.traverse((child) => {
            if (child.isMesh) {
                child.material.emissive = new THREE.Color(0x333333);
            }
        });

        this.respawn(true);
        this.scene.add(this.model);
    }

    respawn(isFirstTime = false) {
        const x = (Math.random() - 0.5) * 30;
        const y = (Math.random() - 0.5) * 10 - 2; 
        const zStart = isFirstTime ? -20 : -50;
        const z = zStart - Math.random() * 100;

        this.model.position.set(x, y, z);
        this.model.rotation.y = this.initialRotationY;
    }

    emitWave() {
        const colors = [0x00ffff, 0xffd700, 0xff00ff, 0x00ff00];
        const color = colors[Math.floor(Math.random() * colors.length)];

        const material = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending 
        });

        const wave = new THREE.Mesh(this.waveGeometry, material);
        wave.position.copy(this.model.position);
        wave.position.y -= 0.5; 
        wave.rotation.x = -Math.PI / 2;

        this.scene.add(wave);
        this.waves.push(wave);
    }

    updateWaves() {
        for (let i = this.waves.length - 1; i >= 0; i--) {
            const wave = this.waves[i];
            wave.scale.multiplyScalar(1.1); 
            wave.material.opacity -= 0.03; 

            if (wave.material.opacity <= 0) {
                this.scene.remove(wave);
                wave.material.dispose();
                this.waves.splice(i, 1);
            }
        }
    }

    // >>> 新增：允许外部修改基础大小 <<<
    setScale(newScale) {
        this.baseScaleValue = newScale;
        // 立即应用一次，避免视觉延迟
        if(this.model) {
            this.model.scale.set(newScale, newScale, newScale);
        }
    }

    update(data, time, beat) {
        if (!this.model) return;

        this.updateWaves();

        const { gesture } = data || {};
        const isWaving = gesture && gesture.type === 'WAVE';

        if (isWaving) {
            this.speed = THREE.MathUtils.lerp(this.speed, this.baseSpeed, 0.1);
        } else {
            this.speed = THREE.MathUtils.lerp(this.speed, 0, 0.1);
        }

        this.model.position.z += this.speed;

        if (this.speed > 0.05) {
            if (Math.random() < 0.3) {
                this.emitWave();
            }
        }

        if (this.model.position.z > 5) {
            this.respawn();
        }

        if (this.speed > 0.01) {
            this.model.position.y += Math.sin(time * 20 + this.id) * 0.02; 
            this.model.rotation.x = Math.sin(time * 10) * 0.1;
        } else {
            const s = this.baseScaleValue + (beat * 0.2);
            this.model.scale.lerp(new THREE.Vector3(s, s, s), 0.1);
        }

        this.model.rotation.z = Math.sin(time * 2 + this.id) * 0.1;
    }
}