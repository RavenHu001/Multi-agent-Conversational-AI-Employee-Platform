async function updatePoints(username, is_login,operation=null) {
    if(!is_login){  
        return;
    }
    const user_data = await loadConfig('user_functions/data/user_data.json');
    const user_data_item = user_data.find(item=>item.username === username);
    const points = user_data_item.points;
    
    if(operation === 'chat'){
        points-=2;
    }
    else if(operation === 'chat_with_file'){
        points-=50;
    }
    else if(operation === 'download'){
        points-=20;
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