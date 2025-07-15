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

// 고객 문의 목록 조회 (검색, 필터링, 페이지네이션 포함)
router.get('/', async (req, res) => {
    try {
        await connectDB();
        const collection = db.collection('customer-inquiries');
        
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        
        // 검색 조건 구성
        const searchTerm = req.query.search;
        const statusFilter = req.query.status;
        const categoryFilter = req.query.category;
        
        let query = {};
        
        // 검색어가 있는 경우
        if (searchTerm) {
            query.$or = [
                { title: { $regex: searchTerm, $options: 'i' } },
                { content: { $regex: searchTerm, $options: 'i' } },
                { userName: { $regex: searchTerm, $options: 'i' } },
                { userId: { $regex: searchTerm, $options: 'i' } }
            ];
        }
        
        // 상태 필터
        if (statusFilter) {
            query.status = statusFilter;
        }
        
        // 카테고리 필터
        if (categoryFilter) {
            query.category = categoryFilter;
        }
        
        // 전체 개수 조회
        const total = await collection.countDocuments(query);
        
        // 문의 목록 조회
        const inquiries = await collection.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .toArray();
        
        const totalPages = Math.ceil(total / limit);
        
        res.json({
            success: true,
            inquiries: inquiries,
            page: page,
            totalPages: totalPages,
            total: total,
            limit: limit
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

// 고객 문의 통계 조회
router.get('/stats', async (req, res) => {
    try {
        await connectDB();
        const collection = db.collection('customer-inquiries');
        
        // 전체 문의 수
        const total = await collection.countDocuments();
        
        // 상태별 문의 수
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
        console.error('고객 문의 통계 조회 오류:', error);
        res.status(500).json({
            success: false,
            message: '고객 문의 통계를 불러오는데 실패했습니다.',
            error: error.message
        });
    }
});

// 고객 문의 상세 조회
router.get('/:id', async (req, res) => {
    const { ObjectId } = require('mongodb');
    try {
        await connectDB();
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

// 새 고객 문의 등록
router.post('/', async (req, res) => {
    try {
        await connectDB();
        const collection = db.collection('customer-inquiries');
        
        const { title, content, userId, userName, category = 'general' } = req.body;
        
        // 필수 필드 검증
        if (!title || !content || !userId || !userName) {
            return res.status(400).json({
                success: false,
                message: '제목, 내용, 사용자 ID, 사용자명은 필수 항목입니다.'
            });
        }
        
        const inquiry = {
            title,
            content,
            userId,
            userName,
            category,
            status: 'pending',
            answer: '',
            answeredBy: '',
            createdAt: new Date(),
            updatedAt: new Date()
        };
        
        const result = await collection.insertOne(inquiry);
        
        res.status(201).json({
            success: true,
            message: '고객 문의가 성공적으로 등록되었습니다.',
            inquiry: { ...inquiry, _id: result.insertedId }
        });
    } catch (error) {
        console.error('고객 문의 등록 오류:', error);
        res.status(500).json({
            success: false,
            message: '고객 문의 등록에 실패했습니다.',
            error: error.message
        });
    }
});

// 고객 문의 답변 등록
router.put('/:id/reply', async (req, res) => {
    const { ObjectId } = require('mongodb');
    try {
        await connectDB();
        const collection = db.collection('customer-inquiries');
        
        const { answer, answeredBy } = req.body;
        
        if (!answer) {
            return res.status(400).json({
                success: false,
                message: '답변 내용을 입력해주세요.'
            });
        }
        
        const result = await collection.updateOne(
            { _id: new ObjectId(req.params.id) },
            {
                $set: {
                    answer: answer,
                    answeredBy: answeredBy || '관리자',
                    status: 'answered',
                    updatedAt: new Date()
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
            message: '답변이 성공적으로 등록되었습니다.'
        });
    } catch (error) {
        console.error('고객 문의 답변 등록 오류:', error);
        res.status(500).json({
            success: false,
            message: '답변 등록에 실패했습니다.',
            error: error.message
        });
    }
});

// 고객 문의 처리 완료
router.put('/:id/close', async (req, res) => {
    const { ObjectId } = require('mongodb');
    try {
        await connectDB();
        const collection = db.collection('customer-inquiries');
        
        const result = await collection.updateOne(
            { _id: new ObjectId(req.params.id) },
            {
                $set: {
                    status: 'closed',
                    updatedAt: new Date()
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
            message: '고객 문의가 처리 완료 상태로 변경되었습니다.'
        });
    } catch (error) {
        console.error('고객 문의 상태 변경 오류:', error);
        res.status(500).json({
            success: false,
            message: '상태 변경에 실패했습니다.',
            error: error.message
        });
    }
});

// 고객 문의 삭제
router.delete('/:id', async (req, res) => {
    const { ObjectId } = require('mongodb');
    try {
        await connectDB();
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
            message: '고객 문의가 성공적으로 삭제되었습니다.'
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