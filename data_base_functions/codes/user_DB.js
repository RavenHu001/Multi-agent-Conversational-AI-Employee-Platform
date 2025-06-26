import { dbUtil } from '../utile/DB_utile.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 数据库文件路径
const DB_PATH = path.join(__dirname, '../dataBase/mainDB.sqlite');

class UserDB {
    constructor() {
        // 初始化数据库连接
        this.init();
    }

    /**
     * 初始化数据库连接并确保用户表存在
     */
    async init() {
        try {
            // 初始化数据库连接
            await dbUtil.init(DB_PATH);
            // 确保用户表存在
            await this.ensureUserTable();
        } catch (error) {
            console.error('数据库初始化失败:', error);
            throw error;
        }
    }

    /**
     * 检查并创建用户表
     */
    async ensureUserTable() {
        try {
            const createTableSQL = `
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE NOT NULL,
                    password TEXT NOT NULL,
                    level TEXT DEFAULT 'user',
                    points INTEGER DEFAULT 0,
                    last_login TEXT
                )
            `;
            await dbUtil.query(createTableSQL);
        } catch (error) {
            console.error('创建用户表失败:', error);
            throw error;
        }
    }

    /**
     * 创建新用户
     * @param {Object} userData - 用户数据对象
     * @returns {number} - 新用户的ID
     */
    async createUser(userData) {
        try {
            // 检查用户名是否已存在
            const existingUser = await dbUtil.query(
                'SELECT id FROM users WHERE username = ?',
                [userData.username]
            );
            
            if (existingUser.length > 0) {
                throw new Error('用户名已存在');
            }

            // 设置默认值
            const newUser = {
                username: userData.username,
                password: userData.password,
                level: userData.level || 'user',
                points: userData.points || 0,
                last_login: new Date().toLocaleString()
            };

            const userId = await dbUtil.insert('users', newUser);
            return userId;
        } catch (error) {
            console.error('创建用户失败:', error);
            throw error;
        }
    }

    /**
     * 更新用户登录时间
     * @param {number} userId - 用户ID
     * @returns {boolean} - 是否更新成功
     */
    async updateLoginTime(userId) {
        try {
            const result = await dbUtil.update(
                'users',
                { last_login: new Date().toLocaleString() },
                'id = ?',
                [userId]
            );
            return result > 0;
        } catch (error) {
            console.error('更新登录时间失败:', error);
            throw error;
        }
    }

    /**
     * 更新用户点数
     * @param {number} userId - 用户ID
     * @param {number} points - 新的点数
     * @returns {boolean} - 是否更新成功
     */
    async updatePoints(userId, points) {
        try {
            if (points < 0) {
                throw new Error('点数不能为负数');
            }
            
            const result = await dbUtil.update(
                'users',
                { points },
                'id = ?',
                [userId]
            );
            return result > 0;
        } catch (error) {
            console.error('更新用户点数失败:', error);
            throw error;
        }
    }

    /**
     * 更新用户权限等级
     * @param {number} userId - 用户ID
     * @param {string} level - 新的权限等级
     * @returns {boolean} - 是否更新成功
     */
    async updateUserLevel(userId, level) {
        try {
            // 验证权限等级是否有效
            const validLevels = ['user', 'admin'];
            if (!validLevels.includes(level)) {
                throw new Error('无效的权限等级');
            }

            const result = await dbUtil.update(
                'users',
                { level },
                'id = ?',
                [userId]
            );
            return result > 0;
        } catch (error) {
            console.error('更新用户权限失败:', error);
            throw error;
        }
    }

    /**
     * 删除用户
     * @param {number} userId - 要删除的用户ID
     * @returns {boolean} - 是否删除成功
     */
    async deleteUser(userId) {
        try {
            // 检查是否为最后一个管理员
            const user = await dbUtil.query(
                'SELECT level FROM users WHERE id = ?',
                [userId]
            );

            if (user.length > 0 && user[0].level === 'admin') {
                const adminCount = await dbUtil.query(
                    'SELECT COUNT(*) as count FROM users WHERE level = ?',
                    ['admin']
                );
                
                if (adminCount[0].count <= 1) {
                    throw new Error('不能删除最后一个管理员账户');
                }
            }

            const result = await dbUtil.delete('users', 'id = ?', [userId]);
            return result > 0;
        } catch (error) {
            console.error('删除用户失败:', error);
            throw error;
        }
    }

    /**
     * 获取用户信息
     * @param {number} userId - 用户ID
     * @returns {Object|null} - 用户信息对象
     */
    async getUserById(userId) {
        try {
            const users = await dbUtil.query(
                'SELECT id, username, level, points, last_login FROM users WHERE id = ?',
                [userId]
            );
            return users.length > 0 ? users[0] : null;
        } catch (error) {
            console.error('获取用户信息失败:', error);
            throw error;
        }
    }

    /**
     * 验证用户登录
     * @param {string} username - 用户名
     * @param {string} password - 密码
     * @returns {Object|null} - 用户信息对象
     */
    async verifyUser(username, password) {
        try {
            const users = await dbUtil.query(
                'SELECT id, username, level, points, last_login FROM users WHERE username = ? AND password = ?',
                [username, password]
            );
            return users.length > 0 ? users[0] : null;
        } catch (error) {
            console.error('用户验证失败:', error);
            throw error;
        }
    }
}

// 导出单例实例
export const userDB = new UserDB();