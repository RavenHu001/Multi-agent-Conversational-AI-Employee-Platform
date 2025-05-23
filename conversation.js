// 会话管理相关功能
let currentConversationId = null;
//localStorage.clear();

//扣子服务器生成唯一的会话ID
async function generateConversationIdCoze(currentAgent) {
    //调用后端接口在服务器创建会话并返回会话id
    const response = await fetch('http://localhost:3000/coze/create_session',{
        method:'POST',
        headers:{
            'Content-Type': 'application/json'
        },
        body:JSON.stringify({
            url: "https://api.coze.cn/v1/conversation/create",
            apiKey: currentAgent['API-Key'],
            botId: currentAgent['bot-id']
        })
    });
    if(!response.ok){
        throw new Error(`API request failed: ${response.status}`);
    }
    const data = await response.json();
    return data.data.id;
}
//随机生成唯一会话ID
function generateRandomConversationId() {
    return 'conv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// 创建新会话
async function createNewConversation() {
    const urlParams = new URLSearchParams(window.location.search);
    const departmentType = urlParams.get('department');
    const agentName = urlParams.get('agent');

    //获取当前智能体的具体信息
    const agents = await loadConfig('agents.json');
    const currentAgent = agents.find(agent => agent.name === agentName);
    //获取会话id
    let conversationId;
    if(currentAgent['API-Model'] === 'coze'){
        conversationId = await generateConversationIdCoze(currentAgent);
    }else{
        conversationId = generateRandomConversationId();
    }
    // 创建会话数据
    const conversation = {
        id: conversationId,
        title: `新会话 ${new Date().toLocaleString()}`,
        messages: []
    };
    
    // 保存会话数据
    saveConversation(departmentType, agentName, conversation);
    
    // 创建会话UI元素
    createConversationElement(conversation);
    
    // 切换到新会话
    switchToConversation(departmentType, agentName, conversationId);
    
    return conversationId;
}

// 保存会话数据
function saveConversation(department, agent, conversation) {
    const conversations = getConversations(department, agent);
    conversations.push(conversation);
    const key = `conversations_${department}_${agent}`;
    localStorage.setItem(key, JSON.stringify(conversations));
}

// 获取指定部门和智能体的所有会话
function getConversations(department, agent) {
    const key = `conversations_${department}_${agent}`;
    return JSON.parse(localStorage.getItem(key) || '[]');
}

// 创建会话UI元素
function createConversationElement(conversation) {
    const conversationList = document.querySelector('.conversation-list');
    const conversationElement = document.createElement('div');
    conversationElement.className = 'conversation-item';
    conversationElement.dataset.conversationId = conversation.id;
    
    conversationElement.innerHTML = `
        <div class="conversation-title">${conversation.title}</div>
        <button class="delete-conversation-btn">×</button>
    `;
    
    // 添加点击事件
    conversationElement.addEventListener('click', (e) => {
        if (!e.target.classList.contains('delete-conversation-btn')) {
            const urlParams = new URLSearchParams(window.location.search);
            const departmentType = urlParams.get('department');
            const agentName = urlParams.get('agent');
            switchToConversation(departmentType, agentName, conversation.id);
        }
    });
    
    // 添加删除按钮事件
    const deleteBtn = conversationElement.querySelector('.delete-conversation-btn');
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const urlParams = new URLSearchParams(window.location.search);
        const departmentType = urlParams.get('department');
        const agentName = urlParams.get('agent');
        deleteConversation(departmentType, agentName, conversation.id);
    });
    
    conversationList.insertBefore(conversationElement, conversationList.firstChild);
}

// 切换到指定会话
function switchToConversation(department, agent, conversationId) {
    const conversations = getConversations(department, agent);
    const conversation = conversations.find(c => c.id === conversationId);
    
    if (!conversation) return;
    
    // 更新当前会话ID
    currentConversationId = conversationId;
    // 保存当前会话ID到localStorage
    const currentKey = `currentConversation_${department}_${agent}`;
    localStorage.setItem(currentKey, conversationId);
    console.log('currentKey',currentKey);
    console.log('currentConversationId',localStorage.getItem(currentKey));
    
    // 更新UI选中状态
    document.querySelectorAll('.conversation-item').forEach(item => {
        item.classList.toggle('active', item.dataset.conversationId === conversationId);
    });
    
    // 清空并加载会话消息
    const chatMessages = document.querySelector('.chat-messages');
    chatMessages.innerHTML = '';
    
    // 设置加载历史标记
    window.isLoadingHistory = true;
    conversation.messages.forEach(message => {
        addMessageToChat(message.content, message.type);
    });
    // 清除加载历史标记
    window.isLoadingHistory = false;
}

