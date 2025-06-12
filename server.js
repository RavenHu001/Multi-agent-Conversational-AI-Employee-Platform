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

//以下部分为登录注册功能

//登录
app.post('/user/login',(req,res)=>{
    const user_data = req.body;
    console.log(user_data);
    //从数据库中查询用户名和密码
    const user_name = user_data.username;
    const user_password = user_data.password;
    //从数据库中检测用户名是否存在
    const user_datas = fs.readFileSync('user_functions/data/user_data.json','utf-8');
    const user_datas_array = JSON.parse(user_datas);
    //尝试从json中获取对应用户对象
    const user_data_item = user_datas_array.find(item=>item.username === user_name);//从json中检测用户名是否存在
    if(!user_data_item){
        return res.status(400).json({error:"用户名不存在"});
    }
    //检测密码是否正确
    if(user_data_item.password !== user_password){
        return res.status(400).json({error:"密码错误"});
    }
    //如果都成功，则录入登录时间
    user_datas_array.forEach(item=>{
        if(item.username === user_name){
            item.last_login = new Date().toLocaleString();
        }
    });
    //将用户信息写入数据库
    fs.writeFileSync('user_functions/data/user_data.json',JSON.stringify(user_datas_array,null,2));
    //返回用户信息
    res.json({
        success:true,
        message:"登录成功",
        user_data:user_data_item
    });
});

//注册
app.post('/user/singup',(req,res)=>{
    const user_data = req.body;
    console.log(user_data);
    //从数据库中查询用户名和密码
    const user_name = user_data.username;
    const user_password = user_data.password;
    //从数据库中检测用户名是否存在
    const user_datas = fs.readFileSync('user_functions/data/user_data.json','utf-8');
    const user_datas_array = JSON.parse(user_datas);
    const user_data_item = user_datas_array.find(item=>item.username === user_name);//从json中检测用户名是否存在
    if(user_data_item){
        return res.status(400).json({error:"用户名已存在"});
    }
    const init_points = 1000;//设置用户初始点数
    //将用户名和密码写入数据库
    user_datas_array.push({username:user_name,password:user_password,points:init_points});//使用push将新用户放入已有用户列表末尾
    fs.writeFileSync('user_functions/data/user_data.json',JSON.stringify(user_datas_array,null,2));
    res.json({success:true,message:"注册成功"});
});

//以下部分为积分功能

//更新积分
app.post('/user/update_points',(req,res)=>{
    const username = req.body.username;
    const is_login = req.body.is_login;
    const points = req.body.points;
    console.log(username,is_login,points);
    //检测是否登录
    if(!is_login){
        return res.status(400).json({error:"未登录"});
    }
    //检测用户名是否存在
    const user_datas = fs.readFileSync('user_functions/data/user_data.json','utf-8');
    const user_datas_array = JSON.parse(user_datas);
    const user_data_item = user_datas_array.find(item=>item.username === username);
    if(!user_data_item){
        return res.status(400).json({error:"用户名不存在"});
    }
    //更新积分
    user_datas_array.forEach(item=>{
        if(item.username === username){
            item.points = points;
        }
    });
    fs.writeFileSync('user_functions/data/user_data.json',JSON.stringify(user_datas_array,null,2));
    res.json({success:true,message:"积分更新成功",points:points});
});
