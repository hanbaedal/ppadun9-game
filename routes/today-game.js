const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// 게임 스키마 정의
const gameSchema = new mongoose.Schema({
    number: Number,
    homeTeam: String,
    awayTeam: String,
    startTime: String,
    endTime: String,
    note: String
});

// 날짜별 게임 스키마 정의
const dailyGameSchema = new mongoose.Schema({
    date: String,
    games: [gameSchema]
});

// 모델 생성
const DailyGame = mongoose.model('DailyGame', dailyGameSchema);

// 오늘의 게임 저장
router.post('/', async (req, res) => {
    try {
        const { date, games } = req.body;

        // 기존 데이터 삭제
        await DailyGame.deleteOne({ date });

        // 새 데이터 저장
        const dailyGame = new DailyGame({
            date,
            games
        });

        await dailyGame.save();
        res.json({ success: true, message: '게임 정보가 저장되었습니다.' });
    } catch (error) {
        console.error('Error saving games:', error);
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
});

// 오늘의 게임 조회
router.get('/:date', async (req, res) => {
    try {
        const { date } = req.params;
        const dailyGame = await DailyGame.findOne({ date });
        
        if (!dailyGame) {
            return res.json({ success: true, games: [] });
        }

        res.json({ success: true, games: dailyGame.games });
    } catch (error) {
        console.error('Error fetching games:', error);
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
});

module.exports = router; 