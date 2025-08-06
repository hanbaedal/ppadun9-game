const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const { getDb } = require('../config/db');
const { getKoreanTime } = require('../utils/korean-time');

// 데이터베이스 컬렉션 목록 확인 (디버깅용)
router.get('/debug/collections', async (req, res) => {
    try {
        const db = getDb();
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
        
        const db = getDb();
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
        
        const db = getDb();
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
        
        const db = getDb();
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
        
        const db = getDb();
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
                    updatedAt: getKoreanTime()
                }
            }
        );
        
        // 세션에 사용자 정보 저장
        req.session.userId = userId;
        req.session.userType = 'member';
        req.session.isLoggedIn = true;
        
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
        
        const db = getDb();
        const collection = db.collection('game-member');
        
        // 로그아웃 정보 업데이트
        await collection.updateOne(
            { userId },
            {
                $set: {
                    isLoggedIn: false,
                    lastLogoutAt: getKoreanTime(),
                    updatedAt: getKoreanTime()
                }
            }
        );
        
        // 세션 정리
        req.session.destroy((err) => {
            if (err) {
                console.error('세션 정리 오류:', err);
            }
        });
        
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

// 로그인 상태 확인 API
router.get('/check-login', async (req, res) => {
    try {
        console.log('로그인 상태 확인 요청:', {
            session: req.session,
            sessionID: req.sessionID,
            cookies: req.headers.cookie
        });
        
        // 세션에서 로그인 상태 확인
        if (req.session && req.session.isLoggedIn && req.session.userId) {
            const db = getDb();
            const collection = db.collection('game-member');
            
            // 데이터베이스에서 최신 회원 정보 조회
            const member = await collection.findOne({ userId: req.session.userId });
            
            if (member) {
                const { password, ...memberInfo } = member;
                console.log('로그인된 사용자 확인:', memberInfo.userId);
                res.json({
                    success: true,
                    message: '로그인된 상태입니다.',
                    user: memberInfo
                });
            } else {
                // 세션은 있지만 데이터베이스에 없는 경우
                console.log('세션은 있지만 데이터베이스에 사용자 없음');
                req.session.destroy();
                res.json({
                    success: false,
                    message: '로그인되지 않았습니다.',
                    user: null
                });
            }
        } else {
            console.log('세션에 로그인 정보 없음');
            res.json({
                success: false,
                message: '로그인되지 않았습니다.',
                user: null
            });
        }
    } catch (error) {
        console.error('로그인 상태 확인 오류:', error);
        res.status(500).json({
            success: false,
            message: '서버 오류가 발생했습니다.'
        });
    }
});

