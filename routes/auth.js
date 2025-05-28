const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

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

        // 아이디 중복 체크
        let user = await User.findOne({ userId });
        if (user) {
            return res.status(400).json({ msg: '이미 존재하는 아이디입니다.' });
        }

        // 전화번호 중복 체크
        user = await User.findOne({ phone });
        if (user) {
            return res.status(400).json({ msg: '이미 등록된 전화번호입니다.' });
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
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '24h' },
            (err, token) => {
                if (err) throw err;
                res.json({ token });
            }
        );
    } catch (err) {
        console.error(err.message);
        res.status(500).send('서버 오류');
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

        const user = await User.findOne({ userId });
        if (!user) {
            return res.status(400).json({ msg: '존재하지 않는 아이디입니다.' });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(400).json({ msg: '비밀번호가 일치하지 않습니다.' });
        }

        const payload = {
            user: {
                id: user.id
            }
        };

        jwt.sign(
            payload,
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '24h' },
            (err, token) => {
                if (err) throw err;
                res.json({ token });
            }
        );
    } catch (err) {
        console.error(err.message);
        res.status(500).send('서버 오류');
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

module.exports = router; 