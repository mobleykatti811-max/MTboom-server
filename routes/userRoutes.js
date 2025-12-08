const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// ==========================================
// 登录接口 (同时返回已拥有的权益)
// ==========================================
router.post('/login', async (req, res) => {
    console.log('➡️ [User] 收到登录请求:', req.body);
    const { openid, nickname, avatar } = req.body;

    if (!openid) return res.status(400).json({ error: '缺少 openid' });

    // 1. 注册/更新用户信息 (Upsert)
    const { data: user, error } = await supabase
        .from('t_user')
        .upsert({ 
            openid, 
            nickname: nickname || '神秘圣诞人',
            avatar: avatar || '',
            updated_at: new Date()
        }, { onConflict: 'openid' })
        .select()
        .single();

    if (error) {
        console.error('❌ 登录失败:', error);
        return res.status(500).json({ error: error.message });
    }

    // 2. 【严谨逻辑】查订单表，看他买过什么
    // 查找所有 status=1 (已支付) 的订单
    const { data: orders } = await supabase
        .from('t_order')
        .select('product_code')
        .eq('uid', user.id)
        .eq('status', 1);

    // 3. 整理权益列表
    // 比如变成: ['maserati_unlock', 'tree_diamond']
    const unlockedProducts = orders ? orders.map(o => o.product_code) : [];
    
    // 如果列表里有玛莎拉蒂，前端就知道他是尊贵的玛莎拉蒂车主
    console.log(`✅ 用户 ${user.nickname} 登录，拥有权益:`, unlockedProducts);

    res.json({ 
        success: true, 
        user: user,
        unlocked_products: unlockedProducts // 告诉前端他买了啥
    });
});

module.exports = router;