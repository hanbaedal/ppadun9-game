const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const { getDb } = require('../config/db');
const { getKoreanTime } = require('../utils/korean-time');

// 포인트 충전 리스트 조회
router.get('/', async (req, res) => {
    try {
        const db = getDb();
        const collection = db.collection('game-charging');
        
        // 모든 충전 내역 조회 (최신순으로 정렬)
        const chargings = await collection.find({}).sort({ createdAt: -1 }).toArray();
        
        res.json({ 
            success: true, 
            chargings: chargings 
        });
    } catch (error) {
        console.error('포인트 충전 리스트 조회 오류:', error);
        res.status(500).json({ 
            success: false, 
            message: '포인트 충전 내역을 불러오는데 실패했습니다.',
            error: error.message 
        });
    }
});

// 포인트 충전 상세 조회
router.get('/:id', async (req, res) => {
    try {
        const db = getDb();
        const collection = db.collection('game-charging');
        
        const charging = await collection.findOne({ _id: new ObjectId(req.params.id) });
        
        if (!charging) {
            return res.status(404).json({ 
                success: false, 
                message: '포인트 충전 내역을 찾을 수 없습니다.' 
            });
        }
        
        res.json({ 
            success: true, 
            charging: charging 
        });
    } catch (error) {
        console.error('포인트 충전 상세 조회 오류:', error);
        res.status(500).json({ 
            success: false, 
            message: '포인트 충전 내역 조회에 실패했습니다.',
            error: error.message 
        });
    }
});

// 포인트 충전 상태 업데이트
router.put('/:id/status', async (req, res) => {
    try {
        const db = getDb();
        const collection = db.collection('game-charging');
        
        const { status, note } = req.body;
        
        const updateDoc = {
            $set: {
                status: status,
                updatedAt: getKoreanTime()
            }
        };
        
        // 완료 상태인 경우 완료 시간 추가
        if (status === 'completed') {
            updateDoc.$set.completedAt = getKoreanTime();
        }
        
        // 비고가 있는 경우 추가
        if (note) {
            updateDoc.$set.note = note;
        }
        
        const result = await collection.updateOne(
            { _id: new ObjectId(req.params.id) }, 
            updateDoc
        );
        
        if (result.matchedCount === 0) {
            return res.status(404).json({ 
                success: false, 
                message: '포인트 충전 내역을 찾을 수 없습니다.' 
            });
        }
        
        res.json({ 
            success: true, 
            message: '포인트 충전 상태가 업데이트되었습니다.' 
        });
    } catch (error) {
        console.error('포인트 충전 상태 업데이트 오류:', error);
        res.status(500).json({ 
            success: false, 
            message: '포인트 충전 상태 업데이트에 실패했습니다.',
            error: error.message 
        });
    }
});

// 포인트 충전 통계 조회
router.get('/stats/summary', async (req, res) => {
    try {
        const db = getDb();
        const collection = db.collection('game-charging');
        
        // 전체 통계
        const totalChargings = await collection.countDocuments();
        const totalAmount = await collection.aggregate([
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]).toArray();
        
        // 상태별 통계
        const statusStats = await collection.aggregate([
            { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$amount' } } }
        ]).toArray();
        
        // 일별 통계 (최근 7일)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        const dailyStats = await collection.aggregate([
            { $match: { createdAt: { $gte: sevenDaysAgo } } },
            { 
                $group: { 
                    _id: { 
                        $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } 
                    }, 
                    count: { $sum: 1 }, 
                    total: { $sum: '$amount' } 
                } 
            },
            { $sort: { _id: -1 } }
        ]).toArray();
        
        res.json({
            success: true,
            stats: {
                totalChargings,
                totalAmount: totalAmount[0]?.total || 0,
                statusStats,
                dailyStats
            }
        });
    } catch (error) {
        console.error('포인트 충전 통계 조회 오류:', error);
        res.status(500).json({ 
            success: false, 
            message: '포인트 충전 통계를 불러오는데 실패했습니다.',
            error: error.message 
        });
    }
});

module.exports = router; 