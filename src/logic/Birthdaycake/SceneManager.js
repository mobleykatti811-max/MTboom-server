import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// ✅ 核心修改：加上 ?v=new 强制浏览器重新加载这个文件，彻底清除旧缓存
import { BirthdayCakeScene } from './BirthdayCakeScene.js?v=new';

export class SceneManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.width = window.innerWidth;
        this.height = window.innerHeight;

        this.scene = new THREE.Scene();
        // 纯黑背景，为了配合辉光效果和突出蛋糕
        this.scene.background = new THREE.Color(0x000000); 

        // 正交相机设置：保证蛋糕看起来不会变形
        const aspect = this.width / this.height;
        const frustumSize = 10;
        this.camera = new THREE.OrthographicCamera(
            frustumSize * aspect / -2, frustumSize * aspect / 2,
            frustumSize / 2, frustumSize / -2,
            0.1, 1000
        );
        this.camera.position.set(0, 5, 10); // 俯视角度
        this.camera.lookAt(0, 0, 0);

        this._setupRenderer();
        
        // 实例化业务逻辑
        this.product = new BirthdayCakeScene(this.scene, this.camera, this.renderer);

        this._setupPostProcessing();
        
        // 绑定事件
        this._resizeHandler = this._onResize.bind(this);
        this._tapHandler = this._onTap.bind(this);
        window.addEventListener('resize', this._resizeHandler);
        window.addEventListener('pointerdown', this._tapHandler);
    }

    /**
     * 🟢 核心修改：增加 onBlowing 参数
     * 传声筒逻辑：将外部（main.js）的回调函数传递给内部 3D 场景模块。
     * @param {Object} giftData 数据包
     * @param {Function} onBlowing 吹气成功后的回调函数
     */
    async init(giftData, onBlowing) {
        console.log("🎂 SceneManager: 正在初始化场景模块...");
        if (this.product && this.product.init) {
            
            // 🟢 将回调函数连接到 BirthdayCakeScene 的信号槽上
            if (typeof onBlowing === 'function') {
                this.product.onBlowingSuccess = onBlowing;
            }

            await this.product.init(giftData);
        }
    }

    _onTap(event) {
        // 点击屏幕时的交互（例如重新点亮蜡烛）
        if (this.product && this.product.handleTap) {
            this.product.handleTap();
        }
    }

    render(gestureData, beatValue) {
        // 每一帧更新业务逻辑
        if (this.product) {
            this.product.update(gestureData, beatValue);
        }

        // 使用后期处理渲染（带发光效果）
        if (this.composer) {
            this.composer.render();
        } else {
            this.renderer.render(this.scene, this.camera);
        }
    }

    _setupRenderer() {
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: false, // 后期处理通常关闭自带抗锯齿，由 PostProcessing 处理
            powerPreference: 'high-performance',
            alpha: true
        });
        this.renderer.setSize(this.width, this.height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    }

    _setupPostProcessing() {
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.camera));

        // 辉光参数优化：实现选择性发光
        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(this.width, this.height),
            0.5,  // 🟢 最小修改 1：强度从 1.5 降至 0.5。防止照片由于亮度过高变成“白块”。
            0.1,  // 🟢 最小修改 2：半径从 0.4 降至 0.1。减小光晕扩散范围，确保烛火光晕不遮挡照片。
            0.9   // 🟢 最小修改 3：阈值从 0.85 升至 0.9。过滤掉照片中较亮的颜色，只允许最高亮的烛火触发辉光。
        );
        this.composer.addPass(bloomPass);
    }

    _onResize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        
        const aspect = this.width / this.height;
        const frustumSize = 10;
        
        this.camera.left = -frustumSize * aspect / 2;
        this.camera.right = frustumSize * aspect / 2;
        this.camera.top = frustumSize / 2;
        this.camera.bottom = -frustumSize / 2;
        
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.width, this.height);
        this.composer.setSize(this.width, this.height);
    }

    dispose() {
        window.removeEventListener('resize', this._resizeHandler);
        window.removeEventListener('pointerdown', this._tapHandler);
        
        if (this.product && this.product.dispose) {
            this.product.dispose();
        }
        
        this.renderer.dispose();
        this.composer.dispose();
    }
}