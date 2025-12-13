import * as THREE from 'three';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler.js';

export class Tree3D {
    constructor(scene) {
        this.scene = scene;
        this.mesh = null;
        this.reflectionMesh = null;
        this.font = null; 
        
        // 物理手感
        this.rotationVelocity = 0;
        this.targetRotation = 0;
        this.damping = 0.96;

        this.params = {
            height: 14,
            radius: 6,
            count: 8800, // 保持较高的数量以保证文字清晰，树的通透靠 Shader 控制
            colorTop: '#FFFFFF', 
            colorBottom: '#FFC000',
            textMessage: "Happy birthday\n Teacher Qiti" 
        };

        this.uniforms = {
            uTime: { value: 0 },
            uBeat: { value: 0 },
            uMorphFactor: { value: 0.0 }, 
            uColorTop: { value: new THREE.Color(this.params.colorTop) },
            uColorBottom: { value: new THREE.Color(this.params.colorBottom) }
        };
    }

    async init() {
        console.log("🎄 Tree3D: 正在加载字体...");
        await this._loadFont();
        console.log("🎄 Tree3D: 字体加载完毕，开始计算表面采样...");

        const { positions, textPositions, randoms, sizes, heights } = this._generateDualGeometries();

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('aTextPos', new THREE.Float32BufferAttribute(textPositions, 3));
        geometry.setAttribute('aRandom', new THREE.Float32BufferAttribute(randoms, 1));
        geometry.setAttribute('aSize', new THREE.Float32BufferAttribute(sizes, 1));
        geometry.setAttribute('aHeight', new THREE.Float32BufferAttribute(heights, 1));

        const material = this._createMorphShader();

        // 1. 本体树
        this.mesh = new THREE.Points(geometry, material);
        this.mesh.position.y = -8;
        this.scene.add(this.mesh);

        // 2. 倒影树
        this.reflectionMesh = new THREE.Points(geometry.clone(), material.clone());
        this.reflectionMesh.position.y = -8; 
        this.reflectionMesh.scale.y = -1;
        this.reflectionMesh.material.uniforms = THREE.UniformsUtils.clone(this.uniforms);
        this.reflectionMesh.material.opacity = 0.25;
        this.scene.add(this.reflectionMesh);
        
        console.log("🎄 Tree3D: 初始化完成");
    }

    update(time, beat = 0, morphTarget = 0) {
        if (!this.mesh) return;

        // 1. 变形插值
        this.uniforms.uMorphFactor.value += (morphTarget - this.uniforms.uMorphFactor.value) * 0.05;
        this.reflectionMesh.material.uniforms.uMorphFactor.value = this.uniforms.uMorphFactor.value;

        // 2. 旋转控制
        const isTreeState = 1.0 - THREE.MathUtils.smoothstep(this.uniforms.uMorphFactor.value, 0.0, 0.3);

        if (morphTarget === 1) {
            // 变字时回正
            const currentRot = this.mesh.rotation.y;
            const targetRot = Math.round(currentRot / (Math.PI * 2)) * (Math.PI * 2);
            this.mesh.rotation.y += (targetRot - currentRot) * 0.05;
            this.rotationVelocity = 0;
        } else {
            // 树形态：正常旋转
            this.rotationVelocity += this.targetRotation * isTreeState;
            this.rotationVelocity *= this.damping;
            this.mesh.rotation.y += this.rotationVelocity;
            this.mesh.rotation.y += 0.002 * isTreeState; 
        }
        
        this.reflectionMesh.rotation.y = this.mesh.rotation.y;
        this.targetRotation = 0; 

        // 3. Uniforms 更新
        this.uniforms.uTime.value = time;
        this.reflectionMesh.material.uniforms.uTime.value = time;

        const currentBeat = this.uniforms.uBeat.value;
        const smoothBeat = currentBeat + (beat - currentBeat) * 0.15;
        this.uniforms.uBeat.value = smoothBeat;
        this.reflectionMesh.material.uniforms.uBeat.value = smoothBeat;
    }

