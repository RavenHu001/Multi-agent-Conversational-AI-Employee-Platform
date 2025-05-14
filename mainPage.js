document.addEventListener('DOMContentLoaded', async function() {
    try {
        const agents = await loadConfig('agents.json');
        console.log('Agents:', agents);

        //加载并处理部门数据
        const departments = await loadConfig('department.json');
        console.log('Departments:', departments);
        displayDepartments(departments);
        
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
        
        // 恢复上次选择
        const savedDepartment = localStorage.getItem('selectedDepartment');
        const savedAgent = localStorage.getItem('selectedAgent');
        let departmentType = savedDepartment;
        let agentName = savedAgent;

        // 如果URL有参数，优先用URL参数
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('department')) departmentType = urlParams.get('department');
        if (urlParams.get('agent')) agentName = urlParams.get('agent');

        // 部门选择
        if (departmentType) {
            setTimeout(() => {
                const departmentItem = document.querySelector(`.department-item[data-department="${departmentType}"]`);
                if (departmentItem) {
                    departmentItem.click();
                    // 智能体选择延后到智能体渲染后
                    setTimeout(() => {
                        if (agentName) {
                            const agentItem = Array.from(document.querySelectorAll('.agent-item')).find(
                                item => item.querySelector('.agent-name').textContent === agentName
                            );
                            if (agentItem) agentItem.click();
                        }
                    }, 200);
                }
            }, 200);
        }
    } catch (error) {
        console.error('Error loading agents:', error);
    }
});

// 加载配置文件的函数
async function loadConfig(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
}

// 发送消息的函数
async function sendMessage() {
    const messageInput = document.querySelector('.message-input');
    const message = messageInput.value.trim();
    const activeAgent = document.querySelector('.agent-item.active');
    
    if (!message || !activeAgent) return;
    
    // 获取当前选中的智能体信息
    const agentName = activeAgent.querySelector('.agent-name').textContent;
    const agents = await loadConfig('agents.json');
    const currentAgent = agents.find(agent => agent.name === agentName);
    
    if (!currentAgent) return;
    
    // 添加用户消息到聊天界面
    addMessageToChat(message, 'user');
    messageInput.value = '';
    
    try {
        // 检查是否有API配置
        if (currentAgent['API-URL'] && currentAgent['API-Key']) {
            // 调用API发送消息
            const response = await fetch(currentAgent['API-URL'], {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${currentAgent['API-Key']}`
                },
                body: JSON.stringify({
                    bot_id: currentAgent['bot-id'],
                    stream: false,
                    auto_save_history: true,
                    messages: [{
                        role: 'user',
                        content: message,
                        content_type: "text"
                    }],
                })
            });
            
            if (!response.ok) {
                throw new Error(`API request failed: ${response.status}`);
            }
            
            const data = await response.json();
            console.log(data);
            // 添加AI回复到聊天界面
            if (data.messages && data.messages.length > 0) {
                addMessageToChat(data.messages[0].content, 'ai');
            } else {
                addMessageToChat('AI回复内容为空，请检查配置', 'ai');
            }
            //addMessageToChat(data.choices[0].message.content, 'ai');
        } else {
            // 如果没有API配置，使用默认回复
            addMessageToChat("抱歉，我暂时无法回复。请稍后再试。", 'ai');
        }
    } catch (error) {
        console.error('Error sending message:', error);
        addMessageToChat("发送消息时出现错误，请稍后重试。", 'ai');
    }
}

// 添加消息到聊天界面的函数
function addMessageToChat(message, type) {
    const chatMessages = document.querySelector('.chat-messages');
    const messageElement = document.createElement('div');
    messageElement.className = `message ${type}-message`;
    messageElement.innerHTML = `
        <div class="message-content">
            ${message}
        </div>
    `;
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function setChatBox(agents){
    // 获取所有智能体元素
    const agentItems = document.querySelectorAll('.agent-item');
    const chatMessages = document.querySelector('.chat-messages');
    const messageInput = document.querySelector('.message-input');
    // 为每个智能体添加点击事件
    agentItems.forEach(item => {
        item.addEventListener('click', function() {
            // 移除所有智能体的active类
            agentItems.forEach(agent => agent.classList.remove('active'));
            // 为当前点击的智能体添加active类
            this.classList.add('active');
            // 获取当前选中的智能体类型
            const agentType = this.getAttribute('data-agent');
            // 清空聊天记录
            chatMessages.innerHTML = '';
        
            // 添加新智能体的欢迎消息
            const welcomeMessage_str = agents.find(agent => agent.name === this.querySelector('.agent-name').textContent).welcome;
            const welcomeMessage = document.createElement('div');
            welcomeMessage.className = 'message ai-message';
            welcomeMessage.innerHTML = `
                <div class="message-content">
                 ${welcomeMessage_str}
                </div>
            `;
            chatMessages.appendChild(welcomeMessage);
        
            // 更新输入框的placeholder
            messageInput.placeholder = `向${this.querySelector('.agent-name').textContent}发送消息...`;
            // 保存当前选择的智能体
            localStorage.setItem('selectedAgent', this.querySelector('.agent-name').textContent);
        });
    });
}

//展示部门的函数
function displayDepartments(departments) {
    const departmentListContainer = document.querySelector('.department-list');
    departmentListContainer.innerHTML = ''; // 清空内容
    departments.forEach(element => {
        const departmentItem = document.createElement('div');
        departmentItem.className = 'department-item';
        departmentItem.setAttribute('data-department', element.type);
        departmentItem.textContent = element.name;
        
        // 添加点击事件
        departmentItem.addEventListener('click', function() {
            // 移除所有部门的active类
            document.querySelectorAll('.department-item').forEach(item => {
                item.classList.remove('active');
            });
            // 为当前点击的部门添加active类
            this.classList.add('active');
            
            // 获取当前选中的部门类型
            const selectedDepartment = this.getAttribute('data-department');
            // 保存当前选择的部门
            localStorage.setItem('selectedDepartment', selectedDepartment);
            
            // 过滤并显示属于该部门的智能体
            const agentListContainer = document.querySelector('.agent-list');
            agentListContainer.innerHTML = ''; // 清空现有智能体列表
            
            // 从全局变量获取agents数据
            loadConfig('agents.json').then(agents => {
                // 过滤出属于当前部门的智能体
                const departmentAgents = agents.filter(agent => agent['department-type'] === selectedDepartment);
                
                // 显示过滤后的智能体
                departmentAgents.forEach(agent => {
                    const agentItem = document.createElement('div');
                    agentItem.className = 'agent-item';
                    agentItem.setAttribute('data-agent', agent.type);
                    agentItem.innerHTML = `
                        <div class="agent-avatar">${agent.avatar}</div>
                        <div class="agent-name">${agent.name}</div>
                    `;
                    agentListContainer.appendChild(agentItem);
                });
                
                // 重新设置聊天框事件
                setChatBox(departmentAgents);
                
                // 自动选择第一个智能体
                const firstAgent = agentListContainer.querySelector('.agent-item');
                if (firstAgent) {
                    firstAgent.click();
                }
            });
            
            console.log('Selected department:', element.type);
        });
        
        departmentListContainer.appendChild(departmentItem);
    });
}

