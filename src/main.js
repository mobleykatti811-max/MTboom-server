let uploadedPhotos = []; // 存储压缩后的 Base64 数组
let currentSceneBgm = null; // 🟢 [新增] 全局单例：当前场景的 BGM 对象
import { apiClient } from './logic/apiClient.js';
import { CameraManager } from './logic/CameraManager.js'; // 🟢 新增引入

// main.js 顶部
window.addEventListener('click', () => {
    const landingAudio = document.getElementById('bgm-landing');
    if (landingAudio && landingAudio.paused) {
        landingAudio.volume = 0.5;
        landingAudio.play();
    }
}, { once: true }); // 只触发一次

// ===================================
// 1. 全局变量与配置
// ===================================
const startBtn = document.querySelector('#start-btn');
const landingPage = document.querySelector('#landing-page');
const homeBtn = document.getElementById('home-btn'); // 移到顶部定义

// 动画循环 ID
let animationFrameId = null;

// 模块映射
const SCENE_MODULES = {
    'SydneyFireworks': {
        scene: () => import('./logic/SydneyFireworks/SceneManager.js'),
        tracker: () => import('./logic/SydneyFireworks/HandTracker.js')
    },
    'Birthdaycake': { 
        scene: () => import('./logic/Birthdaycake/SceneManager.js'), 
        tracker: () => import('./logic/Birthdaycake/HandTracker.js') 
    },
    'WoodenFish': { scene: () => import('./logic/WoodenFish/SceneManager.js'), tracker: () => import('./logic/WoodenFish/HandTracker.js') },
    'GoldenTree': { scene: () => import('./logic/GoldenTree/SceneManager.js'), tracker: () => import('./logic/GoldenTree/HandTracker.js') },
    'Diamond3D':  { scene: () => import('./logic/Diamond3D/SceneManager.js'),  tracker: () => import('./logic/GoldenTree/HandTracker.js') },
    'LuckyCat':   { scene: () => import('./logic/LuckyCat/SceneManager.js'),   tracker: () => import('./logic/LuckyCat/HandTracker.js') },
    'LuckyDog':   { scene: () => import('./logic/LuckyDog/SceneManager.js'),   tracker: () => import('./logic/LuckyDog/HandTracker.js') },
    'CrazyCrit':  { scene: () => import('./logic/CrazyCrit/SceneManager.js'),  tracker: () => import('./logic/CrazyCrit/HandTracker.js') },
    'PhotoTree':  { scene: () => import('./logic/Treewith Photos/SceneManager.js'), tracker: () => import('./logic/Treewith Photos/HandTracker.js') }
};

// 1. 修改配置：注入下沉市场暴富逻辑
const PRODUCT_CONFIG = {
    // ✅ 新增 PhotoTree 配置
    PhotoTree: { 
        key: 'PhotoTree', 
        type: 'CUSTOM',       // 设定为付费产品
        price: 0,             // 价格
        title: '📸 圣诞照片墙', 
        btnText: '点亮回忆', 
        iconEmoji: '📸', 
        badge: '✨ 节日',      // B. 适配文件1的角标逻辑
        badgeClass: 'premium', // 🟢 样式类名
        bgm: '/assets/audio/Merry Christmas Ident.mp3', 
        bgStyle: 'radial-gradient(circle, #09121d 0%, #000000 100%)',
        guides: [
            { icon: '👋', text: '挥手 → 旋转浏览' }, 
            { icon: '✊', text: '握拳 → 放大查看' }
        ] 
    },
    GoldenTree: { 
        key: 'GoldenTree', 
        type: 'CUSTOM', 
        price: 9.9, 
        title: '🎄 许愿指南', 
        btnText: '召唤金树', 
        iconEmoji: '🎄', 
        badge: '🎁 送礼', 
        badgeClass: 'premium', 
        guides: [{ icon: '❤', text: '比心 → 爱的祝福' },{ icon: '✊', text: '握拳 → 变小' }, { icon: '🖐️', text: '张开 → 变大' }] 
    },
    SydneyFireworks: {
        key: 'SydneyFireworks',
        type: 'FREE',          // 设定为免费或圣诞限免
        price: 0,
        title: '🎆 悉尼烟花',
        btnText: '点亮夜空',
        iconEmoji: '🎆',
        badge: '✨ 2026',      // 角标
        badgeClass: 'hot',     // 样式类名
        bgm: '/assets/audio/fireworks_vibe.mp3', // 确保路径下有此音频
        bgStyle: 'radial-gradient(circle, #000033 0%, #000000 100%)', // 深蓝夜色背景
        guides: [
            { icon: '👆', text: '伸出 3, 2, 1 倒计时' },
            { icon: '🖐️', text: '手势触发 → 绚丽绽放' }
        ]
    },
    Birthdaycake: { 
        key: 'Birthdaycake', 
        type: 'CUSTOM', 
        price: 9.9, 
        title: '🎂 许愿蛋糕', 
        btnText: '制作祝福', 
        iconEmoji: '🎂', 
        badge: '✨ 新品', 
        badgeClass: 'hot', 
        // 💡 通用化配置
        bgm: null, // 初始化时不播放
        eventAudio: '/assets/audio/HappyBirthday.mp3', // 吹灭时播放的曲目
        guides: [
            { icon: '👆', text: '点击屏幕 → 点亮蜡烛' }, 
            { icon: '🌬️', text: '对着屏幕吹气 → 吹灭也许愿' }
        ] 
    },
    WoodenFish: { 
        key: 'WoodenFish', 
        type: 'FREE', 
        price: 0, 
        title: '🐹 功德指南', 
        btnText: '开始积德', 
        iconEmoji: '🐟', 
        badge: '🔥 热门', 
        badgeClass: 'hot', 
        bgm: '/assets/audio/temple.m4a',
        bgStyle: '#000', 
        guides: [{ icon: '👋', text: '挥手 → 敲击' }, { icon: '🙏', text: '合十 → 爆发' }] 
    },

    // ⚡ [重点修改] 鬼畜至尊：适配最新的暴富战神与下沉视觉逻辑
    CrazyCrit: { 
        key: 'CrazyCrit', 
        type: 'FREE', 
        price: 9.9, 
        title: '🔥 鬼畜战神 (暴富版)', 
        btnText: '一刀 999', 
        iconEmoji: '🗡️', 
        badge: '💰 财运', 
        badgeClass: 'hot', 
        // 🟢 [新增] 选用最土、最震撼的高频背景音 (请确保对应路径下有此文件或自行指定)
        bgm: '/assets/audio/crazy_rich_vibe.mp3', 
        // 🟢 [新增] 极度压抑转爆发的暗红色背景，配合 SceneManager 的反色效果
        bgStyle: 'radial-gradient(circle at center, #500000 0%, #000000 100%)',
        guides: [
            { icon: '👋', text: '持续挥手 → 疯狂爆率' }, 
            { icon: '🧘', text: '保持待机 → 自动吸金' }
        ] 
    },
    
     LuckyCat: { 
        key: 'LuckyCat',   
        type: 'FREE', 
        price: 0, 
        title: '🐱 招财进宝', 
        btnText: '召唤财神', 
        iconEmoji: '🧧', 
        badge: '🔥 热门',
        badgeClass: 'hot',
        bgm: '/assets/audio/Lucky_Cat_Vibe.mp3', 
        bgStyle: 'radial-gradient(circle at center, #ffd700 0%, #ff8c00 40%, #d92418 100%)',
        guides: [{ icon: '🎵', text: '音乐 → 律动' }, { icon: '👋', text: '张手 → 冲刺' }] 
    },

    Diamond3D:  { key: 'Diamond3D',  type:'FREE', price:0, title: '💎 精灵宝钻', btnText: '唤醒宝石', iconEmoji: '💎', guides: [{ icon: '👋', text: '挥手 → 唤醒' }, { icon: '❤️', text: '比心 → 许愿' }] },
    LuckyDog:   { key: 'LuckyDog',   type:'FREE', price:0, title: '🐶 旺财招福', btnText: '召唤旺财', iconEmoji: '🦴', guides: [{ icon: '🎵', text: '音乐 → Q弹' }, { icon: '👋', text: '挥手 → 摇尾' }] },
};