    setInteraction(rotateSpeed, scaleFactor = 1) {
        if (this.uniforms.uMorphFactor.value > 0.1) return;
        this.targetRotation = rotateSpeed * 0.08; 
        const s = Math.max(0.8, Math.min(1.8, scaleFactor));
        if (this.mesh) this.mesh.scale.setScalar(s);
        if (this.reflectionMesh) this.reflectionMesh.scale.setScalar(s);
    }

    _loadFont() {
        const loader = new FontLoader();
        return new Promise((resolve) => {
            loader.load('https://unpkg.com/three@0.147.0/examples/fonts/helvetiker_bold.typeface.json', (font) => {
                this.font = font;
                resolve();
            }, undefined, () => resolve()); 
        });
    }

    _generateDualGeometries() {
        const count = this.params.count;
        const positions = [];
        const textPositions = []; 
        const randoms = []; const sizes = []; const heights = [];

        // A. 生成树坐标
        for (let i = 0; i < count; i++) {
            const h = i / count; 
            const hBias = Math.pow(h, 0.8);
            const angle = i * 2.39996; 
            const r = this.params.radius * (1 - hBias);
            positions.push(Math.cos(angle) * r, hBias * this.params.height, Math.sin(angle) * r);
            randoms.push(Math.random()); sizes.push(Math.random()); heights.push(hBias); 
        }

        // B. 生成文字坐标
        if (this.font) {
            const textGeo = new TextGeometry(this.params.textMessage, {
                font: this.font,
                size: 2.5, 
                height: 0.5, 
                curveSegments: 6,
                bevelEnabled: true, 
                bevelThickness: 0.1,
                bevelSize: 0.05,
                bevelSegments: 3
            });
            textGeo.center(); 

            const tempMesh = new THREE.Mesh(textGeo, new THREE.MeshBasicMaterial());
            const sampler = new MeshSurfaceSampler(tempMesh).build();
            const tempPosition = new THREE.Vector3();

            for (let i = 0; i < count; i++) {
                sampler.sample(tempPosition);
                textPositions.push(
                    tempPosition.x * 1.2,       
                    tempPosition.y * 1.2 + 7.0, 
                    tempPosition.z * 0.1 // 拍扁文字
                );
            }
            textGeo.dispose();
        } else {
            textPositions.push(...positions); 
        }

        return { positions, textPositions, randoms, sizes, heights };
    }

