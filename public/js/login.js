document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const userId = document.getElementById('userId').value;
    const password = document.getElementById('password').value;

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ userId, password })
        });

        const data = await response.json();

        if (response.ok) {
            localStorage.setItem('token', data.token);
            window.location.href = '/';
        } else {
            alert(data.msg || '로그인에 실패했습니다.');
        }
    } catch (err) {
        console.error('로그인 오류:', err);
        alert('로그인 중 오류가 발생했습니다.');
    }
}); 