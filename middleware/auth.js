const jwt = require('jsonwebtoken');

module.exports = function(req, res, next) {
    // 토큰 가져오기
    const token = req.header('x-auth-token');

    // 토큰이 없는 경우
    if (!token) {
        return res.status(401).json({ msg: '인증 토큰이 없습니다.' });
    }

    try {
        // 토큰 검증
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        req.user = decoded.user;
        next();
    } catch (err) {
        res.status(401).json({ msg: '토큰이 유효하지 않습니다.' });
    }
}; 