let currentProductKey = 'WoodenFish';
let sceneManager = null;
let handTracker = null;
let audioContext = null;
let analyser = null;
let dataArray = null;

// ===================================
// 2. 初始化流程
// ===================================
// 2. 修改渲染逻辑：支持角标和锁状态
function initShowcase() {
    console.log("🛠️ 初始化橱窗...");
    const showcaseContainer = document.getElementById('product-showcase');
    if (!showcaseContainer) return;

    showcaseContainer.innerHTML = '';

    Object.values(PRODUCT_CONFIG).forEach(product => {
        const card = document.createElement('div');
        
        // 基础类名
        let classNames = `product-card ${product.key === currentProductKey ? 'active' : ''}`;
        
        // C. 锁状态逻辑：如果是 PAID 类型，且在本地没有解锁记录，则加锁
        // 这里做一个简单的模拟检查，实际逻辑可能需要调 API
        // 暂时逻辑：只要是 PAID 类型，就先显示锁，激发点击欲
        if (product.type === 'PAID') {
             classNames += ' locked';
        }

        card.className = classNames;
        card.dataset.key = product.key;
        card.onclick = () => selectProduct(product.key);
        
        // B. 生成角标 HTML
        const badgeHtml = product.badge 
            ? `<div class="card-badge ${product.badgeClass || ''}">${product.badge}</div>` 
        : '';

        card.innerHTML = `
            ${badgeHtml}
            <div class="card-icon">${product.iconEmoji}</div>
            <p>${product.title.split(' ')[1]}</p>
        `;
        showcaseContainer.appendChild(card);
    });

    // 绑定开始按钮 (确保只绑定一次)
    if (startBtn) {
        startBtn.replaceWith(startBtn.cloneNode(true));
        const newStartBtn = document.querySelector('#start-btn');
        newStartBtn.addEventListener('click', onUserStart);
        updateStartBtnText(newStartBtn);
    }
}

function selectProduct(key) {
    currentProductKey = key;
    document.querySelectorAll('.product-card').forEach(c => c.classList.toggle('active', c.dataset.key === key));
    updateStartBtnText(document.querySelector('#start-btn'));

    const config = PRODUCT_CONFIG[key];
    updateStartBtnText(document.querySelector('#start-btn'));
}

function updateStartBtnText(btn) {
    if (btn && PRODUCT_CONFIG[currentProductKey]) {
        btn.textContent = PRODUCT_CONFIG[currentProductKey].btnText;
    }
}

// ===================================
// 3. 用户点击“开始” (核心逻辑)
// ===================================

// 全局状态记录
let isTrialMode = false; 
let trialTimer = null;

