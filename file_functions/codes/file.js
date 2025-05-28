async function handleFileUpload(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const filePreview = document.getElementById('file-preview');
    filePreview.classList.add('visible');  // 显示文件预览区域
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    const ALLOWED_TYPES = [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'application/json',
        'text/csv',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel.sheet.macroEnabled.12',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    for (let file of files) {
        // 检查文件大小
        if (file.size > MAX_FILE_SIZE) {
            alert(`文件 ${file.name} 超过5MB大小限制`);
            continue;
        }

        // 检查文件类型
        if (!ALLOWED_TYPES.includes(file.type)) {
            alert(`文件 ${file.name} 类型不支持。支持的类型：PDF、JPEG、PNG、JSON、CSV、Excel、Word`);
            continue;
        }

        // 创建文件预览项
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.dataset.fileName = file.name;
        
        // 创建文件图标
        const fileIcon = document.createElement('div');
        fileIcon.className = 'file-icon';
        fileIcon.textContent = getFileIcon(file.type);
        fileItem.appendChild(fileIcon);

        // 添加文件信息
        const fileInfo = document.createElement('div');
        fileInfo.className = 'file-info';
        fileInfo.textContent = formatFileSize(file.size);
        fileItem.appendChild(fileInfo);

        // 添加进度条
        const progressBar = document.createElement('div');
        progressBar.className = 'progress-bar';
        progressBar.style.width = '0%';
        fileItem.appendChild(progressBar);

        // 添加删除按钮
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-btn';
        removeBtn.innerHTML = '×';
        removeBtn.onclick = () => removeFile(fileItem);
        fileItem.appendChild(removeBtn);

        filePreview.appendChild(fileItem);

        // 上传文件
        try {
            const formData = new FormData();
            // 创建新的 File 对象，确保文件名使用正确的编码
            const newFile = new File([file], file.name, {
                type: file.type,
                lastModified: file.lastModified
            });
            formData.append('file', newFile);

            const xhr = new XMLHttpRequest();
            xhr.open('POST', 'http://localhost:3000/upload', true);

            // 上传进度
            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                    const percentComplete = (e.loaded / e.total) * 100;
                    progressBar.style.width = percentComplete + '%';
                }
            };

            // 上传完成
            xhr.onload = () => {
                if (xhr.status === 200) {
                    const response = JSON.parse(xhr.responseText);
                    if (response.success) {
                        fileItem.classList.add('uploaded');
                        // 保存上传成功的文件信息到本地存储
                        const uploadedFiles = JSON.parse(localStorage.getItem('uploadedFiles') || '[]');
                        uploadedFiles.push({
                            filename: response.file.filename,
                            originalname: response.file.originalname,
                            size: response.file.size,
                            mimetype: response.file.mimetype,
                            uploadTime: new Date().toISOString()
                        });
                        localStorage.setItem('uploadedFiles', JSON.stringify(uploadedFiles));
                        console.log('文件上传成功:', response.file);

                        // // 将文件信息作为用户消息添加到聊天区域
                        // const fileMessage = `${getFileIcon(file.type)} ${response.file.originalname} (${formatFileSize(file.size)})`;
                        // addMessageToChat(fileMessage, 'user');
                    }
                } else {
                    const error = JSON.parse(xhr.responseText);
                    alert(`上传失败: ${error.error}`);
                    removeFile(fileItem);
                }
            };

            // 上传错误
            xhr.onerror = () => {
                alert('上传失败，请检查网络连接');
                removeFile(fileItem);
            };

            xhr.send(formData);
        } catch (error) {
            console.error('上传出错:', error);
            alert('上传失败，请重试');
            removeFile(fileItem);
        }
    }

    // 清空文件输入框，允许重复选择相同文件
    event.target.value = '';
}

function getFileIcon(fileType) {
    const icons = {
        'application/pdf': '📄',
        'image/jpeg': '🖼️',
        'image/png': '🖼️',
        'application/json': '📋',
        'text/csv': '📄',
        'application/vnd.ms-excel': '📄',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '📄',
        'application/vnd.ms-excel.sheet.macroEnabled.12': '📄',
        'application/msword': '📝',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '📝'
    };
    return icons[fileType] || '📎';
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function removeFile(fileItem) {
    try {
        const filename = fileItem.dataset.fileName;
        if (!filename) {
            throw new Error('无法获取文件名');
        }
        const response = await fetch(`http://localhost:3000/delete/${filename}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error('删除文件失败');
        }

        // 从UI中移除文件项
        fileItem.remove();
        // 从本地存储中移除文件信息
        const fileList = JSON.parse(localStorage.getItem('uploadedFiles') || '[]');
        const updatedList = fileList.filter(file => file.filename !== filename);
        localStorage.setItem('uploadedFiles', JSON.stringify(updatedList));

        // 检查是否还有其他文件
        const filePreview = document.getElementById('file-preview');
        if (filePreview.children.length === 0) {
            filePreview.classList.remove('visible');
        }
    } catch (error) {
        console.error('删除文件时出错:', error);
        alert('删除文件失败: ' + error.message);
    }
}

// 添加页面加载时恢复已上传文件的函数
function restoreUploadedFiles() {
    const filePreview = document.getElementById('file-preview');
    const uploadedFiles = JSON.parse(localStorage.getItem('uploadedFiles') || '[]');
    
    if (uploadedFiles.length > 0) {
        filePreview.classList.add('visible');  // 如果有文件，显示预览区域
    }
    
    uploadedFiles.forEach(file => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item uploaded';
        fileItem.dataset.fileName = file.filename;
        
        const fileIcon = document.createElement('div');
        fileIcon.className = 'file-icon';
        fileIcon.textContent = getFileIcon(file.mimetype);
        fileItem.appendChild(fileIcon);

        const fileInfo = document.createElement('div');
        fileInfo.className = 'file-info';
        fileInfo.textContent = formatFileSize(file.size);
        fileItem.appendChild(fileInfo);

        const progressBar = document.createElement('div');
        progressBar.className = 'progress-bar';
        progressBar.style.width = '100%';
        fileItem.appendChild(progressBar);

        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-btn';
        removeBtn.innerHTML = '×';
        removeBtn.onclick = () => {
            removeFile(fileItem);
            // 从本地存储中移除文件信息
            const files = JSON.parse(localStorage.getItem('uploadedFiles') || '[]');
            const index = files.findIndex(f => f.filename === file.filename);
            if (index > -1) {
                files.splice(index, 1);
                localStorage.setItem('uploadedFiles', JSON.stringify(files));
            }
        };
        fileItem.appendChild(removeBtn);

        filePreview.appendChild(fileItem);
    });
}

// 在页面加载时恢复已上传的文件
document.addEventListener('DOMContentLoaded', function() {
    restoreUploadedFiles();
    // ... 其他现有的 DOMContentLoaded 事件处理代码 ...
});