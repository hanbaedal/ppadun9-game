const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const { connectDB, getDb } = require('./src/config/db');

// dotenv 조건부 로딩
try {
    const dotenv = require('dotenv');
    dotenv.config();
    console.log('[Config] dotenv 로드됨');
} catch (error) {
    console.log('[Config] dotenv 없음 - 환경변수 직접 사용');
}

// 환경 변수 검증
if (!process.env.MONGODB_URI) {
    console.error('[Config] MONGODB_URI가 설정되지 않았습니다.');
    process.exit(1);
}

console.log('[Config] 환경변수 확인:');
console.log('- NODE_ENV:', process.env.NODE_ENV);
console.log('- MONGODB_URI:', process.env.MONGODB_URI ? '설정됨' : '설정되지 않음');
console.log('- DB_NAME:', process.env.DB_NAME || '기본값 사용');
console.log('- SESSION_SECRET:', process.env.SESSION_SECRET ? '설정됨' : '설정되지 않음');
console.log('- PORT:', process.env.PORT || 3000);

const app = express();

// MongoDB 연결 설정
let db;

// 미들웨어 설정
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: process.env.SESSION_SECRET || 'ppadun9-game-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24시간
    }
}));

// 정적 파일 제공
app.use(express.static(path.join(__dirname, 'src/public')));

// 운영자 라우트
const operatorRoutes = require('./src/routes/operator');
app.use('/api/operator', operatorRoutes);

// 기본 라우트
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'src/public/index.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'src/public/operator-management.html'));
});

// 404 처리
app.use((req, res) => {
    res.status(404).json({ error: '페이지를 찾을 수 없습니다.' });
});

// 에러 핸들러
app.use((err, req, res, next) => {
    console.error('서버 오류:', err);
    res.status(500).json({ error: '서버 내부 오류가 발생했습니다.' });
});

// MongoDB 연결 및 서버 시작
async function startServer() {
    try {
        // MongoDB 연결
        await connectDB();
        db = getDb();
        console.log('[MongoDB] 데이터베이스 연결 성공');

        // 서버 시작
        const port = process.env.PORT || 3000;
        app.listen(port, () => {
            console.log(`[Server] 빠던나인 게임 운영 시스템이 포트 ${port}에서 실행 중입니다.`);
            console.log(`[Server] 환경: ${process.env.NODE_ENV || 'development'}`);
            console.log(`[Server] 시간: ${new Date().toLocaleString('ko-KR')}`);
        });

    } catch (error) {
        console.error('[Server] 서버 시작 실패:', error);
        process.exit(1);
    }
}

// 프로세스 종료 처리
process.on('SIGINT', async () => {
    console.log('\n[Server] 서버를 종료합니다...');
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n[Server] 서버를 종료합니다...');
    process.exit(0);
});

// 서버 시작
startServer();
