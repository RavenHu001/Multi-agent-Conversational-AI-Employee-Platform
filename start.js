import { spawn } from 'child_process';
import open from 'open';

// 启动服务器
const server = spawn('node', ['server.js'], {
    stdio: 'inherit'
});

// 等待服务器启动（这里假设服务器启动需要2秒）
setTimeout(async () => {
    try {
        // 打开默认浏览器访问home.html
        await open('http://localhost:3000/home');
        console.log('Browser opened successfully!');
    } catch (err) {
        console.error('Failed to open browser:', err);
    }
}, 2000);

// 处理服务器进程的退出
server.on('close', (code) => {
    console.log(`Server process exited with code ${code}`);
});

// 处理进程终止信号
process.on('SIGINT', () => {
    server.kill('SIGINT');
    process.exit(0);
}); 