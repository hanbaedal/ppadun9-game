const express = require('express');
const { ObjectId } = require('mongodb');
const { getDb } = require('../config/db');
const { getKoreanTime, formatKoreanTime } = require('../utils/korean-time');
const bcrypt = require('bcryptjs');

const router = express.Router();

// 운영자 목록 조회 (페이지네이션, 검색, 필터링 지원)
router.get('/', async (req, res) => {
    try {
        const db = getDb();
        const collection = db.collection('OPERATE-MEMBER');
        
        const {
            page = 1,
            limit = 10,
            search = '',
            department = '',
            position = '',
            isApproved = '',
            isLoggedIn = ''
        } = req.query;
        
        // 검색 조건 구성
        const filter = {};
        
        // 검색어가 있는 경우
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { username: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { phone: { $regex: search, $options: 'i' } }
            ];
        }
        
        // 부서 필터
        if (department) {
            filter.department = department;
        }
        
        // 직책 필터
        if (position) {
            filter.position = position;
        }
        
        // 승인 상태 필터
        if (isApproved !== '') {
            filter.isApproved = isApproved === 'true';
        }
        
        // 로그인 상태 필터
        if (isLoggedIn !== '') {
            filter.isLoggedIn = isLoggedIn === 'true';
        }
        
        // 전체 문서 수 조회
        const totalCount = await collection.countDocuments(filter);
        
        // 페이지네이션 적용
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const operators = await collection
            .find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .toArray();
        
        // 비밀번호 제외하고 반환
        const safeOperators = operators.map(op => {
            const { password, ...safeOp } = op;
            return safeOp;
        });
        
        res.json({
            success: true,
            data: safeOperators,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalCount / parseInt(limit)),
                totalCount,
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        console.error('운영자 목록 조회 오류:', error);
        res.status(500).json({
            success: false,
            message: '운영자 목록 조회 중 오류가 발생했습니다.',
            error: error.message
        });
    }
});

// 운영자 상세 조회
router.get('/:id', async (req, res) => {
    try {
        const db = getDb();
        const collection = db.collection('OPERATE-MEMBER');
        const { id } = req.params;
        
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: '올바르지 않은 운영자 ID 형식입니다.'
            });
        }
        
        const operator = await collection.findOne({ _id: new ObjectId(id) });
        if (!operator) {
            return res.status(404).json({
                success: false,
                message: '운영자를 찾을 수 없습니다.'
            });
        }
        
        // 비밀번호 제외하고 반환
        const { password, ...safeOperator } = operator;
        res.json({
            success: true,
            data: safeOperator
        });
    } catch (error) {
        console.error('운영자 상세 조회 오류:', error);
        res.status(500).json({
            success: false,
            message: '운영자 상세 조회 중 오류가 발생했습니다.',
            error: error.message
        });
    }
});

// 운영자 등록
router.post('/', async (req, res) => {
    try {
        const db = getDb();
        const collection = db.collection('OPERATE-MEMBER');
        
        const {
            name,
            email,
            username,
            password,
            position,
            department,
            phone,
            role,
            permissions
        } = req.body;
        
        // 필수 필드 검증
        if (!name || !username || !password) {
            return res.status(400).json({
                success: false,
                message: '이름, 아이디, 비밀번호는 필수 입력 항목입니다.'
            });
        }
        
        // 아이디 중복 확인
        const existingOperator = await collection.findOne({ username });
        if (existingOperator) {
            return res.status(400).json({
                success: false,
                message: '이미 등록된 아이디가 있습니다.'
            });
        }
        
        // 이메일 중복 확인 (이메일이 제공된 경우)
        if (email) {
            const existingEmail = await collection.findOne({ email });
            if (existingEmail) {
                return res.status(400).json({
                    success: false,
                    message: '이미 등록된 이메일이 있습니다.'
                });
            }
        }
        
        // 비밀번호 해시화
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        
        // 새 운영자 데이터 생성
        const newOperator = {
            name,
            email: email || '',
            username,
            password: hashedPassword,
            position: position || '',
            department: department || '',
            phone: phone || '',
            role: role || 'operator',
            permissions: permissions || [],
            isLoggedIn: false,
            loginCount: 0,
            lastLoginAt: null,
            lastActivityAt: null,
            lastLogoutAt: null,
            isApproved: false,
            approvedAt: null,
            approvedBy: null,
            isActive: true,
            createdAt: getKoreanTime(),
            updatedAt: getKoreanTime()
        };
        
        const result = await collection.insertOne(newOperator);
        
        // 생성된 운영자 정보 반환 (비밀번호 제외)
        const { password: _, ...safeOperator } = newOperator;
        safeOperator._id = result.insertedId;
        
        res.status(201).json({
            success: true,
            message: '운영자가 성공적으로 등록되었습니다.',
            data: safeOperator
        });
    } catch (error) {
        console.error('운영자 등록 오류:', error);
        res.status(500).json({
            success: false,
            message: '운영자 등록 중 오류가 발생했습니다.',
            error: error.message
        });
    }
});

