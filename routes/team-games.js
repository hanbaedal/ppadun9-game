const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const { getDb } = require('../config/db');
const { getKoreanTime } = require('../utils/korean-time');

// team-games 콜렉션에서 데이터 조회
router.get('/:date', async (req, res) => {
    try {
        console.log('[TeamGames] GET 요청 받음, 날짜:', req.params.date);
        const db = getDb();
        const collection = db.collection('team-games');
        
        const { date } = req.params;
        
        const games = await collection.find({ date }).toArray();
        
        console.log('[TeamGames] 조회 결과:', games.length, '개');
        if (games.length > 0) {
            console.log('[TeamGames] 첫 번째 경기 데이터:', games[0]);
        }
        
        res.json({
            success: true,
            data: games
        });
    } catch (error) {
        console.error('[TeamGames] 데이터 조회 오류:', error);
        res.status(500).json({
            success: false,
            message: '데이터 조회에 실패했습니다.',
            error: error.message
        });
    }
});

// daily-games에서 데이터를 가져와서 team-games 형식으로 변환하여 저장
router.post('/import-from-daily/:date', async (req, res) => {
    try {
        console.log('[TeamGames] daily-games에서 데이터 가져오기 요청:', req.params.date);
        const db = getDb();
        const dailyCollection = db.collection('daily-games');
        const teamCollection = db.collection('team-games');
        
        const { date } = req.params;
        
        // daily-games에서 데이터 조회 (날짜 형식 변환)
        const dailyDate = date.replace(/-/g, ''); // 하이픈 제거
        console.log('[TeamGames] daily-games 조회 날짜:', dailyDate);
        const dailyGames = await dailyCollection.findOne({ date: dailyDate });
        
        if (!dailyGames || !dailyGames.games) {
            return res.status(404).json({
                success: false,
                message: '해당 날짜의 daily-games 데이터를 찾을 수 없습니다.'
            });
        }
        
        console.log('[TeamGames] daily-games 데이터 발견:', dailyGames.games.length, '개 경기');
        
        // 기존 team-games 데이터 삭제
        await teamCollection.deleteMany({ date });
        
        // 새로운 형식으로 데이터 변환 및 저장
        const teamGames = dailyGames.games.map(game => ({
            date: date,
            gameNumber: game.number,
            matchup: `${game.homeTeam || '-'} vs ${game.awayTeam || '-'}`,
            startTime: game.startTime || '-',
            endTime: game.endTime || '-',
            gameStatus: game.noGame || '정상게임',
            progressStatus: '경기전', // 초기값, 시간에 따라 업데이트됨
            gameType: '타자', // 고정값
            bettingStart: '중지', // 초기값
            bettingStop: '중지', // 초기값
            predictionResult: '', // 빈값으로 시작
            createdAt: getKoreanTime(),
            updatedAt: getKoreanTime()
        }));
        
        // 데이터 저장
        if (teamGames.length > 0) {
            console.log('[TeamGames] team-games에 저장 시작:', teamGames.length, '개');
            const insertResult = await teamCollection.insertMany(teamGames);
            console.log('[TeamGames] 저장 결과:', insertResult);
        }
        
        console.log('[TeamGames] 데이터 변환 및 저장 완료:', teamGames.length, '개');
        
        res.json({
            success: true,
            message: 'daily-games에서 데이터를 가져와서 team-games에 저장했습니다.',
            data: teamGames
        });
    } catch (error) {
        console.error('[TeamGames] 데이터 가져오기 오류:', error);
        res.status(500).json({
            success: false,
            message: '데이터 가져오기에 실패했습니다.',
            error: error.message
        });
    }
});

