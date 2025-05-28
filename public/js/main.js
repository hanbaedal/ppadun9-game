// 토큰 확인
const token = localStorage.getItem('token');
if (!token) {
    window.location.href = '/login.html';
}

// 회원 목록 가져오기
async function getMembers() {
    try {
        const response = await fetch('/api/members', {
            headers: {
                'x-auth-token': token
            }
        });

        if (!response.ok) {
            throw new Error('회원 목록을 가져오는데 실패했습니다.');
        }

        const members = await response.json();
        displayMembers(members);
    } catch (err) {
        console.error('회원 목록 조회 오류:', err);
        alert('회원 목록을 가져오는데 실패했습니다.');
    }
}

// 회원 목록 표시
function displayMembers(members) {
    const content = document.getElementById('content');
    content.innerHTML = `
        <h2>회원 목록</h2>
        <div class="table-responsive">
            <table class="table table-striped">
                <thead>
                    <tr>
                        <th>이름</th>
                        <th>아이디</th>
                        <th>전화번호</th>
                        <th>포인트</th>
                        <th>가입일</th>
                        <th>관리</th>
                    </tr>
                </thead>
                <tbody>
                    ${members.map(member => `
                        <tr>
                            <td>${member.name}</td>
                            <td>${member.userId}</td>
                            <td>${member.phone}</td>
                            <td>${member.points}</td>
                            <td>${new Date(member.createdAt).toLocaleDateString()}</td>
                            <td>
                                <button class="btn btn-sm btn-primary" onclick="editMember('${member._id}')">수정</button>
                                <button class="btn btn-sm btn-danger" onclick="deleteMember('${member._id}')">삭제</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// 회원 수정
async function editMember(id) {
    const name = prompt('이름을 입력하세요:');
    const phone = prompt('전화번호를 입력하세요:');
    const notes = prompt('참고사항을 입력하세요:');

    if (!name || !phone) return;

    try {
        const response = await fetch(`/api/members/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'x-auth-token': token
            },
            body: JSON.stringify({ name, phone, notes })
        });

        if (response.ok) {
            alert('회원 정보가 수정되었습니다.');
            getMembers();
        } else {
            throw new Error('회원 정보 수정에 실패했습니다.');
        }
    } catch (err) {
        console.error('회원 수정 오류:', err);
        alert('회원 정보 수정에 실패했습니다.');
    }
}

// 회원 삭제
async function deleteMember(id) {
    if (!confirm('정말로 이 회원을 삭제하시겠습니까?')) return;

    try {
        const response = await fetch(`/api/members/${id}`, {
            method: 'DELETE',
            headers: {
                'x-auth-token': token
            }
        });

        if (response.ok) {
            alert('회원이 삭제되었습니다.');
            getMembers();
        } else {
            throw new Error('회원 삭제에 실패했습니다.');
        }
    } catch (err) {
        console.error('회원 삭제 오류:', err);
        alert('회원 삭제에 실패했습니다.');
    }
}

// 페이지 로드 시 회원 목록 가져오기
getMembers(); 