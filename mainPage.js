document.addEventListener('DOMContentLoaded', async function() {
    try {
        const agents = await loadConfig('agents.json');
        console.log('Agents:', agents);

        //加载并处理部门数据
        const departments = await loadConfig('department.json');
        console.log('Departments:', departments);
        displayDepartments(departments);
        
    } catch (error) {
        console.error('Error loading agents:', error);
    }
    //按照输入链接自动选择部门
    const urlParams = new URLSearchParams(window.location.search);
    const departmentType = urlParams.get('department');
    if (departmentType) {
        const departmentItem = document.querySelector(`.department-item[data-department="${departmentType}"]`);
        if (departmentItem) {
            departmentItem.click();
        }
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

