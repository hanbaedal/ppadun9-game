const express = require('express');
const router = express.Router();
const GameProgress = require('../models/game-progress');
const mongoose = require('mongoose');

// 오늘의 경기 목록 조회
router.get('/today-games', async (req, res) => {
    try {
        const today = new Date();
        const dateStr = today.getFullYear().toString() +
                       (today.getMonth() + 1).toString().padStart(2, '0') +
                       today.getDate().toString().padStart(2, '0');

        // today-game-start.html에서 입력된 경기 데이터 조회
        const db = mongoose.connection.db;
        const games = await db.collection('today-game-start').find({ date: dateStr }).toArray();
        
        res.json({ success: true, games });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 게임 진행 데이터 생성
router.post('/create', async (req, res) => {
    try {
        const { gameSelection, teamType, inning, batter } = req.body;
        const today = new Date();
        const dateStr = today.getFullYear().toString() +
                       (today.getMonth() + 1).toString().padStart(2, '0') +
                       today.getDate().toString().padStart(2, '0');
        
        const gameId = `${dateStr}-${gameSelection}`;
        
        const gameProgress = new GameProgress({
            gameId,
            gameSelection,
            teamType,
            inning,
            batter
        });

        await gameProgress.save();
        res.json({ success: true, gameProgress });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
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