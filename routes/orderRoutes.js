const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// ==========================================
// 创建订单 (纯记账模式)
// ==========================================
router.post('/create', async (req, res) => {
    console.log('💰 [Order] 收到下单请求:', req.body);
    const { openid, product_code, amount } = req.body;

    if (!openid || !product_code) return res.status(400).json({ error: '缺少参数' });

    // 1. 先查出用户的 uid (因为订单表关联的是 uid 不是 openid)
    const { data: userData, error: userError } = await supabase
        .from('t_user')
        .select('id')
        .eq('openid', openid)
        .single();
    
    if (userError || !userData) {
        return res.status(404).json({ error: '用户不存在，请先登录' });
    }

    // 2. 生成订单号
    const orderNo = 'ORD_' + Date.now() + Math.floor(Math.random() * 1000);

    // 3. 写入订单表 (直接标记为已支付 status=1)
    // 这里我们只负责记录“这个人买了这款车”，不做其他多余动作
    const { error: orderError } = await supabase
        .from('t_order')
        .insert({
            order_no: orderNo,
            uid: userData.id, // 关联真实的用户ID
            amount: amount || 9.9,
            product_code: product_code, // 关键：记录买了哪个产品
            status: 1, // Mock 支付成功
            pay_platform: 'mock' 
        });

    if (orderError) {
        console.error('❌ 订单创建失败:', orderError);
        return res.status(500).json({ error: orderError.message });
    }

    console.log(`✅ [Mock支付] 用户 ${userData.id} 购买 ${product_code} 成功!`);
    
    // 返回成功，前端收到后应该重新调用 /login 或刷新配置来更新权益
    res.json({ success: true, message: '支付成功' });
});

module.exports = router;