const express = require('express');
const router = express.Router();

// MongoDB 연결을 server.js에서 가져오기
let db;

// db 객체를 설정하는 함수
function setDatabase(database) {
    db = database;
    console.log('[Game Routes] 데이터베이스 연결 설정 완료');
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

        if (!db) {
            console.log('[Game Routes] 데이터베이스 연결 없음');
            return res.status(503).json({
                success: false,
                message: '데이터베이스 연결이 준비되지 않았습니다.'
            });
        }

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

        if (!db) {
            console.log('[Game Routes] 데이터베이스 연결 없음');
            return res.status(503).json({
                success: false,
                message: '데이터베이스 연결이 준비되지 않았습니다.'
            });
        }

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

module.exports = { router, setDatabase }; 