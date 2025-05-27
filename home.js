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
        checkLoginStatus();
    });

    try {
        const departments = await loadConfig('department.json');
        console.log('Department:', departments);
        displayDepartments(departments);
        setupBackgroundTransitions(departments);
    } catch (error) {
        console.error('Error loading agents:', error);
    }
});

// 检查登录状态并更新UI
function checkLoginStatus() {
    const isLogin = localStorage.getItem('is_login');
    const username = localStorage.getItem('username');
    const loginBtn = document.getElementById('login-btn');
    const userInfo = document.getElementById('user-info');
    const usernameDisplay = document.getElementById('username-display');

    if (isLogin==='true'&&username) {
        // 已登录状态
        loginBtn.style.display = 'none';
        userInfo.style.display = 'flex';
        usernameDisplay.textContent = username;
    } else {
        // 未登录状态
        loginBtn.style.display = 'block';
        userInfo.style.display = 'none';
        // 清除可能存在的无效登录状态
        localStorage.removeItem('username');
        localStorage.removeItem('is_login');
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

//显示部门的函数（固定位置+固定大小）
function displayDepartments(departments) {
    const departmentListContainer = document.querySelector('.department-list');
    departmentListContainer.innerHTML = ' ';//清空内容
    departments.forEach(element => {
        const departmentItem = document.createElement('div');
        departmentItem.className = 'department-item';
        departmentItem.innerHTML = `
            <button class="department-avatar"
             data-department="${element.type}">
                ${element.avatar}
            </button>
        `;
        
        // 添加点击事件处理
        const button = departmentItem.querySelector('.department-avatar');
        button.addEventListener('click', function() {
            const departmentType = this.getAttribute('data-department');
            // 保存到localStorage
            localStorage.setItem('selectedDepartment', departmentType);
            // 跳转到mainPage
            window.location.href = 'mainPage.html';
        });
        
        departmentListContainer.appendChild(departmentItem);
    });
}

// 设置背景切换效果
function setupBackgroundTransitions(departments) {
    const backgroundContainer = document.querySelector('.background-container');
    let currentBackground = null;
    let nextBackground = null;
    let transitionTimeout = null;

    // 创建所有部门的背景层
    departments.forEach(dept => {
        const layer = document.createElement('div');
        layer.className = 'background-layer';
        layer.style.backgroundImage = `url('images/background_home/${dept.type}.jpg')`;
        backgroundContainer.appendChild(layer);
    });

    // 设置默认背景
    const defaultLayer = document.createElement('div');
    defaultLayer.className = 'background-layer active';
    defaultLayer.style.backgroundImage = `url('images/background_home/defult.jpg')`;
    backgroundContainer.appendChild(defaultLayer);

    // 为每个部门按钮添加鼠标事件
    document.querySelectorAll('.department-avatar').forEach(button => {
        button.addEventListener('mouseenter', function() {
            const departmentType = this.getAttribute('data-department');
            const targetLayer = document.querySelector(`.background-layer[style*="${departmentType}.jpg"]`);
            
            if (targetLayer) {
                // 清除之前的过渡
                if (transitionTimeout) {
                    clearTimeout(transitionTimeout);
                }

                // 设置新的背景
                if (currentBackground) {
                    currentBackground.classList.remove('active');
                }
                targetLayer.classList.add('active');
                currentBackground = targetLayer;
            }
        });

        button.addEventListener('mouseleave', function() {
            // 延迟恢复默认背景，以便在快速移动鼠标时保持平滑过渡
            transitionTimeout = setTimeout(() => {
                if (currentBackground) {
                    currentBackground.classList.remove('active');
                }
                defaultLayer.classList.add('active');
                currentBackground = defaultLayer;
            }, 100);
        });
    });
}

// 显示智能体的函数(固定位置+固定大小)
// function displayAgents(agents) {
//     const agentListContainer = document.querySelector('.agent-list');
//     agentListContainer.innerHTML = ' ';//清空内容
//     agents.forEach(element => {
//         const agentItem = document.createElement('div');
//         agentItem.className = 'agent-item';
//         agentItem.innerHTML = `
//             <div class="agent-name">${element.name}</div>
//             <button class="agent-avatar" onclick="window.location.href='mainPage.html?agent=${element.type}'">${element.avatar}</button>
//         `;
//         agentListContainer.appendChild(agentItem);
//     });
// }
// // 显示智能体的函数(随机位置+随机大小)
// function displayAgents(agents) {
//     const agentListContainer = document.querySelector('.agent-list');
//     agentListContainer.innerHTML = ''; // 清空现有内容
//     const containerWidth = window.innerWidth;
//     const containerHeight = window.innerHeight;
//     const maxOffsetX = containerWidth * 0.75 / 2;
//     const maxOffsetY = containerHeight * 0.5 / 2;
//     const buttonSize = 130; // 中央按钮的大小
//     const buttonRadius = buttonSize / 2;
//     const placedItems = [];

//     agents.forEach(agent => {
//         const agentItem = document.createElement('div');
//         agentItem.className = 'agent-item';
//         agentItem.innerHTML = `
//             <div class="agent-name">${agent.name}</div>
//             <div class="agent-avatar">${agent.avatar}</div>
//         `;
        
//         let offsetX, offsetY, scale;
//         let isOverlapping;
//         do {
//             offsetX = (Math.random() - 0.5) * 2 * maxOffsetX;
//             offsetY = (Math.random() - 0.5) * 2 * maxOffsetY;
//             scale = 1 + Math.random() * 0.5; // 100% to 150%
//             isOverlapping = placedItems.some(item => {
//                 const dx = item.offsetX - offsetX;
//                 const dy = item.offsetY - offsetY;
//                 const distance = Math.sqrt(dx * dx + dy * dy);
//                 return distance < (50 * scale + 50 * item.scale); // 50 is the base radius
//             });
//         } while ((Math.abs(offsetX) < buttonRadius+50*scale && Math.abs(offsetY) < buttonRadius+50*scale )|| isOverlapping);

//         agentItem.style.transform = `scale(${scale})`;
//         agentItem.style.position = 'absolute';
//         agentItem.style.left = `calc(50% + ${offsetX}px)`;
//         agentItem.style.top = `calc(50% + ${offsetY}px)`;

//         placedItems.push({ offsetX, offsetY, scale });
//         agentListContainer.appendChild(agentItem);
//     });
// } 