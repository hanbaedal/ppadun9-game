const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const { getDb } = require('../config/db');
const { getKoreanTime } = require('../utils/korean-time');

// 출석체크
router.post('/check-in', async (req, res) => {
    try {
        const db = getDb();
        const collection = db.collection('attendance');
        const memberCollection = db.collection('game-member');
        
        const { userId } = req.body;
        
        if (!userId) {
            return res.status(400).json({ 
                success: false, 
                message: '사용자 ID가 필요합니다.' 
            });
        }
        
        // 회원 정보 조회
        const member = await memberCollection.findOne({ userId: userId });
        if (!member) {
            return res.status(404).json({ 
                success: false, 
                message: '회원을 찾을 수 없습니다.' 
            });
        }
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // 오늘 이미 출석했는지 확인
        const existingAttendance = await collection.findOne({
            userId: userId,
            date: today
        });
        
        if (existingAttendance) {
            return res.status(400).json({ 
                success: false, 
                message: '오늘 이미 출석체크를 완료했습니다.' 
            });
        }
        
        // 연속 출석 일수 계산
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        const yesterdayAttendance = await collection.findOne({
            userId: userId,
            date: yesterday
        });
        
        const streak = yesterdayAttendance ? yesterdayAttendance.streak + 1 : 1;
        
        // 총 출석 일수 계산
        const totalAttendance = await collection.countDocuments({ userId: userId });
        
        // 출석 상태 결정 (9시 이전: 정상, 9시 이후: 지각)
        const checkInTime = new Date();
        const status = checkInTime.getHours() < 9 ? 'present' : 'late';
        
        const newAttendance = {
            userId: userId,
            userName: member.name,
            date: today,
            checkInTime: checkInTime,
            status: status,
            streak: streak,
            totalAttendance: totalAttendance + 1,
            createdAt: getKoreanTime(),
            updatedAt: getKoreanTime()
        };
        
        const result = await collection.insertOne(newAttendance);
        
        res.status(201).json({ 
            success: true, 
            message: '출석체크가 완료되었습니다.',
            attendance: {
                ...newAttendance,
                _id: result.insertedId
            }
        });
    } catch (error) {
        console.error('출석체크 오류:', error);
        res.status(500).json({ 
            success: false, 
            message: '출석체크에 실패했습니다.',
            error: error.message 
        });
    }
});

// 퇴실체크
router.post('/check-out', async (req, res) => {
    try {
        const db = getDb();
        const collection = db.collection('attendance');
        
        const { userId } = req.body;
        
        if (!userId) {
            return res.status(400).json({ 
                success: false, 
                message: '사용자 ID가 필요합니다.' 
            });
        }
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // 오늘 출석 기록 찾기
        const attendance = await collection.findOne({
            userId: userId,
            date: today
        });
        
        if (!attendance) {
            return res.status(404).json({ 
                success: false, 
                message: '오늘 출석 기록이 없습니다.' 
            });
        }
        
        if (attendance.checkOutTime) {
            return res.status(400).json({ 
                success: false, 
                message: '이미 퇴실체크를 완료했습니다.' 
            });
        }
        
        const checkOutTime = new Date();
        const duration = Math.floor((checkOutTime - attendance.checkInTime) / (1000 * 60)); // 분 단위
        
        const result = await collection.updateOne(
            { _id: attendance._id },
            { 
                $set: { 
                    checkOutTime: checkOutTime,
                    duration: duration,
                    updatedAt: getKoreanTime()
                } 
            }
        );
        
        res.json({ 
            success: true, 
            message: '퇴실체크가 완료되었습니다.',
            duration: duration
        });
    } catch (error) {
        console.error('퇴실체크 오류:', error);
        res.status(500).json({ 
            success: false, 
            message: '퇴실체크에 실패했습니다.',
            error: error.message 
        });
    }
});

// 사용자 출석 기록 조회
router.get('/:userId', async (req, res) => {
    try {
        const db = getDb();
        const collection = db.collection('attendance');
        
        const { userId } = req.params;
        const { page = 1, limit = 30 } = req.query;
        
        const skip = (page - 1) * limit;
        
        const attendances = await collection.find({ userId: userId })
            .sort({ date: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .toArray();
        
        const total = await collection.countDocuments({ userId: userId });
        
        res.json({ 
            success: true, 
            attendances: attendances,
            total: total,
            page: parseInt(page),
            totalPages: Math.ceil(total / limit)
        });
    } catch (error) {
        console.error('출석 기록 조회 오류:', error);
        res.status(500).json({ 
            success: false, 
            message: '출석 기록을 불러오는데 실패했습니다.',
            error: error.message 
        });
    }
});

// 사용자 출석 통계
router.get('/stats/:userId', async (req, res) => {
    try {
        const db = getDb();
        const collection = db.collection('attendance');
        
        const { userId } = req.params;
        
        // 전체 출석 일수
        const totalAttendance = await collection.countDocuments({ userId: userId });
        
        // 이번 달 출석 일수
        const now = new Date();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthlyAttendance = await collection.countDocuments({
            userId: userId,
            date: { $gte: firstDayOfMonth }
        });
        
        // 연속 출석 일수
        const latestAttendance = await collection.findOne(
            { userId: userId },
            { sort: { date: -1 } }
        );
        const streak = latestAttendance ? latestAttendance.streak : 0;
        
        // 출석률 계산 (이번 달)
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const attendanceRate = Math.round((monthlyAttendance / daysInMonth) * 100);
        
        res.json({ 
            success: true, 
            stats: {
                totalAttendance,
                monthlyAttendance,
                streak,
                attendanceRate
            }
        });
    } catch (error) {
        console.error('출석 통계 조회 오류:', error);
        res.status(500).json({ 
            success: false, 
            message: '출석 통계를 불러오는데 실패했습니다.',
            error: error.message 
        });
    }
});

// 출석 랭킹
router.get('/ranking', async (req, res) => {
    try {
        const db = getDb();
        const collection = db.collection('attendance');
        
        const { period = 'month' } = req.query;
        
        let dateFilter = {};
        if (period === 'month') {
            const now = new Date();
            const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            dateFilter = { date: { $gte: firstDayOfMonth } };
        }
        
        const ranking = await collection.aggregate([
            { $match: dateFilter },
            { $group: {
                _id: '$userId',
                userName: { $first: '$userName' },
                attendanceCount: { $sum: 1 },
                maxStreak: { $max: '$streak' }
            }},
            { $sort: { attendanceCount: -1, maxStreak: -1 } },
            { $limit: 10 }
        ]).toArray();
        
        res.json({ 
            success: true, 
            ranking: ranking
        });
    } catch (error) {
        console.error('출석 랭킹 조회 오류:', error);
        res.status(500).json({ 
            success: false, 
            message: '출석 랭킹을 불러오는데 실패했습니다.',
            error: error.message 
        });
    }
});

module.exports = router; 