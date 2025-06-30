import { dbUtil } from '../utile/DB_utile.js';
import MessageDB from '../codes/message_DB.js';
import ConversationDB from '../codes/conversation_DB.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runTests() {
    console.log('开始消息数据库测试...\n');
    const messageDB = new MessageDB();
    const conversationDB = new ConversationDB();
    const dbPath = path.join(__dirname, 'dataBase', 'test.sqlite');
    
    try {
        // 确保数据库目录存在
        const dbDir = path.join(__dirname, 'dataBase');
        await fs.mkdir(dbDir, { recursive: true });
        
        // 初始化数据库
        console.log('初始化数据库:', dbPath);
        
        // 初始化两个数据库实例
        await messageDB.init(dbPath);
        await conversationDB.init(dbPath);
        console.log('✅ 数据库初始化成功\n');

        // 清理旧的测试表
        console.log('清理旧的测试表...');
        await dbUtil.query('DROP TABLE IF EXISTS messages');
        await dbUtil.query('DROP TABLE IF EXISTS conversations');
        console.log('✅ 旧表清理完成\n');

        // 创建会话表和消息表
        await conversationDB.ensureHistoryTable();
        await messageDB.ensureMessageTable();
        console.log('✅ 测试表创建成功\n');

        // 测试创建会话
        console.log('测试创建会话...');
        const conversationData = {
            conversation_id: 1,
            conversation_name: '测试会话',
            user_name: '测试用户',
            department: '测试部门',
            agent: '测试智能体'
        };
        await conversationDB.createConversation(conversationData);
        console.log('✅ 会话创建成功\n');

        // 测试创建消息
        console.log('测试创建消息...');
        const messageData = {
            conversation_id: 1,
            message_content: '你好，这是一条测试消息',
            message_type: 'user'
        };
        const messageId = await messageDB.createMessage(messageData);
        console.log('✅ 消息创建成功，消息ID:', messageId, '\n');

        // 测试创建多条消息
        console.log('测试创建多条消息...');
        const messages = [
            {
                conversation_id: 1,
                message_content: '这是第二条消息',
                message_type: 'assistant'
            },
            {
                conversation_id: 1,
                message_content: '这是第三条消息',
                message_type: 'user'
            }
        ];
        for (const msg of messages) {
            const id = await messageDB.createMessage(msg);
            console.log(`创建消息成功，消息ID: ${id}`);
        }
        console.log('✅ 多条消息创建成功\n');

        // 测试获取消息
        console.log('测试获取消息...');
        const conversationMessages = await messageDB.getMessages(1);
        console.log('会话消息列表:', conversationMessages);
        console.log('✅ 消息获取测试成功\n');

        // 测试错误处理 - 不存在的会话
        console.log('测试错误处理 - 不存在的会话...');
        try {
            await messageDB.createMessage({
                conversation_id: 999,
                message_content: '这条消息不应该被创建',
                message_type: 'user'
            });
            console.log('❌ 错误：应该抛出错误但没有');
        } catch (error) {
            console.log('✅ 错误处理测试成功：成功捕获了会话不存在的错误\n');
        }

        console.log('所有测试完成！✅\n');

    } catch (error) {
        console.error('❌ 测试过程中发生错误:', error);
    } finally {
        // 清理测试数据
        try {
            await dbUtil.query('DROP TABLE IF EXISTS messages');
            await dbUtil.query('DROP TABLE IF EXISTS conversations');
            console.log('测试表清理完成');
        } catch (error) {
            console.error('清理测试表时发生错误:', error);
        }
        
        // 关闭数据库连接
        dbUtil.close();
        console.log('数据库连接已关闭');

        // 删除测试数据库文件
        try {
            await fs.unlink(dbPath);
            console.log('测试数据库文件已删除');
        } catch (error) {
            console.error('删除测试数据库文件时发生错误:', error);
        }
    }
}

// 运行测试
runTests().catch(error => {
    console.error('测试程序执行失败:', error);
    process.exit(1);
}); 