// 운영자 정보 수정
router.put('/:id', async (req, res) => {
    try {
        const db = getDb();
        const collection = db.collection('OPERATE-MEMBER');
        const { id } = req.params;
        
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: '올바르지 않은 운영자 ID 형식입니다.'
            });
        }
        
        const {
            name,
            email,
            username,
            password,
            position,
            department,
            phone,
            role,
            permissions,
            isApproved,
            isActive
        } = req.body;
        
        // 기존 운영자 정보 조회
        const existingOperator = await collection.findOne({ _id: new ObjectId(id) });
        if (!existingOperator) {
            return res.status(404).json({
                success: false,
                message: '운영자를 찾을 수 없습니다.'
            });
        }
        
        // 업데이트할 데이터 구성
        const updateData = {
            updatedAt: getKoreanTime()
        };
        
        if (name) updateData.name = name;
        if (email !== undefined) updateData.email = email;
        if (position !== undefined) updateData.position = position;
        if (department !== undefined) updateData.department = department;
        if (phone !== undefined) updateData.phone = phone;
        if (role !== undefined) updateData.role = role;
        if (permissions !== undefined) updateData.permissions = permissions;
        if (isActive !== undefined) updateData.isActive = isActive;
        if (isApproved !== undefined) {
            updateData.isApproved = isApproved;
            if (isApproved && !existingOperator.isApproved) {
                updateData.approvedAt = getKoreanTime();
                updateData.approvedBy = req.user?.username || 'system';
            }
        }
        
        // 아이디 변경 요청이 있는 경우 중복 확인
        if (username && username !== existingOperator.username) {
            const duplicateUsername = await collection.findOne({ username });
            if (duplicateUsername) {
                return res.status(400).json({
                    success: false,
                    message: '이미 사용 중인 아이디입니다.'
                });
            }
            updateData.username = username;
        }
        
        // 이메일 변경 요청이 있는 경우 중복 확인
        if (email && email !== existingOperator.email) {
            const duplicateEmail = await collection.findOne({ email });
            if (duplicateEmail) {
                return res.status(400).json({
                    success: false,
                    message: '이미 사용 중인 이메일입니다.'
                });
            }
        }
        
        // 비밀번호 변경 요청이 있는 경우 해시화
        if (password) {
            const saltRounds = 10;
            updateData.password = await bcrypt.hash(password, saltRounds);
        }
        
        const result = await collection.updateOne(
            { _id: new ObjectId(id) },
            { $set: updateData }
        );
        
        if (result.matchedCount === 0) {
            return res.status(404).json({
                success: false,
                message: '운영자를 찾을 수 없습니다.'
            });
        }
        
        res.json({
            success: true,
            message: '운영자 정보가 성공적으로 수정되었습니다.'
        });
    } catch (error) {
        console.error('운영자 정보 수정 오류:', error);
        res.status(500).json({
            success: false,
            message: '운영자 정보 수정 중 오류가 발생했습니다.',
            error: error.message
        });
    }
});

// 운영자 삭제
router.delete('/:id', async (req, res) => {
    try {
        const db = getDb();
        const collection = db.collection('OPERATE-MEMBER');
        const { id } = req.params;
        
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: '올바르지 않은 운영자 ID 형식입니다.'
            });
        }
        
        // 기존 운영자 정보 조회
        const existingOperator = await collection.findOne({ _id: new ObjectId(id) });
        if (!existingOperator) {
            return res.status(404).json({
                success: false,
                message: '운영자를 찾을 수 없습니다.'
            });
        }
        
        // 현재 로그인된 운영자는 삭제 불가
        if (existingOperator.isLoggedIn) {
            return res.status(400).json({
                success: false,
                message: '현재 로그인된 운영자는 삭제할 수 없습니다. 먼저 로그아웃 후 다시 시도해주세요.'
            });
        }
        
        const result = await collection.deleteOne({ _id: new ObjectId(id) });
        
        if (result.deletedCount === 0) {
            return res.status(404).json({
                success: false,
                message: '운영자를 찾을 수 없습니다.'
            });
        }
        
        res.json({
            success: true,
            message: '운영자가 성공적으로 삭제되었습니다.'
        });
    } catch (error) {
        console.error('운영자 삭제 오류:', error);
        res.status(500).json({
            success: false,
            message: '운영자 삭제 중 오류가 발생했습니다.',
            error: error.message
        });
    }
});

