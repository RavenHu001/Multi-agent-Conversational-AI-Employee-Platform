/**
 * admin.js - 管理员页面的主要JavaScript文件
 * 提供用户管理功能，包括：
 * - 查看所有用户列表
 * - 创建新用户
 * - 编辑用户信息（权限等级和点数）
 * - 删除非管理员用户
 */

// 存储当前管理员信息
let currentAdminUsername = '';
let currentAdminLevel = '';

// 页面加载完成后执行初始化
document.addEventListener('DOMContentLoaded', () => {
    // 检查登录状态和管理员权限
    checkAdminAccess();

    // 为创建用户表单添加提交事件监听器
    document.getElementById('createUserForm').addEventListener('submit', handleCreateUser);

    // 为编辑用户表单添加提交事件监听器
    document.getElementById('editUserForm').addEventListener('submit', handleEditUser);
});

/**
 * 检查用户是否有管理员权限
 * 如果不是管理员则重定向到首页
 */
async function checkAdminAccess() {
    const username = localStorage.getItem('username');
    const isLogin = localStorage.getItem('is_login');

    if (!isLogin || !username) {
        window.location.href = '/home.html';
        return;
    }

    try {
        const response = await fetch(`/user/info?username=${username}&is_login=${isLogin}`);
        const data = await response.json();

        if (!data.success || data.user_data.level !== 'admin') {
            window.location.href = '/home.html';
            return;
        }

        // 保存当前管理员信息
        currentAdminUsername = username;
        currentAdminLevel = data.user_data.level;
        document.getElementById('currentAdmin').textContent = username;
        
        // 加载用户列表
        loadUsers();
    } catch (error) {
        console.error('验证管理员权限失败:', error);
        window.location.href = '/home.html';
    }
}

/**
 * 从服务器加载所有用户列表
 * 通过 GET 请求访问 /admin/users 接口
 * 成功后调用 displayUsers 显示用户列表
 * 失败则显示错误消息
 */
async function loadUsers() {
    try {
        const response = await fetch('/admin/users');
        if (!response.ok) {
            throw new Error('获取用户列表失败');
        }
        const data = await response.json();
        displayUsers(data.users);
    } catch (error) {
        showStatusMessage(error.message, false);
    }
}

/**
 * 将用户列表显示到页面上
 * @param {Array} users - 用户数组，每个用户包含 id, username, level, points, last_login 等信息
 */
function displayUsers(users) {
    const usersList = document.getElementById('usersList');
    usersList.innerHTML = ''; // 清空现有列表

    users.forEach(user => {
        const row = document.createElement('tr');
        // 判断是否是当前管理员自己
        const isSelf = user.username === currentAdminUsername;
        
        // 创建包含用户信息的表格行
        row.innerHTML = `
            <td>${user.username}</td>
            <td>${user.level === 'admin' ? '管理员' : '普通用户'}</td>
            <td>${user.points}</td>
            <td>${user.last_login || '从未登录'}</td>
            <td class="action-buttons">
                <button class="btn btn-warning" onclick="openEditModal(${user.id}, '${user.username}', '${user.level}', ${user.points})">编辑</button>
                ${(user.level !== 'admin' && !isSelf) ? 
                    `<button class="btn btn-danger" onclick="deleteUser(${user.id})">删除</button>` : 
                    ''
                }
            </td>
        `;
        usersList.appendChild(row);
    });
}

/**
 * 处理创建新用户的表单提交
 * @param {Event} event - 表单提交事件
 */
async function handleCreateUser(event) {
    event.preventDefault(); // 阻止表单默认提交行为

    // 收集表单数据
    const userData = {
        username: document.getElementById('newUsername').value,
        password: document.getElementById('newPassword').value,
        level: document.getElementById('newLevel').value,
        points: parseInt(document.getElementById('newPoints').value)
    };

    try {
        // 发送创建用户请求
        const response = await fetch('/admin/users/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(userData)
        });

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || '创建用户失败');
        }

        // 创建成功后的处理
        showStatusMessage('用户创建成功', true);
        document.getElementById('createUserForm').reset(); // 重置表单
        loadUsers(); // 重新加载用户列表
    } catch (error) {
        showStatusMessage(error.message, false);
    }
}

/**
 * 打开编辑用户的模态框
 * @param {number} userId - 用户ID
 * @param {string} username - 用户名
 * @param {string} level - 用户权限等级
 * @param {number} points - 用户点数
 */
function openEditModal(userId, username, level, points) {
    const isSelf = username === currentAdminUsername;
    const levelSelect = document.getElementById('editLevel');
    
    document.getElementById('editUserId').value = userId;
    document.getElementById('editUsername').value = username;
    document.getElementById('editLevel').value = level;
    document.getElementById('editPoints').value = points;

    // 如果是编辑自己，禁用权限等级选择
    levelSelect.disabled = isSelf;
    if (isSelf) {
        levelSelect.title = '不能修改自己的权限等级';
    } else {
        levelSelect.title = '';
    }

    document.getElementById('editUserModal').style.display = 'block';
}

/**
 * 关闭编辑用户的模态框
 */
function closeEditModal() {
    document.getElementById('editUserModal').style.display = 'none';
}

/**
 * 处理编辑用户的表单提交
 * @param {Event} event - 表单提交事件
 */
async function handleEditUser(event) {
    event.preventDefault(); // 阻止表单默认提交行为

    // 获取要更新的用户ID和数据
    const userId = document.getElementById('editUserId').value;
    const username = document.getElementById('editUsername').value;
    const isSelf = username === currentAdminUsername;

    const userData = {
        // 如果是编辑自己，保持原有权限等级
        level: isSelf ? currentAdminLevel : document.getElementById('editLevel').value,
        points: parseInt(document.getElementById('editPoints').value)
    };

    try {
        // 发送更新用户请求
        const response = await fetch(`/admin/users/${userId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(userData)
        });

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || '更新用户失败');
        }

        // 更新成功后的处理
        showStatusMessage('用户更新成功', true);
        closeEditModal();
        loadUsers(); // 重新加载用户列表
    } catch (error) {
        showStatusMessage(error.message, false);
    }
}

/**
 * 删除指定用户
 * @param {number} userId - 要删除的用户ID
 */
async function deleteUser(userId) {
    // 删除前确认
    if (!confirm('确定要删除这个用户吗？此操作不可撤销。')) {
        return;
    }

    try {
        // 发送删除用户请求
        const response = await fetch(`/admin/users/${userId}`, {
            method: 'DELETE'
        });

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || '删除用户失败');
        }

        // 删除成功后的处理
        showStatusMessage('用户删除成功', true);
        loadUsers(); // 重新加载用户列表
    } catch (error) {
        showStatusMessage(error.message, false);
    }
}

/**
 * 显示操作状态消息
 * @param {string} message - 要显示的消息
 * @param {boolean} isSuccess - 是否是成功消息
 */
function showStatusMessage(message, isSuccess) {
    const statusDiv = document.getElementById('statusMessage');
    // 设置消息样式
    statusDiv.className = `status-message ${isSuccess ? 'status-success' : 'status-error'}`;
    statusDiv.textContent = message;
    
    // 3秒后自动清除消息
    setTimeout(() => {
        statusDiv.textContent = '';
        statusDiv.className = '';
    }, 3000);
}

