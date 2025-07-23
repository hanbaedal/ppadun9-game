const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const { getKoreanTime } = require('../utils/korean-time');

// 실시간 사용자 통계 API
router.get('/user-stats', async (req, res) => {
    try {
        const db = req.app.locals.db;
        
        // 현재 로그인한 회원 수
        const loggedInUsers = await db.collection('game-member').countDocuments({
            isLoggedIn: true
        });

        // 현재 배팅에 참여한 인원 수
        const bettingUsers = await db.collection('betting-predictions').distinct('userId', {
            createdAt: {
                $gte: new Date(new Date().setHours(0, 0, 0, 0))
            }
        });

        // 오늘 배팅 선택한 총 개수
        const totalChoices = await db.collection('betting-predictions').countDocuments({
            createdAt: {
                $gte: new Date(new Date().setHours(0, 0, 0, 0))
            }
        });

        res.json({
            success: true,
            data: {
                loggedInUsers,
                bettingUsers: bettingUsers.length,
                totalChoices
            }
        });

    } catch (error) {
        console.error('사용자 통계 조회 오류:', error);
        res.json({
            success: false,
            message: '사용자 통계 조회 중 오류가 발생했습니다.'
        });
    }
});

// 게임별 배팅 통계 API
router.get('/game-betting-stats', async (req, res) => {
    try {
        const { date } = req.query;
        const db = req.app.locals.db;

        if (!date) {
            return res.json({
                success: false,
                message: '날짜가 필요합니다.'
            });
        }

        // 해당 날짜의 배팅 예측 데이터 조회
        const bettingData = await db.collection('betting-predictions').aggregate([
            {
                $match: {
                    date: date
                }
            },
            {
                $group: {
                    _id: {
                        gameNumber: '$gameNumber',
                        choice: '$choice'
                    },
                    count: { $sum: 1 },
                    totalPoints: { $sum: '$points' }
                }
            }
        ]).toArray();

        // 게임별로 데이터 정리
        const games = {};
        bettingData.forEach(item => {
            const gameNumber = item._id.gameNumber;
            const choice = item._id.choice;
            
            if (!games[gameNumber]) {
                games[gameNumber] = {
                    gameNumber,
                    bettingChoices: {},
                    totalBettors: 0,
                    totalPoints: 0
                };
            }
            
            games[gameNumber].bettingChoices[choice] = {
                count: item.count,
                totalPoints: item.totalPoints
            };
            games[gameNumber].totalBettors += item.count;
            games[gameNumber].totalPoints += item.totalPoints;
        });

        res.json({
            success: true,
            data: {
                games: Object.values(games)
            }
        });

    } catch (error) {
        console.error('게임 배팅 통계 조회 오류:', error);
        res.json({
            success: false,
            message: '게임 배팅 통계 조회 중 오류가 발생했습니다.'
        });
    }
});

module.exports = router; 