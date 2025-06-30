// 导入必要的模块
import express from 'express';    // Express框架，用于创建Web服务器
import multer from 'multer';      // Multer中间件，用于处理文件上传
import path from 'path';          // Node.js路径模块，用于处理文件路径
import cors from 'cors';          // CORS中间件，用于处理跨域请求
import fetch from 'node-fetch';   // node-fetch模块，用于发送HTTP请求
import FormData from 'form-data'; // FormData模块，用于处理文件上传
import fs from 'fs';              // Node.js文件系统模块，用于文件操作
import { createReadStream } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { userDB } from './data_base_functions/codes/user_DB.js'; // 导入用户数据库操作模块
import { dbUtil } from './data_base_functions/utile/DB_utile.js'; // 导入数据库工具模块
import ConversationDB from './data_base_functions/codes/conversation_DB.js'; // 导入会话数据库操作模块
import MessageDB from './data_base_functions/codes/message_DB.js'; // 导入消息数据库操作模块

// 创建数据库实例
const conversationDB = new ConversationDB();
const messageDB = new MessageDB();

// 初始化数据库
(async () => {
    try {
        // 先初始化用户数据库
        await userDB.init();
        console.log(`[${new Date().toLocaleString()}] 用户数据库初始化成功`);
        
        // 再初始化会话数据库
        await conversationDB.init();
        console.log(`[${new Date().toLocaleString()}] 会话数据库初始化成功`);
        
        // 最后初始化消息数据库（因为它依赖于会话表）
        await messageDB.init();
        console.log(`[${new Date().toLocaleString()}] 消息数据库初始化成功`);
    } catch (error) {
        console.error(`[${new Date().toLocaleString()}] 数据库初始化失败:`, error);
        process.exit(1); // 如果数据库初始化失败，终止服务器
    }
})();

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 创建Express应用实例
const app = express();
// 设置服务器端口号
const port = 3000;

// 启用CORS中间件，允许跨域请求
app.use(cors());

// 添加 JSON 解析中间件
app.use(express.json());

// 配置静态文件服务
app.use(express.static(__dirname));

// 添加明确的路由处理home页面的请求
app.get('/home', (req, res) => {
    res.sendFile(path.join(__dirname, 'home.html'));
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'home.html'));
});

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
        // 处理文件名编码
        const originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
        // 生成唯一文件名：时间戳 + 随机数 + 原文件扩展名
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const filename = uniqueSuffix + path.extname(originalname);
        console.log(`[${new Date().toLocaleString()}] 生成文件名: ${filename}`);
        // 将处理后的原始文件名保存到 file 对象中
        file.decodedOriginalname = originalname;
        cb(null, filename);
    }
});

