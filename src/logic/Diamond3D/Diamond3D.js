import * as THREE from 'three';

export class Diamond3D {
    constructor(scene) {
        this.scene = scene;
        this.mesh = null;
        this.wireframe = null; 
        
        this.rotationVelocity = 0;
        this.targetRotation = 0;
        this.damping = 0.95;

        // ✅ [核心修复] 确保 uOpacity 被定义
        this.uniforms = {
            uTime: { value: 0 },
            uBeat: { value: 0 },
            uColorCore: { value: new THREE.Color('#FFD700') }, 
            uColorRim: { value: new THREE.Color('#FFFFFF') },
            uOpacity: { value: 1.0 } // 默认 1.0 完全不透明
        };

        this.themes = {
            'gold': { core: '#FFD700', rim: '#FFFFFF' }, 
            'ice':  { core: '#0088ff', rim: '#ccffff' }, 
            'rose': { core: '#ff0055', rim: '#ffcc00' }  
        };
        
        this.targetColorCore = new THREE.Color('#FFD700');
        this.targetColorRim = new THREE.Color('#FFFFFF');

        // ✅ [调整] 默认参数回归经典：opacity 1.0 (实心)
        this.materialModes = {
            'clear':   { opacity: 1.0, wireOpacity: 0.6 }, // 经典实心
            'frosted': { opacity: 0.7, wireOpacity: 0.8 }, // 磨砂
            'glass':   { opacity: 0.3, wireOpacity: 0.2 }  // 透明玻璃
        };
    }

    init() {
        console.log("💎 Diamond3D: 终极修复版...");

        const geometry = new THREE.OctahedronGeometry(2, 0); 
        const material = this._createCrystalShader();
        
        this.mesh = new THREE.Mesh(geometry, material);
        this.scene.add(this.mesh);

        const wireGeo = new THREE.OctahedronGeometry(2.1, 0); 
        const wireMat = new THREE.MeshBasicMaterial({ 
            color: 0xFFFFFF, 
            wireframe: true,
            transparent: true,
            opacity: 0.6, 
            blending: THREE.AdditiveBlending
        });
        this.wireframe = new THREE.Mesh(wireGeo, wireMat);
        this.scene.add(this.wireframe);
    }

    update(time, beat = 0) {
        if (!this.mesh) return;

        this.rotationVelocity += this.targetRotation;
        this.rotationVelocity *= this.damping;
        
        this.mesh.rotation.y += this.rotationVelocity + 0.01;
        this.mesh.rotation.z = Math.sin(time * 0.3) * 0.1; 

        this.wireframe.rotation.copy(this.mesh.rotation);
        this.targetRotation = 0; 

        const pulse = 1.0 + beat * 0.15;
        this.mesh.scale.setScalar(pulse);
        this.wireframe.scale.setScalar(pulse);

        // 更新 Uniforms
        this.uniforms.uTime.value = time;
        this.uniforms.uBeat.value = beat;
        
        // 颜色平滑过渡
        this.uniforms.uColorCore.value.lerp(this.targetColorCore, 0.05);
        this.uniforms.uColorRim.value.lerp(this.targetColorRim, 0.05);
    }

    setInteraction(rotateSpeed, scaleFactor = 1) {
        this.targetRotation = rotateSpeed * 0.01;
    }

    setTheme(themeKey) {
        const theme = this.themes[themeKey];
        if (theme) {
            this.targetColorCore.set(theme.core);
            this.targetColorRim.set(theme.rim);
        }
    }

    setMaterialMode(modeKey) {
        const mode = this.materialModes[modeKey];
        if (mode && this.mesh && this.wireframe) {
            // ✅ [修复] 更新 uOpacity.value
            this.uniforms.uOpacity.value = mode.opacity;
            this.wireframe.material.opacity = mode.wireOpacity;
        }
    }

    _createCrystalShader() {
        const vertexShader = `
            varying vec3 vNormal;
            varying vec3 vPosition;
            varying vec2 vUv;
            uniform float uTime;
            uniform float uBeat;
            void main() {
                vUv = uv;
                vNormal = normalize(normalMatrix * normal);
                vPosition = position;
                vec3 pos = position;
                float distortion = sin(pos.y * 4.0 + uTime * 3.0) * uBeat * 0.2;
                pos += normal * distortion;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
            }
        `;

        const fragmentShader = `
            uniform float uTime;
            uniform float uBeat;
            uniform vec3 uColorCore;
            uniform vec3 uColorRim;
            
            // ✅ [关键修复] 变量名必须和 JS 里的 key 一致
            uniform float uOpacity; 
            
            varying vec3 vNormal;
            varying vec3 vPosition;

            void main() {
                vec3 viewDir = normalize(cameraPosition - vPosition);
                float faceLight = abs(dot(vNormal, viewDir)); 
                float rim = 1.0 - max(dot(viewDir, vNormal), 0.0);
                rim = pow(rim, 3.0); 
                
                float shimmer = sin(vPosition.y * 2.0 - uTime * 3.0);
                shimmer = smoothstep(0.8, 1.0, shimmer); 
                
                vec3 finalColor = mix(uColorCore, uColorRim, rim * 0.8);
                finalColor += vec3(1.0) * shimmer * 0.8;
                finalColor *= (0.5 + 0.5 * faceLight);
                finalColor *= (1.0 + uBeat * 1.5);
                
                // ✅ [使用] 使用 uOpacity
                gl_FragColor = vec4(finalColor, 0.95 * uOpacity); 
            }
        `;

        return new THREE.ShaderMaterial({
            vertexShader,
            fragmentShader,
            uniforms: this.uniforms,
            transparent: true,
            side: THREE.DoubleSide
        });
    }
}