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

// 공지사항 목록 조회
router.get('/', async (req, res) => {
    try {
        await connectDB();
        const notices = await db.collection('notices').find({}).sort({ createdAt: -1 }).toArray();
        res.json({ success: true, notices });
    } catch (err) {
        console.error('공지사항 목록 조회 오류:', err);
        res.json({ success: false, message: '공지사항 목록 조회 실패', error: err.message });
    }
});

// 공지사항 단일 조회
router.get('/:id', async (req, res) => {
    const { ObjectId } = require('mongodb');
    try {
        await connectDB();
        const notice = await db.collection('notices').findOne({ _id: new ObjectId(req.params.id) });
        if (!notice) return res.json({ success: false, message: '공지사항을 찾을 수 없습니다.' });
        res.json({ success: true, notice });
    } catch (err) {
        console.error('공지사항 조회 오류:', err);
        res.json({ success: false, message: '공지사항 조회 실패', error: err.message });
    }
});

// 공지사항 생성
router.post('/', async (req, res) => {
    try {
        await connectDB();
        const { title, content, priority, isActive } = req.body;
        const newNotice = {
            title,
            content,
            priority: priority || 'medium',
            isActive: isActive === true || isActive === 'true',
            createdAt: new Date(),
            updatedAt: new Date()
        };
        const result = await db.collection('notices').insertOne(newNotice);
        res.json({ success: true, notice: { ...newNotice, _id: result.insertedId } });
    } catch (err) {
        console.error('공지사항 등록 오류:', err);
        res.json({ success: false, message: '공지사항 등록 실패', error: err.message });
    }
});

// 공지사항 수정
router.put('/:id', async (req, res) => {
    const { ObjectId } = require('mongodb');
    try {
        await connectDB();
        const { title, content, priority, isActive } = req.body;
        const updateDoc = {
            $set: {
                title,
                content,
                priority: priority || 'medium',
                isActive: isActive === true || isActive === 'true',
                updatedAt: new Date()
            }
        };
        const result = await db.collection('notices').updateOne({ _id: new ObjectId(req.params.id) }, updateDoc);
        if (result.matchedCount === 0) return res.json({ success: false, message: '공지사항을 찾을 수 없습니다.' });
        res.json({ success: true });
    } catch (err) {
        console.error('공지사항 수정 오류:', err);
        res.json({ success: false, message: '공지사항 수정 실패', error: err.message });
    }
});

// 공지사항 삭제
router.delete('/:id', async (req, res) => {
    const { ObjectId } = require('mongodb');
    try {
        await connectDB();
        const result = await db.collection('notices').deleteOne({ _id: new ObjectId(req.params.id) });
        if (result.deletedCount === 0) return res.json({ success: false, message: '공지사항을 찾을 수 없습니다.' });
        res.json({ success: true });
    } catch (err) {
        console.error('공지사항 삭제 오류:', err);
        res.json({ success: false, message: '공지사항 삭제 실패', error: err.message });
    }
});

module.exports = router; 