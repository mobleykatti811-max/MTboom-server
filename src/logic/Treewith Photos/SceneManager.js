import * as THREE from 'three';
import { TreeWithPhotos } from './Treewithphotos.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

export class SceneManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.clock = new THREE.Clock();
    
    this.bgTexture = null;
    this.sliderContainer = null;
    this.blessingUI = null;
    this.dustPoints = null; // 🟢 记录尘埃引用以便销毁

    this._setupRenderer();
    this._setupScene(); 

    // 🟢 视角微调：FOV 设为 60 保持自然透视
    this.camera = new THREE.PerspectiveCamera(60, this.width / this.height, 0.1, 1000);
    this.camera.position.set(0, 2, 22); 

    this.tree = new TreeWithPhotos(this.scene);
    this.composer = null;

    window.addEventListener('resize', this._onResize.bind(this));
  }

  async init(giftData = null) {
    console.log('🎬 PhotoTree Scene: 启动资源加载...');
    
    // 1. 数据解析安全化
    let blessing = "";
    let photos = [];

    if (giftData && typeof giftData === 'object') {
      blessing = giftData.blessing || "";
      photos = giftData.photos || [];
    } else {
      blessing = giftData || ""; 
    }
    
    // 2. 初始化核心 3D 对象
    await this.tree.init(photos, blessing);
    
    // 3. 构建环境与 UI
    this._createEnvironment();
    this._setupPostProcessing();
    this._createDensitySlider();

    if (blessing) {
        this._createBlessingUI(blessing);
    }
  }

  render(gestureData, beatValue = 0) {
    const time = this.clock.getElapsedTime();
    const beat = Math.max(0, Math.min(1, beatValue || 0));

    // 🟢 让尘埃随时间轻微漂浮
    if (this.dustPoints) {
        this.dustPoints.rotation.y = time * 0.05;
        this.dustPoints.position.y = Math.sin(time * 0.5) * 0.2;
    }

    if (this.tree) {
      this.tree.update(time, beat, gestureData);
    }

    if (this.composer) {
        this.composer.render();
    } else {
        this.renderer.render(this.scene, this.camera);
    }
  }

  dispose() {
      console.log("🧹 正在卸载照片树场景...");
      this._removeDensitySlider();
      
      if (this.blessingUI) {
          this.blessingUI.remove();
          this.blessingUI = null;
      }

      // 🟢 深度清理灯光与几何体
      this.scene.traverse((obj) => {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) {
              if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
              else obj.material.dispose();
          }
      });

      if (this.bgTexture) this.bgTexture.dispose();
      this.renderer.dispose();
      if (this.composer) this.composer.dispose();
      
      window.removeEventListener('resize', this._onResize.bind(this));
  }

  _setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true, 
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0); 
    
    // 🟢 现代渲染配置
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; // 更自然的电影感映射
    this.renderer.toneMappingExposure = 1.0; 
  }

  _setupScene() {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x0a0a0a, 0.012); // 减淡雾气，保持照片清晰

    const loader = new THREE.TextureLoader();
    const imagePath = '/assets/images/TreewithPhotos/image.png';

    loader.load(imagePath, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        this.bgTexture = tex; 
        this.scene.background = tex;
        this.scene.backgroundIntensity = 0.35; // 稍微压暗背景，突出发光树

        this._updateBackgroundAspect();
    });
  }

  _createEnvironment() {
    // 基础环境光
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.8));

    // 侧逆光：勾勒树木轮廓
    const rimLight = new THREE.DirectionalLight(0xffaa00, 1.2);
    rimLight.position.set(10, 10, -10);
    this.scene.add(rimLight);

    // 主位舞台灯：向下照射树中心
    const topSpot = new THREE.SpotLight(0xffd700, 15); 
    topSpot.position.set(0, 20, 5); 
    topSpot.angle = 0.5; 
    topSpot.penumbra = 0.8; 
    topSpot.decay = 1.5;
    topSpot.distance = 60;
    this.scene.add(topSpot);
    this.scene.add(topSpot.target);

    // 🟢 氛围尘埃系统优化
    const dustGeo = new THREE.BufferGeometry();
    const pos = new Float32Array(800 * 3);
    for(let i=0; i<800*3; i++) pos[i] = (Math.random()-0.5)*40;
    dustGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    
    const dustMat = new THREE.PointsMaterial({
        color: 0xffd700, 
        size: 0.08, 
        transparent: true, 
        opacity: 0.3,
        blending: THREE.AdditiveBlending // 让尘埃有发光感
    });
    this.dustPoints = new THREE.Points(dustGeo, dustMat);
    this.scene.add(this.dustPoints);
  }

  _setupPostProcessing() {
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    
    // 🟢 Bloom 调优：更柔和的梦幻感
    const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(this.width, this.height), 
        0.8,  // Strength: 0.8 (原1.2过强)
        0.4,  // Radius: 0.4
        0.6   // Threshold: 0.6 (防止背景乱亮)
    );
    this.composer.addPass(bloomPass);
  }

  _createDensitySlider() {
    if (document.getElementById('density-slider-container')) return;

    const container = document.createElement('div');
    container.id = 'density-slider-container';
    container.innerHTML = `
        <div class="slider-label">✨ 星光密度 ✨</div>
        <input type="range" id="density-slider" min="10" max="100" value="50">
    `;
    document.body.appendChild(container);
    this.sliderContainer = container;

    const slider = document.getElementById('density-slider');
    slider.oninput = (e) => {
        const factor = e.target.value / 100;
        if (this.tree && typeof this.tree.updateDensity === 'function') {
            this.tree.updateDensity(factor);
        }
        // 动态进度条背景
        const val = e.target.value;
        slider.style.background = `linear-gradient(to right, #FFD700 ${val}%, rgba(255,255,255,0.1) ${val}%)`;
    };
    slider.dispatchEvent(new Event('input'));
  }

  _removeDensitySlider() {
    if (this.sliderContainer) {
        this.sliderContainer.remove();
        this.sliderContainer = null;
    }
  }

  _updateBackgroundAspect() {
      if (!this.bgTexture || !this.bgTexture.image) return;

      const canvasAspect = this.width / this.height;
      const imageAspect = this.bgTexture.image.width / this.bgTexture.image.height;

      this.bgTexture.matrixAutoUpdate = false;
      if (canvasAspect > imageAspect) {
          const scale = imageAspect / canvasAspect;
          this.bgTexture.matrix.setUvTransform(0, 0, 1, scale, 0, 0.5, 0.5);
      } else {
          const scale = canvasAspect / imageAspect;
          this.bgTexture.matrix.setUvTransform(0, 0, scale, 1, 0, 0.5, 0.5);
      }
  }

  _createBlessingUI(text) {
    if (document.getElementById('ar-blessing-display')) return;
    
    const div = document.createElement('div');
    div.id = 'ar-blessing-display';
    div.innerHTML = `<span>${text}</span>`;
    document.body.appendChild(div);
    this.blessingUI = div;
  }

  _onResize() {
      this.width = window.innerWidth;
      this.height = window.innerHeight;
      this.camera.aspect = this.width / this.height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(this.width, this.height);
      
      this._updateBackgroundAspect();
      if (this.composer) this.composer.setSize(this.width, this.height);
  }
}