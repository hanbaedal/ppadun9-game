const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const { getDb } = require('../config/db');
const { getKoreanTime } = require('../utils/korean-time');

// 공지사항 목록 조회
router.get('/', async (req, res) => {
    try {
        const db = getDb();
        const collection = db.collection('notices');
        
        // 모든 공지사항 조회 (최신순으로 정렬)
        const notices = await collection.find({}).sort({ createdAt: -1 }).toArray();
        
        res.json({ 
            success: true, 
            notices: notices 
        });
    } catch (error) {
        console.error('공지사항 목록 조회 오류:', error);
        res.status(500).json({ 
            success: false, 
            message: '공지사항을 불러오는데 실패했습니다.',
            error: error.message 
        });
    }
});

// 공지사항 상세 조회
router.get('/:id', async (req, res) => {
    try {
        const db = getDb();
        const collection = db.collection('notices');
        
        const notice = await collection.findOne({ _id: new ObjectId(req.params.id) });
        
        if (!notice) {
            return res.status(404).json({ 
                success: false, 
                message: '공지사항을 찾을 수 없습니다.' 
            });
        }
        
        res.json({ 
            success: true, 
            notice: notice 
        });
    } catch (error) {
        console.error('공지사항 상세 조회 오류:', error);
        res.status(500).json({ 
            success: false, 
            message: '공지사항 조회에 실패했습니다.',
            error: error.message 
        });
    }
});

// 공지사항 생성
router.post('/', async (req, res) => {
    try {
        const db = getDb();
        const collection = db.collection('notices');
        
        const { title, content, isImportant = false } = req.body;
        
        if (!title || !content) {
            return res.status(400).json({ 
                success: false, 
                message: '제목과 내용은 필수입니다.' 
            });
        }
        
        const newNotice = {
            title: title,
            content: content,
            isImportant: isImportant,
            createdAt: getKoreanTime(),
            updatedAt: getKoreanTime()
        };
        
        const result = await collection.insertOne(newNotice);
        
        res.status(201).json({ 
            success: true, 
            message: '공지사항이 생성되었습니다.',
            noticeId: result.insertedId
        });
    } catch (error) {
        console.error('공지사항 생성 오류:', error);
        res.status(500).json({ 
            success: false, 
            message: '공지사항 생성에 실패했습니다.',
            error: error.message 
        });
    }
});

// 공지사항 수정
router.put('/:id', async (req, res) => {
    try {
        const db = getDb();
        const collection = db.collection('notices');
        
        const { title, content, isImportant } = req.body;
        
        if (!title || !content) {
            return res.status(400).json({ 
                success: false, 
                message: '제목과 내용은 필수입니다.' 
            });
        }
        
        const updateDoc = {
            $set: {
                title: title,
                content: content,
                isImportant: isImportant,
                updatedAt: getKoreanTime()
            }
        };
        
        const result = await collection.updateOne(
            { _id: new ObjectId(req.params.id) }, 
            updateDoc
        );
        
        if (result.matchedCount === 0) {
            return res.status(404).json({ 
                success: false, 
                message: '공지사항을 찾을 수 없습니다.' 
            });
        }
        
        res.json({ 
            success: true, 
            message: '공지사항이 수정되었습니다.' 
        });
    } catch (error) {
        console.error('공지사항 수정 오류:', error);
        res.status(500).json({ 
            success: false, 
            message: '공지사항 수정에 실패했습니다.',
            error: error.message 
        });
    }
});

// 공지사항 삭제
router.delete('/:id', async (req, res) => {
    try {
        const db = getDb();
        const collection = db.collection('notices');
        
        const result = await collection.deleteOne({ _id: new ObjectId(req.params.id) });
        
        if (result.deletedCount === 0) {
            return res.status(404).json({ 
                success: false, 
                message: '공지사항을 찾을 수 없습니다.' 
            });
        }
        
        res.json({ 
            success: true, 
            message: '공지사항이 삭제되었습니다.' 
        });
    } catch (error) {
        console.error('공지사항 삭제 오류:', error);
        res.status(500).json({ 
            success: false, 
            message: '공지사항 삭제에 실패했습니다.',
            error: error.message 
        });
    }
});

module.exports = router; 