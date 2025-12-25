import * as THREE from 'three';
// 引入具体的业务逻辑类
import { SydneyFireworksScene } from './SydneyFireworks.js';

import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

export class SceneManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.clock = new THREE.Clock();
    this.hintEl = null; // 🟢 用于记录提示元素

    // 1. 创建场景 - 使用纯黑背景
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000); 

    // 2. 创建相机
    this.camera = new THREE.PerspectiveCamera(60, this.width / this.height, 0.1, 1000);
    this.camera.position.set(0, 0, 18); 

    // 3. 初始化渲染器
    this._setupRenderer();

    // 4. 初始化具体的“产品”逻辑
    this.product = new SydneyFireworksScene(this.scene, this.camera, this.renderer);
    
    // 💡 [全屏自适应计算]
    // 根据相机参数精确计算 3D 平面尺寸，确保背景图完美撑满，不留黑边
    const fovRad = (this.camera.fov * Math.PI) / 180;
    const fitHeight = 2 * Math.tan(fovRad / 2) * this.camera.position.z;
    const fitWidth = fitHeight * (this.width / this.height);
    
    // 注入尺寸到产品实例
    this.product.viewHeight = fitHeight;
    this.product.viewWidth = fitWidth;

    // 5. 后期处理 (Bloom)
    this.composer = null;
    this._setupPostProcessing();

    // 🟢 [微调：极简提示] 初始化非阻塞悬浮胶囊提示
    this._addOrientationHint();

    window.addEventListener('resize', this._onResize.bind(this));
  }

  async init() {
    console.log('🌃 SydneySceneManager: 初始化...');
    if (this.product && this.product.init) {
        await this.product.init();
    }
  }

  render(gestureData, beatValue = 0) {
    if (this.product && this.product.update) {
      this.product.update(gestureData, beatValue);
    }

    if (this.composer) {
        this.composer.render();
    } else {
        this.renderer.render(this.scene, this.camera);
    }
  }

  dispose() {
    // 🟢 彻底移除提示元素
    if (this.hintEl) {
        this.hintEl.remove();
        this.hintEl = null;
    }

    this.renderer.dispose();
    if (this.composer) this.composer.dispose();
    if (this.product && this.product.dispose) {
        this.product.dispose();
    }
    window.removeEventListener('resize', this._onResize.bind(this));
  }

  // 🟢 [核心修改] 动态注入一个极小的、不挡画面的悬浮提示
  _addOrientationHint() {
    this.hintEl = document.createElement('div');
    this.hintEl.id = 'landscape-hint-pill';
    // pointer-events: none 确保用户点到提示也能穿透操作
    this.hintEl.style.cssText = `
        position: fixed; top: 80px; left: 50%; transform: translateX(-50%);
        z-index: 999999; pointer-events: none;
        display: flex; align-items: center; gap: 10px;
        padding: 8px 16px; border-radius: 20px;
        background: rgba(20, 20, 20, 0.7); border: 1px solid rgba(255, 215, 0, 0.4);
        color: #FFD700; font-family: sans-serif; box-shadow: 0 4px 12px rgba(0,0,0,0.5);
    `;

    this.hintEl.innerHTML = `
        <div style="font-size:18px; animation: pill-rotate 2.5s infinite linear;">🔄</div>
        <div style="font-size:13px; font-weight:bold; white-space:nowrap; letter-spacing:0.5px;">建议横屏体验</div>
        <style>
            @keyframes pill-rotate { from{transform:rotate(0)} to{transform:rotate(360deg)} }
            /* 横屏时自动隐藏 */
            @media (orientation: landscape) { #landscape-hint-pill { display: none !important; } }
        </style>
    `;
    document.body.appendChild(this.hintEl);
  }

  _setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: false, 
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.8; 
  }

  _setupPostProcessing() {
    this.composer = new EffectComposer(this.renderer);
    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);
    
    const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(this.width, this.height), 
        0.8, 0.5, 0.6
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