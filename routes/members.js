const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');

// 회원 목록 조회
router.get('/', auth, async (req, res) => {
    try {
        const users = await User.find().select('-password');
        res.json({ success: true, data: users });
    } catch (err) {
        console.error('회원 목록 조회 오류:', err);
        res.status(500).json({ success: false, msg: '서버 오류가 발생했습니다.' });
    }
});

// 회원 정보 수정
router.put('/:id', auth, async (req, res) => {
    try {
        const { name, phone, notes } = req.body;
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({ success: false, msg: '회원을 찾을 수 없습니다.' });
        }

        if (name) user.name = name;
        if (phone) user.phone = phone;
        if (notes) user.notes = notes;

        await user.save();
        res.json({ success: true, data: user });
    } catch (err) {
        console.error('회원 정보 수정 오류:', err);
        res.status(500).json({ success: false, msg: '서버 오류가 발생했습니다.' });
    }
});

// 회원 삭제
router.delete('/:id', auth, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({ success: false, msg: '회원을 찾을 수 없습니다.' });
        }

        await User.deleteOne({ _id: req.params.id });
        res.json({ success: true, msg: '회원이 삭제되었습니다.' });
    } catch (err) {
        console.error('회원 삭제 오류:', err);
        res.status(500).json({ success: false, msg: '서버 오류가 발생했습니다.' });
    }
});

// 회원 상세 정보 조회
router.get('/:id', auth, async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password');
        
        if (!user) {
            return res.status(404).json({ success: false, msg: '회원을 찾을 수 없습니다.' });
        }

        res.json({ success: true, data: user });
    } catch (err) {
        console.error('회원 상세 정보 조회 오류:', err);
        res.status(500).json({ success: false, msg: '서버 오류가 발생했습니다.' });
    }
});

// 기본 라우트
router.get('/', (req, res) => {
    res.json({ message: 'Members API is working' });
});

module.exports = router; 