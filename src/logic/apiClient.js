// src/logic/apiClient.js

// 🟢 自动判定：如果是本地环境，使用 localhost:3000；如果是线上，使用带 https 的主域名
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

const API_BASE_URL = isLocal 
    ? 'http://localhost:3000' 
    : 'https://mtboom-ar.site'; // 🟢 线上环境建议走 Nginx 转发，不带端口号

/**
 * 通用请求处理函数
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
// 📦 业务接口导出
// ==========================================
export const apiClient = {
    // 1. 获取礼物 (收礼人视角)
    getGift: (oid) => {
        return request('/api/get-gift', {
            method: 'POST',
            body: JSON.stringify({ internal_oid: oid })
        });
    },

    // 2. 预下单 (送礼人视角)
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

    // 3. 查单 (回航/法宝库)
    checkUnlock: (phone, internal_oid) => {
        return request('/api/check-unlock', {
            method: 'POST',
            body: JSON.stringify({ 
                phone: phone, 
                internal_oid: internal_oid 
            })
        });
    },

    // 4. 登录 (后台统计用，可选)
    login: (username, role, secret) => {
        // 如果后端没写这个接口，前端可以先留空或者模拟成功
        console.log("模拟登录:", username);
        return Promise.resolve({ success: true });
    }
}