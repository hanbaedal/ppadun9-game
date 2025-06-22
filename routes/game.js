const express = require('express');
const router = express.Router();

// MongoDB 연결을 server.js에서 가져오기
let db;

// db 객체를 설정하는 함수
function setDatabase(database) {
    db = database;
}

// 오늘의 게임 정보 조회
router.get('/today-game', async (req, res) => {
    try {
        const { date } = req.query;
        if (!date) {
            return res.status(400).json({
                success: false,
                message: '날짜가 필요합니다.'
            });
        }

        if (!db) {
            return res.status(503).json({
                success: false,
                message: '데이터베이스 연결이 준비되지 않았습니다.'
            });
        }

        const collection = db.collection('dailygames');
        const dailyGame = await collection.findOne({ date });
        
        res.json({
            success: true,
            games: dailyGame ? dailyGame.games : []
        });
    } catch (error) {
        console.error('게임 정보 조회 오류:', error);
        res.status(500).json({
            success: false,
            message: '서버 오류가 발생했습니다.'
        });
    }
});

// 오늘의 게임 정보 저장/수정
router.post('/today-game', async (req, res) => {
    try {
        const { date, games } = req.body;
        
        if (!date || !games) {
            return res.status(400).json({
                success: false,
                message: '날짜와 게임 정보가 필요합니다.'
            });
        }

        if (!db) {
            return res.status(503).json({
                success: false,
                message: '데이터베이스 연결이 준비되지 않았습니다.'
            });
        }

        const collection = db.collection('dailygames');
        
        // upsert 옵션을 사용하여 존재하면 업데이트, 없으면 생성
        const result = await collection.findOneAndUpdate(
            { date },
            { date, games },
            { upsert: true, returnOriginal: false }
        );

        res.json({
            success: true,
            message: '게임 정보가 저장되었습니다.',
            data: result
        });
    } catch (error) {
        console.error('게임 정보 저장 오류:', error);
        res.status(500).json({
            success: false,
            message: '서버 오류가 발생했습니다.'
        });
    }
});

// 기본 라우트
router.get('/', (req, res) => {
    res.json({ message: 'Game API is working' });
});

module.exports = { router, setDatabase }; 