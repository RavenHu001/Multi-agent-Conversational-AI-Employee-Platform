document.addEventListener('DOMContentLoaded', async function() {
    try {
        // 检查登录状态
        checkLoginStatus();
        
        // 设置登录按钮事件
        document.getElementById('login-btn').addEventListener('click', function() {
            window.location.href = 'user_functions/pages/login.html';
        });

        // 设置退出按钮事件
        document.getElementById('logout-btn').addEventListener('click', function() {
            localStorage.removeItem('username');
            localStorage.removeItem('is_login');
            localStorage.removeItem('points');
            checkLoginStatus();
        });

        // 设置发送按钮事件
        const sendBtn = document.querySelector('.send-btn');
        const messageInput = document.querySelector('.message-input');
        
        sendBtn.addEventListener('click', () => sendMessage());
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
        // 从URL获取参数
        const urlParams = new URLSearchParams(window.location.search);
        const departmentType = urlParams.get('department');
        const agentName = urlParams.get('agent');

        if (departmentType && agentName) {
            // 加载历史聊天记录
            loadChatHistoryToUI(departmentType, agentName);
            // 如果没有历史记录，显示欢迎消息
            const agents = await loadConfig('agents.json');
            const currentAgent = agents.find(agent => agent.name === agentName);
            if (currentAgent && getChatHistory(departmentType, agentName).length === 0) {
                addMessageToChat(currentAgent.welcome, 'ai');
            }
        }
    } catch (error) {
        console.error('Error initializing chat:', error);
    }
});

// 检查登录状态并更新UI
async function checkLoginStatus() {
    const isLogin = localStorage.getItem('is_login');
    const username = localStorage.getItem('username');
    const loginBtn = document.getElementById('login-btn');
    const userInfo = document.getElementById('user-info');
    const usernameDisplay = document.getElementById('username-display');
    const pointsDisplay = document.getElementById('points-display');

    if (isLogin === 'true' && username) {
        // 已登录状态
        loginBtn.style.display = 'none';
        userInfo.style.display = 'flex';
        usernameDisplay.textContent = username;
        //以登录，读取积分
        const user_data = await loadConfig('user_functions/data/user_data.json');
        const user_data_item = user_data.find(item=>item.username === username);
        const points = user_data_item.points;
        
        pointsDisplay.textContent = `积分: ${points}`;
    } else {
        // 未登录状态
        loginBtn.style.display = 'block';
        userInfo.style.display = 'none';
        // 清除可能存在的无效登录状态
        localStorage.removeItem('username');
        localStorage.removeItem('is_login');
        localStorage.removeItem('points');
    }
}

// 保留原有的这些函数，但移除与部门/智能体选择相关的代码
async function loadConfig(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
}

async function sendMessage() {
    const messageInput = document.querySelector('.message-input');
    const message = messageInput.value.trim();
    
    if (!message) return;
    
    // 从URL获取当前智能体信息
    const urlParams = new URLSearchParams(window.location.search);
    const agentName = urlParams.get('agent');
    const departmentType = urlParams.get('department');
    
    if (!agentName || !departmentType) return;
    
    const agents = await loadConfig('agents.json');
    const currentAgent = agents.find(agent => agent.name === agentName);
    
    if (!currentAgent) return;
    
    addMessageToChat(message, 'user');
    messageInput.value = '';

    // 添加加载消息
    const loadingMessageId = 'loading-message';
    addMessageToChat('正在生成内容...', 'ai', loadingMessageId);
    //记录操作类型
    let operation = null;

    try {
        if (currentAgent['API-URL'] && currentAgent['API-Key']) {
            let response;
             // 检查是否有当前会话ID
             const currentKey = `currentConversation_${departmentType}_${agentName}`;
             const conversationId = localStorage.getItem(currentKey);
            if(currentAgent['API-Model'] === 'deepseek-chat'){
                operation = 'chat';
                // 流式渲染
                response = await sendMessageToDeepSeek(
                    message, 
                    currentAgent, 
                    loadingMessageId, 
                    departmentType, 
                    agentName,
                    conversationId
                );
            } else if(currentAgent['API-Model'] === 'coze'){
                //检测是否有文件
                const files = JSON.parse(localStorage.getItem('uploadedFiles') || '[]');
                if(files.length>0){
                    operation = 'chat_with_file';
                    response = await sendMessageToCozeWithFilesWithConversation(
                        message, 
                        currentAgent, 
                        loadingMessageId, 
                        departmentType, 
                        agentName, 
                        conversationId
                    );
                }else {
                    operation = 'chat';
                    // 如果有会话ID，使用带会话的API调用
                    response = await sendMessageToCozeWithConversation(
                        message, 
                        currentAgent, 
                        loadingMessageId, 
                        departmentType, 
                        agentName, 
                        conversationId
                    );
                }
            } else {
                throw new Error(`未知模型: ${currentAgent['API-Model']}`);
            }
        } else {
            removeMessage(loadingMessageId);
            const errorMessage = "抱歉，我暂时无法回复。请稍后再试。";
            createStreamingAIMessageElement(errorMessage);
            // 保存错误消息到当前会话
            if (currentConversationId) {
                saveMessageToConversation(errorMessage, 'ai');
            }
        }
    } catch (error) {
        console.error('Error sending message:', error);
        removeMessage(loadingMessageId);
        const errorMessage = "发送消息时出现错误，请稍后重试。";
        createStreamingAIMessageElement(errorMessage);
        // 保存错误消息到当前会话
        if (currentConversationId) {
            saveMessageToConversation(errorMessage, 'ai');
        }
    }
    //获取用户信息
    const username = localStorage.getItem('username');
    const isLogin = localStorage.getItem('is_login');
    //更新积分
    updatePoints(username, isLogin, operation);
}

