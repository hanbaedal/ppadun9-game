const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');

// server.js에서 전달받은 데이터베이스 연결 사용
let db = null;

// 데이터베이스 연결 설정 함수
function setDatabase(database) {
    db = database;
}

// 모든 회원 조회

// 데이터베이스 컬렉션 목록 확인 (디버깅용)
router.get('/debug/collections', async (req, res) => {
    try {
        if (!db) {
            return res.status(503).json({
                success: false,
                message: '데이터베이스 연결이 준비되지 않았습니다.'
            });
        }
        
        const collections = await db.listCollections().toArray();
        const collectionNames = collections.map(col => col.name);
        
        res.json({
            success: true,
            collections: collectionNames,
            total: collectionNames.length
        });
    } catch (error) {
        console.error('컬렉션 목록 조회 오류:', error);
        res.status(500).json({
            success: false,
            message: '서버 오류가 발생했습니다.',
            error: error.message
        });
    }
});

// 모든 회원 조회
router.get('/members', async (req, res) => {
    try {
        console.log('회원 목록 조회 요청 받음');
        
        if (!db) {
            console.error('데이터베이스 연결이 없음');
            return res.status(503).json({
                success: false,
                message: '데이터베이스 연결이 준비되지 않았습니다.'
            });
        }
        
        console.log('game-member 컬렉션 접근 시도');
        const collection = db.collection('game-member');
        
        // 컬렉션이 존재하는지 확인
        const collections = await db.listCollections({name: 'game-member'}).toArray();
        if (collections.length === 0) {
            console.error('game-member 컬렉션이 존재하지 않음');
            return res.status(404).json({
                success: false,
                message: 'game-member 컬렉션이 존재하지 않습니다.',
                availableCollections: await db.listCollections().toArray().then(cols => cols.map(c => c.name))
            });
        }
        
        console.log('회원 데이터 조회 중...');
        const members = await collection.find({}).toArray();
        console.log(`총 ${members.length}명의 회원 조회됨`);
        
        res.json({
            success: true,
            members: members
        });
    } catch (error) {
        console.error('회원 목록 조회 오류:', error);
        res.status(500).json({
            success: false,
            message: '서버 오류가 발생했습니다.',
            error: error.message
        });
    }
});

// 회원 수정
router.put('/members/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, points } = req.body;
        
        // ObjectId 형식 검증
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: '올바르지 않은 회원 ID 형식입니다.' });
        }
        
        if (!db) {
            return res.status(503).json({
                success: false,
                message: '데이터베이스 연결이 준비되지 않았습니다.'
            });
        }
        
        const collection = db.collection('game-member');
        
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
    }
});

// 회원 삭제
router.delete('/members/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // ObjectId 형식 검증
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: '올바르지 않은 회원 ID 형식입니다.' });
        }
        
        if (!db) {
            return res.status(503).json({
                success: false,
                message: '데이터베이스 연결이 준비되지 않았습니다.'
            });
        }
        
        const collection = db.collection('game-member');
        
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
    }
});

module.exports = { router, setDatabase }; 