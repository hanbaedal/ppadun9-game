const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');

// MongoDB 연결 설정
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

// 모든 회원 조회
router.get('/api/members', async (req, res) => {
    try {
        await client.connect();
        const database = client.db('test');
        const collection = database.collection('game-memberr');
        
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
        
        await client.connect();
        const database = client.db('test');
        const collection = database.collection('game-memberr');
        
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
        
        await client.connect();
        const database = client.db('test');
        const collection = database.collection('game-memberr');
        
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