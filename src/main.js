import { apiClient } from './logic/apiClient.js';

// ===================================
// 1. 全局配置与产品定义
// ===================================
const canvas = document.querySelector('#main-canvas');
const startBtn = document.querySelector('#start-btn');
const landingPage = document.querySelector('#landing-page');

// ✅ 新增：用于停止动画循环的 ID (解决卡顿的关键)
let animationFrameId = null;

// 为了解决 Vite 动态导入警告，使用静态映射表
const SCENE_MODULES = {
    'WoodenFish': {
        scene: () => import('./logic/WoodenFish/SceneManager.js'),
        tracker: () => import('./logic/WoodenFish/HandTracker.js')
    },
    'GoldenTree': {
        scene: () => import('./logic/GoldenTree/SceneManager.js'),
        tracker: () => import('./logic/GoldenTree/HandTracker.js')
    },
    'Diamond3D': {
        scene: () => import('./logic/Diamond3D/SceneManager.js'), 
        tracker: () => import('./logic/GoldenTree/HandTracker.js') // 暂时复用树的识别
    }
};

const PRODUCT_CONFIG = {
    WoodenFish: {
        key: 'WoodenFish',
        title: '🐹 功德指南',
        btnText: '开始积德',
        iconEmoji: '🐟',
        guides: [
            { icon: '👋', text: '上下挥手 → 敲击' },
            { icon: '🙏', text: '双手合十 → 爆发' }
        ]
    },
    GoldenTree: {
        key: 'GoldenTree',
        title: '🎄 许愿指南',
        btnText: '召唤金树',
        iconEmoji: '🎄',
        guides: [
            { icon: '✊', text: '握拳 → 变小' },
            { icon: '🖐️', text: '张开 → 变大/发光' }
        ]
    },
    Diamond3D: {
        key: 'Diamond3D',
        title: '💎 精灵宝钻',
        btnText: '唤醒宝石',
        iconEmoji: '💎',
        guides: [
            { icon: '🖐️', text: '挥手 → 钻石旋转' },
            { icon: '✊', text: '张开 → 化为太阳' }
        ]
    }
};

// 当前选中的产品 (默认木鱼)
let currentProductKey = 'WoodenFish';

// 核心实例
let sceneManager = null;
let handTracker = null;
let audioContext = null;
let analyser = null;
let dataArray = null;

// ===================================
// 2. 初始化与橱窗渲染
// ===================================

function initShowcase() {
    const showcaseContainer = document.getElementById('product-showcase');
    if (!showcaseContainer) return;

    // 清空现有内容
    showcaseContainer.innerHTML = '';

    // 遍历配置生成卡片
    Object.values(PRODUCT_CONFIG).forEach(product => {
        const card = document.createElement('div');
        card.className = `product-card ${product.key === currentProductKey ? 'active' : ''}`;
        card.dataset.key = product.key;
        card.onclick = () => selectProduct(product.key);

        card.innerHTML = `
            <div class="card-icon">${product.iconEmoji}</div>
            <p>${product.title.split(' ')[1]}</p> 
        `;
        showcaseContainer.appendChild(card);
    });

    // 绑定开始按钮
    if (startBtn) {
        // 移除旧监听器防止重复绑定 (虽然 init 只跑一次，但好习惯)
        startBtn.removeEventListener('click', onUserStart);
        startBtn.addEventListener('click', onUserStart);
        updateStartBtnText();
    }
}

// 切换产品逻辑
function selectProduct(key) {
    currentProductKey = key;

    // 1. 更新 UI 高亮
    document.querySelectorAll('.product-card').forEach(c => {
        c.classList.toggle('active', c.dataset.key === key);
    });

    // 2. 更新按钮文字
    updateStartBtnText();
}

function updateStartBtnText() {
    if (startBtn) {
        startBtn.textContent = PRODUCT_CONFIG[currentProductKey].btnText;
    }
}

// ===================================
// 3. 核心启动流程 (用户点击开始后)
// ===================================

