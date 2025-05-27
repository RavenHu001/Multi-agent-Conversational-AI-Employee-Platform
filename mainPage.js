document.addEventListener('DOMContentLoaded', async function() {
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
    try {
        const agents = await loadConfig('agents.json');
        console.log('Agents:', agents);

        //加载并处理部门数据
        const departments = await loadConfig('department.json');
        console.log('Departments:', departments);
        displayDepartments(departments);
        
        // 从localStorage获取保存的部门和智能体
        const departmentType = localStorage.getItem('selectedDepartment');
        const agentName = localStorage.getItem('selectedAgent');

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
                    }, 100);
                }
            }, 100);
        }
    } catch (error) {
        console.error('Error loading departments:', error);
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

// 加载配置文件的函数
async function loadConfig(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
}

//iframe的chatBox
function setChatBox() {
    const agentItems = document.querySelectorAll('.agent-item');
    const chatFrame = document.querySelector('.chat-frame');
    
    agentItems.forEach(item => {
        item.addEventListener('click', function() {
            agentItems.forEach(agent => agent.classList.remove('active'));
            this.classList.add('active');
            
            const agentName = this.querySelector('.agent-name').textContent;
            const activeDepartment = document.querySelector('.department-item.active');
            const departmentType = activeDepartment ? activeDepartment.getAttribute('data-department') : '';
            
            // 更新iframe的src
            if (chatFrame) {
                chatFrame.src = `chat.html?department=${departmentType}&agent=${encodeURIComponent(agentName)}`;
            }
            
            localStorage.setItem('selectedAgent', agentName);
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
                setChatBox();
                //自动选择第一个智能体
                const firstAgent = agentListContainer.querySelector('.agent-item');
                if (firstAgent) {
                    firstAgent.click();
                }
            });
            
            console.log('Selected department:', element.type);
            console.log('localstorage', localStorage.getItem('selectedAgent')+localStorage.getItem('selectedDepartment'));
        });
        
        departmentListContainer.appendChild(departmentItem);
    });
}



