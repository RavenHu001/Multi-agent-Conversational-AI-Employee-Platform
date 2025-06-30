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
    const username = localStorage.getItem('username') || 'anonymous';

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
        conversation_id: conversationId,
        conversation_name: `新会话 ${new Date().toLocaleString()}`,
        user_name: username,
        department: departmentType,
        agent: agentName
    };
    
    try {
        // 调用服务器API创建会话
        const response = await fetch('http://localhost:3000/conversation/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(conversation)
        });

        if (!response.ok) {
            throw new Error(`创建会话失败: ${response.status}`);
        }

        // 创建会话UI元素
        createConversationElement(conversation);
        
        // 切换到新会话
        switchToConversation(departmentType, agentName, conversationId);
        
        return conversationId;
    } catch (error) {
        console.error('创建会话失败:', error);
        throw error;
    }
}

// 获取指定部门和智能体的所有会话
async function getConversations(department, agent) {
    const username = localStorage.getItem('username') || 'anonymous';
    try {
        const response = await fetch(`http://localhost:3000/conversation/get?user_name=${username}&department=${department}&agent=${agent}`);
        if (!response.ok) {
            throw new Error(`获取会话失败: ${response.status}`);
        }
        const data = await response.json();
        return data.conversation ? [data.conversation] : [];
    } catch (error) {
        console.error('获取会话失败:', error);
        return [];
    }
}

// 创建会话UI元素
function createConversationElement(conversation) {
    const conversationList = document.querySelector('.conversation-list');
    const conversationElement = document.createElement('div');
    conversationElement.className = 'conversation-item';
    conversationElement.dataset.conversationId = conversation.conversation_id;
    
    conversationElement.innerHTML = `
        <div class="conversation-title" ondblclick="renameConversation(this)">${conversation.conversation_name}</div>
        <button class="delete-conversation-btn">×</button>
    `;
    
    // 添加点击事件
    conversationElement.addEventListener('click', (e) => {
        if (!e.target.classList.contains('delete-conversation-btn')) {
            const urlParams = new URLSearchParams(window.location.search);
            const departmentType = urlParams.get('department');
            const agentName = urlParams.get('agent');
            switchToConversation(departmentType, agentName, conversation.conversation_id);
        }
    });
    
    // 添加删除按钮事件
    const deleteBtn = conversationElement.querySelector('.delete-conversation-btn');
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const urlParams = new URLSearchParams(window.location.search);
        const departmentType = urlParams.get('department');
        const agentName = urlParams.get('agent');
        deleteConversation(departmentType, agentName, conversation.conversation_id);
    });

    conversationList.insertBefore(conversationElement, conversationList.firstChild);
}

// 切换到指定会话
async function switchToConversation(department, agent, conversationId) {
    const username = localStorage.getItem('username') || 'anonymous';
    
    try {
        // 更新会话时间
        await fetch(`http://localhost:3000/conversation/update_time/${conversationId}`, {
            method: 'PUT'
        });

        // 获取会话消息
        const response = await fetch(`http://localhost:3000/message/get/${conversationId}`);
        if (!response.ok) {
            throw new Error(`获取消息失败: ${response.status}`);
        }
        const data = await response.json();
        const messages = data.messages || [];

        // 更新当前会话ID
        currentConversationId = conversationId;
        
        // 更新UI选中状态
        document.querySelectorAll('.conversation-item').forEach(item => {
            item.classList.toggle('active', item.dataset.conversationId === conversationId);
        });
        
        // 清空并加载会话消息
        const chatMessages = document.querySelector('.chat-messages');
        chatMessages.innerHTML = '';
        
        // 设置加载历史标记
        window.isLoadingHistory = true;
        
        // 加载消息
        messages.forEach(message => {
            const messageElement = document.createElement('div');
            messageElement.className = `message ${message.message_type}-message`;
            messageElement.innerHTML = createMessageContent(message.message_content, message.message_type);
            chatMessages.appendChild(messageElement);
        });
        
        // 如果是空会话，添加欢迎消息
        if (messages.length === 0) {
            const agents = await loadConfig('agents.json');
            const currentAgent = agents.find(a => a.name === agent);
            if (currentAgent && currentAgent.welcome) {
                const welcomeMessage = {
                    conversation_id: conversationId,
                    message_content: currentAgent.welcome,
                    message_type: 'ai'
                };
                
                // 保存欢迎消息到数据库
                await fetch('http://localhost:3000/message/create', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(welcomeMessage)
                });

                const messageElement = document.createElement('div');
                messageElement.className = 'message ai-message';
                messageElement.innerHTML = createMessageContent(welcomeMessage.message_content, welcomeMessage.message_type);
                chatMessages.appendChild(messageElement);
            }
        }
        
        // 清除加载历史标记
        window.isLoadingHistory = false;
        chatMessages.scrollTop = chatMessages.scrollHeight;
    } catch (error) {
        console.error('切换会话失败:', error);
    }
}

