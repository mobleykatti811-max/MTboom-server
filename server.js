// server.js - 现在的职责只是：启动 + 挂载
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// ==========================================
// 🛠️ 路由挂载区 (Controller Registration)
// ==========================================

// 1. 引入路由文件
const userRoutes = require('./routes/userRoutes');

// 2. 挂载路由
// 意思是：凡是访问 /api 的请求，都去 userRoutes 里找
app.use('/api', userRoutes);

// ==========================================

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 服务已启动: http://localhost:${PORT}`);
});