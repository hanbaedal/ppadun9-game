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

        // 현재 배팅에 참여한 인원 수 (더미 데이터 제외)
        const bettingUsers = await db.collection('betting-predictions').distinct('userId', {
            status: { $ne: 'dummy' },
            createdAt: {
                $gte: new Date(new Date().setHours(0, 0, 0, 0))
            }
        });

        // 오늘 배팅 선택한 총 개수 (더미 데이터 제외)
        const totalChoices = await db.collection('betting-predictions').countDocuments({
            status: { $ne: 'dummy' },
            createdAt: {
                $gte: new Date(new Date().setHours(0, 0, 0, 0))
            }
        });

        // 오늘 총 승리 포인트
        const today = new Date().toISOString().split('T')[0];
        const pointHistoryCollection = db.collection('point-history');
        const todayWinnings = await pointHistoryCollection.aggregate([
            {
                $match: {
                    type: 'betting_win',
                    date: today
                }
            },
            {
                $group: {
                    _id: null,
                    totalWinnings: { $sum: '$amount' }
                }
            }
        ]).toArray();

        const totalWinnings = todayWinnings.length > 0 ? todayWinnings[0].totalWinnings : 0;

        res.json({
            success: true,
            data: {
                loggedInUsers,
                bettingUsers: bettingUsers.length,
                totalChoices,
                totalWinnings
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

        // 전체 배팅 데이터 확인 (디버깅용, 더미 데이터 제외)
        const allPredictions = await db.collection('betting-predictions').find({ status: { $ne: 'dummy' } }).toArray();
        console.log(`실제 배팅 예측 데이터: ${allPredictions.length}개`);
        console.log('배팅 데이터 샘플:', allPredictions.slice(0, 3));

        // 해당 날짜의 배팅 예측 데이터 조회 (더미 데이터 제외, 날짜 형식 유연하게 처리)
        const bettingData = await db.collection('betting-predictions').aggregate([
            {
                $match: {
                    status: { $ne: 'dummy' },
                    $or: [
                        { date: date },
                        { date: new Date(date) },
                        { 
                            createdAt: {
                                $gte: new Date(date + 'T00:00:00.000Z'),
                                $lt: new Date(date + 'T23:59:59.999Z')
                            }
                        }
                    ]
                }
            },
            {
                $group: {
                    _id: {
                        gameNumber: '$gameNumber',
                        prediction: '$prediction'
                    },
                    count: { $sum: 1 },
                    totalPoints: { $sum: '$points' }
                }
            }
        ]).toArray();

        console.log(`필터링된 배팅 데이터: ${bettingData.length}개`);
        console.log('필터링된 데이터:', bettingData);

        // 게임별로 데이터 정리
        const games = {};
        bettingData.forEach(item => {
            const gameNumber = item._id.gameNumber;
            const prediction = item._id.prediction;
            
            if (!games[gameNumber]) {
                games[gameNumber] = {
                    gameNumber,
                    bettingChoices: {},
                    totalBettors: 0,
                    totalPoints: 0
                };
            }
            
            games[gameNumber].bettingChoices[prediction] = {
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