// 将参数名 customText 改为 giftData 以符合语义，但保持逻辑兼容
async function onUserStart(e, skipModal = false, giftData = null) {
    // 阻止冒泡，防止点穿
    if(e && typeof e.stopPropagation === 'function') e.stopPropagation();

    const config = PRODUCT_CONFIG[currentProductKey];
    console.log(`🚀 启动验证: ${currentProductKey} (跳过弹窗: ${skipModal})`);

    // --- 【业务绕过逻辑】 ---
    if (!skipModal && config.type === 'CUSTOM') {
        openCustomGiftModal(config); 
        return; 
    }

    // 停止之前的循环与计时器
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    if (trialTimer) clearInterval(trialTimer);
    
    const btn = e ? e.target : document.querySelector('#start-btn');
   
    // --- 【付费类鉴权】 ---
    isTrialMode = false; 
    if (config.type === 'PAID') {
        btn.disabled = true;
        btn.textContent = "正在校验授权...";
        
        const savedPhone = localStorage.getItem('mtboom_user_phone') || "";
        try {
            const res = await apiClient.checkUnlock(savedPhone, "");
            if (!res.success) {
                console.log("⚠️ 未检测到永久授权，开启15秒试玩模式");
                isTrialMode = true;
            }
        } catch (err) {
            isTrialMode = true;
        }
    }

    // --- 【通用：资源加载流程】 ---
    btn.disabled = true;
    btn.textContent = "资源装载中...";
    
    const moduleLoader = SCENE_MODULES[currentProductKey];

    try {
        await CameraManager.start();
        const freshCanvas = recreateCanvas();

        const [SceneModule, TrackerModule] = await Promise.all([
            moduleLoader.scene(),
            moduleLoader.tracker()
        ]);

        console.log("📦 模块加载完成");

        // main.js 约 220 行左右
        sceneManager = new SceneModule.SceneManager(freshCanvas);
        handTracker = new TrackerModule.HandTracker();

        // 🟢 就在这里插入你的 onBlowingTrigger 定义
        const onBlowingTrigger = () => {
            // 1. UI 弹出逻辑
            const noteEl = document.getElementById('blessing-note');
            if (noteEl && giftData && giftData.blessing) {
                noteEl.querySelector('.note-text').textContent = giftData.blessing;
                noteEl.style.display = 'block'; 
                noteEl.classList.add('active'); // 触发 style.css 中的动画
            }

            // 2. 通用音频播放逻辑
            const config = PRODUCT_CONFIG[currentProductKey];
            if (config && config.eventAudio) {
                // 使用 window.__eventSfx 确保全局可访问以便 backToHome 清理
                if (!window.__eventSfx) {
                    window.__eventSfx = new Audio(encodeURI(config.eventAudio));
                    const isMuted = document.getElementById('audio-btn')?.classList.contains('muted');
                    window.__eventSfx.muted = isMuted;
                }
                window.__eventSfx.play().catch(e => console.warn("事件音频播放失败", e));
            }
        };

        // 🔴 注意：修改这里的 init 调用，把函数传进去
        await sceneManager.init(giftData, onBlowingTrigger);

        // ✅ 新增：如果是蛋糕，确保在场景初始化后，把照片塞进 3D 槽位
        if (currentProductKey === 'Birthdaycake' && giftData && giftData.photos) {
            console.log("📸 正在向 3D 蛋糕场景装载照片...");
            // 给 3D 场景一点点缓冲时间来创建物体
            setTimeout(() => {
                giftData.photos.forEach((base64, index) => {
                    if (sceneManager.product && typeof sceneManager.product.updatePhoto === 'function') {
                        sceneManager.product.updatePhoto(index, base64);
                    }
                });
            }, 600); // 略微增加延迟确保 3D Group 已加载
        }

        // 切换 UI 状态
        landingPage.style.display = 'none';
        document.getElementById('view-ar').classList.add('active');
        document.getElementById('camera-box').style.display = 'block';

        updateGuideUI(config);

        // 🔴 核心改动：先运行音频系统，然后运行解锁补丁
        setupAudioSystem();
        initMobileAudioUnlock(); // ✨ 调用新封装的函数

        setupAudioSystem();
        await handTracker.init();

        tick(); 

        if (isTrialMode) {
            startTrialCountdown(); 
        }

        initBackendLogic();

    } catch (err) {
        console.error("❌ 启动失败:", err);
        alert("加载失败: " + err.message);
        backToHome();
    }
}

/**
 * 试玩倒计时逻辑
 */
function startTrialCountdown() {
    let timeLeft = 15; 
    const guideTitle = document.getElementById('guide-title');
    
    if (guideTitle) guideTitle.innerHTML = `⏳ 试玩剩余 <span style="color:#ff4444">${timeLeft}s</span>`;

    trialTimer = setInterval(() => {
        timeLeft--;
        if (guideTitle) guideTitle.innerHTML = `⏳ 试玩剩余 <span style="color:#ff4444">${timeLeft}s</span>`;
        
        if (timeLeft <= 0) {
            clearInterval(trialTimer);
            handleTrialEnd(); // 结束试玩
        }
    }, 1000);
}

/**
 * 试玩结束处理：增加“已支付校验”逻辑
 */
function handleTrialEnd() {
    const modal = document.getElementById('universal-modal');
    if (!modal) return;

    // 1. 隐藏多余输入框
    modal.querySelectorAll('.glass-input').forEach(input => input.style.display = 'none');
    const previewBox = document.getElementById('modal-product-preview');
    if (previewBox) previewBox.style.display = 'none';

    // 2. 设置弹窗文案
    document.getElementById('modal-title').innerText = "✨ 试玩已结束 ✨";
    document.getElementById('modal-desc').innerText = "付费 9.9 元即可解锁永久畅玩权限";

    const cancelBtn = document.getElementById('modal-btn-cancel');
    const confirmBtn = document.getElementById('modal-btn-confirm');

    // --- 分支处理：如果本地已经存了单号，说明用户可能刚付完钱回来 ---
    const lastOid = localStorage.getItem('mtboom_last_oid');
    const savedPhone = localStorage.getItem('mtboom_user_phone');

    if (lastOid && savedPhone) {
        cancelBtn.innerText = "已支付，立即验证";
        cancelBtn.onclick = async () => {
            cancelBtn.innerText = "验证中...";
            try {
                // 触发后端主动查询逻辑
                const res = await apiClient.checkUnlock(savedPhone, lastOid);
                if (res.success) {
                    alert("✅ 验证成功！欢迎使用永久版");
                    modal.style.display = 'none';
                    isTrialMode = false; // 关闭试玩限制
                    if (trialTimer) clearInterval(trialTimer);
                    document.getElementById('guide-title').innerText = PRODUCT_CONFIG[currentProductKey].title;
                } else {
                    alert("🚫 尚未检测到支付成功，请确认是否完成支付");
                    cancelBtn.innerText = "已支付，立即验证";
                }
            } catch (err) {
                alert("网络繁忙，请稍后再试");
                cancelBtn.innerText = "已支付，立即验证";
            }
        };
    } else {
        cancelBtn.innerText = "返回主页";
        cancelBtn.onclick = () => {
            modal.style.display = 'none';
            backToHome();
        };
    }

    // 右边按钮：继续去支付
    confirmBtn.innerText = "9.9解锁体验";
    confirmBtn.onclick = () => {
        openCustomGiftModal(PRODUCT_CONFIG[currentProductKey], true);
    };

    modal.style.display = 'flex';
}




