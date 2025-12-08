const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// ==========================================
// 创建订单并模拟支付 (POST /api/order/create)
// ==========================================
router.post('/create', async (req, res) => {
    console.log('💰 [Order] 收到下单请求:', req.body);
    const { openid, product_code, amount } = req.body;

    if (!openid || !product_code) return res.status(400).json({ error: '缺少参数' });

    // 1. 生成一个模拟订单号
    const orderNo = 'ORD_' + Date.now() + Math.floor(Math.random() * 1000);

    // 2. 写入订单表 (直接标记为已支付 status=1)
    // MVP 阶段跳过微信支付回调，直接通过
    const { error: orderError } = await supabase
        .from('t_order')
        .insert({
            order_no: orderNo,
            uid: 0, // 暂时存0，或者你需要先查user表拿到uid。为了速度，甚至可以存openid在备注里
            // 修正：更严谨的做法是先根据openid查uid，这里为了演示简化：
            amount: amount || 9.9,
            product_code: product_code,
            status: 1, // <--- 关键！直接设为“已支付”
            pay_platform: 'mock' 
        });

    if (orderError) {
        console.error('❌ 订单创建失败:', orderError);
        return res.status(500).json({ error: orderError.message });
    }

    // 3. 核心：给用户开通 VIP 权限 (玛莎拉蒂解锁)
    const { error: userError } = await supabase
        .from('t_user')
        .update({ is_vip: 1, vip_source: 'PAID' })
        .eq('openid', openid);

    if (userError) {
        console.error('❌ VIP开通失败:', userError);
        return res.status(500).json({ error: '扣款成功但VIP开通失败' });
    }

    console.log(`✅ [Mock支付] 用户 ${openid} 已解锁玛莎拉蒂!`);
    res.json({ success: true, message: '支付成功，权益已到账' });
});

module.exports = router;