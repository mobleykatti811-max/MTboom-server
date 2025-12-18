// server.js
import express from 'express';
import { createClient } from '@supabase/supabase-js';
import bodyParser from 'body-parser';
import cors from 'cors';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// 初始化 Supabase
// ⚠️ 确保 .env 文件里有这两个变量
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// ------------------------------------------
// 接口 A: 预下单 (前端点"送礼/解锁"时调用)
// ------------------------------------------
app.post('/api/create-intent', async (req, res) => {
    try {
        const { product_key, phone, gift_data } = req.body;
        
        // 生成一个内部订单号
        const internal_oid = 'MT' + Date.now() + Math.floor(Math.random() * 1000);

        // 存入数据库
        const { error } = await supabase
            .from('orders')
            .insert({
                internal_oid: internal_oid,
                phone: phone,
                product_key: product_key,
                gift_data: gift_data || {},
                status: 'pending'
            });

        if (error) throw error;

        res.json({ internal_oid, message: "预下单成功" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ------------------------------------------
// 接口 B: 面包多 Webhook (支付成功回调)
// ------------------------------------------
app.post('/api/webhook/mbd', async (req, res) => {
    try {
        const { order_id, custom_id, contact } = req.body; 

        console.log(`收到支付回调: ${contact} - ${custom_id}`);

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
        console.error("更新订单失败", error);
        res.status(500).send('Error');
    }
});

// ------------------------------------------
// 接口 C: 法宝库查单 / 鉴权 (前端调用)
// ------------------------------------------
app.post('/api/check-unlock', async (req, res) => {
    try {
        const { phone, order_suffix } = req.body;

        const { data: orders, error } = await supabase
            .from('orders')
            .select('product_key, gift_data, order_id')
            .eq('phone', phone)
            .eq('status', 'paid');

        if (error) throw error;

        // 简单过滤：如果填了后缀，必须匹配
        const validOrders = order_suffix 
            ? orders.filter(o => o.order_id && o.order_id.endsWith(order_suffix))
            : orders;

        if (validOrders.length > 0) {
            res.json({ 
                success: true, 
                products: validOrders.map(o => o.product_key),
                gifts: validOrders.filter(o => o.gift_data && o.gift_data.msg)
            });
        } else {
            res.json({ success: false, message: "未查询到订单或校验失败" });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 服务器运行在端口 ${PORT}`));