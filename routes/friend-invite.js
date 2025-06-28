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
            db = client.db('test'); // test 데이터베이스 사용
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
        await connectDB();
        const collection = db.collection('game-invite');
        
        // 모든 초대 내역 조회 (초대 횟수 내림차순, 최근 초대일 내림차순)
        const invites = await collection.find({}).sort({ inviteCount: -1, lastInviteDate: -1 }).toArray();
        
        res.json({ 
            success: true, 
            invites: invites 
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