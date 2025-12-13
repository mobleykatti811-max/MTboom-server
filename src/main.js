import { apiClient } from './logic/apiClient.js';

// ===================================
// 1. 全局配置与产品定义 (路由表)
// ===================================
const canvas = document.querySelector('#main-canvas');
const startBtn = document.querySelector('#start-btn');

// 定义所有支持的产品类型、对应的文件夹路径、以及前端显示的文案
const PRODUCT_CONFIG = {
    // 1. 木鱼模式 (默认) -> 对应 index.html?type=WoodenFish
    WoodenFish: {
        modulePath: './logic/WoodenFish', 
        title: '🐹 功德指南',
        guides: [
            { icon: '👋', text: '上下挥手 → 敲击木鱼' },
            { icon: '🙏', text: '双手合十 → 功德无量' }
        ]
    },
    // 2. 圣诞树模式 -> 对应 index.html?type=GoldenTree
    GoldenTree: {
        modulePath: './logic/GoldenTree',
        title: '🎄 许愿指南',
        guides: [
            { icon: '✊', text: '张握 → 改变大小' },
            { icon: '✨', text: '比心 → 神秘效果' }
        ]
    },
    // 3. 豪车模式 -> 对应 index.html?type=Diamond3D
    Diamond3D: {
        modulePath: './logic/Diamond3D', // 假设豪车逻辑在这里
        title: '🏎️ 精灵宝钻',
        guides: [
            { icon: '🖐️', text: '挥手 → 钻石旋转' },
            { icon: '✊', text: '张开 → 钻石化为太阳' }
        ]
    }
};

// 核心实例容器 (等待动态加载)
let sceneManager = null;
let handTracker = null;

// 音频分析器
let audioContext = null;
let analyser = null;
let dataArray = null;

// ===================================
// 2. 核心启动流程
// ===================================

async function main() {
    console.log('🎬 导演: 正在解析剧本...');

    // 2.1 获取 URL 参数，确定加载哪个产品
    const urlParams = new URLSearchParams(window.location.search);
    // 如果没传参数，默认加载 'WoodenFish' (木鱼)
    const productType = urlParams.get('type') || 'WoodenFish'; 
    
    // 检查配置是否存在，不存在则回退到 'WoodenFish'
    const config = PRODUCT_CONFIG[productType] || PRODUCT_CONFIG['WoodenFish'];
    console.log(`📦 当前加载产品: [${config.title}]`);

    // 2.2 动态更新 UI 文案
    updateGuideUI(config);

    // 2.3 动态加载对应的 JS 模块 (关键步骤！)
    try {
        // 动态 import 对应的 SceneManager 和 HandTracker
        // 假设每个文件夹下都有标准的 SceneManager.js 和 HandTracker.js
        const SceneModule = await import(`${config.modulePath}/SceneManager.js`);
        const TrackerModule = await import(`${config.modulePath}/HandTracker.js`);

        // 实例化
        sceneManager = new SceneModule.SceneManager(canvas);
        handTracker = new TrackerModule.HandTracker();
        
        // 初始化 3D 舞台
        sceneManager.init();
        
    } catch (err) {
        console.error(`❌ 模块加载失败! 请检查 ${config.modulePath} 下是否有对应文件`, err);
        alert("加载失败，请检查控制台");
        return;
    }

    // 2.4 激活按钮
    if (startBtn) {
        console.log('✅ 按钮已就绪，等待点击...');
        startBtn.addEventListener('click', onUserStart);
    }

    // 2.5 后台业务连接
    initBackendLogic(); 
}

// 辅助函数：更新界面上的文字
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

// 用户点击"开启"后的逻辑
async function onUserStart() {
    console.log("👆 用户点击了开始按钮");
    if (startBtn) startBtn.style.display = 'none';

    // A. 启动 AI 眼睛
    console.log('👁️ 启动视觉识别...');
    if (handTracker) await handTracker.init();

    // B. 启动音频分析
    setupAudioSystem();

    // C. 开始渲染循环
    console.log('🚀 引擎点火，Loop 开始!');
    tick();
}

// ===================================
// 3. 渲染循环
// ===================================
function tick() {
    requestAnimationFrame(tick);
    
    // 防御性编程：确保模块加载完了才运行
    if (handTracker && sceneManager) {
        const gesture = handTracker.detect();
        const beat = getAudioBeat();
        sceneManager.render(gesture, beat);
    }
}

// ===================================
// 4. 音频系统 (保持不变)
// ===================================
function setupAudioSystem() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioContext = new AudioContext();
        
        // 示例音频
        const audioEl = new Audio('https://cdn.pixabay.com/audio/2022/03/15/audio_73147d3467.mp3'); 
        audioEl.crossOrigin = "anonymous";
        audioEl.loop = true;
        audioEl.play().catch(e => console.warn("音频播放受阻:", e));

        const source = audioContext.createMediaElementSource(audioEl);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 64; 
        source.connect(analyser);
        analyser.connect(audioContext.destination);
        dataArray = new Uint8Array(analyser.frequencyBinCount);
    } catch (e) {
        console.warn("音频系统启动异常:", e);
    }
}

function getAudioBeat() {
    if (!analyser) return 0;
    analyser.getByteFrequencyData(dataArray);
    const bass = (dataArray[0] + dataArray[1] + dataArray[2]) / 3;
    return Math.min(bass / 200, 1.0); 
}

// ===================================
// 5. 业务逻辑区
// ===================================
async function initBackendLogic() {
    console.log('📡 [后台] 正在尝试连接业务层...');
    try {
        const myOpenId = "rich_kid_unsw_001";
        const loginRes = await apiClient.login(myOpenId, "VIP用户", "");
        console.log('✅ [后台] 登录成功:', loginRes);
    } catch (err) {
        console.warn('⚠️ [后台] 离线模式:', err);
    }
}

// 启动主程序
main();