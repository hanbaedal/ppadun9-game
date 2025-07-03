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
router.get('/', async (req, res) => {
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
router.put('/:id', async (req, res) => {
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
router.delete('/:id', async (req, res) => {
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

// 회원 로그인 API
router.post('/login', async (req, res) => {
    try {
        const { userId, password } = req.body;
        
        if (!userId || !password) {
            return res.status(400).json({
                success: false,
                message: '아이디와 비밀번호를 모두 입력해주세요.'
            });
        }
        
        if (!db) {
            return res.status(503).json({
                success: false,
                message: '데이터베이스 연결이 준비되지 않았습니다.'
            });
        }
        
        const collection = db.collection('game-member');
        
        // 회원 검색
        const member = await collection.findOne({ userId });
        
        if (!member) {
            return res.status(401).json({
                success: false,
                message: '아이디 또는 비밀번호가 올바르지 않습니다.'
            });
        }
        
        // 비밀번호 확인 (실제로는 해시화된 비밀번호와 비교해야 함)
        if (member.password !== password) {
            return res.status(401).json({
                success: false,
                message: '아이디 또는 비밀번호가 올바르지 않습니다.'
            });
        }
        
        // 로그인 정보 업데이트
        const loginCount = (member.loginCount || 0) + 1;
        const lastLoginAt = new Date();
        
        await collection.updateOne(
            { userId },
            {
                $set: {
                    loginCount: loginCount,
                    lastLoginAt: lastLoginAt,
                    isLoggedIn: true,
                    updatedAt: new Date()
                }
            }
        );
        
        // 비밀번호 제외하고 회원 정보 반환
        const { password: _, ...memberInfo } = member;
        const updatedMemberInfo = {
            ...memberInfo,
            loginCount: loginCount,
            lastLoginAt: lastLoginAt,
            isLoggedIn: true
        };
        
        res.json({
            success: true,
            message: '로그인이 성공했습니다.',
            member: updatedMemberInfo
        });
    } catch (error) {
        console.error('회원 로그인 오류:', error);
        res.status(500).json({
            success: false,
            message: '서버 오류가 발생했습니다.'
        });
    }
});

// 회원 로그아웃 API
router.post('/logout', async (req, res) => {
    try {
        const { userId } = req.body;
        
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: '회원 ID가 필요합니다.'
            });
        }
        
        if (!db) {
            return res.status(503).json({
                success: false,
                message: '데이터베이스 연결이 준비되지 않았습니다.'
            });
        }
        
        const collection = db.collection('game-member');
        
        // 로그아웃 정보 업데이트
        await collection.updateOne(
            { userId },
            {
                $set: {
                    isLoggedIn: false,
                    lastLogoutAt: new Date(),
                    updatedAt: new Date()
                }
            }
        );
        
        res.json({
            success: true,
            message: '로그아웃되었습니다.'
        });
    } catch (error) {
        console.error('회원 로그아웃 오류:', error);
        res.status(500).json({
            success: false,
            message: '서버 오류가 발생했습니다.'
        });
    }
});

// 회원 로그인 통계 API
router.get('/login-stats', async (req, res) => {
    try {
        if (!db) {
            return res.status(503).json({
                success: false,
                message: '데이터베이스 연결이 준비되지 않았습니다.'
            });
        }
        
        const collection = db.collection('game-member');
        
        // 전체 회원 수
        const totalMembers = await collection.countDocuments();
        
        // 현재 로그인한 회원 수
        const onlineMembers = await collection.countDocuments({ isLoggedIn: true });
        
        // 최근 로그인한 회원들 (24시간 이내) - 더 많은 정보 포함
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recentLoginMembers = await collection.find(
            { lastLoginAt: { $gte: oneDayAgo } },
            { 
                userId: 1, 
                name: 1, 
                lastLoginAt: 1, 
                lastLogoutAt: 1,
                loginCount: 1,
                isLoggedIn: 1,
                createdAt: 1
            }
        ).sort({ lastLoginAt: -1 }).toArray();
        
        // 로그인한 회원들 (현재 온라인)
        const onlineMembersList = await collection.find(
            { isLoggedIn: true },
            { 
                userId: 1, 
                name: 1, 
                lastLoginAt: 1, 
                lastLogoutAt: 1,
                loginCount: 1,
                isLoggedIn: 1,
                createdAt: 1
            }
        ).sort({ lastLoginAt: -1 }).toArray();
        
        res.json({
            success: true,
            stats: {
                totalMembers: totalMembers,
                onlineMembers: onlineMembers,
                recentLoginMembers: recentLoginMembers,
                onlineMembersList: onlineMembersList
            }
        });
    } catch (error) {
        console.error('회원 로그인 통계 오류:', error);
        res.status(500).json({
            success: false,
            message: '서버 오류가 발생했습니다.'
        });
    }
});

// 강제 로그아웃 API
router.post('/:id/force-logout', async (req, res) => {
    try {
        const { id } = req.params;
        
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: '올바르지 않은 회원 ID 형식입니다.'
            });
        }
        
        if (!db) {
            return res.status(503).json({
                success: false,
                message: '데이터베이스 연결이 준비되지 않았습니다.'
            });
        }
        
        const collection = db.collection('game-member');
        
        // 회원을 강제 로그아웃 상태로 변경
        const result = await collection.updateOne(
            { _id: new ObjectId(id) },
            { 
                $set: { 
                    isLoggedIn: false,
                    lastLogoutAt: new Date(),
                    updatedAt: new Date()
                } 
            }
        );
        
        if (result.matchedCount > 0) {
            res.json({
                success: true,
                message: '회원이 강제 로그아웃되었습니다.'
            });
        } else {
            res.status(404).json({
                success: false,
                message: '회원을 찾을 수 없습니다.'
            });
        }
    } catch (error) {
        console.error('강제 로그아웃 오류:', error);
        res.status(500).json({
            success: false,
            message: '서버 오류가 발생했습니다.'
        });
    }
});

