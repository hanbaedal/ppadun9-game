const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const { getKoreanTime } = require('../utils/korean-time');

// 배팅 세션 컬렉션
const BETTING_SESSIONS_COLLECTION = 'betting-sessions';
const BETTING_PREDICTIONS_COLLECTION = 'betting-predictions';
const BETTING_RESULTS_COLLECTION = 'betting-results';
const BETTING_SYSTEM_COLLECTION = 'betting-system';

// 배팅 시스템 활성화 API
router.post('/activate', async (req, res) => {
    try {
        const db = req.app.locals.db;
        const collection = db.collection(BETTING_SYSTEM_COLLECTION);

        // 배팅 시스템 상태를 활성화로 설정
        await collection.updateOne(
            { _id: 'system' },
            { 
                $set: { 
                    isActive: true,
                    activatedAt: getKoreanTime(),
                    updatedAt: getKoreanTime()
                }
            },
            { upsert: true }
        );

        console.log('배팅 시스템 활성화됨');

        res.json({ 
            success: true, 
            message: '배팅 시스템이 활성화되었습니다.' 
        });

    } catch (error) {
        console.error('배팅 시스템 활성화 오류:', error);
        res.json({ 
            success: false, 
            message: '배팅 시스템 활성화 중 오류가 발생했습니다.' 
        });
    }
});

// 배팅 시스템 비활성화 API
router.post('/deactivate', async (req, res) => {
    try {
        const db = req.app.locals.db;
        const collection = db.collection(BETTING_SYSTEM_COLLECTION);

        // 배팅 시스템 상태를 비활성화로 설정
        await collection.updateOne(
            { _id: 'system' },
            { 
                $set: { 
                    isActive: false,
                    deactivatedAt: getKoreanTime(),
                    updatedAt: getKoreanTime()
                }
            },
            { upsert: true }
        );

        console.log('배팅 시스템 비활성화됨');

        res.json({ 
            success: true, 
            message: '배팅 시스템이 비활성화되었습니다.' 
        });

    } catch (error) {
        console.error('배팅 시스템 비활성화 오류:', error);
        res.json({ 
            success: false, 
            message: '배팅 시스템 비활성화 중 오류가 발생했습니다.' 
        });
    }
});

// 배팅 시스템 상태 확인 API
router.get('/status', async (req, res) => {
    try {
        const db = req.app.locals.db;
        const collection = db.collection(BETTING_SYSTEM_COLLECTION);

        // 배팅 시스템 상태 조회
        const systemStatus = await collection.findOne({ _id: 'system' });

        const isActive = systemStatus ? systemStatus.isActive : false;

        res.json({ 
            success: true, 
            data: { 
                isActive,
                lastUpdated: systemStatus ? systemStatus.updatedAt : null
            }
        });

    } catch (error) {
        console.error('배팅 시스템 상태 확인 오류:', error);
        res.json({ 
            success: false, 
            message: '배팅 시스템 상태 확인 중 오류가 발생했습니다.' 
        });
    }
});

// 배팅 시작 API
router.post('/start', async (req, res) => {
    try {
        const { gameNumber, gameType, date } = req.body;
        
        if (!gameNumber || !gameType || !date) {
            return res.json({ 
                success: false, 
                message: '필수 정보가 누락되었습니다.' 
            });
        }

        const db = req.app.locals.db;
        const collection = db.collection(BETTING_SESSIONS_COLLECTION);

        // 기존 배팅 세션이 있는지 확인
        const existingSession = await collection.findOne({
            gameNumber: parseInt(gameNumber),
            date: date,
            status: 'active'
        });

        if (existingSession) {
            return res.json({ 
                success: false, 
                message: '이미 진행 중인 배팅이 있습니다.' 
            });
        }

        // 새로운 배팅 세션 생성
        const newSession = {
            gameNumber: parseInt(gameNumber),
            gameType: gameType,
            date: date,
            status: 'active',
            startTime: new Date(),
            createdAt: new Date(),
            updatedAt: getKoreanTime()
        };

        await collection.insertOne(newSession);

        console.log(`배팅 시작: 게임${gameNumber}, 타입: ${gameType}, 날짜: ${date}`);

        res.json({ 
            success: true, 
            message: '배팅이 시작되었습니다.',
            sessionId: newSession._id
        });

    } catch (error) {
        console.error('배팅 시작 오류:', error);
        res.json({ 
            success: false, 
            message: '배팅 시작 중 오류가 발생했습니다.' 
        });
    }
});

