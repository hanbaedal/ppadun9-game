const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');

// MongoDB 연결 설정
const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const client = new MongoClient(uri);

// daily-games 컬렉션에 새 레코드 생성
router.post('/', async (req, res) => {
    try {
        await client.connect();
        const db = client.db('member-management');
        const collection = db.collection('daily-games');

        const { date, number } = req.body;

        // 기존 데이터 확인
        const existingGame = await collection.findOne({ 
            date: date, 
            number: parseInt(number) 
        });

        if (existingGame) {
            return res.status(400).json({
                success: false,
                message: '해당 날짜와 경기번호의 데이터가 이미 존재합니다.'
            });
        }

        // 요청 데이터에 타임스탬프 추가
        const gameData = {
            ...req.body,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const result = await collection.insertOne(gameData);
        
        res.json({
            success: true,
            message: '게임 데이터가 성공적으로 저장되었습니다.',
            data: result
        });
    } catch (error) {
        console.error('daily-games 저장 오류:', error);
        res.status(500).json({
            success: false,
            message: '서버 오류가 발생했습니다.',
            error: error.message
        });
    }
});

// 특정 날짜와 경기번호로 데이터 조회
router.get('/:date/:gameNumber', async (req, res) => {
    try {
        const { date, gameNumber } = req.params;
        await client.connect();
        const db = client.db('member-management');
        const collection = db.collection('daily-games');

        const game = await collection.findOne({ 
            date: date, 
            number: parseInt(gameNumber) 
        });

        if (!game) {
            res.json({
                success: false,
                message: '해당 경기 데이터를 찾을 수 없습니다.'
            });
        } else {
            res.json({
                success: true,
                data: game
            });
        }
    } catch (error) {
        console.error('daily-games 조회 오류:', error);
        res.status(500).json({
            success: false,
            message: '서버 오류가 발생했습니다.',
            error: error.message
        });
    }
});

// 특정 날짜와 경기번호로 데이터 업데이트
router.put('/:date/:gameNumber', async (req, res) => {
    try {
        const { date, gameNumber } = req.params;
        await client.connect();
        const db = client.db('member-management');
        const collection = db.collection('daily-games');

        // 요청 데이터에 updatedAt 추가
        const updateData = {
            ...req.body,
            updatedAt: new Date()
        };

        const result = await collection.updateOne(
            { date: date, number: parseInt(gameNumber) },
            { $set: updateData }
        );

        if (result.matchedCount === 0) {
            res.status(404).json({
                success: false,
                message: '업데이트할 경기 데이터를 찾을 수 없습니다.'
            });
        } else {
            res.json({
                success: true,
                message: '게임 데이터가 성공적으로 업데이트되었습니다.',
                data: result
            });
        }
    } catch (error) {
        console.error('daily-games 업데이트 오류:', error);
        res.status(500).json({
            success: false,
            message: '서버 오류가 발생했습니다.',
            error: error.message
        });
    }
});

// 특정 날짜의 모든 경기 데이터 조회
router.get('/:date', async (req, res) => {
    try {
        const { date } = req.params;
        await client.connect();
        const db = client.db('member-management');
        const collection = db.collection('daily-games');

        const games = await collection.find({ date: date }).sort({ number: 1 }).toArray();

        res.json({
            success: true,
            data: games
        });
    } catch (error) {
        console.error('daily-games 날짜별 조회 오류:', error);
        res.status(500).json({
            success: false,
            message: '서버 오류가 발생했습니다.',
            error: error.message
        });
    }
});

module.exports = router; 