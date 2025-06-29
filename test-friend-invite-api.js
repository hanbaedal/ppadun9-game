const { MongoClient } = require('mongodb');

// MongoDB 연결 설정
const MONGODB_URI = 'mongodb+srv://ppadun_user:ppadun8267@member-management.bppicvz.mongodb.net/member-management?retryWrites=true&w=majority&appName=member-management';

async function testFriendInviteAPI() {
    let client;
    try {
        console.log('MongoDB 연결 시도...');
        client = new MongoClient(MONGODB_URI, {
            serverSelectionTimeoutMS: 60000,
            socketTimeoutMS: 45000,
            connectTimeoutMS: 60000,
            maxPoolSize: 10,
            minPoolSize: 1,
            maxIdleTimeMS: 30000,
            retryWrites: true,
            w: 'majority'
        });
        
        await client.connect();
        const db = client.db('member-management');
        console.log('MongoDB 연결 성공!');
        
        // game-invite 컬렉션에서 모든 데이터 조회
        const collection = db.collection('game-invite');
        const invites = await collection.find({}).sort({ inviteDate: -1 }).toArray();
        console.log('\n=== 원본 데이터 ===');
        console.log('총 문서 수:', invites.length);
        
        invites.forEach((invite, index) => {
            console.log(`문서 ${index + 1}:`, {
                _id: invite._id,
                memberName: invite.memberName,
                memberId: invite.memberId,
                memberPhone: invite.memberPhone,
                inviterPhone: invite.inviterPhone,
                status: invite.status,
                inviteDate: invite.inviteDate
            });
        });
        
        // 수정된 로직으로 통계 계산 (routes/friend-invite.js와 동일한 로직)
        console.log('\n=== 수정된 로직으로 통계 계산 ===');
        const inviteStats = {};
        const totalInviteCount = invites.length;
        
        invites.forEach(invite => {
            // memberId를 키로 사용 (회원 아이디)
            const key = invite.memberId || 'unknown';
            if (!inviteStats[key]) {
                inviteStats[key] = {
                    memberId: invite.memberId || '미지정',
                    memberName: invite.memberName || '미지정',
                    memberPhone: invite.memberPhone || '미지정',
                    inviteCount: 0,
                    totalInvited: 0, // 총 초대한 사람 수
                    invitedPhones: [], // 초대한 전화번호 목록
                    lastInviteDate: invite.inviteDate,
                    status: invite.status,
                    invites: []
                };
            }
            
            inviteStats[key].inviteCount++;
            inviteStats[key].invites.push({
                phoneNumber: invite.inviterPhone || '미지정',
                inviteDate: invite.inviteDate,
                status: invite.status
            });
            
            // 초대한 전화번호 목록에 추가 (중복 제거, 자기 자신 제외)
            if (invite.inviterPhone && !inviteStats[key].invitedPhones.includes(invite.inviterPhone) && invite.inviterPhone !== invite.memberPhone) {
                inviteStats[key].invitedPhones.push(invite.inviterPhone);
                inviteStats[key].totalInvited++;
            }
            
            // 최신 날짜로 업데이트
            if (new Date(invite.inviteDate) > new Date(inviteStats[key].lastInviteDate)) {
                inviteStats[key].lastInviteDate = invite.inviteDate;
            }
        });
        
        // 통계를 배열로 변환하고 초대 횟수 순으로 정렬
        const inviteStatsArray = Object.values(inviteStats).sort((a, b) => b.inviteCount - a.inviteCount);
        
        console.log('\n=== 처리된 통계 결과 ===');
        console.log('총 초대 내역 수:', totalInviteCount);
        console.log('고유 초대자 수:', inviteStatsArray.length);
        
        inviteStatsArray.forEach((stat, index) => {
            console.log(`\n${index + 1}위: ${stat.memberName} (${stat.memberId})`);
            console.log(`  - 초대 횟수: ${stat.inviteCount}회`);
            console.log(`  - 총 초대한 사람 수: ${stat.totalInvited}명`);
            console.log(`  - 최근 초대일: ${new Date(stat.lastInviteDate).toLocaleString()}`);
            console.log(`  - 초대한 전화번호 목록:`, stat.invitedPhones);
            console.log(`  - 개별 초대 내역:`, stat.invites.length, '개');
        });
        
        // API 응답 형식으로 출력
        const apiResponse = {
            success: true,
            invites: invites,
            inviteStats: inviteStatsArray,
            count: invites.length,
            totalInviteCount: totalInviteCount,
            uniqueInviters: inviteStatsArray.length
        };
        
        console.log('\n=== API 응답 형식 ===');
        console.log(JSON.stringify(apiResponse, null, 2));
        
    } catch (error) {
        console.error('오류 발생:', error);
    } finally {
        if (client) {
            await client.close();
            console.log('\nMongoDB 연결 종료');
        }
    }
}

testFriendInviteAPI(); 