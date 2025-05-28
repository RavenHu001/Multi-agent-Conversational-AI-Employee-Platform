const operationCost = {
    'chat':2,
    'chat_with_file':50,
    'download':20,
    'add_points':100
}

async function updatePoints(username, is_login,operation=null) {
    if(!is_login){  
        return;
    }
    const user_data = await loadConfig('user_functions/data/user_data.json');
    const user_data_item = user_data.find(item=>item.username === username);
    let points = user_data_item.points;
    
    if(operation === 'chat'){
        points-=operationCost.chat;
    }
    else if(operation === 'chat_with_file'){
        points-=operationCost.chat_with_file;
    }
    else if(operation === 'download'){
        points-=operationCost.download;
    }
    else if(operation === 'add_points'){
        points+=operationCost.add_points;
    }
    //呼叫后端更新积分
    const response = await fetch('http://localhost:3000/user/update_points',{
        method:'POST',
        body:JSON.stringify({username:username,is_login:is_login,points:points}),
        headers:{
            'Content-Type':'application/json'
        }
    });
    const data = await response.json();
    if(data.success){
        updatePointsDisplay(data.points);
    }
}

//更新积分显示,这个方法只有在已经登录了的情况下才会被呼叫
function updatePointsDisplay(points){
    const pointsDisplay = document.getElementById('points-display');    
    pointsDisplay.textContent = `积分: ${points}`;
}

//检测积分，如果积分不足，则提示用户
async function checkPoints(username, is_login,operation){
    if(!is_login){
        alert('请先登录');
        return false;
    }
    const user_data = await loadConfig('user_functions/data/user_data.json');
    const user_data_item = user_data.find(item=>item.username === username);
    let points = user_data_item.points;
    if(points < operationCost[operation]){
        alert('积分不足');
        return false;
    }
    return true;
}

// Points modal functions
function showPointsModal() {
    const modal = document.getElementById('points-modal');
    modal.classList.add('visible');
}

function closePointsModal() {
    const modal = document.getElementById('points-modal');
    modal.classList.remove('visible');
}

// Add click event listener to points display
document.addEventListener('DOMContentLoaded', function() {
    const pointsDisplay = document.getElementById('points-display');
    if (pointsDisplay) {
        pointsDisplay.addEventListener('click', showPointsModal);
    }
});
//目前临时用于增加积分的方法是直接点击图片
function addPoints(){
    const username = localStorage.getItem('username');
    const is_login = localStorage.getItem('is_login');
    updatePoints(username, is_login, 'add_points');
}

// 导出函数
window.checkPoints = checkPoints;
window.updatePoints = updatePoints;
window.updatePointsDisplay = updatePointsDisplay;