function createStreamingAIMessageElement(content = '') {
    const chatMessages = document.querySelector('.chat-messages');
    const messageElement = document.createElement('div');
    messageElement.className = 'message ai-message';
    messageElement.innerHTML = `
        <div class="message-content">${content ? marked.parse(content) : ''}</div>
        <div class="message-actions">
            <button class="copy-btn" onclick="copyMessage(this)"><img src="images/icons/copy.jpg" alt="复制" class="copy-icon"></button>
            <button class="download-btn" onclick="downloadMessage(this)"><img src="images/icons/download.jpg" alt="下载" class="download-icon"></button>
        </div>
    `;
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    const contentDiv = messageElement.querySelector('.message-content');
    return { messageElement, contentDiv };
}

// 流式接入DeepSeek智能体的函数
async function sendMessageToDeepSeek(message, currentAgent, loadingMessageId, departmentType, agentName,conversationId) {
    // 移除加载消息
    removeMessage(loadingMessageId);
    // 使用独立方法插入AI消息div
    const { messageElement, contentDiv } = createStreamingAIMessageElement();

    try{
        const response = await fetch('http://localhost:3000/deepseek', {//需要让这里能自动获取后端服务器的根目录
        method: 'POST',
        headers: {
                'Content-Type': 'application/json'
        },
        body: JSON.stringify({
                message: message,
            model: currentAgent['API-Model'],
                apiKey: currentAgent['API-Key'],
                url: currentAgent['API-URL'],
                conversationId: conversationId
        })
    });

    if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
    }

    // 逐步读取流式内容
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let fullText = '';
    let done = false;
    const chatMessages = document.querySelector('.chat-messages');
    while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
            const chunk = decoder.decode(value, { stream: true });
            // 解析SSE格式（如以data: 开头的行）
            chunk.split('\n').forEach(line => {
                if (line.startsWith('data:')) {
                    const data = line.replace(/^data:\s*/, '');
                    if (data === '[DONE]') return;
                    try {
                        const json = JSON.parse(data);
                        const delta = json.choices?.[0]?.delta?.content || '';
                        fullText += delta;
                        contentDiv.innerHTML = marked.parse(fullText);
                        chatMessages.scrollTop = chatMessages.scrollHeight;
                    } catch (e) {
                        // 忽略解析失败
                    }
                }
            });
        }
    }
    if(conversationId){
        saveMessageToConversation(fullText, 'ai');
    }else{
        appendMessageToHistory(departmentType, agentName, 'ai', fullText);
    }
    return fullText;
    }catch(error){
        throw error;
    }
}
//流式接入扣子，带会话ID
async function sendMessageToCozeWithConversation(message, currentAgent, loadingMessageId, departmentType, agentName, conversationId){
    //检测文件夹中是否存在文件
    const files = JSON.parse(localStorage.getItem('uploadedFiles') || '[]');
    if(files.length>0){
        return 
    }
    // 移除加载消息
    removeMessage(loadingMessageId);
    // 使用独立方法插入AI消息div
    const { messageElement, contentDiv } = createStreamingAIMessageElement();

    try{
        const response = await fetch('http://localhost:3000/coze/conversation',{
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: message,
                model: currentAgent['API-Model'],
                apiKey: currentAgent['API-Key'],
                url: currentAgent['API-URL'],
                botId: currentAgent['bot-id'],
                conversationId: conversationId
            })
        });
        if (!response.ok) {
            throw new Error(`API request failed: ${response.status}`);
        }
        return processStreamingResponse(response, contentDiv, departmentType, agentName,conversationId);
    }catch(error){
        throw error;
    }
}   
//流式接入coze，带文件，带会话id（当前文件源直接是本地暂存的文件）
async function sendMessageToCozeWithFilesWithConversation(message, currentAgent, loadingMessageId, departmentType, agentName, conversationId){
    //从本地获取files
    const files = JSON.parse(localStorage.getItem('uploadedFiles') || '[]');
    for(let file of files){
        // 将文件信息作为用户消息添加到聊天区域
        const fileMessage = `${getFileIcon(file.mimetype)} ${file.originalname} (${formatFileSize(file.size)})`;
        addMessageToChat(fileMessage, 'user');
    }
    // 移除加载消息
    removeMessage(loadingMessageId);
    // 使用独立方法插入AI消息div
    const { messageElement, contentDiv } = createStreamingAIMessageElement();

    try{
        const response = await fetch('http://localhost:3000/coze/upload',{
            method:'POST',
            headers:{
                'Content-Type': 'application/json'
            },
            body:JSON.stringify({
                message:message,
                files:files,
                url:currentAgent['API-URL'],
                apiKey:currentAgent['API-Key'],
                botId:currentAgent['bot-id'],
                conversationId:conversationId
            })
        })
        const result = await processStreamingResponse(response, contentDiv, departmentType, agentName,conversationId);
        
        // 清除已上传的文件
        // 1. 清除本地存储
        localStorage.removeItem('uploadedFiles');
        
        // 2. 清除文件预览
        const filePreview = document.getElementById('file-preview');
        if (filePreview) {
            filePreview.innerHTML = '';
            filePreview.classList.remove('visible');
        }
        
        return result;
    }catch(error){    
        throw error;
    }
}
// 保留其他辅助函数
//coze流式读取通用函数
async function processStreamingResponse(response, contentDiv, departmentType, agentName,conversationId){
    // 逐步读取流式内容
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let fullText = '';
    let done = false;
    const chatMessages = document.querySelector('.chat-messages');
    while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        if (value) {
            const chunk = decoder.decode(value, { stream: true });
            // 解析SSE格式（如以data: 开头的行）
            chunk.split('\n').forEach(line => {
                if (line.startsWith('data:')) {
                    const data = line.replace(/^data:\s*/, '');
                    if (data === '[DONE]') return;
                    try {
                        const json = JSON.parse(data);
                        let delta='';
                        if(json.type){
                            if(json.type==="answer"){
                                delta=json.content;
                            }else if(json.type==="follow_up"){
                                delta='<br>'+json.content;
                            }
                        }
                        fullText += delta;
                        contentDiv.innerHTML = marked.parse(fullText);
                        chatMessages.scrollTop = chatMessages.scrollHeight;
                    } catch (e) {
                        // 忽略解析失败
                    }
                }
            });
        }     
    }
    if(conversationId){
        saveMessageToConversation(fullText, 'ai');
    }else{
        appendMessageToHistory(departmentType, agentName, 'ai', fullText);
    }
    return fullText;
}
// 创建消息内容的函数
function createMessageContent(message, type) {
    //让AI的回复以markdown渲染
    return type === 'ai' ? `
        <div class="message-content">
            ${marked.parse(message)}
        </div>
        <div class="message-actions">
            <button class="copy-btn" onclick="copyMessage(this)"><img src="images/icons/copy.jpg" alt="复制" class="copy-icon"></button>
            <button class="download-btn" onclick="downloadMessage(this)"><img src="images/icons/download.jpg" alt="下载" class="download-icon"></button>
        </div>
    ` : `
        <div class="message-content">
            ${message}
        </div>
    `;
}

