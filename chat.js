document.addEventListener('DOMContentLoaded', async function() {
    try {
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
        // 新建会话按钮清空当前聊天记录
        const newChatBtn = document.querySelector('.new-chat-btn');
        if (newChatBtn) {
            newChatBtn.addEventListener('click', () => clearCurrentChatHistory(agentName,departmentType));
        }


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

    try {
        if (currentAgent['API-URL'] && currentAgent['API-Key']) {
            let response;
            if(currentAgent['API-Model'] === 'deepseek-chat'){
                // 流式渲染
                response = await sendMessageToDeepSeek(message, currentAgent, loadingMessageId, departmentType, agentName);
            } else if(currentAgent['API-Model'] === 'coze'){
                response = await sendMessageToCoze(message, currentAgent, loadingMessageId, departmentType, agentName)
            } else {
                throw new Error(`未知模型: ${currentAgent['API-Model']}`);
            }
        } else {
            removeMessage(loadingMessageId);
            createStreamingAIMessageElement("抱歉，我暂时无法回复。请稍后再试。");
            appendMessageToHistory(departmentType, agentName, 'ai', "抱歉，我暂时无法回复。请稍后再试。");
        }
    } catch (error) {
        console.error('Error sending message:', error);
        removeMessage(loadingMessageId);
        createStreamingAIMessageElement("发送消息时出现错误，请稍后重试。");
        appendMessageToHistory(departmentType, agentName, 'ai', "发送消息时出现错误，请稍后重试。");
    }
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
async function sendMessageToDeepSeek(message, currentAgent, loadingMessageId, departmentType, agentName) {
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
                url: currentAgent['API-URL']
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
    appendMessageToHistory(departmentType, agentName, 'ai', fullText);
    return fullText;
    }catch(error){
        throw error;
    }
}
//流式，接入扣子智能体的函数
async function sendMessageToCoze(message, currentAgent, loadingMessageId, departmentType, agentName){
    //检测文件夹中是否存在文件
    const files = JSON.parse(localStorage.getItem('uploadedFiles') || '[]');
    if(files.length>0){
        return sendMessageToCozeWithFiles(message, currentAgent, loadingMessageId, departmentType, agentName);
    }
    // 移除加载消息
    removeMessage(loadingMessageId);
    // 使用独立方法插入AI消息div
    const { messageElement, contentDiv } = createStreamingAIMessageElement();

    try{
        const response = await fetch('http://localhost:3000/coze',{
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: message,
                model: currentAgent['API-Model'],
                apiKey: currentAgent['API-Key'],
                url: currentAgent['API-URL'],
                botId: currentAgent['bot-id']
            })
        });
        if (!response.ok) {
            throw new Error(`API request failed: ${response.status}`);
        }
        return processStreamingResponse(response, contentDiv, departmentType, agentName);
    }catch(error){
        throw error;
    }
}
//流式接入coze，带文件（当前文件源直接是本地暂存的文件）
async function sendMessageToCozeWithFiles(message, currentAgent, loadingMessageId, departmentType, agentName){
    // 移除加载消息
    removeMessage(loadingMessageId);
    // 使用独立方法插入AI消息div
    const { messageElement, contentDiv } = createStreamingAIMessageElement();
    //从本地获取files
    const files = JSON.parse(localStorage.getItem('uploadedFiles') || '[]');
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
                botId:currentAgent['bot-id']
            })
        })
        return processStreamingResponse(response, contentDiv, departmentType, agentName);
    }catch(error){    
        throw error;
    }
}
// 保留其他辅助函数
//coze流式读取通用函数
async function processStreamingResponse(response, contentDiv, departmentType, agentName){
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
    appendMessageToHistory(departmentType, agentName, 'ai', fullText);
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
//添加下载为world的函数
function downloadMessage(button) {
    // 获取按钮上方的.message-content内容
    const messageContentDiv = button.closest('.message-actions').previousElementSibling;
    const messageContent = messageContentDiv ? messageContentDiv.textContent.trim() : '';

    // 创建Word文档内容（简单HTML即可被Word识别）
    const htmlContent = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office'
              xmlns:w='urn:schemas-microsoft-com:office:word'
              xmlns='http://www.w3.org/TR/REC-html40'>
        <head><meta charset='utf-8'></head>
        <body>${messageContent.replace(/\n/g, '<br>')}</body>
        </html>
    `;

    const blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);

    // 创建下载链接并自动点击
    const a = document.createElement('a');
    a.href = url;
    a.download = 'AI回复.doc';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);
}
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

async function handleFileUpload(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const filePreview = document.getElementById('file-preview');
    filePreview.classList.add('visible');  // 显示文件预览区域
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    const ALLOWED_TYPES = [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'application/json',
        'text/csv',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel.sheet.macroEnabled.12',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    for (let file of files) {
        // 检查文件大小
        if (file.size > MAX_FILE_SIZE) {
            alert(`文件 ${file.name} 超过5MB大小限制`);
            continue;
        }

        // 检查文件类型
        if (!ALLOWED_TYPES.includes(file.type)) {
            alert(`文件 ${file.name} 类型不支持。支持的类型：PDF、JPEG、PNG、JSON、CSV、Excel、Word`);
            continue;
        }

        // 创建文件预览项
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.dataset.fileName = file.name;
        
        // 创建文件图标
        const fileIcon = document.createElement('div');
        fileIcon.className = 'file-icon';
        fileIcon.textContent = getFileIcon(file.type);
        fileItem.appendChild(fileIcon);

        // 添加文件信息
        const fileInfo = document.createElement('div');
        fileInfo.className = 'file-info';
        fileInfo.textContent = formatFileSize(file.size);
        fileItem.appendChild(fileInfo);

        // 添加进度条
        const progressBar = document.createElement('div');
        progressBar.className = 'progress-bar';
        progressBar.style.width = '0%';
        fileItem.appendChild(progressBar);

        // 添加删除按钮
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-btn';
        removeBtn.innerHTML = '×';
        removeBtn.onclick = () => removeFile(fileItem);
        fileItem.appendChild(removeBtn);

        filePreview.appendChild(fileItem);

        // 上传文件
        try {
            const formData = new FormData();
            formData.append('file', file);

            const xhr = new XMLHttpRequest();
            xhr.open('POST', 'http://localhost:3000/upload', true);//需要让这里能自动获取后端服务器的根目录

            // 上传进度
            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                    const percentComplete = (e.loaded / e.total) * 100;
                    progressBar.style.width = percentComplete + '%';
                }
            };

            // 上传完成
            xhr.onload = () => {
                if (xhr.status === 200) {
                    const response = JSON.parse(xhr.responseText);
                    if (response.success) {
                        fileItem.classList.add('uploaded');
                        // 保存上传成功的文件信息到本地存储
                        const uploadedFiles = JSON.parse(localStorage.getItem('uploadedFiles') || '[]');
                        uploadedFiles.push({
                            filename: response.file.filename,
                            originalname: response.file.originalname,
                            size: response.file.size,
                            mimetype: response.file.mimetype,
                            uploadTime: new Date().toISOString()
                        });
                        localStorage.setItem('uploadedFiles', JSON.stringify(uploadedFiles));
                        console.log('文件上传成功:', response.file);
                    }
                } else {
                    const error = JSON.parse(xhr.responseText);
                    alert(`上传失败: ${error.error}`);
                    removeFile(fileItem);
                }
            };

            // 上传错误
            xhr.onerror = () => {
                alert('上传失败，请检查网络连接');
                removeFile(fileItem);
            };

            xhr.send(formData);
        } catch (error) {
            console.error('上传出错:', error);
            alert('上传失败，请重试');
            removeFile(fileItem);
        }
    }

    // 清空文件输入框，允许重复选择相同文件
    event.target.value = '';
}

function getFileIcon(fileType) {
    const icons = {
        'application/pdf': '📄',
        'image/jpeg': '🖼️',
        'image/png': '🖼️',
        'application/json': '📋',
        'text/csv': '📄',
        'application/vnd.ms-excel': '📄',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '📄',
        'application/vnd.ms-excel.sheet.macroEnabled.12': '📄',
        'application/msword': '📝',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '📝'
    };
    return icons[fileType] || '📎';
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function removeFile(fileItem) {
    try {
        const filename = fileItem.dataset.fileName;
        if (!filename) {
            throw new Error('无法获取文件名');
        }
        const response = await fetch(`http://localhost:3000/delete/${filename}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error('删除文件失败');
        }

        // 从UI中移除文件项
        fileItem.remove();
        // 从本地存储中移除文件信息
        const fileList = JSON.parse(localStorage.getItem('uploadedFiles') || '[]');
        const updatedList = fileList.filter(file => file.filename !== filename);
        localStorage.setItem('uploadedFiles', JSON.stringify(updatedList));

        // 检查是否还有其他文件
        const filePreview = document.getElementById('file-preview');
        if (filePreview.children.length === 0) {
            filePreview.classList.remove('visible');
        }
    } catch (error) {
        console.error('删除文件时出错:', error);
        alert('删除文件失败: ' + error.message);
    }
}

