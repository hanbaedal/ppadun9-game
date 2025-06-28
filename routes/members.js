const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');

// MongoDB 연결 설정
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://ppadun_user:ppadun8267@member-management.bppicvz.mongodb.net/member-management?retryWrites=true&w=majority&appName=member-management';
const DB_NAME = 'member-management';

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
            db = client.db(DB_NAME);
            console.log('MongoDB 연결 성공:', db.databaseName);
        }
    } catch (error) {
        console.error('MongoDB 연결 실패:', error);
        throw error;
    }
}

// 모든 회원 조회
router.get('/api/members', async (req, res) => {
    try {
        await connectDB();
        const collection = db.collection('game-member');
        
        const members = await collection.find({}).toArray();
        
        res.json({
            success: true,
            members: members
        });
    } catch (error) {
        console.error('회원 목록 조회 오류:', error);
        res.status(500).json({
            success: false,
            message: '서버 오류가 발생했습니다.'
        });
    }
});

// 회원 수정
router.put('/api/members/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, points } = req.body;
        
        await connectDB();
        const collection = db.collection('game-member');
        
        const updateData = {};
        if (name) updateData.name = name;
        if (email) updateData.email = email;
        if (points !== undefined) updateData.points = points;
        
        const result = await collection.updateOne(
            { _id: id },
            { $set: updateData }
        );
        
        if (result.matchedCount > 0) {
            res.json({
                success: true,
                message: '회원 정보가 수정되었습니다.'
            });
        } else {
            res.status(404).json({
                success: false,
                message: '회원을 찾을 수 없습니다.'
            });
        }
    } catch (error) {
        console.error('회원 수정 오류:', error);
        res.status(500).json({
            success: false,
            message: '서버 오류가 발생했습니다.'
        });
    }
});

// 회원 삭제
router.delete('/api/members/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        await connectDB();
        const collection = db.collection('game-member');
        
        const result = await collection.deleteOne({ _id: id });
        
        if (result.deletedCount > 0) {
            res.json({
                success: true,
                message: '회원이 삭제되었습니다.'
            });
        } else {
            res.status(404).json({
                success: false,
                message: '회원을 찾을 수 없습니다.'
            });
        }
    } catch (error) {
        console.error('회원 삭제 오류:', error);
        res.status(500).json({
            success: false,
            message: '서버 오류가 발생했습니다.'
        });
    }
});

module.exports = router; 