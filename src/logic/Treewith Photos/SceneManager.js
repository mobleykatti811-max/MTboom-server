import * as THREE from 'three';

// ✅ 引入路径保持不变
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
    
    // 🟢 新增引用：用于背景适配和 UI 销毁
    this.bgTexture = null;
    this.sliderContainer = null;

    // 🟢 修正初始化顺序：先设置渲染器和场景
    this._setupRenderer();
    this._setupScene(); 

    // 🟢 最小修改：将 Z 轴从 18 增加到 25，将 Y 轴从 3 降低到 2
    // Z 越大，树离镜头越远，看起来就越小；降低 Y 是为了配合远距离视角，防止树底悬空
    this.camera = new THREE.PerspectiveCamera(60, this.width / this.height, 0.1, 1000);
    this.camera.position.set(0, 2, 22); 

    // 🟢 最小修改：添加音频监听器和音乐对象
    this.listener = new THREE.AudioListener();
    this.camera.add(this.listener);
    this.bgMusic = new THREE.Audio(this.listener);

    this.tree = new TreeWithPhotos(this.scene);
    // ... 后续逻辑不变 ...
    this.composer = null;

    window.addEventListener('resize', this._onResize.bind(this));
  }

  // SceneManager.js
// SceneManager.js -> 替换整个 init 函数

  async init(giftData = null) {
    console.log('🎬 SceneManager: init...');
    
    // 1. 🟢 首先解析数据（拿到真实的 blessing 和 photos）
    let blessing = null;
    let photos = null;

    if (giftData && typeof giftData === 'object') {
      blessing = giftData.blessing;
      photos = giftData.photos;
    } else {
      blessing = giftData; 
    }
    
    // 2. 🟢 然后只初始化一次树木
    await this.tree.init(photos, blessing);
    
    // 3. 🟢 最后加载环境、后期、滑动条和祝福语 UI
    this._createEnvironment();
    this._setupPostProcessing();
    this._createDensitySlider();

    // 现在 blessing 已经有值了，UI 就能正常显示了
    if (blessing) {
        this._createBlessingUI(blessing);
    }
    // SceneManager.js -> init 方法末尾
    // 🟢 最小修改：加载并启动背景音乐
    const audioLoader = new THREE.AudioLoader();
    // 路径对应你的 public/assets/audio/ 目录
    audioLoader.load('/assets/audio/Merry%20Christmas%20Ident.mp3', (buffer) => {
        this.bgMusic.setBuffer(buffer);
        this.bgMusic.setLoop(true);     // 循环播放
        this.bgMusic.setVolume(0.4);    // 音量设为 0.4，避免盖过交互音效
        this.bgMusic.play();
        console.log("🎵 背景音乐已启动");
    });
  }

  render(gestureData, beatValue = 0) {
    const time = this.clock.getElapsedTime();
    const beat = Math.max(0, Math.min(1, beatValue || 0));

    if (this.tree) {
      this.tree.update(time, beat, gestureData);
    }

    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }

  // SceneManager.js -> dispose 方法
  dispose() {
      console.log("🧹 照片树资源清理中...");
      this._removeDensitySlider();

      // 🟢 最小修改：停止并卸载音乐
      if (this.bgMusic && this.bgMusic.isPlaying) {
          this.bgMusic.stop();
      }
      
      // 🟢 最小修改：清理祝福语 UI
      if (this.blessingUI) {
          this.blessingUI.remove();
          this.blessingUI = null;
      }

      this.renderer.dispose();
      if (this.composer) this.composer.dispose();
      window.removeEventListener('resize', this._onResize.bind(this));
  }

  // =========================
  // 基础设置 (保持原有逻辑)
  // =========================
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
    
    this.renderer.useLegacyLights = false;
    this.renderer.toneMapping = THREE.ReinhardToneMapping;
    this.renderer.toneMappingExposure = 1.2; 
  }

  _setupScene() {
    this.scene = new THREE.Scene();
    // 🟢 暖色雾气，配合室内背景
    this.scene.fog = new THREE.FogExp2(0x221100, 0.015);

    const loader = new THREE.TextureLoader();
    // 🟢 物理路径：public\assets\images\TreewithPhotos\GeminiBlue.jpg
    const imagePath = '/assets/images/TreewithPhotos/image.png';

    loader.load(imagePath, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        this.bgTexture = tex; 
        this.scene.background = tex;
        this.scene.backgroundIntensity = 0.4;

        // 🟢 执行背景占满全屏适配
        this._updateBackgroundAspect();
        console.log("✅ 背景图片适配完成");
    });
  }

  // 🌟 影棚级布光系统 (保持原有逻辑)
  _createEnvironment() {
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xffaa00, 1.0);
    dirLight.position.set(8, 15, 8);
    this.scene.add(dirLight);

    const topSpot = new THREE.SpotLight(0xffd700, 8.0); 
    topSpot.position.set(0, 25, 0); 
    topSpot.angle = 0.6; 
    topSpot.penumbra = 0.5; 
    topSpot.decay = 2;
    topSpot.distance = 50;
    topSpot.target.position.set(0, -5, 0); 
    this.scene.add(topSpot);
    this.scene.add(topSpot.target);

    const frontLight = new THREE.PointLight(0xffccaa, 2.0, 30);
    frontLight.position.set(0, 5, 12); 
    this.scene.add(frontLight);

    // 氛围尘埃
    const dustGeo = new THREE.BufferGeometry();
    const dustCount = 800;
    const pos = [];
    for(let i=0; i<dustCount; i++) {
        pos.push((Math.random()-0.5)*35, (Math.random()-0.5)*35, (Math.random()-0.5)*35);
    }
    dustGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const dustMat = new THREE.PointsMaterial({
        color: 0xffffff, size: 0.1, transparent: true, opacity: 0.4 
    });
    this.scene.add(new THREE.Points(dustGeo, dustMat));
  }

  _setupPostProcessing() {
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    
    const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(this.width, this.height), 1.2, 0.5, 0.75 
    );
    this.composer.addPass(bloomPass);
  }

  // =========================
  // 🟢 密度选择条 UI 逻辑
  // =========================
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
        // 🟢 只有照片树 tree 实例有 updateDensity 方法
        if (this.tree && typeof this.tree.updateDensity === 'function') {
            this.tree.updateDensity(factor);
        }
        // 同步背景条效果 (CSS 配合)
        slider.style.background = `linear-gradient(to right, #FFD700 0%, #FFD700 ${e.target.value}%, rgba(255,255,255,0.2) ${e.target.value}%, rgba(255,255,255,0.2) 100%)`;
    };
    slider.dispatchEvent(new Event('input'));
  }

  _removeDensitySlider() {
    if (this.sliderContainer) {
        this.sliderContainer.remove();
        this.sliderContainer = null;
    }
  }

  // =========================
  // 背景全屏拉伸逻辑 (引用自木鱼方案)
  // =========================
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

  // SceneManager.js -> 新增方法

_createBlessingUI(text) {
    if (document.getElementById('ar-blessing-display')) return;
    
    const div = document.createElement('div');
    div.id = 'ar-blessing-display';
    // 使用 span 包裹文字，方便你在 CSS 里设置竖排
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