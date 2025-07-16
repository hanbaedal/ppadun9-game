const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const { getDb } = require('../config/db');
const { getKoreanTime } = require('../utils/korean-time');

// 일일 게임 목록 조회
router.get('/', async (req, res) => {
    try {
        const db = getDb();
        const collection = db.collection('daily-games');
        
        const { date } = req.query;
        
        if (date) {
            // 특정 날짜의 게임 조회
            const games = await collection.findOne({ date });
            res.json({
                success: true,
                games: games ? games.games : []
            });
        } else {
            // 모든 게임 조회 (최신순)
            const allGames = await collection.find({}).sort({ date: -1 }).toArray();
            res.json({
                success: true,
                games: allGames
            });
        }
    } catch (error) {
        console.error('일일 게임 목록 조회 오류:', error);
        res.status(500).json({
            success: false,
            message: '일일 게임 목록을 불러오는데 실패했습니다.',
            error: error.message
        });
    }
});

// 특정 날짜의 게임 조회
router.get('/:date', async (req, res) => {
    try {
        console.log('[DailyGames] GET 요청 받음, 날짜:', req.params.date);
        const db = getDb();
        const collection = db.collection('daily-games');
        
        const { date } = req.params;
        
        const games = await collection.findOne({ date });
        
        console.log('[DailyGames] 조회 결과:', games ? '데이터 있음' : '데이터 없음');
        if (games) {
            console.log('[DailyGames] 조회된 경기 데이터:');
            games.games.forEach((game, index) => {
                console.log(`  경기 ${index + 1}:`, {
                    number: game.number,
                    homeTeam: game.homeTeam,
                    awayTeam: game.awayTeam,
                    noGame: game.noGame,
                    startTime: game.startTime,
                    endTime: game.endTime
                });
            });
        }
        
        if (!games) {
            console.log('[DailyGames] 해당 날짜의 게임을 찾을 수 없음');
            return res.status(404).json({
                success: false,
                message: '해당 날짜의 게임을 찾을 수 없습니다.',
                data: { games: [] }
            });
        }
        
        res.json({
            success: true,
            data: games
        });
    } catch (error) {
        console.error('[DailyGames] 특정 날짜 게임 조회 오류:', error);
        res.status(500).json({
            success: false,
            message: '게임 조회에 실패했습니다.',
            error: error.message
        });
    }
});

// 일일 게임 생성/수정
router.post('/', async (req, res) => {
    try {
        console.log('[DailyGames] POST 요청 받음:', req.body);
        const db = getDb();
        const collection = db.collection('daily-games');
        
        const { date, games } = req.body;
        
        if (!date || !games) {
            console.log('[DailyGames] 필수 데이터 누락:', { date: !!date, games: !!games });
            return res.status(400).json({
                success: false,
                message: '날짜와 게임 정보가 필요합니다.'
            });
        }
        
        console.log('[DailyGames] 저장할 데이터:', { date, gamesCount: games.length });
        console.log('[DailyGames] 각 경기 데이터:');
        games.forEach((game, index) => {
            console.log(`  경기 ${index + 1}:`, {
                number: game.number,
                homeTeam: game.homeTeam,
                awayTeam: game.awayTeam,
                noGame: game.noGame,
                startTime: game.startTime,
                endTime: game.endTime
            });
        });
        
        const result = await collection.findOneAndUpdate(
            { date },
            { $set: { date, games, updatedAt: getKoreanTime() } },
            { upsert: true, returnDocument: 'after' }
        );
        
        console.log('[DailyGames] 저장 성공:', result.value ? '있음' : '없음');
        
        res.json({
            success: true,
            message: '일일 게임이 저장되었습니다.',
            data: result.value
        });
    } catch (error) {
        console.error('[DailyGames] 일일 게임 저장 오류:', error);
        res.status(500).json({
            success: false,
            message: '일일 게임 저장에 실패했습니다.',
            error: error.message
        });
    }
});

// 특정 날짜의 게임 수정
router.put('/:date', async (req, res) => {
    try {
        const db = getDb();
        const collection = db.collection('daily-games');
        
        const { date } = req.params;
        const { games } = req.body;
        
        if (!games) {
            return res.status(400).json({
                success: false,
                message: '게임 정보가 필요합니다.'
            });
        }
        
        const result = await collection.findOneAndUpdate(
            { date },
            { $set: { games, updatedAt: getKoreanTime() } },
            { returnDocument: 'after' }
        );
        
        if (!result.value) {
            return res.status(404).json({
                success: false,
                message: '해당 날짜의 게임을 찾을 수 없습니다.'
            });
        }
        
        res.json({
            success: true,
            message: '게임이 수정되었습니다.',
            data: result.value
        });
    } catch (error) {
        console.error('게임 수정 오류:', error);
        res.status(500).json({
            success: false,
            message: '게임 수정에 실패했습니다.',
            error: error.message
        });
    }
});

// 일일 게임 삭제
router.delete('/:date', async (req, res) => {
    try {
        const db = getDb();
        const collection = db.collection('daily-games');
        
        const { date } = req.params;
        
        const result = await collection.deleteOne({ date });
        
        if (result.deletedCount === 0) {
            return res.status(404).json({
                success: false,
                message: '해당 날짜의 게임을 찾을 수 없습니다.'
            });
        }
        
        res.json({
            success: true,
            message: '일일 게임이 삭제되었습니다.'
        });
    } catch (error) {
        console.error('일일 게임 삭제 오류:', error);
        res.status(500).json({
            success: false,
            message: '일일 게임 삭제에 실패했습니다.',
            error: error.message
        });
    }
});

module.exports = router; 