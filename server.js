import express from 'express';
import { createClient } from '@supabase/supabase-js';
import bodyParser from 'body-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'crypto';
import fs from 'fs'; // 🟢 最小改动：新增
import https from 'https'; // 🟢 最小改动：新增
import axios from 'axios'; // 🟢 最小改动：移至顶部

dotenv.config();

const app = express();
app.use(cors());
// 🟢 修改这一行，将限制放大到 10MB，防止照片数据被截断
app.use(bodyParser.json({ limit: '10mb' })); 
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

// 1. 必须先初始化 Supabase，后面路由才能用
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// 2. 签名校验工具函数
function verifyMbdSignature(params, appKey) {
    const { sign, ...data } = params;
    if (!sign) return false;
    const sortedKeys = Object.keys(data).sort();
    const stringA = sortedKeys.map(key => `${key}=${data[key]}`).join('&');
    const stringSignTemp = `${stringA}&key=${appKey}`;
    const hash = crypto.createHash('md5').update(stringSignTemp).digest('hex');
    return hash === sign;
}

// 1. 定义全局圣诞限免开关 (今晚设为 true，平时设为 false)
const IS_XMAS_FREE = true; 

// ... 其他代码 ...

// server.js
// --- 新增：收礼人查询接口 ---
app.post('/api/get-gift', async (req, res) => {
    try {
        const { internal_oid } = req.body;
        // 只要 oid 匹配且状态为 paid，就允许读取
        const { data: order, error } = await supabase
            .from('orders')
            .select('product_key, gift_data, status')
            .eq('internal_oid', internal_oid)
            .single();

        if (error || !order) return res.status(404).json({ error: "礼物不存在" });
        
        res.json({ 
            success: true, 
            product_key: order.product_key, 
            gift_data: order.gift_data,
            status: order.status
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/create-intent', async (req, res) => {
    try {
        const { product_key, phone, gift_data } = req.body;
        const internal_oid = 'MT' + Date.now() + Math.floor(Math.random() * 1000);
        
        // 2. 根据开关决定初始状态
        // 如果是限免模式，状态直接设为 'paid' 并记录当前时间，否则为 'pending'
        const initialStatus = IS_XMAS_FREE ? 'paid' : 'pending';
        const paidAt = IS_XMAS_FREE ? new Date() : null;

        const { error } = await supabase
            .from('orders')
            .insert({
                internal_oid,
                phone,
                product_key,
                gift_data: gift_data || {},
                status: initialStatus, // 核心改动
                paid_at: paidAt        // 核心改动
            });
        
        if (error) throw error;
        
        // 返回包含当前模式的响应，方便前端判断是否需要跳转支付
        res.json({ 
            internal_oid, 
            is_free: IS_XMAS_FREE, 
            message: IS_XMAS_FREE ? "圣诞限免已激活" : "预下单成功" 
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ------------------------------------------
// 接口 B: 面包多 Webhook (安全校验版)
// ------------------------------------------
app.post('/api/webhook/mbd', async (req, res) => {
    const mbdData = req.body;
    const APP_KEY = process.env.MBD_APP_KEY;

    try {
        // 🔒 安全校验：非面包多发来的请求直接拦截
        if (!verifyMbdSignature(mbdData, APP_KEY)) {
            console.error("❌ 签名校验失败");
            return res.status(403).send('Invalid Signature');
        }

        const { order_id, custom_id, contact } = mbdData;
        console.log(`✅ 支付成功: ${contact} - ${custom_id}`);

        const { error } = await supabase
            .from('orders')
            .update({ 
                status: 'paid', 
                order_id: order_id, 
                paid_at: new Date()
            })
            .eq('internal_oid', custom_id);

        if (error) throw error;
        res.send('success');
    } catch (error) {
        console.error("更新订单失败:", error);
        res.status(500).send('Error');
    }
});

// --- 主动去面包多查询订单状态的函数 ---
async function queryMbdOrder(custom_id) {
    const APP_KEY = process.env.MBD_APP_KEY; // 从 .env 获取
    const mbd_app_id = APP_KEY.split(':')[0]; // 提取 APP_ID
    
    // 构造签名
    const data = { app_id: mbd_app_id, custom_id: custom_id };
    const sortedKeys = Object.keys(data).sort();
    const stringA = sortedKeys.map(k => `${k}=${data[k]}`).join('&');
    const stringSignTemp = `${stringA}&key=${APP_KEY}`;
    const sign = crypto.createHash('md5').update(stringSignTemp).digest('hex');

    try {
        const response = await axios.post('https://api.mianbaoduo.com/release/order/check', {
            ...data,
            sign: sign
        });
        return response.data; // 面包多会返回 { state: 'paid' } 或其他状态
    } catch (e) {
        console.error("查询面包多接口失败:", e.message);
        return null;
    }
}

// --- 修改后的接口 C: 法宝库查单 (集成主动查询) ---
app.post('/api/check-unlock', async (req, res) => {
    try {
        const { phone, internal_oid } = req.body; 
        
    // 🟢 开发者后门：如果是你的测试号，直接返回成功，不查数据库也不查面包多
        const myTestPhones = ['18826108872']; 
        if (myTestPhones.includes(phone)) {
            console.log("🛠️ 开发者测试模式：自动解锁");
            return res.json({ 
                success: true, 
                product: 'GoldenTree' // 或者你想测试的任何 key
            });
        }

        // 1. 先查本地 Supabase 数据库
        let { data: order, error } = await supabase
            .from('orders')
            .select('*')
            .eq('internal_oid', internal_oid)
            .single();

        if (error || !order) return res.status(404).json({ error: "订单不存在" });

        // 2. 如果本地还是 pending，说明 Webhook 没生效，我们主动问一下
        if (order.status === 'pending') {
            const mbdResult = await queryMbdOrder(internal_oid);
            
            // 如果官方确认付了钱 (状态字段为 state)
            if (mbdResult && mbdResult.state === 'paid') {
                // 3. 官方确认付了，立刻更新本地数据库
                const { error: updateErr } = await supabase
                    .from('orders')
                    .update({ 
                        status: 'paid', 
                        order_id: mbdResult.order_id, 
                        paid_at: new Date() 
                    })
                    .eq('internal_oid', internal_oid);
                
                if (!updateErr) order.status = 'paid';
            }
        }

        res.json({ 
            success: order.status === 'paid', 
            product: order.product_key 
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 🟢 最小改动：配置 SSL 证书并以 HTTPS 方式启动 3000 端口
// const sslOptions = {
//     cert: fs.readFileSync('/etc/letsencrypt/live/mtboom-ar.site/fullchain.pem'),
//     key: fs.readFileSync('/etc/letsencrypt/live/mtboom-ar.site/privkey.pem')
// };

// server.js 底部

// 1. 定义证书路径
const CERT_PATH = '/etc/letsencrypt/live/mtboom-ar.site/fullchain.pem';
const KEY_PATH = '/etc/letsencrypt/live/mtboom-ar.site/privkey.pem';

// 2. 自动判断环境：如果证书文件存在，说明是线上服务器，否则是本地
if (fs.existsSync(CERT_PATH) && fs.existsSync(KEY_PATH)) {
    // --- 线上环境 (HTTPS) ---
    const sslOptions = {
        cert: fs.readFileSync(CERT_PATH),
        key: fs.readFileSync(KEY_PATH)
    };
    https.createServer(sslOptions, app).listen(3000, () => {
        console.log('🚀 [线上模式] HTTPS Server 运行在 3000 端口');
    });
} else {
    // --- 本地环境 (HTTP) ---
    app.listen(3000, () => {
        console.log('🛠️ [本地模式] HTTP Server 运行在 3000 端口 (无需证书)');
    });
}