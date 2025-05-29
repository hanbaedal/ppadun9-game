const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// 환경 변수 설정
dotenv.config();

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

// MongoDB 연결 설정
const connectWithRetry = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            retryWrites: true,
            w: 'majority',
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });
        console.log('[MongoDB] 연결 성공');
    } catch (err) {
        console.error('[MongoDB] 연결 실패:', err.message);
        console.error('[MongoDB] 연결 URI:', process.env.MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@'));
        console.log('[MongoDB] 5초 후 재연결 시도...');
        setTimeout(connectWithRetry, 5000);
    }
};

// MongoDB 연결 시도
connectWithRetry();

// MongoDB 연결 상태 모니터링
mongoose.connection.on('error', err => {
    console.error('[MongoDB] 연결 오류:', err.message);
});

mongoose.connection.on('disconnected', () => {
    console.log('[MongoDB] 연결이 끊어졌습니다. 재연결 시도...');
    connectWithRetry();
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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`[Server] 서버가 포트 ${PORT}에서 실행 중입니다.`);
    console.log(`[Server] MongoDB URI: ${process.env.MONGODB_URI ? '설정됨' : '설정되지 않음'}`);
}); 