// 배팅 중지 API
router.post('/stop', async (req, res) => {
    try {
        const { gameNumber, date } = req.body;
        
        if (!gameNumber || !date) {
            return res.json({ 
                success: false, 
                message: '필수 정보가 누락되었습니다.' 
            });
        }

        const db = req.app.locals.db;
        const collection = db.collection(BETTING_SESSIONS_COLLECTION);

        // 활성 배팅 세션 찾기
        const session = await collection.findOne({
            gameNumber: parseInt(gameNumber),
            date: date,
            status: 'active'
        });

        if (!session) {
            return res.json({ 
                success: false, 
                message: '진행 중인 배팅을 찾을 수 없습니다.' 
            });
        }

        // 배팅 세션을 중지 상태로 변경
        await collection.updateOne(
            { _id: session._id },
            { 
                $set: { 
                    status: 'stopped',
                    stopTime: new Date(),
                    updatedAt: getKoreanTime()
                } 
            }
        );

        console.log(`배팅 중지: 게임${gameNumber}, 날짜: ${date}`);

        res.json({ 
            success: true, 
            message: '배팅이 중지되었습니다.',
            sessionId: session._id
        });

    } catch (error) {
        console.error('배팅 중지 오류:', error);
        res.json({ 
            success: false, 
            message: '배팅 중지 중 오류가 발생했습니다.' 
        });
    }
});