    // [终极混合 Shader]
    _createMorphShader() {
        const vertexShader = `
            attribute vec3 aTextPos; 
            attribute float aRandom;
            attribute float aSize;
            attribute float aHeight;
            
            uniform float uTime;
            uniform float uBeat;
            uniform float uMorphFactor; 
            
            varying float vAlpha;
            varying float vHeight;
            varying float vMorph;
            varying float vRandom;
            varying float vDepth;

            void main() {
                vHeight = aHeight;
                vMorph = uMorphFactor;
                vRandom = aRandom;

                // --- 1. 树形态计算 ---
                vec3 posA = position;
                float isTop = smoothstep(0.9, 1.0, aHeight);
                float treeInfluence = 1.0 - uMorphFactor; 
                
                // 还原旧代码的抖动逻辑，让树看起来有活力
                float expansion = uBeat * 3.0 * (1.0 - aHeight * 0.8) * treeInfluence;
                posA.x += normalize(posA.x) * expansion * (1.0 - isTop * 0.5);
                posA.z += normalize(posA.z) * expansion * (1.0 - isTop * 0.5);
                posA.y += sin(uTime * 2.0 + aRandom * 10.0) * 0.1 * treeInfluence; // 上下浮动

                if (isTop > 0.01) {
                    float jitter = uBeat * 6.0 * isTop * treeInfluence;
                    posA += normalize(posA) * jitter;
                }

                // --- 2. 文字形态计算 ---
                vec3 posB = aTextPos;

                // --- 3. 混合 ---
                // 使用 smoothstep 确保过渡平滑
                vec3 finalPos = mix(posA, posB, smoothstep(0.0, 1.0, uMorphFactor));
                vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);
                gl_Position = projectionMatrix * mvPosition;
                
                vDepth = finalPos.z;

                // --- 4. 大小控制 (核心修复点) ---
                
                // [还原] 旧代码：如果是大粒子(>0.92)，放大2.5倍。这造就了"星星感"
                // [优化] 只在树状态下(treeInfluence高)生效，文字状态下不生效(防止字变得坑坑洼洼)
                float starFactor = 0.0;
                if(aSize > 0.92) {
                    starFactor = 2.5 * treeInfluence; // 只有做树的时候才是大星星
                }

                // 文字状态下，粒子需要变得均匀且稍大，以填补空隙
                float textBaseScale = mix(1.0, 2.5, uMorphFactor); 
                
                float baseSize = 25.0 * aSize + 5.0; 
                // 最终大小 = 基础大小 * (星星加成 + 文字加成)
                float finalSize = baseSize * (1.0 + starFactor) * textBaseScale;
                
                // 加上心跳放缩
                finalSize += isTop * 20.0 * uBeat * treeInfluence;

                gl_PointSize = finalSize * (1.0 / -mvPosition.z);
                
                // --- 5. 透明度控制 ---
                float twinkle = sin(uTime * 10.0 + aRandom * 25.0); // 还原旧代码的高速闪烁
                
                // 树：0.6 + 闪烁 (通透)
                // 字：1.0 (实心)
                float alphaTree = 0.6 + 0.4 * twinkle; 
                float alphaText = 1.0;
                vAlpha = mix(alphaTree, alphaText, uMorphFactor);
            }
        `;

        const fragmentShader = `
            uniform vec3 uColorTop;
            uniform vec3 uColorBottom;
            uniform float uMorphFactor;
            
            varying float vAlpha;
            varying float vHeight;
            varying float vMorph;
            varying float vDepth; // 用来算蓝边

            void main() {
                vec2 uv = gl_PointCoord - vec2(0.5);
                float r = length(uv);
                if (r > 0.5) discard;

                // --- [关键修复] 光晕形状混合 ---
                
                // 形状A (树)：Soft Glow (旧代码) -> 看起来像发光的雾
                float glowSoft = 1.0 - smoothstep(0.0, 0.5, r);
                glowSoft = pow(glowSoft, 2.5); // 指数衰减，非常柔和

                // 形状B (字)：Sharp Coin (新代码) -> 看起来像实心亮片
                float glowSharp = smoothstep(0.5, 0.4, r);

                // 根据形态混合形状：树越柔和，字越锐利
                float shapeAlpha = mix(glowSoft, glowSharp, vMorph);

                // --- 颜色处理 ---
                vec3 treeColor = mix(uColorBottom, uColorTop, vHeight * 1.2);
                
                // 树状态下，加一点过曝的白光 (旧代码的 brightnessBoost)
                if (vMorph < 0.5) {
                    treeColor *= (1.0 + vHeight * 2.0); 
                }

                // 文字状态下，加蓝边 (新代码的土豪特效)
                vec3 blueRim = vec3(0.0, 0.5, 1.0) * 3.0; 
                float rimStrength = smoothstep(1.0, -1.0, vDepth) * vMorph; 
                
                vec3 finalColor = mix(treeColor, blueRim, rimStrength * 0.4);

                // 最终输出：注意这里用的是计算好的混合形状 shapeAlpha
                gl_FragColor = vec4(finalColor * 1.5, shapeAlpha * vAlpha);
            }
        `;

        return new THREE.ShaderMaterial({
            vertexShader,
            fragmentShader,
            uniforms: this.uniforms,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
    }
}