function updateGuideUI(config) {
    const titleEl = document.getElementById('guide-title');
    const listEl = document.getElementById('guide-list');
    if (titleEl) titleEl.textContent = config.title;
    if (listEl) {
        listEl.innerHTML = config.guides.map(item => `
            <div class="guide-item"><span class="tag gold">${item.icon}</span><span class="text">${item.text}</span></div>
        `).join('');
    }
}

// ===================================
// 4. 渲染循环
// ===================================
// main.js 约 395 行左右
function tick() {
    // 🟢 核心修复：如果环境被清理，立即停止循环，防止回到首页后卡顿
    if (!handTracker || !sceneManager) {
        animationFrameId = null;
        return; 
    }

    animationFrameId = requestAnimationFrame(tick);

    const video = document.getElementById('ar-camera-feed');
    // 🟢 门卫检查：视频未就绪（宽高为0）时跳过检测，防止 ROI 报错崩溃
    if (!video || video.videoWidth === 0 || video.readyState < 2) return; 

    try {
        const gesture = handTracker.detect();
        const beat = getAudioBeat();
        sceneManager.render(gesture, beat);
    } catch (err) {
        console.warn("手势检测跳帧中...");
    }
}

// ===================================
// 5. 音频与后台
// ====================================

function setupAudioSystem() {
    // 1. 🔴 治本：强制关停首页引流音乐，防止重叠
    const landingAudio = document.getElementById('bgm-landing');
    if (landingAudio) {
        landingAudio.pause();
        landingAudio.currentTime = 0;
    }
    // 1. 🟢 进新场景前，先杀掉旧音乐 (解决 BGM 叠加大杂烩的问题)
    stopSceneBgm();

    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!audioContext) audioContext = new AudioContext();

        // 2. 🟢 从配置读取 BGM (解决“千篇一律”的问题)
        const config = PRODUCT_CONFIG[currentProductKey];
        // 默认兜底音乐 (如果配置里没写 bgm)
        const bgmUrl = config.bgm || 'https://cdn.pixabay.com/audio/2022/03/15/audio_73147d3467.mp3';

        console.log(`🎵 正在加载场景音乐: ${bgmUrl}`);

        // 3. 🟢 创建新的 Audio 对象并赋值给全局变量
        currentSceneBgm = new Audio(bgmUrl);
        currentSceneBgm.loop = true;
        currentSceneBgm.crossOrigin = "anonymous";
        
        // 4. 🟢 同步静音状态 (解决“进场景声音关不掉”的问题)
        // 检查左上角按钮当前是不是红色的静音状态
        const isMuted = document.getElementById('audio-btn')?.classList.contains('muted');
        currentSceneBgm.muted = isMuted;

        // 5. 播放
        currentSceneBgm.play().catch(e => console.warn("等待交互播放", e));

        // 6. 连接分析器 (Visualizer)
        if (analyser) { 
            try { analyser.disconnect(); } catch(e){} 
        }
        
        const source = audioContext.createMediaElementSource(currentSceneBgm);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);
        analyser.connect(audioContext.destination);
        dataArray = new Uint8Array(analyser.frequencyBinCount);

    } catch (e) {
        console.warn("Audio Error:", e);
    }
}

// 🟢 [新增] 停止音乐的工具函数
function stopSceneBgm() {
    if (currentSceneBgm) {
        currentSceneBgm.pause();
        currentSceneBgm.currentTime = 0;
        currentSceneBgm = null; // 销毁引用，彻底释放
    }
}

function getAudioBeat() {
    if (!analyser) return 0;
    analyser.getByteFrequencyData(dataArray);
    return Math.min((dataArray[0] + dataArray[1] + dataArray[2]) / 600, 1.0);
}

async function initBackendLogic() {
    try {
        // 如果这里报错，也不会影响主流程
        await apiClient.login("test_user_001", "VIP", "");
    } catch (err) { }
}

// ===================================
// 6. 返回主页
// ===================================
if (homeBtn) {
    homeBtn.onclick = backToHome;
}

// main.js -> backToHome

function backToHome() {
    console.log("🏠 返回橱窗");
    CameraManager.stop();
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    
    // 🟢 [新增] 停止场景音乐
    stopSceneBgm();
    
    // 🟢 [新增] 复原背景 (清除招财猫/圣诞树的特殊背景，变回默认黑底)
    document.body.style.background = ''; 

    // --- 新增：清除试玩倒计时 ---
    if (trialTimer) {
        clearInterval(trialTimer);
        trialTimer = null;
    }

    // 清理实例
    if (handTracker) {
            if (typeof handTracker.stop === 'function') handTracker.stop(); // 强力关闭摄像头和红条状态栏
            handTracker = null; 
    }

    if (sceneManager) {
        if (typeof sceneManager.dispose === 'function') sceneManager.dispose(); 
        sceneManager = null; 
    }
    
    if (audioContext) {
        // audioContext 一般不 close，suspend 即可，或者保持开启供下次使用
        // 这里可以保持原样，或者注释掉 close
        // audioContext.close(); 
        // audioContext = null;
    }

    document.getElementById('view-ar').classList.remove('active');
    document.getElementById('camera-box').style.display = 'none';
    landingPage.style.display = 'flex';

    // 恢复开始按钮
    const btn = document.querySelector('#start-btn');
    if (btn) {
        btn.disabled = false;
        updateStartBtnText(btn);
    }
    
    // 🟢 [新增] 恢复主页引流音乐
    const landingAudio = document.getElementById('bgm-landing');
    if (landingAudio) {
        // 继承当前的静音设置
        const isMuted = document.getElementById('audio-btn')?.classList.contains('muted');
        landingAudio.muted = isMuted;
        landingAudio.play().catch(e=>{});
    }

    // 🟢 通用清理：只要有事件音效在响，统统关掉
    if (window.__eventSfx) {
        window.__eventSfx.pause();
        window.__eventSfx.currentTime = 0;
        window.__eventSfx = null; 
    }
}

