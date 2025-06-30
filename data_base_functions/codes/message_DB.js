import { dbUtil } from '../utile/DB_utile.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 数据库文件路径
const DB_PATH = path.join(__dirname, '../dataBase/mainDB.sqlite');

class MessageDB {
    constructor() {
        this.initialized = false;
    }

    /**
     * 初始化数据库连接并确保历史记录表存在
     */
    async init(dbPath = DB_PATH) {
        if (this.initialized) {
            return;
        }
        
        try {
            // 初始化数据库连接
            await dbUtil.init(dbPath);
            // 确保消息表存在
            await this.ensureMessageTable();
            this.initialized = true;
        }catch(error){
            console.error('数据库初始化失败:', error);
            throw error;
        }
    }

    /**
     * 检查并创建消息表
     */
    async ensureMessageTable(){
        try{
            //conversation_id是第一主键，message_id是第二主键，需要确保第二主键在被插入时有自增
            const createTableSQL = `
                CREATE TABLE IF NOT EXISTS messages(
                    conversation_id INTEGER NOT NULL,
                    message_id INTEGER NOT NULL,
                    message_content TEXT NOT NULL,
                    message_type TEXT NOT NULL,
                    message_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (conversation_id, message_id)
                )
            `;
            await dbUtil.query(createTableSQL);
        }catch(error){
            console.error('创建消息表失败:', error);
            throw error;
        }
    }

    /**
     * 创建消息
     * @param {Object} messageData.conversation_id - 会话ID
     * @param {string} messageData.message_content - 消息内容
     * @param {string} messageData.message_type - 消息类型
     */
    async createMessage(messageData){
        try{
        // 检查会话是否存在
        const existingConversation = await dbUtil.query(
            'SELECT conversation_id FROM conversations WHERE conversation_id = ?',
            [messageData.conversation_id]
        );
        
        if (existingConversation.length === 0) {
            throw new Error('会话不存在');
        }

        // 获取当前会话下的消息数量
        const messageCount = await dbUtil.query(
            'SELECT COUNT(*) as count FROM messages WHERE conversation_id = ?',
            [messageData.conversation_id]
        );
        
        const nextMessageId = messageCount[0].count + 1;

        // 创建消息
        const newMessage = {
            conversation_id: messageData.conversation_id,
            message_id: nextMessageId,
            message_content: messageData.message_content,
            message_type: messageData.message_type,
            message_time: new Date().toISOString()
        };

        await dbUtil.insert('messages', newMessage);
        return nextMessageId;
        }catch(error){
            console.error('创建消息失败:', error);
            throw error;
        }
    }

    /**
     * 根据conversation_id获取多条消息并以message_id增序排序
     * @param {number} conversationId - 会话ID
     * @returns {Array} - 消息数组
     */
    async getMessages(conversationId){
        try{
            //检查会话是否存在
            const existingConversation  = await dbUtil.query(
                'SELECT conversation_id FROM conversations WHERE conversation_id = ?',
                [conversationId]
            );
            if(existingConversation.length === 0 ){
                throw new Error('会话不存在');
            }
            //获取对话下所有消息
            const messages = await dbUtil.query(
                'SELECT * FROM messages WHERE conversation_id = ? ORDER BY message_id ASC',
                [conversationId]
            );
            return messages;
        }catch(error){
            console.log('获取消息失败:', error);
            throw error;
        }
    }
}

export default MessageDB;