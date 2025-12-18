import * as THREE from 'three';
import { Diamond3D } from './Diamond3D.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

/**
 * SceneManager - 修复版
 * 1. 粒子增强
 * 2. UI 交互修复
 * 3. 修正手势速度传递
 * 4. [本次修复] 支持页面切换时销毁 UI (dispose)
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
        this.bloomPass = null; 
        this.clock = new THREE.Clock();
        this.textureLoader = new THREE.TextureLoader();

        this.muyu = null;       
        this.particles = null;
        this.dirLight = null;   
        this.hemiLight = null; 
        
        // 状态存储
        this.uiContainer = null;
        this.stage = 0;
        this.stageTimer = 0; 
    }

    init() {
        console.log("🎄 正在布置圣诞场景...");
        
        this._setupRenderer();
        this._setupScene();
        this._setupCamera();
        
        this._addObjects();           
        this._createSparkles();       
        this._setupStudioLights();    
        this._setupPostProcessing();  
        
        this._handleResize();
        this._updateDOM("挥挥手，唤醒晶石...");

        // 创建 UI
        this._createControlUI();
    }

    render(gestureData, beatValue = 0) {
        const deltaTime = this.clock.getDelta(); 
        const time = this.clock.getElapsedTime();

        this._updateStateLogic(gestureData, deltaTime);

        let targetIntensity = 0.8;
        if (this.stage === 0) targetIntensity = 0.2; 
        if (this.stage === 3) targetIntensity = 1.5; 
        
        if (gestureData) targetIntensity += gestureData.openness * 0.5;
        if (this.dirLight) this.dirLight.intensity += (targetIntensity - this.dirLight.intensity) * 0.1;

        if (this.muyu) {
            // 分离速度设置和更新逻辑
            const interactionSpeed = (this.stage === 1 && gestureData) ? gestureData.speed : 0;
            this.muyu.setInteraction(interactionSpeed);
            this.muyu.update(time, beatValue);
        }

        this._updateSparkles(time);

        if (this.composer) {
            this.composer.render();
        } else {
            this.renderer.render(this.scene, this.camera);
        }
    }

    // ✅ [新增] 销毁方法：路由切换时调用
    dispose() {
        // 1. 移除 UI 面板
        if (this.uiContainer && this.uiContainer.parentNode) {
            this.uiContainer.parentNode.removeChild(this.uiContainer);
            this.uiContainer = null;
            console.log("🗑️ 钻石场景 UI 已移除");
        }

        // 2. 清理 Three.js 资源
        if (this.renderer) {
            this.renderer.dispose();
        }
    }

    _updateStateLogic(gestureData, dt) {
        if (!gestureData) return;
        this.stageTimer += dt;
        switch (this.stage) {
            case 0: if (Math.abs(gestureData.speed) > 5.0) this._setStage(1); break;
            case 1: if (this.stageTimer > 4.0) this._setStage(2); break;
            case 2: if (gestureData.isHeart) this._setStage(3); break;
            case 3: break;
        }
    }

    _setStage(newStage) {
        this.stage = newStage;
        this.stageTimer = 0; 
        if (newStage === 1) this._updateDOM("注入能量中！✨");
        if (newStage === 2) this._updateDOM("双手比心 ❤️ 许下愿望");
        if (newStage === 3) {
            this._updateDOM("Merry Christmas! 🎄");
            this._triggerExplosionEffect();
        }
    }

    _updateDOM(text) {
        const el = document.getElementById('instruction-text');
        if (el) {
            el.innerText = text;
            el.style.animation = 'none';
            el.offsetHeight; 
            el.style.animation = null; 
        }
    }

    _triggerExplosionEffect() {
        if (this.bloomPass) {
            this.bloomPass.strength = 2.5; 
            this.bloomPass.radius = 1.0;
        }
        if (this.particles) {
            this.particles.material.uniforms.uColor.value.setHex(0xff007f); 
        }
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
        this.renderer.useLegacyLights = false;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }

    _setupScene() {
        this.scene = new THREE.Scene();
        this.scene.background = this.textureLoader.load('/assets/images/Diamond3D/Diamond3D.jpg');
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
        this.hemiLight = new THREE.HemisphereLight(0xffffff, 0xffeeb1, 0.6); 
        this.scene.add(this.hemiLight);
        this.dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
        this.dirLight.position.set(5, 10, 7);
        this.dirLight.castShadow = true;
        this.scene.add(this.dirLight);
        const fillLight = new THREE.PointLight(0xffaa00, 0.3);
        fillLight.position.set(-5, 0, 5);
        this.scene.add(fillLight);
    }

    _createSparkles() {
        const count = 200; 
        const geometry = new THREE.BufferGeometry();
        const positions = [];
        const speeds = [];
        
        for(let i=0; i<count; i++) {
            positions.push(
                (Math.random() - 0.5) * 15, 
                (Math.random() - 0.5) * 10,
                (Math.random() - 0.5) * 10 
            );
            speeds.push(Math.random());
        }
        
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('aSpeed', new THREE.Float32BufferAttribute(speeds, 1));

        const material = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uColor: { value: new THREE.Color('#FFFFFF') } 
            },
            transparent: true,
            blending: THREE.NormalBlending, 
            depthWrite: false,
            vertexShader: `
                uniform float uTime;
                attribute float aSpeed;
                varying float vAlpha;
                void main() {
                    vec3 pos = position;
                    float yOffset = sin(uTime * 0.5 * aSpeed + pos.x) * 0.8;
                    pos.y += yOffset;
                    
                    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                    gl_Position = projectionMatrix * mvPosition;
                    
                    gl_PointSize = (12.0 * aSpeed + 5.0) * (15.0 / -mvPosition.z);
                    vAlpha = 0.4 + 0.3 * sin(uTime * 2.0 + aSpeed * 10.0);
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
            if (this.stage === 3) this.particles.material.uniforms.uTime.value = time * 2.0;
        }
    }

    _setupPostProcessing() {
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.camera));
        this.bloomPass = new UnrealBloomPass(new THREE.Vector2(this.width, this.height), 0.35, 0.8, 0.90);
        this.composer.addPass(this.bloomPass);
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

    _createControlUI() {
        // ✅ [核心修改 1] 将 DOM 元素保存到 this.uiContainer，而不是局部变量
        this.uiContainer = document.createElement('div');
        const container = this.uiContainer; // 创建局部引用，保持下方代码不变

        Object.assign(container.style, {
            position: 'absolute',
            top: '30px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: '10001', 
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            alignItems: 'center',
            background: 'rgba(20, 20, 30, 0.6)',
            backdropFilter: 'blur(12px)',
            padding: '12px 20px',
            borderRadius: '24px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
            fontFamily: 'sans-serif',
            fontSize: '13px',
            color: 'white',
            userSelect: 'none',
            pointerEvents: 'auto' 
        });

        const createRow = (options, name, callback) => {
            const rowDiv = document.createElement('div');
            Object.assign(rowDiv.style, {
                display: 'flex',
                gap: '8px',
                background: 'rgba(0,0,0,0.3)',
                borderRadius: '16px',
                padding: '4px',
                pointerEvents: 'auto'
            });

            options.forEach(opt => {
                const item = document.createElement('div');
                Object.assign(item.style, {
                    cursor: 'pointer',
                    padding: '6px 16px',
                    borderRadius: '12px',
                    transition: 'all 0.2s ease',
                    background: opt.checked ? 'rgba(255,255,255,0.9)' : 'transparent',
                    color: opt.checked ? '#000' : 'rgba(255,255,255,0.6)',
                    fontWeight: opt.checked ? 'bold' : 'normal',
                    textAlign: 'center'
                });
                item.innerText = opt.label;

                item.onclick = (e) => {
                    e.stopPropagation(); 
                    callback(opt.value);
                    
                    Array.from(rowDiv.children).forEach(child => {
                        if (child === item) {
                            child.style.background = 'rgba(255,255,255,0.9)';
                            child.style.color = '#000';
                            child.style.fontWeight = 'bold';
                        } else {
                            child.style.background = 'transparent';
                            child.style.color = 'rgba(255,255,255,0.6)';
                            child.style.fontWeight = 'normal';
                        }
                    });
                };
                rowDiv.appendChild(item);
            });
            return rowDiv;
        };

        const colorRow = createRow([
            { label: "流光金", value: "gold", checked: true },
            { label: "极寒冰", value: "ice", checked: false },
            { label: "玫瑰恋", value: "rose", checked: false }
        ], "theme", (v) => this.muyu.setTheme(v));

        const matRow = createRow([
            { label: "经典 (默认)", value: "clear", checked: true },
            { label: "磨砂", value: "frosted", checked: false },
            { label: "透明", value: "glass", checked: false }
        ], "mode", (v) => this.muyu.setMaterialMode(v));

        container.appendChild(colorRow);
        container.appendChild(matRow);

        const arView = document.getElementById('view-ar');
        if (arView) arView.appendChild(container);
        else document.body.appendChild(container);
    }
}