// ===================================
// 7. 辅助功能：声音 & 隐私
// ===================================
// ===================================
// 7. 辅助功能 (重构版)
// ===================================

function initAudioControl() {
    const audioBtn = document.getElementById('audio-btn');
    if(!audioBtn) return;
    
    // 默认状态
    let isMuted = false;

    audioBtn.onclick = () => {
        isMuted = !isMuted;
        audioBtn.textContent = isMuted ? '🔇 静音' : '🔊 声音';
        audioBtn.classList.toggle('muted', isMuted);

        // 1. 🟢 核心修复：精准控制当前场景的内存音频对象
        if (currentSceneBgm) {
            currentSceneBgm.muted = isMuted;
        }

        // 🟢 核心修复：同步控制吹灭蜡烛后的“事件音效”
        // 无论这个变量叫 __eventSfx 还是 __tempCakeSfx，都要管起来
        if (window.__eventSfx) {
            window.__eventSfx.muted = isMuted;
        }
        if (window.__tempCakeSfx) {
            window.__tempCakeSfx.muted = isMuted;
        }

        // 2. 🟢 精准控制首页引流音乐 (由于 HTML 补全了，现在能找到了)
        const landingAudioTag = document.getElementById('bgm-landing');
        if (landingAudioTag) {
            landingAudioTag.muted = isMuted;
        };
        
        // 3. 兜底：控制页面上所有 Audio 标签
        document.querySelectorAll('audio').forEach(el => el.muted = isMuted);

        // 4. 控制 Web Audio API (暂停分析器，省电)
        if(audioContext) {
            isMuted ? audioContext.suspend() : audioContext.resume();
        }
    };
}

function initPrivacy() {
    const privacyBar = document.getElementById('privacy-bar');
    const privacyBtn = document.getElementById('privacy-ok');
    if(localStorage.getItem('mtboom_privacy_agreed') === 'true') return;
    if(privacyBar) privacyBar.style.display = 'flex';
    if(privacyBtn) privacyBtn.onclick = () => {
        privacyBar.style.display = 'none';
        localStorage.setItem('mtboom_privacy_agreed', 'true');
    };
}

// ===================================
// ✅ 8. 法宝库 (修复版：防止与定制弹窗冲突)
// ===================================
function initTreasureBox() {
    const treasureBtn = document.getElementById('my-treasure-btn');
    const modal = document.getElementById('universal-modal');
    
    if (!treasureBtn || !modal) return;

    modal.style.zIndex = "10001"; 

    const cancelBtn = document.getElementById('modal-btn-cancel');
    const confirmBtn = document.getElementById('modal-btn-confirm');
    const phoneInput = document.getElementById('modal-input-phone');
    const extraInput = document.getElementById('modal-input-extra');
    const modalTitle = document.getElementById('modal-title');
    const modalDesc = document.getElementById('modal-desc');
    
    // 🟢 新增获取：需要重置的元素
    const previewBox = document.getElementById('modal-product-preview');
    const blessingInput = document.getElementById('modal-input-blessing');

    // 定义查询逻辑 (独立出来，以便重新绑定)
    const handleQuery = async () => {
        const phone = phoneInput.value.trim();
        const suffix = extraInput ? extraInput.value.trim() : "";

        if (!phone || phone.length !== 11) {
            alert("请填写正确的11位手机号");
            return;
        }

        // =========== 🐛 开发者测试后门 START ===========
        if (phone === '18826108872') { 
            console.log("🐛 触发测试模式");
            const mockData = ['GoldenTree', 'LuckyCat', 'WoodenFish', 'CrazyCrit']; 
            modal.style.display = 'none'; 
            renderTreasureGrid(mockData); 
            const treasureView = document.getElementById('view-treasure');
            if(treasureView) treasureView.style.display = 'flex'; 
            return;
        }
        // =========== 🐛 开发者测试后门 END =============

        confirmBtn.innerText = "⏳ 查询中...";
        confirmBtn.disabled = true;

        try {
            const res = await apiClient.checkUnlock(phone, suffix);
            if (res.success && res.products.length > 0) {
                modal.style.display = 'none';
                renderTreasureGrid(res.products);
                document.getElementById('view-treasure').style.display = 'flex';
            } else {
                alert("🚫 未查到相关法宝");
            }
        } catch (err) {
            console.error(err);
            alert("网络连接失败");
        } finally {
            confirmBtn.innerText = "确定";
            confirmBtn.disabled = false;
        }
    };

    // 打开弹窗时的逻辑 (状态重置核心)
    treasureBtn.onclick = (e) => {
        e.stopPropagation();
        
        // 🔴 显式重置：隐藏不该出现的，显示该出现的
        document.getElementById('modal-input-phone-repeat').style.display = 'none'; // 隐藏重复手机
        document.getElementById('modal-input-extra').style.display = 'block';       // 显示订单号
        document.getElementById('modal-input-blessing').style.display = 'none';    // 隐藏祝福语

        // 1. 设置文案
        modalTitle.innerText = "✨ 法宝库查询 ✨";
        modalDesc.innerText = "输入手机号，找回你失落的宝藏";
        
        // 2. 🟢 状态清洗：隐藏预览框和祝福语
        if (previewBox) previewBox.style.display = 'none';
        if (blessingInput) blessingInput.style.display = 'none';

        // 3. 显示查询专用字段
        phoneInput.value = '';
        phoneInput.style.display = 'block';
        if(extraInput) {
            extraInput.style.display = 'block';
            extraInput.value = '';
        }

        // 4. 🟢 核心修复：把按钮逻辑抢回来！
        // (防止之前被 openCustomGiftModal 修改成了支付逻辑)
        confirmBtn.innerText = "确定";
        confirmBtn.onclick = handleQuery; 

        modal.style.display = 'flex';
    };

    if(cancelBtn) cancelBtn.onclick = () => modal.style.display = 'none';

    // 点击背景关闭
    modal.onclick = (e) => {
        if (e.target === modal) modal.style.display = 'none';
    };
}