// 회원 수동 자동 로그아웃 API (관리자용)
router.post('/auto-logout-all', async (req, res) => {
    try {
        if (!db) {
            return res.status(503).json({
                success: false,
                message: '데이터베이스 연결이 준비되지 않았습니다.'
            });
        }
        
        const collection = db.collection('game-member');
        
        // 현재 로그인된 모든 회원을 로그아웃 처리
        const result = await collection.updateMany(
            { isLoggedIn: true },
            { 
                $set: { 
                    isLoggedIn: false,
                    lastLogoutAt: new Date(),
                    updatedAt: new Date()
                } 
            }
        );
        
        const koreanTime = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
        console.log(`[${koreanTime}] 수동 회원 자동 로그아웃 완료: ${result.modifiedCount}명의 회원이 로그아웃되었습니다.`);
        
        res.json({
            success: true,
            message: `${result.modifiedCount}명의 회원이 자동 로그아웃되었습니다.`,
            logoutCount: result.modifiedCount,
            timestamp: koreanTime
        });
    } catch (error) {
        console.error('수동 회원 자동 로그아웃 오류:', error);
        res.status(500).json({
            success: false,
            message: '서버 오류가 발생했습니다.'
        });
    }
});

// 회원 데이터베이스 스키마 업데이트 API
router.post('/update-schema', async (req, res) => {
    try {
        if (!db) {
            return res.status(503).json({
                success: false,
                message: '데이터베이스 연결이 준비되지 않았습니다.'
            });
        }
        
        const collection = db.collection('game-member');
        
        // 새로운 필드들을 기존 회원들에게 추가
        const updateOperations = [
            // lastLoginAt 필드가 없는 회원들에게 기본값 설정
            {
                filter: { lastLoginAt: { $exists: false } },
                update: { 
                    $set: { 
                        lastLoginAt: null,
                        loginCount: 0,
                        isLoggedIn: false,
                        lastLogoutAt: null,
                        updatedAt: new Date()
                    } 
                }
            },
            // updatedAt 필드가 없는 회원들에게 기본값 설정
            {
                filter: { updatedAt: { $exists: false } },
                update: { 
                    $set: { 
                        updatedAt: new Date()
                    } 
                }
            }
        ];
        
        const results = [];
        
        for (const operation of updateOperations) {
            const result = await collection.updateMany(
                operation.filter,
                operation.update
            );
            results.push(result);
        }
        
        console.log('회원 스키마 업데이트 결과:', results);
        
        res.json({
            success: true,
            message: '회원 데이터베이스 스키마 업데이트가 완료되었습니다.',
            results: results.map((result, index) => ({
                operation: index + 1,
                modifiedCount: result.modifiedCount,
                matchedCount: result.matchedCount
            }))
        });
    } catch (error) {
        console.error('회원 스키마 업데이트 오류:', error);
        res.status(500).json({
            success: false,
            message: '서버 오류가 발생했습니다.'
        });
    }
});

module.exports = { router, setDatabase }; 