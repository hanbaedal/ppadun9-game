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
app.use(express.static('public'));

// MongoDB Atlas 연결
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    maxPoolSize: 10,
    minPoolSize: 5
})
.then(() => {
    console.log('MongoDB Atlas 연결 성공');
    // 연결 성공 후 서버 시작
    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
        console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
    });
})
.catch(err => {
    console.error('MongoDB Atlas 연결 실패:', err);
    process.exit(1);
});

// MongoDB 연결 상태 모니터링
mongoose.connection.on('error', err => {
    console.error('MongoDB 연결 오류:', err);
});

mongoose.connection.on('disconnected', () => {
    console.log('MongoDB 연결이 끊어졌습니다.');
});

// 라우트 설정
app.use('/api/auth', require('./routes/auth'));
app.use('/api/members', require('./routes/members'));

// 정적 파일 제공
app.use(express.static(path.join(__dirname, 'public')));

// 모든 요청을 index.html로 리다이렉트
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
}); 