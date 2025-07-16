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

module.exports = router; 