async function onUserStart() {
    console.log(`🚀 用户启动: ${currentProductKey}`);
    
    // ✅ 安全检查：确保之前的循环已完全停止
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    
    // 1. 锁定并隐藏落地页
    startBtn.disabled = true;
    startBtn.textContent = "资源装载中...";
    
    // 2. 动态加载对应的 JS 模块
    const config = PRODUCT_CONFIG[currentProductKey];
    const moduleLoader = SCENE_MODULES[currentProductKey];

    try {
        // 并行加载 SceneManager 和 HandTracker
        const [SceneModule, TrackerModule] = await Promise.all([
            moduleLoader.scene(),
            moduleLoader.tracker()
        ]);

        console.log("📦 模块加载完成");

        // 3. 实例化
        // 注意：每次点击都重新实例化，保证状态是最新的
        sceneManager = new SceneModule.SceneManager(canvas);
        handTracker = new TrackerModule.HandTracker();
        sceneManager.init();

        // 4. UI 切换：隐藏落地页，显示 AR 界面
        landingPage.style.display = 'none';
        document.getElementById('view-ar').classList.add('active');
        document.getElementById('camera-box').style.display = 'block'; // 显示摄像头框

        // 更新右上角的指南
        updateGuideUI(config);

        // 5. 启动设备权限 (音频 & 摄像头)
        setupAudioSystem();
        await handTracker.init();

        // 6. 开始循环
        tick();

    } catch (err) {
        console.error("❌ 启动失败:", err);
        alert("加载失败: " + err.message);
        backToHome(); // 失败后尝试恢复到主页状态
    }

    // 连接后台 (静默)
    initBackendLogic();
}

// 更新 AR 界面右上角的指南
function updateGuideUI(config) {
    const titleEl = document.getElementById('guide-title');
    const listEl = document.getElementById('guide-list');

    if (titleEl) titleEl.textContent = config.title;
    if (listEl) {
        listEl.innerHTML = config.guides.map(item => `
            <div class="guide-item">
                <span class="tag gold">${item.icon}</span>
                <span class="text">${item.text}</span>
            </div>
        `).join('');
    }
}

// ===================================
// 4. 渲染循环 (已修复卡顿问题)
// ===================================
function tick() {
    // ✅ 记录 ID 以便取消
    animationFrameId = requestAnimationFrame(tick);
    
    if (handTracker && sceneManager) {
        const gesture = handTracker.detect();
        const beat = getAudioBeat();
        sceneManager.render(gesture, beat);
    }
}

// ===================================
// 5. 音频系统
// ===================================
function setupAudioSystem() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        // 如果旧的上下文还在，先关掉
        if (audioContext) {
            audioContext.close();
        }
        audioContext = new AudioContext();
        const audioEl = new Audio('https://cdn.pixabay.com/audio/2022/03/15/audio_73147d3467.mp3'); 
        audioEl.crossOrigin = "anonymous"; 
        audioEl.loop = true;
        
        // 尝试播放
        audioEl.play().catch(e => console.warn("需交互播放")); 
        
        const source = audioContext.createMediaElementSource(audioEl);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 64; 
        source.connect(analyser);
        analyser.connect(audioContext.destination);
        dataArray = new Uint8Array(analyser.frequencyBinCount);
    } catch (e) { console.warn("Audio Error:", e); }
}

function getAudioBeat() {
    if (!analyser) return 0;
    analyser.getByteFrequencyData(dataArray);
    return Math.min((dataArray[0] + dataArray[1] + dataArray[2]) / 600, 1.0);
}

// ===================================
// 6. 后台逻辑
// ===================================
async function initBackendLogic() {
    try {
        await apiClient.login("test_user_001", "VIP", "");
    } catch (err) { }
}

// ===================================
// 7. 返回主页逻辑 (修复卡顿的核心)
// ===================================
const homeBtn = document.getElementById('home-btn');

if (homeBtn) {
    homeBtn.addEventListener('click', backToHome);
}

function backToHome() {
    console.log("🏠 返回橱窗");

    // ✅ 1. 停止渲染循环 (刹车！)
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
        console.log("🛑 渲染循环已停止");
    }

    // ✅ 2. 停止摄像头视频流 (释放硬件)
    const video = document.getElementById('ar-camera-feed');
    if (video && video.srcObject) {
        const tracks = video.srcObject.getTracks();
        tracks.forEach(track => track.stop());
        video.srcObject = null;
    }

    // ✅ 3. 停止手势识别 & 清理内存
    if (handTracker) {
        // 如果你的 HandTracker 类里有 close()，记得调用 handTracker.close()
        handTracker = null; 
    }
    
    // ✅ 4. 清理 SceneManager (释放 WebGL 上下文)
    if (sceneManager) {
        // 如果 SceneManager 有 dispose()，记得调用 sceneManager.dispose()
        sceneManager = null; 
    }

    // ✅ 5. 关闭音频上下文
    if (audioContext) {
        audioContext.close().then(() => {
            audioContext = null;
        });
    }

    // 6. UI 切换：隐藏 AR，显示落地页
    document.getElementById('view-ar').classList.remove('active');
    document.getElementById('camera-box').style.display = 'none';
    landingPage.style.display = 'flex';

    // 7. 重置“开始体验”按钮状态
    if (startBtn) {
        startBtn.disabled = false;
        // 恢复成当前选中产品的按钮文案
        updateStartBtnText(); 
    }
}

// 🚀 程序入口
initShowcase();