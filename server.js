const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// 환경 변수 설정
dotenv.config();

// 환경 변수 검증
if (!process.env.MONGODB_URI) {
    console.error('[Config] MONGODB_URI가 설정되지 않았습니다.');
    process.exit(1);
}

const app = express();

// 로깅 미들웨어
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// 미들웨어 설정
app.use(cors());
app.use(express.json());

// API 라우트 설정
app.use('/api/auth', require('./routes/auth'));
app.use('/api/members', require('./routes/members'));
app.use('/api/today-game', require('./routes/today-game'));

// 정적 파일 제공
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB Atlas 연결
console.log('MongoDB 연결 시도...');
console.log('연결 문자열:', process.env.MONGODB_URI.replace(/:[^:@]+@/, ':****@')); // 비밀번호 마스킹

mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 30000, // Render 환경에 맞게 타임아웃 증가
    socketTimeoutMS: 45000,
    maxPoolSize: 10,
    minPoolSize: 5
})
.then(() => {
    console.log('MongoDB Atlas 연결 성공');
    // 연결 성공 후 서버 시작
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
    });
})
.catch(err => {
    console.error('MongoDB Atlas 연결 실패:', err);
    console.error('에러 상세:', {
        name: err.name,
        message: err.message,
        code: err.code,
        stack: err.stack
    });
    process.exit(1);
});

// MongoDB 연결 상태 모니터링
mongoose.connection.on('error', err => {
    console.error('MongoDB 연결 오류:', err);
    console.error('에러 상세:', {
        name: err.name,
        message: err.message,
        code: err.code,
        stack: err.stack
    });
});

mongoose.connection.on('disconnected', () => {
    console.log('MongoDB 연결이 끊어졌습니다.');
});

// 404 에러 처리
app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
        res.status(404).json({ 
            success: false, 
            msg: 'API 엔드포인트를 찾을 수 없습니다.',
            path: req.path
        });
    } else {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }
});

// 에러 핸들러
app.use((err, req, res, next) => {
    console.error('서버 에러 발생:', err);
    console.error('에러 상세:', {
        name: err.name,
        message: err.message,
        code: err.code,
        stack: err.stack
    });
    res.status(500).json({ 
        success: false, 
        msg: '서버 오류가 발생했습니다.',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
}); 