function addMessageToChat(message, type, messageId = null) {
    const chatMessages = document.querySelector('.chat-messages');
    const messageElement = document.createElement('div');
    messageElement.className = `message ${type}-message`;
    if (messageId) {
        messageElement.id = messageId;
    }
    
    messageElement.innerHTML = createMessageContent(message, type);
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // 保存到历史，但跳过加载消息
    if (!messageId) {
        const urlParams = new URLSearchParams(window.location.search);
        const agentName = urlParams.get('agent');
        const departmentType = urlParams.get('department');
        appendMessageToHistory(departmentType, agentName, type, message);
    }
}

// 添加复制功能
function copyMessage(button) {
    // 获取按钮上方的.message-content内容
    const messageContentDiv = button.closest('.message-actions').previousElementSibling;
    const messageContent = messageContentDiv ? messageContentDiv.textContent.trim() : '';
    navigator.clipboard.writeText(messageContent).then(() => {
        // 创建提示元素
        const notification = document.createElement('div');
        notification.className = 'copy-notification';
        notification.textContent = '已复制到剪贴板';
        document.body.appendChild(notification);

        // 2秒后移除提示
        setTimeout(() => {
            notification.remove();
        }, 2000);
    }).catch(err => {
        console.error('复制失败:', err);
    });
}
/**
 * 下载消息为Word文档的函数
 * 该函数会将AI回复的内容（包括格式和图片）保存为Word文档
 * @param {HTMLElement} button - 触发下载的按钮元素
 */