// 예측 결과 처리 API
router.post('/result', async (req, res) => {
    try {
        const { gameNumber, prediction, date } = req.body;
        
        if (!gameNumber || !prediction || !date) {
            return res.json({ 
                success: false, 
                message: '필수 정보가 누락되었습니다.' 
            });
        }

        const db = req.app.locals.db;
        const sessionsCollection = db.collection(BETTING_SESSIONS_COLLECTION);
        const predictionsCollection = db.collection(BETTING_PREDICTIONS_COLLECTION);
        const resultsCollection = db.collection(BETTING_RESULTS_COLLECTION);

        // 배팅 세션 확인
        const session = await sessionsCollection.findOne({
            gameNumber: parseInt(gameNumber),
            date: date,
            status: 'stopped'
        });

        if (!session) {
            return res.json({ 
                success: false, 
                message: '중지된 배팅 세션을 찾을 수 없습니다.' 
            });
        }

        // 예측 결과 저장
        const result = {
            sessionId: session._id,
            gameNumber: parseInt(gameNumber),
            prediction: prediction,
            date: date,
            createdAt: new Date()
        };

        await resultsCollection.insertOne(result);

        // 예측 결과에 따른 포인트 분배 처리
        const predictions = await predictionsCollection.find({
            sessionId: session._id
        }).toArray();

        const winners = [];
        const losers = [];

        for (const pred of predictions) {
            if (pred.prediction === prediction) {
                winners.push(pred);
            } else {
                losers.push(pred);
            }
        }

        // 포인트 분배 로직 (실패자 포인트를 적중자에게 분배)
        if (winners.length > 0 && losers.length > 0) {
            const totalLoserPoints = losers.reduce((sum, pred) => sum + pred.points, 0);
            const pointsPerWinner = Math.floor(totalLoserPoints / winners.length);

            // 적중자들에게 포인트 지급
            const memberCollection = db.collection('game-member');
            const pointHistoryCollection = db.collection('point-history');

            for (const winner of winners) {
                try {
                    // 회원 포인트 업데이트
                    const updateResult = await memberCollection.updateOne(
                        { _id: new ObjectId(winner.userId) },
                        { 
                            $inc: { 
                                points: pointsPerWinner,
                                totalWinnings: pointsPerWinner,
                                winCount: 1
                            },
                            $set: {
                                lastWinAt: getKoreanTime(),
                                updatedAt: getKoreanTime()
                            }
                        }
                    );

                    if (updateResult.modifiedCount > 0) {
                        // 포인트 지급 내역 기록
                        await pointHistoryCollection.insertOne({
                            userId: winner.userId,
                            type: 'betting_win',
                            amount: pointsPerWinner,
                            gameNumber: parseInt(gameNumber),
                            prediction: prediction,
                            date: date,
                            description: `${gameNumber}경기 배팅 승리 보상`,
                            createdAt: getKoreanTime()
                        });

                        console.log(`적중자 ${winner.userId}에게 ${pointsPerWinner}포인트 지급 완료`);
                    } else {
                        console.error(`적중자 ${winner.userId} 포인트 지급 실패`);
                    }
                } catch (error) {
                    console.error(`적중자 ${winner.userId} 포인트 지급 중 오류:`, error);
                }
            }

            // 실패자들의 포인트 차감 내역도 기록
            for (const loser of losers) {
                try {
                    await pointHistoryCollection.insertOne({
                        userId: loser.userId,
                        type: 'betting_loss',
                        amount: -loser.points,
                        gameNumber: parseInt(gameNumber),
                        prediction: loser.prediction,
                        actualResult: prediction,
                        date: date,
                        description: `${gameNumber}경기 배팅 실패`,
                        createdAt: getKoreanTime()
                    });
                } catch (error) {
                    console.error(`실패자 ${loser.userId} 포인트 차감 기록 중 오류:`, error);
                }
            }
        }

        console.log(`예측 결과 처리: 게임${gameNumber}, 예측: ${prediction}, 적중자: ${winners.length}명`);

        res.json({ 
            success: true, 
            message: '예측 결과가 처리되었습니다.',
            winners: winners,
            losers: losers,
            totalWinners: winners.length,
            totalLosers: losers.length
        });

    } catch (error) {
        console.error('예측 결과 처리 오류:', error);
        res.json({ 
            success: false, 
            message: '예측 결과 처리 중 오류가 발생했습니다.' 
        });
    }
});

// 배팅 세션 조회 API
router.get('/sessions/:date', async (req, res) => {
    try {
        const { date } = req.params;
        const db = req.app.locals.db;
        const collection = db.collection(BETTING_SESSIONS_COLLECTION);

        const sessions = await collection.find({ date: date }).toArray();

        res.json({ 
            success: true, 
            data: sessions 
        });

    } catch (error) {
        console.error('배팅 세션 조회 오류:', error);
        res.json({ 
            success: false, 
            message: '배팅 세션 조회 중 오류가 발생했습니다.' 
        });
    }
});

