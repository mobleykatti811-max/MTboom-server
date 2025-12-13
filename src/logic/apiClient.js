// src/logic/apiClient.js

// 🌍 核心配置
// 开发阶段：直接连你的香港服务器 IP
// 上线阶段：如果前端也部署在同一个服务器，可以改成 '' (相对路径)
const API_BASE_URL = 'http://43.154.251.175:3000'; 

/**
 * 通用请求处理函数 (处理 JSON 和 错误)
 */
async function request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    
    // 默认通过 JSON 通信
    const defaultHeaders = {
        'Content-Type': 'application/json',
    };

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
        throw error; // 继续抛出，让 UI 层处理报错
    }
}

// ==========================================
// 📦 业务接口导出
// ==========================================

export const apiClient = {
    // 1. 初始化配置 (获取价格、文案)
    getConfig: () => {
        return request('/api/config');
    },

    // 2. 静默登录 (获取用户身份 + 权益)
    // 对应后端: routes/userRoutes.js
    login: (openid, nickname, avatar) => {
        return request('/api/login', {
            method: 'POST',
            body: JSON.stringify({ openid, nickname, avatar })
        });
    },

    // 3. 创建订单 (模拟支付/解锁玛莎拉蒂)
    // 对应后端: routes/orderRoutes.js
    createOrder: (openid, productCode = 'maserati_unlock', amount = 9.9) => {
        return request('/api/order/create', {
            method: 'POST',
            body: JSON.stringify({ openid, product_code: productCode, amount })
        });
    },
 
    // 4. 保存祝福 (生成了分享链接)
    // 对应后端: routes/wishRoutes.js
    saveWish: (openid, content, skinType = 'tree_gold') => {
        return request('/api/wish/save', {
            method: 'POST',
            body: JSON.stringify({ openid, content, skin_type: skinType })
        });
    },

    // 5. 获取祝福详情 (被分享人打开时调用)
    // 对应后端: routes/wishRoutes.js
    getWish: (uuid) => {
        return request(`/api/wish/${uuid}`);
    }
};