const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');
const axios = require('axios');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');

// 인증번호 저장을 위한 임시 저장소
const verificationCodes = new Map();

// 이메일 전송을 위한 transporter 설정
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// 회원가입
router.post('/register', async (req, res) => {
    try {
        const { name, position, department, userId, password, phone } = req.body;

        // 필수 필드 검사
        if (!name || !position || !department || !userId || !password || !phone) {
            return res.status(400).json({ message: '모든 필드를 입력해주세요.' });
        }

        // 아이디 중복 확인
        const existingMember = await User.findOne({ username: userId });
        if (existingMember) {
            return res.status(400).json({ message: '이미 사용 중인 아이디입니다.' });
        }

        // 비밀번호 해싱
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // 현재 날짜를 YY:MM:DD 형식으로 변환
        const now = new Date();
        const year = now.getFullYear().toString().slice(-2);
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const day = now.getDate().toString().padStart(2, '0');
        const joinDate = `${year}:${month}:${day}`;

        // 새 회원 생성
        const member = new User({
            name,
            position,
            department,
            username: userId,
            password: hashedPassword,
            phone,
            joinDate
        });

        await member.save();

        res.status(201).json({ message: '회원가입이 완료되었습니다.' });
    } catch (error) {
        console.error('회원가입 오류:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});

// 로그인
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // 회원 찾기
        const member = await User.findOne({ username });
        if (!member) {
            return res.status(400).json({ message: '아이디 또는 비밀번호가 올바르지 않습니다.' });
        }

        // 비밀번호 확인
        const isMatch = await bcrypt.compare(password, member.password);
        if (!isMatch) {
            return res.status(400).json({ message: '아이디 또는 비밀번호가 올바르지 않습니다.' });
        }

        // JWT 토큰 생성
        const token = jwt.sign(
            { id: member._id },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        res.json({
            token,
            user: {
                id: member._id,
                name: member.name,
                position: member.position,
                department: member.department,
                points: member.points,
                joinDate: member.joinDate
            }
        });
    } catch (error) {
        console.error('로그인 오류:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
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
router.post('/send-verification', async (req, res) => {
    try {
        const { email } = req.body;
        
        // 이메일 형식 검사
        if (!email || !email.includes('@')) {
            return res.status(400).json({ message: '유효한 이메일 주소를 입력해주세요.' });
        }

        // 6자리 랜덤 인증번호 생성
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        
        // 이메일로 인증번호 전송
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: '회원가입 인증번호',
            text: `인증번호는 ${verificationCode} 입니다.`
        };

        await transporter.sendMail(mailOptions);

        // 인증번호 저장 (5분 유효)
        verificationCodes.set(email, {
            code: verificationCode,
            timestamp: Date.now()
        });

        res.json({ message: '인증번호가 이메일로 발송되었습니다.' });
    } catch (error) {
        console.error('인증번호 발송 오류:', error);
        res.status(500).json({ message: '인증번호 발송에 실패했습니다.' });
    }
});

// 인증번호 확인
router.post('/verify-code', async (req, res) => {
    try {
        const { email, code } = req.body;

        // 저장된 인증번호 확인
        const savedData = verificationCodes.get(email);
        
        if (!savedData) {
            return res.status(400).json({ message: '인증번호를 먼저 발송해주세요.' });
        }

        // 5분 제한 확인
        if (Date.now() - savedData.timestamp > 5 * 60 * 1000) {
            verificationCodes.delete(email);
            return res.status(400).json({ message: '인증번호가 만료되었습니다. 다시 발송해주세요.' });
        }

        // 인증번호 일치 확인
        if (savedData.code !== code) {
            return res.status(400).json({ message: '인증번호가 일치하지 않습니다.' });
        }

        // 인증 성공 시 저장된 인증번호 삭제
        verificationCodes.delete(email);

        res.json({ message: '인증이 완료되었습니다.' });
    } catch (error) {
        console.error('인증번호 확인 오류:', error);
        res.status(500).json({ message: '인증번호 확인에 실패했습니다.' });
    }
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
        const idPattern = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,16}$/;
        if (!idPattern.test(username)) {
            return res.status(400).json({ 
                available: false, 
                message: '아이디는 영문자, 특수문자, 숫자를 포함하여 8~16자로 입력해주세요.' 
            });
        }

        const existingMember = await User.findOne({ username });
        res.json({ available: !existingMember });
    } catch (error) {
        console.error('아이디 중복 확인 오류:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});

// 기본 라우트
router.get('/', (req, res) => {
    res.json({ message: 'Auth API is working' });
});

module.exports = router; 