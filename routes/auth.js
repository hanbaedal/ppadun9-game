const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const auth = require('../middleware/auth');
const axios = require('axios');
const mongoose = require('mongoose');

// 회원가입
router.post('/register', [
    check('name', '이름을 입력해주세요').exists(),
    check('userId', '아이디를 입력해주세요').exists(),
    check('password', '비밀번호를 입력해주세요').exists(),
    check('phone', '전화번호를 입력해주세요').exists(),
    check('team', '팀을 선택해주세요').exists()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.log('유효성 검사 실패:', errors.array());
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { name, userId, password, phone, team, points, joinDate } = req.body;
        console.log('회원가입 시도:', { name, userId, phone, team });

        // 중복 체크
        const existingUser = await User.findOne({ 
            $or: [{ userId }, { phone }] 
        });
        
        if (existingUser) {
            console.log('중복 사용자 발견:', existingUser);
            const field = existingUser.userId === userId ? '아이디' : '전화번호';
            return res.status(400).json({ 
                success: false, 
                msg: `이미 사용 중인 ${field}입니다.` 
            });
        }

        // 사용자 생성
        const user = new User({
            name,
            userId,
            password,
            phone,
            team,
            points: points || 3000,
            joinDate: joinDate || new Date()
        });

        console.log('생성된 사용자 객체:', user);

        // 비밀번호 암호화
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);

        // 사용자 저장
        await user.save();
        console.log('회원가입 성공:', userId);

        res.json({ 
            success: true, 
            msg: '회원가입이 완료되었습니다.' 
        });
    } catch (err) {
        console.error('회원가입 오류:', err);
        if (err.code === 11000) {
            const field = Object.keys(err.keyPattern)[0];
            const msg = field === 'userId' ? '이미 사용 중인 아이디입니다.' : '이미 등록된 전화번호입니다.';
            return res.status(400).json({ 
                success: false, 
                msg: msg 
            });
        }
        res.status(500).json({ 
            success: false, 
            msg: '서버 오류가 발생했습니다.' 
        });
    }
});

// 로그인
router.post('/login', [
    check('userId', '아이디를 입력해주세요').exists(),
    check('password', '비밀번호를 입력해주세요').exists()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.log('로그인 유효성 검사 실패:', errors.array());
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { userId, password } = req.body;
        console.log('로그인 시도:', { userId });

        // 사용자 찾기
        const user = await User.findOne({ userId });
        console.log('사용자 검색 결과:', user ? {
            id: user._id,
            userId: user.userId,
            name: user.name,
            hasPassword: !!user.password
        } : '사용자 없음');
        
        if (!user) {
            console.log('사용자를 찾을 수 없음:', userId);
            return res.status(400).json({ 
                success: false, 
                msg: '아이디 또는 비밀번호가 일치하지 않습니다.' 
            });
        }

        // 비밀번호 확인
        try {
            console.log('비밀번호 확인 시작');
            console.log('입력된 비밀번호:', password);
            console.log('저장된 해시:', user.password);
            
            const isMatch = await bcrypt.compare(password, user.password);
            console.log('비밀번호 확인 결과:', isMatch);
            
            if (!isMatch) {
                console.log('비밀번호 불일치:', userId);
                return res.status(400).json({ 
                    success: false, 
                    msg: '아이디 또는 비밀번호가 일치하지 않습니다.' 
                });
            }
        } catch (error) {
            console.error('비밀번호 확인 오류:', error);
            return res.status(500).json({ 
                success: false, 
                msg: '비밀번호 확인 중 오류가 발생했습니다.' 
            });
        }

        // JWT 토큰 생성
        const payload = {
            user: {
                id: user.id,
                name: user.name,
                userId: user.userId,
                team: user.team,
                points: user.points
            }
        };

        console.log('JWT 토큰 생성 시작');
        jwt.sign(
            payload,
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '24h' },
            (err, token) => {
                if (err) {
                    console.error('JWT 토큰 생성 오류:', err);
                    return res.status(500).json({ 
                        success: false, 
                        msg: '토큰 생성 중 오류가 발생했습니다.' 
                    });
                }
                console.log('로그인 성공:', userId);
                res.json({ 
                    success: true, 
                    token,
                    user: {
                        name: user.name,
                        userId: user.userId,
                        team: user.team,
                        points: user.points
                    }
                });
            }
        );
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
router.post('/send-verification', async (req, res) => {
    try {
        const { phone } = req.body;
        console.log('인증번호 발송 요청:', phone);

        if (!phone) {
            return res.status(400).json({ 
                success: false, 
                msg: '전화번호를 입력해주세요.' 
            });
        }

        // 6자리 랜덤 인증번호 생성
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        console.log('생성된 인증번호:', code);

        res.json({ 
            success: true, 
            msg: '인증번호가 발송되었습니다.',
            code: code  // 실제 서비스에서는 이 부분 제거
        });
    } catch (err) {
        console.error('인증번호 발송 오류:', err);
        res.status(500).json({ 
            success: false, 
            msg: '서버 오류가 발생했습니다.' 
        });
    }
});

module.exports = router; 