// 입력 필드들
const nameInput = document.getElementById('name');
const userIdInput = document.getElementById('userId');
const passwordInput = document.getElementById('password');
const passwordConfirmInput = document.getElementById('passwordConfirm');
const phoneInput = document.getElementById('phone');
const notesInput = document.getElementById('notes');

// 입력 필드 배열
const inputFields = [nameInput, userIdInput, passwordInput, passwordConfirmInput, phoneInput, notesInput];

// 각 입력 필드에 포커스 이벤트 추가
inputFields.forEach((input, index) => {
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (index < inputFields.length - 1) {
                inputFields[index + 1].focus();
            }
        }
    });
});

// 폼 제출 이벤트
document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = nameInput.value;
    const userId = userIdInput.value;
    const password = passwordInput.value;
    const passwordConfirm = passwordConfirmInput.value;
    const phone = phoneInput.value;
    const notes = notesInput.value;

    // 비밀번호 확인
    if (password !== passwordConfirm) {
        alert('비밀번호가 일치하지 않습니다.');
        return;
    }

    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name,
                userId,
                password,
                phone,
                notes
            })
        });

        const data = await response.json();

        if (response.ok) {
            alert('회원가입이 완료되었습니다.');
            // 모든 입력 필드 클리어
            inputFields.forEach(input => {
                input.value = '';
            });
            // 이름 입력란으로 포커스 이동
            nameInput.focus();
            window.location.href = '/login.html';
        } else {
            alert(data.msg || '회원가입에 실패했습니다.');
        }
    } catch (err) {
        console.error('회원가입 오류:', err);
        alert('회원가입 중 오류가 발생했습니다.');
    }
});

// 아이디 중복 확인
userIdInput.addEventListener('blur', async (e) => {
    const userId = e.target.value;
    if (!userId) return;

    try {
        const response = await fetch(`/api/auth/check-id/${userId}`);
        const data = await response.json();

        if (!response.ok) {
            alert('이미 사용 중인 아이디입니다.');
            e.target.value = '';
            e.target.focus();
        }
    } catch (err) {
        console.error('아이디 중복 확인 오류:', err);
    }
});
 