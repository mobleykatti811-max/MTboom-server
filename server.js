require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ==========================================
// 🌟 核心修复：必须把这行放在最前面！
// ==========================================
app.use(express.static('public'));

// 替换点：从 process.env 读取密钥
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
// API 接口
app.get('/api/config', async (req, res) => {
    console.log('收到配置请求...');
    const { data, error } = await supabase.from('t_config').select('*');
    
    if (error) {
        console.error('数据库报错:', error);
        return res.status(500).json({ error: error.message });
    }
    
    const configMap = {};
    if(data) {
        data.forEach(item => { configMap[item.key_name] = item.key_value; });
    }
    
    res.json({
        success: true,
        config: configMap,
        message: "来自香港服务器的问候：数据库连接正常！"
    });
});

// 启动监听
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 服务器已启动: http://localhost:${PORT}`);
});
