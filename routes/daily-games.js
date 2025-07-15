const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const { getDb } = require('../config/db');

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

// 일일 게임 생성/수정
router.post('/', async (req, res) => {
    try {
        const db = getDb();
        const collection = db.collection('daily-games');
        
        const { date, games } = req.body;
        
        if (!date || !games) {
            return res.status(400).json({
                success: false,
                message: '날짜와 게임 정보가 필요합니다.'
            });
        }
        
        const result = await collection.findOneAndUpdate(
            { date },
            { $set: { date, games, updatedAt: new Date() } },
            { upsert: true, returnDocument: 'after' }
        );
        
        res.json({
            success: true,
            message: '일일 게임이 저장되었습니다.',
            data: result.value
        });
    } catch (error) {
        console.error('일일 게임 저장 오류:', error);
        res.status(500).json({
            success: false,
            message: '일일 게임 저장에 실패했습니다.',
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