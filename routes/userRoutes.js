// routes/userRoutes.js
// 相当于 Java 的 UserController

const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

// 每个路由文件单独连接数据库，保证模块独立
// (在 Node.js 中这很轻量，不用担心性能)
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// ==========================================
// 业务逻辑区域
// ==========================================

// POST /login (注意：这里只需要写 /login，因为外层会挂载 /api)
router.post('/login', async (req, res) => {
    console.log('➡️ [User] 收到登录请求:', req.body);
    const { openid, nickname, avatar } = req.body;

    if (!openid) return res.status(400).json({ error: '缺少 openid' });

    // 数据库操作
    const { data, error } = await supabase
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

    console.log('✅ 登录成功:', data.nickname);
    res.json({ success: true, user: data });
});

// 导出路由，给 server.js 使用
module.exports = router;

