const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const { getKoreanTime } = require('../utils/korean-time');

// 경기별 배팅 컬렉션 생성 함수
function getGameCollection(gameNumber) {
    return `betting-game-${gameNumber}`;
}

// 경기별 통계 컬렉션 생성 함수
function getGameStatsCollection(gameNumber) {
    return `game-stats-${gameNumber}`;
}

// 배팅 세션 컬렉션
const BETTING_SESSIONS_COLLECTION = 'betting-sessions';
const BETTING_PREDICTIONS_COLLECTION = 'betting-predictions';
const BETTING_RESULTS_COLLECTION = 'betting-results';
const BETTING_SYSTEM_COLLECTION = 'betting-system';



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



        // 배팅 세션 확인
        const sessionsCollection = db.collection(BETTING_SESSIONS_COLLECTION);
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
        const memberCollection = db.collection('game-member');
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
        const predictionsCollection = db.collection(BETTING_PREDICTIONS_COLLECTION);
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
            memberId: userId,
            memberName: member.name || member.username, // 회원 이름 추가
            prediction: prediction,
            points: points,
            gameNumber: bettingSession.gameNumber,
            date: bettingSession.date,
            betTime: getKoreanTime(), // 배팅 시간 추가
            status: 'active', // 배팅 상태 추가
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
        const pointHistoryCollection = db.collection('point-history');
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

