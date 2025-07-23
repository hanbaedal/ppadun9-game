const express = require('express');
const router = express.Router();
const { getDb } = require('../config/db');
const { getKoreanTime } = require('../utils/korean-time');

// 팀 게임 정보 조회
router.get('/:date', async (req, res) => {
    try {
        const { date } = req.params;
        console.log('[Team Game] GET 요청 받음, 날짜:', date);
        
        const db = getDb();
        const collection = db.collection('team-games');
        
        const gameData = await collection.findOne({ date });
        console.log('[Team Game] 조회 결과:', gameData ? '데이터 있음' : '데이터 없음');
        
        res.json({
            success: true,
            data: gameData || { date, games: [] }
        });
    } catch (error) {
        console.error('[Team Game] 게임 정보 조회 오류:', error);
        res.status(500).json({
            success: false,
            message: '게임 정보 조회에 실패했습니다.',
            error: error.message
        });
    }
});

// 팀 게임 정보 저장/수정
router.post('/:date', async (req, res) => {
    try {
        const { date } = req.params;
        const { games } = req.body;
        console.log('[Team Game] POST 요청 받음, 날짜:', date);
        
        if (!games) {
            return res.status(400).json({
                success: false,
                message: '게임 정보가 필요합니다.'
            });
        }

        const db = getDb();
        const collection = db.collection('team-games');
        
        const result = await collection.findOneAndUpdate(
            { date },
            { $set: { date, games, updatedAt: getKoreanTime() } },
            { upsert: true, returnDocument: 'after' }
        );

        console.log('[Team Game] 저장 성공');
        res.json({
            success: true,
            message: '게임 정보가 저장되었습니다.',
            data: result.value
        });
    } catch (error) {
        console.error('[Team Game] 게임 정보 저장 오류:', error);
        res.status(500).json({
            success: false,
            message: '게임 정보 저장에 실패했습니다.',
            error: error.message
        });
    }
});

// 배팅 세션 시작
router.post('/:date/betting/start', async (req, res) => {
    try {
        const { date } = req.params;
        const { gameNumber, gameType } = req.body;
        console.log('[Team Game] 배팅 시작 요청:', { date, gameNumber, gameType });
        
        const db = getDb();
        const collection = db.collection('team-games');
        
        // 배팅 세션 정보 저장
        const bettingSession = {
            date,
            gameNumber,
            gameType,
            startTime: getKoreanTime(),
            status: 'active'
        };
        
        await collection.updateOne(
            { date },
            { 
                $set: { 
                    [`bettingSessions.${gameNumber}`]: bettingSession,
                    updatedAt: getKoreanTime()
                }
            },
            { upsert: true }
        );

        res.json({
            success: true,
            message: '배팅이 시작되었습니다.',
            data: bettingSession
        });
    } catch (error) {
        console.error('[Team Game] 배팅 시작 오류:', error);
        res.status(500).json({
            success: false,
            message: '배팅 시작에 실패했습니다.',
            error: error.message
        });
    }
});

// 배팅 세션 중지
router.post('/:date/betting/stop', async (req, res) => {
    try {
        const { date } = req.params;
        const { gameNumber } = req.body;
        console.log('[Team Game] 배팅 중지 요청:', { date, gameNumber });
        
        const db = getDb();
        const collection = db.collection('team-games');
        
        // 배팅 세션 상태 업데이트
        await collection.updateOne(
            { date },
            { 
                $set: { 
                    [`bettingSessions.${gameNumber}.status`]: 'stopped',
                    [`bettingSessions.${gameNumber}.stopTime`]: getKoreanTime(),
                    updatedAt: getKoreanTime()
                }
            }
        );

        res.json({
            success: true,
            message: '배팅이 중지되었습니다.'
        });
    } catch (error) {
        console.error('[Team Game] 배팅 중지 오류:', error);
        res.status(500).json({
            success: false,
            message: '배팅 중지에 실패했습니다.',
            error: error.message
        });
    }
});

