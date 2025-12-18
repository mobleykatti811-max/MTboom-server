import * as THREE from 'three';
// 🟢 关键修正：从正确的文件名中导入 Muyu3D 类
import { Muyu3D } from './Muyu3D.js'; 
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

/**
 * SceneManager - 3D 场景管理类
 */
export class SceneManager {
    // 接收 canvas 元素和用于 UI 计分的 onHit 回调
    constructor(canvas, onHit) {
        this.canvas = canvas;
        this.onHit = onHit; 
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
        
        // 🟢 补全：初始化分数并创建 UI
        this.totalScore = 0;
        this._createScoreUI(); 
    }

    // 🟢 补全：创建顶部中央计分板
    _createScoreUI() {
        const scoreDiv = document.createElement('div');
        scoreDiv.id = 'total-score-ui';
        // 样式：金色加粗、居中、带阴影
        scoreDiv.style.cssText = `
            position: fixed; 
            top: 20px; 
            left: 50%; 
            transform: translateX(-50%); 
            color: #fa0808ff; 
            font-size: 32px; 
            font-weight: bold; 
            text-shadow: 0 0 10px rgba(0,0,0,0.5); 
            z-index: 100;
            pointer-events: none;
        `;
        scoreDiv.innerHTML = '功德累计: 0';
        document.body.appendChild(scoreDiv);
    }

    init() {
        console.log("🌞 正在布置 3D 禅意空间...");
        this._setupRenderer();
        this._setupScene();
        this._setupCamera();
        this._setupBackground();
        this._addObjects();           
        this._createSparkles();       
        this._setupStudioLights();    
        this._setupPostProcessing();  
        this._handleResize();
    }

    render(gestureData, beatValue = 0) {
        const time = this.clock.getElapsedTime();
        let targetIntensity = 2.5;
        let internalBeat = beatValue;

        if (gestureData) {
            targetIntensity = 0.8 + gestureData.openness * 0.5;

            // 检测合十手势 -> 触发“功德无量”连击模式
            if (gestureData.isPrayer) {
                targetIntensity = 2.5; 
                if (Math.floor(time * 10) % 3 === 0) { 
                    internalBeat = 1.0; 
                    // 🟢 连击时更新本地分数显示
                    this._updateScore();
                }
            }
        }

        if (this.dirLight) {
            this.dirLight.intensity += (targetIntensity - this.dirLight.intensity) * 0.1;
        }

        if (this.muyu) {
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

    // 🟢 补全：统一的分数更新逻辑
    _updateScore() {
        this.totalScore++;
        const ui = document.getElementById('total-score-ui');
        if (ui) ui.innerHTML = `功德累计: ${this.totalScore}`;
        if (this.onHit) this.onHit(); 
    }

    _setupBackground() {
        this.bgTexture = this.textureLoader.load('/assets/images/WoodenFish/temple_bg.png', (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            this._updateBackgroundAspect();
        });
        this.scene.background = this.bgTexture;
    }

    _addObjects() {
        // 🟢 修改：敲击木鱼时执行本地分数更新
        this.muyu = new Muyu3D(this.scene, () => {
            this._updateScore();
        });
        this.muyu.init();
    }

    _setupRenderer() {
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            powerPreference: "high-performance",
            alpha: false 
        });
        this.renderer.setSize(this.width, this.height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 0.8; // 保持背景较暗
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

    _updateBackgroundAspect() {
        if (!this.bgTexture || !this.bgTexture.image) return;
        const canvasAspect = this.width / this.height;
        const imageAspect = this.bgTexture.image.width / this.bgTexture.image.height;
        if (canvasAspect > imageAspect) {
            const scale = imageAspect / canvasAspect; 
            this.bgTexture.matrix.setUvTransform(0, 0, 1, scale, 0, 0.5, 0.5);
        } else {
            const scale = canvasAspect / imageAspect;
            this.bgTexture.matrix.setUvTransform(0, 0, scale, 1, 0, 0.5, 0.5);
        }
        this.bgTexture.matrixAutoUpdate = false; 
    }

    _setupStudioLights() {
        this.hemiLight = new THREE.HemisphereLight(0xffffff, 0xffeeb1, 0.4);
        this.scene.add(this.hemiLight);
        this.dirLight = new THREE.DirectionalLight(0xffffff, 3.5);
        this.dirLight.position.set(-5, 5, 5); 
        this.dirLight.castShadow = true;
        this.scene.add(this.dirLight);
    }

    _createSparkles() {
        const geometry = new THREE.BufferGeometry();
        const positions = []; const speeds = [];
        for(let i=0; i<80; i++) {
            positions.push((Math.random()-0.5)*12, (Math.random()-0.5)*8, (Math.random()-0.5)*5);
            speeds.push(Math.random());
        }
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('aSpeed', new THREE.Float32BufferAttribute(speeds, 1));
        const material = new THREE.ShaderMaterial({
            uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color('#ffffff') } },
            transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
            vertexShader: `uniform float uTime; attribute float aSpeed; varying float vAlpha; void main() { vec3 pos = position; pos.y += sin(uTime * aSpeed + pos.x) * 0.5; vec4 mvPos = modelViewMatrix * vec4(pos, 1.0); gl_Position = projectionMatrix * mvPos; gl_PointSize = (3.0 * aSpeed + 2.0) * (15.0 / -mvPos.z); vAlpha = 0.4 + 0.4 * sin(uTime * 3.0 + aSpeed * 10.0); }`,
            fragmentShader: `uniform vec3 uColor; varying float vAlpha; void main() { float r = length(gl_PointCoord - vec2(0.5)); if (r > 0.5) discard; gl_FragColor = vec4(uColor, (1.0 - smoothstep(0.0, 0.5, r)) * vAlpha); }`
        });
        this.particles = new THREE.Points(geometry, material);
        this.scene.add(this.particles);
    }

    _updateSparkles(time) { if(this.particles) this.particles.material.uniforms.uTime.value = time; }

    _setupPostProcessing() {
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.camera));
        this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(this.width, this.height), 0.4, 0.5, 0.95));
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
    // 🟢 新增：销毁方法，退出时必须调用
    dispose() {
        console.log("🧹 清理场景资源...");
        
        // 1. 移除 UI 元素 (关键修复)
        const ui = document.getElementById('total-score-ui');
        if (ui) {
            ui.remove();
        }

        // 2. 停止渲染循环 (如果你是在外部控制循环，这一步可选，但在类内清理是好习惯)
        // 注意：这需要在外部 cancelAnimationFrame，这里主要是清理 Three.js 资源

        // 3. 释放 Three.js 内存
        if (this.renderer) {
            this.renderer.dispose();
            this.renderer.forceContextLoss();
        }
        
        if (this.composer) {
            this.composer = null;
        }

        if (this.scene) {
            this.scene.traverse((object) => {
                if (object.geometry) object.geometry.dispose();
                if (object.material) {
                    if (Array.isArray(object.material)) {
                        object.material.forEach(m => m.dispose());
                    } else {
                        object.material.dispose();
                    }
                }
            });
        }
    }
}