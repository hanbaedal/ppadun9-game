const express = require('express');
const router = express.Router();
// bcryptjs 제거 - 평문 비밀번호 저장으로 변경
const { getDb } = require('../config/db');
const { ObjectId } = require('mongodb'); // ObjectId 추가

// 운영자 등록
router.post('/register', async (req, res) => {
    try {
        const { username, password, name, email, phone } = req.body;
        
        // 필수 필드 검증
        if (!username || !password || !name) {
            return res.status(400).json({
                success: false,
                message: '아이디, 비밀번호, 이름은 필수입니다.'
            });
        }

        const db = getDb();
        const collection = db.collection('operate-member');

        // 아이디 중복 확인
        const existingOperator = await collection.findOne({ username });
        if (existingOperator) {
            return res.status(400).json({
                success: false,
                message: '이미 사용 중인 아이디입니다.'
            });
        }

        // 운영자 정보 생성 (비밀번호 평문 저장)
        const operatorData = {
            username,
            password: password, // 평문 비밀번호 저장
            name,
            email: email || '',
            phone: phone || '',
            role: 'operator',
            isActive: true,
            isApproved: false, // 관리자 승인 필요
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const result = await collection.insertOne(operatorData);

        res.json({
            success: true,
            message: '운영자 등록이 완료되었습니다. 관리자 승인 후 로그인이 가능합니다.',
            data: {
                _id: result.insertedId,
                username,
                name
            }
        });

    } catch (error) {
        console.error('운영자 등록 오류:', error);
        res.status(500).json({
            success: false,
            message: '운영자 등록 중 오류가 발생했습니다.'
        });
    }
});

// 운영자 로그인
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // 필수 필드 검증
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: '아이디와 비밀번호를 입력해주세요.'
            });
        }

        const db = getDb();
        const collection = db.collection('operate-member');

        // 운영자 정보 조회
        const operator = await collection.findOne({ username });
        if (!operator) {
            return res.status(401).json({
                success: false,
                message: '아이디 또는 비밀번호가 올바르지 않습니다.'
            });
        }

        // 계정 활성화 확인
        if (!operator.isActive) {
            return res.status(401).json({
                success: false,
                message: '비활성화된 계정입니다.'
            });
        }

        // 승인 상태 확인
        if (!operator.isApproved) {
            return res.status(401).json({
                success: false,
                message: '관리자 승인 대기 중입니다.'
            });
        }

        // 비밀번호 확인 (평문 비교)
        if (password !== operator.password) {
            return res.status(401).json({
                success: false,
                message: '아이디 또는 비밀번호가 올바르지 않습니다.'
            });
        }

        // 로그인 성공 - 세션 정보 업데이트
        await collection.updateOne(
            { _id: operator._id },
            { 
                $set: { 
                    lastLoginAt: new Date(),
                    isLoggedIn: true
                }
            }
        );

        res.json({
            success: true,
            message: '로그인 성공',
            data: {
                _id: operator._id,
                username: operator.username,
                name: operator.name,
                role: operator.role
            }
        });

    } catch (error) {
        console.error('운영자 로그인 오류:', error);
        res.status(500).json({
            success: false,
            message: '로그인 처리 중 오류가 발생했습니다.'
        });
    }
});

// 아이디 중복 체크
router.get('/check-username', async (req, res) => {
    try {
        const { username } = req.query;
        
        if (!username) {
            return res.status(400).json({
                success: false,
                message: '아이디를 입력해주세요.'
            });
        }

        const db = getDb();
        const collection = db.collection('operate-member');

        // 아이디 중복 확인
        const existingOperator = await collection.findOne({ username });
        
        res.json({
            success: true,
            isDuplicate: !!existingOperator,
            message: existingOperator ? '이미 사용 중인 아이디입니다.' : '사용 가능한 아이디입니다.'
        });

    } catch (error) {
        console.error('아이디 중복 체크 오류:', error);
        res.status(500).json({
            success: false,
            message: '아이디 중복 체크 중 오류가 발생했습니다.'
        });
    }
});

// 운영자 로그아웃
router.post('/logout', async (req, res) => {
    try {
        const { username } = req.body;
        
        if (!username) {
            return res.status(400).json({
                success: false,
                message: '사용자 정보가 없습니다.'
            });
        }

        const db = getDb();
        const collection = db.collection('OPERATE-MEMBER');

        // 로그아웃 상태 업데이트
        await collection.updateOne(
            { username },
            { 
                $set: { 
                    isLoggedIn: false,
                    lastLogoutAt: new Date()
                }
            }
        );

        res.json({
            success: true,
            message: '로그아웃되었습니다.'
        });

    } catch (error) {
        console.error('운영자 로그아웃 오류:', error);
        res.status(500).json({
            success: false,
            message: '로그아웃 처리 중 오류가 발생했습니다.'
        });
    }
});

