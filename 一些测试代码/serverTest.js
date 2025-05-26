const fetch = require('node - fetch');
const FormData = require('form - data');
const fs = require('fs');

const form = new FormData();
form.append('file', fs.createReadStream('/upload/TuPian1.png'));
console.log(file instanceof File);

try {
    const response = await fetch('https://api.coze.cn/v1/files/upload', {
        method: 'POST',
        headers:{
            'Authorization': `Bearer pat_nHfDUcwCQyiXaMH6oH4IGotZPVDYDMFknyB0D2WYfQ2VbcZfIboLgqrlf30weRbJ`,
            ...form.getHeaders() // 自动添加 FormData 所需的 Content-Type 等头信息
            //'Content-Type': "multipart/form-data" 
        },
        body: form
    });
    const result = await response.json();
    console.log('上传成功:', result);
} catch (error) {
    console.error('上传失败:', error);
}