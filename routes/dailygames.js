const express = require('express');
const router = express.Router();
const DailyGames = require('../models/dailygames');

// CREATE - 새로운 일일 경기 데이터 생성
router.post('/', async (req, res) => {
    try {
        const { date, games } = req.body;
        
        // 기존 데이터가 있는지 확인
        const existingData = await DailyGames.findOne({ date });
        if (existingData) {
            return res.status(400).json({ 
                success: false, 
                message: '해당 날짜의 데이터가 이미 존재합니다.' 
            });
        }

        // 5개 경기 데이터 생성
        const gameData = [];
        for (let i = 1; i <= 5; i++) {
            const game = games.find(g => g.number === i) || {
                number: i,
                homeTeam: null,
                awayTeam: null,
                startTime: null,
                endTime: null,
                status: '정상게임'
            };
            gameData.push(game);
        }

        const dailyGames = new DailyGames({
            date,
            games: gameData
        });

        await dailyGames.save();
        
        res.status(201).json({
            success: true,
            message: '일일 경기 데이터가 성공적으로 생성되었습니다.',
            data: dailyGames
        });
    } catch (error) {
        console.error('CREATE 오류:', error);
        res.status(500).json({
            success: false,
            message: '서버 오류가 발생했습니다.',
            error: error.message
        });
    }
});

// READ - 특정 날짜의 경기 데이터 조회
router.get('/:date', async (req, res) => {
    try {
        const { date } = req.params;
        
        const dailyGames = await DailyGames.findOne({ date });
        
        if (!dailyGames) {
            return res.status(404).json({
                success: false,
                message: '해당 날짜의 경기 데이터를 찾을 수 없습니다.'
            });
        }

        res.json({
            success: true,
            data: dailyGames
        });
    } catch (error) {
        console.error('READ 오류:', error);
        res.status(500).json({
            success: false,
            message: '서버 오류가 발생했습니다.',
            error: error.message
        });
    }
});

// READ ALL - 모든 일일 경기 데이터 조회
router.get('/', async (req, res) => {
    try {
        const dailyGames = await DailyGames.find().sort({ date: -1 });
        
        res.json({
            success: true,
            data: dailyGames
        });
    } catch (error) {
        console.error('READ ALL 오류:', error);
        res.status(500).json({
            success: false,
            message: '서버 오류가 발생했습니다.',
            error: error.message
        });
    }
});

// UPDATE - 특정 날짜의 경기 데이터 업데이트
router.put('/:date', async (req, res) => {
    try {
        const { date } = req.params;
        const { games } = req.body;

        // 기존 데이터 확인
        const existingData = await DailyGames.findOne({ date });
        if (!existingData) {
            return res.status(404).json({
                success: false,
                message: '업데이트할 데이터를 찾을 수 없습니다.'
            });
        }

        // 5개 경기 데이터 업데이트
        const gameData = [];
        for (let i = 1; i <= 5; i++) {
            const game = games.find(g => g.number === i) || {
                number: i,
                homeTeam: null,
                awayTeam: null,
                startTime: null,
                endTime: null,
                status: '정상게임'
            };
            gameData.push(game);
        }

        existingData.games = gameData;
        existingData.updatedAt = new Date();
        
        await existingData.save();

        res.json({
            success: true,
            message: '일일 경기 데이터가 성공적으로 업데이트되었습니다.',
            data: existingData
        });
    } catch (error) {
        console.error('UPDATE 오류:', error);
        res.status(500).json({
            success: false,
            message: '서버 오류가 발생했습니다.',
            error: error.message
        });
    }
});

// DELETE - 특정 날짜의 경기 데이터 삭제
router.delete('/:date', async (req, res) => {
    try {
        const { date } = req.params;
        
        const deletedData = await DailyGames.findOneAndDelete({ date });
        
        if (!deletedData) {
            return res.status(404).json({
                success: false,
                message: '삭제할 데이터를 찾을 수 없습니다.'
            });
        }

        res.json({
            success: true,
            message: '일일 경기 데이터가 성공적으로 삭제되었습니다.',
            data: deletedData
        });
    } catch (error) {
        console.error('DELETE 오류:', error);
        res.status(500).json({
            success: false,
            message: '서버 오류가 발생했습니다.',
            error: error.message
        });
    }
});

module.exports = router; 