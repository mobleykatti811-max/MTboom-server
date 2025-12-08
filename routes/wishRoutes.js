const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid'); // 需要安装 uuid 库

// 初始化数据库
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// ==========================================
// 1. 保存祝福 (POST /api/wish/save)
// ==========================================
router.post('/save', async (req, res) => {
    console.log('🎁 [Wish] 收到保存请求:', req.body);
    const { openid, content, skin_type } = req.body;

    if (!openid || !content) {
        return res.status(400).json({ error: '缺少必要参数' });
    }

    // 生成唯一的礼物 ID (比如: 550e8400-e29b...)
    const giftUuid = uuidv4();

    const { data, error } = await supabase
        .from('t_wish')
        .insert({
            uuid: giftUuid,
            openid: openid,
            content: content, // 祝福语
            skin_type: skin_type || 'tree_gold', // 默认皮肤
            status: 1
        })
        .select()
        .single();

    if (error) {
        console.error('❌ 保存祝福失败:', error);
        return res.status(500).json({ error: error.message });
    }

    console.log('✅ 祝福已生成, UUID:', giftUuid);
    res.json({ success: true, uuid: giftUuid });
});

// ==========================================
// 2. 获取祝福详情 (GET /api/wish/:uuid)
// ==========================================
// 前端打开分享链接时调用，比如 /api/wish/550e8400...
router.get('/:uuid', async (req, res) => {
    const { uuid } = req.params;
    
    // 增加浏览次数 (可选，不阻塞主逻辑)
    // supabase.rpc('increment_view_count', { row_id: uuid }); 

    const { data, error } = await supabase
        .from('t_wish')
        .select('*')
        .eq('uuid', uuid)
        .single();

    if (error) {
        return res.status(404).json({ error: '未找到该祝福或已被删除' });
    }

    res.json({ success: true, data });
});

module.exports = router;