// 운영자 승인/반려
router.patch('/:id/approval', async (req, res) => {
    try {
        const db = getDb();
        const collection = db.collection('OPERATE-MEMBER');
        const { id } = req.params;
        const { isApproved, approvedBy } = req.body;
        
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: '올바르지 않은 운영자 ID 형식입니다.'
            });
        }
        
        if (typeof isApproved !== 'boolean') {
            return res.status(400).json({
                success: false,
                message: '승인 상태는 boolean 값이어야 합니다.'
            });
        }
        
        const updateData = {
            isApproved,
            updatedAt: getKoreanTime()
        };
        
        if (isApproved) {
            updateData.approvedAt = getKoreanTime();
            updateData.approvedBy = approvedBy || req.user?.username || 'system';
        } else {
            updateData.approvedAt = null;
            updateData.approvedBy = null;
        }
        
        const result = await collection.updateOne(
            { _id: new ObjectId(id) },
            { $set: updateData }
        );
        
        if (result.matchedCount === 0) {
            return res.status(404).json({
                success: false,
                message: '운영자를 찾을 수 없습니다.'
            });
        }
        
        const statusMessage = isApproved ? '승인' : '반려';
        res.json({
            success: true,
            message: `운영자가 성공적으로 ${statusMessage}되었습니다.`
        });
    } catch (error) {
        console.error('운영자 승인/반려 오류:', error);
        res.status(500).json({
            success: false,
            message: '운영자 승인/반려 중 오류가 발생했습니다.',
            error: error.message
        });
    }
});

// 운영자 로그인
router.post('/login', async (req, res) => {
    try {
        const db = getDb();
        const collection = db.collection('OPERATE-MEMBER');
        
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: '아이디와 비밀번호를 모두 입력해주세요.'
            });
        }
        
        // 운영자 검색
        const operator = await collection.findOne({ username });
        if (!operator) {
            return res.status(401).json({
                success: false,
                message: '아이디 또는 비밀번호가 올바르지 않습니다.'
            });
        }
        
        // 비밀번호 확인
        const isPasswordValid = await bcrypt.compare(password, operator.password);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: '아이디 또는 비밀번호가 올바르지 않습니다.'
            });
        }
        
        // 승인 상태 확인
        if (!operator.isApproved) {
            return res.status(403).json({
                success: false,
                message: '관리자 승인이 필요합니다. 승인 후 로그인이 가능합니다.'
            });
        }
        
        // 활성 상태 확인
        if (!operator.isActive) {
            return res.status(403).json({
                success: false,
                message: '비활성화된 계정입니다. 관리자에게 문의하세요.'
            });
        }
        
        // 이미 로그인된 상태인지 확인
        if (operator.isLoggedIn) {
            return res.status(409).json({
                success: false,
                message: '이미 다른 기기에서 로그인되어 있습니다.'
            });
        }
        
        // 로그인 처리
        const updateData = {
            isLoggedIn: true,
            loginCount: operator.loginCount + 1,
            lastLoginAt: getKoreanTime(),
            lastActivityAt: getKoreanTime(),
            updatedAt: getKoreanTime()
        };
        
        await collection.updateOne(
            { _id: operator._id },
            { $set: updateData }
        );
        
        // 세션에 운영자 정보 저장
        req.session.operator = {
            _id: operator._id,
            username: operator.username,
            name: operator.name,
            role: operator.role,
            permissions: operator.permissions
        };
        
        // 비밀번호 제외하고 반환
        const { password: _, ...safeOperator } = operator;
        res.json({
            success: true,
            message: '로그인이 성공했습니다.',
            data: safeOperator
        });
    } catch (error) {
        console.error('운영자 로그인 오류:', error);
        res.status(500).json({
            success: false,
            message: '로그인 중 오류가 발생했습니다.',
            error: error.message
        });
    }
});

// 운영자 로그아웃
router.post('/logout', async (req, res) => {
    try {
        const db = getDb();
        const collection = db.collection('OPERATE-MEMBER');
        
        if (!req.session.operator) {
            return res.status(400).json({
                success: false,
                message: '로그인되지 않은 상태입니다.'
            });
        }
        
        // 로그아웃 처리
        await collection.updateOne(
            { _id: new ObjectId(req.session.operator._id) },
            { 
                $set: { 
                    isLoggedIn: false,
                    lastLogoutAt: getKoreanTime(),
                    updatedAt: getKoreanTime()
                } 
            }
        );
        
        // 세션 삭제
        req.session.destroy();
        
        res.json({
            success: true,
            message: '로그아웃이 완료되었습니다.'
        });
    } catch (error) {
        console.error('운영자 로그아웃 오류:', error);
        res.status(500).json({
            success: false,
            message: '로그아웃 중 오류가 발생했습니다.',
            error: error.message
        });
    }
});

