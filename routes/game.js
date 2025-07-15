const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');

// MongoDB 연결 설정
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://ppadun_user:ppadun8267@member-management.bppicvz.mongodb.net/?retryWrites=true&w=majority&appName=member-management';

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
            db = client.db('member-management');
            console.log('MongoDB 연결 성공:', db.databaseName);
        }
    } catch (error) {
        console.error('MongoDB 연결 실패:', error);
        throw error;
    }
}

// 오늘의 게임 정보 조회
router.get('/today-game', async (req, res) => {
    try {
        console.log('[Game Routes] GET /today-game 요청 받음');
        const { date } = req.query;
        console.log('[Game Routes] 요청된 날짜:', date);
        
        if (!date) {
            console.log('[Game Routes] 날짜가 없음');
            return res.status(400).json({
                success: false,
                message: '날짜가 필요합니다.'
            });
        }

        await connectDB();
        console.log('[Game Routes] todaygames 컬렉션 접근');
        const collection = db.collection('todaygames');
        const dailyGame = await collection.findOne({ date });
        console.log('[Game Routes] 조회 결과:', dailyGame ? '데이터 있음' : '데이터 없음');
        
        res.json({
            success: true,
            games: dailyGame ? dailyGame.games : []
        });
    } catch (error) {
        console.error('[Game Routes] 게임 정보 조회 오류:', error);
        res.status(500).json({
            success: false,
            message: '서버 오류가 발생했습니다.',
            error: error.message
        });
    }
});

// 오늘의 게임 정보 저장/수정
router.post('/today-game', async (req, res) => {
    try {
        console.log('[Game Routes] POST /today-game 요청 받음');
        const { date, games } = req.body;
        console.log('[Game Routes] 요청 데이터:', { date, gamesCount: games ? games.length : 0 });
        
        if (!date || !games) {
            console.log('[Game Routes] 필수 데이터 누락:', { date: !!date, games: !!games });
            return res.status(400).json({
                success: false,
                message: '날짜와 게임 정보가 필요합니다.'
            });
        }

        await connectDB();
        console.log('[Game Routes] todaygames 컬렉션에 저장 시도');
        const collection = db.collection('todaygames');
        
        // upsert 옵션을 사용하여 존재하면 업데이트, 없으면 생성
        const result = await collection.findOneAndUpdate(
            { date },
            { $set: { date, games } },
            { upsert: true, returnDocument: 'after' }
        );

        console.log('[Game Routes] 저장 성공:', result.value ? '있음' : '없음');
        res.json({
            success: true,
            message: '게임 정보가 저장되었습니다.',
            data: result.value
        });
    } catch (error) {
        console.error('[Game Routes] 게임 정보 저장 오류:', error);
        res.status(500).json({
            success: false,
            message: '서버 오류가 발생했습니다.',
            error: error.message
        });
    }
});

// 기본 라우트
router.get('/', (req, res) => {
    res.json({ message: 'Game API is working' });
});

module.exports = router; 