// 文件类型过滤器
const fileFilter = (req, file, cb) => {
    // 记录正在检查的文件类型
    console.log(`[${new Date().toLocaleString()}] 检查文件类型: ${file.mimetype}`);
    
    // 定义允许上传的文件类型列表
    const allowedTypes = [
        'application/pdf',     // PDF文件
        'image/jpeg',         // JPEG图片
        'image/png',          // PNG图片
        'application/json',    // JSON文件
        'text/csv',           // CSV文件
        'application/vnd.ms-excel',  // Excel文件(.xls)
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',  // Excel文件(.xlsx)
        'application/vnd.ms-excel.sheet.macroEnabled.12',  // 启用宏的Excel文件(.xlsm)
        'application/msword',  // Word文件(.doc)
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'  // Word文件(.docx)
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
        console.log(`- 原始文件名: ${req.file.decodedOriginalname}`);
        console.log(`- 保存文件名: ${req.file.filename}`);
        console.log(`- 文件大小: ${(req.file.size / 1024).toFixed(2)} KB`);
        console.log(`- 文件类型: ${req.file.mimetype}`);
        console.log(`- 保存路径: ${req.file.path}`);

        // 返回成功响应，包含文件信息
        res.json({
            success: true,
            file: {
                filename: req.file.filename,
                originalname: req.file.decodedOriginalname,
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

// 删除文件接口
app.delete('/delete/:filename', (req, res) => {
    try {
        const filename = req.params.filename;
        const filePath = path.join('uploads', filename);

        // 检查文件是否存在
        if (!fs.existsSync(filePath)) {
            console.log(`[${new Date().toLocaleString()}] 删除失败: 文件不存在 - ${filename}`);
            return res.status(404).json({ error: '文件不存在' });
        }

        // 删除文件
        fs.unlinkSync(filePath);
        console.log(`[${new Date().toLocaleString()}] 文件删除成功: ${filename}`);

        res.json({
            success: true,
            message: '文件删除成功'
        });
    } catch (error) {
        console.error(`[${new Date().toLocaleString()}] 删除文件时出错:`, error);
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
    const userMessage = req.body.message;
    const model = req.body.model;
    const apiKey = req.body.apiKey;
    const url = req.body.url;
    
    res.set({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });

    try {
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

        // 使用 Node.js 的流处理方式
        response.body.pipe(res);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

//流式接入Coze
app.post('/coze', async (req, res) => {
    const userMessage = req.body.message;
    const model = req.body.model;
    const apiKey = req.body.apiKey;
    const url = req.body.url;
    const botId = req.body.botId;
    
    res.set({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                "bot_id": botId,
                "user_id": "123456",
                "stream": true,
                "additional_messages": [{
                    "role": "user",
                    "content": userMessage,
                    "content_type": "text"
                }]
            })
        });

        if (!response.ok) {
            throw new Error(`API request failed: ${response.status}`);
        }

        // 使用 Node.js 的流处理方式
        response.body.pipe(res);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});
//带文件对话，先将文件上传至扣子获得id，再将id和message发送至coze，流式接入
app.post('/coze/upload',async(req,res)=>{
    const filesInf  = req.body.files;
    const url = req.body.url;
    const apiKey = req.body.apiKey;
    const botId = req.body.botId;
    const message = req.body.message;
    let fileIds;
    try{
        fileIds = await multipleFilesToCoze(filesInf,apiKey);
    }catch(error){
        console.error(`[${new Date().toLocaleString()}] 上传文件失败:`, error);
        return res.status(500).json({ error: error.message });
    }

    let content = "";
    content+="[{\"type\":\"text\",\"text\":\""+message+"\"}";
    for(let i=0;i<fileIds.length;i++){
        if(filesInf[i].mimetype.startsWith("image/")){
            content+=",{\"type\":\"image\",\"file_id\":\""+fileIds[i]+"\"}";
        }else if(filesInf[i].mimetype.startsWith("audio/")){
            content+=",{\"type\":\"audio\",\"file_id\":\""+fileIds[i]+"\"}";
        }else{
            content+=",{\"type\":\"file\",\"file_id\":\""+fileIds[i]+"\"}";
        }
    };
    content+="]";
    res.set({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });
    try {
        const response = await fetch(url,{
            method:'POST',
            headers:{
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body:JSON.stringify({
                "bot_id": botId,
                "user_id": "123456",
                "stream": true,
                "additional_messages": [{
                    "role": "user",
                    "content": content,
                    "content_type": "object_string"
                }]
            })
        });
        console.log(response);
        if(!response.ok){
            throw new Error(`API request failed: ${response.status}`);
        }

        // 使用 Node.js 的流处理方式
        response.body.pipe(res);
        
        // 监听流的结束事件
        response.body.on('end', () => {
            // 在流结束后删除文件
            for(const file of filesInf){
                const filePath = path.join('uploads', file.filename);
                try {
                    // 删除文件
                    fs.unlinkSync(filePath);
                    console.log(`[${new Date().toLocaleString()}] 文件删除成功: ${file.filename}`);
                } catch (error) {
                    console.error(`[${new Date().toLocaleString()}] 删除文件失败: ${file.filename}`, error);
                }
            }
        });
        
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});
//发送单个文件至coze并获取文件id
async function singleFileToCoze(fileInf,url,apiKey){
    const filePath = path.join('uploads', fileInf.filename);
    const form = new FormData();
    form.append('file',fs.createReadStream(filePath));
    
    //使用fetch去呼叫coze的文件上传接口
    return fetch(url,{
        method:'POST',
        headers:{
            'Authorization': `Bearer ${apiKey}`,
            ...form.getHeaders() // 自动添加 FormData 所需的 Content-Type 等头信息
        },
        body:form
    }).then(response => {
        if(!response.ok){
            throw new Error(`API request failed: ${response.status}`);
        }
        return response.json();
    }).then(data => {
        console.log(data);
        if(data.code !== 0){
            throw new Error(`API request failed: ${data.message}`);
        }
        return data.data.id;
    }).catch(error => {
        console.error(`[${new Date().toLocaleString()}] 上传文件失败:`, error);
        throw error;
    });
}
//发送多个文件至coze并获取文件id
async function multipleFilesToCoze(filesInf,apiKey){
    const fileIds = [];
    const url = "https://api.coze.cn/v1/files/upload";
    for(const fileInf of filesInf){
        console.log("正在处理文件："+fileInf.filename)
        const fileId = await singleFileToCoze(fileInf,url,apiKey);
        console.log("文件id："+fileId);
        fileIds.push(fileId);
    }
    return fileIds;
}

//coze发起会话
app.post('/coze/create_session',async(req,res)=>{
    const url = req.body.url;
    const apiKey = req.body.apiKey;
    const botId = req.body.botId;
    const response = await fetch(url,{
        method:'POST',
        headers:{
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body:JSON.stringify({
            "bot_id": botId
        })
    });
    if(!response.ok){
        throw new Error(`API request failed: ${response.status}`);
    }
    const data = await response.json();
    console.log(data);
    res.json(data);
    res.end();
});

//扣子基于会话id发起对话，流式
app.post('/coze/conversation', async (req, res) => {
    const userMessage = req.body.message;
    const apiKey = req.body.apiKey;
    const url = req.body.url;
    const botId = req.body.botId;
    const conversationId = req.body.conversationId;
    res.set({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });

    try {
        const response = await fetch(url+'?conversation_id='+conversationId, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                "bot_id": botId,
                "user_id": "123456",
                "stream": true,
                "additional_messages": [{
                    "role": "user",
                    "content": userMessage,
                    "content_type": "text"
                }]
            })
        });

        if (!response.ok) {
            throw new Error(`API request failed: ${response.status}`);
        }

        // 使用 Node.js 的流处理方式
        //console.log(response.body);
        response.body.pipe(res);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

//带文件对话，带会话id，流式接入，先将文件上传至扣子获得id，再将id和message发送至coze
app.post('/coze/conversation/upload',async(req,res)=>{
    const filesInf  = req.body.files;
    const url = req.body.url;
    const apiKey = req.body.apiKey;
    const botId = req.body.botId;
    const message = req.body.message;
    const conversationId = req.body.conversationId;
    let fileIds;
    try{
        fileIds = await multipleFilesToCoze(filesInf,apiKey);
    }catch(error){
        console.error(`[${new Date().toLocaleString()}] 上传文件失败:`, error);
        return res.status(500).json({ error: error.message });
    }

    let content = "";
    content+="[{\"type\":\"text\",\"text\":\""+message+"\"}";
    for(let i=0;i<fileIds.length;i++){
        if(filesInf[i].mimetype.startsWith("image/")){
            content+=",{\"type\":\"image\",\"file_id\":\""+fileIds[i]+"\"}";
        }else if(filesInf[i].mimetype.startsWith("audio/")){
            content+=",{\"type\":\"audio\",\"file_id\":\""+fileIds[i]+"\"}";
        }else{
            content+=",{\"type\":\"file\",\"file_id\":\""+fileIds[i]+"\"}";
        }
    };
    content+="]";
    res.set({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });
    try {
        const response = await fetch(url+'?conversation_id='+conversationId,{
            method:'POST',
            headers:{
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body:JSON.stringify({
                "bot_id": botId,
                "user_id": "123456",
                "stream": true,
                "additional_messages": [{
                    "role": "user",
                    "content": content,
                    "content_type": "object_string"
                }]
            })
        });
        console.log(response);
        if(!response.ok){
            throw new Error(`API request failed: ${response.status}`);
        }

        // 使用 Node.js 的流处理方式
        //console.log(response.body);
        response.body.pipe(res);
        
        // 监听流的结束事件
        response.body.on('end', () => {
            // 在流结束后删除文件
            for(const file of filesInf){
                const filePath = path.join('uploads', file.filename);
                try {
                    // 删除文件
                    fs.unlinkSync(filePath);
                    console.log(`[${new Date().toLocaleString()}] 文件删除成功: ${file.filename}`);
                } catch (error) {
                    console.error(`[${new Date().toLocaleString()}] 删除文件失败: ${file.filename}`, error);
                }
            }
        });
        
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
});

//以下是服务器与联通前端与数据库的接口

//登录
app.post('/user/login', async (req,res)=>{
    const user_data = req.body;
    console.log(user_data);
    
    try {
        // 使用userDB验证用户
        const user = await userDB.verifyUser(user_data.username, user_data.password);
        
        if (!user) {
            return res.status(400).json({error: "用户名或密码错误"});
        }

        // 更新登录时间
        await userDB.updateLoginTime(user.id);

        // 返回用户信息
        res.json({
            success: true,
            message: "登录成功",
            user_data: user
        });
    } catch (error) {
        console.error('登录失败:', error);
        res.status(500).json({error: error.message});
    }
});

//注册
app.post('/user/singup', async (req,res)=>{
    const user_data = req.body;
    console.log(user_data);
    
    try {
        // 创建新用户
        const userId = await userDB.createUser({
            username: user_data.username,
            password: user_data.password,
            points: 1000 // 设置用户初始点数
        });

        res.json({
            success: true,
            message: "注册成功",
            userId: userId
        });
    } catch (error) {
        console.error('注册失败:', error);
        if (error.message === '用户名已存在') {
            return res.status(400).json({error: error.message});
        }
        res.status(500).json({error: error.message});
    }
});

//以下部分为积分功能

//更新积分
app.post('/user/update_points', async (req,res)=>{
    const username = req.body.username;
    const is_login = req.body.is_login;
    const points = req.body.points;
    console.log(username, is_login, points);

    try {
        //检测是否登录
        if(!is_login){
            return res.status(400).json({error:"未登录"});
        }

        // 先获取用户信息
        const users = await dbUtil.query(
            'SELECT id FROM users WHERE username = ?',
            [username]
        );

        if (users.length === 0) {
            return res.status(400).json({error:"用户名不存在"});
        }

        // 更新积分
        const userId = users[0].id;
        await userDB.updatePoints(userId, points);

        res.json({
            success: true,
            message: "积分更新成功",
            points: points
        });
    } catch (error) {
        console.error('更新积分失败:', error);
        res.status(500).json({error: error.message});
    }
});

//获取用户信息
app.get('/user/info', async (req, res) => {
    const username = req.query.username;
    const is_login = req.query.is_login === 'true';

    try {
        if (!is_login) {
            return res.status(400).json({error: "未登录"});
        }

        const user = await userDB.getUserByUsername(username);
        if (!user) {
            return res.status(400).json({error: "用户不存在"});
        }

        res.json({
            success: true,
            user_data: user
        });
    } catch (error) {
        console.error('获取用户信息失败:', error);
        res.status(500).json({error: error.message});
    }
});

//以下为会话和消息相关的API接口

// 创建新会话
app.post('/conversation/create', async (req, res) => {
    try {
        const conversationData = req.body;
        const conversationId = await conversationDB.createConversation(conversationData);
        
        res.json({
            success: true,
            message: "会话创建成功",
            conversation_id: conversationId
        });
    } catch (error) {
        console.error('[${new Date().toLocaleString()}] 创建会话失败:', error);
        res.status(500).json({error: error.message});
    }
});

// 获取会话信息
app.get('/conversation/get', async (req, res) => {
    try {
        const { user_name, department, agent } = req.query;
        const conversation = await conversationDB.getConversation(user_name, department, agent);
        
        if (!conversation) {
            return res.status(404).json({error: "会话不存在"});
        }
        
        res.json({
            success: true,
            conversation: conversation
        });
    } catch (error) {
        console.error('[${new Date().toLocaleString()}] 获取会话失败:', error);
        res.status(500).json({error: error.message});
    }
});

// 更新会话时间
app.put('/conversation/update_time/:conversationId', async (req, res) => {
    try {
        const conversationId = parseInt(req.params.conversationId);
        const success = await conversationDB.updateConversationTime(conversationId);
        
        res.json({
            success: success,
            message: "会话时间更新成功"
        });
    } catch (error) {
        console.error('[${new Date().toLocaleString()}] 更新会话时间失败:', error);
        res.status(500).json({error: error.message});
    }
});

// 删除会话
app.delete('/conversation/delete/:conversationId', async (req, res) => {
    try {
        const conversationId = parseInt(req.params.conversationId);
        const success = await conversationDB.deleteConversation(conversationId);
        
        res.json({
            success: success,
            message: "会话删除成功"
        });
    } catch (error) {
        console.error('[${new Date().toLocaleString()}] 删除会话失败:', error);
        res.status(500).json({error: error.message});
    }
});

// 创建新消息
app.post('/message/create', async (req, res) => {
    try {
        const messageData = req.body;
        const messageId = await messageDB.createMessage(messageData);
        
        res.json({
            success: true,
            message: "消息创建成功",
            message_id: messageId
        });
    } catch (error) {
        console.error('[${new Date().toLocaleString()}] 创建消息失败:', error);
        res.status(500).json({error: error.message});
    }
});

// 获取会话的所有消息
app.get('/message/get/:conversationId', async (req, res) => {
    try {
        const conversationId = parseInt(req.params.conversationId);
        const messages = await messageDB.getMessages(conversationId);
        
        res.json({
            success: true,
            messages: messages
        });
    } catch (error) {
        console.error('[${new Date().toLocaleString()}] 获取消息失败:', error);
        res.status(500).json({error: error.message});
    }
});
