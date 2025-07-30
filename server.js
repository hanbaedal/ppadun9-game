const express = require('express');
const cors = require('cors');
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');
const session = require('express-session');
const cron = require('node-cron');
const { connectDB, getDb } = require('./config/db');
const { getKoreanTime, toKoreanTime, formatKoreanTime, getKoreanDateString } = require('./utils/korean-time');

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
const COLLECTION_NAME = 'employee-member';
const TODAYGAMES_COLLECTION = 'todaygames';

let db;

// 세션 만료 시간 계산 (당일 자정)
function getSessionExpiryTime() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0); // 자정으로 설정
    return tomorrow.getTime() - now.getTime(); // 밀리초 단위로 반환
}

// 자동 로그아웃 함수 (자정에 모든 직원 로그아웃)
async function autoLogoutAllEmployees() {
    try {
        if (!db) {
            console.log('데이터베이스 연결이 없어 자동 로그아웃을 건너뜁니다.');
            return;
        }

        const collection = db.collection(COLLECTION_NAME);
        
        // 현재 로그인된 모든 직원을 로그아웃 처리
        const result = await collection.updateMany(
            { isLoggedIn: true },
            { 
                $set: { 
                    isLoggedIn: false,
                    lastLogoutAt: getKoreanTime(),
                    updatedAt: getKoreanTime()
                } 
            }
        );
        
        const koreanTime = formatKoreanTime(getKoreanTime(), 'datetime');
        console.log(`[${koreanTime}] 자동 로그아웃 완료: ${result.modifiedCount}명의 직원이 로그아웃되었습니다.`);
        
        // 로그 파일에 기록 (선택사항)
        console.log(`자동 로그아웃 - 날짜: ${koreanTime}, 로그아웃된 직원 수: ${result.modifiedCount}`);
        
    } catch (error) {
        console.error('자동 로그아웃 오류:', error);
    }
}

// 회원 자동 로그아웃 함수 (자정에 모든 회원 로그아웃)
async function autoLogoutAllMembers() {
    try {
        if (!db) {
            console.log('데이터베이스 연결이 없어 회원 자동 로그아웃을 건너뜁니다.');
            return;
        }

        const collection = db.collection('game-member');
        
        // 현재 로그인된 모든 회원을 로그아웃 처리
        const result = await collection.updateMany(
            { isLoggedIn: true },
            { 
                $set: { 
                    isLoggedIn: false,
                    lastLogoutAt: getKoreanTime(),
                    updatedAt: getKoreanTime()
                } 
            }
        );
        
        const koreanTime = formatKoreanTime(getKoreanTime(), 'datetime');
        console.log(`[${koreanTime}] 회원 자동 로그아웃 완료: ${result.modifiedCount}명의 회원이 로그아웃되었습니다.`);
        
        // 로그 파일에 기록
        console.log(`회원 자동 로그아웃 - 날짜: ${koreanTime}, 로그아웃된 회원 수: ${result.modifiedCount}`);
        
    } catch (error) {
        console.error('회원 자동 로그아웃 오류:', error);
    }
}

// 배팅 시스템 자동 초기화 함수
async function initializeBettingCollections() {
    try {
        if (!db) {
            console.log('데이터베이스 연결이 없어 배팅 컬렉션 초기화를 건너뜁니다.');
            return;
        }

        // 1. 경기별 배팅 컬렉션 자동 생성
        const today = new Date().toISOString().split('T')[0];
        
        for (let gameNumber = 1; gameNumber <= 5; gameNumber++) {
            const collectionName = `betting-game-${gameNumber}`;
            const gameCollection = db.collection(collectionName);
            
            // 컬렉션이 비어있는지 확인하고 더미 데이터 삽입
            const existingData = await gameCollection.countDocuments();
            if (existingData === 0) {
                const dummyData = {
                    userId: 'system-init',
                    userName: '시스템',
                    prediction: 'home',
                    points: 0,
                    date: today,
                    status: 'dummy',
                    betTime: new Date(),
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
                
                await gameCollection.insertOne(dummyData);
                console.log(`${collectionName} 컬렉션이 자동으로 생성되었습니다.`);
            } else {
                // 더미 데이터가 있다면 제거
                const dummyData = await gameCollection.find({ userId: 'system-init' }).toArray();
                if (dummyData.length > 0) {
                    await gameCollection.deleteMany({ userId: 'system-init' });
                    console.log(`${collectionName}에서 ${dummyData.length}개의 더미 데이터가 제거되었습니다.`);
                }
                console.log(`${collectionName} 컬렉션이 이미 존재합니다.`);
            }
        }

        // 2. 경기별 통계 컬렉션 자동 생성
        for (let gameNumber = 1; gameNumber <= 5; gameNumber++) {
            const statsCollectionName = `game-stats-${gameNumber}`;
            const statsCollection = db.collection(statsCollectionName);
            
            // 통계 컬렉션이 비어있는지 확인하고 더미 데이터 삽입
            const existingStats = await statsCollection.countDocuments();
            if (existingStats === 0) {
                const dummyStats = {
                    gameNumber: gameNumber,
                    date: today,
                    matchup: '매치업 없음',
                    predictionResult: '-',
                    '1base': 0,
                    '2base': 0,
                    '3base': 0,
                    'homerun': 0,
                    'strikeout': 0,
                    'out': 0,
                    totalBettors: 0,
                    winPoints: 0,
                    winRate: 0,
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
                
                await statsCollection.insertOne(dummyStats);
                console.log(`${statsCollectionName} 통계 컬렉션이 자동으로 생성되었습니다.`);
            } else {
                console.log(`${statsCollectionName} 통계 컬렉션이 이미 존재합니다.`);
            }
        }

        // 2. 배팅 시스템 자동 활성화
        const systemCollection = db.collection('betting-system');
        const systemStatus = await systemCollection.findOne({ _id: 'system' });
        
        if (!systemStatus || !systemStatus.isActive) {
            await systemCollection.updateOne(
                { _id: 'system' },
                { 
                    $set: { 
                        isActive: true,
                        updatedAt: getKoreanTime()
                    }
                },
                { upsert: true }
            );
            console.log('배팅 시스템이 자동으로 활성화되었습니다.');
        } else {
            console.log('배팅 시스템이 이미 활성화되어 있습니다.');
        }

        // 3. 오늘 날짜의 배팅 세션 자동 생성
        const sessionsCollection = db.collection('betting-sessions');
        const existingSessions = await sessionsCollection.countDocuments({
            date: today,
            status: 'active'
        });

        if (existingSessions === 0) {
            // 각 경기별 배팅 세션 자동 생성
            for (let gameNumber = 1; gameNumber <= 5; gameNumber++) {
                const session = {
                    gameNumber: gameNumber,
                    gameType: 'baseball',
                    date: today,
                    status: 'active',
                    startTime: new Date(),
                    createdAt: new Date(),
                    updatedAt: getKoreanTime()
                };
                
                await sessionsCollection.insertOne(session);
            }
            console.log('오늘의 배팅 세션이 자동으로 생성되었습니다. (5경기)');
        } else {
            console.log('오늘의 배팅 세션이 이미 존재합니다.');
        }
        
    } catch (error) {
        console.error('배팅 시스템 자동 초기화 오류:', error);
    }
}

// MongoDB 연결
async function connectToMongoDB() {
    try {
        console.log('MongoDB 연결 시도...');
        db = await connectDB();
        console.log(`MongoDB에 성공적으로 연결되었습니다.`);
        
        // 데이터베이스 연결 후 cron job 설정
        setupAutoLogoutCron();
        
        // 배팅 컬렉션 자동 초기화
        await initializeBettingCollections();
        
    } catch (error) {
        console.error('MongoDB 연결 오류:', error);
        throw error;
    }
}

// 자동 로그아웃 cron job 설정
function setupAutoLogoutCron() {
    // 매일 자정에 직원 자동 로그아웃 (한국 시간)
    // cron 표현식: '0 0 * * *' (분 시 일 월 요일)
    cron.schedule('0 0 * * *', async () => {
        console.log('직원 자동 로그아웃 cron job 실행 중...');
        await autoLogoutAllEmployees();
    }, {
        timezone: 'Asia/Seoul' // 한국 시간대 설정
    });
    
    // 매일 자정에 회원 자동 로그아웃 (한국 시간)
    // cron 표현식: '0 0 * * *' (분 시 일 월 요일)
    cron.schedule('0 0 * * *', async () => {
        console.log('회원 자동 로그아웃 cron job 실행 중...');
        await autoLogoutAllMembers();
    }, {
        timezone: 'Asia/Seoul' // 한국 시간대 설정
    });
    
    console.log('자동 로그아웃 cron job이 설정되었습니다.');
    console.log('- 직원 자동 로그아웃: 매일 자정 (00:00)');
    console.log('- 회원 자동 로그아웃: 매일 자정 (00:00)');
}

// 로깅 미들웨어
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// 미들웨어 설정
app.use(cors({
    origin: true,
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 세션 설정 - 당일 자정까지 유지
const sessionConfig = {
    secret: process.env.SESSION_SECRET || 'ppadun9-secret-key',
    resave: true, // 세션 변경 시 저장
    saveUninitialized: true, // 초기화되지 않은 세션도 저장
    cookie: {
        secure: false, // 개발환경에서는 false로 설정
        maxAge: getSessionExpiryTime(), // 당일 자정까지 유지
        httpOnly: true,
        sameSite: 'lax', // strict에서 lax로 변경하여 400 오류 방지
        path: '/' // 모든 경로에서 쿠키 접근 가능
    },
    name: 'ppadun9.sid' // 세션 쿠키 이름 명시
};

// 세션 스토어 설정 - MemoryStore 사용
sessionConfig.store = new session.MemoryStore();

app.use(session(sessionConfig));

// 세션 만료 시간 자동 갱신 미들웨어
app.use((req, res, next) => {
    if (req.session && (req.session.isLoggedIn || req.session.user)) {
        // 세션 쿠키 만료 시간을 자정으로 갱신
        req.session.cookie.maxAge = getSessionExpiryTime();
    }
    next();
});

// API 라우트 설정
const gameRoutes = require('./routes/game');
const dailygamesRoutes = require('./routes/dailygames');
const dailyGamesRoutes = require('./routes/daily-games');
const teamGameRoutes = require('./routes/team-game');
const teamGamesRoutes = require('./routes/team-games');
const membersRoutes = require('./routes/members');
const noticesRoutes = require('./routes/notices');
const gameProgressRoutes = require('./routes/game-progress');
const pointChargingRoutes = require('./routes/point-charging');
const friendInviteRoutes = require('./routes/friend-invite');
const customerInquiriesRoutes = require('./routes/customer-inquiries');
const videoWatchRoutes = require('./routes/video-watch');
const bettingRoutes = require('./routes/betting');
const monitoringRoutes = require('./routes/monitoring');
const gameStatsRoutes = require('./routes/game-stats');

// API 라우트 사용 (순서 중요!) - 정적 파일보다 먼저 정의
app.use('/api/game', gameRoutes);
app.use('/api/dailygames', dailygamesRoutes);
app.use('/api/daily-games', dailyGamesRoutes);
app.use('/api/team-game', teamGameRoutes);
app.use('/api/team-games', teamGamesRoutes);
app.use('/api/notices', noticesRoutes);
app.use('/api/game-progress', gameProgressRoutes);
app.use('/api/point-charging', pointChargingRoutes);
app.use('/api/friend-invite', friendInviteRoutes);
app.use('/api/customer-inquiries', customerInquiriesRoutes);
app.use('/api/video-watch', videoWatchRoutes);
app.use('/api/betting', bettingRoutes);
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/game-stats', gameStatsRoutes);

// members 라우트는 /api/members로 접근하도록 변경
app.use('/api/members', membersRoutes);

// 로그인 상태 통계 API
app.get('/api/system/login-stats', async (req, res) => {
    try {
        if (!db) {
            return res.status(503).json({ error: '데이터베이스 연결이 준비되지 않았습니다.' });
        }

        // 직원 로그인 수
        const employeeCollection = db.collection('employee-member');
        const loggedInEmployees = await employeeCollection.countDocuments({
            isLoggedIn: true
        });

        // 회원 로그인 수
        const memberCollection = db.collection('game-member');
        const loggedInMembers = await memberCollection.countDocuments({
            isLoggedIn: true
        });

        // 전체 로그인 수
        const totalLoggedIn = loggedInEmployees + loggedInMembers;

        res.json({
            success: true,
            data: {
                employees: loggedInEmployees,
                members: loggedInMembers,
                total: totalLoggedIn,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('로그인 상태 통계 조회 오류:', error);
        res.status(500).json({ 
            success: false, 
            error: '로그인 상태 통계 조회 중 오류가 발생했습니다.' 
        });
    }
});

// 직원 API 라우트들 (정적 파일보다 먼저 정의)
app.get('/api/employee/current-user', (req, res) => {
    try {
        console.log('=== 현재 사용자 정보 요청 ===');
        console.log('세션 ID:', req.sessionID);
        console.log('세션 정보:', req.session);
        
        // 세션 기반 대신 간단한 응답
        if (req.session && req.session.user) {
            console.log('세션에서 사용자 발견:', req.session.user);
            res.json({ 
                success: true, 
                user: req.session.user 
            });
        } else {
            console.log('세션에 사용자 정보 없음 - 기본 응답');
            // 세션이 없어도 400 오류 대신 기본 응답
            res.json({ 
                success: false, 
                message: '로그인되지 않았습니다.',
                user: null
            });
        }
    } catch (error) {
        console.error('현재 사용자 정보 조회 오류:', error);
        // 오류가 발생해도 400 대신 500 사용
        res.status(500).json({ 
            success: false,
            error: '서버 오류가 발생했습니다.',
            user: null
        });
    }
});

// 로그아웃 API
app.post('/api/employee/logout', async (req, res) => {
    try {
        // 로그아웃 시간을 데이터베이스에 기록
        if (req.session && req.session.user && req.session.user.username) {
            if (!db) {
                console.error('MongoDB 연결이 설정되지 않았습니다.');
                return res.status(503).json({ error: '데이터베이스 연결이 준비되지 않았습니다.' });
            }

            const collection = db.collection(COLLECTION_NAME);
            
            // 로그아웃 시간 업데이트
            await collection.updateOne(
                { username: req.session.user.username },
                { 
                    $set: { 
                        lastLogoutAt: getKoreanTime(),
                        isLoggedIn: false,
                        currentSessionId: null, // 세션 ID 초기화
                        updatedAt: getKoreanTime()
                    } 
                }
            );
            
            console.log('로그아웃 시간 기록 완료:', req.session.user.username);
        }

        req.session.destroy((err) => {
            if (err) {
                console.error('세션 삭제 오류:', err);
                return res.status(500).json({ error: '로그아웃 중 오류가 발생했습니다.' });
            }
            res.json({ 
                success: true, 
                message: '로그아웃되었습니다.' 
            });
        });
    } catch (error) {
        console.error('로그아웃 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
});

// 정적 파일 제공 (API 라우트 이후에 정의)
app.use(express.static(path.join(__dirname, 'public')));

// 메인 페이지
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 직원등록 페이지
app.get('/employee-register.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'employee-register.html'));
});

// 직원목록 페이지
app.get('/employee-list.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'employee-list.html'));
});

// 직원 로그인 페이지
app.get('/employee-login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'employee-login.html'));
});

// 아이디 찾기 페이지
app.get('/employee-id.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'employee-id.html'));
});

// 비밀번호 찾기 페이지
app.get('/employee-password.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'employee-password.html'));
});

// 오늘의 경기 등록 페이지
app.get('/today-game.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'today-game.html'));
});

// 게임 설정 페이지
app.get('/team-game.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'team-game.html'));
});

// 오늘의 경기 시작 페이지
app.get('/today-game-start.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'today-game-start.html'));
});

// 오늘의 경기 종료 페이지
app.get('/today-game-end.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'today-game-end.html'));
});

// 오늘의 경기 상황 페이지
app.get('/today-game-status.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'today-game-status.html'));
});

