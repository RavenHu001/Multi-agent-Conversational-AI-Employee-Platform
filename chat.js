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
                response = await sendMessageToDeepSeek(message, currentAgent);
            } else if(currentAgent['API-Model'] === 'coze'){
                response = await sendMessageToCoze(message, currentAgent);
            } else {
                throw new Error(`未知模型: ${currentAgent['API-Model']}`);
            }
            // 移除加载消息并添加实际响应
            removeMessage(loadingMessageId);
            addMessageToChat(response, 'ai');
        } else {
            removeMessage(loadingMessageId);
            addMessageToChat("抱歉，我暂时无法回复。请稍后再试。", 'ai');
        }
    } catch (error) {
        console.error('Error sending message:', error);
        removeMessage(loadingMessageId);
        addMessageToChat("发送消息时出现错误，请稍后重试。", 'ai');
    }
}

// 保留API调用相关函数
//接入扣子智能体的函数，需要一个循环呼叫获取回复状态，一个呼叫获取详细结果
async function sendMessageToCoze(message,currentAgent) {
    let response = await fetch(currentAgent['API-URL'],{
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${currentAgent['API-Key']}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            "bot_id": currentAgent['bot-id'],
            "user_id": "123456",
            "stream": false,
            "auto_save_history": true,
            "additional_messages": [{
                "role": "user",
                "content": message,
                "content_type": "text"
            }]
        })
    });
    if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
    }
    let data = await response.json();
    // console.log(response);
    // console.log(data);
    //第一次请求完成，获取两个id开始间隔一秒一次循环请求，直到data.status为complete
    const id = data.data.id;
    const conversation_id = data.data.conversation_id;
    console.log(id,conversation_id);
    //间隔一秒一次循环请求，直到data.status为complete
    while(data.data.status !== 'completed'){
        await new Promise(resolve => setTimeout(resolve, 1000));
        response = await fetch(currentAgent['API-URL-retrieve']+'?chat_id='+id+'&conversation_id='+conversation_id,{
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${currentAgent['API-Key']}`,
                'Content-Type': 'application/json'
            }
        });
        // console.log(response);
        data = await response.json();
        // console.log(data);
        console.log(data.data.status);
    }
    //获取详细结果
    response = await fetch(currentAgent['API-URL-list']+'?chat_id='+id+'&conversation_id='+conversation_id,{
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${currentAgent['API-Key']}`,
            'Content-Type': 'application/json'
        }
    });
    data = await response.json();
    console.log(data);
    if(data.data[1].content){
        return data.data[1].content;
    } else {
        return 'AI回复内容为空，请检查配置';
    }
}
//接入DeepSeek智能体的函数
async function sendMessageToDeepSeek(message,currentAgent) {
    const response = await fetch(currentAgent['API-URL'],{
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${currentAgent['API-Key']}`
        },
        body: JSON.stringify({
            model: currentAgent['API-Model'],
            messages: [
                {role: "system", content: "You are a helpful assistant."},
                {role: 'user',content: message}
            ],
            stream: false
        })
    });
    if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
    }
    console.log(response);

    const data = await response.json();
    console.log(data);
    if(data.choices[0].message.content){
        return data.choices[0].message.content;
    } else {
        return 'AI回复内容为空，请检查配置';
    }
}
// 保留其他辅助函数
function getChatHistory(department, agent) {
    const key = `chat_${department}_${agent}`;
    const history = localStorage.getItem(key);
    return history ? JSON.parse(history) : [];
}

function saveChatHistory(department, agent, history) {
    const key = `chat_${department}_${agent}`;
    localStorage.setItem(key, JSON.stringify(history));
}

function addMessageToChat(message, type, messageId = null) {
    const chatMessages = document.querySelector('.chat-messages');
    const messageElement = document.createElement('div');
    messageElement.className = `message ${type}-message`;
    if (messageId) {
        messageElement.id = messageId;
    }
    messageElement.innerHTML = `
        <div class="message-content">
            ${message}
        </div>
    `;
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // 保存到历史，但跳过加载消息
    const urlParams = new URLSearchParams(window.location.search);
    const agentName = urlParams.get('agent');
    const departmentType = urlParams.get('department');
    if (agentName && departmentType && !messageId) {
        const history = getChatHistory(departmentType, agentName);
        history.push({ type, message });
        saveChatHistory(departmentType, agentName, history);
    }
}

function loadChatHistoryToUI(department, agent) {
    const chatMessages = document.querySelector('.chat-messages');
    chatMessages.innerHTML = '';
    const history = getChatHistory(department, agent);
    history.forEach(item => {
        const messageElement = document.createElement('div');
        messageElement.className = `message ${item.type}-message`;
        messageElement.innerHTML = `
            <div class="message-content">
                ${item.message}
            </div>
        `;
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