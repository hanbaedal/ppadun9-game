const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');

// MongoDB Atlas 연결 설정
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://ppadun_user:ppadun8267@member-management.bppicvz.mongodb.net/member-management?retryWrites=true&w=majority&appName=member-management';
const DB_NAME = 'member-management';

let client;
let db;

// 데이터베이스 연결 함수
async function connectDB() {
    try {
        if (!client || !client.topology || !client.topology.isConnected()) {
            console.log('MongoDB 연결 시도...');
            console.log('연결 문자열:', MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, '//****:****@'));
            
            client = new MongoClient(MONGODB_URI, {
                serverSelectionTimeoutMS: 60000,
                socketTimeoutMS: 45000,
                connectTimeoutMS: 60000,
                maxPoolSize: 10,
                minPoolSize: 1,
                maxIdleTimeMS: 30000,
                retryWrites: true,
                w: 'majority'
            });
            
            await client.connect();
            db = client.db(DB_NAME);
            console.log('MongoDB Atlas 연결 성공');
            
            // 연결 후 데이터베이스 정보 출력
            console.log('현재 데이터베이스:', db.databaseName);
            
            // 컬렉션 목록 조회
            const collections = await db.listCollections().toArray();
            console.log('사용 가능한 컬렉션:', collections.map(c => c.name));
        }
    } catch (error) {
        console.error('MongoDB 연결 실패:', error);
        throw error;
    }
}

// 연결 테스트 엔드포인트
router.get('/test-connection', async (req, res) => {
    try {
        await connectDB();
        res.json({
            success: true,
            message: 'MongoDB Atlas 연결 성공',
            database: db.databaseName,
            collections: await db.listCollections().toArray()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'MongoDB Atlas 연결 실패',
            error: error.message
        });
    }
});

