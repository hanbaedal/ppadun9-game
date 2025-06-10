const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const db = require('../db');

// 게임 스키마 정의
const gameSchema = new mongoose.Schema({
    number: {
        type: Number,
        required: true,
        enum: [1, 2, 3, 4, 5],
        index: true
    },
    homeTeam: {
        type: String,
        required: true,
        enum: ['두산', 'LG', '기아', '삼성', 'SSG', 'NC', '롯데', '한화', 'KT', '키움'],
        index: true
    },
    awayTeam: {
        type: String,
        required: true,
        enum: ['두산', 'LG', '기아', '삼성', 'SSG', 'NC', '롯데', '한화', 'KT', '키움'],
        index: true
    },
    stadium: {
        type: String,
        required: true,
        enum: ['잠실', '문학', '사직', '대구', '광주', '수원', '창원', '대전', '고척'],
        index: true
    },
    startTime: {
        type: String,
        required: true,
        validate: {
            validator: function(v) {
                return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
            },
            message: '잘못된 시간 형식입니다.'
        }
    },
    endTime: {
        type: String,
        default: null,
        validate: {
            validator: function(v) {
                return v === null || /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
            },
            message: '잘못된 시간 형식입니다.'
        }
    },
    noGame: {
        type: String,
        enum: ['정상게임', '콜드게임', '서스펜디드 게임', '노 게임'],
        default: '정상게임'
    },
    note: {
        type: String,
        default: '',
        maxlength: 100
    }
}, { _id: false });

// 날짜별 게임 스키마 정의
const dailyGameSchema = new mongoose.Schema({
    date: {
        type: String,
        required: true,
        unique: true,
        index: true,
        validate: {
            validator: function(v) {
                return /^\d{8}$/.test(v);
            },
            message: '잘못된 날짜 형식입니다.'
        }
    },
    games: [gameSchema]
}, { 
    timestamps: true,
    versionKey: false
});

// 인덱스 생성
dailyGameSchema.index({ date: 1 });
dailyGameSchema.index({ 'games.number': 1 });
dailyGameSchema.index({ 'games.homeTeam': 1, 'games.awayTeam': 1 });
dailyGameSchema.index({ 'games.stadium': 1 });

// 모델 생성
const DailyGame = mongoose.model('DailyGame', dailyGameSchema);

// 오늘의 게임 저장
router.post('/', async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { date, games } = req.body;

        if (!date || !games || !Array.isArray(games)) {
            await session.abortTransaction();
            return res.status(400).json({
                success: false,
                message: '잘못된 데이터 형식입니다.'
            });
        }

        // 데이터 유효성 검사
        for (const game of games) {
            if (!game.number || !game.homeTeam || !game.awayTeam || !game.stadium || !game.startTime) {
                await session.abortTransaction();
                return res.status(400).json({
                    success: false,
                    message: '필수 필드가 누락되었습니다.'
                });
            }

            // 같은 팀이 홈/원정에 중복되지 않도록 검사
            if (game.homeTeam === game.awayTeam) {
                await session.abortTransaction();
                return res.status(400).json({
                    success: false,
                    message: '같은 팀이 홈/원정에 중복될 수 없습니다.'
                });
            }
        }

        // 기존 데이터 삭제
        await DailyGame.deleteOne({ date }).session(session);

        // 새 데이터 저장
        const dailyGame = new DailyGame({
            date,
            games: games.map(game => ({
                number: game.number,
                homeTeam: game.homeTeam,
                awayTeam: game.awayTeam,
                stadium: game.stadium,
                startTime: game.startTime,
                endTime: game.endTime || null,
                noGame: game.noGame || '정상게임',
                note: game.note
            }))
        });

        await dailyGame.save({ session });
        await session.commitTransaction();
        
        res.json({
            success: true,
            message: '게임 정보가 저장되었습니다.'
        });
    } catch (error) {
        await session.abortTransaction();
        console.error('Error saving games:', error);
        res.status(500).json({
            success: false,
            message: '서버 오류가 발생했습니다.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    } finally {
        session.endSession();
    }
});

// 오늘의 게임 조회
router.get('/:date', async (req, res) => {
    try {
        const { date } = req.params;
        const games = await db.query(
            'SELECT * FROM today_game WHERE date = ? ORDER BY number',
            [date]
        );

        // 게임이 없으면 5개의 빈 행 생성
        if (games.length === 0) {
            const emptyGames = Array.from({ length: 5 }, (_, i) => ({
                number: i + 1,
                homeTeam: null,
                awayTeam: null,
                stadium: null,
                startTime: null,
                endTime: null,
                noGame: '정상게임',
                note: null
            }));
            return res.json({ success: true, games: emptyGames });
        }

        res.json({ success: true, games });
    } catch (error) {
        console.error('Error fetching games:', error);
        res.status(500).json({ success: false, message: '게임 데이터를 가져오는데 실패했습니다.' });
    }
});

// 게임 시작 시간 업데이트
router.post('/start', async (req, res) => {
    const { date, number, startTime } = req.body;
    
    try {
        await db.query(
            'UPDATE today_game SET startTime = ? WHERE date = ? AND number = ?',
            [startTime, date, number]
        );
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating start time:', error);
        res.status(500).json({ success: false, message: '시작 시간 업데이트에 실패했습니다.' });
    }
});

// 게임 종료 시간 업데이트
router.post('/end', async (req, res) => {
    const { date, number, endTime } = req.body;
    
    try {
        await db.query(
            'UPDATE today_game SET endTime = ? WHERE date = ? AND number = ?',
            [endTime, date, number]
        );
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating end time:', error);
        res.status(500).json({ success: false, message: '종료 시간 업데이트에 실패했습니다.' });
    }
});

// 게임 상태 업데이트
router.post('/no', async (req, res) => {
    const { date, number, noGame } = req.body;
    
    try {
        await db.query(
            'UPDATE today_game SET noGame = ? WHERE date = ? AND number = ?',
            [noGame, date, number]
        );
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating game status:', error);
        res.status(500).json({ success: false, message: '게임 상태 업데이트에 실패했습니다.' });
    }
});

module.exports = router; 