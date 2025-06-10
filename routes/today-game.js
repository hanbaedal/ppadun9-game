const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

// 게임 스키마 정의
const gameSchema = new mongoose.Schema({
    number: {
        type: Number,
        required: true,
        enum: [1, 2, 3, 4, 5]
    },
    homeTeam: {
        type: String,
        enum: ['두산', 'LG', '기아', '삼성', 'SSG', 'NC', '롯데', '한화', 'KT', '키움'],
        default: null
    },
    awayTeam: {
        type: String,
        enum: ['두산', 'LG', '기아', '삼성', 'SSG', 'NC', '롯데', '한화', 'KT', '키움'],
        default: null
    },
    stadium: {
        type: String,
        enum: ['잠실', '문학', '사직', '대구', '광주', '수원', '창원', '대전', '고척'],
        default: null
    },
    startTime: {
        type: String,
        default: null
    },
    endTime: {
        type: String,
        default: null
    },
    noGame: {
        type: String,
        enum: ['정상게임', '콜드게임', '서스펜디드 게임', '노 게임'],
        default: '정상게임'
    },
    note: {
        type: String,
        default: ''
    }
}, { _id: false });

// 날짜별 게임 스키마 정의
const dailyGameSchema = new mongoose.Schema({
    date: {
        type: String,
        required: true,
        unique: true
    },
    games: [gameSchema]
}, { 
    timestamps: true,
    versionKey: false
});

// 모델 생성
const DailyGame = mongoose.model('DailyGame', dailyGameSchema);

// 오늘의 게임 조회
router.get('/', async (req, res) => {
    try {
        const { date } = req.query;
        
        if (!date) {
            return res.status(400).json({
                success: false,
                message: '날짜가 필요합니다.'
            });
        }

        const dailyGame = await DailyGame.findOne({ date });

        if (!dailyGame) {
            // 게임이 없으면 5개의 빈 행 생성
            const emptyGames = Array.from({ length: 5 }, (_, i) => ({
                number: i + 1,
                homeTeam: null,
                awayTeam: null,
                stadium: null,
                startTime: null,
                endTime: null,
                noGame: '정상게임',
                note: null
            }));
            return res.json({ success: true, games: emptyGames });
        }

        res.json({ success: true, games: dailyGame.games });
    } catch (error) {
        console.error('Error fetching games:', error);
        res.status(500).json({ 
            success: false, 
            message: '게임 데이터를 가져오는데 실패했습니다.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// 오늘의 게임 저장
router.post('/', async (req, res) => {
    try {
        const { date, games } = req.body;

        if (!date || !games || !Array.isArray(games)) {
            return res.status(400).json({
                success: false,
                message: '잘못된 데이터 형식입니다.'
            });
        }

        // 데이터 유효성 검사
        for (const game of games) {
            if (!game.number) {
                return res.status(400).json({
                    success: false,
                    message: '경기 번호가 누락되었습니다.'
                });
            }

            if (game.homeTeam && game.awayTeam && game.homeTeam === game.awayTeam) {
                return res.status(400).json({
                    success: false,
                    message: '같은 팀이 홈/원정에 중복될 수 없습니다.'
                });
            }
        }

        // 기존 데이터 삭제 후 새 데이터 저장
        await DailyGame.deleteOne({ date });
        
        const dailyGame = new DailyGame({
            date,
            games: games.map(game => ({
                number: game.number,
                homeTeam: game.homeTeam || null,
                awayTeam: game.awayTeam || null,
                stadium: game.stadium || null,
                startTime: game.startTime || null,
                endTime: game.endTime || null,
                noGame: game.noGame || '정상게임',
                note: game.note || ''
            }))
        });

        await dailyGame.save();
        
        res.json({
            success: true,
            message: '게임 정보가 저장되었습니다.'
        });
    } catch (error) {
        console.error('Error saving games:', error);
        res.status(500).json({
            success: false,
            message: '서버 오류가 발생했습니다.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// 시작 시간 업데이트
router.post('/start', async (req, res) => {
    try {
        const { date, gameNumber, startTime } = req.body;

        if (!date || !gameNumber || !startTime) {
            return res.status(400).json({
                success: false,
                message: '필수 정보가 누락되었습니다.'
            });
        }

        const result = await DailyGame.updateOne(
            { 
                date,
                'games.number': gameNumber
            },
            {
                $set: {
                    'games.$.startTime': startTime
                }
            }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({
                success: false,
                message: '해당 게임을 찾을 수 없습니다.'
            });
        }

        res.json({
            success: true,
            message: '시작 시간이 업데이트되었습니다.'
        });
    } catch (error) {
        console.error('Error updating start time:', error);
        res.status(500).json({
            success: false,
            message: '서버 오류가 발생했습니다.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// 종료 시간 업데이트
router.post('/end', async (req, res) => {
    try {
        const { date, gameNumber, endTime } = req.body;

        if (!date || !gameNumber || !endTime) {
            return res.status(400).json({
                success: false,
                message: '필수 정보가 누락되었습니다.'
            });
        }

        const result = await DailyGame.updateOne(
            { 
                date,
                'games.number': gameNumber
            },
            {
                $set: {
                    'games.$.endTime': endTime
                }
            }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({
                success: false,
                message: '해당 게임을 찾을 수 없습니다.'
            });
        }

        res.json({
            success: true,
            message: '종료 시간이 업데이트되었습니다.'
        });
    } catch (error) {
        console.error('Error updating end time:', error);
        res.status(500).json({
            success: false,
            message: '서버 오류가 발생했습니다.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// 게임 상태 업데이트
router.post('/no', async (req, res) => {
    try {
        const { date, gameNumber, noGame } = req.body;

        if (!date || !gameNumber || !noGame) {
            return res.status(400).json({
                success: false,
                message: '필수 정보가 누락되었습니다.'
            });
        }

        const result = await DailyGame.updateOne(
            { 
                date,
                'games.number': gameNumber
            },
            {
                $set: {
                    'games.$.noGame': noGame
                }
            }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({
                success: false,
                message: '해당 게임을 찾을 수 없습니다.'
            });
        }

        res.json({
            success: true,
            message: '게임 상태가 업데이트되었습니다.'
        });
    } catch (error) {
        console.error('Error updating game status:', error);
        res.status(500).json({
            success: false,
            message: '서버 오류가 발생했습니다.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = router; 