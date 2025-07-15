const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const { getDb } = require('../config/db');

// 게임 진행 상태 조회
router.get('/status', async (req, res) => {
    try {
        const db = getDb();
        const collection = db.collection('game-progress');
        
        const { date } = req.query;
        
        if (!date) {
            return res.status(400).json({
                success: false,
                message: '날짜가 필요합니다.'
            });
        }
        
        const progress = await collection.findOne({ date });
        
        res.json({
            success: true,
            progress: progress || { date, status: 'not_started', currentGame: null }
        });
    } catch (error) {
        console.error('게임 진행 상태 조회 오류:', error);
        res.status(500).json({
            success: false,
            message: '게임 진행 상태 조회에 실패했습니다.',
            error: error.message
        });
    }
});

// 게임 진행 상태 업데이트
router.post('/status', async (req, res) => {
    try {
        const db = getDb();
        const collection = db.collection('game-progress');
        
        const { date, status, currentGame, gameNumber } = req.body;
        
        if (!date || !status) {
            return res.status(400).json({
                success: false,
                message: '날짜와 상태가 필요합니다.'
            });
        }
        
        const updateData = {
            date,
            status,
            updatedAt: new Date()
        };
        
        if (currentGame) {
            updateData.currentGame = currentGame;
        }
        
        if (gameNumber) {
            updateData.gameNumber = gameNumber;
        }
        
        const result = await collection.findOneAndUpdate(
            { date },
            { $set: updateData },
            { upsert: true, returnDocument: 'after' }
        );
        
        res.json({
            success: true,
            message: '게임 진행 상태가 업데이트되었습니다.',
            progress: result.value
        });
    } catch (error) {
        console.error('게임 진행 상태 업데이트 오류:', error);
        res.status(500).json({
            success: false,
            message: '게임 진행 상태 업데이트에 실패했습니다.',
            error: error.message
        });
    }
});

// 게임 시작
router.post('/start', async (req, res) => {
    try {
        const db = getDb();
        const collection = db.collection('game-progress');
        
        const { date, gameNumber } = req.body;
        
        if (!date || !gameNumber) {
            return res.status(400).json({
                success: false,
                message: '날짜와 게임 번호가 필요합니다.'
            });
        }
        
        const result = await collection.findOneAndUpdate(
            { date },
            { 
                $set: { 
                    date,
                    status: 'in_progress',
                    currentGame: gameNumber,
                    gameNumber,
                    startTime: new Date(),
                    updatedAt: new Date()
                } 
            },
            { upsert: true, returnDocument: 'after' }
        );
        
        res.json({
            success: true,
            message: '게임이 시작되었습니다.',
            progress: result.value
        });
    } catch (error) {
        console.error('게임 시작 오류:', error);
        res.status(500).json({
            success: false,
            message: '게임 시작에 실패했습니다.',
            error: error.message
        });
    }
});

// 게임 종료
router.post('/end', async (req, res) => {
    try {
        const db = getDb();
        const collection = db.collection('game-progress');
        
        const { date } = req.body;
        
        if (!date) {
            return res.status(400).json({
                success: false,
                message: '날짜가 필요합니다.'
            });
        }
        
        const result = await collection.findOneAndUpdate(
            { date },
            { 
                $set: { 
                    status: 'completed',
                    endTime: new Date(),
                    updatedAt: new Date()
                } 
            },
            { returnDocument: 'after' }
        );
        
        if (!result.value) {
            return res.status(404).json({
                success: false,
                message: '해당 날짜의 게임 진행 상태를 찾을 수 없습니다.'
            });
        }
        
        res.json({
            success: true,
            message: '게임이 종료되었습니다.',
            progress: result.value
        });
    } catch (error) {
        console.error('게임 종료 오류:', error);
        res.status(500).json({
            success: false,
            message: '게임 종료에 실패했습니다.',
            error: error.message
        });
    }
});

module.exports = router; 