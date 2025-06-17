const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');
const axios = require('axios');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// 인증번호 저장을 위한 임시 저장소
const verificationCodes = new Map();

// 회원가입
router.post('/register', async (req, res) => {
    try {
        const { name, userId, email, phone, team, password, verificationCode } = req.body;
        console.log('회원가입 시도:', { name, userId, email, phone, team });

        // 필수 필드 검증
        if (!name || !userId || !email || !phone || !team || !password) {
            return res.status(400).json({
                success: false,
                message: '모든 필수 필드를 입력해주세요.'
            });
        }

        // 이메일 형식 검증
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: '유효하지 않은 이메일 형식입니다.'
            });
        }

        // 인증번호 검증
        const storedVerification = verificationCodes.get(phone);
        if (!storedVerification || storedVerification.code !== verificationCode) {
            return res.status(400).json({
                success: false,
                message: '유효하지 않은 인증번호입니다.'
            });
        }

        // 사용자 생성
        const user = new User({
            name,
            userId,
            email,
            phone,
            team,
            password // 실제로는 해시화해야 함
        });

        console.log('생성된 사용자 객체:', user);

        await user.save();
        console.log('회원가입 성공:', user._id);

        // 인증번호 삭제
        verificationCodes.delete(phone);

        res.status(201).json({
            success: true,
            message: '회원가입이 완료되었습니다.',
            user: {
                id: user._id,
                name: user.name,
                userId: user.userId,
                email: user.email,
                team: user.team
            }
        });
    } catch (error) {
        console.error('회원가입 오류:', error);
        res.status(500).json({
            success: false,
            message: '회원가입 중 오류가 발생했습니다.',
            error: error.message
        });
    }
});

// 로그인
router.post('/login', async (req, res) => {
    try {
        const { userId, password } = req.body;
        console.log('로그인 시도 - 입력값:', { 
            userId, 
            password,
            passwordLength: password ? password.length : 0
        });

        // 사용자 찾기
        const user = await User.findOne({ userId });
        console.log('사용자 검색 결과:', user ? {
            userId: user.userId,
            name: user.name,
            password: user.password,
            passwordLength: user.password ? user.password.length : 0
        } : '사용자 없음');
        
        if (!user) {
            return res.status(400).json({ 
                success: false, 
                msg: '아이디 또는 비밀번호가 일치하지 않습니다.' 
            });
        }

        // 비밀번호 확인 (단순 비교)
        console.log('비밀번호 비교:', {
            inputPassword: password,
            storedPassword: user.password,
            isMatch: user.password === password
        });

        if (user.password !== password) {
            return res.status(400).json({ 
                success: false, 
                msg: '아이디 또는 비밀번호가 일치하지 않습니다.' 
            });
        }

        // 로그인 성공
        console.log('로그인 성공:', {
            userId: user.userId,
            name: user.name,
            team: user.team
        });

        // 사용자 정보를 localStorage에 저장할 수 있도록 응답
        res.json({ 
            success: true, 
            user: {
                name: user.name,
                userId: user.userId,
                team: user.team,
                points: user.points
            }
        });
    } catch (err) {
        console.error('로그인 오류:', err);
        res.status(500).json({ 
            success: false, 
            msg: '서버 오류가 발생했습니다.' 
        });
    }
});

// 아이디 찾기
router.post('/find-id', async (req, res) => {
    try {
        const { name, phone } = req.body;
        console.log('아이디 찾기 시도:', { name, phone });

        const user = await User.findOne({ name, phone });
        if (!user) {
            return res.status(400).json({ 
                success: false, 
                msg: '일치하는 회원정보가 없습니다.' 
            });
        }

        res.json({ 
            success: true, 
            userId: user.userId 
        });
    } catch (err) {
        console.error('아이디 찾기 오류:', err);
        res.status(500).json({ 
            success: false, 
            msg: '서버 오류가 발생했습니다.' 
        });
    }
});

// 비밀번호 찾기
router.post('/find-password', async (req, res) => {
    try {
        const { userId, name, phone } = req.body;
        console.log('비밀번호 찾기 시도:', { userId, name, phone });

        const user = await User.findOne({ userId, name, phone });
        if (!user) {
            return res.status(400).json({ 
                success: false, 
                msg: '일치하는 회원정보가 없습니다.' 
            });
        }

        // 임시 비밀번호 생성 (8자리)
        const tempPassword = Math.random().toString(36).slice(-8);
        
        // 비밀번호 암호화
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(tempPassword, salt);
        await user.save();

        // TODO: 실제 SMS 발송 로직 구현
        console.log('임시 비밀번호:', tempPassword);

        res.json({ 
            success: true, 
            msg: '임시 비밀번호가 전화번호로 발송되었습니다.' 
        });
    } catch (err) {
        console.error('비밀번호 찾기 오류:', err);
        res.status(500).json({ 
            success: false, 
            msg: '서버 오류가 발생했습니다.' 
        });
    }
});

// 현재 로그인한 사용자 정보 가져오기
router.get('/me', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) {
            return res.status(404).json({
                success: false,
                msg: '사용자를 찾을 수 없습니다.'
            });
        }

        res.json({
            success: true,
            user: user
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({
            success: false,
            msg: '서버 오류가 발생했습니다.'
        });
    }
});

