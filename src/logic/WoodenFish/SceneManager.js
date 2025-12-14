import * as THREE from 'three';
import { Muyu3D } from './Muyu3D.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

/**
 * SceneManager - 极简背景版
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
        
        this.textureLoader = new THREE.TextureLoader();

        this.muyu = null;       
        this.bgTexture = null;   
        this.particles = null;

        this.dirLight = null;   
        this.hemiLight = null; 
    }

    init() {
        console.log("🌞 正在布置阳光寺庙 (手势增强版)...");
        
        this._setupRenderer();
        this._setupScene();
        this._setupCamera();
        this._setupBackground();
        this._addObjects();           
        this._createSparkles();       
        this._setupStudioLights();    
        this._setupPostProcessing();  
        this._handleResize();
        
          // 1. 创建音频对象 (注意：路径以 /assets 开头，不要写 public)
        const sound = new Audio('/assets/audio/WoodenFish/temple.m4a');

        // 2. 播放声音 (比如在敲击的时候调用)
        sound.currentTime = 0; // 每次播放前重置进度，适合快速连续敲击
        sound.play();
    }

    render(gestureData, beatValue = 0) {
        const time = this.clock.getElapsedTime();

        // 1. 光照与功德控制
        let targetIntensity = 0.8;
        let internalBeat = beatValue; // 默认节拍

        if (gestureData) {
            // 基础开合度控制亮度
            targetIntensity = 0.8 + gestureData.openness * 0.5;

            // [新增] 双手合十 (Prayer) -> 触发“功德无量”模式
            if (gestureData.isPrayer) {
                // A. 佛光普照：光照拉满
                targetIntensity = 2.5; 
                
                // B. 自动连击：每 10 帧自动触发一次敲击 (模拟机关枪式积累功德)
                // 使用 time 取模来控制频率
                if (Math.floor(time * 10) % 3 === 0) { 
                    internalBeat = 1.0; 
                }
            }
        }

        if (this.dirLight) {
            // 让光照变化更平滑
            this.dirLight.intensity += (targetIntensity - this.dirLight.intensity) * 0.1;
        }

        // 2. 木鱼交互更新
        if (this.muyu) {
            // 传入 internalBeat (可能是外部信号，也可能是合十产生的自动信号)
            this.muyu.update(time, internalBeat);
            
            if (gestureData) {
                this.muyu.setInteraction(gestureData);
            }
        }

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
        this.scene.fog = new THREE.FogExp2(0xfffdf5, 0.005); 
    }

    _setupCamera() {
        this.camera = new THREE.PerspectiveCamera(45, this.width / this.height, 0.1, 100);
        this.camera.position.set(0, 1.5, 10); 
        this.camera.lookAt(0, 0, 0);
    }

    _setupBackground() {
        this.bgTexture = this.textureLoader.load('../../../assets/images/WoodenFish/temple_bg.png', (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            this._updateBackgroundAspect();
        });
        this.scene.background = this.bgTexture;
    }

    _updateBackgroundAspect() {
        if (!this.bgTexture || !this.bgTexture.image) return;
        const canvasAspect = this.width / this.height;
        const imageAspect = this.bgTexture.image.width / this.bgTexture.image.height;
        this.bgTexture.matrix.setUvTransform(0, 0, 1, 1, 0, 0.5, 0.5);
        this.bgTexture.matrixAutoUpdate = false; 

        if (canvasAspect > imageAspect) {
            const scale = imageAspect / canvasAspect; 
            this.bgTexture.matrix.setUvTransform(0, 0, 1, scale, 0, 0.5, 0.5);
        } else {
            const scale = canvasAspect / imageAspect;
            this.bgTexture.matrix.setUvTransform(0, 0, scale, 1, 0, 0.5, 0.5);
        }
    }

    _addObjects() {
        this.muyu = new Muyu3D(this.scene);
        this.muyu.init();
    }

    _setupStudioLights() {
        this.hemiLight = new THREE.HemisphereLight(0xffffff, 0xffeeb1, 0.6);
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
            0.4, 0.5, 0.95
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
            this._updateBackgroundAspect();
        });
    }
}