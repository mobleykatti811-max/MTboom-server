import * as THREE from 'three';
// ✅ 引用更名后的核心演员类
import { CrazyCrit3D } from './CrazyCrit3D.js';

export class SceneManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.clock = new THREE.Clock();
        
        // 我们的主角：鬼畜战神
        this.actor = null;
    }

    init() {
        // 1. 创建场景
        this.scene = new THREE.Scene();

        // 2. 创建相机
        // 使用透视相机，Z轴拉远一点(6)，让画面能容纳下疯狂放大的特效
        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 100);
        this.camera.position.z = 6;

        // 3. 创建渲染器
        this.renderer = new THREE.WebGLRenderer({ 
            canvas: this.canvas, 
            antialias: false, // ❌ 关闭抗锯齿，追求复古页游的锯齿感
            alpha: true       // ✅ 开启透明，以便我们可以用 CSS 控制背景色
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        // 4. 灯光系统 (虽然 Sprite 不受光照影响，但为了以后扩展粒子效果先加上)
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
        this.scene.add(ambientLight);

        // 5. 实例化演员
        this.actor = new CrazyCrit3D(this.scene);
        
        // 监听窗口大小变化
        window.addEventListener('resize', () => this.onResize());

        // 初始化演员 (生成像素贴图等)
        return this.actor.init();
    }

    render(gesture, beat) {
        if (!this.actor || !this.renderer) return;
        
        const time = this.clock.getElapsedTime();

        // 1. 调度演员表演
        // 将手势信号传给演员，如果检测到 WAVE，演员内部会开启 isCrazy 状态
        this.actor.setInteraction(gesture);
        this.actor.update(time, beat);

        // 2. 背景光污染逻辑 (氛围组)
        // 检测演员是否处于“疯狗模式”
        if (this.actor.isCrazy) {
            // 极高频闪烁：利用时间戳毫秒级变化
            const flash = Math.sin(Date.now() * 0.05) > 0;
            // 直接操作 canvas 样式，红黑交替，模拟警告闪光
            this.canvas.style.backgroundColor = flash ? '#550000' : '#000000';
        } else {
            // 待机状态：保持透明，显示网页原本的背景
            this.canvas.style.backgroundColor = 'transparent';
        }

        // 3. 渲染画面
        this.renderer.render(this.scene, this.camera);
    }

    onResize() {
        if (!this.camera || !this.renderer) return;
        
        const width = window.innerWidth;
        const height = window.innerHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }
    
    // 销毁资源 (用于切回主页时清理)
    dispose() {
        if (this.renderer) {
            this.renderer.dispose();
        }
        // 恢复背景色
        this.canvas.style.backgroundColor = 'transparent';
        window.removeEventListener('resize', () => this.onResize());
    }
}