// 인증번호 발송
router.post('/send-verification', (req, res) => {
    const { phone } = req.body;
    if (!phone) {
        return res.status(400).json({ success: false, message: '전화번호가 필요합니다.' });
    }

    // 6자리 랜덤 인증번호 생성
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    console.log('인증번호 발송 요청:', phone);
    console.log('생성된 인증번호:', verificationCode);

    // 인증번호 저장 (실제로는 SMS 발송 로직이 들어가야 함)
    verificationCodes.set(phone, {
        code: verificationCode,
        timestamp: Date.now()
    });

    res.json({ 
        success: true, 
        message: '인증번호가 발송되었습니다.',
        // 개발 환경에서만 인증번호 반환
        code: process.env.NODE_ENV === 'development' ? verificationCode : undefined
    });
});

// 사용자 정보 수정
router.post('/update', async (req, res) => {
    try {
        const { name, team, currentPassword, newPassword } = req.body;
        const userId = req.body.userId;

        // 사용자 찾기
        const user = await User.findOne({ userId });
        if (!user) {
            return res.status(400).json({ 
                success: false, 
                msg: '사용자를 찾을 수 없습니다.' 
            });
        }

        // 현재 비밀번호 확인
        if (user.password !== currentPassword) {
            return res.status(400).json({ 
                success: false, 
                msg: '현재 비밀번호가 일치하지 않습니다.' 
            });
        }

        // 정보 업데이트
        user.name = name;
        user.team = team;
        if (newPassword) {
            user.password = newPassword;
        }

        await user.save();

        // 업데이트된 사용자 정보 반환
        res.json({ 
            success: true, 
            user: {
                name: user.name,
                userId: user.userId,
                team: user.team,
                points: user.points
            }
        });
    } catch (err) {
        console.error('정보 수정 오류:', err);
        res.status(500).json({ 
            success: false, 
            msg: '서버 오류가 발생했습니다.' 
        });
    }
});

// 회원 목록 조회
router.get('/members', async (req, res) => {
    try {
        const members = await User.find({}, {
            name: 1,
            userId: 1,
            phone: 1,
            team: 1,
            points: 1,
            joinDate: 1,
            _id: 0
        }).sort({ joinDate: -1 });

        // 날짜 데이터 상세 로깅
        console.log('=== 회원 목록 날짜 데이터 상세 ===');
        members.forEach(member => {
            console.log(`회원 ID: ${member.userId}`);
            console.log('joinDate 값:', member.joinDate);
            console.log('joinDate 타입:', typeof member.joinDate);
            console.log('joinDate instanceof Date:', member.joinDate instanceof Date);
            console.log('joinDate toString():', member.joinDate ? member.joinDate.toString() : 'null');
            console.log('------------------------');
        });

        res.json({
            success: true,
            members: members
        });
    } catch (err) {
        console.error('회원 목록 조회 오류:', err);
        res.status(500).json({
            success: false,
            msg: '서버 오류가 발생했습니다.'
        });
    }
});

// 회원 정보 조회
router.get('/member/:userId', async (req, res) => {
    try {
        const user = await User.findOne({ userId: req.params.userId });
        if (!user) {
            return res.status(404).json({
                success: false,
                msg: '회원을 찾을 수 없습니다.'
            });
        }

        res.json({
            success: true,
            member: {
                name: user.name,
                userId: user.userId,
                password: user.password,
                phone: user.phone,
                team: user.team,
                points: user.points,
                createdAt: user.createdAt
            }
        });
    } catch (err) {
        console.error('회원 정보 조회 오류:', err);
        res.status(500).json({
            success: false,
            msg: '서버 오류가 발생했습니다.'
        });
    }
});

// 회원 정보 수정
router.put('/member/:userId', async (req, res) => {
    try {
        const { name, userId, password, phone, team } = req.body;
        const user = await User.findOne({ userId: req.params.userId });

        if (!user) {
            return res.status(404).json({
                success: false,
                msg: '회원을 찾을 수 없습니다.'
            });
        }

        // 정보 업데이트
        user.name = name;
        user.userId = userId;
        user.password = password;
        user.phone = phone;
        user.team = team;

        await user.save();

        res.json({
            success: true,
            msg: '회원 정보가 수정되었습니다.'
        });
    } catch (err) {
        console.error('회원 정보 수정 오류:', err);
        res.status(500).json({
            success: false,
            msg: '서버 오류가 발생했습니다.'
        });
    }
});

// 회원 삭제
router.delete('/member/:userId', async (req, res) => {
    try {
        const user = await User.findOne({ userId: req.params.userId });
        if (!user) {
            return res.status(404).json({
                success: false,
                msg: '회원을 찾을 수 없습니다.'
            });
        }

        await user.remove();

        res.json({
            success: true,
            msg: '회원이 삭제되었습니다.'
        });
    } catch (err) {
        console.error('회원 삭제 오류:', err);
        res.status(500).json({
            success: false,
            msg: '서버 오류가 발생했습니다.'
        });
    }
});

// 아이디 중복확인
router.post('/check-username', async (req, res) => {
    try {
        const { username } = req.body;
        
        // 아이디 형식 검사
        if (!/^[a-zA-Z0-9]{4,20}$/.test(username)) {
            return res.json({ available: false, message: '4~20자의 영문, 숫자만 사용 가능합니다.' });
        }

        // 데이터베이스에서 아이디 검색
        const existingUser = await User.findOne({ username });
        
        res.json({ available: !existingUser });
    } catch (error) {
        console.error('아이디 중복확인 오류:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});

// 기본 라우트
router.get('/', (req, res) => {
    res.json({ message: 'Auth API is working' });
});

module.exports = router; 