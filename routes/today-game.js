const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// 게임 스키마 정의
const gameSchema = new mongoose.Schema({
    number: {
        type: Number,
        required: true,
        enum: [1, 2, 3, 4, 5]
    },
    homeTeam: {
        type: String,
        required: true,
        enum: ['두산', 'LG', '기아', '삼성', 'SSG', 'NC', '롯데', '한화', 'KT', '키움']
    },
    awayTeam: {
        type: String,
        required: true,
        enum: ['두산', 'LG', '기아', '삼성', 'SSG', 'NC', '롯데', '한화', 'KT', '키움']
    },
    startTime: {
        type: String,
        required: true
    },
    endTime: {
        type: String,
        default: null
    },
    noGame: {
        type: String,
        enum: ['', '콜드게임', '서스펜디드 게임', '노 게임'],
        default: ''
    },
    note: {
        type: String,
        default: ''
    }
});

// 날짜별 게임 스키마 정의
const dailyGameSchema = new mongoose.Schema({
    date: {
        type: String,
        required: true,
        unique: true
    },
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
            games: games.map(game => ({
                number: game.number,
                homeTeam: game.homeTeam,
                awayTeam: game.awayTeam,
                startTime: game.startTime,
                endTime: game.endTime || null,
                noGame: game.noGame || '',
                note: game.note
            }))
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