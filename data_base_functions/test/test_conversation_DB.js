import { default as ConversationDB } from '../codes/conversation_DB.js';
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
        // 删除所有测试会话
        const testUsernames = ['testuser1', 'testuser2', 'testadmin'];
        for (const username of testUsernames) {
            const conversations = await dbUtil.query(
                'SELECT conversation_id FROM conversations WHERE user_name = ?',
                [username]
            );
            if (conversations.length > 0) {
                await dbUtil.delete('conversations', 'user_name = ?', [username]);
                console.log(`清理测试用户的会话: ${username}`);
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
    
    // 创建会话数据库实例
    const conversationDB = new ConversationDB();
    // 等待会话数据库初始化完成
    await conversationDB.init();
    
    // 清理可能存在的测试数据
    await cleanupTestData();
    
    console.log('✅ 数据库初始化成功\n');
    
    return conversationDB;
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

async function runConversationTests() {
    console.log('开始会话数据库测试...\n');
    let conversationDB;
    
    try {
        // 设置测试环境
        conversationDB = await setupTestDatabase();

        // 测试会话数据
        const testConversations = [
            {
                conversation_id: 1,
                conversation_name: "测试会话1",
                user_name: "testuser1",
                department: "IT",
                agent: "agent1"
            },
            {
                conversation_id: 2,
                conversation_name: "测试会话2",
                user_name: "testuser2",
                department: "Data",
                agent: "agent2"
            },
            {
                conversation_id: 3,
                conversation_name: "测试会话3",
                user_name: "testadmin",
                department: "IT",
                agent: "agent1"
            }
        ];

        // 测试创建会话
        console.log('测试创建会话...');
        for (const conversationData of testConversations) {
            const conversationId = await conversationDB.createConversation(conversationData);
            console.log(`创建会话 ${conversationData.conversation_name}，ID: ${conversationId}`);
            
            // 验证会话创建
            const conversation = await conversationDB.getConversation(
                conversationData.user_name,
                conversationData.department,
                conversationData.agent
            );
            assert(conversation !== null, '会话创建失败');
            assert(conversation.conversation_name === conversationData.conversation_name, '会话名称验证失败');
            assert(conversation.user_name === conversationData.user_name, '用户名验证失败');
            assert(conversation.department === conversationData.department, '部门验证失败');
            assert(conversation.agent === conversationData.agent, '智能体验证失败');
        }
        console.log('✅ 会话创建测试成功\n');

        // 测试重复会话ID
        console.log('测试重复会话ID检查...');
        try {
            await conversationDB.createConversation(testConversations[0]);
            throw new Error('应该检测到重复会话ID');
        } catch (error) {
            if (error.message === '会话已存在') {
                console.log('✅ 重复会话ID检查测试成功\n');
            } else {
                throw error;
            }
        }

        // 测试更新会话时间
        console.log('测试更新会话时间...');
        const timeUpdateResult = await conversationDB.updateConversationTime(testConversations[0].conversation_id);
        assert(timeUpdateResult === true, '更新会话时间失败');
        console.log('✅ 更新会话时间测试成功\n');

        // 测试获取会话
        console.log('测试获取会话...');
        const retrievedConversation = await conversationDB.getConversation(
            testConversations[1].user_name,
            testConversations[1].department,
            testConversations[1].agent
        );
        assert(retrievedConversation !== null, '获取会话失败');
        assert(retrievedConversation.conversation_name === testConversations[1].conversation_name, '获取的会话名称不匹配');
        console.log('✅ 获取会话测试成功\n');

        // 测试删除会话
        console.log('测试删除会话...');
        const deleteResult = await conversationDB.deleteConversation(testConversations[2].conversation_id);
        assert(deleteResult === true, '删除会话失败');
        
        // 验证会话已被删除
        const deletedConversation = await conversationDB.getConversation(
            testConversations[2].user_name,
            testConversations[2].department,
            testConversations[2].agent
        );
        assert(deletedConversation === null, '会话未被成功删除');
        console.log('✅ 删除会话测试成功\n');

        // 测试删除不存在的会话
        console.log('测试删除不存在的会话...');
        try {
            await conversationDB.deleteConversation(9999);
            throw new Error('应该检测到会话不存在');
        } catch (error) {
            if (error.message === '会话不存在') {
                console.log('✅ 删除不存在会话测试成功\n');
            } else {
                throw error;
            }
        }

        console.log('所有会话数据库测试完成！✅\n');

    } catch (error) {
        console.error('❌ 测试过程中发生错误:', error);
        throw error;
    } finally {
        // 清理测试环境
        await cleanupTestDatabase();
    }
}

// 运行测试
runConversationTests().catch(error => {
    console.error('测试程序执行失败:', error);
    process.exit(1);
}); 