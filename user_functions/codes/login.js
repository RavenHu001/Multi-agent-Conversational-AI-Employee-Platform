//如果已经登录过，则跳转到主页
if(localStorage.getItem('is_login') === 'true'){
    localStorage.removeItem('is_login');
    window.location.href = '/home.html';
}
document.getElementById('login-form').addEventListener('submit',async function(e){
    e.preventDefault();//阻止默认提交

    const formData = new FormData(this);
    //使用formData将表单转为对象方便传给后端
    const user_data = Object.fromEntries(formData.entries());
    console.log(user_data);
    //这个地方可以加入输入格式检查的代码，但现在先不管

    //发送请求
    const response = await fetch('http://localhost:3000/user/login',{
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
    });
    //如果登录成功，则给出提示并跳转到主页
    if(response.success){
        alert(response.message);
        localStorage.setItem('is_login',true);//保存登录状态
        localStorage.setItem('username',response.user_data.username);//保存用户名
    }else{
        alert(response.error);
    }
});