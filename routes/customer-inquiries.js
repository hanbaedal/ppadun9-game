const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const { getDb } = require('../config/db');
const { getKoreanTime } = require('../utils/korean-time');

// 고객 문의 목록 조회
router.get('/', async (req, res) => {
    try {
        const db = getDb();
        const collection = db.collection('customer-inquiries');
        
        // 모든 고객 문의 조회 (최신순으로 정렬)
        const inquiries = await collection.find({}).sort({ createdAt: -1 }).toArray();
        
        res.json({ 
            success: true, 
            inquiries: inquiries 
        });
    } catch (error) {
        console.error('고객 문의 목록 조회 오류:', error);
        res.status(500).json({ 
            success: false, 
            message: '고객 문의 목록을 불러오는데 실패했습니다.',
            error: error.message 
        });
    }
});

// 고객 문의 상세 조회
router.get('/:id', async (req, res) => {
    try {
        const db = getDb();
        const collection = db.collection('customer-inquiries');
        
        const inquiry = await collection.findOne({ _id: new ObjectId(req.params.id) });
        
        if (!inquiry) {
            return res.status(404).json({ 
                success: false, 
                message: '고객 문의를 찾을 수 없습니다.' 
            });
        }
        
        res.json({ 
            success: true, 
            inquiry: inquiry 
        });
    } catch (error) {
        console.error('고객 문의 상세 조회 오류:', error);
        res.status(500).json({ 
            success: false, 
            message: '고객 문의 조회에 실패했습니다.',
            error: error.message 
        });
    }
});

// 고객 문의 생성
router.post('/', async (req, res) => {
    try {
        const db = getDb();
        const collection = db.collection('customer-inquiries');
        
        const { name, email, phone, subject, message, category = 'general' } = req.body;
        
        if (!name || !email || !subject || !message) {
            return res.status(400).json({ 
                success: false, 
                message: '필수 정보가 누락되었습니다.' 
            });
        }
        
        const newInquiry = {
            name: name,
            email: email,
            phone: phone || '',
            subject: subject,
            message: message,
            category: category,
            status: 'pending',
            createdAt: new Date(),
            updatedAt: getKoreanTime()
        };
        
        const result = await collection.insertOne(newInquiry);
        
        res.status(201).json({ 
            success: true, 
            message: '고객 문의가 등록되었습니다.',
            inquiryId: result.insertedId
        });
    } catch (error) {
        console.error('고객 문의 생성 오류:', error);
        res.status(500).json({ 
            success: false, 
            message: '고객 문의 등록에 실패했습니다.',
            error: error.message 
        });
    }
});

// 고객 문의 상태 업데이트
router.put('/:id/status', async (req, res) => {
    try {
        const db = getDb();
        const collection = db.collection('customer-inquiries');
        
        const { status, response } = req.body;
        
        if (!status) {
            return res.status(400).json({ 
                success: false, 
                message: '상태 정보가 필요합니다.' 
            });
        }
        
        const updateDoc = {
            $set: {
                status: status,
                updatedAt: getKoreanTime()
            }
        };
        
        if (response) {
            updateDoc.$set.response = response;
            updateDoc.$set.respondedAt = new Date();
        }
        
        const result = await collection.updateOne(
            { _id: new ObjectId(req.params.id) }, 
            updateDoc
        );
        
        if (result.matchedCount === 0) {
            return res.status(404).json({ 
                success: false, 
                message: '고객 문의를 찾을 수 없습니다.' 
            });
        }
        
        res.json({ 
            success: true, 
            message: '고객 문의 상태가 업데이트되었습니다.' 
        });
    } catch (error) {
        console.error('고객 문의 상태 업데이트 오류:', error);
        res.status(500).json({ 
            success: false, 
            message: '고객 문의 상태 업데이트에 실패했습니다.',
            error: error.message 
        });
    }
});

// 고객 문의 삭제
router.delete('/:id', async (req, res) => {
    try {
        const db = getDb();
        const collection = db.collection('customer-inquiries');
        
        const result = await collection.deleteOne({ _id: new ObjectId(req.params.id) });
        
        if (result.deletedCount === 0) {
            return res.status(404).json({ 
                success: false, 
                message: '고객 문의를 찾을 수 없습니다.' 
            });
        }
        
        res.json({ 
            success: true, 
            message: '고객 문의가 삭제되었습니다.' 
        });
    } catch (error) {
        console.error('고객 문의 삭제 오류:', error);
        res.status(500).json({ 
            success: false, 
            message: '고객 문의 삭제에 실패했습니다.',
            error: error.message 
        });
    }
});

module.exports = router; 