// 오늘의 경기 목록 가져오기 (Read)
router.get('/today-games', async (req, res) => {
    console.log('today-games API 호출됨');
    try {
        // 데이터베이스 연결 확인
        await connectDB();
        console.log('DB 연결 확인 완료');

        // 오늘 날짜를 YYYYMMDD 형식으로 생성
        const today = new Date();
        const dateStr = today.getFullYear() +
            String(today.getMonth() + 1).padStart(2, '0') +
            String(today.getDate()).padStart(2, '0');
        
        console.log('조회 날짜:', dateStr);

        // member-management 데이터베이스의 dailygames 컬렉션에서 데이터 조회
        console.log('사용할 데이터베이스:', db.databaseName);

        // 컬렉션 목록 조회
        const collections = await db.listCollections().toArray();
        console.log('사용 가능한 컬렉션:', collections.map(c => c.name));

        const collection = db.collection('dailygames');
        
        // 컬렉션이 존재하는지 확인
        const collectionExists = collections.some(col => col.name === 'dailygames');
        console.log('dailygames 컬렉션 존재 여부:', collectionExists);
        
        if (!collectionExists) {
            console.log('dailygames 컬렉션이 존재하지 않습니다.');
            return res.json({
                success: true,
                games: []
            });
        }

        // 해당 날짜의 경기 데이터 조회
        console.log('경기 데이터 조회 시작:', { date: dateStr });
        const gameData = await collection.findOne({ date: dateStr });
        console.log('조회된 경기 데이터:', gameData);

        if (!gameData || !gameData.games || gameData.games.length === 0) {
            console.log('해당 날짜의 경기 데이터가 없습니다.');
            return res.json({
                success: true,
                games: []
            });
        }

        // 경기 데이터 포맷팅
        const formattedGames = gameData.games.map(game => ({
            homeTeam: game.homeTeam || '',
            awayTeam: game.awayTeam || '',
            startTime: game.startTime || null,
            endTime: game.endTime || null,
            noGame: game.noGame || '정상게임'
        }));

        console.log('포맷팅된 경기 데이터:', formattedGames);

        res.json({
            success: true,
            games: formattedGames
        });
        console.log('API 응답 완료');
    } catch (error) {
        console.error('경기 목록 조회 실패:', error);
        console.error('에러 상세 정보:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
        res.status(500).json({
            success: false,
            message: '경기 목록을 불러오는데 실패했습니다.',
            error: error.message
        });
    }
});

// 게임 진행 데이터 생성 (Create)
router.post('/create', async (req, res) => {
    try {
        const { gameSelection, teamType, inning, batter } = req.body;
        const today = new Date();
        const dateStr = today.getFullYear().toString() +
                       (today.getMonth() + 1).toString().padStart(2, '0') +
                       today.getDate().toString().padStart(2, '0');
        
        const gameId = `${dateStr}-${gameSelection}`;
        
        // member-management 데이터베이스의 game-progress 컬렉션에 데이터 저장
        await connectDB();
        const collection = db.collection('game-progress');
        
        // 중복 체크
        const existingGame = await collection.findOne({ gameId });
        if (existingGame) {
            return res.status(400).json({
                success: false,
                message: '이미 존재하는 게임 진행 데이터입니다.'
            });
        }

        const gameProgress = {
            gameId,
            gameSelection,
            teamType,
            inning,
            batter,
            bettingStartTime: null,
            bettingEndTime: null,
            bettingResult: null,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        await collection.insertOne(gameProgress);

        res.json({
            success: true,
            message: '게임 진행 데이터가 생성되었습니다.',
            data: gameProgress
        });
    } catch (error) {
        console.error('게임 진행 데이터 생성 실패:', error);
        res.status(500).json({
            success: false,
            message: '게임 진행 데이터 생성에 실패했습니다.'
        });
    }
});

// 게임 진행 데이터 수정 (Update)
router.put('/update/:gameId', async (req, res) => {
    try {
        const { gameId } = req.params;
        const { teamType, inning, batter, bettingStartTime, bettingEndTime, bettingResult } = req.body;

        // member-management 데이터베이스의 game-progress 컬렉션에서 데이터 수정
        await connectDB();
        const collection = db.collection('game-progress');

        const updateData = {
            ...(teamType && { teamType }),
            ...(inning && { inning }),
            ...(batter && { batter }),
            ...(bettingStartTime && { bettingStartTime: new Date(bettingStartTime) }),
            ...(bettingEndTime && { bettingEndTime: new Date(bettingEndTime) }),
            ...(bettingResult && { bettingResult }),
            updatedAt: new Date()
        };

        const result = await collection.updateOne(
            { gameId },
            { $set: updateData }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({
                success: false,
                message: '해당 게임 진행 데이터를 찾을 수 없습니다.'
            });
        }

        res.json({
            success: true,
            message: '게임 진행 데이터가 수정되었습니다.'
        });
    } catch (error) {
        console.error('게임 진행 데이터 수정 실패:', error);
        res.status(500).json({
            success: false,
            message: '게임 진행 데이터 수정에 실패했습니다.'
        });
    }
});

// 게임 진행 데이터 삭제 (Delete)
router.delete('/delete/:gameId', async (req, res) => {
    try {
        const { gameId } = req.params;

        // member-management 데이터베이스의 game-progress 컬렉션에서 데이터 삭제
        await connectDB();
        const collection = db.collection('game-progress');

        const result = await collection.deleteOne({ gameId });

        if (result.deletedCount === 0) {
            return res.status(404).json({
                success: false,
                message: '해당 게임 진행 데이터를 찾을 수 없습니다.'
            });
        }

        res.json({
            success: true,
            message: '게임 진행 데이터가 삭제되었습니다.'
        });
    } catch (error) {
        console.error('게임 진행 데이터 삭제 실패:', error);
        res.status(500).json({
            success: false,
            message: '게임 진행 데이터 삭제에 실패했습니다.'
        });
    }
});

// 배팅 시작 시간 업데이트
router.put('/update-betting-start/:gameId', async (req, res) => {
    try {
        await connectDB();
        const collection = db.collection('game-progress');
        
        const result = await collection.updateOne(
            { gameId: req.params.gameId },
            { 
                $set: { 
                    bettingStartTime: new Date(),
                    updatedAt: new Date()
                }
            }
        );
        
        if (result.matchedCount === 0) {
            return res.status(404).json({ success: false, message: '게임을 찾을 수 없습니다.' });
        }

        res.json({ success: true, message: '배팅 시작 시간이 업데이트되었습니다.' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 배팅 중지 시간 업데이트
router.put('/update-betting-end/:gameId', async (req, res) => {
    try {
        await connectDB();
        const collection = db.collection('game-progress');
        
        const result = await collection.updateOne(
            { gameId: req.params.gameId },
            { 
                $set: { 
                    bettingEndTime: new Date(),
                    updatedAt: new Date()
                }
            }
        );
        
        if (result.matchedCount === 0) {
            return res.status(404).json({ success: false, message: '게임을 찾을 수 없습니다.' });
        }

        res.json({ success: true, message: '배팅 종료 시간이 업데이트되었습니다.' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 배팅 결과 업데이트
router.put('/update-betting-result/:gameId', async (req, res) => {
    try {
        const { bettingResult } = req.body;
        await connectDB();
        const collection = db.collection('game-progress');
        
        const result = await collection.updateOne(
            { gameId: req.params.gameId },
            { 
                $set: { 
                    bettingResult,
                    updatedAt: new Date()
                }
            }
        );
        
        if (result.matchedCount === 0) {
            return res.status(404).json({ success: false, message: '게임을 찾을 수 없습니다.' });
        }

        res.json({ success: true, message: '배팅 결과가 업데이트되었습니다.' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 현재 게임 진행 상태 조회
router.get('/current-status/:gameId', async (req, res) => {
    try {
        await connectDB();
        const collection = db.collection('game-progress');
        
        const gameProgress = await collection.findOne({ gameId: req.params.gameId });
        if (!gameProgress) {
            return res.status(404).json({ success: false, message: '게임을 찾을 수 없습니다.' });
        }

        res.json({ success: true, gameProgress });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router; 