// 添加页面加载时恢复已上传文件的函数
function restoreUploadedFiles() {
    const filePreview = document.getElementById('file-preview');
    const uploadedFiles = JSON.parse(localStorage.getItem('uploadedFiles') || '[]');
    
    if (uploadedFiles.length > 0) {
        filePreview.classList.add('visible');  // 如果有文件，显示预览区域
    }
    
    uploadedFiles.forEach(file => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item uploaded';
        fileItem.dataset.fileName = file.filename;
        
        const fileIcon = document.createElement('div');
        fileIcon.className = 'file-icon';
        fileIcon.textContent = getFileIcon(file.mimetype);
        fileItem.appendChild(fileIcon);

        const fileInfo = document.createElement('div');
        fileInfo.className = 'file-info';
        fileInfo.textContent = formatFileSize(file.size);
        fileItem.appendChild(fileInfo);

        const progressBar = document.createElement('div');
        progressBar.className = 'progress-bar';
        progressBar.style.width = '100%';
        fileItem.appendChild(progressBar);

        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-btn';
        removeBtn.innerHTML = '×';
        removeBtn.onclick = () => {
            removeFile(fileItem);
            // 从本地存储中移除文件信息
            const files = JSON.parse(localStorage.getItem('uploadedFiles') || '[]');
            const index = files.findIndex(f => f.filename === file.filename);
            if (index > -1) {
                files.splice(index, 1);
                localStorage.setItem('uploadedFiles', JSON.stringify(files));
            }
        };
        fileItem.appendChild(removeBtn);

        filePreview.appendChild(fileItem);
    });
}

// 在页面加载时恢复已上传的文件
document.addEventListener('DOMContentLoaded', function() {
    restoreUploadedFiles();
    // ... 其他现有的 DOMContentLoaded 事件处理代码 ...
});