// 운영자 정보 조회
router.get('/profile/:username', async (req, res) => {
    try {
        const { username } = req.params;
        
        const db = getDb();
        const collection = db.collection('operate-member');

        const operator = await collection.findOne(
            { username },
            { projection: { password: 0 } } // 비밀번호 제외
        );

        if (!operator) {
            return res.status(404).json({
                success: false,
                message: '운영자를 찾을 수 없습니다.'
            });
        }

        res.json({
            success: true,
            data: operator
        });

    } catch (error) {
        console.error('운영자 정보 조회 오류:', error);
        res.status(500).json({
            success: false,
            message: '운영자 정보 조회 중 오류가 발생했습니다.'
        });
    }
});

// 현재 로그인한 운영자 정보 조회
router.get('/me', async (req, res) => {
    try {
        // 세션에서 운영자 정보를 가져오는 로직 (실제로는 세션/토큰 기반으로 구현)
        // 여기서는 간단한 예시로 구현
        const { username } = req.query;
        
        if (!username) {
            return res.status(401).json({
                success: false,
                message: '로그인이 필요합니다.'
            });
        }

        const db = getDb();
        const collection = db.collection('operate-member');

        const operator = await collection.findOne(
            { username, isLoggedIn: true },
            { projection: { password: 0 } }
        );

        if (!operator) {
            return res.status(401).json({
                success: false,
                message: '로그인된 운영자를 찾을 수 없습니다.'
            });
        }

        res.json({
            success: true,
            data: operator
        });

    } catch (error) {
        console.error('현재 운영자 정보 조회 오류:', error);
        res.status(500).json({
            success: false,
            message: '운영자 정보 조회 중 오류가 발생했습니다.'
        });
    }
});

// 운영자에게 할당된 경기 조회
router.get('/:operatorId/assigned-games', async (req, res) => {
    try {
        const { operatorId } = req.params;
        
        const db = getDb();
        const teamGamesCollection = db.collection('team-games');
        
        // 해당 운영자에게 할당된 경기 조회
        const assignedGames = await teamGamesCollection.find({ 
            assignedOperator: operatorId 
        }).toArray();
        
        res.json({
            success: true,
            data: assignedGames
        });

    } catch (error) {
        console.error('할당된 경기 조회 오류:', error);
        res.status(500).json({
            success: false,
            message: '할당된 경기 조회 중 오류가 발생했습니다.'
        });
    }
});

// ===== 관리자용 승인 관리 API =====

// 승인 대기 중인 운영자 목록 조회
router.get('/pending', async (req, res) => {
    try {
        const db = getDb();
        const collection = db.collection('operate-member');
        
        const pendingOperators = await collection.find(
            { isApproved: false, isActive: true },
            { projection: { password: 0 } }
        ).toArray();
        
        res.json({
            success: true,
            data: pendingOperators
        });
    } catch (error) {
        console.error('승인 대기 운영자 조회 오류:', error);
        res.status(500).json({
            success: false,
            message: '승인 대기 운영자 조회 실패'
        });
    }
});

// 운영자 승인/거부
router.put('/approve/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { isApproved, reason } = req.body;
        
        const db = getDb();
        const collection = db.collection('operate-member');
        
        const result = await collection.updateOne(
            { _id: new ObjectId(id) },
            { 
                $set: { 
                    isApproved,
                    approvedAt: new Date(),
                    approvalReason: reason || '',
                    updatedAt: new Date()
                }
            }
        );
        
        if (result.modifiedCount > 0) {
            res.json({
                success: true,
                message: isApproved ? '운영자가 승인되었습니다.' : '운영자 승인이 거부되었습니다.'
            });
        } else {
            res.status(404).json({
                success: false,
                message: '운영자를 찾을 수 없습니다.'
            });
        }
    } catch (error) {
        console.error('운영자 승인 처리 오류:', error);
        res.status(500).json({
            success: false,
            message: '승인 처리 실패'
        });
    }
});

// 전체 운영자 목록 조회 (관리자용)
router.get('/all', async (req, res) => {
    try {
        const db = getDb();
        const collection = db.collection('operate-member');
        
        const allOperators = await collection.find(
            {},
            { projection: { password: 0 } }
        ).toArray();
        
        res.json({
            success: true,
            data: allOperators
        });
    } catch (error) {
        console.error('전체 운영자 조회 오류:', error);
        res.status(500).json({
            success: false,
            message: '전체 운영자 조회 실패'
        });
    }
});

module.exports = router;
