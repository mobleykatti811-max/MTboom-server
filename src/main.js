import { apiClient } from './logic/apiClient.js';
import { CameraManager } from './logic/CameraManager.js'; // 🟢 新增引入

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
    'WoodenFish': { scene: () => import('./logic/WoodenFish/SceneManager.js'), tracker: () => import('./logic/WoodenFish/HandTracker.js') },
    'GoldenTree': { scene: () => import('./logic/GoldenTree/SceneManager.js'), tracker: () => import('./logic/GoldenTree/HandTracker.js') },
    'Diamond3D':  { scene: () => import('./logic/Diamond3D/SceneManager.js'),  tracker: () => import('./logic/GoldenTree/HandTracker.js') },
    'LuckyCat':   { scene: () => import('./logic/LuckyCat/SceneManager.js'),   tracker: () => import('./logic/LuckyCat/HandTracker.js') },
    'LuckyDog':   { scene: () => import('./logic/LuckyDog/SceneManager.js'),   tracker: () => import('./logic/LuckyDog/HandTracker.js') },
    'CrazyCrit':  { scene: () => import('./logic/CrazyCrit/SceneManager.js'),  tracker: () => import('./logic/CrazyCrit/HandTracker.js') },
    'PhotoTree':  { scene: () => import('./logic/Treewith Photos/SceneManager.js'), tracker: () => import('./logic/Treewith Photos/HandTracker.js') }
};

