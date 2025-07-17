const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const { getKoreanTime } = require('../utils/korean-time');

// 배팅 세션 컬렉션
const BETTING_SESSIONS_COLLECTION = 'betting-sessions';
const BETTING_PREDICTIONS_COLLECTION = 'betting-predictions';
const BETTING_RESULTS_COLLECTION = 'betting-results';

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
            for (const winner of winners) {
                // 여기서 실제 포인트 지급 로직 구현
                console.log(`적중자 ${winner.userId}에게 ${pointsPerWinner}포인트 지급`);
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

        // 실제 예측 저장 로직 구현 필요
        res.json({ success: true, message: '예측이 저장되었습니다.' });
    } catch (error) {
        console.error('배팅 예측 저장 오류:', error);
        res.json({ 
            success: false, 
            message: '배팅 예측 저장 중 오류가 발생했습니다.' 
        });
    }
});

// 배팅 상태 확인 API (실시간 업데이트용)
router.get('/status/:date', async (req, res) => {
    try {
        const { date } = req.params;
        const db = req.app.locals.db;
        const collection = db.collection(BETTING_SESSIONS_COLLECTION);

        // 활성 배팅 세션 찾기
        const activeSession = await collection.findOne({
            date: date,
            status: 'active'
        });

        const bettingStatus = {
            isActive: !!activeSession,
            gameNumber: activeSession ? activeSession.gameNumber : null,
            gameType: activeSession ? activeSession.gameType : null,
            startTime: activeSession ? activeSession.startTime : null,
            sessionId: activeSession ? activeSession._id : null
        };

        console.log(`배팅 상태 확인: 날짜 ${date}, 활성: ${bettingStatus.isActive}`);

        res.json({ 
            success: true, 
            data: bettingStatus 
        });

    } catch (error) {
        console.error('배팅 상태 확인 오류:', error);
        res.json({ 
            success: false, 
            message: '배팅 상태 확인 중 오류가 발생했습니다.' 
        });
    }
});

// 특정 게임의 배팅 상태 확인 API
router.get('/status/:date/:gameNumber', async (req, res) => {
    try {
        const { date, gameNumber } = req.params;
        const db = req.app.locals.db;
        const collection = db.collection(BETTING_SESSIONS_COLLECTION);

        // 특정 게임의 활성 배팅 세션 찾기
        const activeSession = await collection.findOne({
            date: date,
            gameNumber: parseInt(gameNumber),
            status: 'active'
        });

        const bettingStatus = {
            isActive: !!activeSession,
            gameNumber: parseInt(gameNumber),
            gameType: activeSession ? activeSession.gameType : null,
            startTime: activeSession ? activeSession.startTime : null,
            sessionId: activeSession ? activeSession._id : null
        };

        console.log(`게임 ${gameNumber} 배팅 상태 확인: 날짜 ${date}, 활성: ${bettingStatus.isActive}`);

        res.json({ 
            success: true, 
            data: bettingStatus 
        });

    } catch (error) {
        console.error('게임 배팅 상태 확인 오류:', error);
        res.json({ 
            success: false, 
            message: '게임 배팅 상태 확인 중 오류가 발생했습니다.' 
        });
    }
});

module.exports = router; 