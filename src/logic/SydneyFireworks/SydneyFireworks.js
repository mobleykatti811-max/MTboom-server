import * as THREE from 'three';

// --- 顶点着色器 ---
const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
  }
`;

// --- 片元着色器 ---
const fragmentShader = `
  uniform sampler2D tBase;
  uniform sampler2D tBloom;
  uniform float uBloomProgress; 
  varying vec2 vUv;

  void main() {
    vec4 baseColor = texture2D(tBase, vUv);
    vec4 bloomColor = texture2D(tBloom, vUv);
    vec4 finalColor = mix(baseColor, bloomColor, uBloomProgress);
    gl_FragColor = vec4(finalColor.rgb, 1.0);
  }
`;

// --- 状态定义 ---
const STATE = {
    AUTO_COUNTDOWN: 0, 
    INTERACTIVE: 1,    
    EXPLODING: 2,      // 盛放中
    PEAK_HOLD: 3,      // 保持盛放
    FADING_OUT: 4,     // 缓缓熄灭
    FINISHED: 5,       // 显示文字
    WAITING_REPLAY: 6  // 等待重播
};

export class SydneyFireworksScene {
    constructor(scene, camera, renderer) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;

        // 3D 对象
        this.planeMesh = null;
        this.materialUniforms = null;
        this.overlayMesh = null;
        this.overlayTexture = null;
        this.overlayCanvas = null;
        this.overlayCtx = null;

        // 尺寸变量（由 SceneManager 动态注入）
        this.viewWidth = 0;
        this.viewHeight = 0;

        // HTML 元素
        this.replayBtn = null;

        // --- 核心状态机 ---
        this.currentState = STATE.AUTO_COUNTDOWN;
        this.stateTimer = 0;

        // --- 倒计时控制 ---
        this.countdownValue = 10; 
        this.lastTickTime = 0;    
        this.tickInterval = 1000; 

        // --- 交互状态 ---
        this.gestureCountDown = 3; 

        // --- 烟花绽放状态 ---
        this.targetProgress = 0.0;
        this.currentProgress = 0.0;
        this.lerpSpeed = 0.008; 
    }

    async init() {
        console.log("🎆 SydneyFireworks: 业务初始化...");
        
        // 1. 初始化平面与文字层
        // 此时 viewWidth 和 viewHeight 已被 SceneManager 注入
        await this.initPhotoPlane();
        this.initOverlayCanvas();
        this.initReplayButton(); 
        
        this.camera.position.set(0, 0, 18);
        this.camera.lookAt(0, 0, 0);

        this.lastTickTime = performance.now();
        this.updateOverlayContent(this.countdownValue.toString(), 'countdown');
    }

    async initPhotoPlane() {
        const textureLoader = new THREE.TextureLoader();
        const baseTextureUrl = '/assets/images/sydney_base.jpg';
        const bloomTextureUrl = '/assets/images/sydney_bloom.jpg';

        try {
            const [textureBase, textureBloom] = await Promise.all([
                textureLoader.loadAsync(baseTextureUrl),
                textureLoader.loadAsync(bloomTextureUrl)
            ]);

            textureBase.colorSpace = THREE.SRGBColorSpace;
            textureBloom.colorSpace = THREE.SRGBColorSpace;

            this.materialUniforms = {
                tBase: { value: textureBase },
                tBloom: { value: textureBloom },
                uBloomProgress: { value: 0.0 }
            };

            const shaderMaterial = new THREE.ShaderMaterial({
                uniforms: this.materialUniforms,
                vertexShader: vertexShader,
                fragmentShader: fragmentShader,
                side: THREE.DoubleSide
            });

            // 💡 使用动态注入的适配尺寸
            const geometry = new THREE.PlaneGeometry(this.viewWidth, this.viewHeight);
            this.planeMesh = new THREE.Mesh(geometry, shaderMaterial);
            this.scene.add(this.planeMesh);

        } catch (error) {
            console.error("❌ SydneyFireworks 图片加载失败", error);
        }
    }

    initOverlayCanvas() {
        this.overlayCanvas = document.createElement('canvas');
        this.overlayCanvas.width = 2048;
        this.overlayCanvas.height = 1024;
        this.overlayCtx = this.overlayCanvas.getContext('2d');

        this.overlayTexture = new THREE.CanvasTexture(this.overlayCanvas);
        this.overlayTexture.minFilter = THREE.LinearFilter;
        
        const material = new THREE.MeshBasicMaterial({
            map: this.overlayTexture,
            transparent: true,
            side: THREE.DoubleSide,
            depthTest: false
        });

        // 文字层同步全屏适配尺寸
        const geometry = new THREE.PlaneGeometry(this.viewWidth, this.viewHeight);
        this.overlayMesh = new THREE.Mesh(geometry, material);
        this.overlayMesh.position.z = 0.1;
        this.scene.add(this.overlayMesh);
    }

    /**
     * 绘制文字 - 支持粒子特效文字
     */
    updateOverlayContent(text, type) {
        if (!this.overlayCtx) return;
        const ctx = this.overlayCtx;
        const width = this.overlayCanvas.width;
        const height = this.overlayCanvas.height;

        ctx.clearRect(0, 0, width, height);

        const safeMarginLeft = 300; 
        const safeMarginTop = 150; 

        if (type === 'countdown' || type === 'prompt') {
            const gradient = ctx.createLinearGradient(0, 0, 0, height);
            gradient.addColorStop(0, '#FFEB3B'); 
            gradient.addColorStop(0.5, '#FFC107'); 
            gradient.addColorStop(1, '#FF5722'); 

            ctx.fillStyle = gradient;
            ctx.strokeStyle = '#8B0000'; 
            ctx.lineWidth = 8; 
            ctx.shadowColor = '#FF4500'; 
            ctx.shadowBlur = 5;

            ctx.textAlign = 'left'; 
            ctx.textBaseline = 'top';
            
            if (type === 'countdown') {
                ctx.font = 'bold 100px "Arial Black", sans-serif';
                ctx.strokeText(text, safeMarginLeft, safeMarginTop);
                ctx.fillText(text, safeMarginLeft, safeMarginTop);
            } else {
                ctx.font = 'bold 55px "Microsoft YaHei", sans-serif';
                const lineHeight = 75; 
                const lines = text.split('\n');
                lines.forEach((line, index) => {
                    const y = safeMarginTop + (index * lineHeight);
                    ctx.strokeText(line, safeMarginLeft, y);
                    ctx.fillText(line, safeMarginLeft, y);
                });
            }
        } 
        else if (type === 'final') {
            const centerX = width / 2;
            const centerY = height / 2 - 120;

            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 130px "Arial Black", sans-serif';
            ctx.fillText("✨ HAPPY NEW YEAR ✨", centerX, centerY);
            
            ctx.font = 'bold 90px "Microsoft YaHei", sans-serif';
            ctx.fillText("2026 新年快乐", centerX, centerY + 160);

            ctx.globalCompositeOperation = 'source-in';
            const colors = ['#FFD700', '#FF4500', '#FFFFFF', '#FF8C00', '#FF69B4'];
            
            for (let i = 0; i < 5000; i++) {
                ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
                ctx.beginPath();
                ctx.arc(Math.random() * width, Math.random() * height, Math.random() * 4 + 1, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.globalCompositeOperation = 'source-over';

            ctx.shadowColor = '#FFD700';
            ctx.shadowBlur = 30;
            ctx.strokeStyle = 'rgba(0,0,0,0)'; 
            ctx.lineWidth = 0;
            ctx.fillStyle = 'rgba(0,0,0,0)'; 
            
            ctx.font = 'bold 130px "Arial Black", sans-serif';
            ctx.strokeText("✨ HAPPY NEW YEAR ✨", centerX, centerY);
            ctx.font = 'bold 90px "Microsoft YaHei", sans-serif';
            ctx.strokeText("2026 新年快乐", centerX, centerY + 160);
        }

        this.overlayTexture.needsUpdate = true;
    }

    update(gestureData, beat) {
        if (!this.materialUniforms) return;
        const now = performance.now();

        switch (this.currentState) {
            case STATE.AUTO_COUNTDOWN:
                if (now - this.lastTickTime > this.tickInterval) {
                    this.countdownValue--;
                    this.lastTickTime = now;

                    if (this.countdownValue > 3) {
                        this.updateOverlayContent(this.countdownValue.toString(), 'countdown');
                    } else {
                        this.currentState = STATE.INTERACTIVE;
                        this.updateOverlayContent("和我一起做:\n3, 2, 1 👆", 'prompt');
                    }
                }
                break;

            case STATE.INTERACTIVE:
                if (gestureData && gestureData.handPresent) {
                    const fingers = gestureData.fingerCount;
                    if (this.gestureCountDown === 3 && fingers === 3) {
                        this.gestureCountDown = 2;
                        this.updateOverlayContent("保持节奏:\n2 ✌️", 'prompt');
                    } else if (this.gestureCountDown === 2 && fingers === 2) {
                        this.gestureCountDown = 1;
                        this.updateOverlayContent("最后一步:\n1 ☝️", 'prompt');
                    } else if (this.gestureCountDown === 1 && fingers === 1) {
                        this.currentState = STATE.EXPLODING;
                        this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
                        this.overlayTexture.needsUpdate = true;
                    }
                }
                break;

            case STATE.EXPLODING:
                this.targetProgress = 1.0;
                if (this.currentProgress > 0.99) {
                    this.currentState = STATE.PEAK_HOLD;
                    this.stateTimer = now;
                }
                break;

            case STATE.PEAK_HOLD:
                this.targetProgress = 1.0 + (beat || 0) * 0.05; 
                if (now - this.stateTimer > 1500) {
                    this.currentState = STATE.FADING_OUT;
                }
                break;

            case STATE.FADING_OUT:
                this.targetProgress = 0.0;
                if (this.currentProgress < 0.01) {
                    this.currentState = STATE.FINISHED;
                    this.updateOverlayContent("", 'final');
                    this.stateTimer = now;
                }
                break;
            
            case STATE.FINISHED:
                this.targetProgress = 0.0;
                if (now - this.stateTimer > 2000 && this.replayBtn.style.display === 'none') {
                    this.currentState = STATE.WAITING_REPLAY;
                    this.replayBtn.style.display = 'block';
                }
                break;

            case STATE.WAITING_REPLAY:
                this.targetProgress = 0.0;
                break;
        }

        this.currentProgress = THREE.MathUtils.lerp(
            this.currentProgress,
            this.targetProgress,
            this.lerpSpeed
        );
        this.materialUniforms.uBloomProgress.value = this.currentProgress;

        if (this.planeMesh) {
            const floatY = Math.sin(now * 0.0005) * 0.1;
            this.planeMesh.position.y = floatY;
            if (this.overlayMesh) this.overlayMesh.position.y = floatY;
        }
    }

    initReplayButton() {
        this.replayBtn = document.createElement('button');
        this.replayBtn.innerText = "🔄 再看一遍";
        Object.assign(this.replayBtn.style, {
            position: 'absolute', left: '50%', bottom: '15%', transform: 'translateX(-50%)',
            padding: '12px 30px', fontSize: '18px', fontWeight: 'bold', color: '#fff',
            background: 'linear-gradient(45deg, #FFD700, #FF8C00)', border: 'none',
            borderRadius: '50px', cursor: 'pointer', boxShadow: '0 0 20px rgba(255, 215, 0, 0.6)',
            display: 'none', zIndex: '9999', fontFamily: '"Microsoft YaHei", sans-serif'
        });
        this.replayBtn.onclick = () => this.reset();
        document.body.appendChild(this.replayBtn);
    }

    reset() {
        this.replayBtn.style.display = 'none';
        this.currentState = STATE.AUTO_COUNTDOWN;
        this.countdownValue = 10;
        this.gestureCountDown = 3;
        this.targetProgress = 0.0;
        this.currentProgress = 0.0; 
        this.materialUniforms.uBloomProgress.value = 0.0;
        this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
        this.lastTickTime = performance.now();
        this.updateOverlayContent(this.countdownValue.toString(), 'countdown');
    }

    dispose() {
        if (this.replayBtn) this.replayBtn.remove();
        if (this.planeMesh) {
            this.scene.remove(this.planeMesh);
            this.planeMesh.geometry.dispose();
            this.planeMesh.material.dispose();
        }
        if (this.materialUniforms) {
            if (this.materialUniforms.tBase.value) this.materialUniforms.tBase.value.dispose();
            if (this.materialUniforms.tBloom.value) this.materialUniforms.tBloom.value.dispose();
        }
        if (this.overlayMesh) {
            this.scene.remove(this.overlayMesh);
            this.overlayMesh.geometry.dispose();
            this.overlayMesh.material.dispose();
        }
        if (this.overlayTexture) this.overlayTexture.dispose();
    }
}