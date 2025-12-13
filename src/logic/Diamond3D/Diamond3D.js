import * as THREE from 'three';

export class Diamond3D {
    constructor(scene) {
        this.scene = scene;
        this.mesh = null;
        this.wireframe = null; 
        
        this.rotationVelocity = 0;
        this.targetRotation = 0;
        this.damping = 0.95;

        this.uniforms = {
            uTime: { value: 0 },
            uBeat: { value: 0 },
            uColorCore: { value: new THREE.Color('#FFD700') }, // 土豪金核心
            uColorRim: { value: new THREE.Color('#FFFFFF') }   // 钻石白棱边
        };
    }

    init() {
        console.log("💎 Diamond3D: 正在精细打磨...");

        // 1. 创建几何体 (八面体)
        // radius=6, detail=0 -> 经典的菱形
        const geometry = new THREE.OctahedronGeometry(2, 0); 

        // 2. 材质 A: 实体 (物理Shader)
        const material = this._createCrystalShader();
        
        this.mesh = new THREE.Mesh(geometry, material);
        this.scene.add(this.mesh);

        // 3. 材质 B: 外部线框 (像镶嵌工艺)
        // 稍微大一点，包在外面
        const wireGeo = new THREE.OctahedronGeometry(2.1, 0); 
        const wireMat = new THREE.MeshBasicMaterial({ 
            color: 0xFFFFFF, 
            wireframe: true,
            transparent: true,
            opacity: 0.5, // 提高不透明度，让线条看清楚
            blending: THREE.AdditiveBlending
        });
        this.wireframe = new THREE.Mesh(wireGeo, wireMat);
        this.scene.add(this.wireframe);
    }

    update(time, beat = 0) {
        if (!this.mesh) return;

        // 旋转逻辑
        this.rotationVelocity += this.targetRotation;
        this.rotationVelocity *= this.damping;
        
        // 华丽旋转
        this.mesh.rotation.y += this.rotationVelocity + 0.01;
        this.mesh.rotation.z = Math.sin(time * 0.3) * 0.1; // 微微倾斜

        // 线框同步旋转
        this.wireframe.rotation.copy(this.mesh.rotation);

        this.targetRotation = 0; 

        // 像心脏一样跳动 (幅度调小，不要跳出屏幕)
        const pulse = 1.0 + beat * 0.15;
        this.mesh.scale.setScalar(pulse);
        this.wireframe.scale.setScalar(pulse);

        // 更新 Shader 参数
        this.uniforms.uTime.value = time;
        this.uniforms.uBeat.value = beat;
    }

    setInteraction(rotateSpeed, scaleFactor = 1) {
        this.targetRotation = rotateSpeed * 0.1; 
    }

    // --- 修复且优化后的 Shader ---
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

                // 顶点微动，制造液态流金的感觉
                vec3 pos = position;
                // 仅在重低音时轻微变形，平时保持刚性
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
            
            varying vec3 vNormal;
            varying vec3 vPosition;

            void main() {
                // 1. 面光照 (Flat Lighting)
                // 计算面朝向相机的角度，制造明暗面
                vec3 viewDir = normalize(cameraPosition - vPosition);
                // 使用 abs() 让背面也亮一点，像透光一样
                float faceLight = abs(dot(vNormal, viewDir)); 
                
                // 2. 边缘光 (Rim Light) - 钻石最亮的地方是棱边
                float rim = 1.0 - max(dot(viewDir, vNormal), 0.0);
                rim = pow(rim, 3.0); // 让光集中在边缘

                // 3. 流光特效 (Shimmer)
                float shimmer = sin(vPosition.y * 2.0 - uTime * 3.0);
                shimmer = smoothstep(0.8, 1.0, shimmer); // 只留一条亮线扫过

                // 4. 合成颜色
                // 核心是金色，越靠边缘越白
                vec3 finalColor = mix(uColorCore, uColorRim, rim * 0.8);
                
                // 加上流光
                finalColor += vec3(1.0) * shimmer * 0.8;

                // 加上面光照对比度 (让不同面有明暗区别)
                finalColor *= (0.5 + 0.5 * faceLight);

                // 5. 节拍闪烁 (只在Beat时加亮)
                finalColor *= (1.0 + uBeat * 1.5);

                // 最终输出 (alpha < 1.0 让它看起来有点通透)
                gl_FragColor = vec4(finalColor, 0.9);
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