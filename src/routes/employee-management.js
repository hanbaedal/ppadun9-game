const express = require('express');
const { ObjectId } = require('mongodb');
const { getDb } = require('../config/db');
const { getKoreanTime, formatKoreanTime } = require('../utils/korean-time');
const bcrypt = require('bcryptjs');

const router = express.Router();

// 직원 목록 조회 (페이지네이션, 검색, 필터링 지원)
router.get('/', async (req, res) => {
    try {
        const db = getDb();
        const collection = db.collection('employee-member');
        
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
        const employees = await collection
            .find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .toArray();
        
        // 비밀번호 제외하고 반환
        const safeEmployees = employees.map(emp => {
            const { password, ...safeEmp } = emp;
            return safeEmp;
        });
        
        res.json({
            success: true,
            data: safeEmployees,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalCount / parseInt(limit)),
                totalCount,
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        console.error('직원 목록 조회 오류:', error);
        res.status(500).json({
            success: false,
            message: '직원 목록 조회 중 오류가 발생했습니다.',
            error: error.message
        });
    }
});

// 직원 상세 조회
router.get('/:id', async (req, res) => {
    try {
        const db = getDb();
        const collection = db.collection('employee-member');
        const { id } = req.params;
        
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: '올바르지 않은 직원 ID 형식입니다.'
            });
        }
        
        const employee = await collection.findOne({ _id: new ObjectId(id) });
        if (!employee) {
            return res.status(404).json({
                success: false,
                message: '직원을 찾을 수 없습니다.'
            });
        }
        
        // 비밀번호 제외하고 반환
        const { password, ...safeEmployee } = employee;
        res.json({
            success: true,
            data: safeEmployee
        });
    } catch (error) {
        console.error('직원 상세 조회 오류:', error);
        res.status(500).json({
            success: false,
            message: '직원 상세 조회 중 오류가 발생했습니다.',
            error: error.message
        });
    }
});

// 직원 등록
router.post('/', async (req, res) => {
    try {
        const db = getDb();
        const collection = db.collection('employee-member');
        
        const {
            name,
            email,
            username,
            password,
            position,
            department,
            phone
        } = req.body;
        
        // 필수 필드 검증
        if (!name || !username || !password) {
            return res.status(400).json({
                success: false,
                message: '이름, 아이디, 비밀번호는 필수 입력 항목입니다.'
            });
        }
        
        // 아이디 중복 확인
        const existingEmployee = await collection.findOne({ username });
        if (existingEmployee) {
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
        
        // 새 직원 데이터 생성
        const newEmployee = {
            name,
            email: email || '',
            username,
            password: hashedPassword,
            position: position || '',
            department: department || '',
            phone: phone || '',
            isLoggedIn: false,
            loginCount: 0,
            lastLoginAt: null,
            lastActivityAt: null,
            lastLogoutAt: null,
            isApproved: false,
            approvedAt: null,
            approvedBy: null,
            createdAt: getKoreanTime(),
            updatedAt: getKoreanTime()
        };
        
        const result = await collection.insertOne(newEmployee);
        
        // 생성된 직원 정보 반환 (비밀번호 제외)
        const { password: _, ...safeEmployee } = newEmployee;
        safeEmployee._id = result.insertedId;
        
        res.status(201).json({
            success: true,
            message: '직원이 성공적으로 등록되었습니다.',
            data: safeEmployee
        });
    } catch (error) {
        console.error('직원 등록 오류:', error);
        res.status(500).json({
            success: false,
            message: '직원 등록 중 오류가 발생했습니다.',
            error: error.message
        });
    }
});

// 직원 정보 수정
router.put('/:id', async (req, res) => {
    try {
        const db = getDb();
        const collection = db.collection('employee-member');
        const { id } = req.params;
        
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: '올바르지 않은 직원 ID 형식입니다.'
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
            isApproved
        } = req.body;
        
        // 기존 직원 정보 조회
        const existingEmployee = await collection.findOne({ _id: new ObjectId(id) });
        if (!existingEmployee) {
            return res.status(404).json({
                success: false,
                message: '직원을 찾을 수 없습니다.'
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
        if (isApproved !== undefined) {
            updateData.isApproved = isApproved;
            if (isApproved && !existingEmployee.isApproved) {
                updateData.approvedAt = getKoreanTime();
                updateData.approvedBy = req.user?.username || 'system';
            }
        }
        
        // 아이디 변경 요청이 있는 경우 중복 확인
        if (username && username !== existingEmployee.username) {
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
        if (email && email !== existingEmployee.email) {
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
                message: '직원을 찾을 수 없습니다.'
            });
        }
        
        res.json({
            success: true,
            message: '직원 정보가 성공적으로 수정되었습니다.'
        });
    } catch (error) {
        console.error('직원 정보 수정 오류:', error);
        res.status(500).json({
            success: false,
            message: '직원 정보 수정 중 오류가 발생했습니다.',
            error: error.message
        });
    }
});

// 직원 삭제
router.delete('/:id', async (req, res) => {
    try {
        const db = getDb();
        const collection = db.collection('employee-member');
        const { id } = req.params;
        
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: '올바르지 않은 직원 ID 형식입니다.'
            });
        }
        
        // 기존 직원 정보 조회
        const existingEmployee = await collection.findOne({ _id: new ObjectId(id) });
        if (!existingEmployee) {
            return res.status(404).json({
                success: false,
                message: '직원을 찾을 수 없습니다.'
            });
        }
        
        // 현재 로그인된 직원은 삭제 불가
        if (existingEmployee.isLoggedIn) {
            return res.status(400).json({
                success: false,
                message: '현재 로그인된 직원은 삭제할 수 없습니다. 먼저 로그아웃 후 다시 시도해주세요.'
            });
        }
        
        const result = await collection.deleteOne({ _id: new ObjectId(id) });
        
        if (result.deletedCount === 0) {
            return res.status(404).json({
                success: false,
                message: '직원을 찾을 수 없습니다.'
            });
        }
        
        res.json({
            success: true,
            message: '직원이 성공적으로 삭제되었습니다.'
        });
    } catch (error) {
        console.error('직원 삭제 오류:', error);
        res.status(500).json({
            success: false,
            message: '직원 삭제 중 오류가 발생했습니다.',
            error: error.message
        });
    }
});

