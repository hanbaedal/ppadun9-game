const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const { getDb } = require('../config/db');

// 친구 초대 리스트 조회
router.get('/', async (req, res) => {
    try {
        const db = getDb();
        const collection = db.collection('friend-invite');
        
        // 모든 친구 초대 내역 조회 (최신순으로 정렬)
        const invites = await collection.find({}).sort({ createdAt: -1 }).toArray();
        
        res.json({ 
            success: true, 
            invites: invites 
        });
    } catch (error) {
        console.error('친구 초대 리스트 조회 오류:', error);
        res.status(500).json({ 
            success: false, 
            message: '친구 초대 내역을 불러오는데 실패했습니다.',
            error: error.message 
        });
    }
});

// 친구 초대 상세 조회
router.get('/:id', async (req, res) => {
    try {
        const db = getDb();
        const collection = db.collection('friend-invite');
        
        const invite = await collection.findOne({ _id: new ObjectId(req.params.id) });
        
        if (!invite) {
            return res.status(404).json({ 
                success: false, 
                message: '친구 초대 내역을 찾을 수 없습니다.' 
            });
        }
        
        res.json({ 
            success: true, 
            invite: invite 
        });
    } catch (error) {
        console.error('친구 초대 상세 조회 오류:', error);
        res.status(500).json({ 
            success: false, 
            message: '친구 초대 내역 조회에 실패했습니다.',
            error: error.message 
        });
    }
});

// 친구 초대 생성
router.post('/', async (req, res) => {
    try {
        const db = getDb();
        const collection = db.collection('friend-invite');
        
        const { inviterId, inviteeId, status = 'pending' } = req.body;
        
        if (!inviterId || !inviteeId) {
            return res.status(400).json({ 
                success: false, 
                message: '초대자와 초대받는 사람의 ID가 필요합니다.' 
            });
        }
        
        const newInvite = {
            inviterId: inviterId,
            inviteeId: inviteeId,
            status: status,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        
        const result = await collection.insertOne(newInvite);
        
        res.status(201).json({ 
            success: true, 
            message: '친구 초대가 생성되었습니다.',
            inviteId: result.insertedId
        });
    } catch (error) {
        console.error('친구 초대 생성 오류:', error);
        res.status(500).json({ 
            success: false, 
            message: '친구 초대 생성에 실패했습니다.',
            error: error.message 
        });
    }
});

// 친구 초대 상태 업데이트
router.put('/:id/status', async (req, res) => {
    try {
        const db = getDb();
        const collection = db.collection('friend-invite');
        
        const { status } = req.body;
        
        if (!status) {
            return res.status(400).json({ 
                success: false, 
                message: '상태 정보가 필요합니다.' 
            });
        }
        
        const result = await collection.updateOne(
            { _id: new ObjectId(req.params.id) }, 
            { 
                $set: { 
                    status: status,
                    updatedAt: new Date()
                } 
            }
        );
        
        if (result.matchedCount === 0) {
            return res.status(404).json({ 
                success: false, 
                message: '친구 초대 내역을 찾을 수 없습니다.' 
            });
        }
        
        res.json({ 
            success: true, 
            message: '친구 초대 상태가 업데이트되었습니다.' 
        });
    } catch (error) {
        console.error('친구 초대 상태 업데이트 오류:', error);
        res.status(500).json({ 
            success: false, 
            message: '친구 초대 상태 업데이트에 실패했습니다.',
            error: error.message 
        });
    }
});

// 친구 초대 삭제
router.delete('/:id', async (req, res) => {
    try {
        const db = getDb();
        const collection = db.collection('friend-invite');
        
        const result = await collection.deleteOne({ _id: new ObjectId(req.params.id) });
        
        if (result.deletedCount === 0) {
            return res.status(404).json({ 
                success: false, 
                message: '친구 초대 내역을 찾을 수 없습니다.' 
            });
        }
        
        res.json({ 
            success: true, 
            message: '친구 초대가 삭제되었습니다.' 
        });
    } catch (error) {
        console.error('친구 초대 삭제 오류:', error);
        res.status(500).json({ 
            success: false, 
            message: '친구 초대 삭제에 실패했습니다.',
            error: error.message 
        });
    }
});

module.exports = router; 