// 예측 결과 저장
router.post('/:date/betting/result', async (req, res) => {
    try {
        const { date } = req.params;
        const { gameNumber, prediction } = req.body;
        console.log('[Team Game] 예측 결과 저장:', { date, gameNumber, prediction });
        
        const db = getDb();
        const collection = db.collection('team-games');
        
        // 예측 결과 저장
        await collection.updateOne(
            { date },
            { 
                $set: { 
                    [`predictions.${gameNumber}`]: {
                        prediction,
                        timestamp: getKoreanTime()
                    },
                    updatedAt: getKoreanTime()
                }
            },
            { upsert: true }
        );

        res.json({
            success: true,
            message: '예측 결과가 저장되었습니다.'
        });
    } catch (error) {
        console.error('[Team Game] 예측 결과 저장 오류:', error);
        res.status(500).json({
            success: false,
            message: '예측 결과 저장에 실패했습니다.',
            error: error.message
        });
    }
});

// daily-games 데이터를 team-games로 복사
router.post('/:date/copy-from-daily', async (req, res) => {
    try {
        const { date } = req.params;
        console.log('[Team Game] daily-games에서 데이터 복사:', date);
        
        const db = getDb();
        const dailyCollection = db.collection('daily-games');
        const teamCollection = db.collection('team-games');
        
        // daily-games에서 데이터 조회
        const dailyData = await dailyCollection.findOne({ date });
        
        if (!dailyData) {
            return res.status(404).json({
                success: false,
                message: '해당 날짜의 daily-games 데이터를 찾을 수 없습니다.'
            });
        }
        
        // team-games에 데이터 저장
        const result = await teamCollection.findOneAndUpdate(
            { date },
            { 
                $set: { 
                    date,
                    games: dailyData.games,
                    updatedAt: getKoreanTime()
                }
            },
            { upsert: true, returnDocument: 'after' }
        );
        
        console.log('[Team Game] 데이터 복사 완료');
        res.json({
            success: true,
            message: 'daily-games 데이터가 team-games로 복사되었습니다.',
            data: result.value
        });
    } catch (error) {
        console.error('[Team Game] 데이터 복사 오류:', error);
        res.status(500).json({
            success: false,
            message: '데이터 복사에 실패했습니다.',
            error: error.message
        });
    }
});

// 경기 시작 API
router.post('/start-game', async (req, res) => {
    try {
        const { gameNumber, date } = req.body;
        console.log('[Team Game] 경기 시작:', { date, gameNumber });
        
        const db = getDb();
        const collection = db.collection('team-games');
        
        // 경기 상태를 시작으로 변경
        await collection.updateOne(
            { date },
            { 
                $set: { 
                    [`games.${gameNumber - 1}.status`]: '진행중',
                    [`games.${gameNumber - 1}.startTime`]: getKoreanTime(),
                    updatedAt: getKoreanTime()
                }
            }
        );

        res.json({
            success: true,
            message: '경기가 시작되었습니다.'
        });
    } catch (error) {
        console.error('[Team Game] 경기 시작 오류:', error);
        res.status(500).json({
            success: false,
            message: '경기 시작에 실패했습니다.',
            error: error.message
        });
    }
});

// 경기 일시정지 API
router.post('/pause-game', async (req, res) => {
    try {
        const { gameNumber, date } = req.body;
        console.log('[Team Game] 경기 일시정지:', { date, gameNumber });
        
        const db = getDb();
        const collection = db.collection('team-games');
        
        // 경기 상태를 일시정지로 변경
        await collection.updateOne(
            { date },
            { 
                $set: { 
                    [`games.${gameNumber - 1}.status`]: '일시정지',
                    [`games.${gameNumber - 1}.pauseTime`]: getKoreanTime(),
                    updatedAt: getKoreanTime()
                }
            }
        );

        res.json({
            success: true,
            message: '경기가 일시정지되었습니다.'
        });
    } catch (error) {
        console.error('[Team Game] 경기 일시정지 오류:', error);
        res.status(500).json({
            success: false,
            message: '경기 일시정지에 실패했습니다.',
            error: error.message
        });
    }
});