// 오늘의 경기 확인 페이지
app.get('/today-game-display.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'today-game-display.html'));
});

// 회원 관리 페이지
app.get('/employee-member.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'employee-member.html'));
});

// 회원 리스트 페이지 (기존 member-management.html)
app.get('/member-list.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'member-list.html'));
});

// 회원 관리 메인 페이지 (새로운)
app.get('/member-management.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'member-management.html'));
});

// 회원 로그인 현황 페이지 (새로운)
app.get('/member-login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'member-login.html'));
});

// 포인트 충전 리스트 페이지
app.get('/point-charging-list.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'point-charging-list.html'));
});

// 친구초대 리스트 페이지
app.get('/friend-invite-list.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'friend-invite-list.html'));
});

// 아이디 중복 확인 API
app.post('/api/employee/check-id', async (req, res) => {
    try {
        const { username } = req.body;
        console.log('아이디 중복 확인 요청:', username);
        
        if (!db) {
            console.error('MongoDB 연결이 설정되지 않았습니다.');
            return res.status(503).json({ error: '데이터베이스 연결이 준비되지 않았습니다.' });
        }
        
        const collection = db.collection(COLLECTION_NAME);
        console.log('컬렉션 접근:', COLLECTION_NAME);
        
        const existingEmployee = await collection.findOne({ username });
        console.log('기존 직원 검색 결과:', existingEmployee ? '존재함' : '없음');
        
        res.json({ available: !existingEmployee });
    } catch (error) {
        console.error('아이디 중복 확인 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
});

// 직원 등록 API
app.post('/api/employee/register', async (req, res) => {
    try {
        if (!db) {
            console.error('MongoDB 연결이 설정되지 않았습니다.');
            return res.status(503).json({ error: '데이터베이스 연결이 준비되지 않았습니다.' });
        }

        const {
            name,
            email,
            username,
            password,
            position,
            department,
            phone
        } = req.body;

        const collection = db.collection(COLLECTION_NAME);
        
        // 아이디 중복 확인
        const existingEmployee = await collection.findOne({ username });
        if (existingEmployee) {
            return res.status(400).json({ error: '이미 등록된 아이디가 있습니다.' });
        }

        // 이메일 중복 확인
        const existingEmail = await collection.findOne({ email });
        if (existingEmail) {
            return res.status(400).json({ error: '이미 등록된 이메일이 있습니다.' });
        }

        // 새 직원 데이터 생성
        const newEmployee = {
            name,
            email,
            username,
            password, // 실제로는 해시화해야 함
            position,
            department,
            phone,
            isLoggedIn: false, // 로그인 상태 필드 추가
            loginCount: 0, // 로그인 카운트 필드 추가
            lastLoginAt: null, // 마지막 로그인 시간 필드 추가
            lastActivityAt: null, // 마지막 활동 시간 필드 추가
            lastLogoutAt: null, // 마지막 로그아웃 시간 필드 추가
            createdAt: getKoreanTime(),
            updatedAt: getKoreanTime()
        };

        const result = await collection.insertOne(newEmployee);
        
        res.json({ 
            success: true, 
            message: '직원이 성공적으로 등록되었습니다.',
            employeeId: result.insertedId 
        });
    } catch (error) {
        console.error('직원 등록 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
});

// 직원 목록 조회 API
app.get('/api/employee/list', async (req, res) => {
    try {
        if (!db) {
            console.error('MongoDB 연결이 설정되지 않았습니다.');
            return res.status(503).json({ error: '데이터베이스 연결이 준비되지 않았습니다.' });
        }

        const collection = db.collection(COLLECTION_NAME);
        const employees = await collection.find({}).toArray();
        
        // 비밀번호는 제외하고 반환
        const safeEmployees = employees.map(emp => {
            const { password, ...safeEmp } = emp;
            return safeEmp;
        });
        
        res.json(safeEmployees);
    } catch (error) {
        console.error('직원 목록 조회 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
});

// 로그인 통계 조회 API (5분 이내 활동자만 온라인으로 간주)
app.get('/api/employee/login-stats', async (req, res) => {
    try {
        console.log('=== 로그인 통계 조회 요청 ===');
        
        // MongoDB 연결 확인
        if (!db) {
            console.error('MongoDB 연결이 설정되지 않았습니다.');
            return res.status(503).json({ 
                success: false,
                error: '데이터베이스 연결이 준비되지 않았습니다.' 
            });
        }

        const collection = db.collection(COLLECTION_NAME);
        console.log('컬렉션 접근:', COLLECTION_NAME);
        
        // 전체 직원 수
        const totalEmployees = await collection.countDocuments();
        console.log('전체 직원 수:', totalEmployees);
        
        // 30분 이내 활동자만 온라인으로 간주 (30분 = 30 * 60 * 1000 밀리초)
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
        
        // 30분 이내에 lastActivityAt이 갱신된 직원들만 온라인으로 간주 (lastActivityAt 우선, 없으면 lastLoginAt 사용)
        const onlineUsersList = await collection.find(
            { 
                isLoggedIn: true,
                $or: [
                    { lastActivityAt: { $gte: thirtyMinutesAgo } },
                    { 
                        lastActivityAt: { $exists: false },
                        lastLoginAt: { $gte: thirtyMinutesAgo }
                    }
                ]
            },
            { 
                username: 1, 
                name: 1, 
                lastLoginAt: 1,
                lastActivityAt: 1,
                lastLogoutAt: 1,
                loginCount: 1,
                isLoggedIn: 1
            }
        ).sort({ lastActivityAt: -1, lastLoginAt: -1 }).toArray();
        
        // 현재 세션 사용자가 있다면 추가 (중복 제거)
        if (req.session && req.session.user) {
            console.log('현재 세션 사용자:', req.session.user);
            
            const currentUser = await collection.findOne(
                { username: req.session.user.username },
                { username: 1, name: 1, lastLoginAt: 1, lastLogoutAt: 1, loginCount: 1, isLoggedIn: 1 }
            );
            
            if (currentUser) {
                // 현재 세션 사용자가 목록에 없으면 추가
                const existingUser = onlineUsersList.find(u => u.username === currentUser.username);
                if (!existingUser) {
                onlineUsersList.push({
                    ...currentUser,
                    lastLoginAt: new Date(), // 현재 시간으로 설정
                        isLoggedIn: true,
                    isCurrentSession: true
                });
                } else {
                    // 기존 사용자에 현재 세션 표시 추가
                    existingUser.isCurrentSession = true;
                    existingUser.lastLoginAt = new Date();
                }
            }
        }
        
        // 30분 이상 활동이 없는 직원들을 자동으로 오프라인 처리
        const inactiveUsers = await collection.find(
            { 
                isLoggedIn: true,
                $or: [
                    { lastActivityAt: { $lt: thirtyMinutesAgo } },
                    { 
                        lastActivityAt: { $exists: false },
                        lastLoginAt: { $lt: thirtyMinutesAgo }
                    }
                ]
            }
        ).toArray();
        
        if (inactiveUsers.length > 0) {
            console.log(`${inactiveUsers.length}명의 비활성 직원을 오프라인 처리합니다.`);
            
            // 비활성 사용자들을 오프라인으로 처리
            await collection.updateMany(
                { 
                    isLoggedIn: true,
                    $or: [
                        { lastActivityAt: { $lt: thirtyMinutesAgo } },
                        { 
                            lastActivityAt: { $exists: false },
                            lastLoginAt: { $lt: thirtyMinutesAgo }
                        }
                    ]
                },
                { 
                    $set: { 
                        isLoggedIn: false,
                        lastLogoutAt: getKoreanTime(),
                        updatedAt: getKoreanTime()
            }
                }
            );
            
            console.log('비활성 직원 오프라인 처리 완료');
        }
        
        const onlineUsers = onlineUsersList.length;
        console.log('30분 이내 활동한 온라인 직원 수:', onlineUsers);
        console.log('온라인 직원 목록:', onlineUsersList);
        
        // 성공 응답
        res.json({
            success: true,
            stats: {
                totalEmployees: totalEmployees,
                onlineUsers: onlineUsers,
                onlineUsersList: onlineUsersList
            }
        });
        
    } catch (error) {
        console.error('로그인 통계 조회 오류:', error);
        
        // 오류 응답
        res.status(500).json({ 
            success: false,
            error: '서버 오류가 발생했습니다.',
            details: error.message
        });
    }
});

// 직원 상세 조회 API
app.get('/api/employee/:id', async (req, res) => {
    try {
        if (!db) {
            console.error('MongoDB 연결이 설정되지 않았습니다.');
            return res.status(503).json({ error: '데이터베이스 연결이 준비되지 않았습니다.' });
        }

        const { id } = req.params;
        
        // ObjectId 형식 검증
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: '올바르지 않은 직원 ID 형식입니다.' });
        }
        
        const collection = db.collection(COLLECTION_NAME);
        
        const employee = await collection.findOne({ _id: new ObjectId(id) });
        if (!employee) {
            return res.status(404).json({ error: '직원을 찾을 수 없습니다.' });
        }
        
        // 비밀번호는 제외하고 반환
        const { password, ...safeEmployee } = employee;
        res.json(safeEmployee);
    } catch (error) {
        console.error('직원 상세 조회 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
});

// 직원 정보 수정 API
app.put('/api/employee/:id', async (req, res) => {
    try {
        if (!db) {
            console.error('MongoDB 연결이 설정되지 않았습니다.');
            return res.status(503).json({ error: '데이터베이스 연결이 준비되지 않았습니다.' });
        }

        const { id } = req.params;
        
        // ObjectId 형식 검증
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: '올바르지 않은 직원 ID 형식입니다.' });
        }
        
        const updateData = req.body;
        const collection = db.collection(COLLECTION_NAME);
        
        // 업데이트 시간 추가
        updateData.updatedAt = getKoreanTime();
        
        const result = await collection.updateOne(
            { _id: new ObjectId(id) },
            { $set: updateData }
        );
        
        if (result.matchedCount === 0) {
            return res.status(404).json({ error: '직원을 찾을 수 없습니다.' });
        }
        
        res.json({ success: true, message: '직원 정보가 성공적으로 수정되었습니다.' });
    } catch (error) {
        console.error('직원 정보 수정 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
});

// 직원 삭제 API
app.delete('/api/employee/:id', async (req, res) => {
    try {
        if (!db) {
            console.error('MongoDB 연결이 설정되지 않았습니다.');
            return res.status(503).json({ error: '데이터베이스 연결이 준비되지 않았습니다.' });
        }

        const { id } = req.params;
        
        // ObjectId 형식 검증
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: '올바르지 않은 직원 ID 형식입니다.' });
        }
        
        const collection = db.collection(COLLECTION_NAME);
        
        const result = await collection.deleteOne({ _id: new ObjectId(id) });
        
        if (result.deletedCount === 0) {
            return res.status(404).json({ error: '직원을 찾을 수 없습니다.' });
        }
        
        res.json({ success: true, message: '직원이 성공적으로 삭제되었습니다.' });
    } catch (error) {
        console.error('직원 삭제 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
});

// 직원 로그인 API
app.post('/api/employee/login', async (req, res) => {
    try {
        if (!db) {
            console.error('MongoDB 연결이 설정되지 않았습니다.');
            return res.status(503).json({ error: '데이터베이스 연결이 준비되지 않았습니다.' });
        }

        const { username, password } = req.body;
        console.log('로그인 시도:', { username, password: '***' });
        
        // 필수 필드 검증
        if (!username || !password) {
            return res.status(400).json({ error: '아이디와 비밀번호를 모두 입력해주세요.' });
        }

        const collection = db.collection(COLLECTION_NAME);
        
        // 사용자 검색
        const employee = await collection.findOne({ username });
        console.log('사용자 검색 결과:', employee ? '찾음' : '없음');
        
        if (!employee) {
            return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
        }
        
        // 비밀번호 확인 (실제로는 해시화된 비밀번호와 비교해야 함)
        if (employee.password !== password) {
            return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
        }

        // 이중 로그인 체크 및 처리
        console.log('로그인 시도 사용자:', employee.username);
        
        const sessionId = req.sessionID;
        console.log('현재 세션 ID:', sessionId);
        
        // 이미 로그인된 상태인지 확인
        if (employee.isLoggedIn && employee.currentSessionId && employee.currentSessionId !== sessionId) {
            console.log('이중 로그인 감지:', employee.username);
            console.log('기존 세션 ID:', employee.currentSessionId);
            console.log('새 세션 ID:', sessionId);
            
            // 기존 세션을 무효화하고 새 세션으로 교체
            await collection.updateOne(
                { username },
                { 
                    $set: { 
                        currentSessionId: sessionId,
                        lastLoginAt: getKoreanTime(),
                        lastActivityAt: getKoreanTime(),
                        updatedAt: getKoreanTime()
                    } 
                }
            );
            
            console.log('기존 세션 무효화 완료, 새 세션으로 교체됨');
        }
        
        // 로그인 카운트 증가
        const newLoginCount = (employee.loginCount || 0) + 1;
        const lastLoginAt = getKoreanTime();
        
        // 데이터베이스에 로그인 정보 업데이트 (세션 ID 포함)
        await collection.updateOne(
            { username },
            { 
                $set: { 
                    loginCount: newLoginCount,
                    lastLoginAt: lastLoginAt,
                    lastActivityAt: lastLoginAt,
                    isLoggedIn: true,
                    currentSessionId: sessionId, // 현재 세션 ID 저장
                    updatedAt: getKoreanTime()
                } 
            }
        );
        
        // 로그인 성공 - 비밀번호는 제외하고 사용자 정보 반환
        const { password: _, ...userInfo } = employee;
        const updatedUserInfo = {
            ...userInfo,
            loginCount: newLoginCount,
            lastLoginAt: lastLoginAt,
            currentSessionId: sessionId
        };
        
        console.log('로그인 성공, 세션에 저장할 사용자 정보:', updatedUserInfo);
        console.log('세션 ID:', req.sessionID);
        
        // 세션에 사용자 정보 저장
        req.session.user = updatedUserInfo;
        console.log('세션 저장 완료:', req.session.user);
        console.log('세션 정보:', req.session);
        
        res.json({ 
            success: true, 
            message: '로그인이 성공했습니다.',
            user: updatedUserInfo
        });
    } catch (error) {
        console.error('직원 로그인 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
});



// 세션 디버깅 API
app.get('/api/debug/session', (req, res) => {
    try {
        const sessionInfo = {
            sessionID: req.sessionID,
            session: req.session,
            hasUser: !!(req.session && req.session.user),
            hasLoginFlag: !!(req.session && req.session.isLoggedIn),
            cookies: req.headers.cookie,
            userAgent: req.headers['user-agent']
        };
        
        console.log('세션 디버깅 정보:', sessionInfo);
        
        res.json({
            success: true,
            data: sessionInfo
        });
    } catch (error) {
        console.error('세션 디버깅 오류:', error);
        res.status(500).json({
            success: false,
            message: '세션 디버깅 중 오류가 발생했습니다.'
        });
    }
});

// 세션 상태 체크 및 정리 API
app.get('/api/employee/check-session-status', async (req, res) => {
    try {
        if (!db) {
            console.error('MongoDB 연결이 설정되지 않았습니다.');
            return res.status(503).json({ error: '데이터베이스 연결이 준비되지 않았습니다.' });
        }

        const collection = db.collection(COLLECTION_NAME);
        
        // 현재 세션이 있는 사용자 확인
        const currentSessionUser = req.session && req.session.user ? req.session.user.username : null;
        
        // isLoggedIn이 true이지만 세션이 없는 사용자들을 찾아서 정리
        if (!currentSessionUser) {
            // 세션이 없는 경우, isLoggedIn이 true인 사용자들을 false로 업데이트
            const result = await collection.updateMany(
                { isLoggedIn: true },
                { 
                    $set: { 
                        isLoggedIn: false,
                        lastLogoutAt: new Date(),
                        updatedAt: getKoreanTime()
                    } 
                }
            );
            
            console.log('세션 만료로 인한 로그아웃 처리:', result.modifiedCount, '명');
        }
        
        res.json({
            success: true,
            currentSessionUser: currentSessionUser,
            message: '세션 상태 체크 완료'
        });
    } catch (error) {
        console.error('세션 상태 체크 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
});

// 강제 로그아웃 API
app.post('/api/employee/force-logout', async (req, res) => {
    try {
        if (!db) {
            console.error('MongoDB 연결이 설정되지 않았습니다.');
            return res.status(503).json({ error: '데이터베이스 연결이 준비되지 않았습니다.' });
        }

        const { username } = req.body;
        
        if (!username) {
            return res.status(400).json({ error: '사용자명이 필요합니다.' });
        }

        const collection = db.collection(COLLECTION_NAME);
        
        // 해당 사용자를 강제 로그아웃 처리
        const result = await collection.updateOne(
            { username: username },
            { 
                $set: { 
                    isLoggedIn: false,
                    lastLogoutAt: getKoreanTime(),
                    currentSessionId: null, // 세션 ID 초기화
                    updatedAt: getKoreanTime()
                } 
            }
        );
        
        if (result.matchedCount === 0) {
            return res.status(404).json({ error: '해당 사용자를 찾을 수 없습니다.' });
        }
        
        console.log('강제 로그아웃 처리 완료:', username);
        
        res.json({
            success: true,
            message: `${username} 사용자가 강제 로그아웃되었습니다.`
        });
    } catch (error) {
        console.error('강제 로그아웃 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
});

// 모든 사용자 강제 로그아웃 API (디버깅용)
app.post('/api/employee/force-logout-all', async (req, res) => {
    try {
        if (!db) {
            console.error('MongoDB 연결이 설정되지 않았습니다.');
            return res.status(503).json({ error: '데이터베이스 연결이 준비되지 않았습니다.' });
        }

        const collection = db.collection(COLLECTION_NAME);
        
        // 모든 사용자를 강제 로그아웃 처리
        const result = await collection.updateMany(
            { isLoggedIn: true },
            { 
                $set: { 
                    isLoggedIn: false,
                    lastLogoutAt: getKoreanTime(),
                    currentSessionId: null,
                    updatedAt: getKoreanTime()
                } 
            }
        );
        
        console.log('모든 사용자 강제 로그아웃 처리 완료:', result.modifiedCount, '명');
        
        res.json({
            success: true,
            message: `${result.modifiedCount}명의 사용자가 강제 로그아웃되었습니다.`
        });
    } catch (error) {
        console.error('모든 사용자 강제 로그아웃 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
});

// 데이터베이스 상태 정리 API (근본적 해결용)
app.post('/api/employee/cleanup-database', async (req, res) => {
    try {
        if (!db) {
            console.error('MongoDB 연결이 설정되지 않았습니다.');
            return res.status(503).json({ error: '데이터베이스 연결이 준비되지 않았습니다.' });
        }

        const collection = db.collection(COLLECTION_NAME);
        
        // 1. 30분 이상 활동이 없는 사용자들을 자동 로그아웃
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
        const inactiveResult = await collection.updateMany(
            { 
                isLoggedIn: true,
                $or: [
                    { lastActivityAt: { $lt: thirtyMinutesAgo } },
                    { 
                        lastActivityAt: { $exists: false },
                        lastLoginAt: { $lt: thirtyMinutesAgo }
                    }
                ]
            },
            { 
                $set: { 
                    isLoggedIn: false,
                    lastLogoutAt: getKoreanTime(),
                    currentSessionId: null,
                    updatedAt: getKoreanTime()
                } 
            }
        );
        
        // 2. 잘못된 상태의 사용자들 정리
        const cleanupResult = await collection.updateMany(
            { 
                isLoggedIn: true,
                lastLoginAt: { $exists: false }
            },
            { 
                $set: { 
                    isLoggedIn: false,
                    lastLogoutAt: getKoreanTime(),
                    currentSessionId: null,
                    updatedAt: getKoreanTime()
                } 
            }
        );
        
        console.log('데이터베이스 정리 완료:', {
            inactiveUsers: inactiveResult.modifiedCount,
            cleanupUsers: cleanupResult.modifiedCount
        });
        
        res.json({
            success: true,
            message: '데이터베이스 상태가 정리되었습니다.',
            inactiveUsers: inactiveResult.modifiedCount,
            cleanupUsers: cleanupResult.modifiedCount
        });
    } catch (error) {
        console.error('데이터베이스 정리 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
});

// 수동 자동 로그아웃 실행 API (관리자용)
app.post('/api/system/auto-logout-all', async (req, res) => {
    try {
        if (!db) {
            console.error('MongoDB 연결이 설정되지 않았습니다.');
            return res.status(503).json({ error: '데이터베이스 연결이 준비되지 않았습니다.' });
        }

        const collection = db.collection(COLLECTION_NAME);
        
        // 현재 로그인된 모든 직원을 로그아웃 처리
        const result = await collection.updateMany(
            { isLoggedIn: true },
            { 
                $set: { 
                    isLoggedIn: false,
                    lastLogoutAt: getKoreanTime(),
                    currentSessionId: null, // 세션 ID 초기화
                    updatedAt: getKoreanTime()
                } 
            }
        );
        
        const koreanTime = formatKoreanTime(getKoreanTime(), 'datetime');
        console.log(`[${koreanTime}] 수동 자동 로그아웃 완료: ${result.modifiedCount}명의 직원이 로그아웃되었습니다.`);
        
        res.json({
            success: true,
            message: `${result.modifiedCount}명의 직원이 자동 로그아웃되었습니다.`,
            logoutCount: result.modifiedCount,
            timestamp: koreanTime
        });
    } catch (error) {
        console.error('수동 자동 로그아웃 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
});

        // 사용자 활동 갱신 API (실제 사용 활동 기반)
        app.post('/api/employee/update-activity', async (req, res) => {
            try {
                if (!db) {
                    console.error('MongoDB 연결이 설정되지 않았습니다.');
                    return res.status(503).json({ error: '데이터베이스 연결이 준비되지 않았습니다.' });
                }

                // 세션에서 사용자 정보 확인
                if (!req.session || !req.session.user) {
                    return res.status(401).json({ error: '로그인이 필요합니다.' });
                }

                const username = req.session.user.username;
                const collection = db.collection(COLLECTION_NAME);
                const currentTime = getKoreanTime();
                
                // 사용자의 활동 시간을 현재 시간으로 갱신 (새로운 필드 추가)
                const result = await collection.updateOne(
                    { username: username },
                    { 
                        $set: { 
                            lastLoginAt: currentTime,
                            lastActivityAt: currentTime,  // 새로운 활동 시간 필드
                            updatedAt: currentTime
                        } 
                    }
                );
                
                if (result.matchedCount === 0) {
                    return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
                }
                
                res.json({
                    success: true,
                    message: '활동 시간이 갱신되었습니다.',
                    timestamp: currentTime
                });
            } catch (error) {
                console.error('활동 갱신 오류:', error);
                res.status(500).json({ error: '서버 오류가 발생했습니다.' });
            }
        });

// 세션 검증 API (중복 로그인 방지용)
app.get('/api/employee/validate-session', async (req, res) => {
    try {
        if (!db) {
            console.error('MongoDB 연결이 설정되지 않았습니다.');
            return res.status(503).json({ error: '데이터베이스 연결이 준비되지 않았습니다.' });
        }

        // 세션에서 사용자 정보 확인
        if (!req.session || !req.session.user) {
            return res.status(401).json({ 
                valid: false, 
                error: '로그인이 필요합니다.' 
            });
        }

        const username = req.session.user.username;
        const currentSessionId = req.sessionID;
        const collection = db.collection(COLLECTION_NAME);
        
        // 데이터베이스에서 사용자 정보 조회
        const user = await collection.findOne({ username });
        
        if (!user) {
            return res.status(404).json({ 
                valid: false, 
                error: '사용자를 찾을 수 없습니다.' 
            });
        }
        
        // 세션 ID 비교
        if (user.currentSessionId && user.currentSessionId !== currentSessionId) {
            console.log(`중복 로그인 감지: ${username} - 기존 세션: ${user.currentSessionId}, 현재 세션: ${currentSessionId}`);
            
            // 세션 무효화
            req.session.destroy((err) => {
                if (err) {
                    console.error('세션 삭제 오류:', err);
                }
            });
            
            return res.status(401).json({ 
                valid: false, 
                error: '다른 기기에서 로그인되어 세션이 종료되었습니다.',
                duplicateLogin: true
            });
        }
        
        // 세션이 유효한 경우
        res.json({ 
            valid: true, 
            user: {
                username: user.username,
                name: user.name,
                isLoggedIn: user.isLoggedIn
            }
        });
        
    } catch (error) {
        console.error('세션 검증 오류:', error);
        res.status(500).json({ 
            valid: false,
            error: '서버 오류가 발생했습니다.' 
        });
    }
});

// 세션 디버깅 API
app.get('/api/debug/session', (req, res) => {
    try {
        console.log('=== 세션 디버깅 요청 ===');
        console.log('세션 ID:', req.sessionID);
        console.log('세션 정보:', req.session);
        console.log('쿠키 정보:', req.headers.cookie);
        
        res.json({
            sessionId: req.sessionID,
            session: req.session,
            hasUser: !!(req.session && req.session.user),
            user: req.session && req.session.user ? req.session.user : null,
            cookies: req.headers.cookie
        });
    } catch (error) {
        console.error('세션 디버깅 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
});

// 현재 로그인 상태 확인 API
app.get('/api/employee/check-login-status', async (req, res) => {
    try {
        if (!db) {
            return res.status(503).json({ error: '데이터베이스 연결이 준비되지 않았습니다.' });
        }

        const collection = db.collection(COLLECTION_NAME);
        
        // 현재 세션 사용자 정보
        const currentUser = req.session && req.session.user ? req.session.user : null;
        
        if (!currentUser) {
            return res.json({
                success: true,
                isLoggedIn: false,
                message: '로그인되지 않은 상태입니다.'
            });
        }
        
        // 데이터베이스에서 최신 사용자 정보 조회
        const dbUser = await collection.findOne(
            { username: currentUser.username },
            { 
                username: 1, 
                name: 1, 
                isLoggedIn: 1, 
                currentSessionId: 1,
                lastLoginAt: 1,
                lastActivityAt: 1
            }
        );
        
        if (!dbUser) {
            return res.json({
                success: true,
                isLoggedIn: false,
                message: '사용자 정보를 찾을 수 없습니다.'
            });
        }
        
        // 세션 ID 비교로 이중 로그인 확인
        const isCurrentSession = dbUser.currentSessionId === req.sessionID;
        const isLoggedIn = dbUser.isLoggedIn && isCurrentSession;
        
        res.json({
            success: true,
            isLoggedIn: isLoggedIn,
            isCurrentSession: isCurrentSession,
            user: {
                username: dbUser.username,
                name: dbUser.name,
                lastLoginAt: dbUser.lastLoginAt,
                lastActivityAt: dbUser.lastActivityAt
            },
            sessionInfo: {
                currentSessionId: req.sessionID,
                dbSessionId: dbUser.currentSessionId
            },
            message: isLoggedIn ? '정상 로그인 상태입니다.' : '다른 세션에서 로그인되었습니다.'
        });
    } catch (error) {
        console.error('로그인 상태 확인 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
});

// 사용자 활동 감지 API (자동 로그아웃 방지)
app.post('/api/employee/activity', async (req, res) => {
    try {
        if (!db) {
            return res.status(503).json({ error: '데이터베이스 연결이 준비되지 않았습니다.' });
        }

        const collection = db.collection(COLLECTION_NAME);
        
        // 현재 세션 사용자 정보
        const currentUser = req.session && req.session.user ? req.session.user : null;
        
        if (!currentUser) {
            return res.json({
                success: false,
                message: '로그인되지 않은 상태입니다.'
            });
        }
        
        // 활동 시간 업데이트
        await collection.updateOne(
            { username: currentUser.username },
            { 
                $set: { 
                    lastActivityAt: getKoreanTime(),
                    updatedAt: getKoreanTime()
                } 
            }
        );
        
        res.json({
            success: true,
            message: '활동이 기록되었습니다.',
            timestamp: getKoreanTime()
        });
    } catch (error) {
        console.error('활동 감지 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
});

// 현재 로그인된 사용자 수 조회 API (30분 이내 활동자 기준)
app.get('/api/employee/online-users', async (req, res) => {
    try {
        if (!db) {
            console.error('MongoDB 연결이 설정되지 않았습니다.');
            return res.status(503).json({ error: '데이터베이스 연결이 준비되지 않았습니다.' });
        }

        const collection = db.collection(COLLECTION_NAME);
        
        // 30분 이내에 활동한 사용자들을 온라인으로 간주
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
        
        const onlineUsers = await collection.find(
            { 
                isLoggedIn: true,
                lastLoginAt: { $gte: thirtyMinutesAgo }
            },
            { 
                username: 1, 
                name: 1, 
                lastLoginAt: 1 
            }
        ).sort({ lastLoginAt: -1 }).toArray();
        
        res.json({
            success: true,
            onlineUsers: onlineUsers,
            onlineCount: onlineUsers.length
        });
    } catch (error) {
        console.error('온라인 사용자 조회 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
});



// 아이디 찾기 API
app.post('/api/employee/find-id', async (req, res) => {
    try {
        if (!db) {
            console.error('MongoDB 연결이 설정되지 않았습니다.');
            return res.status(503).json({ error: '데이터베이스 연결이 준비되지 않았습니다.' });
        }

        const { email } = req.body;
        
        // 필수 필드 검증
        if (!email) {
            return res.status(400).json({ error: '이메일 주소를 입력해주세요.' });
        }

        // 이메일 형식 검증
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: '올바른 이메일 형식을 입력해주세요.' });
        }

        const collection = db.collection(COLLECTION_NAME);
        
        // 이메일로 사용자 검색
        const employee = await collection.findOne({ email });
        
        if (!employee) {
            return res.status(404).json({ error: '해당 이메일로 가입된 계정을 찾을 수 없습니다.' });
        }
        
        // 아이디 반환 (보안을 위해 일부만 표시)
        const username = employee.username;
        const maskedUsername = username.length > 2 
            ? username.substring(0, 2) + '*'.repeat(username.length - 2)
            : username;
        
        res.json({ 
            success: true, 
            message: '아이디를 찾았습니다.',
            userId: maskedUsername,
            fullUserId: username // 실제 구현에서는 이메일로 전송하는 것이 좋음
        });
    } catch (error) {
        console.error('아이디 찾기 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
});

// 비밀번호 찾기 API
app.post('/api/employee/find-password', async (req, res) => {
    try {
        if (!db) {
            console.error('MongoDB 연결이 설정되지 않았습니다.');
            return res.status(503).json({ error: '데이터베이스 연결이 준비되지 않았습니다.' });
        }

        const { email } = req.body;
        
        // 필수 필드 검증
        if (!email) {
            return res.status(400).json({ error: '이메일 주소를 입력해주세요.' });
        }

        // 이메일 형식 검증
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: '올바른 이메일 형식을 입력해주세요.' });
        }

        const collection = db.collection(COLLECTION_NAME);
        
        // 이메일로 사용자 검색
        const employee = await collection.findOne({ email });
        
        if (!employee) {
            return res.status(404).json({ error: '해당 이메일로 가입된 계정을 찾을 수 없습니다.' });
        }
        
        // 인증번호 생성 (실제로는 이메일로 전송)
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        
        // 세션에 인증번호 저장 (실제로는 Redis나 데이터베이스에 저장)
        req.session.verificationCode = verificationCode;
        req.session.verificationEmail = email;
        req.session.verificationTime = new Date();
        
        // 실제 구현에서는 이메일 발송 로직 추가
        console.log(`인증번호 ${verificationCode}가 ${email}로 발송되었습니다.`);
        
        res.json({ 
            success: true, 
            message: '인증번호가 이메일로 발송되었습니다.',
            verificationCode: verificationCode // 실제 구현에서는 제거
        });
    } catch (error) {
        console.error('비밀번호 찾기 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
});

// 비밀번호 재설정 API
app.post('/api/employee/reset-password', async (req, res) => {
    try {
        if (!db) {
            console.error('MongoDB 연결이 설정되지 않았습니다.');
            return res.status(503).json({ error: '데이터베이스 연결이 준비되지 않았습니다.' });
        }

        const { email, newPassword } = req.body;
        
        // 필수 필드 검증
        if (!email || !newPassword) {
            return res.status(400).json({ error: '이메일과 새 비밀번호를 모두 입력해주세요.' });
        }

        // 비밀번호 길이 검증
        if (newPassword.length < 6) {
            return res.status(400).json({ error: '비밀번호는 6자 이상이어야 합니다.' });
        }

        const collection = db.collection(COLLECTION_NAME);
        
        // 이메일로 사용자 검색
        const employee = await collection.findOne({ email });
        
        if (!employee) {
            return res.status(404).json({ error: '해당 이메일로 가입된 계정을 찾을 수 없습니다.' });
        }
        
        // 비밀번호 업데이트
        const result = await collection.updateOne(
            { email },
            { 
                $set: { 
                    password: newPassword, // 실제로는 해시화해야 함
                    updatedAt: getKoreanTime()
                } 
            }
        );
        
        if (result.matchedCount === 0) {
            return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
        }
        
        // 세션에서 인증 정보 삭제
        delete req.session.verificationCode;
        delete req.session.verificationEmail;
        delete req.session.verificationTime;
        
        res.json({ 
            success: true, 
            message: '비밀번호가 성공적으로 재설정되었습니다.' 
        });
    } catch (error) {
        console.error('비밀번호 재설정 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
});

// 시스템 통계 API
app.get('/api/system/stats', async (req, res) => {
    try {
        if (!db) {
            return res.status(503).json({ error: '데이터베이스 연결이 준비되지 않았습니다.' });
        }

        const collection = db.collection(COLLECTION_NAME);
        
        // 전체 직원 수
        const totalEmployees = await collection.countDocuments();
        
        // 부서별 직원 수
        const departmentStats = await collection.aggregate([
            { $group: { _id: '$department', count: { $sum: 1 } } }
        ]).toArray();
        
        res.json({
            success: true,
            stats: {
                totalEmployees,
                departmentStats,
                serverTime: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('시스템 통계 조회 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
});

// 데이터베이스 초기화 API (lastLoginAt 필드 추가)
app.post('/api/system/init-login-fields', async (req, res) => {
    try {
        if (!db) {
            return res.status(503).json({ error: '데이터베이스 연결이 준비되지 않았습니다.' });
        }

        const collection = db.collection(COLLECTION_NAME);
        
        // lastLoginAt 필드가 없는 직원들에게 기본값 설정
        const result = await collection.updateMany(
            { lastLoginAt: { $exists: false } },
            { 
                $set: { 
                    lastLoginAt: new Date(),
                    loginCount: 0
                } 
            }
        );
        
        console.log('데이터베이스 초기화 결과:', result);
        
        res.json({
            success: true,
            message: '데이터베이스 초기화가 완료되었습니다.',
            modifiedCount: result.modifiedCount,
            matchedCount: result.matchedCount
        });
    } catch (error) {
        console.error('데이터베이스 초기화 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
});

// 직원 데이터베이스 스키마 업데이트 API (로그인 관련 필드 추가)
app.post('/api/system/update-employee-schema', async (req, res) => {
    try {
        if (!db) {
            return res.status(503).json({ error: '데이터베이스 연결이 준비되지 않았습니다.' });
        }

        const collection = db.collection(COLLECTION_NAME);
        
        let totalModified = 0;
        
        // isLoggedIn 필드가 없는 직원들에게 기본값 설정
        const isLoggedInResult = await collection.updateMany(
            { isLoggedIn: { $exists: false } },
            { 
                $set: { 
                    isLoggedIn: false,
                    updatedAt: getKoreanTime()
                } 
            }
        );
        totalModified += isLoggedInResult.modifiedCount;
        
        // loginCount 필드가 없는 직원들에게 기본값 설정
        const loginCountResult = await collection.updateMany(
            { loginCount: { $exists: false } },
            { 
                $set: { 
                    loginCount: 0,
                    updatedAt: getKoreanTime()
                } 
            }
        );
        totalModified += loginCountResult.modifiedCount;
        
        // lastLoginAt 필드가 없는 직원들에게 기본값 설정
        const lastLoginAtResult = await collection.updateMany(
            { lastLoginAt: { $exists: false } },
            { 
                $set: { 
                    lastLoginAt: null,
                    updatedAt: getKoreanTime()
                } 
            }
        );
        totalModified += lastLoginAtResult.modifiedCount;
        
        // lastLogoutAt 필드가 없는 직원들에게 기본값 설정
        const lastLogoutAtResult = await collection.updateMany(
            { lastLogoutAt: { $exists: false } },
            { 
                $set: { 
                    lastLogoutAt: null,
                    updatedAt: getKoreanTime()
                } 
            }
        );
        totalModified += lastLogoutAtResult.modifiedCount;
        
        console.log('직원 스키마 업데이트 결과:', {
            isLoggedIn: isLoggedInResult.modifiedCount,
            loginCount: loginCountResult.modifiedCount,
            lastLoginAt: lastLoginAtResult.modifiedCount,
            lastLogoutAt: lastLogoutAtResult.modifiedCount,
            total: totalModified
        });
        
        res.json({
            success: true,
            message: '직원 데이터베이스 스키마 업데이트가 완료되었습니다.',
            modifiedCount: totalModified,
            details: {
                isLoggedIn: isLoggedInResult.modifiedCount,
                loginCount: loginCountResult.modifiedCount,
                lastLoginAt: lastLoginAtResult.modifiedCount,
                lastLogoutAt: lastLogoutAtResult.modifiedCount
            }
        });
    } catch (error) {
        console.error('직원 스키마 업데이트 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
});

// 배너광고 수익 현황 API
app.get('/api/banner-ad-revenue', async (req, res) => {
    try {
        const { page = 1, limit = 20, dateRange = 'month', status = 'all', sortBy = 'date' } = req.query;
        
        if (!db) {
            return res.status(503).json({ 
                success: false,
                message: '데이터베이스 연결이 준비되지 않았습니다.' 
            });
        }
        
        const collection = db.collection('charging');
        
        // 날짜 범위 설정
        let dateFilter = {};
        const now = new Date();
        
        switch (dateRange) {
            case 'today':
                dateFilter = {
                    $or: [
                        { viewDate: { $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) } },
                        { clickDate: { $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) } }
                    ]
                };
                break;
            case 'week':
                const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                dateFilter = {
                    $or: [
                        { viewDate: { $gte: weekAgo } },
                        { clickDate: { $gte: weekAgo } }
                    ]
                };
                break;
            case 'month':
                dateFilter = {
                    $or: [
                        { 
                            viewDate: {
                                $gte: new Date(now.getFullYear(), now.getMonth(), 1),
                                $lt: new Date(now.getFullYear(), now.getMonth() + 1, 1)
                            }
                        },
                        { 
                            clickDate: {
                                $gte: new Date(now.getFullYear(), now.getMonth(), 1),
                                $lt: new Date(now.getFullYear(), now.getMonth() + 1, 1)
                            }
                        }
                    ]
                };
                break;
            case 'quarter':
                const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
                dateFilter = {
                    $or: [
                        { 
                            viewDate: {
                                $gte: quarterStart,
                                $lt: new Date(quarterStart.getFullYear(), quarterStart.getMonth() + 3, 1)
                            }
                        },
                        { 
                            clickDate: {
                                $gte: quarterStart,
                                $lt: new Date(quarterStart.getFullYear(), quarterStart.getMonth() + 3, 1)
                            }
                        }
                    ]
                };
                break;
            case 'year':
                dateFilter = {
                    $or: [
                        { 
                            viewDate: {
                                $gte: new Date(now.getFullYear(), 0, 1),
                                $lt: new Date(now.getFullYear() + 1, 0, 1)
                            }
                        },
                        { 
                            clickDate: {
                                $gte: new Date(now.getFullYear(), 0, 1),
                                $lt: new Date(now.getFullYear() + 1, 0, 1)
                            }
                        }
                    ]
                };
                break;
        }
        
        // 상태 필터 설정
        let statusFilter = {};
        if (status === 'clicked') {
            statusFilter = { clicked: true };
        } else if (status === 'viewed') {
            statusFilter = { clicked: false };
        }
        
        // 정렬 설정
        let sortOptions = {};
        switch (sortBy) {
            case 'date':
                sortOptions = { viewDate: -1, clickDate: -1 };
                break;
            case 'points':
                sortOptions = { amount: -1 };
                break;
            case 'clicks':
                sortOptions = { clicked: -1 };
                break;
            default:
                sortOptions = { viewDate: -1, clickDate: -1 };
        }
        
        // 기본 필터 (배너광고만)
        const baseFilter = { paymentMethod: 'banner_ad' };
        
        // 전체 필터 조합
        const filter = {
            ...baseFilter,
            ...dateFilter,
            ...statusFilter
        };
        
        // 전체 레코드 수 계산
        const totalRecords = await collection.countDocuments(filter);
        
        // 페이지네이션 적용
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const records = await collection.find(filter)
            .sort(sortOptions)
            .skip(skip)
            .limit(parseInt(limit))
            .toArray();
        
        // 통계 계산
        const stats = await collection.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: null,
                    totalViews: { $sum: 1 },
                    totalClicks: { $sum: { $cond: ['$clicked', 1, 0] } },
                    totalPointsEarned: { $sum: '$amount' },
                    uniqueMembers: { $addToSet: '$userId' }
                }
            }
        ]).toArray();
        
        const statsData = stats[0] || {
            totalViews: 0,
            totalClicks: 0,
            totalPointsEarned: 0,
            uniqueMembers: []
        };
        
        res.json({
            success: true,
            records: records,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalRecords / parseInt(limit)),
                totalRecords: totalRecords,
                hasNext: skip + records.length < totalRecords,
                hasPrev: parseInt(page) > 1
            },
            stats: {
                totalViews: statsData.totalViews,
                totalClicks: statsData.totalClicks,
                totalPointsEarned: statsData.totalPointsEarned,
                uniqueMembers: statsData.uniqueMembers.length
            }
        });
    } catch (error) {
        console.error('배너광고 수익 현황 조회 오류:', error);
        res.status(500).json({ 
            success: false,
            message: '배너광고 수익 현황을 불러오는데 실패했습니다.',
            error: error.message 
        });
    }
});

// 배팅 관련 API는 routes/betting.js에서 처리됩니다.

// 배팅 중지 API는 routes/betting.js에서 처리됩니다.

// 배팅 제출 API는 routes/betting.js에서 처리됩니다.

// 배팅 상태 확인 API는 routes/betting.js에서 처리됩니다.

// 예측 결과 처리 API
app.post('/api/betting/result', async (req, res) => {
    try {
        const { gameNumber, prediction, date } = req.body;
        
        if (!gameNumber || !prediction || !date) {
            return res.status(400).json({ 
                success: false, 
                message: '필수 정보가 누락되었습니다.' 
            });
        }
        
        if (!db) {
            return res.status(503).json({ 
                success: false, 
                message: '데이터베이스 연결이 준비되지 않았습니다.' 
            });
        }
        
        const bettingCollection = db.collection('betting-sessions');
        const userCollection = db.collection('game-member');
        
        // 해당 경기의 배팅 세션 조회
        const bettingSession = await bettingCollection.findOne({
            date: date,
            gameNumber: parseInt(gameNumber),
            status: 'stopped'
        });
        
        if (!bettingSession) {
            return res.status(404).json({
                success: false,
                message: '배팅 세션을 찾을 수 없습니다.'
            });
        }
        
        // 예측에 성공한 사용자들 조회
        const winners = await userCollection.find({
            'bettingHistory': {
                $elemMatch: {
                    date: date,
                    gameNumber: parseInt(gameNumber),
                    gameType: bettingSession.gameType,
                    prediction: prediction
                }
            }
        }).toArray();
        
        // 예측에 실패한 사용자들의 총 배팅 포인트 계산
        const losers = await userCollection.find({
            'bettingHistory': {
                $elemMatch: {
                    date: date,
                    gameNumber: parseInt(gameNumber),
                    gameType: bettingSession.gameType,
                    prediction: { $ne: prediction }
                }
            }
        }).toArray();
        
        let totalLostPoints = 0;
        const loserUpdates = [];
        
        // 실패한 사용자들의 포인트 회수 및 총액 계산
        for (const loser of losers) {
            const bettingRecord = loser.bettingHistory.find(bet => 
                bet.date === date && 
                bet.gameNumber === parseInt(gameNumber) &&
                bet.gameType === bettingSession.gameType
            );
            
            if (bettingRecord) {
                totalLostPoints += bettingRecord.points;
                loserUpdates.push({
                    userId: loser.userId,
                    points: bettingRecord.points
                });
            }
        }
        
        // 성공한 사용자들에게 포인트 분배
        const winnerUpdates = [];
        if (winners.length > 0 && totalLostPoints > 0) {
            const pointsPerWinner = Math.floor(totalLostPoints / winners.length);
            
            for (const winner of winners) {
                winnerUpdates.push({
                    userId: winner.userId,
                    points: pointsPerWinner
                });
            }
        }
        
        // 데이터베이스 업데이트
        for (const update of loserUpdates) {
            await userCollection.updateOne(
                { userId: update.userId },
                { $inc: { points: -update.points } }
            );
        }
        
        for (const update of winnerUpdates) {
            await userCollection.updateOne(
                { userId: update.userId },
                { $inc: { points: update.points } }
            );
        }
        
        // 배팅 세션에 결과 기록
        await bettingCollection.updateOne(
            { _id: bettingSession._id },
            { 
                $set: { 
                    result: prediction,
                    processedAt: new Date(),
                    winners: winners.map(w => w.userId),
                    totalWinners: winners.length,
                    totalLosers: losers.length,
                    totalLostPoints: totalLostPoints,
                    pointsPerWinner: winners.length > 0 ? Math.floor(totalLostPoints / winners.length) : 0
                } 
            }
        );

        // todaygames 컬렉션에 배팅결과 업데이트
        const todayGamesCollection = db.collection('todaygames');
        await todayGamesCollection.updateOne(
            { 
                date: date,
                gameNumber: parseInt(gameNumber)
            },
            { 
                $set: { 
                    bettingResult: prediction,
                    resultProcessedAt: new Date(),
                    totalWinners: winners.length,
                    totalLosers: losers.length,
                    totalLostPoints: totalLostPoints,
                    pointsPerWinner: winners.length > 0 ? Math.floor(totalLostPoints / winners.length) : 0
                } 
            }
        );
        
        console.log(`예측 결과 처리: ${date} ${gameNumber}경기 ${prediction}, 성공: ${winners.length}명, 실패: ${losers.length}명`);
        
        res.json({
            success: true,
            message: '예측 결과가 처리되었습니다.',
            winners: winners.map(w => w.userId),
            totalWinners: winners.length,
            totalLosers: losers.length,
            totalLostPoints: totalLostPoints,
            pointsPerWinner: winners.length > 0 ? Math.floor(totalLostPoints / winners.length) : 0
        });
    } catch (error) {
        console.error('예측 결과 처리 오류:', error);
        res.status(500).json({
            success: false,
            message: '예측 결과 처리 중 오류가 발생했습니다.'
        });
    }
});

// 동영상 광고 수익 현황 API
app.get('/api/video-ad-revenue', async (req, res) => {
    try {
        const { page = 1, limit = 20, dateRange = 'month', status = 'all', sortBy = 'date' } = req.query;
        
        if (!db) {
            return res.status(503).json({ 
                success: false,
                message: '데이터베이스 연결이 준비되지 않았습니다.' 
            });
        }
        
        const collection = db.collection('charging');
        
        // 날짜 범위 설정
        let dateFilter = {};
        const now = new Date();
        
        switch (dateRange) {
            case 'today':
                dateFilter = {
                    watchDate: {
                        $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
                        $lt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
                    }
                };
                break;
            case 'week':
                const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                dateFilter = { watchDate: { $gte: weekAgo } };
                break;
            case 'month':
                dateFilter = {
                    watchDate: {
                        $gte: new Date(now.getFullYear(), now.getMonth(), 1),
                        $lt: new Date(now.getFullYear(), now.getMonth() + 1, 1)
                    }
                };
                break;
            case 'quarter':
                const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
                dateFilter = {
                    watchDate: {
                        $gte: quarterStart,
                        $lt: new Date(quarterStart.getFullYear(), quarterStart.getMonth() + 3, 1)
                    }
                };
                break;
            case 'year':
                dateFilter = {
                    watchDate: {
                        $gte: new Date(now.getFullYear(), 0, 1),
                        $lt: new Date(now.getFullYear() + 1, 0, 1)
                    }
                };
                break;
        }
        
        // 상태 필터 설정
        let statusFilter = {};
        if (status === 'completed') {
            statusFilter = { completed: true };
        } else if (status === 'incomplete') {
            statusFilter = { completed: false };
        }
        
        // 정렬 설정
        let sortOptions = {};
        switch (sortBy) {
            case 'date':
                sortOptions = { watchDate: -1 };
                break;
            case 'points':
                sortOptions = { amount: -1 };
                break;
            case 'duration':
                sortOptions = { videoDuration: -1 };
                break;
            default:
                sortOptions = { watchDate: -1 };
        }
        
        // 기본 필터 (동영상 광고만)
        const baseFilter = { paymentMethod: 'video_ad' };
        
        // 전체 필터 조합
        const filter = {
            ...baseFilter,
            ...dateFilter,
            ...statusFilter
        };
        
        // 전체 레코드 수 계산
        const totalRecords = await collection.countDocuments(filter);
        
        // 페이지네이션 적용
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const records = await collection.find(filter)
            .sort(sortOptions)
            .skip(skip)
            .limit(parseInt(limit))
            .toArray();
        
        // 통계 계산
        const stats = await collection.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: null,
                    totalRecords: { $sum: 1 },
                    totalCompleted: { $sum: { $cond: ['$completed', 1, 0] } },
                    totalPointsEarned: { $sum: '$amount' },
                    avgWatchDuration: { $avg: '$videoDuration' },
                    uniqueMembers: { $addToSet: '$userId' }
                }
            }
        ]).toArray();
        
        const statsData = stats[0] || {
            totalRecords: 0,
            totalCompleted: 0,
            totalPointsEarned: 0,
            avgWatchDuration: 0,
            uniqueMembers: []
        };
        
        res.json({
            success: true,
            records: records,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalRecords / parseInt(limit)),
                totalRecords: totalRecords,
                hasNext: skip + records.length < totalRecords,
                hasPrev: parseInt(page) > 1
            },
            stats: {
                totalRecords: statsData.totalRecords,
                totalCompleted: statsData.totalCompleted,
                totalPointsEarned: statsData.totalPointsEarned,
                avgWatchDuration: Math.round(statsData.avgWatchDuration || 0),
                uniqueMembers: statsData.uniqueMembers.length
            }
        });
    } catch (error) {
        console.error('동영상 광고 수익 현황 조회 오류:', error);
        res.status(500).json({ 
            success: false,
            message: '동영상 광고 수익 현황을 불러오는데 실패했습니다.',
            error: error.message 
        });
    }
});

// 고객센터 페이지
app.get('/customer-center.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'customer-center.html'));
});

// 404 에러 핸들러
app.use((req, res, next) => {
    console.log(`404 에러: ${req.method} ${req.url}`);
    res.status(404).json({
        success: false,
        message: '요청한 리소스를 찾을 수 없습니다.',
        path: req.url,
        method: req.method
    });
});

// 전역 에러 핸들러
app.use((err, req, res, next) => {
    console.error('전역 에러 핸들러:', {
        message: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        timestamp: new Date().toISOString(),
        userAgent: req.get('User-Agent')
    });
    
    res.status(500).json({
        success: false,
        message: '서버 오류가 발생했습니다.',
        error: 'Internal Server Error',
        timestamp: new Date().toISOString()
    });
});

// 서버 시작
async function startServer() {
    try {
        console.log('[Server] 서버 시작 중...');
        
        // 프로덕션 환경에서 필수 환경변수 검증
        if (process.env.NODE_ENV === 'production') {
            if (!process.env.MONGODB_URI) {
                throw new Error('MONGODB_URI 환경변수가 설정되지 않았습니다.');
            }
            // SESSION_SECRET은 기본값이 있으므로 체크하지 않음
        }
        
        console.log('[Server] MongoDB 연결 시도...');
        await connectToMongoDB();
        console.log('[Server] MongoDB 연결 성공');
        
        // config/db.js의 connectDB 함수 호출
        console.log('[Server] 추가 데이터베이스 연결 시도...');
        const additionalDb = await connectDB();
        console.log('[Server] 추가 데이터베이스 연결 성공');
        
        // members 라우트는 이제 config/db.js의 getDb() 함수를 사용합니다
        console.log('[Server] Members 라우트 데이터베이스 설정 완료');
        
        // 배팅 라우트에 데이터베이스 설정
        app.locals.db = db;
        console.log('[Server] Betting 라우트에 데이터베이스 설정 완료');
        
        const port = process.env.PORT || 3000;
        app.listen(port, '0.0.0.0', () => {
            console.log(`[Server] 서버가 포트 ${port}에서 실행 중입니다.`);
            console.log(`[Server] 환경: ${process.env.NODE_ENV || 'production'}`);
            console.log(`[Server] 데이터베이스: ${process.env.DB_NAME || 'member-management'}`);
        });
    } catch (error) {
        console.error('[Server] 서버 시작 오류:', error);
        console.error('[Server] 오류 상세:', error.message);
        console.error('[Server] 스택 트레이스:', error.stack);
        process.exit(1);
    }
}

// 프로세스 종료 핸들러
process.on('SIGTERM', () => {
    console.log('[Server] SIGTERM 신호 수신, 서버 종료 중...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('[Server] SIGINT 신호 수신, 서버 종료 중...');
    process.exit(0);
});

process.on('uncaughtException', (error) => {
    console.error('[Server] 처리되지 않은 예외:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[Server] 처리되지 않은 Promise 거부:', reason);
    process.exit(1);
});

// 실시간 모니터링 API - 총 접속자 수
app.get('/api/monitoring/total-users', async (req, res) => {
    try {
        if (!db) {
            return res.status(503).json({ 
                success: false, 
                message: '데이터베이스 연결이 준비되지 않았습니다.' 
            });
        }
        
        const memberCollection = db.collection('game-member');
        const employeeCollection = db.collection('employee-member');
        
        // 현재 로그인된 회원 수
        const activeMembers = await memberCollection.countDocuments({ isLoggedIn: true });
        
        // 현재 로그인된 직원 수
        const activeEmployees = await employeeCollection.countDocuments({ isLoggedIn: true });
        
        // 총 접속자 수 (회원 + 직원)
        const totalActiveUsers = activeMembers + activeEmployees;
        
        res.json({
            success: true,
            data: {
                totalActiveUsers,
                activeMembers,
                activeEmployees,
                timestamp: new Date()
            }
        });
    } catch (error) {
        console.error('총 접속자 수 조회 오류:', error);
        res.status(500).json({
            success: false,
            message: '총 접속자 수 조회 중 오류가 발생했습니다.'
        });
    }
});

// 실시간 모니터링 API - 경기별 참여자 수
app.get('/api/monitoring/game-participants', async (req, res) => {
    try {
        const { date } = req.query;
        
        if (!db) {
            return res.status(503).json({ 
                success: false, 
                message: '데이터베이스 연결이 준비되지 않았습니다.' 
            });
        }
        
        const memberCollection = db.collection('game-member');
        const todayGamesCollection = db.collection('todaygames');
        
        // 오늘 날짜 (date 파라미터가 없으면 오늘 날짜 사용)
        const targetDate = date || new Date().toISOString().split('T')[0];
        
        // 오늘의 경기 목록 조회
        const todayGames = await todayGamesCollection.find({ 
            date: targetDate 
        }).toArray();
        
        // 각 경기별 참여자 수 계산
        const gameParticipants = [];
        
        for (const game of todayGames) {
            // 해당 경기에 배팅한 사용자 수
            const participants = await memberCollection.countDocuments({
                'bettingHistory': {
                    $elemMatch: {
                        date: targetDate,
                        gameNumber: game.gameNumber
                    }
                }
            });
            
            gameParticipants.push({
                gameNumber: game.gameNumber,
                homeTeam: game.homeTeam,
                awayTeam: game.awayTeam,
                startTime: game.startTime,
                endTime: game.endTime,
                participants: participants,
                status: game.status || 'scheduled'
            });
        }
        
        res.json({
            success: true,
            data: {
                date: targetDate,
                games: gameParticipants,
                totalParticipants: gameParticipants.reduce((sum, game) => sum + game.participants, 0),
                timestamp: new Date()
            }
        });
    } catch (error) {
        console.error('경기별 참여자 수 조회 오류:', error);
        res.status(500).json({
            success: false,
            message: '경기별 참여자 수 조회 중 오류가 발생했습니다.'
        });
    }
});

// 테스트용 배팅 데이터 생성 API
app.post('/api/test/create-betting-data', async (req, res) => {
    try {
        const { date } = req.body;
        
        if (!db) {
            return res.status(503).json({ 
                success: false, 
                message: '데이터베이스 연결이 준비되지 않았습니다.' 
            });
        }
        
        const memberCollection = db.collection('game-member');
        const targetDate = date || new Date().toISOString().split('T')[0];
        
        // 테스트용 배팅 데이터 생성
        const testBettingData = [
            {
                userId: 'user001',
                name: '김철수',
                bettingHistory: [
                    { date: targetDate, gameNumber: 1, prediction: '1루', points: 10000, gameType: '타자' },
                    { date: targetDate, gameNumber: 2, prediction: '홈런', points: 15000, gameType: '타자' },
                    { date: targetDate, gameNumber: 3, prediction: '2루', points: 8000, gameType: '타자' }
                ]
            },
            {
                userId: 'user002',
                name: '이영희',
                bettingHistory: [
                    { date: targetDate, gameNumber: 1, prediction: '2루', points: 12000, gameType: '타자' },
                    { date: targetDate, gameNumber: 2, prediction: '삼진', points: 5000, gameType: '타자' },
                    { date: targetDate, gameNumber: 3, prediction: '1루', points: 9000, gameType: '타자' }
                ]
            },
            {
                userId: 'user003',
                name: '박민수',
                bettingHistory: [
                    { date: targetDate, gameNumber: 1, prediction: '1루', points: 8000, gameType: '타자' },
                    { date: targetDate, gameNumber: 2, prediction: '홈런', points: 20000, gameType: '타자' },
                    { date: targetDate, gameNumber: 3, prediction: '3루', points: 11000, gameType: '타자' }
                ]
            },
            {
                userId: 'user004',
                name: '최지영',
                bettingHistory: [
                    { date: targetDate, gameNumber: 1, prediction: '아웃', points: 6000, gameType: '타자' },
                    { date: targetDate, gameNumber: 2, prediction: '1루', points: 10000, gameType: '타자' },
                    { date: targetDate, gameNumber: 3, prediction: '홈런', points: 18000, gameType: '타자' }
                ]
            },
            {
                userId: 'user005',
                name: '정수민',
                bettingHistory: [
                    { date: targetDate, gameNumber: 1, prediction: '3루', points: 14000, gameType: '타자' },
                    { date: targetDate, gameNumber: 2, prediction: '2루', points: 12000, gameType: '타자' },
                    { date: targetDate, gameNumber: 3, prediction: '아웃', points: 7000, gameType: '타자' }
                ]
            }
        ];
        
        // 기존 테스트 데이터 삭제
        await memberCollection.deleteMany({ userId: { $in: ['user001', 'user002', 'user003', 'user004', 'user005'] } });
        
        // 새 테스트 데이터 삽입
        const result = await memberCollection.insertMany(testBettingData);
        
        console.log(`테스트 배팅 데이터 생성 완료: ${result.insertedCount}개`);
        
        res.json({
            success: true,
            message: '테스트 배팅 데이터가 생성되었습니다.',
            insertedCount: result.insertedCount
        });
    } catch (error) {
        console.error('테스트 배팅 데이터 생성 오류:', error);
        res.status(500).json({
            success: false,
            message: '테스트 배팅 데이터 생성 중 오류가 발생했습니다.'
        });
    }
});

// 실시간 모니터링 API - 경기별 배팅선택자 수 및 배팅포인트 합계 (team-games 기반)
app.get('/api/monitoring/game-betting-stats', async (req, res) => {
    try {
        const { date } = req.query;
        
        if (!db) {
            return res.status(503).json({ 
                success: false, 
                message: '데이터베이스 연결이 준비되지 않았습니다.' 
            });
        }
        
        const memberCollection = db.collection('game-member');
        const teamGamesCollection = db.collection('team-games');
        
        // 오늘 날짜 (date 파라미터가 없으면 오늘 날짜 사용)
        const targetDate = date || new Date().toISOString().split('T')[0];
        
        // team-games에서 오늘의 경기 목록 조회
        const todayGames = await teamGamesCollection.find({ 
            date: targetDate 
        }).toArray();
        
        // 각 경기별 배팅 통계 계산
        const gameBettingStats = [];
        
        for (const game of todayGames) {
            // 해당 경기의 배팅 데이터 집계
            const bettingData = await memberCollection.aggregate([
                {
                    $match: {
                        'bettingHistory': {
                            $elemMatch: {
                                date: targetDate,
                                gameNumber: game.gameNumber
                            }
                        }
                    }
                },
                {
                    $unwind: '$bettingHistory'
                },
                {
                    $match: {
                        'bettingHistory.date': targetDate,
                        'bettingHistory.gameNumber': game.gameNumber
                    }
                },
                {
                    $group: {
                        _id: '$bettingHistory.prediction',
                        count: { $sum: 1 },
                        totalPoints: { $sum: '$bettingHistory.points' },
                        users: { $addToSet: '$userId' }
                    }
                }
            ]).toArray();
            
            // 배팅 선택별 통계 정리
            const bettingChoices = {};
            let totalBettors = 0;
            let totalPoints = 0;
            
            bettingData.forEach(choice => {
                bettingChoices[choice._id] = {
                    count: choice.count,
                    totalPoints: choice.totalPoints,
                    users: choice.users
                };
                totalBettors += choice.count;
                totalPoints += choice.totalPoints;
            });
            
            gameBettingStats.push({
                gameNumber: game.gameNumber,
                homeTeam: game.matchup ? game.matchup.split(' vs ')[0] : '-',
                awayTeam: game.matchup ? game.matchup.split(' vs ')[1] : '-',
                startTime: game.startTime,
                endTime: game.endTime,
                status: game.progressStatus || 'scheduled',
                totalBettors: totalBettors,
                totalPoints: totalPoints,
                bettingChoices: bettingChoices
            });
        }
        
        res.json({
            success: true,
            data: {
                date: targetDate,
                games: gameBettingStats,
                totalBettors: gameBettingStats.reduce((sum, game) => sum + game.totalBettors, 0),
                totalPoints: gameBettingStats.reduce((sum, game) => sum + game.totalPoints, 0),
                timestamp: new Date()
            }
        });
    } catch (error) {
        console.error('경기별 배팅 통계 조회 오류:', error);
        res.status(500).json({
            success: false,
            message: '경기별 배팅 통계 조회 중 오류가 발생했습니다.'
        });
    }
});

// 실시간 모니터링 API - 종합 통계
app.get('/api/monitoring/comprehensive', async (req, res) => {
    try {
        const { date } = req.query;
        
        if (!db) {
            return res.status(503).json({ 
                success: false, 
                message: '데이터베이스 연결이 준비되지 않았습니다.' 
            });
        }
        
        const memberCollection = db.collection('game-member');
        const employeeCollection = db.collection('employee-member');
        const todayGamesCollection = db.collection('todaygames');
        
        // 오늘 날짜
        const targetDate = date || new Date().toISOString().split('T')[0];
        
        // 1. 총 접속자 수 (디버깅 로그 추가)
        const activeMembers = await memberCollection.countDocuments({ isLoggedIn: true });
        const activeEmployees = await employeeCollection.countDocuments({ isLoggedIn: true });
        const totalActiveUsers = activeMembers + activeEmployees;
        
        // 디버깅: 실제 로그인된 사용자들 조회
        const loggedInMembers = await memberCollection.find({ isLoggedIn: true }, { userId: 1, name: 1, isLoggedIn: 1, lastLoginAt: 1 }).toArray();
        const loggedInEmployees = await employeeCollection.find({ isLoggedIn: true }, { username: 1, name: 1, isLoggedIn: 1, lastLoginAt: 1 }).toArray();
        
        console.log('=== 실시간 모니터링 디버깅 ===');
        console.log('로그인된 회원 수:', activeMembers);
        console.log('로그인된 직원 수:', activeEmployees);
        console.log('총 접속자 수:', totalActiveUsers);
        console.log('로그인된 회원 목록:', loggedInMembers);
        console.log('로그인된 직원 목록:', loggedInEmployees);
        console.log('=============================');
        
        // 2. 오늘의 경기 목록
        const todayGames = await todayGamesCollection.find({ 
            date: targetDate 
        }).toArray();
        
        // 3. 각 경기별 상세 통계
        const gameStats = [];
        
        for (const game of todayGames) {
            // 참여자 수
            const participants = await memberCollection.countDocuments({
                'bettingHistory': {
                    $elemMatch: {
                        date: targetDate,
                        gameNumber: game.gameNumber
                    }
                }
            });
            
            // 배팅 통계
            const bettingData = await memberCollection.aggregate([
                {
                    $match: {
                        'bettingHistory': {
                            $elemMatch: {
                                date: targetDate,
                                gameNumber: game.gameNumber
                            }
                        }
                    }
                },
                {
                    $unwind: '$bettingHistory'
                },
                {
                    $match: {
                        'bettingHistory.date': targetDate,
                        'bettingHistory.gameNumber': game.gameNumber
                    }
                },
                {
                    $group: {
                        _id: '$bettingHistory.prediction',
                        count: { $sum: 1 },
                        totalPoints: { $sum: '$bettingHistory.points' },
                        users: { $addToSet: '$userId' }
                    }
                }
            ]).toArray();
            
            // 배팅 선택별 통계 정리
            const bettingChoices = {};
            let totalBettors = 0;
            let totalPoints = 0;
            
            bettingData.forEach(choice => {
                bettingChoices[choice._id] = {
                    count: choice.count,
                    totalPoints: choice.totalPoints,
                    users: choice.users
                };
                totalBettors += choice.count;
                totalPoints += choice.totalPoints;
            });
            
            gameStats.push({
                gameNumber: game.gameNumber,
                homeTeam: game.homeTeam,
                awayTeam: game.awayTeam,
                startTime: game.startTime,
                endTime: game.endTime,
                status: game.status || 'scheduled',
                participants: participants,
                totalBettors: totalBettors,
                totalPoints: totalPoints,
                bettingChoices: bettingChoices,
                bettingResult: game.bettingResult || null,
                totalWinners: game.totalWinners || 0,
                totalLosers: game.totalLosers || 0,
                totalLostPoints: game.totalLostPoints || 0,
                pointsPerWinner: game.pointsPerWinner || 0
            });
        }
        
        // 4. 전체 통계
        const totalParticipants = gameStats.reduce((sum, game) => sum + game.participants, 0);
        const totalBettors = gameStats.reduce((sum, game) => sum + game.totalBettors, 0);
        const totalPoints = gameStats.reduce((sum, game) => sum + game.totalPoints, 0);
        
        res.json({
            success: true,
            data: {
                date: targetDate,
                summary: {
                    totalActiveUsers,
                    activeMembers,
                    activeEmployees,
                    totalParticipants,
                    totalBettors,
                    totalPoints
                },
                games: gameStats,
                debug: {
                    loggedInMembers: loggedInMembers,
                    loggedInEmployees: loggedInEmployees
                },
                timestamp: new Date()
            }
        });
    } catch (error) {
        console.error('종합 모니터링 통계 조회 오류:', error);
        res.status(500).json({
            success: false,
            message: '종합 모니터링 통계 조회 중 오류가 발생했습니다.'
        });
    }
});

// 실시간 모니터링 데이터 저장 API
app.post('/api/monitoring/save', async (req, res) => {
    try {
        const { date, gameNumber, monitoringData } = req.body;
        
        if (!date || !gameNumber || !monitoringData) {
            return res.status(400).json({ 
                success: false, 
                message: '필수 정보가 누락되었습니다.' 
            });
        }
        
        if (!db) {
            return res.status(503).json({ 
                success: false, 
                message: '데이터베이스 연결이 준비되지 않았습니다.' 
            });
        }
        
        const monitoringCollection = db.collection('realtime-monitoring');
        
        // 기존 모니터링 데이터 업데이트 또는 새로 생성
        const result = await monitoringCollection.updateOne(
            { 
                date: date,
                gameNumber: parseInt(gameNumber)
            },
            { 
                $set: {
                    ...monitoringData,
                    updatedAt: getKoreanTime()
                }
            },
            { upsert: true }
        );
        
        console.log(`모니터링 데이터 저장: ${date} ${gameNumber}경기`);
        
        res.json({
            success: true,
            message: '모니터링 데이터가 저장되었습니다.',
            result: result
        });
    } catch (error) {
        console.error('모니터링 데이터 저장 오류:', error);
        res.status(500).json({
            success: false,
            message: '모니터링 데이터 저장 중 오류가 발생했습니다.'
        });
    }
});

// 실시간 모니터링 데이터 조회 API
app.get('/api/monitoring/data', async (req, res) => {
    try {
        const { date, gameNumber } = req.query;
        
        if (!db) {
            return res.status(503).json({ 
                success: false, 
                message: '데이터베이스 연결이 준비되지 않았습니다.' 
            });
        }
        
        const monitoringCollection = db.collection('realtime-monitoring');
        
        let query = {};
        if (date) query.date = date;
        if (gameNumber) query.gameNumber = parseInt(gameNumber);
        
        const monitoringData = await monitoringCollection.find(query).toArray();
        
        res.json({
            success: true,
            data: monitoringData
        });
    } catch (error) {
        console.error('모니터링 데이터 조회 오류:', error);
        res.status(500).json({
            success: false,
            message: '모니터링 데이터 조회 중 오류가 발생했습니다.'
        });
    }
});

// 실시간 모니터링 데이터 삭제 API
app.delete('/api/monitoring/delete', async (req, res) => {
    try {
        const { date, gameNumber } = req.body;
        
        if (!db) {
            return res.status(503).json({ 
                success: false, 
                message: '데이터베이스 연결이 준비되지 않았습니다.' 
            });
        }
        
        const monitoringCollection = db.collection('realtime-monitoring');
        
        let query = {};
        if (date) query.date = date;
        if (gameNumber) query.gameNumber = parseInt(gameNumber);
        
        const result = await monitoringCollection.deleteMany(query);
        
        console.log(`모니터링 데이터 삭제: ${result.deletedCount}개 삭제됨`);
        
        res.json({
            success: true,
            message: '모니터링 데이터가 삭제되었습니다.',
            deletedCount: result.deletedCount
        });
    } catch (error) {
        console.error('모니터링 데이터 삭제 오류:', error);
        res.status(500).json({
            success: false,
            message: '모니터링 데이터 삭제 중 오류가 발생했습니다.'
        });
    }
});

// 로그인 상태 디버깅 API
app.get('/api/debug/login-status', async (req, res) => {
    try {
        if (!db) {
            return res.status(503).json({ 
                success: false, 
                message: '데이터베이스 연결이 준비되지 않았습니다.' 
            });
        }
        
        const memberCollection = db.collection('game-member');
        const employeeCollection = db.collection('employee-member');
        
        // 모든 회원의 로그인 상태 조회
        const allMembers = await memberCollection.find({}, { 
            userId: 1, 
            name: 1, 
            isLoggedIn: 1, 
            lastLoginAt: 1,
            lastLogoutAt: 1
        }).toArray();
        
        // 모든 직원의 로그인 상태 조회
        const allEmployees = await employeeCollection.find({}, { 
            username: 1, 
            name: 1, 
            isLoggedIn: 1, 
            lastLoginAt: 1,
            lastLogoutAt: 1
        }).toArray();
        
        // 로그인된 사용자들만 필터링
        const loggedInMembers = allMembers.filter(member => member.isLoggedIn === true);
        const loggedInEmployees = allEmployees.filter(employee => employee.isLoggedIn === true);
        
        console.log('=== 로그인 상태 디버깅 ===');
        console.log('전체 회원 수:', allMembers.length);
        console.log('전체 직원 수:', allEmployees.length);
        console.log('로그인된 회원 수:', loggedInMembers.length);
        console.log('로그인된 직원 수:', loggedInEmployees.length);
        console.log('로그인된 회원 목록:', loggedInMembers);
        console.log('로그인된 직원 목록:', loggedInEmployees);
        console.log('=============================');
        
        res.json({
            success: true,
            data: {
                totalMembers: allMembers.length,
                totalEmployees: allEmployees.length,
                loggedInMembers: loggedInMembers.length,
                loggedInEmployees: loggedInEmployees.length,
                totalActiveUsers: loggedInMembers.length + loggedInEmployees.length,
                allMembers: allMembers,
                allEmployees: allEmployees,
                loggedInMembersList: loggedInMembers,
                loggedInEmployeesList: loggedInEmployees
            }
        });
    } catch (error) {
        console.error('로그인 상태 디버깅 오류:', error);
        res.status(500).json({
            success: false,
            message: '로그인 상태 디버깅 중 오류가 발생했습니다.'
        });
    }
});

// MongoDB Atlas 콜렉션 구조 확인 및 생성 API
app.get('/api/system/check-collections', async (req, res) => {
    try {
        if (!db) {
            return res.status(503).json({ 
                success: false, 
                message: '데이터베이스 연결이 준비되지 않았습니다.' 
            });
        }
        
        console.log('=== MongoDB Atlas 콜렉션 구조 확인 ===');
        console.log('데이터베이스:', db.databaseName);
        
        // 현재 존재하는 콜렉션 목록 조회
        const collections = await db.listCollections().toArray();
        const collectionNames = collections.map(col => col.name);
        
        console.log('현재 존재하는 콜렉션:', collectionNames);
        
        // 필요한 콜렉션 목록
        const requiredCollections = [
            'employee-member',
            'game-member', 
            'todaygames',
            'dailygames',
            'daily-games',
            'game-charging',
            'charging',
            'notices',
            'game-progress',
            'game-invite',
            'customer-inquiries',
            'betting-sessions',
            'betting-predictions',
            'betting-results',
            'realtime-monitoring',
            'video-watch'
        ];
        
        // 누락된 콜렉션 확인
        const missingCollections = requiredCollections.filter(name => 
            !collectionNames.includes(name)
        );
        
        console.log('누락된 콜렉션:', missingCollections);
        
        res.json({
            success: true,
            database: db.databaseName,
            existingCollections: collectionNames,
            requiredCollections: requiredCollections,
            missingCollections: missingCollections,
            totalExisting: collectionNames.length,
            totalRequired: requiredCollections.length,
            totalMissing: missingCollections.length
        });
    } catch (error) {
        console.error('콜렉션 구조 확인 오류:', error);
        res.status(500).json({
            success: false,
            message: '콜렉션 구조 확인 중 오류가 발생했습니다.',
            error: error.message
        });
    }
});

// 누락된 콜렉션 생성 API
app.post('/api/system/create-missing-collections', async (req, res) => {
    try {
        if (!db) {
            return res.status(503).json({ 
                success: false, 
                message: '데이터베이스 연결이 준비되지 않았습니다.' 
            });
        }
        
        console.log('=== 누락된 콜렉션 생성 시작 ===');
        
        // 현재 존재하는 콜렉션 목록 조회
        const collections = await db.listCollections().toArray();
        const collectionNames = collections.map(col => col.name);
        
        // 필요한 콜렉션 목록
        const requiredCollections = [
            'employee-member',
            'game-member', 
            'todaygames',
            'dailygames',
            'daily-games',
            'game-charging',
            'charging',
            'notices',
            'game-progress',
            'game-invite',
            'customer-inquiries',
            'betting-sessions',
            'betting-predictions',
            'betting-results',
            'realtime-monitoring',
            'video-watch'
        ];
        
        // 누락된 콜렉션 확인
        const missingCollections = requiredCollections.filter(name => 
            !collectionNames.includes(name)
        );
        
        const createdCollections = [];
        const failedCollections = [];
        
        // 누락된 콜렉션들 생성
        for (const collectionName of missingCollections) {
            try {
                // 빈 문서를 삽입하여 콜렉션 생성
                const collection = db.collection(collectionName);
                await collection.insertOne({
                    _createdAt: new Date(),
                    _description: '시스템에 의해 자동 생성된 콜렉션'
                });
                
                // 생성된 문서 삭제 (초기화 문서이므로)
                await collection.deleteOne({
                    _createdAt: { $exists: true },
                    _description: '시스템에 의해 자동 생성된 콜렉션'
                });
                
                createdCollections.push(collectionName);
                console.log(`콜렉션 생성 완료: ${collectionName}`);
            } catch (error) {
                console.error(`콜렉션 생성 실패: ${collectionName}`, error);
                failedCollections.push({
                    name: collectionName,
                    error: error.message
                });
            }
        }
        
        console.log('=== 콜렉션 생성 결과 ===');
        console.log('생성된 콜렉션:', createdCollections);
        console.log('실패한 콜렉션:', failedCollections);
        
        res.json({
            success: true,
            message: '누락된 콜렉션 생성이 완료되었습니다.',
            createdCollections: createdCollections,
            failedCollections: failedCollections,
            totalCreated: createdCollections.length,
            totalFailed: failedCollections.length
        });
    } catch (error) {
        console.error('콜렉션 생성 오류:', error);
        res.status(500).json({
            success: false,
            message: '콜렉션 생성 중 오류가 발생했습니다.',
            error: error.message
        });
    }
});

// 콜렉션 데이터 초기화 API
app.post('/api/system/initialize-collections', async (req, res) => {
    try {
        if (!db) {
            return res.status(503).json({ 
                success: false, 
                message: '데이터베이스 연결이 준비되지 않았습니다.' 
            });
        }
        
        console.log('=== 콜렉션 데이터 초기화 시작 ===');
        
        const initializationResults = [];
        
        // employee-member 콜렉션 초기화
        try {
            const employeeCollection = db.collection('employee-member');
            const employeeCount = await employeeCollection.countDocuments();
            
            if (employeeCount === 0) {
                // 샘플 직원 데이터 생성
                const sampleEmployee = {
                    name: '관리자',
                    email: 'admin@example.com',
                    username: 'admin',
                    password: 'admin123',
                    position: '관리자',
                    department: 'IT',
                    phone: '010-0000-0000',
                    isLoggedIn: false,
                    loginCount: 0,
                    lastLoginAt: null,
                    lastLogoutAt: null,
                    createdAt: new Date(),
                    updatedAt: getKoreanTime()
                };
                
                await employeeCollection.insertOne(sampleEmployee);
                initializationResults.push({
                    collection: 'employee-member',
                    status: 'initialized',
                    message: '샘플 관리자 계정이 생성되었습니다.'
                });
            } else {
                initializationResults.push({
                    collection: 'employee-member',
                    status: 'exists',
                    message: `${employeeCount}개의 직원 데이터가 이미 존재합니다.`
                });
            }
        } catch (error) {
            initializationResults.push({
                collection: 'employee-member',
                status: 'error',
                error: error.message
            });
        }
        
        // notices 콜렉션 초기화
        try {
            const noticesCollection = db.collection('notices');
            const noticesCount = await noticesCollection.countDocuments();
            
            if (noticesCount === 0) {
                // 샘플 공지사항 생성
                const sampleNotice = {
                    title: '시스템 초기화 완료',
                    content: 'MongoDB Atlas 데이터베이스가 성공적으로 초기화되었습니다.',
                    author: '시스템',
                    isActive: true,
                    createdAt: new Date(),
                    updatedAt: getKoreanTime()
                };
                
                await noticesCollection.insertOne(sampleNotice);
                initializationResults.push({
                    collection: 'notices',
                    status: 'initialized',
                    message: '샘플 공지사항이 생성되었습니다.'
                });
            } else {
                initializationResults.push({
                    collection: 'notices',
                    status: 'exists',
                    message: `${noticesCount}개의 공지사항이 이미 존재합니다.`
                });
            }
        } catch (error) {
            initializationResults.push({
                collection: 'notices',
                status: 'error',
                error: error.message
            });
        }
        
        console.log('=== 콜렉션 초기화 결과 ===');
        console.log(initializationResults);
        
        res.json({
            success: true,
            message: '콜렉션 데이터 초기화가 완료되었습니다.',
            results: initializationResults
        });
    } catch (error) {
        console.error('콜렉션 초기화 오류:', error);
        res.status(500).json({
            success: false,
            message: '콜렉션 초기화 중 오류가 발생했습니다.',
            error: error.message
        });
    }
});

// 외부 게임 시스템에서 배팅 데이터 가져오기 API
app.get('/api/external/betting-data', async (req, res) => {
    try {
        const { date } = req.query;
        
        if (!db) {
            return res.status(503).json({ 
                success: false, 
                message: '데이터베이스 연결이 준비되지 않았습니다.' 
            });
        }
        
        const memberCollection = db.collection('game-member');
        const targetDate = date || new Date().toISOString().split('T')[0];
        
        // 외부 게임 시스템 API 호출 (실제 구현 시)
        // const externalResponse = await fetch(`http://external-game-system/api/betting-data?date=${targetDate}`);
        // const externalData = await externalResponse.json();
        
        // 임시로 테스트 데이터 반환
        const externalBettingData = [
            {
                userId: 'user001',
                name: '김철수',
                bettingHistory: [
                    { date: targetDate, gameNumber: 1, prediction: '1루', points: 10000, gameType: '타자' },
                    { date: targetDate, gameNumber: 2, prediction: '홈런', points: 15000, gameType: '타자' },
                    { date: targetDate, gameNumber: 3, prediction: '2루', points: 8000, gameType: '타자' }
                ]
            },
            {
                userId: 'user002',
                name: '이영희',
                bettingHistory: [
                    { date: targetDate, gameNumber: 1, prediction: '2루', points: 12000, gameType: '타자' },
                    { date: targetDate, gameNumber: 2, prediction: '삼진', points: 5000, gameType: '타자' },
                    { date: targetDate, gameNumber: 3, prediction: '1루', points: 9000, gameType: '타자' }
                ]
            },
            {
                userId: 'user003',
                name: '박민수',
                bettingHistory: [
                    { date: targetDate, gameNumber: 1, prediction: '1루', points: 8000, gameType: '타자' },
                    { date: targetDate, gameNumber: 2, prediction: '홈런', points: 20000, gameType: '타자' },
                    { date: targetDate, gameNumber: 3, prediction: '3루', points: 11000, gameType: '타자' }
                ]
            }
        ];
        
        // 기존 데이터 삭제 후 새 데이터 삽입
        await memberCollection.deleteMany({ 
            userId: { $in: externalBettingData.map(user => user.userId) } 
        });
        
        const result = await memberCollection.insertMany(externalBettingData);
        
        console.log(`외부 배팅 데이터 가져오기 완료: ${result.insertedCount}개 사용자`);
        
        res.json({
            success: true,
            message: '외부 배팅 데이터를 가져왔습니다.',
            importedCount: result.insertedCount,
            data: externalBettingData
        });
    } catch (error) {
        console.error('외부 배팅 데이터 가져오기 오류:', error);
        res.status(500).json({
            success: false,
            message: '외부 배팅 데이터 가져오기 중 오류가 발생했습니다.'
        });
    }
});

startServer(); 