const express = require('express');
const router = express.Router();

// DB 연결
const { getDb } = require('../config/db');

// 공지사항 목록 조회
router.get('/', async (req, res) => {
    try {
        const db = getDb();
        const notices = await db.collection('notices').find({}).sort({ createdAt: -1 }).toArray();
        res.json({ success: true, notices });
    } catch (err) {
        res.json({ success: false, message: '공지사항 목록 조회 실패', error: err.message });
    }
});

// 공지사항 단일 조회
router.get('/:id', async (req, res) => {
    const { ObjectId } = require('mongodb');
    try {
        const db = getDb();
        const notice = await db.collection('notices').findOne({ _id: new ObjectId(req.params.id) });
        if (!notice) return res.json({ success: false, message: '공지사항을 찾을 수 없습니다.' });
        res.json({ success: true, notice });
    } catch (err) {
        res.json({ success: false, message: '공지사항 조회 실패', error: err.message });
    }
});

// 공지사항 생성
router.post('/', async (req, res) => {
    try {
        const db = getDb();
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
        res.json({ success: false, message: '공지사항 등록 실패', error: err.message });
    }
});

// 공지사항 수정
router.put('/:id', async (req, res) => {
    const { ObjectId } = require('mongodb');
    try {
        const db = getDb();
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
        res.json({ success: false, message: '공지사항 수정 실패', error: err.message });
    }
});

// 공지사항 삭제
router.delete('/:id', async (req, res) => {
    const { ObjectId } = require('mongodb');
    try {
        const db = getDb();
        const result = await db.collection('notices').deleteOne({ _id: new ObjectId(req.params.id) });
        if (result.deletedCount === 0) return res.json({ success: false, message: '공지사항을 찾을 수 없습니다.' });
        res.json({ success: true });
    } catch (err) {
        res.json({ success: false, message: '공지사항 삭제 실패', error: err.message });
    }
});

module.exports = router; 