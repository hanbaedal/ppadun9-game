const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');

// MongoDB 연결 설정
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://ppadun_user:ppadun8267@member-management.bppicvz.mongodb.net/?retryWrites=true&w=majority&appName=member-management';

let client;
let db;

// 데이터베이스 연결 함수
async function connectDB() {
    try {
        if (!client || !client.topology || !client.topology.isConnected()) {
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
            db = client.db('member-management');
            console.log('MongoDB 연결 성공:', db.databaseName);
        }
    } catch (error) {
        console.error('MongoDB 연결 실패:', error);
        throw error;
    }
}

// CREATE - 새로운 일일 경기 데이터 생성
router.post('/', async (req, res) => {
    try {
        const { date, games } = req.body;
        
        await connectDB();
        const collection = db.collection('dailygames');
        
        // 기존 데이터 확인
        const existingData = await collection.findOne({ date });
        if (existingData) {
            return res.status(400).json({
                success: false,
                message: '해당 날짜의 데이터가 이미 존재합니다.'
            });
        }

        // 5개 경기 데이터 생성
        const gameData = [];
        for (let i = 1; i <= 5; i++) {
            const game = games.find(g => g.number === i) || {
                number: i,
                homeTeam: null,
                awayTeam: null,
                startTime: null,
                endTime: null,
                noGame: '정상게임'
            };
            gameData.push(game);
        }

        const result = await collection.insertOne({
            date: date,
            games: gameData,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        res.status(201).json({
            success: true,
            message: '일일 경기 데이터가 성공적으로 생성되었습니다.',
            data: { date, games: gameData }
        });
    } catch (error) {
        console.error('CREATE 오류:', error);
        res.status(500).json({
            success: false,
            message: error.message || '서버 오류가 발생했습니다.',
            error: error.message
        });
    }
});

// READ - 특정 날짜의 경기 데이터 조회
router.get('/:date', async (req, res) => {
    try {
        const { date } = req.params;
        
        await connectDB();
        const collection = db.collection('dailygames');
        
        const dailyGames = await collection.findOne({ date });
        
        if (!dailyGames) {
            return res.status(404).json({
                success: false,
                message: '해당 날짜의 경기 데이터를 찾을 수 없습니다.'
            });
        }

        res.json({
            success: true,
            data: dailyGames
        });
    } catch (error) {
        console.error('READ 오류:', error);
        res.status(500).json({
            success: false,
            message: '서버 오류가 발생했습니다.',
            error: error.message
        });
    }
});

// READ ALL - 모든 일일 경기 데이터 조회
router.get('/', async (req, res) => {
    try {
        await connectDB();
        const collection = db.collection('dailygames');
        
        const dailyGames = await collection.find({}).sort({ date: -1 }).toArray();
        
        res.json({
            success: true,
            data: dailyGames
        });
    } catch (error) {
        console.error('READ ALL 오류:', error);
        res.status(500).json({
            success: false,
            message: '서버 오류가 발생했습니다.',
            error: error.message
        });
    }
});

// UPDATE - 특정 날짜의 경기 데이터 업데이트
router.put('/:date', async (req, res) => {
    try {
        const { date } = req.params;
        const { games } = req.body;

        await connectDB();
        const collection = db.collection('dailygames');
        
        // 기존 데이터 확인
        const existingData = await collection.findOne({ date });
        if (!existingData) {
            return res.status(404).json({
                success: false,
                message: '업데이트할 데이터를 찾을 수 없습니다.'
            });
        }

        // 5개 경기 데이터 업데이트
        const gameData = [];
        for (let i = 1; i <= 5; i++) {
            const game = games.find(g => g.number === i) || {
                number: i,
                homeTeam: null,
                awayTeam: null,
                startTime: null,
                endTime: null,
                noGame: '정상게임'
            };
            gameData.push(game);
        }

        const result = await collection.updateOne(
            { date },
            { 
                $set: { 
                    games: gameData,
                    updatedAt: new Date()
                } 
            }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({
                success: false,
                message: '업데이트할 데이터를 찾을 수 없습니다.'
            });
        }

        // 업데이트된 데이터 반환
        const updatedData = await collection.findOne({ date });

        res.json({
            success: true,
            message: '일일 경기 데이터가 성공적으로 업데이트되었습니다.',
            data: updatedData
        });
    } catch (error) {
        console.error('UPDATE 오류:', error);
        res.status(500).json({
            success: false,
            message: error.message || '서버 오류가 발생했습니다.',
            error: error.message
        });
    }
});

// DELETE - 특정 날짜의 경기 데이터 삭제
router.delete('/:date', async (req, res) => {
    try {
        const { date } = req.params;
        
        await connectDB();
        const collection = db.collection('dailygames');
        
        const deletedData = await collection.findOne({ date });
        if (!deletedData) {
            return res.status(404).json({
                success: false,
                message: '삭제할 데이터를 찾을 수 없습니다.'
            });
        }

        await collection.deleteOne({ date });

        res.json({
            success: true,
            message: '일일 경기 데이터가 성공적으로 삭제되었습니다.',
            data: deletedData
        });
    } catch (error) {
        console.error('DELETE 오류:', error);
        res.status(500).json({
            success: false,
            message: '서버 오류가 발생했습니다.',
            error: error.message
        });
    }
});

module.exports = router; 