import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { LuckyCat3D } from './LuckyCat3D.js';

export class SceneManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.clock = new THREE.Clock();
        
        this.cats = []; 
        this.CAT_COUNT = 50; 
        
        // >>> 新增：缓存模型，用于后续动态生成 <<<
        this.loadedModel = null; 
        
        // ✅ [新增] 存储 UI 容器引用，以便销毁
        this.uiContainer = null;
    }

    async init() {
        const { width, height } = this.canvas.getBoundingClientRect();
        
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(0x000000, 0.02);

        this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        this.camera.position.z = 5;

        this.renderer = new THREE.WebGLRenderer({ 
            canvas: this.canvas, 
            alpha: true, 
            antialias: true 
        });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
        this.scene.add(ambientLight);
        const dirLight = new THREE.DirectionalLight(0xffd700, 2);
        dirLight.position.set(0, 10, 10);
        this.scene.add(dirLight);

        this.createWarmAtmosphere();

        await this.loadAndSpawnCats();

        // >>> 新增：创建控制面板 UI <<<
        this.createUI();

        window.addEventListener('resize', () => this.onWindowResize());
    }

    // ✅ [新增] 销毁方法：路由切换时调用
    dispose() {
        // 1. 移除 UI 面板 (通过 ID 强制查找，防止引用丢失)
        const existingUI = document.getElementById('lucky-cat-ui');
        if (existingUI) {
            existingUI.remove();
        }
        this.uiContainer = null;
        console.log("🗑️ LuckyCat UI 已移除");

        // 2. 清理 Three.js 资源
        if (this.renderer) {
            this.renderer.dispose();
            this.renderer.forceContextLoss(); // 强制释放 WebGL 上下文
            this.renderer.domElement = null;
            this.renderer = null;
        }
        
        // 3. 停止动画循环
        this.scene = null;
        this.camera = null;
    }

    // >>> 新增：创建控制面板 <<<
    createUI() {
        // ✅ [修改] 将 DOM 元素保存到 this.uiContainer
        this.uiContainer = document.createElement('div');
        const container = this.uiContainer; // 保持局部变量引用，下方代码无需改动

        // 【必须添加这一行】
        container.id = 'lucky-cat-ui';
        container.style.position = 'absolute';
        container.style.top = '10px';
        container.style.right = '10px';
        container.style.background = 'rgba(0, 0, 0, 0.5)';
        container.style.padding = '15px';
        container.style.borderRadius = '8px';
        container.style.color = 'white';
        container.style.fontFamily = 'sans-serif';
        container.style.zIndex = '9999';

        // 1. 数量控制
        const countDiv = document.createElement('div');
        countDiv.style.marginBottom = '10px';
        const countLabel = document.createElement('label');
        countLabel.innerText = `数量: ${this.CAT_COUNT} `;
        const countInput = document.createElement('input');
        countInput.type = 'range';
        countInput.min = '1';
        countInput.max = '200'; // 最大200只
        countInput.value = this.CAT_COUNT;
        
        countInput.oninput = (e) => {
            const val = parseInt(e.target.value);
            countLabel.innerText = `数量: ${val} `;
            this.updateCatCount(val);
        };
        countDiv.appendChild(countLabel);
        countDiv.appendChild(countInput);

        // 2. 大小控制
        const sizeDiv = document.createElement('div');
        const sizeLabel = document.createElement('label');
        sizeLabel.innerText = `大小: 2.0 `;
        const sizeInput = document.createElement('input');
        sizeInput.type = 'range';
        sizeInput.min = '0.5';
        sizeInput.max = '5.0';
        sizeInput.step = '0.1';
        sizeInput.value = '2.0';

        sizeInput.oninput = (e) => {
            const val = parseFloat(e.target.value);
            sizeLabel.innerText = `大小: ${val} `;
            this.updateCatSize(val);
        };
        sizeDiv.appendChild(sizeLabel);
        sizeDiv.appendChild(sizeInput);

        container.appendChild(countDiv);
        container.appendChild(sizeDiv);
        // 改用 canvas 的父元素，这样它会随着 AR 视图一起被隐藏/移除
        if (this.canvas.parentElement) {
        this.canvas.parentElement.appendChild(container);
    }    
}

    // >>> 新增：动态调整猫咪数量 <<<
    updateCatCount(newCount) {
        if (!this.loadedModel) return;

        const currentCount = this.cats.length;

        if (newCount > currentCount) {
            // 加猫
            const addCount = newCount - currentCount;
            for (let i = 0; i < addCount; i++) {
                const id = currentCount + i;
                const cat = new LuckyCat3D(this.scene, id);
                const modelClone = this.loadedModel.clone();
                cat.setup(modelClone);
                
                // 确保新猫继承当前的大小设置 (如果在调整大小后又加猫)
                if (this.cats.length > 0) {
                    cat.setScale(this.cats[0].baseScaleValue);
                }
                
                this.cats.push(cat);
            }
        } else if (newCount < currentCount) {
            // 减猫
            const removeCount = currentCount - newCount;
            for (let i = 0; i < removeCount; i++) {
                const cat = this.cats.pop(); // 移除数组最后一个
                if (cat && cat.model) {
                    this.scene.remove(cat.model); // 从场景移除
                    // 清理光波
                    cat.waves.forEach(w => this.scene.remove(w));
                }
            }
        }
    }

    // >>> 新增：动态调整猫咪大小 <<<
    updateCatSize(newSize) {
        this.cats.forEach(cat => {
            cat.setScale(newSize);
        });
    }

    async loadAndSpawnCats() {
        const loader = new GLTFLoader();
        const modelUrl = new URL('./mao.glb', import.meta.url).href;

        return new Promise((resolve, reject) => {
            loader.load(modelUrl, (gltf) => {
                // >>> 修改：保存 Model 到全局，方便后续克隆 <<<
                this.loadedModel = gltf.scene;

                console.log(`🚀 开始生成 ${this.CAT_COUNT} 只招财猫...`);

                for (let i = 0; i < this.CAT_COUNT; i++) {
                    const cat = new LuckyCat3D(this.scene, i);
                    const modelClone = this.loadedModel.clone();
                    cat.setup(modelClone);
                    this.cats.push(cat);
                }
                
                resolve();
            }, undefined, reject);
        });
    }

    createWarmAtmosphere() {
        const geometry = new THREE.SphereGeometry(60, 32, 32);
        const material = new THREE.MeshBasicMaterial({
            color: 0xFFaa33,
            side: THREE.BackSide,
            transparent: true,
            opacity: 0.15,
            depthWrite: false
        });
        const sphere = new THREE.Mesh(geometry, material);
        this.scene.add(sphere);
    }

    render(data, beat) {
        if (!this.renderer) return;
        const time = this.clock.getElapsedTime();

        this.cats.forEach(cat => {
            cat.update(data, time, beat);
        });

        this.renderer.render(this.scene, this.camera);
    }

    onWindowResize() {
        if (!this.camera || !this.renderer) return;
        const { width, height } = this.canvas.parentElement.getBoundingClientRect();
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }
}