// --- main.js ---
const IS_XMAS_FREE = true; // 前端同步开关

// ... 其他代码 ...
// main.js

function openCustomGiftModal(config, isUnlock = false) {
    const modal = document.getElementById('universal-modal');
    
    const confirmBtn = document.getElementById('modal-btn-confirm');
    const phoneInput = document.getElementById('modal-input-phone');
    const extraInput = document.getElementById('modal-input-phone-repeat');
    const blessingInput = document.getElementById('modal-input-blessing');
    const previewBox = document.getElementById('modal-product-preview');

    // 🟢 最小修改：新增照片相关 DOM 引用
    const photoBox = document.getElementById('photo-upload-box');
    const fileInput = document.getElementById('actual-file-input');
    const addBtn = document.getElementById('add-photo-btn');
    const statusText = document.getElementById('upload-status');
    const previewContainer = document.getElementById('photo-preview-container');

    if (!modal || !confirmBtn) return;

    // --- 状态重置 ---
    uploadedPhotos = []; // 重置全局照片数组
    if (phoneInput) phoneInput.style.display = 'block';
    if (extraInput) extraInput.style.display = 'block';
    if (blessingInput) blessingInput.style.display = 'block';
    
    // 🟢 逻辑微调：同时支持 PhotoTree 和 Birthdaycake 触发上传区
    if (photoBox) {
        // 判断当前产品是否需要上传照片功能
        const isNeedUpload = (config.key === 'PhotoTree' || config.key === 'Birthdaycake');
        
        photoBox.style.display = isNeedUpload ? 'block' : 'none';
        
        // 如果需要上传，立即渲染已存在的预览图（防止切换产品时丢失视觉状态）
        if (isNeedUpload) renderPhotoPreviews(); 
    }

    if (previewBox) {
        previewBox.style.display = 'flex';
        previewBox.innerHTML = `<div style="font-size:70px;">${config.iconEmoji}</div>`;
    }

    // 🟢 逻辑微调：绑定照片选择事件 (沿用文件1的 6 张上限和压缩算法)
    if (addBtn && fileInput) {
        addBtn.onclick = () => fileInput.click();
        fileInput.onchange = async (e) => {
            // 计算剩余可上传数量，确保总数不超过 6 张
            const remainingSpace = 6 - uploadedPhotos.length;
            const files = Array.from(e.target.files).slice(0, remainingSpace);
            
            for (const file of files) {
                // 调用文件1底部自带的 processImage 进行 400x500 比例压缩
                const compressed = await processImage(file); 
                uploadedPhotos.push(compressed);
            }
            renderPhotoPreviews();
            fileInput.value = ''; // 释放 input，允许重复选择同一张图
        };
    }

    // 照片预览渲染函数 (局部定义，不影响外部)
    function renderPhotoPreviews() {
        if (!previewContainer) return;
        previewContainer.querySelectorAll('.photo-item').forEach(el => el.remove());
        uploadedPhotos.forEach((base64, idx) => {
            const div = document.createElement('div');
            div.className = 'photo-item';
            div.style.cssText = `width:60px; height:60px; border-radius:8px; background:url(${base64}); background-size:cover; position:relative; border:1px solid var(--gold);`;
            div.innerHTML = `<div style="position:absolute; top:-5px; right:-5px; background:#ff4444; color:white; border-radius:50%; width:18px; height:18px; font-size:12px; text-align:center; line-height:18px; cursor:pointer; font-weight:bold;">×</div>`;
            div.querySelector('div').onclick = (e) => {
                e.stopPropagation();
                uploadedPhotos.splice(idx, 1);
                renderPhotoPreviews();
            };
            previewContainer.insertBefore(div, addBtn);
        });
        if (statusText) statusText.innerText = `已选择 ${uploadedPhotos.length}/6 张`;
        if (addBtn) addBtn.style.display = uploadedPhotos.length >= 6 ? 'none' : 'flex';
    }

    confirmBtn.innerText = IS_XMAS_FREE ? `圣诞限免：立即点亮` : (isUnlock ? "立即解锁" : `去支付 ${config.price} 元`);
    confirmBtn.disabled = false;

    confirmBtn.onclick = async () => {
        const phone = phoneInput.value.trim();
        const confirmPhone = extraInput ? extraInput.value.trim() : "";
        const blessing = blessingInput ? blessingInput.value.trim() : "";

        if (!phone || phone.length !== 11) { alert("请输入正确的11位手机号"); return; }
        if (phone !== confirmPhone) { alert("两次输入的手机号不一致"); return; }
        
        // 🟢 最小修改：照片树必传校验
        if (config.key === 'PhotoTree' && uploadedPhotos.length === 0) {
            alert("请至少上传一张回忆照片");
            return;
        }

        try {
            confirmBtn.disabled = true;
            confirmBtn.innerText = "⏳ 正在点亮魔法...";

            // 🔥 【核心修复】：在这里定义 giftData，否则后面赋值会报错
            const giftData = { blessing: blessing };
            
            // 🟢 最小修改：打包 giftData
            // 🟢 修改判定条件，让蛋糕也能带上照片数据
            if (config.key === 'PhotoTree' || config.key === 'Birthdaycake') {
                giftData.photos = uploadedPhotos;
            }

            const res = await apiClient.createIntent(config.key, phone, giftData);
            const internal_oid = res.internal_oid;

            localStorage.setItem('mtboom_last_oid', internal_oid);
            localStorage.setItem('mtboom_user_phone', phone);

            const shareUrl = `${window.location.origin}${window.location.pathname}?oid=${internal_oid}`;
            showSharePrompt(shareUrl);

            if (IS_XMAS_FREE) {
                console.log("🎁 圣诞限免：启动场景");
                modal.style.display = 'none';
                // 🟢 最小修改：传递完整的 giftData (包含照片和祝福语)
                onUserStart(null, true, giftData); 
                return; 
            }
        }
        catch (err) {
            confirmBtn.disabled = false;
            confirmBtn.innerText = "确定";
        }
    };

    modal.style.display = 'flex';
}