// 배팅 예측 저장 API (게임에서 사용)
router.post('/predict', async (req, res) => {
    try {
        const { sessionId, userId, prediction, points } = req.body;
        
        if (!sessionId || !userId || !prediction || !points) {
            return res.json({ 
                success: false, 
                message: '필수 정보가 누락되었습니다.' 
            });
        }

        // 배팅 시스템 활성화 상태 확인
        const db = req.app.locals.db;
        const systemCollection = db.collection(BETTING_SYSTEM_COLLECTION);
        const systemStatus = await systemCollection.findOne({ _id: 'system' });
        
        if (!systemStatus || !systemStatus.isActive) {
            return res.json({ 
                success: false, 
                message: '현재 배팅이 활성화되지 않았습니다.' 
            });
        }

        // 배팅 시스템 활성화 상태 확인
        const bettingDb = req.app.locals.db;
        const systemCollection = bettingDb.collection(BETTING_SYSTEM_COLLECTION);
        const systemStatus = await systemCollection.findOne({ _id: 'system' });
        
        if (!systemStatus || !systemStatus.isActive) {
            return res.json({ 
                success: false, 
                message: '현재 배팅이 활성화되지 않았습니다.' 
            });
        }

        // 배팅 세션 확인
        const sessionsCollection = bettingDb.collection(BETTING_SESSIONS_COLLECTION);
        const bettingSession = await sessionsCollection.findOne({
            _id: new ObjectId(sessionId),
            status: 'active'
        });

        if (!bettingSession) {
            return res.json({ 
                success: false, 
                message: '진행 중인 배팅 세션을 찾을 수 없습니다.' 
            });
        }

        // 회원 포인트 확인
        const memberCollection = bettingDb.collection('game-member');
        const member = await memberCollection.findOne({ _id: new ObjectId(userId) });

        if (!member) {
            return res.json({ 
                success: false, 
                message: '회원을 찾을 수 없습니다.' 
            });
        }

        if (member.points < points) {
            return res.json({ 
                success: false, 
                message: '보유 포인트가 부족합니다.' 
            });
        }

        // 중복 예측 확인
        const predictionsCollection = bettingDb.collection(BETTING_PREDICTIONS_COLLECTION);
        const existingPrediction = await predictionsCollection.findOne({
            sessionId: new ObjectId(sessionId),
            userId: userId
        });

        if (existingPrediction) {
            return res.json({ 
                success: false, 
                message: '이미 예측을 완료했습니다.' 
            });
        }

        // 예측 저장
        const predictionData = {
            sessionId: new ObjectId(sessionId),
            userId: userId,
            prediction: prediction,
            points: points,
            gameNumber: bettingSession.gameNumber,
            date: bettingSession.date,
            createdAt: getKoreanTime()
        };

        await predictionsCollection.insertOne(predictionData);

        // 회원 포인트 차감
        await memberCollection.updateOne(
            { _id: new ObjectId(userId) },
            { 
                $inc: { 
                    points: -points,
                    totalBetting: points
                },
                $set: {
                    lastBettingAt: getKoreanTime(),
                    updatedAt: getKoreanTime()
                }
            }
        );

        // 포인트 사용 내역 기록
        const pointHistoryCollection = bettingDb.collection('point-history');
        await pointHistoryCollection.insertOne({
            userId: userId,
            type: 'betting_use',
            amount: -points,
            gameNumber: bettingSession.gameNumber,
            prediction: prediction,
            date: bettingSession.date,
            description: `${bettingSession.gameNumber}경기 배팅 참여`,
            createdAt: getKoreanTime()
        });

        console.log(`배팅 예측 저장: 사용자 ${userId}, 예측: ${prediction}, 포인트: ${points}`);

        res.json({ 
            success: true, 
            message: '예측이 저장되었습니다.',
            predictionId: predictionData._id
        });
    } catch (error) {
        console.error('배팅 예측 저장 오류:', error);
        res.json({ 
            success: false, 
            message: '배팅 예측 저장 중 오류가 발생했습니다.' 
        });
    }
});

