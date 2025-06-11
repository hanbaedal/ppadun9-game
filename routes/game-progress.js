const express = require('express');
const router = express.Router();
const GameProgress = require('../models/game-progress');
const DailyGame = require('../models/Game');
const mongoose = require('mongoose');

// 오늘의 경기 목록 가져오기 (Read)
router.get('/today-games', async (req, res) => {
    try {
        const today = new Date();
        const dateStr = today.getFullYear().toString() +
                       (today.getMonth() + 1).toString().padStart(2, '0') +
                       today.getDate().toString().padStart(2, '0');

        console.log('조회 날짜:', dateStr);

        // member-management 데이터베이스의 dailygames 컬렉션에서 데이터 조회
        const db = mongoose.connection.useDb('member-management');
        const collection = db.collection('dailygames');
        
        const collections = await db.listCollections().toArray();
        const collectionExists = collections.some(col => col.name === 'dailygames');
        
        if (!collectionExists) {
            console.log('dailygames 컬렉션이 존재하지 않습니다.');
            return res.json({
                success: true,
                games: []
            });
        }

        const dailyGame = await collection.findOne({ date: dateStr });
        console.log('조회된 경기 데이터:', dailyGame);

        if (!dailyGame || !dailyGame.games) {
            return res.json({
                success: true,
                games: []
            });
        }

        const formattedGames = dailyGame.games.map(game => ({
            homeTeam: game.homeTeam || '',
            awayTeam: game.awayTeam || '',
            stadium: game.stadium || '',
            startTime: game.startTime || null,
            endTime: game.endTime || null,
            noGame: game.noGame || '정상게임'
        }));

        res.json({
            success: true,
            games: formattedGames
        });
    } catch (error) {
        console.error('경기 목록 조회 실패:', error);
        res.status(500).json({
            success: false,
            message: '경기 목록을 불러오는데 실패했습니다.'
        });
    }
});

// 게임 진행 데이터 생성 (Create)
router.post('/create', async (req, res) => {
    try {
        const { gameSelection, teamType, inning, batter } = req.body;
        const today = new Date();
        const dateStr = today.getFullYear().toString() +
                       (today.getMonth() + 1).toString().padStart(2, '0') +
                       today.getDate().toString().padStart(2, '0');
        
        const gameId = `${dateStr}-${gameSelection}`;
        
        // member-management 데이터베이스의 game-progress 컬렉션에 데이터 저장
        const db = mongoose.connection.useDb('member-management');
        const collection = db.collection('game-progress');
        
        // 중복 체크
        const existingGame = await collection.findOne({ gameId });
        if (existingGame) {
            return res.status(400).json({
                success: false,
                message: '이미 존재하는 게임 진행 데이터입니다.'
            });
        }

        const gameProgress = {
            gameId,
            gameSelection,
            teamType,
            inning,
            batter,
            bettingStartTime: null,
            bettingEndTime: null,
            bettingResult: null,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        await collection.insertOne(gameProgress);

        res.json({
            success: true,
            message: '게임 진행 데이터가 생성되었습니다.',
            data: gameProgress
        });
    } catch (error) {
        console.error('게임 진행 데이터 생성 실패:', error);
        res.status(500).json({
            success: false,
            message: '게임 진행 데이터 생성에 실패했습니다.'
        });
    }
});

// 게임 진행 데이터 수정 (Update)
router.put('/update/:gameId', async (req, res) => {
    try {
        const { gameId } = req.params;
        const { teamType, inning, batter, bettingStartTime, bettingEndTime, bettingResult } = req.body;

        // member-management 데이터베이스의 game-progress 컬렉션에서 데이터 수정
        const db = mongoose.connection.useDb('member-management');
        const collection = db.collection('game-progress');

        const updateData = {
            ...(teamType && { teamType }),
            ...(inning && { inning }),
            ...(batter && { batter }),
            ...(bettingStartTime && { bettingStartTime: new Date(bettingStartTime) }),
            ...(bettingEndTime && { bettingEndTime: new Date(bettingEndTime) }),
            ...(bettingResult && { bettingResult }),
            updatedAt: new Date()
        };

        const result = await collection.updateOne(
            { gameId },
            { $set: updateData }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({
                success: false,
                message: '해당 게임 진행 데이터를 찾을 수 없습니다.'
            });
        }

        res.json({
            success: true,
            message: '게임 진행 데이터가 수정되었습니다.'
        });
    } catch (error) {
        console.error('게임 진행 데이터 수정 실패:', error);
        res.status(500).json({
            success: false,
            message: '게임 진행 데이터 수정에 실패했습니다.'
        });
    }
});

// 게임 진행 데이터 삭제 (Delete)
router.delete('/delete/:gameId', async (req, res) => {
    try {
        const { gameId } = req.params;

        // member-management 데이터베이스의 game-progress 컬렉션에서 데이터 삭제
        const db = mongoose.connection.useDb('member-management');
        const collection = db.collection('game-progress');

        const result = await collection.deleteOne({ gameId });

        if (result.deletedCount === 0) {
            return res.status(404).json({
                success: false,
                message: '해당 게임 진행 데이터를 찾을 수 없습니다.'
            });
        }

        res.json({
            success: true,
            message: '게임 진행 데이터가 삭제되었습니다.'
        });
    } catch (error) {
        console.error('게임 진행 데이터 삭제 실패:', error);
        res.status(500).json({
            success: false,
            message: '게임 진행 데이터 삭제에 실패했습니다.'
        });
    }
});

// 배팅 시작 시간 업데이트
router.put('/update-betting-start/:gameId', async (req, res) => {
    try {
        const gameProgress = await GameProgress.findOne({ gameId: req.params.gameId });
        if (!gameProgress) {
            return res.status(404).json({ success: false, message: '게임을 찾을 수 없습니다.' });
        }

        gameProgress.bettingStartTime = new Date();
        gameProgress.updatedAt = new Date();
        await gameProgress.save();

        res.json({ success: true, gameProgress });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 배팅 중지 시간 업데이트
router.put('/update-betting-end/:gameId', async (req, res) => {
    try {
        const gameProgress = await GameProgress.findOne({ gameId: req.params.gameId });
        if (!gameProgress) {
            return res.status(404).json({ success: false, message: '게임을 찾을 수 없습니다.' });
        }

        gameProgress.bettingEndTime = new Date();
        gameProgress.updatedAt = new Date();
        await gameProgress.save();

        res.json({ success: true, gameProgress });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 배팅 결과 업데이트
router.put('/update-betting-result/:gameId', async (req, res) => {
    try {
        const { bettingResult } = req.body;
        const gameProgress = await GameProgress.findOne({ gameId: req.params.gameId });
        if (!gameProgress) {
            return res.status(404).json({ success: false, message: '게임을 찾을 수 없습니다.' });
        }

        gameProgress.bettingResult = bettingResult;
        gameProgress.updatedAt = new Date();
        await gameProgress.save();

        res.json({ success: true, gameProgress });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 현재 게임 진행 상태 조회
router.get('/current-status/:gameId', async (req, res) => {
    try {
        const gameProgress = await GameProgress.findOne({ gameId: req.params.gameId });
        if (!gameProgress) {
            return res.status(404).json({ success: false, message: '게임을 찾을 수 없습니다.' });
        }

        res.json({ success: true, gameProgress });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router; 