function downloadMessage(button) {
    // 获取按钮上方的.message-content内容
    const messageContentDiv = button.closest('.message-actions').previousElementSibling;
    
    // 创建一个临时容器来克隆内容，这样可以保留原始HTML结构
    const tempContainer = document.createElement('div');
    tempContainer.innerHTML = messageContentDiv.innerHTML;

    // 处理所有图片，将它们转换为base64格式
    // 这样做是为了确保图片能够被正确嵌入到Word文档中
    const images = tempContainer.getElementsByTagName('img');
    const processImages = Array.from(images).map(img => {
        return new Promise((resolve) => {
            // 如果图片已经是base64格式，则不需要处理
            if (img.src.startsWith('data:')) {
                resolve();
                return;
            }
            
            // 创建canvas用于图片转换
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const tempImg = new Image();
            // 设置跨域属性，允许加载跨域图片
            tempImg.crossOrigin = 'anonymous';
            
            // 图片加载成功后的处理
            tempImg.onload = () => {
                // 设置canvas尺寸与图片一致
                canvas.width = tempImg.width;
                canvas.height = tempImg.height;
                // 将图片绘制到canvas上
                ctx.drawImage(tempImg, 0, 0);
                // 将canvas内容转换为base64格式的PNG图片
                img.src = canvas.toDataURL('image/png');
                resolve();
            };
            
            // 图片加载失败的处理
            tempImg.onerror = () => {
                img.src = ''; // 移除加载失败的图片
                resolve();
            };
            
            // 开始加载图片
            tempImg.src = img.src;
        });
    });

    // 等待所有图片处理完成后，生成Word文档
    Promise.all(processImages).then(() => {
        // 创建Word文档的HTML内容
        // 使用Word特定的命名空间来确保格式正确
        const htmlContent = `
            <html xmlns:o='urn:schemas-microsoft-com:office:office'
                  xmlns:w='urn:schemas-microsoft-com:office:word'
                  xmlns='http://www.w3.org/TR/REC-html40'>
            <head>
                <meta charset='utf-8'>
                <style>
                    /* 设置基本字体和样式 */
                    body { font-family: Arial, sans-serif; }
                    /* 保持代码块的格式和字体 */
                    pre { white-space: pre-wrap; font-family: Consolas, monospace; }
                    code { font-family: Consolas, monospace; }
                    /* 确保图片不会超出页面宽度 */
                    img { max-width: 100%; height: auto; }
                    /* 设置段落间距 */
                    p { margin: 10px 0; }
                    /* 设置引用块的样式 */
                    blockquote { 
                        border-left: 4px solid #ccc;
                        margin: 10px 0;
                        padding-left: 10px;
                    }
                </style>
            </head>
            <body>${tempContainer.innerHTML}</body>
            </html>
        `;

        // 创建Blob对象，添加BOM标记确保中文正确显示
        const blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword' });
        const url = URL.createObjectURL(blob);

        // 创建下载链接并自动触发下载
        const a = document.createElement('a');
        a.href = url;
        a.download = 'AI回复.doc';
        document.body.appendChild(a);
        a.click();
        // 清理临时创建的元素和URL
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    });
}
//获取历史记录的函数
function getChatHistory(department, agent) {
    const key = `chat_${department}_${agent}`;
    const history = localStorage.getItem(key);
    return history ? JSON.parse(history) : [];
}
//这个可以实现单条历史的载入
function appendMessageToHistory(department, agent, type, message) {
    if (!department || !agent) return;
    const history = getChatHistory(department, agent);
    history.push({ type, message });
    saveChatHistory(department, agent, history);
}
//这个是保存历史的底层部分，可以被用于清空历史记录
function saveChatHistory(department, agent, history) {
    const key = `chat_${department}_${agent}`;
    localStorage.setItem(key, JSON.stringify(history));
}

function loadChatHistoryToUI(department, agent) {
    const chatMessages = document.querySelector('.chat-messages');
    chatMessages.innerHTML = '';
    const history = getChatHistory(department, agent);
    history.forEach(item => {
        const messageElement = document.createElement('div');
        messageElement.className = `message ${item.type}-message`;
        messageElement.innerHTML = createMessageContent(item.message, item.type);
        chatMessages.appendChild(messageElement);
    });
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

//清空当前会话历史记录的函数
function clearCurrentChatHistory(agentName,departmentType) {
    // 清空本地历史
    saveChatHistory(departmentType, agentName, []);
    // 清空界面
    loadChatHistoryToUI(departmentType, agentName);
    // 刷新页面
    window.location.reload();
}

function removeMessage(messageId) {
    const messageElement = document.getElementById(messageId);
    if (messageElement) {
        messageElement.remove();
    }
}