// 渲染背包网格
function renderTreasureGrid(unlockedKeys) {
    const gridEl = document.getElementById('treasure-grid');
    if (!gridEl) return;
    
    gridEl.innerHTML = ''; 

    if (!unlockedKeys || unlockedKeys.length === 0) {
        gridEl.innerHTML = `
            <div class="empty-state">
                <span style="font-size:40px; opacity:0.5;">🕸️</span>
                <p>百宝囊空空如也</p>
            </div>`;
        return;
    }

    unlockedKeys.forEach(key => {
        const config = PRODUCT_CONFIG[key];
        if (!config) return;

        const itemDiv = document.createElement('div');
        itemDiv.className = 'treasure-item unlocked';
        itemDiv.innerHTML = `
            <div class="t-icon">${config.iconEmoji}</div>
            <div class="t-name">${config.title.split(' ')[1]}</div>
            <div class="t-status">已拥有</div>
        `;

        itemDiv.onclick = () => {
            console.log(`✨ 从背包启动: ${key}`);
            document.getElementById('view-treasure').style.display = 'none';
            selectProduct(key);
            
            const startButton = document.querySelector('#start-btn');
            if (startButton) {
                startButton.disabled = false; 
                startButton.click();
            }
        };

        gridEl.appendChild(itemDiv);
    });
} // 🟢 修复：这里正确闭合了 renderTreasureGrid 函数


/**
 * 🛠️ 强制重置 Canvas DOM 元素
 * 解决 WebGL 上下文丢失或 'precision' null 报错的问题
 */
function recreateCanvas() {
    // 1. 找到旧的 canvas
    const oldCanvas = document.getElementById('main-canvas');
    
    // 2. 如果存在，直接从 DOM 移除
    if (oldCanvas) {
        oldCanvas.remove();
    }

    // 3. 创建全新的 canvas
    const newCanvas = document.createElement('canvas');
    newCanvas.id = 'main-canvas';
    
    // 4. 插入到 body 的最前面 (确保它在背景层，且被 CSS 覆盖)
    // 根据你的 style.css，它应该是绝对定位且 z-index: 1
    document.body.prepend(newCanvas);

    return newCanvas;
}

// ===================================
// 🚀 程序启动入口
// ===================================
// 等待 DOM 加载完毕再执行，最安全
window.addEventListener('DOMContentLoaded', async () => {
    if (checkWechatEnvironment()) return; // 如果是微信，直接停止初始化
    initShowcase();
    initAudioControl();
    initPrivacy();
    initTreasureBox();
    
    const urlParams = new URLSearchParams(window.location.search);
    const oid = urlParams.get('oid'); // 新增：识别分享 ID

    // --- 场景 A：识别到分享链接 (优先级最高) ---
    if (oid) {
        console.log("🎁 发现分享礼物，正在准备点亮...");
        // 隐藏首页，显示一个简单的加载文案
        landingPage.style.display = 'none';
        const loader = document.createElement('div');
        loader.id = 'gift-loading';
        loader.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);color:var(--gold);z-index:9999;';
        loader.innerText = '正在载入好友的祝福...';
        document.body.appendChild(loader);

        try {
            const res = await apiClient.getGift(oid); // 需要在 apiClient 补充这个方法
            if (res.success) {
                currentProductKey = res.product_key;
                // ❌ 原代码：const blessing = res.gift_data?.blessing || "";
                // ❌ 原代码：onUserStart(null, true, blessing); 
                // 🟢 修正后：直接获取完整的 gift_data 对象（里面包含了 blessing 和 photos）
                const giftData = res.gift_data || {}; 
                if (loader) loader.remove();
                // 🟢 修正后：将完整的对象传给启动函数
                onUserStart(null, true, giftData);
            }
        } catch (e) {
            loader.innerText = "礼物加载失败";
            setTimeout(() => location.href = location.origin, 2000);
        }
        return; // 处理完分享就不执行后面的逻辑了
    }

    // --- 场景 B：你原本的回航自动识别逻辑 (保留并略微微调) ---
    if (urlParams.get('pay_success') === 'true' || urlParams.get('custom_id')) {
        const savedPhone = localStorage.getItem('mtboom_user_phone');
        const lastOid = localStorage.getItem('mtboom_last_oid') || urlParams.get('custom_id');
        
        if (savedPhone && lastOid) {
            console.log("🚀 检测到支付回航，正在尝试自动解锁...");
            try {
                const res = await apiClient.checkUnlock(savedPhone, lastOid);
                if (res.success) {
                    alert("✨ 欢迎回来！法宝已自动解锁。");
                }
            } catch (e) {
                console.log("自动解锁尝试结束");
            }
        }
    }
});

// main.js 底部

// 修改版：带关闭按钮，且点击复制后不会自动消失
// main.js

