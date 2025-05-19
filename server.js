// 导入必要的模块
const express = require('express');    // Express框架，用于创建Web服务器
const multer = require('multer');      // Multer中间件，用于处理文件上传
const path = require('path');          // Node.js路径模块，用于处理文件路径
const cors = require('cors');          // CORS中间件，用于处理跨域请求
const fs = require('fs');              // Node.js文件系统模块，用于文件操作s

// 创建Express应用实例
const app = express();
// 设置服务器端口号
const port = 3000;

// 启用CORS中间件，允许跨域请求
app.use(cors());

// 添加 JSON 解析中间件
app.use(express.json());

// 添加请求日志中间件，记录所有HTTP请求
app.use((req, res, next) => {
    // 记录请求时间、方法和URL
    console.log(`[${new Date().toLocaleString()}] ${req.method} ${req.url}`);
    next();
});

// 配置文件存储选项
const storage = multer.diskStorage({
    // 设置文件存储的目标目录
    destination: function (req, file, cb) {
        const uploadDir = 'uploads';
        // 检查上传目录是否存在，不存在则创建
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir);
        }
        console.log(`[${new Date().toLocaleString()}] 准备保存文件到目录: ${uploadDir}`);
        cb(null, uploadDir);
    },
    // 设置文件的存储名称
    filename: function (req, file, cb) {
        // 生成唯一文件名：时间戳 + 随机数 + 原文件扩展名
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const filename = uniqueSuffix + path.extname(file.originalname);
        console.log(`[${new Date().toLocaleString()}] 生成文件名: ${filename}`);
        cb(null, filename);
    }
});

// 文件类型过滤器
const fileFilter = (req, file, cb) => {
    // 记录正在检查的文件类型
    console.log(`[${new Date().toLocaleString()}] 检查文件类型: ${file.mimetype}`);
    
    // 定义允许上传的文件类型列表
    const allowedTypes = [
        'text/plain',          // 文本文件
        'application/pdf',     // PDF文件
        'image/jpeg',         // JPEG图片
        'image/png',          // PNG图片
        'application/json',    // JSON文件
        'text/csv',           // CSV文件
        'application/vnd.ms-excel',  // Excel文件(.xls)
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',  // Excel文件(.xlsx)
        'application/vnd.ms-excel.sheet.macroEnabled.12'  // 启用宏的Excel文件(.xlsm)
    ];

    // 检查文件类型是否在允许列表中
    if (allowedTypes.includes(file.mimetype)) {
        console.log(`[${new Date().toLocaleString()}] 文件类型验证通过`);
        cb(null, true);
    } else {
        console.log(`[${new Date().toLocaleString()}] 文件类型验证失败: ${file.mimetype}`);
        cb(new Error('不支持的文件类型'), false);
    }
};

// 创建multer实例，配置上传选项
const upload = multer({
    storage: storage,         // 使用之前配置的存储设置
    fileFilter: fileFilter,   // 使用文件类型过滤器
    limits: {
        fileSize: 5 * 1024 * 1024  // 限制文件大小为5MB
    }
});

// 文件上传接口
app.post('/upload', upload.single('file'), (req, res) => {
    try {
        // 检查是否有文件被上传
        if (!req.file) {
            console.log(`[${new Date().toLocaleString()}] 上传失败: 没有文件被上传`);
            return res.status(400).json({ error: '没有文件被上传' });
        }

        // 记录上传成功的文件信息
        console.log(`[${new Date().toLocaleString()}] 文件上传成功:`);
        console.log(`- 原始文件名: ${req.file.originalname}`);
        console.log(`- 保存文件名: ${req.file.filename}`);
        console.log(`- 文件大小: ${(req.file.size / 1024).toFixed(2)} KB`);
        console.log(`- 文件类型: ${req.file.mimetype}`);
        console.log(`- 保存路径: ${req.file.path}`);

        // 返回成功响应，包含文件信息
        res.json({
            success: true,
            file: {
                filename: req.file.filename,
                originalname: req.file.originalname,
                size: req.file.size,
                mimetype: req.file.mimetype
            }
        });
    } catch (error) {
        // 处理上传过程中的错误
        console.error(`[${new Date().toLocaleString()}] 上传出错:`, error);
        res.status(500).json({ error: error.message });
    }
});

// 错误处理中间件
app.use((err, req, res, next) => {
    // 处理multer相关的错误
    if (err instanceof multer.MulterError) {
        console.error(`[${new Date().toLocaleString()}] Multer错误:`, err);
        // 处理文件大小超限错误
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: '文件大小超过5MB限制' });
        }
        return res.status(400).json({ error: err.message });
    }
    // 处理其他类型的错误
    console.error(`[${new Date().toLocaleString()}] 服务器错误:`, err);
    res.status(500).json({ error: err.message });
});

// 启动服务器
app.listen(port, () => {
    console.log(`[${new Date().toLocaleString()}] 服务器启动成功`);
    console.log(`[${new Date().toLocaleString()}] 服务器运行在 http://localhost:${port}`);
    console.log(`[${new Date().toLocaleString()}] 等待文件上传...`);
}); 

//流式接入DeepSeek
app.post('/deepseek', async (req, res) => {
    console.log(req.body);
    const userMessage = req.body.message;
    const model = req.body.model;
    const apiKey = req.body.apiKey;
    const url = req.body.url;
    
    res.set({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });

    // 发起流式请求
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: model,
            messages: [
                { role: "system", content: "You are a helpful assistant." },
                { role: 'user', content: userMessage }
            ],
            stream: true
        })
    });
    if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
    }

    // 逐步读取流式内容
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        res.write(chunk); // 或格式化为 SSE 格式：res.write(`data: ${chunk}\n\n`);
    }
    res.end();
});