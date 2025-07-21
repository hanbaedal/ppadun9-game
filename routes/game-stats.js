const express = require('express');
const router = express.Router();
const { getGameStatsCollection } = require('../models/game-stats');

// POST /api/game-stats/save
router.post('/save', async (req, res) => {
    try {
        const { date, gameNumber, stats } = req.body;
        if (!date || !gameNumber || !stats) {
            return res.status(400).json({ success: false, message: 'date, gameNumber, stats 필수' });
        }
        const collection = getGameStatsCollection();
        const filter = { date, gameNumber };
        const update = { $set: { ...stats, date, gameNumber, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } };
        const options = { upsert: true };
        await collection.updateOne(filter, update, options);
        res.json({ success: true });
    } catch (error) {
        console.error('[GameStats] 저장 오류:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET /api/game-stats/:date
router.get('/:date', async (req, res) => {
    try {
        const { date } = req.params;
        const collection = getGameStatsCollection();
        const stats = await collection.find({ date }).sort({ gameNumber: 1 }).toArray();
        res.json({ success: true, data: stats });
    } catch (error) {
        console.error('[GameStats] 조회 오류:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router; 