function showSharePrompt(url) {
    // 1. 彻底清理旧弹窗，防止多个弹窗叠加导致视觉混乱
    const oldPrompt = document.getElementById('share-prompt-box');
    if (oldPrompt) {
        oldPrompt.style.display = 'none';
        oldPrompt.remove();
    }

    // 2. 创建容器
    const prompt = document.createElement('div');
    prompt.id = 'share-prompt-box';
    
    // 🟢【视觉优化】：加深了背景不透明度 (0.9)，并确保 z-index 在最顶层
    prompt.style.cssText = `
        position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
        width: 90%; max-width: 400px; z-index: 99999; padding: 20px 15px 15px;
        background: rgba(0,0,0,0.9); border: 1px solid var(--gold);
        border-radius: 12px; text-align: center; backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px); box-shadow: 0 0 30px rgba(0,0,0,0.8);
        pointer-events: auto;
    `;

    // 3. 内部布局
    prompt.innerHTML = `
        <div id="share-close-x" style="position: absolute; top: 5px; right: 10px; 
             color: rgba(255,255,255,0.5); font-size: 20px; cursor: pointer; padding: 5px;">✕</div>
        <div style="font-size:14px; color:var(--gold); margin-bottom:12px; font-weight:bold;">✨ 专属魔法链接已生成 ✨</div>
        <input type="text" value="${url}" readonly style="
            width:100%; padding:10px; background:rgba(255,255,255,0.1); 
            border:1px solid rgba(255,255,255,0.1); color:#fff; font-size:12px; 
            border-radius:6px; margin-bottom:12px; text-align:center; outline:none;
        ">
        <button id="copy-btn" class="btn-gold" style="width:100%; padding:12px; font-size:14px;">一键复制发送给好友</button>
    `;

    document.body.appendChild(prompt);

    // 4. 事件绑定
    // 🟢【关键修复】：先隐藏再移除，解决毛玻璃残影问题
    document.getElementById('share-close-x').onclick = () => {
        prompt.style.display = 'none'; 
        setTimeout(() => prompt.remove(), 50); 
    };

    // 复制逻辑
    const copyBtn = document.getElementById('copy-btn');
    copyBtn.onclick = function() {
        navigator.clipboard.writeText(url).then(() => {
            this.innerText = "✅ 已复制！快去微信粘贴";
            this.style.background = "linear-gradient(45deg, #11998e, #38ef7d)";
            this.style.color = "#fff";
            this.style.border = "none";
        }).catch(() => {
            this.innerText = "❌ 请手动长按输入框复制";
        });
    };
}

/**
 * 🛠️ 核心工具：图片压缩
 * 将图片缩放至 400x500 左右，并降低质量，确保 Base64 不会过大
 */
async function processImage(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 400;
                const MAX_HEIGHT = 500;
                let width = img.width;
                let height = img.height;

                // 计算缩放比例
                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                // 质量设为 0.7，平衡清晰度与体积
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
        };
    });
}


/**
 * 📱 移动端音频解锁补丁 (防重叠优化版)
 */
function initMobileAudioUnlock() {
    const isMobile = /Mobi|Android|iPhone/i.test(navigator.userAgent);
    
    // 🔴 核心微调：无论 PC 还是手机，触发解锁前先确保首页音乐彻底消失
    const killLandingBgm = () => {
        const landingAudio = document.getElementById('bgm-landing');
        if (landingAudio) {
            landingAudio.pause();
            landingAudio.muted = true;
            landingAudio.currentTime = 0;
        }
    };

    if (!isMobile) {
        killLandingBgm(); // PC 端也清理一次
        if (currentSceneBgm && currentSceneBgm.paused) {
            currentSceneBgm.play().catch(() => {});
        }
        return;
    }

    if (document.getElementById('mobile-audio-hint')) return;

    const audioHint = document.createElement('div');
    audioHint.id = 'mobile-audio-hint';
    audioHint.style.cssText = `
        position: fixed; top: 18%; left: 50%; transform: translateX(-50%);
        color: rgba(255,215,0,0.9); font-size: 13px; z-index: 100000;
        padding: 10px 20px; background: rgba(0,0,0,0.6); border-radius: 25px;
        pointer-events: none; border: 1px solid rgba(255,215,0,0.3);
        white-space: nowrap; box-shadow: 0 4px 15px rgba(0,0,0,0.5);
        transition: opacity 0.5s ease;
    `;
    audioHint.innerText = "🎵 点击屏幕任意处开启音乐魔法";
    document.body.appendChild(audioHint);

    const unlockAudio = () => {
        // 🔴 解锁瞬间再次执行清理，确保万无一失
        killLandingBgm();

        if (audioContext && audioContext.state === 'suspended') {
            audioContext.resume();
        }
        if (currentSceneBgm) {
            currentSceneBgm.play().catch(() => {});
        }
        
        audioHint.style.opacity = '0';
        setTimeout(() => audioHint.remove(), 1500);

        window.removeEventListener('click', unlockAudio);
        window.removeEventListener('touchstart', unlockAudio);
    };

    window.addEventListener('click', unlockAudio);
    window.addEventListener('touchstart', unlockAudio);
}

/**
 * 🕵️ 微信环境检测
 * 如果在微信内，显示引导图并拦截后续逻辑
 */
function checkWechatEnvironment() {
    const ua = navigator.userAgent.toLowerCase();
    const isWechat = /micromessenger/i.test(ua);
    
    if (isWechat) {
        // 创建引导遮罩
        const wechatMask = document.createElement('div');
        wechatMask.id = 'wechat-browser-guide';
        wechatMask.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.9); z-index: 200000;
            display: flex; flex-direction: column; align-items: center; justify-content: flex-start;
            padding-top: 50px; color: white; text-align: center;
        `;
        wechatMask.innerHTML = `
            <div style="position: absolute; top: 10px; right: 20px; font-size: 40px;">↗️</div>
            <div style="margin-top: 40px; padding: 20px;">
                <h2 style="color: #FFD700;">请使用浏览器打开</h2>
                <p style="margin-top: 15px; font-size: 14px; opacity: 0.8;">
                    由于微信限制了摄像头权限<br>
                    请点击右上角 <b style="color: #fff">三个点</b><br>
                    选择 <b style="color: #fff">“在浏览器打开”</b> 即可开始
                </p>
                <div style="margin-top: 50px; font-size: 60px;">📸</div>
            </div>
        `;
        document.body.appendChild(wechatMask);
        return true; // 是微信环境
    }
    return false; // 不是微信环境
}

// 删除旧的 window.copyAndClose，因为逻辑已经写在上面了
// window.copyAndClose = ... (不需要了)