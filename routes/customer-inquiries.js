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
        
        // 클라이언트에서 보내는 데이터 구조에 맞춰 수정
        const { title, content, name, email, priority } = req.body;
        
        if (!name || !email || !title || !content) {
            return res.status(400).json({ 
                success: false, 
                message: '필수 정보가 누락되었습니다.' 
            });
        }
        
        const newInquiry = {
            title: title,
            content: content,
            userId: email,        // email을 userId로 사용
            userName: name,       // name을 userName으로 사용
            category: priority,   // priority를 category로 사용
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

// 답변 등록
router.put('/:id/reply', async (req, res) => {
    try {
        const db = getDb();
        const collection = db.collection('customer-inquiries');
        
        const { reply } = req.body;
        
        if (!reply) {
            return res.status(400).json({ 
                success: false, 
                message: '답변 내용이 필요합니다.' 
            });
        }
        
        const result = await collection.updateOne(
            { _id: new ObjectId(req.params.id) },
            { 
                $set: { 
                    answer: reply,           // reply를 answer로 변경
                    status: 'answered',
                    answeredAt: new Date(),  // repliedAt을 answeredAt으로 변경
                    updatedAt: getKoreanTime()
                } 
            }
        );
        
        if (result.matchedCount === 0) {
            return res.status(404).json({ 
                success: false, 
                message: '고객 문의를 찾을 수 없습니다.' 
            });
        }
        
        res.json({ 
            success: true, 
            message: '답변이 등록되었습니다.' 
        });
    } catch (error) {
        console.error('답변 등록 오류:', error);
        res.status(500).json({ 
            success: false, 
            message: '답변 등록에 실패했습니다.',
            error: error.message 
        });
    }
});

// 문의 처리 완료
router.put('/:id/close', async (req, res) => {
    try {
        const db = getDb();
        const collection = db.collection('customer-inquiries');
        
        const result = await collection.updateOne(
            { _id: new ObjectId(req.params.id) },
            { 
                $set: { 
                    status: 'closed',
                    updatedAt: getKoreanTime()
                } 
            }
        );
        
        if (result.matchedCount === 0) {
            return res.status(404).json({ 
                success: false, 
                message: '고객 문의를 찾을 수 없습니다.' 
            });
        }
        
        res.json({ 
            success: true, 
            message: '문의가 처리 완료 상태로 변경되었습니다.' 
        });
    } catch (error) {
        console.error('문의 처리 완료 오류:', error);
        res.status(500).json({ 
            success: false, 
            message: '문의 처리 완료에 실패했습니다.',
            error: error.message 
        });
    }
});

// 통계 조회
router.get('/stats', async (req, res) => {
    try {
        const db = getDb();
        const collection = db.collection('customer-inquiries');
        
        const total = await collection.countDocuments({});
        const pending = await collection.countDocuments({ status: 'pending' });
        const answered = await collection.countDocuments({ status: 'answered' });
        const closed = await collection.countDocuments({ status: 'closed' });
        
        res.json({
            success: true,
            stats: {
                total,
                pending,
                answered,
                closed
            }
        });
    } catch (error) {
        console.error('통계 조회 오류:', error);
        res.status(500).json({
            success: false,
            message: '통계 조회에 실패했습니다.',
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