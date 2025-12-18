// src/logic/apiClient.js

// 🌍 核心配置
// ⚠️ 注意：这里要换成你 Node.js 服务器的地址
// 如果是本地测试用 localhost:3000，如果是上线用服务器IP:3000
const API_BASE_URL = 'http://localhost:3000'; 

/**
 * 通用请求处理函数 (保持不变)
 */
async function request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const defaultHeaders = { 'Content-Type': 'application/json' };
    const config = {
        ...options,
        headers: { ...defaultHeaders, ...options.headers },
    };

    try {
        console.log(`📡 发起请求: ${config.method || 'GET'} ${url}`);
        const response = await fetch(url, config);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || `请求失败: ${response.status}`);
        }
        return data;
    } catch (error) {
        console.error(`❌ API 错误 [${endpoint}]:`, error);
        throw error;
    }
}

// ==========================================
// 📦 业务接口导出 (已更新为最新 MVP 方案)
// ==========================================

export const apiClient = {
    // 1. 预下单 (生成内部单号 -> 前端跳转面包多)
    // 对应后端: /api/create-intent
    createIntent: (productKey, phone, giftData = {}) => {
        return request('/api/create-intent', {
            method: 'POST',
            body: JSON.stringify({ 
                product_key: productKey, 
                phone: phone, 
                gift_data: giftData 
            })
        });
    },

    // 2. 查单/登录 (法宝库查询)
    // 对应后端: /api/check-unlock
    checkUnlock: (phone, orderSuffix) => {
        return request('/api/check-unlock', {
            method: 'POST',
            body: JSON.stringify({ 
                phone: phone, 
                order_suffix: orderSuffix 
            })
        });
    },

    // --- 保留旧接口以防你的旧代码报错 (可选，不用的话可以删掉) ---
    getConfig: () => request('/api/config'),
    login: (openid) => console.log('Legacy login called'), 
    // --------------------------------------------------------
};