import initSqlJs from 'sql.js';
import fs from 'fs/promises';
import path from 'path';

class DBUtil {
    static instance = null;
    #db = null;
    #dbFilePath = null;

    constructor() {
        if (DBUtil.instance) {
            return DBUtil.instance;
        }
        DBUtil.instance = this;
    }

    /**
     * 初始化数据库连接
     * @param {string} dbPath - 数据库文件路径
     */
    async init(dbPath) {
        try {
            this.#dbFilePath = dbPath;
            const SQL = await initSqlJs();
            
            // 确保数据库目录存在
            const dbDir = path.dirname(dbPath);
            try {
                await fs.access(dbDir);
            } catch (err) {
                // 如果目录不存在，创建目录
                await fs.mkdir(dbDir, { recursive: true });
            }
            
            // 检查数据库文件是否存在
            try {
                const data = await fs.readFile(dbPath);
                this.#db = new SQL.Database(data);
            } catch (err) {
                // 如果文件不存在，创建新的数据库
                this.#db = new SQL.Database();
                await this.saveDatabase();
            }
            
            return true;
        } catch (error) {
            console.error('数据库初始化失败:', error);
            throw error;
        }
    }

    /**
     * 保存数据库到文件
     */
    async saveDatabase() {
        if (!this.#db || !this.#dbFilePath) {
            console.error('数据库或文件路径未初始化');
            return;
        }
        try {
            // 确保目录存在
            const dbDir = path.dirname(this.#dbFilePath);
            await fs.mkdir(dbDir, { recursive: true });
            
            // 导出并保存数据库
            const data = this.#db.export();
            const buffer = Buffer.from(data);
            await fs.writeFile(this.#dbFilePath, buffer);
            console.log(`数据库已保存到: ${this.#dbFilePath}`);
        } catch (error) {
            console.error('保存数据库失败:', error);
            throw error;
        }
    }

    /**
     * 执行SQL查询
     * @param {string} sql - SQL语句
     * @param {Array} params - 查询参数
     * @returns {Array} - 查询结果
     */
    async query(sql, params = []) {
        try {
            const stmt = this.#db.prepare(sql);
            stmt.bind(params);
            const results = [];
            while (stmt.step()) {
                results.push(stmt.getAsObject());
            }
            stmt.free();
            
            // 如果是CREATE TABLE语句，需要保存数据库文件
            if (sql.trim().toUpperCase().startsWith('CREATE TABLE')) {
                await this.saveDatabase();
            }
            
            return results;
        } catch (error) {
            console.error('查询执行失败:', error);
            throw error;
        }
    }

    /**
     * 执行插入操作
     * @param {string} table - 表名
     * @param {Object} data - 要插入的数据
     * @returns {number} - 插入的行ID
     */
    async insert(table, data) {
        try {
            const columns = Object.keys(data);
            const values = Object.values(data);
            const placeholders = new Array(values.length).fill('?').join(',');
            
            const sql = `INSERT INTO ${table} (${columns.join(',')}) VALUES (${placeholders})`;
            const stmt = this.#db.prepare(sql);
            stmt.run(values);
            stmt.free();
            
            const idStmt = this.#db.prepare('SELECT last_insert_rowid() as id');
            const lastId = idStmt.step() ? idStmt.get()[0] : null;
            idStmt.free();
            
            await this.saveDatabase();
            return lastId;
        } catch (error) {
            console.error('插入操作失败:', error);
            throw error;
        }
    }

    /**
     * 执行更新操作
     * @param {string} table - 表名
     * @param {Object} data - 要更新的数据
     * @param {string} where - WHERE条件
     * @param {Array} whereParams - WHERE条件的参数
     * @returns {number} - 受影响的行数
     */
    async update(table, data, where, whereParams = []) {
        try {
            const setClause = Object.keys(data).map(key => `${key} = ?`).join(',');
            const values = [...Object.values(data), ...whereParams];
            
            const sql = `UPDATE ${table} SET ${setClause} WHERE ${where}`;
            const stmt = this.#db.prepare(sql);
            stmt.run(values);
            stmt.free();
            
            const changesStmt = this.#db.prepare('SELECT changes() as count');
            const changes = changesStmt.step() ? changesStmt.get()[0] : 0;
            changesStmt.free();
            
            await this.saveDatabase();
            return changes;
        } catch (error) {
            console.error('更新操作失败:', error);
            throw error;
        }
    }

    /**
     * 执行删除操作
     * @param {string} table - 表名
     * @param {string} where - WHERE条件
     * @param {Array} params - WHERE条件的参数
     * @returns {number} - 受影响的行数
     */
    async delete(table, where, params = []) {
        try {
            const sql = `DELETE FROM ${table} WHERE ${where}`;
            const stmt = this.#db.prepare(sql);
            stmt.run(params);
            stmt.free();
            
            const changesStmt = this.#db.prepare('SELECT changes() as count');
            const changes = changesStmt.step() ? changesStmt.get()[0] : 0;
            changesStmt.free();
            
            await this.saveDatabase();
            return changes;
        } catch (error) {
            console.error('删除操作失败:', error);
            throw error;
        }
    }

    /**
     * 关闭数据库连接
     */
    close() {
        if (this.#db) {
            this.#db.close();
            this.#db = null;
        }
    }
}

// 导出单例实例
export const dbUtil = new DBUtil();