// 경기별 배팅 예측 제출 API (경기별 컬렉션 사용)
router.post('/submit-game-prediction', async (req, res) => {
    try {
        const { 
            gameNumber, 
            userId, 
            userName, 
            prediction, 
            date 
        } = req.body;
        
        // 고정 배팅 포인트 100
        const points = 100;
        
        if (!gameNumber || !userId || !userName || !prediction || !date) {
            return res.json({ 
                success: false, 
                message: '필수 정보가 누락되었습니다.' 
            });
        }

        const db = req.app.locals.db;
        const gameCollection = db.collection(getGameCollection(gameNumber));

        // 동일한 경기에 대한 중복 배팅 확인
        const existingPrediction = await gameCollection.findOne({
            userId: userId,
            date: date
        });

        if (existingPrediction) {
            return res.json({ 
                success: false, 
                message: '이미 해당 경기에 배팅하셨습니다.' 
            });
        }

        // 새로운 예측 데이터 생성
        const predictionData = {
            userId: userId,
            userName: userName,
            prediction: prediction,
            points: parseInt(points),
            date: date,
            status: 'pending', // pending, won, lost
            betTime: new Date(),
            createdAt: new Date(),
            updatedAt: new Date()
        };

        await gameCollection.insertOne(predictionData);

        console.log(`배팅 예측 저장: 경기${gameNumber}, 사용자 ${userName}, 예측: ${prediction}, 포인트: ${points}`);

        res.json({ 
            success: true, 
            message: '배팅이 성공적으로 제출되었습니다.',
            predictionId: predictionData._id,
            data: predictionData
        });

    } catch (error) {
        console.error('배팅 예측 제출 오류:', error);
        res.json({ 
            success: false, 
            message: '배팅 제출 중 오류가 발생했습니다.' 
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

// 오늘의 배팅 데이터 조회 API
router.get('/today-bets/:date', async (req, res) => {
    try {
        const { date } = req.params;
        console.log('[Betting] 오늘 배팅 데이터 조회:', date);
        
        const db = req.app.locals.db;
        const collection = db.collection('betting-predictions');
        
        // 오늘의 배팅 데이터 조회
        const bets = await collection.find({ 
            date: date 
        }).sort({ createdAt: -1 }).toArray();
        
        // 회원 정보와 함께 조회
        const memberCollection = db.collection('game-member');
        const betsWithMemberInfo = await Promise.all(bets.map(async (bet) => {
            const member = await memberCollection.findOne({ _id: bet.memberId });
            return {
                ...bet,
                memberName: member ? member.name : '알 수 없음',
                memberId: member ? member.memberId : bet.memberId
            };
        }));

        res.json({
            success: true,
            data: betsWithMemberInfo
        });

    } catch (error) {
        console.error('[Betting] 오늘 배팅 데이터 조회 오류:', error);
        res.status(500).json({
            success: false,
            message: '배팅 데이터 조회에 실패했습니다.',
            error: error.message
        });
    }
});

// 경기별 배팅 통계 API (경기별 컬렉션 사용)
router.get('/game-stats/:gameNumber/:date', async (req, res) => {
    try {
        const { gameNumber, date } = req.params;
        const db = req.app.locals.db;
        const gameCollection = db.collection(getGameCollection(gameNumber));
        const teamGamesCollection = db.collection('team-games');

        // 해당 경기 정보 조회
        const gameInfo = await teamGamesCollection.findOne({ 
            gameNumber: parseInt(gameNumber),
            date: date 
        });

        if (!gameInfo) {
            return res.json({
                success: false,
                message: '해당 경기 정보를 찾을 수 없습니다.'
            });
        }

        // 해당 경기의 모든 배팅 조회
        const predictions = await gameCollection.find({ date: date }).toArray();

        const totalBettors = predictions.length;
        const totalPoints = predictions.reduce((sum, pred) => sum + pred.points, 0);
        
        // 예측별 분포 계산
        const predictionCounts = {};
        predictions.forEach(pred => {
            predictionCounts[pred.prediction] = (predictionCounts[pred.prediction] || 0) + 1;
        });

        // 승리자 수 계산 (결과가 있는 경우)
        const winners = predictions.filter(pred => 
            gameInfo.result && pred.prediction === gameInfo.result
        ).length;

        const result = {
            gameNumber: parseInt(gameNumber),
            matchup: gameInfo.matchup || '매치업 없음',
            status: gameInfo.status || '경기중',
            result: gameInfo.result || '-',
            totalBettors: totalBettors,
            totalPoints: totalPoints,
            winners: winners,
            predictionCounts: predictionCounts,
            predictions: predictions,
            winRate: totalBettors > 0 ? ((winners / totalBettors) * 100).toFixed(1) : 0
        };

        res.json({
            success: true,
            data: result
        });

    } catch (error) {
        console.error('경기별 배팅 통계 조회 오류:', error);
        res.json({ 
            success: false, 
            message: '통계 조회 중 오류가 발생했습니다.' 
        });
    }
});

// 모든 경기 배팅 통계 API
router.get('/all-games-stats/:date', async (req, res) => {
    try {
        const { date } = req.params;
        const db = req.app.locals.db;
        const teamGamesCollection = db.collection('team-games');

        // 해당 날짜의 모든 경기 조회
        const games = await teamGamesCollection.find({ date: date }).toArray();
        
        // 각 경기별 통계 계산
        const allGamesStats = await Promise.all(games.map(async (game) => {
            const gameCollection = db.collection(getGameCollection(game.gameNumber));
            const predictions = await gameCollection.find({ date: date }).toArray();

            const totalBettors = predictions.length;
            const totalPoints = predictions.reduce((sum, pred) => sum + pred.points, 0);
            
            // 예측별 분포 계산
            const predictionCounts = {};
            predictions.forEach(pred => {
                predictionCounts[pred.prediction] = (predictionCounts[pred.prediction] || 0) + 1;
            });

            // 승리자 수 계산
            const winners = predictions.filter(pred => 
                game.result && pred.prediction === game.result
            ).length;

            return {
                gameNumber: game.gameNumber,
                matchup: game.matchup || '매치업 없음',
                status: game.status || '경기중',
                result: game.result || '-',
                totalBettors: totalBettors,
                totalPoints: totalPoints,
                winners: winners,
                predictionCounts: predictionCounts,
                winRate: totalBettors > 0 ? ((winners / totalBettors) * 100).toFixed(1) : 0
            };
        }));

        res.json({
            success: true,
            data: allGamesStats
        });

    } catch (error) {
        console.error('모든 경기 배팅 통계 조회 오류:', error);
        res.json({ 
            success: false, 
            message: '통계 조회 중 오류가 발생했습니다.' 
        });
    }
});

// 경기별 승리자 계산 API (경기별 컬렉션 사용)
router.post('/calculate-game-winners', async (req, res) => {
    try {
        const { gameNumber, actualResult, date } = req.body;
        
        if (!gameNumber || !actualResult || !date) {
            return res.json({ 
                success: false, 
                message: '필수 정보가 누락되었습니다.' 
            });
        }

        const db = req.app.locals.db;
        const gameCollection = db.collection(getGameCollection(gameNumber));

        // 해당 경기의 모든 배팅 조회
        const predictions = await gameCollection.find({ date: date }).toArray();

        if (predictions.length === 0) {
            return res.json({ 
                success: false, 
                message: '해당 경기의 배팅 데이터가 없습니다.' 
            });
        }

        // 승리자와 실패자 분류
        const winners = predictions.filter(pred => pred.prediction === actualResult);
        const losers = predictions.filter(pred => pred.prediction !== actualResult);

        // 포인트 계산
        const totalLoserPoints = losers.reduce((sum, pred) => sum + pred.points, 0);
        const pointsPerWinner = winners.length > 0 ? Math.floor(totalLoserPoints / winners.length) : 0;

        // 상태 업데이트
        if (winners.length > 0) {
            await gameCollection.updateMany(
                { 
                    date: date,
                    prediction: actualResult 
                },
                { 
                    $set: { 
                        status: 'won',
                        distributedPoints: pointsPerWinner,
                        updatedAt: new Date()
                    } 
                }
            );
        }

        if (losers.length > 0) {
            await gameCollection.updateMany(
                { 
                    date: date,
                    prediction: { $ne: actualResult } 
                },
                { 
                    $set: { 
                        status: 'lost',
                        distributedPoints: 0,
                        updatedAt: new Date()
                    } 
                }
            );
        }

        // 결과 저장
        const result = {
            gameNumber: parseInt(gameNumber),
            actualResult: actualResult,
            date: date,
            totalBettors: predictions.length,
            totalPoints: predictions.reduce((sum, pred) => sum + pred.points, 0),
            winners: winners.map(w => ({
                userId: w.userId,
                userName: w.userName,
                points: w.points,
                distributedPoints: pointsPerWinner
            })),
            losers: losers.map(l => ({
                userId: l.userId,
                userName: l.userName,
                points: l.points
            })),
            totalLoserPoints: totalLoserPoints,
            pointsPerWinner: pointsPerWinner,
            totalDistributed: pointsPerWinner * winners.length,
            winRate: predictions.length > 0 ? ((winners.length / predictions.length) * 100).toFixed(1) : 0,
            calculatedAt: new Date()
        };

        res.json({
            success: true,
            message: '경기별 승리자 계산이 완료되었습니다.',
            data: result
        });

    } catch (error) {
        console.error('경기별 승리자 계산 오류:', error);
        res.json({ 
            success: false, 
            message: '승리자 계산 중 오류가 발생했습니다.' 
        });
    }
});

// 배팅 시스템 초기화 API
router.post('/initialize-system', async (req, res) => {
    try {
        const db = req.app.locals.db;
        
        // 배팅 시스템 활성화
        const systemCollection = db.collection(BETTING_SYSTEM_COLLECTION);
        await systemCollection.updateOne(
            { _id: 'system' },
            { 
                $set: { 
                    isActive: true,
                    updatedAt: getKoreanTime()
                }
            },
            { upsert: true }
        );

        // betting-predictions 컬렉션 자동 생성 (더미 데이터로 초기화)
        const predictionsCollection = db.collection(BETTING_PREDICTIONS_COLLECTION);
        const dummyPrediction = {
            memberId: 'system-init',
            memberName: '시스템',
            gameNumber: 1,
            prediction: 'home',
            points: 0,
            betTime: new Date(),
            createdAt: new Date(),
            status: 'dummy'
        };
        
        // 컬렉션이 비어있는지 확인하고 더미 데이터 삽입
        const existingPredictions = await predictionsCollection.countDocuments();
        if (existingPredictions === 0) {
            await predictionsCollection.insertOne(dummyPrediction);
            console.log('betting-predictions 컬렉션이 생성되었습니다.');
        }

        // 오늘 날짜
        const today = new Date().toISOString().split('T')[0];

        // 각 경기별 배팅 세션 생성
        const sessionsCollection = db.collection(BETTING_SESSIONS_COLLECTION);
        const sessions = [];
        
        for (let gameNumber = 1; gameNumber <= 5; gameNumber++) {
            const session = {
                gameNumber: gameNumber,
                gameType: 'baseball',
                date: today,
                status: 'active',
                startTime: new Date(),
                createdAt: new Date(),
                updatedAt: getKoreanTime()
            };
            
            await sessionsCollection.insertOne(session);
            sessions.push(session);
        }

        console.log(`배팅 시스템 초기화 완료: ${sessions.length}개 세션 생성`);

        res.json({ 
            success: true, 
            message: '배팅 시스템이 초기화되었습니다. (betting-predictions 컬렉션 생성됨)',
            sessions: sessions
        });

    } catch (error) {
        console.error('배팅 시스템 초기화 오류:', error);
        res.json({ 
            success: false, 
            message: '배팅 시스템 초기화 중 오류가 발생했습니다.' 
        });
    }
});

// 경기별 컬렉션 초기화 API
router.post('/initialize-game-collections', async (req, res) => {
    try {
        const db = req.app.locals.db;
        const today = new Date().toISOString().split('T')[0];
        
        // 각 경기별 컬렉션 생성 (더미 데이터로 초기화)
        const gameCollections = [];
        
        for (let gameNumber = 1; gameNumber <= 5; gameNumber++) {
            const collectionName = getGameCollection(gameNumber);
            const gameCollection = db.collection(collectionName);
            
            // 더미 데이터 생성
            const dummyData = {
                userId: 'system-init',
                userName: '시스템',
                prediction: 'home',
                points: 0,
                date: today,
                status: 'dummy',
                betTime: new Date(),
                createdAt: new Date(),
                updatedAt: new Date()
            };
            
            // 컬렉션이 비어있는지 확인하고 더미 데이터 삽입
            const existingData = await gameCollection.countDocuments();
            if (existingData === 0) {
                await gameCollection.insertOne(dummyData);
                console.log(`${collectionName} 컬렉션이 생성되었습니다.`);
            }
            
            gameCollections.push(collectionName);
        }

        console.log('모든 경기별 컬렉션이 초기화되었습니다.');

        res.json({ 
            success: true, 
            message: '경기별 컬렉션이 초기화되었습니다.',
            collections: gameCollections
        });

    } catch (error) {
        console.error('경기별 컬렉션 초기화 오류:', error);
        res.json({ 
            success: false, 
            message: '컬렉션 초기화 중 오류가 발생했습니다.' 
        });
    }
});

// 경기별 테스트 데이터 생성 API
router.post('/create-game-test-data', async (req, res) => {
    try {
        const { gameNumber } = req.body;
        const db = req.app.locals.db;
        const gameCollection = db.collection(getGameCollection(gameNumber));
        const today = new Date().toISOString().split('T')[0];
        
        // 기존 더미 데이터 삭제
        await gameCollection.deleteMany({ userId: 'system-init' });
        
        // 테스트 배팅 데이터 생성
        const testPredictions = [
            {
                userId: 'test-user-1',
                userName: '테스트회원1',
                prediction: 'home',
                points: 1000,
                date: today,
                status: 'pending',
                betTime: new Date(),
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                userId: 'test-user-2',
                userName: '테스트회원2',
                prediction: 'away',
                points: 2000,
                date: today,
                status: 'pending',
                betTime: new Date(),
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                userId: 'test-user-3',
                userName: '테스트회원3',
                prediction: 'home',
                points: 1500,
                date: today,
                status: 'pending',
                betTime: new Date(),
                createdAt: new Date(),
                updatedAt: new Date()
            }
        ];
        
        await gameCollection.insertMany(testPredictions);
        
        console.log(`경기${gameNumber} 테스트 배팅 데이터 ${testPredictions.length}개가 생성되었습니다.`);
        
        res.json({
            success: true,
            message: `경기${gameNumber} 테스트 배팅 데이터가 생성되었습니다.`,
            gameNumber: gameNumber,
            count: testPredictions.length
        });
        
    } catch (error) {
        console.error('경기별 테스트 데이터 생성 오류:', error);
        res.json({
            success: false,
            message: '테스트 데이터 생성 중 오류가 발생했습니다.'
        });
    }
});

// 배팅 시스템 상태 확인 및 활성화 API
router.get('/system-status', async (req, res) => {
    try {
        const db = req.app.locals.db;
        const today = new Date().toISOString().split('T')[0];
        
        // 배팅 시스템 상태 확인
        const systemCollection = db.collection(BETTING_SYSTEM_COLLECTION);
        const systemStatus = await systemCollection.findOne({ _id: 'system' });
        
        // 활성 배팅 세션 확인
        const sessionsCollection = db.collection(BETTING_SESSIONS_COLLECTION);
        const activeSessions = await sessionsCollection.find({
            date: today,
            status: 'active'
        }).toArray();

        // 배팅 예측 데이터 확인
        const predictionsCollection = db.collection(BETTING_PREDICTIONS_COLLECTION);
        const todayPredictions = await predictionsCollection.find({
            date: today
        }).toArray();

        res.json({
            success: true,
            data: {
                systemActive: systemStatus ? systemStatus.isActive : false,
                activeSessions: activeSessions,
                totalSessions: activeSessions.length,
                totalPredictions: todayPredictions.length,
                predictions: todayPredictions
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

// 배팅 시스템 활성화 API
router.post('/activate-system', async (req, res) => {
    try {
        const db = req.app.locals.db;
        const today = new Date().toISOString().split('T')[0];
        
        // 배팅 시스템 활성화
        const systemCollection = db.collection(BETTING_SYSTEM_COLLECTION);
        await systemCollection.updateOne(
            { _id: 'system' },
            { 
                $set: { 
                    isActive: true,
                    updatedAt: getKoreanTime()
                }
            },
            { upsert: true }
        );

        // 1경기 배팅 세션 생성 (이미 5명이 배팅했다고 하니)
        const sessionsCollection = db.collection(BETTING_SESSIONS_COLLECTION);
        const existingSession = await sessionsCollection.findOne({
            gameNumber: 1,
            date: today,
            status: 'active'
        });

        if (!existingSession) {
            const session = {
                gameNumber: 1,
                gameType: 'baseball',
                date: today,
                status: 'active',
                startTime: new Date(),
                createdAt: new Date(),
                updatedAt: getKoreanTime()
            };
            
            await sessionsCollection.insertOne(session);
            console.log('1경기 배팅 세션 생성 완료');
        }

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

// 경기별 통계 저장 API
router.post('/save-game-stats', async (req, res) => {
    try {
        const { 
            gameNumber, 
            date, 
            matchup, 
            predictionResult, 
            totalBettors, 
            winners, 
            winRate 
        } = req.body;
        
        if (!gameNumber || !date || !matchup) {
            return res.json({ 
                success: false, 
                message: '필수 정보가 누락되었습니다.' 
            });
        }

        const db = req.app.locals.db;
        const statsCollection = db.collection(getGameStatsCollection(gameNumber));

        // 기존 통계 데이터 확인
        const existingStats = await statsCollection.findOne({
            date: date
        });

        const statsData = {
            gameNumber: parseInt(gameNumber),
            date: date,
            matchup: matchup,
            predictionResult: predictionResult || '-',
            totalBettors: totalBettors || 0,
            totalPoints: (totalBettors || 0) * 100, // 고정 배팅 포인트 100
            winners: winners || 0,
            winRate: winRate || 0,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        if (existingStats) {
            // 기존 데이터 업데이트
            await statsCollection.updateOne(
                { date: date },
                { 
                    $set: {
                        ...statsData,
                        updatedAt: new Date()
                    }
                }
            );
            console.log(`경기${gameNumber} 통계 업데이트: ${date}`);
        } else {
            // 새로운 통계 데이터 생성
            await statsCollection.insertOne(statsData);
            console.log(`경기${gameNumber} 통계 생성: ${date}`);
        }

        res.json({ 
            success: true, 
            message: '경기별 통계가 저장되었습니다.',
            data: statsData
        });

    } catch (error) {
        console.error('경기별 통계 저장 오류:', error);
        res.json({ 
            success: false, 
            message: '통계 저장 중 오류가 발생했습니다.' 
        });
    }
});

// 경기별 통계 조회 API
router.get('/game-stats/:gameNumber/:date', async (req, res) => {
    try {
        const { gameNumber, date } = req.params;
        const db = req.app.locals.db;
        const statsCollection = db.collection(getGameStatsCollection(gameNumber));

        const stats = await statsCollection.findOne({ date: date });

        if (!stats) {
            return res.json({
                success: false,
                message: '해당 날짜의 경기 통계를 찾을 수 없습니다.'
            });
        }

        res.json({
            success: true,
            data: stats
        });

    } catch (error) {
        console.error('경기별 통계 조회 오류:', error);
        res.json({ 
            success: false, 
            message: '통계 조회 중 오류가 발생했습니다.' 
        });
    }
});

// 모든 경기 통계 조회 API
router.get('/all-games-stats/:date', async (req, res) => {
    try {
        const { date } = req.params;
        const db = req.app.locals.db;
        
        const allStats = [];
        
        // 각 경기별 통계 조회
        for (let gameNumber = 1; gameNumber <= 5; gameNumber++) {
            const statsCollection = db.collection(getGameStatsCollection(gameNumber));
            const stats = await statsCollection.findOne({ date: date });
            
            if (stats) {
                allStats.push(stats);
            } else {
                // 통계가 없는 경우 기본 데이터 생성
                allStats.push({
                    gameNumber: gameNumber,
                    date: date,
                    matchup: '매치업 없음',
                    predictionResult: '-',
                    totalBettors: 0,
                    winners: 0,
                    winRate: 0
                });
            }
        }

        res.json({
            success: true,
            data: allStats
        });

    } catch (error) {
        console.error('모든 경기 통계 조회 오류:', error);
        res.json({ 
            success: false, 
            message: '통계 조회 중 오류가 발생했습니다.' 
        });
    }
});

// 경기별 승리자 계산 후 통계 자동 저장
router.post('/calculate-and-save-game-stats', async (req, res) => {
    try {
        const { gameNumber, actualResult, date } = req.body;
        
        if (!gameNumber || !actualResult || !date) {
            return res.json({ 
                success: false, 
                message: '필수 정보가 누락되었습니다.' 
            });
        }

        const db = req.app.locals.db;
        const gameCollection = db.collection(getGameCollection(gameNumber));
        const teamGamesCollection = db.collection('team-games');

        // 해당 경기 정보 조회
        const gameInfo = await teamGamesCollection.findOne({ 
            gameNumber: parseInt(gameNumber),
            date: date 
        });

        if (!gameInfo) {
            return res.json({ 
                success: false, 
                message: '해당 경기 정보를 찾을 수 없습니다.' 
            });
        }

        // 해당 경기의 모든 배팅 조회
        const predictions = await gameCollection.find({ date: date }).toArray();

        const totalBettors = predictions.length;
        const winners = predictions.filter(pred => pred.prediction === actualResult).length;
        const winRate = totalBettors > 0 ? ((winners / totalBettors) * 100).toFixed(1) : 0;

        // 통계 데이터 생성
        const statsData = {
            gameNumber: parseInt(gameNumber),
            date: date,
            matchup: gameInfo.matchup || '매치업 없음',
            predictionResult: actualResult,
            totalBettors: totalBettors,
            totalPoints: totalBettors * 100, // 고정 배팅 포인트 100
            winners: winners,
            winRate: parseFloat(winRate),
            createdAt: new Date(),
            updatedAt: new Date()
        };

        // 통계 저장
        const statsCollection = db.collection(getGameStatsCollection(gameNumber));
        const existingStats = await statsCollection.findOne({ date: date });

        if (existingStats) {
            await statsCollection.updateOne(
                { date: date },
                { 
                    $set: {
                        ...statsData,
                        updatedAt: new Date()
                    }
                }
            );
        } else {
            await statsCollection.insertOne(statsData);
        }

        console.log(`경기${gameNumber} 통계 저장 완료: 배팅자 ${totalBettors}명, 승리자 ${winners}명, 승률 ${winRate}%`);

        res.json({
            success: true,
            message: '경기별 승리자 계산 및 통계 저장이 완료되었습니다.',
            data: statsData
        });

    } catch (error) {
        console.error('경기별 승리자 계산 및 통계 저장 오류:', error);
        res.json({ 
            success: false, 
            message: '계산 및 저장 중 오류가 발생했습니다.' 
        });
    }
});

// 경기별 통계 컬렉션 초기화 API
router.post('/initialize-game-stats-collections', async (req, res) => {
    try {
        const db = req.app.locals.db;
        const today = new Date().toISOString().split('T')[0];
        
        // 각 경기별 통계 컬렉션 생성
        const statsCollections = [];
        
        for (let gameNumber = 1; gameNumber <= 5; gameNumber++) {
            const collectionName = getGameStatsCollection(gameNumber);
            const statsCollection = db.collection(collectionName);
            
            // 더미 데이터 생성
            const dummyStats = {
                gameNumber: gameNumber,
                date: today,
                matchup: '매치업 없음',
                predictionResult: '-',
                totalBettors: 0,
                totalPoints: 0, // 고정 배팅 포인트 100
                winners: 0,
                winRate: 0,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            
            // 컬렉션이 비어있는지 확인하고 더미 데이터 삽입
            const existingStats = await statsCollection.countDocuments();
            if (existingStats === 0) {
                await statsCollection.insertOne(dummyStats);
                console.log(`${collectionName} 통계 컬렉션이 생성되었습니다.`);
            }
            
            statsCollections.push(collectionName);
        }

        console.log('모든 경기별 통계 컬렉션이 초기화되었습니다.');

        res.json({ 
            success: true, 
            message: '경기별 통계 컬렉션이 초기화되었습니다.',
            collections: statsCollections
        });

    } catch (error) {
        console.error('경기별 통계 컬렉션 초기화 오류:', error);
        res.json({ 
            success: false, 
            message: '통계 컬렉션 초기화 중 오류가 발생했습니다.' 
        });
    }
});

module.exports = router; 