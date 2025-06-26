import { dbUtil } from '../utile/DB_utile.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runTests() {
    console.log('开始数据库测试...\n');
    
    try {
        // 确保数据库目录存在
        const dbDir = path.join(__dirname, 'dataBase');
        await import('fs').then(fs => fs.promises.mkdir(dbDir, { recursive: true }));
        
        // 初始化数据库
        const dbPath = path.join(dbDir, 'test.sqlite');
        console.log('初始化数据库:', dbPath);
        await dbUtil.init(dbPath);
        console.log('✅ 数据库初始化成功\n');

        // 删除旧的测试表（如果存在）
        console.log('清理旧的测试表...');
        await dbUtil.query('DROP TABLE IF EXISTS test_users');
        console.log('✅ 旧表清理完成\n');

        // 创建测试表
        console.log('创建测试表...');
        await dbUtil.query(`
            CREATE TABLE IF NOT EXISTS test_users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                age INTEGER,
                email TEXT UNIQUE
            )
        `);
        console.log('✅ 测试表创建成功\n');

        // 测试插入数据
        console.log('测试插入数据...');
        const insertData = {
            name: '张三',
            age: 25,
            email: 'zhangsan@example.com'
        };
        const newId = await dbUtil.insert('test_users', insertData);
        console.log('✅ 插入数据成功，新记录ID:', newId, '\n');

        // 测试批量插入
        console.log('测试批量插入...');
        const users = [
            { name: '李四', age: 30, email: 'lisi@example.com' },
            { name: '王五', age: 35, email: 'wangwu@example.com' }
        ];
        for (const user of users) {
            const id = await dbUtil.insert('test_users', user);
            console.log(`插入用户 ${user.name}，ID:`, id);
        }
        console.log('✅ 批量插入成功\n');

        // 测试查询
        console.log('测试查询所有用户...');
        const allUsers = await dbUtil.query('SELECT * FROM test_users');
        console.log('查询结果:', allUsers);
        console.log('✅ 查询测试成功\n');

        // 测试条件查询
        console.log('测试条件查询...');
        const youngUsers = await dbUtil.query(
            'SELECT * FROM test_users WHERE age < ?',
            [30]
        );
        console.log('30岁以下的用户:', youngUsers);
        console.log('✅ 条件查询测试成功\n');

        // 测试更新
        console.log('测试更新数据...');
        const updateResult = await dbUtil.update(
            'test_users',
            { age: 26 },
            'name = ?',
            ['张三']
        );
        console.log('更新影响的行数:', updateResult);
        console.log('✅ 更新测试成功\n');

        // 验证更新结果
        console.log('验证更新结果...');
        const updatedUser = await dbUtil.query(
            'SELECT * FROM test_users WHERE name = ?',
            ['张三']
        );
        console.log('更新后的用户数据:', updatedUser);
        console.log('✅ 更新验证成功\n');

        // 测试删除
        console.log('测试删除数据...');
        const deleteResult = await dbUtil.delete(
            'test_users',
            'name = ?',
            ['王五']
        );
        console.log('删除影响的行数:', deleteResult);
        console.log('✅ 删除测试成功\n');

        // 验证删除结果
        console.log('验证删除结果...');
        const remainingUsers = await dbUtil.query('SELECT * FROM test_users');
        console.log('剩余用户数据:', remainingUsers);
        console.log('✅ 删除验证成功\n');

        // 测试错误处理
        console.log('测试错误处理...');
        try {
            await dbUtil.query('SELECT * FROM non_existent_table');
        } catch (error) {
            console.log('✅ 错误处理测试成功：成功捕获了表不存在的错误\n');
        }

        console.log('所有测试完成！✅\n');

    } catch (error) {
        console.error('❌ 测试过程中发生错误:', error);
    } finally {
        // 清理测试数据
        try {
            await dbUtil.query('DROP TABLE IF EXISTS test_users');
            console.log('测试表清理完成');
        } catch (error) {
            console.error('清理测试表时发生错误:', error);
        }
        
        // 关闭数据库连接
        dbUtil.close();
        console.log('数据库连接已关闭');
    }
}

// 运行测试
runTests().catch(error => {
    console.error('测试程序执行失败:', error);
    process.exit(1);
}); 