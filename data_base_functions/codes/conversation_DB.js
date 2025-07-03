import { dbUtil } from '../utile/DB_utile.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 数据库文件路径
const DB_PATH = path.join(__dirname, '../dataBase/mainDB.sqlite');

class ConversationDB {
    constructor() {
        this.initialized = false;
    }

    /**
     * 初始化数据库连接并确保历史记录表存在
     */
    async init(dbPath = DB_PATH) {
        if (this.initialized) {
            console.log('会话数据库已经初始化过了');
            return;
        }
        
        try {
            console.log('开始初始化会话数据库...');
            console.log('数据库路径:', dbPath);
            
            // 初始化数据库连接
            await dbUtil.init(dbPath);
            console.log('数据库连接初始化成功');
            
            // 确保历史记录表存在
            await this.ensureHistoryTable();
            console.log('会话表创建/确认成功');
            
            this.initialized = true;
            console.log('会话数据库初始化完成');
        }catch(error){
            console.error('会话数据库初始化失败:', error);
            throw error;
        }
    }

    /**
     * 检查并创建历史记录表
     */
    async ensureHistoryTable(){
        try{
            console.log('开始创建/确认会话表...');
            //这个表是用来存储会话的，会话的id是conversation_id，用户名是user_name，部门是department，agent是agent，创建时间是created_at，更新时间是updated_at
            //conversattion_id是会话的唯一id
            const createTableSQL = `
                CREATE TABLE IF NOT EXISTS conversations(
                    conversation_id TEXT PRIMARY KEY,
                    conversation_name TEXT NOT NULL,
                    user_name TEXT NOT NULL,
                    department TEXT NOT NULL,
                    agent TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_name) REFERENCES users(username) ON DELETE CASCADE
                )
            `;
            await dbUtil.query(createTableSQL);
            console.log('会话表SQL执行完成');
            
            // 验证表是否创建成功
            const checkTableSQL = "SELECT name FROM sqlite_master WHERE type='table' AND name='conversations'";
            const tables = await dbUtil.query(checkTableSQL);
            if (tables.length > 0) {
                console.log('会话表存在性验证成功');
            } else {
                throw new Error('会话表创建失败，表不存在');
            }
        }catch(error){
            console.error('创建会话表失败:', error);
            throw error;
        }
    }

    /**
     * 创建会话
     * @param {Object} conversationData.conversation_id - 会话ID
     * @param {string} conversationData.conversation_name - 会话名称
     * @param {string} conversationData.user_name - 用户名
     * @param {string} conversationData.department - 部门
     * @param {string} conversationData.agent - agent
     * @returns {Promise<number>} - 创建的会话ID
     */
    async createConversation(conversationData){
        try{
            // 检查会话是否已存在
            const existingConversation = await dbUtil.query(
                'SELECT conversation_id FROM conversations WHERE conversation_id = ?',
                [conversationData.conversation_id]
            );
            
            if (existingConversation.length > 0) {
                throw new Error('会话已存在');
            }

            // 创建会话
            const newConversation = {
                conversation_id: conversationData.conversation_id,
                conversation_name: conversationData.conversation_name,
                user_name: conversationData.user_name,
                department: conversationData.department,
                agent: conversationData.agent
            }

            await dbUtil.insert('conversations', newConversation);
            return conversationData.conversation_id;
        }catch(error){
            console.error('创建会话失败:', error);
            throw error;
        }
    }
    /**
     * 更新会话时间
     * @param {number} conversationId - 要更新的会话ID
     * @returns {boolean} - 是否更新成功
     */
    async updateConversationTime(conversationId){
        try{
            const updateTimeSQL = `
                UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE conversation_id = ?
            `;
            await dbUtil.query(updateTimeSQL, [conversationId]);
            return true;
        }catch(error){
            console.error('更新会话时间失败:', error);
            throw error;
        }
    }

    /**
     * 更新会话名称
     * @param {number} conversationId - 要更新的会话ID
     * @param {string} conversationName - 要更新的会话名称
     * @returns {boolean} - 是否更新成功
     */
    async updateConversationName(conversationId, conversationName){
        try{
            await dbUtil.update('conversations', {conversation_name: conversationName}, 'conversation_id = ?', [conversationId]);
            return true;
        }catch(error){
            console.error('更新会话名称失败:', error);
            throw error;
        }
    }

    /**
     * 删除会话
     * @param {number} conversationId - 要删除的会话ID
     * @returns {boolean} - 是否删除成功
     */
    async deleteConversation(conversationId) {
        try {
            console.log(`[${new Date().toLocaleString()}] 开始删除会话，ID: ${conversationId}`);

            // 检查会话是否存在
            const existingConversation = await dbUtil.query(
                'SELECT * FROM conversations WHERE conversation_id = ?',
                [conversationId]
            );

            if (!existingConversation || existingConversation.length === 0) {
                console.log(`[${new Date().toLocaleString()}] 会话不存在: ${conversationId}`);
                throw new Error('会话不存在');
            }

            // 删除会话（消息会通过外键CASCADE自动删除）
            const changes = await dbUtil.delete('conversations', 'conversation_id = ?', [conversationId]);
            console.log(`[${new Date().toLocaleString()}] 会话删除完成，影响行数: ${changes}`);

            // 验证消息是否被删除
            const remainingMessages = await dbUtil.query(
                'SELECT COUNT(*) as count FROM messages WHERE conversation_id = ?',
                [conversationId]
            );
            
            if (remainingMessages[0].count > 0) {
                console.warn(`[${new Date().toLocaleString()}] 警告：仍有 ${remainingMessages[0].count} 条相关消息未被删除`);
                // 手动删除剩余消息
                await dbUtil.query('DELETE FROM messages WHERE conversation_id = ?', [conversationId]);
                console.log(`[${new Date().toLocaleString()}] 已手动清理剩余消息`);
            } else {
                console.log(`[${new Date().toLocaleString()}] 所有相关消息已被成功删除`);
            }

            return changes > 0;
        } catch (error) {
            console.error(`[${new Date().toLocaleString()}] 删除会话失败:`, error);
            throw error;
        }
    }

    /**
     * 通过用户名，部门，智能体获取会话 
     * @param {string} user_name - 用户名
     * @param {string} department - 部门
     * @param {string} agent - 智能体
     * @returns {Promise<Object>} - 会话对象
     */
    async getConversation(user_name, department, agent){
        try{
            const conversations = await dbUtil.query(
                'SELECT * FROM conversations WHERE user_name = ? AND department = ? AND agent = ? ORDER BY updated_at DESC',
                [user_name, department, agent]
            );
            return conversations.length > 0 ? conversations: null;
        }catch(error){
            console.error('获取会话失败:', error);
            throw error;
        }
    }
}

export default ConversationDB;