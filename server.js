// 导入必要的模块
const express = require('express');    // Express框架，用于创建Web服务器
const multer = require('multer');      // Multer中间件，用于处理文件上传
const path = require('path');          // Node.js路径模块，用于处理文件路径
const cors = require('cors');          // CORS中间件，用于处理跨域请求
const fs = require('fs');              // Node.js文件系统模块，用于文件操作
const FormData = require('form-data'); //安装form-data包，用于处理文件发送
const { type } = require('os');
const { json } = require('stream/consumers');

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
        //用来查看和确认传递进来的文件的代码
        // console.log(req.file);
        // const formData = new FormData();
        // formData.append('file',req.file);
        // console.log(formData);

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

    const response = await fetch(url,{
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
        if(files[i].mimetype.startsWith("image/")){
            content+=",{\"type\":\"image\",\"file_id\":\""+fileIds[i]+"\"}";
        }else if(files[i].mimetype.startsWith("audio/")){
            content+=",{\"type\":\"audio\",\"file_id\":\""+fileIds[i]+"\"}";
        }else{
            content+=",{\"type\":\"file\",\"file_id\":\""+fileIds[i]+"\"}";
        }
    };
    content+="]";
    // content = "[{\"type\":\"text\",\"text\":\""+message+"\"},{\"type\":\"file\",\"file_id\":\""+"7506787222818422838"+"\"}]";
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
        if(!response.ok){
            throw new Error(`API request failed: ${response.status}`);
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value);
            res.write(chunk); // 或格式化为 SSE 格式：res.write(`data: ${chunk}\n\n`);
        }

    } catch (error) {
        console.error(`[${new Date().toLocaleString()}] 处理请求时出错:`, error);
        throw error;
    }finally{
        //删除上传的文件
        for(const file of files){
            const filePath = path.join('uploads', file.filename);
            // 删除文件
            fs.unlinkSync(filePath);
            console.log(`[${new Date().toLocaleString()}] 文件删除成功: ${filename}`);
        }
    }
    res.end();
});
//发送单个文件至coze并获取文件id
async function singleFileToCoze(fileInf,url,apiKey){
    try{
        //需要获取文件对象，随后将文件对象放入formData中以生成报文
        const filePath = path.join('uploads', fileInf.filename);
        const file = fs.readFileSync(filePath);//文件确实抓出来了
        console.log(file instanceof Buffer);
        const formData = new FormData();
        formData.append('file',file);//但这里似乎要么是把文件以字符串塞进去了，要么是文件流
        console.log(formData);

        const response = await fetch(url,{
            method:'POST',
            headers:{
                'Authorization': `Bearer ${apiKey}`,
                // ...formData.getHeaders() // 自动添加 FormData 所需的 Content-Type 等头信息
                'Content-Type': "multipart/form-data" 
            },
            body:formData
        });
        if(!response.ok){
            throw new Error(`API request failed: ${response.status}`);
        }
        
        const data = await response.json();
        console.log(data);
        if(data.code!==0){
            throw new Error(`API request failed: ${data.message}`);
        }
        return data.data.id;//返回回复报文提供的文件id
    }catch(error){
        console.error(`[${new Date().toLocaleString()}] 上传文件失败:`, error);
        throw error;
    }
}
//发送多个文件至coze并获取文件id
async function multipleFilesToCoze(filesInf,apiKey){
    const fileIds = [];
    const url = "https://api.coze.cn/v1/files/upload";
    for(const fileInf of filesInf){
        console.log("正在处理文件："+fileInf.filename)
        const fileId = await singleFileToCoze(fileInf,url,apiKey);
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

    const response = await fetch(url,{
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