// 특정 경기 데이터 업데이트
router.put('/:date/:gameNumber', async (req, res) => {
    try {
        const db = getDb();
        const collection = db.collection('team-games');
        
        const { date, gameNumber } = req.params;
        const updateData = req.body;
        
        // updatedAt 필드 추가
        updateData.updatedAt = getKoreanTime();
        
        const result = await collection.findOneAndUpdate(
            { date, gameNumber: parseInt(gameNumber) },
            { $set: updateData },
            { returnDocument: 'after' }
        );
        
        if (!result.value) {
            return res.status(404).json({
                success: false,
                message: '해당 경기를 찾을 수 없습니다.'
            });
        }
        
        res.json({
            success: true,
            message: '경기 데이터가 업데이트되었습니다.',
            data: result.value
        });
    } catch (error) {
        console.error('[TeamGames] 경기 업데이트 오류:', error);
        res.status(500).json({
            success: false,
            message: '경기 업데이트에 실패했습니다.',
            error: error.message
        });
    }
});

// 배팅 시작/중지 업데이트
router.put('/:date/:gameNumber/betting', async (req, res) => {
    try {
        const db = getDb();
        const collection = db.collection('team-games');
        
        const { date, gameNumber } = req.params;
        const { action } = req.body; // 'start' 또는 'stop'
        
        const updateData = {
            updatedAt: getKoreanTime()
        };
        
        if (action === 'start') {
            updateData.bettingStart = '시작';
            updateData.bettingStop = '중지';
        } else if (action === 'stop') {
            updateData.bettingStart = '중지';
            updateData.bettingStop = '중지';
        }
        
        const result = await collection.findOneAndUpdate(
            { date, gameNumber: parseInt(gameNumber) },
            { $set: updateData },
            { returnDocument: 'after' }
        );
        
        if (!result.value) {
            return res.status(404).json({
                success: false,
                message: '해당 경기를 찾을 수 없습니다.'
            });
        }
        
        res.json({
            success: true,
            message: `배팅이 ${action === 'start' ? '시작' : '중지'}되었습니다.`,
            data: result.value
        });
    } catch (error) {
        console.error('[TeamGames] 배팅 상태 업데이트 오류:', error);
        res.status(500).json({
            success: false,
            message: '배팅 상태 업데이트에 실패했습니다.',
            error: error.message
        });
    }
});

// 예측 결과 업데이트
router.put('/:date/:gameNumber/prediction', async (req, res) => {
    try {
        const db = getDb();
        const collection = db.collection('team-games');
        
        const { date, gameNumber } = req.params;
        const { predictionResult } = req.body;
        
        const result = await collection.findOneAndUpdate(
            { date, gameNumber: parseInt(gameNumber) },
            { 
                $set: { 
                    predictionResult,
                    updatedAt: getKoreanTime()
                }
            },
            { returnDocument: 'after' }
        );
        
        if (!result.value) {
            return res.status(404).json({
                success: false,
                message: '해당 경기를 찾을 수 없습니다.'
            });
        }
        
        res.json({
            success: true,
            message: '예측 결과가 업데이트되었습니다.',
            data: result.value
        });
    } catch (error) {
        console.error('[TeamGames] 예측 결과 업데이트 오류:', error);
        res.status(500).json({
            success: false,
            message: '예측 결과 업데이트에 실패했습니다.',
            error: error.message
        });
    }
});

// 진행상태 업데이트 (시간 기반)
router.put('/:date/:gameNumber/progress', async (req, res) => {
    try {
        const db = getDb();
        const collection = db.collection('team-games');
        
        const { date, gameNumber } = req.params;
        const { progressStatus } = req.body;
        
        const result = await collection.findOneAndUpdate(
            { date, gameNumber: parseInt(gameNumber) },
            { 
                $set: { 
                    progressStatus,
                    updatedAt: getKoreanTime()
                }
            },
            { returnDocument: 'after' }
        );
        
        if (!result.value) {
            return res.status(404).json({
                success: false,
                message: '해당 경기를 찾을 수 없습니다.'
            });
        }
        
        res.json({
            success: true,
            message: '진행상태가 업데이트되었습니다.',
            data: result.value
        });
    } catch (error) {
        console.error('[TeamGames] 진행상태 업데이트 오류:', error);
        res.status(500).json({
            success: false,
            message: '진행상태 업데이트에 실패했습니다.',
            error: error.message
        });
    }
});

module.exports = router; 