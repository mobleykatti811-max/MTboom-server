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

    this.scene = new THREE.Scene();
    
    // 增加一点场景雾化，让远处的星星有深邃感，不至于死黑
    this.scene.fog = new THREE.FogExp2(0x000000, 0.02);

    this.camera = new THREE.PerspectiveCamera(60, this.width / this.height, 0.1, 1000);
    this.camera.position.set(0, 3, 18); 

    this._setupRenderer();

    this.tree = new TreeWithPhotos(this.scene);
    this.composer = null;

    window.addEventListener('resize', this._onResize.bind(this));
  }

  async init() {
    console.log('🎬 SceneManager: init...');
    
    await this.tree.init();
    
    // 优化后的灯光系统
    this._createEnvironment();
    this._setupPostProcessing();
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

  dispose() {
    this.renderer.dispose();
    if (this.composer) this.composer.dispose();
  }

  // =========================
  // 基础设置
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
    
    // 开启物理光照计算
    this.renderer.useLegacyLights = false;
    // 色调映射，防止高光过曝，让亮部细节更柔和
    this.renderer.toneMapping = THREE.ReinhardToneMapping;
    this.renderer.toneMappingExposure = 1.2; // 整体曝光度提升
  }

  // 🌟 核心优化：影棚级布光系统 🌟
  _createEnvironment() {
    // 1. 基础环境光：稍微调亮，色调偏暖白，防止阴影死黑
    const ambient = new THREE.AmbientLight(0xfff0dd, 0.6);
    this.scene.add(ambient);

    // 2. 主光源 (Sun)：模拟侧上方阳光，负责产生立体阴影
    const dirLight = new THREE.DirectionalLight(0xffaa00, 1.0);
    dirLight.position.set(8, 15, 8);
    this.scene.add(dirLight);

    // 3. 【新增】顶部聚光灯 (Top Spotlight) - 你的建议
    // 作用：从正上方打下来，照亮树的每一层，让球体顶部产生漂亮的高光
    const topSpot = new THREE.SpotLight(0xffd700, 8.0); // 强度给高点
    topSpot.position.set(0, 25, 0); // 很高的地方
    topSpot.angle = 0.6; // 光锥角度
    topSpot.penumbra = 0.5; // 边缘柔和
    topSpot.decay = 2;
    topSpot.distance = 50;
    topSpot.target.position.set(0, -5, 0); // 指向树底
    this.scene.add(topSpot);
    this.scene.add(topSpot.target);

    // 4. 【新增】正面补光 (Fill Light)
    // 作用：因为金属材质反射环境，如果正面是黑的，球就是黑的。
    // 加一个正面光源，让球体正脸有光泽，瞬间提亮画面。
    const frontLight = new THREE.PointLight(0xffccaa, 2.0, 30);
    frontLight.position.set(0, 5, 12); // 摄像机附近
    this.scene.add(frontLight);

    // 5. 氛围尘埃 (保持不变)
    const dustGeo = new THREE.BufferGeometry();
    const dustCount = 800;
    const pos = [];
    for(let i=0; i<dustCount; i++) {
        pos.push(
            (Math.random()-0.5)*35,
            (Math.random()-0.5)*35,
            (Math.random()-0.5)*35
        );
    }
    dustGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const dustMat = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.1,
        transparent: true,
        opacity: 0.4 // 稍微降低不透明度，不要抢戏
    });
    this.scene.add(new THREE.Points(dustGeo, dustMat));
  }

  _setupPostProcessing() {
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    
    // 光晕参数微调
    const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(this.width, this.height), 
        1.2,  // 强度 Strength
        0.5,  // 半径 Radius (稍微扩散一点)
        0.75  // 阈值 Threshold (降低阈值，让更多亮部产生辉光)
    );
    this.composer.addPass(bloomPass);
  }

  _onResize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height);
    if(this.composer) this.composer.setSize(this.width, this.height);
  }
}