const express = require('express');
const router = express.Router();
const { MongoClient, ObjectId } = require('mongodb');

// MongoDB 연결 설정 (server.js와 동일한 방식)
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://ppadun_user:ppadun8267@member-management.bppicvz.mongodb.net/member-management?retryWrites=true&w=majority&appName=member-management';
const DB_NAME = process.env.DB_NAME || 'member-management';

// 모든 회원 조회
router.get('/api/members', async (req, res) => {
    let client;
    try {
        client = new MongoClient(MONGODB_URI, {
            serverSelectionTimeoutMS: 60000,
            socketTimeoutMS: 45000,
            connectTimeoutMS: 60000
        });
        await client.connect();
        const database = client.db(DB_NAME);
        const collection = database.collection('game-member');
        
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
    } finally {
        if (client) {
            await client.close();
        }
    }
});

// 회원 수정
router.put('/api/members/:id', async (req, res) => {
    let client;
    try {
        const { id } = req.params;
        const { name, email, points } = req.body;
        
        // ObjectId 형식 검증
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: '올바르지 않은 회원 ID 형식입니다.' });
        }
        
        client = new MongoClient(MONGODB_URI, {
            serverSelectionTimeoutMS: 60000,
            socketTimeoutMS: 45000,
            connectTimeoutMS: 60000
        });
        await client.connect();
        const database = client.db(DB_NAME);
        const collection = database.collection('game-member');
        
        const updateData = {};
        if (name) updateData.name = name;
        if (email) updateData.email = email;
        if (points !== undefined) updateData.points = points;
        
        const result = await collection.updateOne(
            { _id: new ObjectId(id) },
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
    } finally {
        if (client) {
            await client.close();
        }
    }
});

// 회원 삭제
router.delete('/api/members/:id', async (req, res) => {
    let client;
    try {
        const { id } = req.params;
        
        // ObjectId 형식 검증
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: '올바르지 않은 회원 ID 형식입니다.' });
        }
        
        client = new MongoClient(MONGODB_URI, {
            serverSelectionTimeoutMS: 60000,
            socketTimeoutMS: 45000,
            connectTimeoutMS: 60000
        });
        await client.connect();
        const database = client.db(DB_NAME);
        const collection = database.collection('game-member');
        
        const result = await collection.deleteOne({ _id: new ObjectId(id) });
        
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
    } finally {
        if (client) {
            await client.close();
        }
    }
});

module.exports = router; 