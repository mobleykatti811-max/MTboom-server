require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// ==========================================
// 🛠️ 路由挂载区
// ==========================================

// 1. 引入路由文件
const userRoutes = require('./routes/userRoutes');
const wishRoutes = require('./routes/wishRoutes'); // 新增
const orderRoutes = require('./routes/orderRoutes'); // 新增
const { createClient } = require('@supabase/supabase-js'); // 如果下面config要用

// 2. 注册路由
// 登录接口 -> /api/login
app.use('/api', userRoutes); 

// 许愿接口 -> /api/wish/save, /api/wish/:uuid
app.use('/api/wish', wishRoutes); 

// 订单接口 -> /api/order/create
app.use('/api/order', orderRoutes);

// 3. 全局配置接口 (简单起见直接写在这里)
// GET /api/config
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
app.get('/api/config', async (req, res) => {
    const { data } = await supabase.from('t_config').select('*');
    const configMap = {};
    if(data) data.forEach(item => { configMap[item.key_name] = item.key_value; });
    res.json({ success: true, config: configMap });
});

// ==========================================
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 全栈服务运行中: http://localhost:${PORT}`);
});