// 회원 로그인 통계 API
router.get('/login-stats', async (req, res) => {
    try {
        console.log('[Members] 회원 로그인 통계 요청');
        const db = getDb();
        
        // 전체 회원 수
        const totalMembers = await db.collection('game-member').countDocuments();
        console.log('[Members] 전체 회원 수:', totalMembers);
        
        // 현재 로그인한 회원 수 (실제 isLoggedIn: true인 회원들)
        const onlineMembers = await db.collection('game-member').countDocuments({ isLoggedIn: true });
        console.log('[Members] 현재 로그인한 회원 수:', onlineMembers);
        
        // 로그인한 회원들 (현재 온라인) - 실제 데이터 조회
        // 최근 1시간 내에 활동이 있는 회원들도 포함 (더 넓은 범위)
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const onlineMembersList = await db.collection('game-member').find(
            { 
                $or: [
                    { isLoggedIn: true },
                    { 
                        lastLoginAt: { $gte: oneHourAgo },
                        $or: [
                            { lastLogoutAt: { $exists: false } },
                            { lastLogoutAt: null },
                            { lastLogoutAt: { $lt: lastLoginAt } }
                        ]
                    }
                ]
            },
            { 
                _id: 1,
                userId: 1, 
                name: 1, 
                lastLoginAt: 1, 
                lastLogoutAt: 1,
                loginCount: 1,
                isLoggedIn: 1,
                createdAt: 1
            }
        ).sort({ lastLoginAt: -1 }).toArray();
        
        console.log('[Members] 온라인 회원 목록 조회 결과:', onlineMembersList.length, '명');
        console.log('[Members] 온라인 회원 상세:', onlineMembersList);
        
        // 추가 디버깅: 쿼리 조건 확인
        console.log('[Members] 쿼리 조건:', {
            oneHourAgo: oneHourAgo,
            isLoggedInTrue: await db.collection('game-member').countDocuments({ isLoggedIn: true }),
            recentLogin: await db.collection('game-member').countDocuments({ lastLoginAt: { $gte: oneHourAgo } }),
            totalMembers: await db.collection('game-member').countDocuments({})
        });
        
        // 최근 로그인한 회원들 (24시간 이내)
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recentLoginMembers = await db.collection('game-member').find(
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
        
        // 총 로그인 시간 계산 함수
        function calculateTotalLoginTime(member) {
            try {
                if (!member.lastLoginAt) {
                    return '로그인 기록 없음';
                }
                
                const loginTime = new Date(member.lastLoginAt);
                let logoutTime = member.lastLogoutAt ? new Date(member.lastLogoutAt) : new Date();
                
                // 현재 로그인 중인 경우 현재 시간 사용
                if (member.isLoggedIn) {
                    logoutTime = new Date();
                }
                
                const diffTime = Math.abs(logoutTime - loginTime);
                const diffMinutes = Math.floor(diffTime / (1000 * 60));
                const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                
                if (diffMinutes < 60) {
                    return `${diffMinutes}분`;
                } else if (diffHours < 24) {
                    return `${diffHours}시간 ${diffMinutes % 60}분`;
                } else {
                    return `${diffDays}일 ${diffHours % 24}시간`;
                }
            } catch (error) {
                console.error('총 로그인 시간 계산 오류:', error);
                return '계산 오류';
            }
        }
        
        // 각 회원에 총 로그인 시간 추가
        onlineMembersList.forEach(member => {
            member.totalLoginTime = calculateTotalLoginTime(member);
        });
        
        // 실제 온라인 회원 수 (목록 길이 기반)
        const actualOnlineMembers = onlineMembersList.length;
        
        // 추가 디버깅: 모든 회원 조회
        const allMembers = await db.collection('game-member').find({}, { 
            userId: 1, 
            name: 1, 
            isLoggedIn: 1, 
            lastLoginAt: 1 
        }).toArray();
        
        console.log('[Members] 전체 회원 상태:', allMembers.map(m => ({
            name: m.name,
            userId: m.userId,
            isLoggedIn: m.isLoggedIn,
            lastLoginAt: m.lastLoginAt
        })));
        
        console.log('[Members] 통계 요약:', {
            totalMembers,
            onlineMembers,
            actualOnlineMembers,
            onlineMembersListCount: onlineMembersList.length,
            allMembersCount: allMembers.length
        });
        
        res.json({
            success: true,
            stats: {
                totalMembers: totalMembers,
                onlineMembers: actualOnlineMembers, // 실제 온라인 회원 수로 반환
                recentLoginMembers: recentLoginMembers,
                onlineMembersList: onlineMembersList
            }
        });
    } catch (error) {
        console.error('[Members] 회원 로그인 통계 오류:', error);
        res.status(500).json({
            success: false,
            message: '서버 오류가 발생했습니다.'
        });
    }
});

// 회원 로그인 상태 디버깅 API
router.get('/debug-login-status', async (req, res) => {
    try {
        console.log('[Members] 회원 로그인 상태 디버깅 요청');
        const db = getDb();
        
        // 모든 회원의 로그인 상태 조회
        const allMembers = await db.collection('game-member').find({}, { 
            _id: 1,
            userId: 1, 
            name: 1, 
            isLoggedIn: 1, 
            lastLoginAt: 1,
            lastLogoutAt: 1
        }).toArray();
        
        // 로그인된 사용자들만 필터링
        const loggedInMembers = allMembers.filter(member => member.isLoggedIn === true);
        
        console.log('[Members] 디버깅 정보:', {
            totalMembers: allMembers.length,
            loggedInMembers: loggedInMembers.length,
            allMembers: allMembers,
            loggedInMembersList: loggedInMembers
        });
        
        res.json({
            success: true,
            debug: {
                totalMembers: allMembers.length,
                loggedInMembers: loggedInMembers.length,
                allMembers: allMembers,
                loggedInMembersList: loggedInMembers
            }
        });
    } catch (error) {
        console.error('[Members] 회원 로그인 상태 디버깅 오류:', error);
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
        
        const db = getDb();
        const collection = db.collection('game-member');
        
        // 회원을 강제 로그아웃 상태로 변경
        const result = await collection.updateOne(
            { _id: new ObjectId(id) },
            { 
                $set: { 
                    isLoggedIn: false,
                    lastLogoutAt: getKoreanTime(),
                    updatedAt: getKoreanTime()
                } 
            }
        );
        
        if (result.matchedCount > 0) {
            // 강제 로그아웃된 회원 정보 조회
            const loggedOutMember = await collection.findOne(
                { _id: new ObjectId(id) },
                { userId: 1, name: 1, isLoggedIn: 1, lastLogoutAt: 1 }
            );
            
            const koreanTime = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
            console.log(`[${koreanTime}] 강제 로그아웃 완료: ${loggedOutMember.name}(${loggedOutMember.userId})`);
            
            res.json({
                success: true,
                message: `${loggedOutMember.name} 회원이 강제 로그아웃되었습니다.`,
                member: {
                    id: loggedOutMember._id,
                    userId: loggedOutMember.userId,
                    name: loggedOutMember.name,
                    isLoggedIn: loggedOutMember.isLoggedIn,
                    lastLogoutAt: loggedOutMember.lastLogoutAt
                },
                timestamp: koreanTime
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
        const db = getDb();
        
        // 현재 로그인된 모든 회원을 로그아웃 처리
        const result = await db.collection('game-member').updateMany(
            { isLoggedIn: true },
            { 
                $set: { 
                    isLoggedIn: false,
                    lastLogoutAt: getKoreanTime(),
                    updatedAt: getKoreanTime()
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
        const db = getDb();
        
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
                        updatedAt: getKoreanTime()
                    } 
                }
            },
            // updatedAt 필드가 없는 회원들에게 기본값 설정
            {
                filter: { updatedAt: { $exists: false } },
                update: { 
                    $set: { 
                        updatedAt: getKoreanTime()
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

module.exports = router;