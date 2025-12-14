import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class LuckyDog3D {
    constructor(scene) {
        this.scene = scene;
        this.model = null;
        
        // 状态变量
        this.isWaving = false;
        this.waveTimer = 0; // 用于控制交互持续时间
        
        // 动画参数
        this.baseScale = new THREE.Vector3(1, 1, 1);
    }

    async init() {
        return new Promise((resolve, reject) => {
            const loader = new GLTFLoader();
            
            // ✅ Vite 静态资源引用标准写法
            const modelUrl = new URL('./dog.glb', import.meta.url).href;

            loader.load(modelUrl, (gltf) => {
                this.model = gltf.scene;

                // 1. 基础主要调整 (根据模型实际情况微调)
                this.model.scale.set(0.5, 0.5, 0.5); 
                this.model.position.set(0, -1.0, 0); // 沉到底部
                this.model.rotation.y = Math.PI / 6; // 稍微侧身

                // 2. 材质修正 (防止模型太暗)
                this.model.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                        // 如果模型自带材质太暗，可适当提升自发光
                        if(child.material) {
                            child.material.emissive = new THREE.Color(0x222222);
                        }
                    }
                });

                this.scene.add(this.model);
                console.log("🐶 LuckyDog 模型加载完毕");
                resolve();
            }, undefined, (err) => {
                console.error("模型加载失败", err);
                // 失败不阻断流程，放一个替代立方体方便调试
                this.createDebugMesh();
                resolve();
            });
        });
    }

    createDebugMesh() {
        const geo = new THREE.BoxGeometry(1, 1, 1);
        const mat = new THREE.MeshStandardMaterial({ color: 0xffaa00 });
        this.model = new THREE.Mesh(geo, mat);
        this.scene.add(this.model);
    }

    // 接收传感器数据
    setInteraction(gesture) {
        if (gesture.type === 'WAVE') {
            this.isWaving = true;
            this.waveTimer = 2.0; // 交互持续 2 秒
        }
    }

    /**
     * 核心渲染循环
     * @param {number} time - 累计时间 (clock.getElapsedTime())
     * @param {number} beat - 音频强度 (0.0 ~ 1.0)
     */
    update(time, beat) {
        if (!this.model) return;

        // --- 1. 待机逻辑：随音乐节拍 Q 弹 ---
        // beat 越大，y 轴拉伸越明显，x/z 轴收缩 (挤压感)
        const bounce = 1 + beat * 0.3; 
        const squash = 1 - beat * 0.15;
        
        // 使用 lerp 平滑过渡，防止跳变
        this.model.scale.y = THREE.MathUtils.lerp(this.model.scale.y, this.baseScale.y * bounce, 0.2);
        this.model.scale.x = THREE.MathUtils.lerp(this.model.scale.x, this.baseScale.x * squash, 0.2);
        this.model.scale.z = THREE.MathUtils.lerp(this.model.scale.z, this.baseScale.z * squash, 0.2);

        // --- 2. 交互逻辑：挥手带来的疯狂摇摆 ---
        if (this.waveTimer > 0) {
            this.waveTimer -= 0.016; // 扣除约一帧的时间
            
            // 疯狂左右摇摆 (Rotate Z)
            const shakeSpeed = 15;
            const shakeAmp = 0.3; // 摇摆幅度
            this.model.rotation.z = Math.sin(time * shakeSpeed) * shakeAmp;
            
            // 稍微跳起一点
            this.model.position.y = THREE.MathUtils.lerp(this.model.position.y, -0.5, 0.1);

        } else {
            // 恢复平静
            this.isWaving = false;
            this.model.rotation.z = THREE.MathUtils.lerp(this.model.rotation.z, 0, 0.1);
            this.model.position.y = THREE.MathUtils.lerp(this.model.position.y, -1.0, 0.1);
        }
    }
}