// 1. 修改配置：增加 badge 字段
const PRODUCT_CONFIG = {
    // ✅ 新增 PhotoTree 配置
    PhotoTree: { 
        key: 'PhotoTree', 
        type: 'FREE',       // 设定为付费产品（如果是免费改成 'FREE'，价格改成 0）
        price: 0,         // 价格
        title: '📸 圣诞照片墙', 
        btnText: '点亮回忆', 
        iconEmoji: '📸', 
        badge: '✨ 节日',    // B. 适配文件1的角标逻辑
        badgeClass: 'premium', // 🟢 样式类名 (premium/hot/trial)
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
        badge: '🎁 送礼', // B. 新增角标
        badgeClass: 'premium', // 🟢 新增：指定金色样式
        guides: [{ icon: '✊', text: '握拳 → 变小' }, { icon: '🖐️', text: '张开 → 变大' }] 
    },
    WoodenFish: { 
        key: 'WoodenFish', 
        type: 'FREE', 
        price: 0, 
        title: '🐹 功德指南', 
        btnText: '开始积德', 
        iconEmoji: '🐟', 
        badge: '🔥 热门', // B. 新增角标
        badgeClass: 'hot', // 🟢 新增：指定红色样式
        guides: [{ icon: '👋', text: '挥手 → 敲击' }, { icon: '🙏', text: '合十 → 爆发' }] 
    },
    CrazyCrit: { 
        key: 'CrazyCrit', 
        type: 'PAID', 
        price: 9.9, 
        title: '🔥 鬼畜至尊', 
        btnText: '开始攻沙', 
        iconEmoji: '🗡️', 
        badge: '⚡ 试玩', // B. 新增角标
        badgeClass: 'trial', // 🟢 新增：指定紫色样式
        guides: [{ icon: '🤏', text: '待机 → 探测' }, { icon: '🖐️', text: '挥手 → 暴击' }] 
    },
    // 其他产品保持原样，也可以加 badge
    LuckyCat:   { key: 'LuckyCat',   type:'FREE', price:0, title: '🐱 招财进宝', btnText: '召唤财神', iconEmoji: '🧧', guides: [{ icon: '🎵', text: '音乐 → 律动' }, { icon: '👋', text: '挥手 → 招手' }] },
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

async function onUserStart(e) {
    // 阻止冒泡，防止点穿
    if(e) e.stopPropagation();

    const config = PRODUCT_CONFIG[currentProductKey];
    console.log(`🚀 启动验证: ${currentProductKey} (类型: ${config.type || 'FREE'})`);
    
    // 停止之前的循环与计时器
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    if (trialTimer) clearInterval(trialTimer);
    
    const btn = e.target;
    
    // --- 【分支1：定制类拦截】 ---
    if (config.type === 'CUSTOM') {
        // 调用定制弹窗逻辑 (需配合下方的 UI 函数)
        openCustomGiftModal(config); 
        return; 
    }

    // --- 【分支2：付费类鉴权】 ---
    isTrialMode = false; 
    if (config.type === 'PAID') {
        btn.disabled = true;
        btn.textContent = "正在校验授权...";
        
        // 从本地获取手机号尝试静默校验
        const savedPhone = localStorage.getItem('mtboom_user_phone') || "";
        try {
            const res = await apiClient.checkUnlock(savedPhone, "");
            if (!res.success) {
                console.log("⚠️ 未检测到永久授权，开启15秒试玩模式");
                isTrialMode = true; // 标记试玩
            }
        } catch (err) {
            isTrialMode = true; // 网络异常默认走试玩
        }
    }

    // --- 【通用：资源加载流程】 ---
    btn.disabled = true;
    btn.textContent = "资源装载中...";
    
    const moduleLoader = SCENE_MODULES[currentProductKey];

    try {
        // 🟢 1. 优先启动摄像头 (全局统一管理)
        // 这样做的好处是：HandTracker 初始化时，video 标签里已经有画面了
        await CameraManager.start();

        // 🟢 2.【关键修改】在这里创建全新的 Canvas！
        const freshCanvas = recreateCanvas();

        // 3. 并行加载业务模块
        const [SceneModule, TrackerModule] = await Promise.all([
            moduleLoader.scene(),
            moduleLoader.tracker()
        ]);

        console.log("📦 模块加载完成");

        sceneManager = new SceneModule.SceneManager(freshCanvas);
        handTracker = new TrackerModule.HandTracker();
        sceneManager.init();

        // 切换 UI 状态
        landingPage.style.display = 'none';
        document.getElementById('view-ar').classList.add('active');
        document.getElementById('camera-box').style.display = 'block';

        updateGuideUI(config);
        setupAudioSystem();
        await handTracker.init();

        tick(); // 开始渲染循环

        // --- 【试玩模式：启动倒计时】 ---
        if (isTrialMode) {
            startTrialCountdown(); 
        }

        // 后台记录
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
 * 试玩结束处理 (修复版：保留画面 + 引导支付)
 */
function handleTrialEnd() {
    const modal = document.getElementById('universal-modal');
    if (!modal) return;

    // 1. 隐藏所有输入框和预览框（因为第一阶段只要按钮）
    modal.querySelectorAll('.glass-input').forEach(input => input.style.display = 'none');
    const previewBox = document.getElementById('modal-product-preview');
    if (previewBox) previewBox.style.display = 'none';

    // 2. 设置弹窗文案
    document.getElementById('modal-title').innerText = "✨ 试玩已结束 ✨";
    document.getElementById('modal-desc').innerText = "付费 9.9 元即可解锁永久畅玩权限";

    // 3. 配置按钮
    const cancelBtn = document.getElementById('modal-btn-cancel');
    const confirmBtn = document.getElementById('modal-btn-confirm');

    // 左边：返回主页
    cancelBtn.innerText = "返回主页";
    cancelBtn.onclick = () => {
        modal.style.display = 'none';
        backToHome();
    };

    confirmBtn.innerText = "9.9解锁体验";
    confirmBtn.onclick = () => {
        // 🟢 关键修改：传入第二个参数 true，表示进入解锁模式
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
function tick() {
    animationFrameId = requestAnimationFrame(tick);
    if (handTracker && sceneManager) {
        const gesture = handTracker.detect();
        const beat = getAudioBeat();
        sceneManager.render(gesture, beat);
    }
}

// ===================================
// 5. 音频与后台
// ===================================
function setupAudioSystem() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (audioContext) audioContext.close();
        audioContext = new AudioContext();
        
        const audioEl = new Audio('https://cdn.pixabay.com/audio/2022/03/15/audio_73147d3467.mp3'); 
        audioEl.crossOrigin = "anonymous"; 
        audioEl.loop = true;
        audioEl.play().catch(() => console.warn("等待交互播放")); 
        
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

function backToHome() {
    console.log("🏠 返回橱窗");
    CameraManager.stop();
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    
    // --- 新增：清除试玩倒计时 ---
    if (trialTimer) {
        clearInterval(trialTimer);
        trialTimer = null;
    }

    // 清理实例
    if (handTracker) handTracker = null; 
    if (sceneManager) {
        if (typeof sceneManager.dispose === 'function') sceneManager.dispose(); 
        sceneManager = null; 
    }
    if (audioContext) {
        audioContext.close();
        audioContext = null;
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

    // 在 main.js 的 backToHome 函数里：
    if (sceneManager) {
        if (typeof sceneManager.dispose === 'function') {
            sceneManager.dispose(); // ✅ 这里调用清理 UI
        }
        sceneManager = null;
    }
}

// ===================================
// 7. 辅助功能：声音 & 隐私
// ===================================
function initAudioControl() {
    const audioBtn = document.getElementById('audio-btn');
    if(!audioBtn) return;
    let isMuted = false;
    audioBtn.onclick = () => {
        isMuted = !isMuted;
        audioBtn.textContent = isMuted ? '🔇 静音' : '🔊 声音';
        audioBtn.classList.toggle('muted', isMuted);
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

// main.js - 替换 openCustomGiftModal 函数
function openCustomGiftModal(config, isUnlock = false) {
    const modal = document.getElementById('universal-modal');
    const previewBox = document.getElementById('modal-product-preview'); 
    const phoneInput = document.getElementById('modal-input-phone');
    const blessingInput = document.getElementById('modal-input-blessing');
    const confirmBtn = document.getElementById('modal-btn-confirm');
    const cancelBtn = document.getElementById('modal-btn-cancel');
    const extraInput = document.getElementById('modal-input-phone-repeat'); 
    const modalDesc = document.getElementById('modal-desc');

    if (!modal || !confirmBtn) return;

    // 🔴 显式状态重置与流程分支切换
    document.getElementById('modal-input-extra').style.display = 'none';
    document.getElementById('modal-input-phone-repeat').style.display = 'block';
    
    // 🟢 关键：根据 isUnlock 开关“祝福语”和“预览框”
    const displayStyle = isUnlock ? 'none' : 'block';
    if (blessingInput) blessingInput.style.display = displayStyle;
    if (modalDesc) modalDesc.style.display = displayStyle;
    if (previewBox) previewBox.style.display = isUnlock ? 'none' : 'flex';

    // 1. 动态设置标题 (定制 -> 解锁)
    const titlePrefix = isUnlock ? "🔓 解锁" : "🎁 定制";
    document.getElementById('modal-title').innerText = `${titlePrefix} ${config.title.split(' ')[1]}`;
    
    if (!isUnlock && modalDesc) {
        modalDesc.innerText = "请输入您的祝福语";
    }
    
    // 2. 预览内容 (仅在定制模式显示)
    if (previewBox && !isUnlock) {
        previewBox.innerHTML = `<div style="font-size:70px; filter:drop-shadow(0 0 10px gold);">${config.iconEmoji}</div>`;
    }
    
    // 3. 配置输入框 (手机号及二次确认)
    phoneInput.style.display = 'block';
    phoneInput.value = ""; 
    phoneInput.placeholder = "请输入您的手机号"; 
    
    if (extraInput) {
        extraInput.style.display = 'block';
        extraInput.value = ""; 
        extraInput.placeholder = "再次输入手机号确认";
        extraInput.type = "tel";
    }

    // 4. 修改按钮文本
    confirmBtn.innerText = isUnlock ? "立即解锁" : `去支付 ${config.price} 元`;
    confirmBtn.disabled = false;

    // 5. 绑定支付逻辑
    confirmBtn.onclick = () => {
        const phone = phoneInput.value.trim();
        const confirmPhone = extraInput ? extraInput.value.trim() : "";
        // 如果是解锁，祝福语传空
        const blessing = (blessingInput && !isUnlock) ? blessingInput.value.trim() : "";

        if (!phone || phone.length !== 11) {
            alert("请输入正确的11位手机号");
            return;
        }

        if (phone !== confirmPhone) {
            alert("两次输入的手机号不一致，请检查");
            return;
        }

        localStorage.setItem('mtboom_last_custom_data', JSON.stringify({ phone, blessing }));
        
        const mbdProductId = "YOUR_MBD_ID"; 
        const payUrl = `https://mbd.pub/o/bread/${mbdProductId}?remark=${encodeURIComponent(phone + '|' + blessing)}`;
        
        console.log("🔗 准备跳转支付:", payUrl);
        window.location.href = payUrl;
    };

    if (cancelBtn) cancelBtn.onclick = () => modal.style.display = 'none';
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
window.addEventListener('DOMContentLoaded', () => {
    initShowcase();
    initAudioControl();
    initPrivacy();
    initTreasureBox();
});