// 경기 종료 API
router.post('/end-game', async (req, res) => {
    try {
        const { gameNumber, date } = req.body;
        console.log('[Team Game] 경기 종료:', { date, gameNumber });
        
        const db = getDb();
        const collection = db.collection('team-games');
        
        // 경기 상태를 종료로 변경
        await collection.updateOne(
            { date },
            { 
                $set: { 
                    [`games.${gameNumber - 1}.status`]: '종료',
                    [`games.${gameNumber - 1}.endTime`]: getKoreanTime(),
                    updatedAt: getKoreanTime()
                }
            }
        );

        res.json({
            success: true,
            message: '경기가 종료되었습니다.'
        });
    } catch (error) {
        console.error('[Team Game] 경기 종료 오류:', error);
        res.status(500).json({
            success: false,
            message: '경기 종료에 실패했습니다.',
            error: error.message
        });
    }
});

// 예측 결과 설정 API
router.post('/set-prediction-result', async (req, res) => {
    try {
        const { gameNumber, prediction, date } = req.body;
        console.log('[Team Game] 예측 결과 설정:', { date, gameNumber, prediction });
        
        const db = getDb();
        const collection = db.collection('team-games');
        
        // 예측 결과 설정
        await collection.updateOne(
            { date },
            { 
                $set: { 
                    [`games.${gameNumber - 1}.predictionResult`]: prediction,
                    [`games.${gameNumber - 1}.resultSetTime`]: getKoreanTime(),
                    updatedAt: getKoreanTime()
                }
            }
        );

        res.json({
            success: true,
            message: '예측 결과가 설정되었습니다.'
        });
    } catch (error) {
        console.error('[Team Game] 예측 결과 설정 오류:', error);
        res.status(500).json({
            success: false,
            message: '예측 결과 설정에 실패했습니다.',
            error: error.message
        });
    }
});

// 경기 상태 조회 API
router.get('/game-status/:gameNumber', async (req, res) => {
    try {
        const { gameNumber } = req.params;
        const today = new Date().toISOString().split('T')[0];
        
        const db = getDb();
        const collection = db.collection('team-games');
        
        // 오늘의 경기 데이터 조회
        const data = await collection.findOne({ date: today });
        
        if (!data || !data.games) {
            return res.json({
                success: false,
                message: '경기 데이터를 찾을 수 없습니다.'
            });
        }

        const game = data.games[gameNumber - 1];
        if (!game) {
            return res.json({
                success: false,
                message: '해당 경기를 찾을 수 없습니다.'
            });
        }

        // 배팅 통계 조회
        const bettingCollection = db.collection('betting-predictions');
        const bettingStats = await bettingCollection.aggregate([
            {
                $match: {
                    gameNumber: parseInt(gameNumber),
                    date: today
                }
            },
            {
                $group: {
                    _id: null,
                    bettingCount: { $sum: 1 },
                    totalBettingPoints: { $sum: '$points' }
                }
            }
        ]).toArray();

        const bettingData = bettingStats.length > 0 ? bettingStats[0] : { bettingCount: 0, totalBettingPoints: 0 };

        res.json({
            success: true,
            data: {
                gameNumber: parseInt(gameNumber),
                status: game.status || '대기중',
                startTime: game.startTime,
                endTime: game.endTime,
                predictionResult: game.predictionResult,
                bettingCount: bettingData.bettingCount,
                totalBettingPoints: bettingData.totalBettingPoints
            }
        });
    } catch (error) {
        console.error('[Team Game] 경기 상태 조회 오류:', error);
        res.status(500).json({
            success: false,
            message: '경기 상태 조회에 실패했습니다.',
            error: error.message
        });
    }
});

module.exports = router; 