const { MongoClient } = require('mongodb');
require('dotenv').config();

async function checkMemberLoginStatus() {
    try {
        console.log('=== 회원 로그인 현황 확인 ===');
        
        const client = new MongoClient(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000,
            connectTimeoutMS: 10000
        });
        
        await client.connect();
        console.log('✅ MongoDB 연결 성공');
        
        const db = client.db(process.env.DB_NAME);
        const memberCollection = db.collection('game-member');
        const employeeCollection = db.collection('employee-member');
        
        // 1. 전체 회원 수
        const totalMembers = await memberCollection.countDocuments();
        console.log('\n📊 전체 회원 수:', totalMembers);
        
        // 2. 현재 로그인된 회원 수
        const onlineMembers = await memberCollection.countDocuments({ isLoggedIn: true });
        console.log('🟢 현재 로그인된 회원 수:', onlineMembers);
        
        // 3. 전체 직원 수
        const totalEmployees = await employeeCollection.countDocuments();
        console.log('👥 전체 직원 수:', totalEmployees);
        
        // 4. 현재 로그인된 직원 수
        const onlineEmployees = await employeeCollection.countDocuments({ isLoggedIn: true });
        console.log('🟢 현재 로그인된 직원 수:', onlineEmployees);
        
        // 5. 총 접속자 수
        const totalOnlineUsers = onlineMembers + onlineEmployees;
        console.log('🌐 총 접속자 수:', totalOnlineUsers);
        
        // 6. 로그인된 회원 상세 정보
        console.log('\n📋 로그인된 회원 목록:');
        const loggedInMembers = await memberCollection.find(
            { isLoggedIn: true },
            { 
                userId: 1, 
                name: 1, 
                lastLoginAt: 1, 
                lastLogoutAt: 1,
                loginCount: 1,
                isLoggedIn: 1,
                createdAt: 1
            }
        ).sort({ lastLoginAt: -1 }).toArray();
        
        if (loggedInMembers.length > 0) {
            loggedInMembers.forEach((member, index) => {
                const loginTime = member.lastLoginAt ? new Date(member.lastLoginAt).toLocaleString('ko-KR') : '알 수 없음';
                const totalLoginTime = calculateTotalLoginTime(member);
                console.log(`  ${index + 1}. ${member.name || '이름 없음'} (${member.userId})`);
                console.log(`     - 로그인 시간: ${loginTime}`);
                console.log(`     - 총 로그인 시간: ${totalLoginTime}`);
                console.log(`     - 로그인 횟수: ${member.loginCount || 0}회`);
            });
        } else {
            console.log('  현재 로그인된 회원이 없습니다.');
        }
        
        // 7. 로그인된 직원 상세 정보
        console.log('\n👥 로그인된 직원 목록:');
        const loggedInEmployees = await employeeCollection.find(
            { isLoggedIn: true },
            { 
                username: 1, 
                name: 1, 
                lastLoginAt: 1, 
                lastLogoutAt: 1,
                loginCount: 1,
                isLoggedIn: 1,
                createdAt: 1
            }
        ).sort({ lastLoginAt: -1 }).toArray();
        
        if (loggedInEmployees.length > 0) {
            loggedInEmployees.forEach((employee, index) => {
                const loginTime = employee.lastLoginAt ? new Date(employee.lastLoginAt).toLocaleString('ko-KR') : '알 수 없음';
                const totalLoginTime = calculateTotalLoginTime(employee);
                console.log(`  ${index + 1}. ${employee.name || '이름 없음'} (${employee.username})`);
                console.log(`     - 로그인 시간: ${loginTime}`);
                console.log(`     - 총 로그인 시간: ${totalLoginTime}`);
                console.log(`     - 로그인 횟수: ${employee.loginCount || 0}회`);
            });
        } else {
            console.log('  현재 로그인된 직원이 없습니다.');
        }
        
        // 8. 최근 로그인한 회원들 (24시간 이내)
        console.log('\n⏰ 최근 24시간 내 로그인한 회원들:');
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recentLoginMembers = await memberCollection.find(
            { lastLoginAt: { $gte: oneDayAgo } },
            { 
                userId: 1, 
                name: 1, 
                lastLoginAt: 1, 
                isLoggedIn: 1
            }
        ).sort({ lastLoginAt: -1 }).toArray();
        
        if (recentLoginMembers.length > 0) {
            recentLoginMembers.forEach((member, index) => {
                const loginTime = member.lastLoginAt ? new Date(member.lastLoginAt).toLocaleString('ko-KR') : '알 수 없음';
                const status = member.isLoggedIn ? '🟢 온라인' : '🔴 오프라인';
                console.log(`  ${index + 1}. ${member.name || '이름 없음'} (${member.userId}) - ${loginTime} ${status}`);
            });
        } else {
            console.log('  최근 24시간 내 로그인한 회원이 없습니다.');
        }
        
        // 9. 통계 요약
        console.log('\n📈 로그인 현황 요약:');
        console.log(`  - 전체 사용자: ${totalMembers + totalEmployees}명`);
        console.log(`  - 현재 접속자: ${totalOnlineUsers}명`);
        console.log(`  - 접속률: ${((totalOnlineUsers / (totalMembers + totalEmployees)) * 100).toFixed(1)}%`);
        
        await client.close();
        console.log('\n✅ 데이터베이스 연결 종료');
        
    } catch (error) {
        console.error('❌ 오류 발생:', error.message);
        console.error('상세 오류:', error);
    }
}

// 총 로그인 시간 계산 함수
function calculateTotalLoginTime(user) {
    try {
        if (!user.lastLoginAt) {
            return '로그인 기록 없음';
        }
        
        const loginTime = new Date(user.lastLoginAt);
        let logoutTime = user.lastLogoutAt ? new Date(user.lastLogoutAt) : new Date();
        
        // 현재 로그인 중인 경우 현재 시간 사용
        if (user.isLoggedIn) {
            logoutTime = new Date();
        }
        
        const diffTime = Math.abs(logoutTime - loginTime);
        const diffMinutes = Math.floor(diffTime / (1000 * 60));
        const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffMinutes < 60) {
            return `${diffMinutes}분`;
        } else if (diffHours < 24) {
            return `${diffHours}시간 ${diffMinutes % 60}분`;
        } else {
            return `${diffDays}일 ${diffHours % 24}시간`;
        }
    } catch (error) {
        console.error('총 로그인 시간 계산 오류:', error);
        return '계산 오류';
    }
}

checkMemberLoginStatus(); 