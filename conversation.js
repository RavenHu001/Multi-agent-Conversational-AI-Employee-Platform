// 会话管理相关功能
let currentConversationId = null;

// 生成唯一的会话ID
function generateConversationId() {
    return 'conv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// 创建新会话
function createNewConversation() {
    const conversationId = generateConversationId();
    const urlParams = new URLSearchParams(window.location.search);
    const departmentType = urlParams.get('department');
    const agentName = urlParams.get('agent');
    
    // 创建会话数据
    const conversation = {
        id: conversationId,
        department: departmentType,
        agent: agentName,
        title: `新会话 ${new Date().toLocaleString()}`,
        messages: []
    };
    
    // 保存会话数据
    saveConversation(conversation);
    
    // 创建会话UI元素
    createConversationElement(conversation);
    
    // 切换到新会话
    switchToConversation(conversationId);
    
    return conversationId;
}

// 保存会话数据
function saveConversation(conversation) {
    const conversations = getConversations();
    conversations.push(conversation);
    localStorage.setItem('conversations', JSON.stringify(conversations));
}

// 获取所有会话
function getConversations() {
    return JSON.parse(localStorage.getItem('conversations') || '[]');
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
            switchToConversation(conversation.id);
        }
    });
    
    // 添加删除按钮事件
    const deleteBtn = conversationElement.querySelector('.delete-conversation-btn');
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteConversation(conversation.id);
    });
    
    conversationList.insertBefore(conversationElement, conversationList.firstChild);
}

// 切换到指定会话
function switchToConversation(conversationId) {
    const conversations = getConversations();
    const conversation = conversations.find(c => c.id === conversationId);
    
    if (!conversation) return;
    
    // 更新当前会话ID
    currentConversationId = conversationId;
    
    // 更新UI选中状态
    document.querySelectorAll('.conversation-item').forEach(item => {
        item.classList.toggle('active', item.dataset.conversationId === conversationId);
    });
    
    // 清空并加载会话消息
    const chatMessages = document.querySelector('.chat-messages');
    chatMessages.innerHTML = '';
    
    conversation.messages.forEach(message => {
        addMessageToChat(message.content, message.type);
    });
    
    // 更新URL参数
    const url = new URL(window.location.href);
    url.searchParams.set('conversation', conversationId);
    window.history.pushState({}, '', url);
}

// 删除会话
function deleteConversation(conversationId) {
    const conversations = getConversations();
    const updatedConversations = conversations.filter(c => c.id !== conversationId);
    localStorage.setItem('conversations', JSON.stringify(updatedConversations));
    
    // 移除UI元素
    const conversationElement = document.querySelector(`.conversation-item[data-conversation-id="${conversationId}"]`);
    if (conversationElement) {
        conversationElement.remove();
    }
    
    // 如果删除的是当前会话，切换到其他会话或创建新会话
    if (conversationId === currentConversationId) {
        if (updatedConversations.length > 0) {
            switchToConversation(updatedConversations[0].id);
        } else {
            createNewConversation();
        }
    }
}

// 初始化会话列表
function initializeConversations() {
    const conversations = getConversations();
    const conversationList = document.querySelector('.conversation-list');
    conversationList.innerHTML = '';
    
    conversations.forEach(conversation => {
        createConversationElement(conversation);
    });
    
    // 检查URL中是否有会话ID
    const urlParams = new URLSearchParams(window.location.search);
    const conversationId = urlParams.get('conversation');
    
    if (conversationId) {
        switchToConversation(conversationId);
    } else if (conversations.length > 0) {
        switchToConversation(conversations[0].id);
    } else {
        createNewConversation();
    }
}

// 修改现有的addMessageToChat函数，添加会话保存功能
const originalAddMessageToChat = window.addMessageToChat;
window.addMessageToChat = function(message, type, messageId = null) {
    // 调用原始函数
    originalAddMessageToChat(message, type, messageId);
    
    // 如果不是加载消息，保存到当前会话
    if (!messageId && currentConversationId) {
        const conversations = getConversations();
        const conversation = conversations.find(c => c.id === currentConversationId);
        if (conversation) {
            conversation.messages.push({
                type,
                content: message
            });
            localStorage.setItem('conversations', JSON.stringify(conversations));
        }
    }
};

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', () => {
    // 初始化会话列表
    initializeConversations();
    
    // 添加新建会话按钮事件
    const newChatBtn = document.querySelector('.new-chat-btn');
    newChatBtn.addEventListener('click', createNewConversation);
});
