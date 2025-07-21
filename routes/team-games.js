const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const { getDb } = require('../config/db');
const { getKoreanTime } = require('../utils/korean-time');
const { getGameStatsCollection } = require('../models/game-stats');

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
        
        // daily-games 컬렉션에서 데이터 조회 시도
        const dailyGames = await dailyCollection.findOne({ date: dailyDate });
        console.log('[TeamGames] daily-games 조회 결과:', dailyGames ? '데이터 있음' : '데이터 없음');
        
        if (!dailyGames) {
            console.log('[TeamGames] daily-games 데이터 없음, 빈 게임 데이터 생성');
            // daily-games에 데이터가 없으면 기본 5경기 데이터 생성
            const defaultGames = [];
            for (let i = 1; i <= 5; i++) {
                defaultGames.push({
                    number: i,
                    homeTeam: null,
                    awayTeam: null,
                    startTime: null,
                    endTime: null,
                    noGame: '정상게임'
                });
            }
            
            // team-games에 기본 데이터 저장
            const teamGames = defaultGames.map(game => ({
                date: date,
                gameNumber: game.number,
                matchup: `${game.homeTeam || '-'} vs ${game.awayTeam || '-'}`,
                startTime: game.startTime || '-',
                endTime: game.endTime || '-',
                gameStatus: game.noGame || '정상게임',
                progressStatus: '경기전',
                gameType: '타자',
                bettingStart: '대기',
                bettingStop: '대기',
                predictionResult: '',
                isSelected: false,
                createdAt: getKoreanTime(),
                updatedAt: getKoreanTime()
            }));
            
            // 기존 데이터 삭제 후 새로 저장
            console.log('[TeamGames] 기존 데이터 삭제 시작');
            const deleteResult = await teamCollection.deleteMany({ date });
            console.log('[TeamGames] 기존 데이터 삭제 완료:', deleteResult.deletedCount, '개');
            
            if (teamGames.length > 0) {
                console.log('[TeamGames] 기본 데이터 저장 시작:', teamGames.length, '개');
                const insertResult = await teamCollection.insertMany(teamGames);
                console.log('[TeamGames] 기본 데이터 저장 완료:', insertResult.insertedCount, '개');
                
                // 저장 확인
                const savedGames = await teamCollection.find({ date }).toArray();
                console.log('[TeamGames] 저장 확인:', savedGames.length, '개 저장됨');
                
                return res.json({
                    success: true,
                    message: 'daily-games 데이터가 없어서 기본 경기 데이터를 생성했습니다.',
                    data: savedGames
                });
            }
        }
        
        if (!dailyGames.games || dailyGames.games.length === 0) {
            console.log('[TeamGames] daily-games에 games 배열이 없거나 비어있음');
            return res.status(404).json({
                success: false,
                message: '해당 날짜의daily-games에 경기 데이터가 없습니다.'
            });
        }
        
        console.log('[TeamGames] daily-games 데이터 발견:', dailyGames.games.length, '개 경기');
        
        // 기존 team-games 데이터 삭제
        console.log('[TeamGames] 기존 team-games 데이터 삭제 시작');
        const deleteResult = await teamCollection.deleteMany({ date });
        console.log('[TeamGames] 기존 team-games 데이터 삭제 완료:', deleteResult.deletedCount, '개');
        
        // 새로운 형식으로 데이터 변환 및 저장
        const teamGames = dailyGames.games.map(game => {
            // progressStatus 계산 함수
            function calculateProgressStatus(startTime, endTime) {
                if (!startTime) return '경기전';
                
                const now = new Date();
                const koreanTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
                const currentTime = koreanTime.getHours() * 60 + koreanTime.getMinutes();
                
                let startTimeInMinutes = null;
                let endTimeInMinutes = null;
                
                if (startTime && startTime !== '' && startTime !== '-') {
                    try {
                        const timeParts = startTime.split(':');
                        if (timeParts.length === 2) {
                            const startHour = parseInt(timeParts[0]);
                            const startMinute = parseInt(timeParts[1]);
                            if (!isNaN(startHour) && !isNaN(startMinute)) {
                                startTimeInMinutes = startHour * 60 + startMinute;
                            }
                        }
                    } catch (error) {
                        console.log('[TeamGames] 시작시간 변환 오류:', error);
                        return '경기전';
                    }
                }
                
                if (endTime && endTime !== '' && endTime !== '-') {
                    try {
                        const timeParts = endTime.split(':');
                        if (timeParts.length === 2) {
                            const endHour = parseInt(timeParts[0]);
                            const endMinute = parseInt(timeParts[1]);
                            if (!isNaN(endHour) && !isNaN(endMinute)) {
                                endTimeInMinutes = endHour * 60 + endMinute;
                                if (endTimeInMinutes < startTimeInMinutes) {
                                    endTimeInMinutes += 1440; // 24시간 추가
                                }
                            }
                        }
                    } catch (error) {
                        console.log('[TeamGames] 종료시간 변환 오류:', error);
                        endTimeInMinutes = null;
                    }
                }
                
                if (startTimeInMinutes === null) return '경기전';
                if (currentTime < startTimeInMinutes) return '경기전';
                if (endTimeInMinutes !== null) {
                    if (currentTime >= endTimeInMinutes) return '경기끝';
                    if (currentTime >= startTimeInMinutes && currentTime < endTimeInMinutes) return '경기중';
                }
                if (currentTime >= startTimeInMinutes) return '경기중';
                return '경기전';
            }
            
            return {
                date: date,
                gameNumber: game.number,
                matchup: `${game.homeTeam || '-'} vs ${game.awayTeam || '-'}`,
                startTime: game.startTime || null,  // null 그대로 유지
                endTime: game.endTime || null,      // null 그대로 유지
                gameStatus: game.noGame || '정상게임',
                progressStatus: calculateProgressStatus(game.startTime, game.endTime),
                gameType: '타자', // 고정값
                bettingStart: '대기', // 초기값
                bettingStop: '대기', // 초기값
                predictionResult: '', // 빈값으로 시작
                isSelected: false, // 초기값
                createdAt: getKoreanTime(),
                updatedAt: getKoreanTime()
            };
        });
        
        // 데이터 저장
        if (teamGames.length > 0) {
            console.log('[TeamGames] team-games에 저장 시작:', teamGames.length, '개');
            console.log('[TeamGames] 저장할 데이터 샘플:', teamGames[0]);
            
            const insertResult = await teamCollection.insertMany(teamGames);
            console.log('[TeamGames] 저장 결과:', insertResult.insertedCount, '개 저장됨');
            
            // 저장 확인
            const savedGames = await teamCollection.find({ date }).toArray();
            console.log('[TeamGames] 저장 확인:', savedGames.length, '개 저장됨');
            console.log('[TeamGames] 저장된 첫 번째 데이터:', savedGames[0]);
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

// 오늘 날짜 team-games 자동 생성 엔드포인트
router.post('/create-today', async (req, res) => {
    try {
        console.log('[TeamGames] 오늘 날짜 team-games 자동 생성 요청');
        
        // 한국 시간 기준으로 오늘 날짜 계산
        const now = new Date();
        const koreanTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Seoul"}));
        const today = koreanTime.toISOString().split('T')[0];
        
        console.log('[TeamGames] 생성할 날짜:', today);
        console.log('[TeamGames] 한국 시간:', koreanTime.toLocaleString('ko-KR'));
        
        // import-from-daily 엔드포인트 호출
        const importResponse = await fetch(`${req.protocol}://${req.get('host')}/api/team-games/import-from-daily/${today}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (importResponse.ok) {
            const importResult = await importResponse.json();
            console.log('[TeamGames] 오늘 날짜 team-games 생성 완료');
            
            return res.json({
                success: true,
                message: `오늘 날짜(${today}) team-games 데이터가 생성되었습니다.`,
                data: importResult.data
            });
        } else {
            console.log('[TeamGames] import-from-daily 호출 실패');
            return res.status(500).json({
                success: false,
                message: 'team-games 생성에 실패했습니다.'
            });
        }
    } catch (error) {
        console.error('[TeamGames] 오늘 날짜 생성 오류:', error);
        res.status(500).json({
            success: false,
            message: '오늘 날짜 team-games 생성에 실패했습니다.',
            error: error.message
        });
    }
});

// 데이터베이스 상태 확인 엔드포인트
router.get('/debug/:date', async (req, res) => {
    try {
        const db = getDb();
        const { date } = req.params;
        
        // daily-games 확인
        const dailyDate = date.replace(/-/g, '');
        const dailyCollection = db.collection('daily-games');
        const dailyGames = await dailyCollection.findOne({ date: dailyDate });
        
        // team-games 확인
        const teamCollection = db.collection('team-games');
        const teamGames = await teamCollection.find({ date }).toArray();
        
        res.json({
            success: true,
            debug: {
                requestedDate: date,
                dailyDate: dailyDate,
                dailyGamesExists: !!dailyGames,
                dailyGamesCount: dailyGames?.games?.length || 0,
                teamGamesCount: teamGames.length,
                dailyGamesData: dailyGames,
                teamGamesData: teamGames
            }
        });
    } catch (error) {
        console.error('[TeamGames] 디버그 오류:', error);
        res.status(500).json({
            success: false,
            message: '디버그 정보 조회에 실패했습니다.',
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
        const gameStatsCollection = getGameStatsCollection();
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
        // 예측결과가 확정되면 game-stats에도 upsert
        await gameStatsCollection.updateOne(
            { date, gameNumber: parseInt(gameNumber) },
            { $set: { ...result.value, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
            { upsert: true }
        );
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
        const gameStatsCollection = getGameStatsCollection();
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
        // 진행상태가 '경기끝'일 때만 game-stats에도 upsert
        if (progressStatus === '경기끝') {
            await gameStatsCollection.updateOne(
                { date, gameNumber: parseInt(gameNumber) },
                { $set: { ...result.value, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
                { upsert: true }
            );
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

// 모든 경기의 진행상태를 시간 기준으로 일괄 업데이트
router.put('/:date/progress/update-all', async (req, res) => {
    try {
        console.log('[TeamGames] 모든 경기 진행상태 일괄 업데이트 요청:', req.params.date);
        const db = getDb();
        const collection = db.collection('team-games');
        
        const { date } = req.params;
        
        // 해당 날짜의 모든 경기 조회
        const games = await collection.find({ date }).toArray();
        
        if (games.length === 0) {
            return res.status(404).json({
                success: false,
                message: '해당 날짜의 경기 데이터를 찾을 수 없습니다.'
            });
        }
        
        console.log('[TeamGames] 업데이트할 경기 수:', games.length);
        
        // 진행상태 계산 함수 (서버 버전)
        function calculateGameStatus(startTime, endTime, gameStatus) {
            try {
                console.log(`[CalculateStatus] 진행상태 계산 시작:`, {
                    startTime, endTime, gameStatus
                });
                
                // 경기상황이 '정상게임'이 아니면 '경기취소' 반환
                if (gameStatus && gameStatus !== '정상게임') {
                    console.log(`[CalculateStatus] 경기상황이 정상게임이 아님 → 경기취소`);
                    return '경기취소';
                }
                
                // 한국 시간으로 현재 시간 계산
                const now = new Date();
                const koreanTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
                const currentTime = koreanTime.getHours() * 60 + koreanTime.getMinutes();
                
                console.log(`[CalculateStatus] 시간 정보:`, {
                    utcTime: now.toISOString(),
                    koreanTime: koreanTime.toISOString(),
                    koreanTimeString: koreanTime.toLocaleString('ko-KR', {timeZone: 'Asia/Seoul'}),
                    currentHour: koreanTime.getHours(),
                    currentMinute: koreanTime.getMinutes(),
                    currentTimeInMinutes: currentTime
                });
                
                // 시작시간이 없는 경우
                if (!startTime || startTime === '' || startTime === '-') {
                    console.log(`[CalculateStatus] 시작시간 없음 → 경기전`);
                    return '경기전';
                }
                
                // 시작시간을 분으로 변환
                let startTimeInMinutes = null;
                if (startTime && startTime !== '' && startTime !== '-') {
                    try {
                        const timeParts = startTime.split(':');
                        if (timeParts.length === 2) {
                            const startHour = parseInt(timeParts[0]);
                            const startMinute = parseInt(timeParts[1]);
                            if (!isNaN(startHour) && !isNaN(startMinute)) {
                                startTimeInMinutes = startHour * 60 + startMinute;
                                console.log(`[CalculateStatus] 시작시간 변환:`, {
                                    startTime,
                                    startHour,
                                    startMinute,
                                    startTimeInMinutes
                                });
                            }
                        }
                    } catch (error) {
                        console.log(`[CalculateStatus] 시작시간 변환 오류:`, error);
                        return '경기전';
                    }
                }
                
                // 종료시간을 분으로 변환
                let endTimeInMinutes = null;
                if (endTime && endTime !== '' && endTime !== '-') {
                    try {
                        const timeParts = endTime.split(':');
                        if (timeParts.length === 2) {
                            const endHour = parseInt(timeParts[0]);
                            const endMinute = parseInt(timeParts[1]);
                            if (!isNaN(endHour) && !isNaN(endMinute)) {
                                endTimeInMinutes = endHour * 60 + endMinute;
                                console.log(`[CalculateStatus] 종료시간 변환:`, {
                                    endTime,
                                    endHour,
                                    endMinute,
                                    endTimeInMinutes
                                });
                            }
                        }
                    } catch (error) {
                        console.log(`[CalculateStatus] 종료시간 변환 오류:`, error);
                        endTimeInMinutes = null;
                    }
                }
                
                // 시작시간이 유효하지 않은 경우
                if (startTimeInMinutes === null) {
                    console.log(`[CalculateStatus] 시작시간이 유효하지 않음 → 경기전`);
                    return '경기전';
                }
                
                console.log(`[CalculateStatus] 시간 비교:`, {
                    currentTime,
                    startTimeInMinutes,
                    endTimeInMinutes,
                    currentTimeIsAfterStart: currentTime >= startTimeInMinutes
                });
                
                // 현재시간이 시작시간보다 이전이면 '경기전'
                if (currentTime < startTimeInMinutes) {
                    console.log(`[CalculateStatus] 현재시간 < 시작시간 → 경기전`);
                    return '경기전';
                }
                
                // 종료시간이 있는 경우
                if (endTimeInMinutes !== null) {
                    // 종료시간이 시작시간보다 작은 경우는 다음날로 간주
                    if (endTimeInMinutes < startTimeInMinutes) {
                        endTimeInMinutes += 1440; // 24시간(1440분) 추가
                        console.log(`[CalculateStatus] 종료시간이 다음날로 조정됨:`, endTimeInMinutes);
                    }
                    
                    // 현재시간이 종료시간 이후면 '경기끝'
                    if (currentTime >= endTimeInMinutes) {
                        console.log(`[CalculateStatus] 현재시간 >= 종료시간 → 경기끝`);
                        return '경기끝';
                    }
                    // 시작시간 이후이고 종료시간 이전이면 '경기중'
                    else {
                        console.log(`[CalculateStatus] 시작시간 <= 현재시간 < 종료시간 → 경기중`);
                        return '경기중';
                    }
                }
                // 종료시간이 없는 경우: 시작시간 이후면 '경기중'
                else {
                    console.log(`[CalculateStatus] 종료시간 없음, 시작시간 이후 → 경기중`);
                    return '경기중';
                }
            } catch (error) {
                console.error('[CalculateStatus] 진행상태 계산 오류:', error);
                return '경기전';
            }
        }
        
        const updatePromises = games.map(async (game) => {
            const newProgressStatus = calculateGameStatus(game.startTime, game.endTime, game.gameStatus);
            
            // 종료시간이 지나서 progressStatus가 '경기끝'이면 gameStatus도 '경기끝'으로 자동 업데이트
            let newGameStatus = game.gameStatus;
            if (newProgressStatus === '경기끝') {
                newGameStatus = '경기끝';
            }
            
            console.log(`[TeamGames] ${game.gameNumber}경기 진행상태 업데이트:`, {
                gameNumber: game.gameNumber,
                startTime: game.startTime,
                endTime: game.endTime,
                gameStatus: game.gameStatus,
                oldProgress: game.progressStatus,
                newProgress: newProgressStatus,
                newGameStatus: newGameStatus
            });
            
            // 항상 업데이트 (조건 제거로 더 안정적인 동작)
            try {
                const updateResult = await collection.updateOne(
                    { date, gameNumber: game.gameNumber },
                    { 
                        $set: { 
                            progressStatus: newProgressStatus,
                            gameStatus: newGameStatus,
                            updatedAt: getKoreanTime()
                        }
                    }
                );
                
                console.log(`[TeamGames] ${game.gameNumber}경기 업데이트 결과:`, {
                    matchedCount: updateResult.matchedCount,
                    modifiedCount: updateResult.modifiedCount
                });
                
                return updateResult;
            } catch (error) {
                console.error(`[TeamGames] ${game.gameNumber}경기 업데이트 오류:`, error);
                return null;
            }
        });
        
        const updateResults = await Promise.all(updatePromises);
        const actualUpdates = updateResults.filter(result => result !== null);
        
        console.log('[TeamGames] 진행상태 업데이트 완료:', actualUpdates.length, '개 경기 업데이트됨');
        
        // 업데이트된 데이터 다시 조회
        const updatedGames = await collection.find({ date }).toArray();
        
        res.json({
            success: true,
            message: `${actualUpdates.length}개 경기의 진행상태가 업데이트되었습니다.`,
            data: updatedGames,
            updatedCount: actualUpdates.length
        });
    } catch (error) {
        console.error('[TeamGames] 진행상태 일괄 업데이트 오류:', error);
        res.status(500).json({
            success: false,
            message: '진행상태 일괄 업데이트에 실패했습니다.',
            error: error.message
        });
    }
});

module.exports = router; 