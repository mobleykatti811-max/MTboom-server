import * as THREE from 'three';
import { Tree3D } from './Tree3D.js';
// 引入后期处理核心库
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

/**
 * SceneManager - 贪玩蓝月·画质全开版 (比心连线)
 */
export class SceneManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.width = window.innerWidth;
        this.height = window.innerHeight;

        // 核心组件
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.composer = null;
        this.clock = new THREE.Clock();

        // 场景元素
        this.tree = null;
        this.godRays = null;   // 上帝之光
        this.atmosphere = null; // 动态背景球
        this.dustSystem = null; // 悬浮尘埃
    }

    init() {
        console.log("🎬 正在加载至尊画质引擎...");
        
        this._setupRenderer();
        this._setupScene();
        this._setupCamera();
        
        // --- 核心视觉构建 (按顺序堆叠图层) ---
        this._createAtmosphere(); // 1. 背景层 (黄金星云)
        this._createGodRays();    // 2. 气氛层 (圣光)
        this._addObjects();       // 3. 主体层 (树 + 倒影)
        this._createDust();       // 4. 前景层 (漂浮金尘)
        
        this._setupLights();      // 灯光
        this._setupPostProcessing(); // 后期 (Bloom)
        
        this._handleResize();
    }

    /**
     * 渲染循环 (更新点)
     */
    render(gestureData, beatValue = 0) {
        const time = this.clock.getElapsedTime();

        // 1. 更新主角 (树)
        if (this.tree) {
            // [新增] 默认 morphTarget = 0 (树状态)
            let morphTarget = 0;

            if (gestureData) {
                // [新增] 如果检测到比心，目标变为 1 (文字状态)
                if (gestureData.isHeart) {
                    morphTarget = 1;
                }

                // [修改] 传递 time, beat 和 morphTarget
                this.tree.update(time, beatValue, morphTarget);

                // [优化] 只有在未变形(树状态)时，才允许手势旋转
                // 防止文字状态下乱转看不清
                if (this.tree.uniforms.uMorphFactor.value < 0.1) {
                    this.tree.setInteraction(gestureData.speed * 0.08, 1.0 + gestureData.openness * 1.2);
                }
            } else {
                this.tree.update(time, beatValue, 0);
            }
        }

        // 2. 更新配角 (背景特效)
        this._updateAtmosphere(time);
        this._updateGodRays(time);
        this._updateDust(time);

        // 3. 渲染最终画面 (走后期合成器)
        if (this.composer) {
            this.composer.render();
        } else {
            this.renderer.render(this.scene, this.camera);
        }
    }

    // ==========================================
    // 🛠️ 核心构建区 (保留原样)
    // ==========================================

    _setupRenderer() {
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: false,
            powerPreference: "high-performance",
            alpha: false
        });
        this.renderer.setSize(this.width, this.height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.2;
    }

    _setupScene() {
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(0x050300, 0.02); 
    }

    _setupCamera() {
        this.camera = new THREE.PerspectiveCamera(60, this.width / this.height, 0.1, 1000);
        this.camera.position.set(0, 0, 32); // 保持你之前修改的拉远距离
        this.camera.lookAt(0, 1, 0);
    }

    _createAtmosphere() {
        const geometry = new THREE.SphereGeometry(100, 32, 32);
        const material = new THREE.ShaderMaterial({
            side: THREE.BackSide,
            uniforms: {
                uTime: { value: 0 },
                uColorA: { value: new THREE.Color('#000000') },
                uColorB: { value: new THREE.Color('#1a1100') }
            },
            vertexShader: `
                varying vec3 vNormal;
                varying vec3 vPosition;
                void main() {
                    vNormal = normalize(normalMatrix * normal);
                    vPosition = position;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 uColorA;
                uniform vec3 uColorB;
                uniform float uTime;
                varying vec3 vNormal;
                varying vec3 vPosition;
                float random(vec2 st) { return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123); }
                void main() {
                    float h = normalize(vPosition).y * 0.5 + 0.5;
                    vec3 color = mix(uColorB, uColorA, h);
                    float noise = random(gl_FragCoord.xy * 0.001 + uTime * 0.05);
                    color += vec3(0.05) * noise * (1.0 - h);
                    gl_FragColor = vec4(color, 1.0);
                }
            `
        });
        this.atmosphere = new THREE.Mesh(geometry, material);
        this.scene.add(this.atmosphere);
    }

    _updateAtmosphere(time) {
        if(this.atmosphere) this.atmosphere.material.uniforms.uTime.value = time;
    }

    _createGodRays() {
        const geometry = new THREE.ConeGeometry(15, 40, 32, 1, true);
        geometry.translate(0, 15, 0);
        const material = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uColor: { value: new THREE.Color('#FFD700') }
            },
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
            vertexShader: `
                varying vec2 vUv;
                varying vec3 vPos;
                uniform float uTime;
                void main() {
                    vUv = uv;
                    vec3 pos = position;
                    float angle = uTime * 0.1;
                    float s = sin(angle); float c = cos(angle);
                    mat2 rot = mat2(c, -s, s, c);
                    pos.xz = pos.xz * rot;
                    vPos = pos;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 uColor;
                uniform float uTime;
                varying vec2 vUv;
                varying vec3 vPos;
                void main() {
                    float opacity = 0.3 * pow(1.0 - vUv.y, 2.0);
                    float beam = sin(atan(vPos.x, vPos.z) * 10.0 - uTime * 0.5);
                    beam = smoothstep(0.0, 1.0, beam);
                    float falloff = smoothstep(0.0, 0.4, vUv.y);
                    vec3 finalColor = uColor * (0.2 + 0.8 * beam);
                    gl_FragColor = vec4(finalColor, opacity * falloff * 0.4);
                }
            `
        });
        this.godRays = new THREE.Mesh(geometry, material);
        this.godRays.position.y = 5;
        this.scene.add(this.godRays);
    }

    _updateGodRays(time) {
        if(this.godRays) {
            this.godRays.material.uniforms.uTime.value = time;
            this.godRays.rotation.z = Math.sin(time * 0.2) * 0.05;
        }
    }

    _createDust() {
        const count = 500;
        const geometry = new THREE.BufferGeometry();
        const positions = [];
        const scales = [];
        for(let i=0; i<count; i++) {
            const r = 40 * Math.sqrt(Math.random());
            const theta = Math.random() * 2 * Math.PI;
            const x = r * Math.cos(theta);
            const z = r * Math.sin(theta);
            const y = (Math.random() - 0.5) * 40;
            positions.push(x, y, z);
            scales.push(Math.random());
        }
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('aScale', new THREE.Float32BufferAttribute(scales, 1));

        const material = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uColor: { value: new THREE.Color('#FFD700') }
            },
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            vertexShader: `
                attribute float aScale;
                uniform float uTime;
                void main() {
                    vec3 pos = position;
                    pos.y += mod(uTime * 1.0 + position.x, 40.0) - 20.0;
                    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                    gl_Position = projectionMatrix * mvPosition;
                    gl_PointSize = (4.0 * aScale + 2.0) * (30.0 / -mvPosition.z);
                }
            `,
            fragmentShader: `
                uniform vec3 uColor;
                void main() {
                    float r = length(gl_PointCoord - vec2(0.5));
                    float glow = 1.0 - smoothstep(0.0, 0.5, r);
                    gl_FragColor = vec4(uColor, glow * 0.5);
                }
            `
        });
        this.dustSystem = new THREE.Points(geometry, material);
        this.scene.add(this.dustSystem);
    }

    _updateDust(time) {
        if(this.dustSystem) {
            this.dustSystem.material.uniforms.uTime.value = time;
            this.dustSystem.rotation.y = time * 0.02;
        }
    }

    _setupPostProcessing() {
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.camera));
        // SceneManager.js - _setupPostProcessing
        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(this.width, this.height),
            1.5,  // 强度：稍微降低一点，不要爆掉
            0.4,  // 半径：稍微收一点，让边缘清晰
            0.1   // 阈值
        );
        this.composer.addPass(bloomPass);
    }

    _addObjects() {
        this.tree = new Tree3D(this.scene);
        this.tree.init();
    }

    _setupLights() {
        const ambientLight = new THREE.AmbientLight(0xffd700, 0.2);
        this.scene.add(ambientLight);
    }

    _handleResize() {
        window.addEventListener('resize', () => {
            this.width = window.innerWidth;
            this.height = window.innerHeight;
            this.camera.aspect = this.width / this.height;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(this.width, this.height);
            this.composer.setSize(this.width, this.height);
        });
    }
}