// 현재 로그인된 운영자 정보 조회
router.get('/current-user', async (req, res) => {
    try {
        if (!req.session.operator) {
            return res.status(401).json({
                success: false,
                message: '로그인되지 않았습니다.',
                data: null
            });
        }
        
        const db = getDb();
        const collection = db.collection('OPERATE-MEMBER');
        
        const operator = await collection.findOne({ _id: new ObjectId(req.session.operator._id) });
        if (!operator) {
            return res.status(404).json({
                success: false,
                message: '운영자 정보를 찾을 수 없습니다.',
                data: null
            });
        }
        
        // 비밀번호 제외하고 반환
        const { password, ...safeOperator } = operator;
        res.json({
            success: true,
            data: safeOperator
        });
    } catch (error) {
        console.error('현재 운영자 정보 조회 오류:', error);
        res.status(500).json({
            success: false,
            message: '운영자 정보 조회 중 오류가 발생했습니다.',
            error: error.message
        });
    }
});

// 운영자 통계 조회
router.get('/stats/overview', async (req, res) => {
    try {
        const db = getDb();
        const collection = db.collection('OPERATE-MEMBER');
        
        // 전체 운영자 수
        const totalOperators = await collection.countDocuments();
        
        // 승인된 운영자 수
        const approvedOperators = await collection.countDocuments({ isApproved: true });
        
        // 승인 대기 중인 운영자 수
        const pendingOperators = await collection.countDocuments({ isApproved: false });
        
        // 현재 로그인된 운영자 수
        const loggedInOperators = await collection.countDocuments({ isLoggedIn: true });
        
        // 활성 운영자 수
        const activeOperators = await collection.countDocuments({ isActive: true });
        
        // 부서별 운영자 수
        const departmentStats = await collection.aggregate([
            { $group: { _id: '$department', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]).toArray();
        
        // 직책별 운영자 수
        const positionStats = await collection.aggregate([
            { $group: { _id: '$position', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]).toArray();
        
        // 역할별 운영자 수
        const roleStats = await collection.aggregate([
            { $group: { _id: '$role', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]).toArray();
        
        res.json({
            success: true,
            data: {
                totalOperators,
                approvedOperators,
                pendingOperators,
                loggedInOperators,
                activeOperators,
                departmentStats,
                positionStats,
                roleStats
            }
        });
    } catch (error) {
        console.error('운영자 통계 조회 오류:', error);
        res.status(500).json({
            success: false,
            message: '운영자 통계 조회 중 오류가 발생했습니다.',
            error: error.message
        });
    }
});

// 운영자 대량 작업 (승인/반려)
router.patch('/bulk/approval', async (req, res) => {
    try {
        const db = getDb();
        const collection = db.collection('OPERATE-MEMBER');
        const { operatorIds, isApproved, approvedBy } = req.body;
        
        if (!Array.isArray(operatorIds) || operatorIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: '운영자 ID 목록이 필요합니다.'
            });
        }
        
        if (typeof isApproved !== 'boolean') {
            return res.status(400).json({
                success: false,
                message: '승인 상태는 boolean 값이어야 합니다.'
            });
        }
        
        // ObjectId 배열로 변환
        const objectIds = operatorIds.map(id => {
            if (!ObjectId.isValid(id)) {
                throw new Error(`올바르지 않은 운영자 ID 형식: ${id}`);
            }
            return new ObjectId(id);
        });
        
        const updateData = {
            isApproved,
            updatedAt: getKoreanTime()
        };
        
        if (isApproved) {
            updateData.approvedAt = getKoreanTime();
            updateData.approvedBy = approvedBy || req.user?.username || 'system';
        } else {
            updateData.approvedAt = null;
            updateData.approvedBy = null;
        }
        
        const result = await collection.updateMany(
            { _id: { $in: objectIds } },
            { $set: updateData }
        );
        
        const statusMessage = isApproved ? '승인' : '반려';
        res.json({
            success: true,
            message: `${result.modifiedCount}명의 운영자가 성공적으로 ${statusMessage}되었습니다.`,
            data: {
                modifiedCount: result.modifiedCount,
                matchedCount: result.matchedCount
            }
        });
    } catch (error) {
        console.error('운영자 대량 승인/반려 오류:', error);
        res.status(500).json({
            success: false,
            message: '운영자 대량 승인/반려 중 오류가 발생했습니다.',
            error: error.message
        });
    }
});

module.exports = router;