// 승리 포인트 계산 API
router.post('/calculate-winnings', async (req, res) => {
    try {
        const { gameNumber, prediction, date } = req.body;
        
        if (!gameNumber || !prediction || !date) {
            return res.json({ 
                success: false, 
                message: '필수 정보가 누락되었습니다.' 
            });
        }

        const db = req.app.locals.db;
        const predictionsCollection = db.collection(BETTING_PREDICTIONS_COLLECTION);
        const memberCollection = db.collection('game-member');

        // 해당 게임의 모든 예측 조회
        const predictions = await predictionsCollection.find({
            gameNumber: parseInt(gameNumber),
            date: date
        }).toArray();

        if (predictions.length === 0) {
            return res.json({ 
                success: false, 
                message: '해당 게임의 배팅 데이터가 없습니다.' 
            });
        }

        // 승리자와 실패자 분류
        const winners = [];
        const losers = [];
        let totalPoints = 0;

        for (const pred of predictions) {
            totalPoints += pred.points;
            
            if (pred.prediction === prediction) {
                winners.push(pred);
            } else {
                losers.push(pred);
            }
        }

        // 승리자 정보 조회 (이름 포함)
        const winnerDetails = [];
        for (const winner of winners) {
            const member = await memberCollection.findOne({ _id: new ObjectId(winner.userId) });
            winnerDetails.push({
                ...winner,
                userName: member ? member.name : '알 수 없음'
            });
        }

        // 포인트 계산
        const totalLoserPoints = losers.reduce((sum, pred) => sum + pred.points, 0);
        const pointsPerWinner = winners.length > 0 ? Math.floor(totalLoserPoints / winners.length) : 0;
        const totalWinnings = pointsPerWinner * winners.length;

        res.json({
            success: true,
            data: {
                gameNumber: parseInt(gameNumber),
                prediction: prediction,
                date: date,
                totalBettors: predictions.length,
                totalPoints: totalPoints,
                winners: winnerDetails,
                losers: losers,
                totalLoserPoints: totalLoserPoints,
                pointsPerWinner: pointsPerWinner,
                totalWinnings: totalWinnings
            }
        });

    } catch (error) {
        console.error('승리 포인트 계산 오류:', error);
        res.json({ 
            success: false, 
            message: '승리 포인트 계산 중 오류가 발생했습니다.' 
        });
    }
});

// 보상 지급 API
router.post('/distribute-winnings', async (req, res) => {
    try {
        const { gameNumber, prediction, date, winners, pointsPerWinner } = req.body;
        
        if (!gameNumber || !prediction || !date || !winners || !pointsPerWinner) {
            return res.json({ 
                success: false, 
                message: '필수 정보가 누락되었습니다.' 
            });
        }

        const db = req.app.locals.db;
        const memberCollection = db.collection('game-member');
        const pointHistoryCollection = db.collection('point-history');
        const resultsCollection = db.collection(BETTING_RESULTS_COLLECTION);

        // 예측 결과 저장
        const result = {
            gameNumber: parseInt(gameNumber),
            prediction: prediction,
            date: date,
            distributedAt: getKoreanTime(),
            createdAt: getKoreanTime()
        };

        await resultsCollection.insertOne(result);

        // 승리자들에게 포인트 지급
        const distributedWinners = [];
        
        for (const winner of winners) {
            try {
                // 회원 포인트 업데이트
                const updateResult = await memberCollection.updateOne(
                    { _id: new ObjectId(winner.userId) },
                    { 
                        $inc: { 
                            points: pointsPerWinner,
                            totalWinnings: pointsPerWinner,
                            winCount: 1
                        },
                        $set: {
                            lastWinAt: getKoreanTime(),
                            updatedAt: getKoreanTime()
                        }
                    }
                );

                if (updateResult.modifiedCount > 0) {
                    // 포인트 지급 내역 기록
                    await pointHistoryCollection.insertOne({
                        userId: winner.userId,
                        type: 'betting_win',
                        amount: pointsPerWinner,
                        gameNumber: parseInt(gameNumber),
                        prediction: prediction,
                        date: date,
                        description: `${gameNumber}경기 배팅 승리 보상`,
                        createdAt: getKoreanTime()
                    });

                    distributedWinners.push({
                        userId: winner.userId,
                        userName: winner.userName,
                        pointsReceived: pointsPerWinner
                    });

                    console.log(`승리자 ${winner.userName}에게 ${pointsPerWinner}포인트 지급 완료`);
                }
            } catch (error) {
                console.error(`승리자 ${winner.userId} 포인트 지급 중 오류:`, error);
            }
        }

        res.json({
            success: true,
            message: '보상이 성공적으로 지급되었습니다.',
            data: {
                distributedWinners: distributedWinners,
                totalDistributed: distributedWinners.length * pointsPerWinner
            }
        });

    } catch (error) {
        console.error('보상 지급 오류:', error);
        res.json({ 
            success: false, 
            message: '보상 지급 중 오류가 발생했습니다.' 
        });
    }
});

module.exports = router; 