const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const auth = require('../middleware/auth');
const axios = require('axios');
const mongoose = require('mongoose');

// 아이디 중복 확인
router.post('/check-id', async (req, res) => {
    try {
        const { userId } = req.body;
        console.log('=== 아이디 중복 확인 시작 ===');
        console.log('요청된 아이디:', userId);

        if (!userId) {
            return res.status(400).json({ 
                success: false, 
                msg: '아이디를 입력해주세요.' 
            });
        }

        // 데이터베이스 연결 확인
        if (mongoose.connection.readyState !== 1) {
            console.error('데이터베이스 연결 안됨');
            return res.status(500).json({ 
                success: false, 
                msg: '데이터베이스 연결 오류' 
            });
        }

        // 데이터베이스에서 사용자 검색
        const existingUser = await User.findOne({ userId: userId });
        console.log('데이터베이스 검색 결과:', existingUser ? '사용자 있음' : '사용자 없음');

        // 사용자가 없으면 사용 가능
        if (!existingUser) {
            console.log('사용 가능한 아이디:', userId);
            return res.json({ 
                success: true, 
                msg: '사용 가능한 아이디입니다.' 
            });
        }

        // 사용자가 있으면 중복
        console.log('이미 사용 중인 아이디:', existingUser.userId);
        return res.json({ 
            success: false, 
            msg: '이미 사용 중인 아이디입니다.' 
        });

    } catch (err) {
        console.error('아이디 중복 확인 오류:', err);
        return res.status(500).json({ 
            success: false, 
            msg: '서버 오류가 발생했습니다.' 
        });
    }
});

// 회원가입
router.post('/register', [
    check('name', '이름을 입력해주세요').not().isEmpty(),
    check('userId', '아이디를 입력해주세요').not().isEmpty(),
    check('password', '비밀번호를 입력해주세요').isLength({ min: 6 }),
    check('phone', '전화번호를 입력해주세요').not().isEmpty()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { name, userId, password, phone, notes } = req.body;

        // 아이디 중복 확인
        let user = await User.findOne({ userId });
        if (user) {
            return res.status(400).json({ success: false, msg: '이미 사용 중인 아이디입니다.' });
        }

        // 전화번호 중복 확인
        if (phone) {
            user = await User.findOne({ phone });
            if (user) {
                return res.status(400).json({ success: false, msg: '이미 등록된 전화번호입니다.' });
            }
        }

        user = new User({
            name,
            userId,
            password,
            phone,
            notes
        });

        await user.save();

        const payload = {
            user: {
                id: user.id
            }
        };

        jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: '24h' },
            (err, token) => {
                if (err) throw err;
                res.json({ success: true, token });
            }
        );
    } catch (err) {
        console.error('회원가입 오류:', err);
        res.status(500).json({ success: false, msg: '서버 오류가 발생했습니다.' });
    }
});

// 로그인
router.post('/login', [
    check('userId', '아이디를 입력해주세요').exists(),
    check('password', '비밀번호를 입력해주세요').exists()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { userId, password } = req.body;
        console.log('로그인 시도:', { userId });

        // 사용자 찾기
        const user = await User.findOne({ userId: userId.trim() });
        console.log('사용자 검색 결과:', user ? '사용자 찾음' : '사용자 없음');

        if (!user) {
            return res.status(400).json({ 
                success: false, 
                msg: '아이디 또는 비밀번호가 일치하지 않습니다.' 
            });
        }

        // 비밀번호 확인
        const isMatch = await user.comparePassword(password);
        console.log('비밀번호 일치 여부:', isMatch ? '일치' : '불일치');

        if (!isMatch) {
            return res.status(400).json({ 
                success: false, 
                msg: '아이디 또는 비밀번호가 일치하지 않습니다.' 
            });
        }

        // JWT 토큰 생성
        const payload = {
            user: {
                id: user.id
            }
        };

        jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: '24h' },
            (err, token) => {
                if (err) {
                    console.error('JWT 토큰 생성 오류:', err);
                    throw err;
                }
                console.log('로그인 성공:', { userId: user.userId });
                res.json({ 
                    success: true, 
                    token,
                    user: {
                        id: user.id,
                        name: user.name,
                        userId: user.userId
                    }
                });
            }
        );
    } catch (err) {
        console.error('로그인 오류:', err);
        res.status(500).json({ 
            success: false, 
            msg: '서버 오류가 발생했습니다.',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
});

// 아이디 찾기
router.post('/find-id', async (req, res) => {
    try {
        const { name, phone } = req.body;
        const user = await User.findOne({ name, phone });
        
        if (!user) {
            return res.status(400).json({ msg: '일치하는 회원정보가 없습니다.' });
        }

        res.json({ userId: user.userId });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('서버 오류');
    }
});

// 비밀번호 찾기
router.post('/find-password', async (req, res) => {
    try {
        const { userId, phone } = req.body;
        const user = await User.findOne({ userId, phone });
        
        if (!user) {
            return res.status(400).json({ msg: '일치하는 회원정보가 없습니다.' });
        }

        // 여기에 비밀번호 재설정 로직 추가
        res.json({ msg: '비밀번호 재설정 링크가 이메일로 전송되었습니다.' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('서버 오류');
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

// 전화번호 인증번호 발송
router.post('/send-verification', async (req, res) => {
    try {
        const { phone } = req.body;
        
        // 6자리 랜덤 인증번호 생성
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        
        // CoolSMS API 설정
        const apiKey = process.env.COOLSMS_API_KEY;
        const apiSecret = process.env.COOLSMS_API_SECRET;
        const sender = process.env.COOLSMS_SENDER_NUMBER;

        // SMS 발송
        const response = await axios({
            method: 'POST',
            url: 'https://api.coolsms.co.kr/messages/v4/send',
            headers: {
                'Authorization': `HMAC-SHA256 apiKey=${apiKey}, date=${new Date().toISOString()}, salt=${Math.random().toString(36).substring(2)}, signature=${apiSecret}`,
                'Content-Type': 'application/json'
            },
            data: {
                message: {
                    to: phone,
                    from: sender,
                    text: `[회원가입] 인증번호는 [${code}] 입니다.`
                }
            }
        });

        if (response.data.status === 'success') {
            res.json({
                success: true,
                msg: '인증번호가 발송되었습니다.',
                code: code // 실제 운영환경에서는 제거
            });
        } else {
            throw new Error('SMS 발송 실패');
        }
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({
            success: false,
            msg: '인증번호 발송에 실패했습니다.'
        });
    }
});

module.exports = router; 