// 删除会话
function deleteConversation(department, agent, conversationId) {
    const conversations = getConversations(department, agent);
    const updatedConversations = conversations.filter(c => c.id !== conversationId);
    const key = `conversations_${department}_${agent}`;
    localStorage.setItem(key, JSON.stringify(updatedConversations));
    
    // 移除UI元素
    const conversationElement = document.querySelector(`.conversation-item[data-conversation-id="${conversationId}"]`);
    if (conversationElement) {
        conversationElement.remove();
    }
    
    // 如果删除的是当前会话，切换到其他会话或创建新会话
    const currentKey = `currentConversation_${department}_${agent}`;
    if (conversationId === localStorage.getItem(currentKey)) {
        if (updatedConversations.length > 0) {
            switchToConversation(department, agent, updatedConversations[0].id);
        } else {
            createNewConversation();
        }
    }
}

// 初始化会话列表
async function initializeConversations() {
    const urlParams = new URLSearchParams(window.location.search);
    const departmentType = urlParams.get('department');
    const agentName = urlParams.get('agent');
    
    if (!departmentType || !agentName) return;
    
    const conversations = getConversations(departmentType, agentName);
    const conversationList = document.querySelector('.conversation-list');
    conversationList.innerHTML = '';
    
    conversations.forEach(conversation => {
        createConversationElement(conversation);
    });
    
    // 从localStorage获取当前会话ID
    const currentKey = `currentConversation_${departmentType}_${agentName}`;
    const currentId = localStorage.getItem(currentKey);
    
    if (currentId && conversations.some(c => c.id === currentId)) {
        switchToConversation(departmentType, agentName, currentId);
    } else if (conversations.length > 0) {
        switchToConversation(departmentType, agentName, conversations[0].id);
    } else {
        createNewConversation();
    }
}

// 修改现有的addMessageToChat函数，添加会话保存功能
const originalAddMessageToChat = window.addMessageToChat;
window.addMessageToChat = function(message, type, messageId = null) {
    // 调用原始函数
    originalAddMessageToChat(message, type, messageId);
    
    // 如果不是加载消息，且不是从历史记录加载的消息，才保存到当前会话
    if (!messageId && currentConversationId && !window.isLoadingHistory) {
        saveMessageToConversation(message, type);
    }
};

// 保存消息到当前会话
function saveMessageToConversation(message, type) {
    const urlParams = new URLSearchParams(window.location.search);
    const departmentType = urlParams.get('department');
    const agentName = urlParams.get('agent');
    
    if (departmentType && agentName) {
        const conversations = getConversations(departmentType, agentName);
        const conversation = conversations.find(c => c.id === currentConversationId);
        if (conversation) {
            conversation.messages.push({
                type,
                content: message
            });
            const key = `conversations_${departmentType}_${agentName}`;
            localStorage.setItem(key, JSON.stringify(conversations));
        }
    }
}

// 修改processStreamingResponse函数，确保AI回复被保存
const originalProcessStreamingResponse = window.processStreamingResponse;
window.processStreamingResponse = async function(response, contentDiv, departmentType, agentName) {
    // 调用原始函数
    const fullText = await originalProcessStreamingResponse(response, contentDiv, departmentType, agentName);
    
    // 保存AI回复到当前会话
    if (currentConversationId) {
        saveMessageToConversation(fullText, 'ai');
    }
    
    return fullText;
};

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', () => {
    // 初始化会话列表
    initializeConversations();
    
    // 添加新建会话按钮事件
    const newChatBtn = document.querySelector('.new-chat-btn');
    newChatBtn.addEventListener('click', createNewConversation);
});