// 직원 승인/반려
router.patch('/:id/approval', async (req, res) => {
    try {
        const db = getDb();
        const collection = db.collection('employee-member');
        const { id } = req.params;
        const { isApproved, approvedBy } = req.body;
        
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: '올바르지 않은 직원 ID 형식입니다.'
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
                message: '직원을 찾을 수 없습니다.'
            });
        }
        
        const statusMessage = isApproved ? '승인' : '반려';
        res.json({
            success: true,
            message: `직원이 성공적으로 ${statusMessage}되었습니다.`
        });
    } catch (error) {
        console.error('직원 승인/반려 오류:', error);
        res.status(500).json({
            success: false,
            message: '직원 승인/반려 중 오류가 발생했습니다.',
            error: error.message
        });
    }
});

// 직원 통계 조회
router.get('/stats/overview', async (req, res) => {
    try {
        const db = getDb();
        const collection = db.collection('employee-member');
        
        // 전체 직원 수
        const totalEmployees = await collection.countDocuments();
        
        // 승인된 직원 수
        const approvedEmployees = await collection.countDocuments({ isApproved: true });
        
        // 승인 대기 중인 직원 수
        const pendingEmployees = await collection.countDocuments({ isApproved: false });
        
        // 현재 로그인된 직원 수
        const loggedInEmployees = await collection.countDocuments({ isLoggedIn: true });
        
        // 부서별 직원 수
        const departmentStats = await collection.aggregate([
            { $group: { _id: '$department', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]).toArray();
        
        // 직책별 직원 수
        const positionStats = await collection.aggregate([
            { $group: { _id: '$position', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]).toArray();
        
        res.json({
            success: true,
            data: {
                totalEmployees,
                approvedEmployees,
                pendingEmployees,
                loggedInEmployees,
                departmentStats,
                positionStats
            }
        });
    } catch (error) {
        console.error('직원 통계 조회 오류:', error);
        res.status(500).json({
            success: false,
            message: '직원 통계 조회 중 오류가 발생했습니다.',
            error: error.message
        });
    }
});

// 직원 대량 작업 (승인/반려)
router.patch('/bulk/approval', async (req, res) => {
    try {
        const db = getDb();
        const collection = db.collection('employee-member');
        const { employeeIds, isApproved, approvedBy } = req.body;
        
        if (!Array.isArray(employeeIds) || employeeIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: '직원 ID 목록이 필요합니다.'
            });
        }
        
        if (typeof isApproved !== 'boolean') {
            return res.status(400).json({
                success: false,
                message: '승인 상태는 boolean 값이어야 합니다.'
            });
        }
        
        // ObjectId 배열로 변환
        const objectIds = employeeIds.map(id => {
            if (!ObjectId.isValid(id)) {
                throw new Error(`올바르지 않은 직원 ID 형식: ${id}`);
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
            message: `${result.modifiedCount}명의 직원이 성공적으로 ${statusMessage}되었습니다.`,
            data: {
                modifiedCount: result.modifiedCount,
                matchedCount: result.matchedCount
            }
        });
    } catch (error) {
        console.error('직원 대량 승인/반려 오류:', error);
        res.status(500).json({
            success: false,
            message: '직원 대량 승인/반려 중 오류가 발생했습니다.',
            error: error.message
        });
    }
});

module.exports = router;
