import { apiClient } from './logic/apiClient.js';
import { SceneManager } from './logic/SceneManager.js';
import { HandTracker } from './logic/HandTracker.js';

// ===================================
// 1. 全局变量与配置
// ===================================
const canvas = document.querySelector('#main-canvas');
const startBtn = document.querySelector('#start-btn');

// 实例化核心模块
// 注意：如果你的文件名是大写 Tree3D.js，SceneManager 内部必须引用正确
const sceneManager = new SceneManager(canvas);
const handTracker = new HandTracker();

// 音频分析器
let audioContext = null;
let analyser = null;
let dataArray = null;

// ===================================
// 2. 核心启动流程
// ===================================

async function main() {
    console.log('🎬 导演: 正在初始化场景...');
    
    // 2.1 启动 3D 舞台 (不管有没有网，先画出来)
    sceneManager.init();

    // 🔴 关键修复：先激活按钮！
    if (startBtn) {
        console.log('✅ 按钮已就绪，等待点击...');
        startBtn.addEventListener('click', onUserStart);
    } else {
        console.error("❌ 找不到按钮，请检查 index.html 里有没有 id='start-btn'");
    }

    // 2.2 后台业务连接 (不加 await，让它在后台默默跑，别卡住界面)
    initBackendLogic(); 
}

// 用户点击"开启"后的逻辑
async function onUserStart() {
    console.log("👆 用户点击了开始按钮");
    if (startBtn) startBtn.style.display = 'none';

    // A. 启动 AI 眼睛
    console.log('👁️ 启动视觉识别...');
    await handTracker.init();

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
    const gesture = handTracker.detect();
    const beat = getAudioBeat();
    sceneManager.render(gesture, beat);
}

// ===================================
// 4. 音频系统
// ===================================
function setupAudioSystem() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioContext = new AudioContext();
        
        // 使用在线音频测试
        const audioEl = new Audio('https://cdn.pixabay.com/audio/2022/03/15/audio_73147d3467.mp3'); 
        audioEl.crossOrigin = "anonymous";
        audioEl.loop = true;
        // 必须在用户点击后调用 play
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
// 5. 业务逻辑区 (即使这里报错，也不影响 3D)
// ===================================
async function initBackendLogic() {
    console.log('📡 [后台] 正在尝试连接业务层...');
    try {
        const myOpenId = "rich_kid_unsw_001";
        // 这里会调用我们刚修好的 Mock 接口，绝对不会报错
        const loginRes = await apiClient.login(myOpenId, "淄博首富", "");
        console.log('✅ [后台] 登录成功:', loginRes);
    } catch (err) {
        console.warn('⚠️ [后台] 离线模式:', err);
    }
}

// 启动主程序
main();