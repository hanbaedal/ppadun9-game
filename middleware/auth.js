const jwt = require('jsonwebtoken');

module.exports = function(req, res, next) {
    // 토큰 가져오기
    const authHeader = req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, msg: '인증 토큰이 없습니다.' });
    }

    const token = authHeader.split(' ')[1];

    try {
        // 토큰 검증
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded.user;
        next();
    } catch (err) {
        console.error('토큰 검증 오류:', err);
        res.status(401).json({ success: false, msg: '토큰이 유효하지 않습니다.' });
    }
}; 