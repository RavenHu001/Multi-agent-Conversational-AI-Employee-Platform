import { userDB } from '../codes/user_DB.js';
import { dbUtil } from '../utile/DB_utile.js';
import path from 'path';
import { fileURLToPath } from 'url';
import assert from 'assert';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 清理数据库中的测试数据
 */
async function cleanupTestData() {
    try {
        // 删除所有测试用户
        const testUsernames = ['testadmin', 'testuser1', 'testuser2'];
        for (const username of testUsernames) {
            const users = await dbUtil.query(
                'SELECT id FROM users WHERE username = ?',
                [username]
            );
            if (users.length > 0) {
                await dbUtil.delete('users', 'username = ?', [username]);
                console.log(`清理测试用户: ${username}`);
            }
        }
        console.log('✅ 测试数据清理完成\n');
    } catch (error) {
        console.error('清理测试数据时发生错误:', error);
        throw error;
    }
}

async function setupTestDatabase() {
    // 确保测试数据库目录存在
    const dbDir = path.join(__dirname, '../dataBase');
    await fs.mkdir(dbDir, { recursive: true });
    
    // 设置测试数据库路径
    const testDbPath = path.join(dbDir, 'test.sqlite');
    
    // 如果测试数据库文件存在，先删除它
    try {
        await fs.unlink(testDbPath);
        console.log('已删除旧的测试数据库文件');
    } catch (error) {
        // 文件不存在，忽略错误
    }

    // 初始化数据库连接
    await dbUtil.init(testDbPath);
    // 等待用户数据库初始化完成
    await userDB.init();
    
    // 清理可能存在的测试数据
    await cleanupTestData();
    
    console.log('✅ 数据库初始化成功\n');
}

async function cleanupTestDatabase() {
    // 清理测试数据
    await cleanupTestData();
    
    // 关闭数据库连接
    dbUtil.close();
    console.log('数据库连接已关闭');
    
    // 清理测试数据库文件
    try {
        const testDbPath = path.join(__dirname, '../dataBase/test.sqlite');
        await fs.unlink(testDbPath);
        console.log('测试数据库文件已清理');
    } catch (error) {
        console.error('清理测试数据库文件时发生错误:', error);
    }
}

async function runUserTests() {
    console.log('开始用户数据库测试...\n');
    
    try {
        // 设置测试环境
        await setupTestDatabase();

        // 测试用户数据
        const testUsers = [
            {
                username: 'testadmin',
                password: 'admin123',
                level: 'admin',
                points: 100
            },
            {
                username: 'testuser1',
                password: 'user123',
                level: 'user',
                points: 50
            },
            {
                username: 'testuser2',
                password: 'user456',
                level: 'user',
                points: 30
            }
        ];

        // 测试创建用户
        console.log('测试创建用户...');
        const createdUserIds = [];
        for (const userData of testUsers) {
            const userId = await userDB.createUser(userData);
            console.log(`创建用户 ${userData.username}，ID:`, userId);
            createdUserIds.push(userId);
            
            // 验证用户创建
            const user = await userDB.getUserById(userId);
            assert(user.username === userData.username, '用户名验证失败');
            assert(user.level === userData.level, '用户级别验证失败');
            assert(user.points === userData.points, '用户点数验证失败');
        }
        console.log('✅ 用户创建测试成功\n');

        // 测试重复用户名
        console.log('测试重复用户名检查...');
        try {
            await userDB.createUser(testUsers[0]);
            throw new Error('应该检测到重复用户名');
        } catch (error) {
            if (error.message === '用户名已存在') {
                console.log('✅ 重复用户名检查测试成功\n');
            } else {
                throw error;
            }
        }

        // 测试用户登录验证
        console.log('测试用户登录验证...');
        const verifiedUser = await userDB.verifyUser(testUsers[0].username, testUsers[0].password);
        assert(verifiedUser !== null, '用户验证失败');
        assert(verifiedUser.username === testUsers[0].username, '验证用户名不匹配');
        console.log('✅ 用户登录验证测试成功\n');

        // 测试更新用户登录时间
        console.log('测试更新用户登录时间...');
        const loginUpdateResult = await userDB.updateLoginTime(createdUserIds[0]);
        assert(loginUpdateResult === true, '更新登录时间失败');
        const updatedUser = await userDB.getUserById(createdUserIds[0]);
        assert(updatedUser.last_login !== null, '登录时间未更新');
        console.log('✅ 更新登录时间测试成功\n');

        // 测试更新用户点数
        console.log('测试更新用户点数...');
        const newPoints = 200;
        const pointsUpdateResult = await userDB.updatePoints(createdUserIds[1], newPoints);
        assert(pointsUpdateResult === true, '更新点数失败');
        const userWithNewPoints = await userDB.getUserById(createdUserIds[1]);
        assert(userWithNewPoints.points === newPoints, '点数更新验证失败');
        console.log('✅ 更新用户点数测试成功\n');

        // 测试负数点数
        console.log('测试负数点数验证...');
        try {
            await userDB.updatePoints(createdUserIds[1], -50);
            throw new Error('应该检测到负数点数');
        } catch (error) {
            if (error.message === '点数不能为负数') {
                console.log('✅ 负数点数验证测试成功\n');
            } else {
                throw error;
            }
        }

        // 测试更新用户权限等级
        console.log('测试更新用户权限等级...');
        const levelUpdateResult = await userDB.updateUserLevel(createdUserIds[1], 'admin');
        assert(levelUpdateResult === true, '更新权限等级失败');
        const userWithNewLevel = await userDB.getUserById(createdUserIds[1]);
        assert(userWithNewLevel.level === 'admin', '权限等级更新验证失败');
        console.log('✅ 更新用户权限等级测试成功\n');

        // 测试无效权限等级
        console.log('测试无效权限等级验证...');
        try {
            await userDB.updateUserLevel(createdUserIds[1], 'superuser');
            throw new Error('应该检测到无效的权限等级');
        } catch (error) {
            if (error.message === '无效的权限等级') {
                console.log('✅ 无效权限等级验证测试成功\n');
            } else {
                throw error;
            }
        }

        // 测试删除用户
        console.log('测试删除普通用户...');
        const deleteResult = await userDB.deleteUser(createdUserIds[2]);
        assert(deleteResult === true, '删除用户失败');
        const deletedUser = await userDB.getUserById(createdUserIds[2]);
        assert(deletedUser === null, '用户未被成功删除');
        console.log('✅ 删除普通用户测试成功\n');

        // 测试删除最后一个管理员
        console.log('测试删除最后一个管理员保护...');
        try {
            // 先删除一个管理员
            await userDB.deleteUser(createdUserIds[1]);
            // 尝试删除最后一个管理员
            await userDB.deleteUser(createdUserIds[0]);
            throw new Error('应该防止删除最后一个管理员');
        } catch (error) {
            if (error.message === '不能删除最后一个管理员账户') {
                console.log('✅ 最后管理员保护测试成功\n');
            } else {
                throw error;
            }
        }

        console.log('所有用户数据库测试完成！✅\n');

    } catch (error) {
        console.error('❌ 测试过程中发生错误:', error);
        throw error;
    } finally {
        // 清理测试环境
        await cleanupTestDatabase();
    }
}

// 运行测试
runUserTests().catch(error => {
    console.error('测试程序执行失败:', error);
    process.exit(1);
}); 