// 删除会话
async function deleteConversation(department, agent, conversationId) {
    if (!confirm('确定要删除这个会话吗？相关的所有对话记录也会被删除。')) {
        return;
    }

    try {
        console.log('开始删除会话:', conversationId);
        
        // 调用服务器API删除会话
        const response = await fetch(`http://localhost:3000/conversation/delete/${conversationId}`, {
            method: 'DELETE'
        });

        const result = await response.json();
        console.log('删除会话响应:', result);

        if (!response.ok) {
            throw new Error(result.error || '删除会话失败');
        }

        if (!result.success) {
            throw new Error(result.message || '删除会话失败');
        }

        // 移除UI元素
        const conversationElement = document.querySelector(`.conversation-item[data-conversation-id="${conversationId}"]`);
        if (conversationElement) {
            conversationElement.remove();
            console.log('会话元素已从UI中移除');
        } else {
            console.warn('未找到要删除的会话元素:', conversationId);
        }
        
        // 如果删除的是当前会话，切换到其他会话或创建新会话
        if (conversationId === currentConversationId) {
            const conversations = await getConversations(department, agent);
            if (conversations.length > 0) {
                console.log('切换到其他会话');
                await switchToConversation(department, agent, conversations[0].conversation_id);
            } else {
                console.log('创建新会话');
                await createNewConversation();
            }
        }

        // 从localStorage中移除会话记录
        const username = localStorage.getItem('username') || 'anonymous';
        const currentKey = `conversations_${username}_${department}_${agent}`;
        localStorage.removeItem(currentKey);
        console.log('本地存储的会话记录已清除');

        alert('会话删除成功！');
    } catch (error) {
        console.error('删除会话失败:', error);
        alert(`删除会话失败: ${error.message}`);
    }
}

//双击会话名改名
function renameConversation(element){
    //保存原始名
    const originalName = element.textContent;
    //创建输入框
    const input = document.createElement('input');
    input.type = 'text';
    input.value = originalName;
    input.classList.add('rename-input');
    //替换原来的标题
    element.textContent = '';
    element.appendChild(input);
    //设置输入框自动获取焦点
    input.focus();
    //保存事件
    const save=()=>{
        const newName = input.value.trim();
        if(newName){
            element.textContent = newName;
            element.style.display = 'block';
            //保存到localStorage
            const urlParams = new URLSearchParams(window.location.search);
            const departmentType = urlParams.get('department');
            const agentName = urlParams.get('agent');
            const username = localStorage.getItem('username') || 'anonymous';
            
            const conversations = getConversations(departmentType, agentName);
            const conversation = conversations.find(c => c.conversation_id === currentConversationId);
            if(conversation){
                conversation.conversation_name = newName;
                const key = `conversations_${username}_${departmentType}_${agentName}`;
                localStorage.setItem(key, JSON.stringify(conversations));
            }
        }
    }
    //事件处理
    input.addEventListener('blur', save);
    //监听键盘回车键
    input.addEventListener('keydown', (e) => {
        if(e.key === 'Enter'){
            save();
        }
    });
    //监听键盘ESC键
    input.addEventListener('keydown', (e) => {
        if(e.key === 'Escape'){
            element.textContent = originalName;
            element.style.display = 'block';
        }
    });
}

// 初始化会话列表
async function initializeConversations() {
    const urlParams = new URLSearchParams(window.location.search);
    const departmentType = urlParams.get('department');
    const agentName = urlParams.get('agent');
    const username = localStorage.getItem('username') || 'anonymous';
    
    if (!departmentType || !agentName) return;
    
    const conversations = await getConversations(departmentType, agentName);
    const conversationList = document.querySelector('.conversation-list');
    conversationList.innerHTML = '';
    
    conversations.forEach(conversation => {
        createConversationElement(conversation);
    });
    
    // 从localStorage获取当前会话ID
    const currentKey = `currentConversation_${username}_${departmentType}_${agentName}`;
    const currentId = localStorage.getItem(currentKey);
    
    if (currentId && conversations.some(c => c.conversation_id === currentId)) {
        switchToConversation(departmentType, agentName, currentId);
    } else if (conversations.length > 0) {
        switchToConversation(departmentType, agentName, conversations[0].conversation_id);
    } else {
        // 如果没有任何会话，创建新会话
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
async function saveMessageToConversation(message, type) {
    if (!currentConversationId) return;

    try {
        const messageData = {
            conversation_id: currentConversationId,
            message_content: message,
            message_type: type
        };

        // 调用服务器API保存消息
        const response = await fetch('http://localhost:3000/message/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(messageData)
        });

        if (!response.ok) {
            throw new Error(`保存消息失败: ${response.status}`);
        }
    } catch (error) {
        console.error('保存消息失败:', error);
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
    if (newChatBtn) {
        newChatBtn.addEventListener('click', createNewConversation);
    }
});
