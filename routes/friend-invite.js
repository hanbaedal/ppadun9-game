const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');

// MongoDB 연결 설정
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://ppadun_user:ppadun8267@member-management.bppicvz.mongodb.net/member-management?retryWrites=true&w=majority&appName=member-management';

let client;
let db;

// 데이터베이스 연결 함수
async function connectDB() {
    try {
        if (!client || !client.topology || !client.topology.isConnected()) {
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
            db = client.db('member-management'); // member-management 데이터베이스 사용
            console.log('MongoDB 연결 성공:', db.databaseName);
        }
    } catch (error) {
        console.error('MongoDB 연결 실패:', error);
        throw error;
    }
}

// 친구초대 리스트 조회
router.get('/', async (req, res) => {
    try {
        console.log('친구초대 리스트 조회 시작');
        await connectDB();
        console.log('데이터베이스 연결 완료');
        
        const collection = db.collection('game-invite');
        console.log('game-invite 컬렉션 접근');
        
        // 컬렉션의 문서 수 확인
        const count = await collection.countDocuments();
        console.log('game-invite 컬렉션 문서 수:', count);
        
        // 모든 초대 내역 조회 (초대 날짜 내림차순)
        const invites = await collection.find({}).sort({ inviteDate: -1 }).toArray();
        console.log('조회된 초대 내역 수:', invites.length);
        if (invites.length > 0) {
            console.log('첫 번째 문서 샘플:', invites[0]);
        }
        
        // 회원별로 그룹화하여 초대 통계 계산
        const inviteStats = {};
        const totalInviteCount = invites.length;
        const allInvitedPhones = new Set(); // 모든 초대받은 전화번호 (중복 제거)
        
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
            
            // 초대받은 전화번호를 전체 집합에 추가 (중복 제거)
            if (invite.inviterPhone) {
                allInvitedPhones.add(invite.inviterPhone);
            }
            
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
        const totalInvitedPeople = allInvitedPhones.size; // 총 초대받은 사람 수 (중복 제거)
        
        console.log('처리된 통계 데이터:', inviteStatsArray.length, '개 회원');
        console.log('총 초대받은 사람 수:', totalInvitedPeople);
        
        res.json({ 
            success: true, 
            invites: invites,
            inviteStats: inviteStatsArray,
            count: count,
            totalInviteCount: totalInviteCount,
            uniqueInviters: inviteStatsArray.length,
            totalInvitedPeople: totalInvitedPeople
        });
    } catch (error) {
        console.error('친구초대 리스트 조회 오류:', error);
        res.status(500).json({ 
            success: false, 
            message: '친구초대 내역을 불러오는데 실패했습니다.',
            error: error.message 
        });
    }
});

// 친구초대 상세 조회
router.get('/:id', async (req, res) => {
    const { ObjectId } = require('mongodb');
    try {
        await connectDB();
        const collection = db.collection('game-invite');
        
        const invite = await collection.findOne({ _id: new ObjectId(req.params.id) });
        
        if (!invite) {
            return res.status(404).json({ 
                success: false, 
                message: '친구초대 내역을 찾을 수 없습니다.' 
            });
        }
        
        res.json({ 
            success: true, 
            invite: invite 
        });
    } catch (error) {
        console.error('친구초대 상세 조회 오류:', error);
        res.status(500).json({ 
            success: false, 
            message: '친구초대 내역 조회에 실패했습니다.',
            error: error.message 
        });
    }
});

module.exports = router; 