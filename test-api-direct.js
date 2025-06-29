const axios = require('axios');

async function testFriendInviteAPI() {
    try {
        console.log('친구초대 API 직접 테스트 시작...');
        
        // Render 배포된 서버 URL
        const baseUrl = 'https://member-management-system-a15v.onrender.com';
        const apiUrl = `${baseUrl}/api/friend-invite`;
        
        console.log('API URL:', apiUrl);
        
        const response = await axios.get(apiUrl);
        console.log('응답 상태:', response.status);
        console.log('응답 헤더:', response.headers);
        
        const data = response.data;
        console.log('API 응답 성공!');
        console.log('응답 데이터:', JSON.stringify(data, null, 2));
        
        if (data.success) {
            console.log('✅ API 호출 성공');
            console.log('총 초대 내역 수:', data.count);
            console.log('고유 초대자 수:', data.uniqueInviters);
            console.log('초대 통계 수:', data.inviteStats ? data.inviteStats.length : 0);
        } else {
            console.log('❌ API 호출 실패:', data.message);
        }
        
    } catch (error) {
        console.error('API 테스트 오류:', error.message);
        
        if (error.response) {
            console.error('HTTP 오류:', error.response.status);
            console.error('오류 내용:', error.response.data);
        } else if (error.request) {
            console.error('네트워크 오류:', error.request);
        } else {
            console.error('오류 상세:', error.message);
        }
    }
}

testFriendInviteAPI(); 