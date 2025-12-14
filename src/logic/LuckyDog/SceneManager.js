import * as THREE from 'three';
import { LuckyDog3D } from './LuckyDog3D.js';

export class SceneManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.clock = new THREE.Clock();
        
        // 核心演员
        this.dog = null;
    }

    init() {
        // 1. 场景配置 (透明背景用于 AR)
        this.scene = new THREE.Scene();
        
        // 2. 相机配置
        const aspect = this.canvas.clientWidth / this.canvas.clientHeight;
        this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 100);
        this.camera.position.set(0, 0, 3); // 往后拉一点，看清全貌

        // 3. 渲染器配置
        this.renderer = new THREE.WebGLRenderer({ 
            canvas: this.canvas, 
            alpha: true, 
            antialias: true 
        });
        this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        // 4. 灯光系统 (暖光)
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffeebb, 1.2);
        dirLight.position.set(2, 5, 5);
        this.scene.add(dirLight);

        // 5. 实例化主角
        this.dog = new LuckyDog3D(this.scene);
        
        // 窗口自适应
        window.addEventListener('resize', () => this.onWindowResize());

        // 异步加载资源
        return this.dog.init();
    }

    render(gesture, beat) {
        if (!this.renderer || !this.dog) return;

        const time = this.clock.getElapsedTime();

        // 导演指挥演员：
        // 1. 告诉狗现在用户做了什么手势
        this.dog.setInteraction(gesture);
        // 2. 告诉狗现在的音乐节奏，让它自己动
        this.dog.update(time, beat);

        this.renderer.render(this.scene, this.camera);
    }

    onWindowResize() {
        if (!this.camera || !this.renderer) return;
        const width = this.canvas.parentElement.clientWidth;
        const height = this.canvas.parentElement.clientHeight;
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }
    
    // 清理内存
    dispose() {
        this.renderer.dispose();
    }
}