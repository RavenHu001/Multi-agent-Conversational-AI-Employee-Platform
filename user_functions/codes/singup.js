//如果已经注册过，则跳转到登录界面
if(localStorage.getItem('is_singup') === 'true'){
    localStorage.removeItem('is_singup');
    window.location.href = './login.html';
}
document.getElementById('singup-form').addEventListener('submit',async function(e){
    e.preventDefault();//阻止默认提交

    const formData = new FormData(this);
    //使用formData将表单转为对象方便传给后端
    const user_data = Object.fromEntries(formData.entries());
    console.log(user_data);
    //检查密码和用户名格式，暂时不管

    //检查密码是否一致
    if(user_data.password !== user_data.password_confirm){
        alert('密码不一致');
        return;
    }

    //发送请求
    const response = await fetch('http://localhost:3000/user/singup',{
        method:'POST',
        body:JSON.stringify(user_data),
        headers:{
            'Content-Type':'application/json'
        }
    })
    .then(response=>response.json())
    .then(data=>{
        console.log(data);
        return data;
    })
    .catch(error=>{
        console.error('Error:', error);
        alert('注册失败，请稍后重试');
    });
    //如果注册成功，则给出提示并跳转到登录界面
    if(response.success){
        alert(response.message);
        localStorage.setItem('is_singup',true);
    }else{
        alert(response.error);
    }
});