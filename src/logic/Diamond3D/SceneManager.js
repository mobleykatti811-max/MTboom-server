import * as THREE from 'three';
import { Diamond3D } from './Diamond3D.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

/**
 * SceneManager - 治愈系·桌面宠物理念
 * 风格调整：使用卡通寺庙作为背景贴图
 */
export class SceneManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.width = window.innerWidth;
        this.height = window.innerHeight;

        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.composer = null;
        this.clock = new THREE.Clock();
        // ✅ 新增: 纹理加载器
        this.textureLoader = new THREE.TextureLoader();

        this.muyu = null;       
        this.backdrop = null;   
        this.particles = null;

        this.dirLight = null;   
        this.hemiLight = null; 
    }

    init() {
        console.log("🌞 正在布置阳光寺庙桌面...");
        
        this._setupRenderer();
        this._setupScene();
        this._setupCamera();
        
        // ✅ 修改: 调用新的背景创建方法
        this._addObjects();           
        this._createSparkles();       
        this._setupStudioLights();    
        this._setupPostProcessing();  
        
        this._handleResize();
    }

    render(gestureData, beatValue = 0) {
        const time = this.clock.getElapsedTime();

        let internalBeat = beatValue;
        if (gestureData && Math.abs(gestureData.speed) > 15.0) {
            internalBeat = 1.0; 
        }

        // 手掌开合控制背景亮度
        let targetIntensity = 0.8;
        if (gestureData) {
            targetIntensity = 0.8 + gestureData.openness * 0.5;
        }

        if (this.dirLight) {
            this.dirLight.intensity += (targetIntensity - this.dirLight.intensity) * 0.1;
        }

        if (this.muyu) {
            this.muyu.update(time, internalBeat);
            if (gestureData && this.muyu.setInteraction) {
                this.muyu.setInteraction(gestureData.speed);
            }
        }

        // ❌ 删除: 不再需要更新 Shader 背景的时间
        // this._updateBackdrop(time);
        this._updateSparkles(time);

        if (this.composer) {
            this.composer.render();
        } else {
            this.renderer.render(this.scene, this.camera);
        }
    }

    // ==========================================
    // 🛠️ 核心构建区
    // ==========================================

    _setupRenderer() {
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            powerPreference: "high-performance",
            alpha: false
        });
        this.renderer.setSize(this.width, this.height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        
        this.renderer.useLegacyLights = false;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }

    _setupScene() {
        this.scene = new THREE.Scene();
        // ✅ 可选: 添加一点淡黄色的雾气，让远处背景更柔和
        this.scene.fog = new THREE.FogExp2(0xfffdf5, 0.02);
    }

    _setupCamera() {
        this.camera = new THREE.PerspectiveCamera(45, this.width / this.height, 0.1, 100);
        this.camera.position.set(0, 1.5, 10); 
        this.camera.lookAt(0, 0, 0);
    }

    _addObjects() {
        this.muyu = new Diamond3D(this.scene);
        this.muyu.init();
    }

    _setupStudioLights() {
        this.hemiLight = new THREE.HemisphereLight(0xffffff, 0xffeeb1, 0.6); // 稍微调亮一点环境光
        this.scene.add(this.hemiLight);

        this.dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
        this.dirLight.position.set(5, 10, 7);
        this.dirLight.castShadow = true;
        this.dirLight.shadow.mapSize.width = 2048;
        this.dirLight.shadow.mapSize.height = 2048;
        this.dirLight.shadow.bias = -0.0001;
        this.scene.add(this.dirLight);

        const fillLight = new THREE.PointLight(0xffaa00, 0.3);
        fillLight.position.set(-5, 0, 5);
        this.scene.add(fillLight);
    }

    
    // ❌ 删除: 原来的 Shader 背景创建方法
    // _createPastelBackdrop() { ... }

    // ❌ 删除: 原来的 Shader 背景更新方法
    // _updateBackdrop(time) { ... }

    _createSparkles() {
        const count = 80; 
        const geometry = new THREE.BufferGeometry();
        const positions = [];
        const speeds = [];
        
        for(let i=0; i<count; i++) {
            positions.push(
                (Math.random() - 0.5) * 12,
                (Math.random() - 0.5) * 8,
                (Math.random() - 0.5) * 5
            );
            speeds.push(Math.random());
        }
        
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('aSpeed', new THREE.Float32BufferAttribute(speeds, 1));

        const material = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uColor: { value: new THREE.Color('#ffffff') }
            },
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            vertexShader: `
                uniform float uTime;
                attribute float aSpeed;
                varying float vAlpha;
                void main() {
                    vec3 pos = position;
                    float yOffset = sin(uTime * aSpeed + pos.x) * 0.5;
                    pos.y += yOffset;
                    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                    gl_Position = projectionMatrix * mvPosition;
                    gl_PointSize = (3.0 * aSpeed + 2.0) * (15.0 / -mvPosition.z);
                    vAlpha = 0.4 + 0.4 * sin(uTime * 3.0 + aSpeed * 10.0);
                }
            `,
            fragmentShader: `
                uniform vec3 uColor;
                varying float vAlpha;
                void main() {
                    float r = length(gl_PointCoord - vec2(0.5));
                    if (r > 0.5) discard;
                    float glow = 1.0 - smoothstep(0.0, 0.5, r);
                    gl_FragColor = vec4(uColor, glow * vAlpha);
                }
            `
        });

        this.particles = new THREE.Points(geometry, material);
        this.scene.add(this.particles);
    }

    _updateSparkles(time) {
        if(this.particles) {
            this.particles.material.uniforms.uTime.value = time;
        }
    }

    _setupPostProcessing() {
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.camera));
        
        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(this.width, this.height),
            0.35, 
            0.8,  
            0.92  
        );
        this.composer.addPass(bloomPass);
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