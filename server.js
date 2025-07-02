const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');
const session = require('express-session');
const { connectDB } = require('./config/db');

// 환경 변수 설정
dotenv.config();

// 환경변수 기본값 설정 (개발 환경에서만)
if (process.env.NODE_ENV !== 'production') {
    if (!process.env.MONGODB_URI) {
        process.env.MONGODB_URI = 'mongodb+srv://ppadun_user:ppadun8267@member-management.bppicvz.mongodb.net/member-management?retryWrites=true&w=majority&appName=member-management';
    }
    if (!process.env.DB_NAME) {
        process.env.DB_NAME = 'member-management';
    }
    if (!process.env.SESSION_SECRET) {
        process.env.SESSION_SECRET = 'ppadun9-secret-key-2024';
    }
}

// Render 배포 환경 최적화
if (process.env.NODE_ENV === 'production') {
    // Production 환경에서는 환경변수가 Render에서 설정됨
    console.log('[Config] Production 환경 감지');
} else {
    console.log('[Config] 개발 환경 감지');
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
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || 'member-management';
const COLLECTION_NAME = 'employee-member';
const TODAYGAMES_COLLECTION = 'todaygames';

let db;

// MongoDB 연결
async function connectToMongoDB() {
    try {
        console.log('MongoDB 연결 시도:', MONGODB_URI);
        const client = new MongoClient(MONGODB_URI, {
            serverSelectionTimeoutMS: 60000,
            socketTimeoutMS: 45000,
            connectTimeoutMS: 60000,
            maxPoolSize: 10,
            minPoolSize: 1,
            maxIdleTimeMS: 30000,
            retryWrites: true,
            w: 'majority'
        });
        await client.connect();
        db = client.db(DB_NAME);
        console.log(`MongoDB에 성공적으로 연결되었습니다. (DB: ${DB_NAME})`);
        
        // members 라우트에 데이터베이스 전달
        setMembersDatabase(db);
    } catch (error) {
        console.error('MongoDB 연결 오류:', error);
        throw error;
    }
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

// 세션 설정
const sessionConfig = {
    secret: process.env.SESSION_SECRET || 'ppadun9-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production', // Render에서는 HTTPS 사용
        maxAge: 24 * 60 * 60 * 1000, // 24시간
        httpOnly: true,
        sameSite: 'lax' // strict에서 lax로 변경하여 400 오류 방지
    }
};

// 개발 환경에서만 MemoryStore 사용
if (process.env.NODE_ENV !== 'production') {
    sessionConfig.store = new session.MemoryStore();
}

app.use(session(sessionConfig));

// API 라우트 설정
const gameRoutes = require('./routes/game');
const dailygamesRoutes = require('./routes/dailygames');
const { router: membersRoutes, setDatabase: setMembersDatabase } = require('./routes/members');
const noticesRoutes = require('./routes/notices');
const gameProgressRoutes = require('./routes/game-progress');
const pointChargingRoutes = require('./routes/point-charging');
const friendInviteRoutes = require('./routes/friend-invite');
const customerInquiriesRoutes = require('./routes/customer-inquiries');

// 정적 파일 제공
app.use(express.static(path.join(__dirname, 'public')));

// API 라우트 사용 (순서 중요!)
app.use('/api/game', gameRoutes);
app.use('/api/dailygames', dailygamesRoutes);
app.use('/api/notices', noticesRoutes);
app.use('/api/game-progress', gameProgressRoutes);
app.use('/api/point-charging', pointChargingRoutes);
app.use('/api/friend-invite', friendInviteRoutes);
app.use('/api/customer-inquiries', customerInquiriesRoutes);

// members 라우트는 /api/members로 접근하도록 변경
app.use('/api/members', membersRoutes);

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

// 회원 관리 페이지 (새로운)
app.get('/member-management.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'member-management.html'));
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
            createdAt: new Date(),
            updatedAt: new Date()
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

// 로그인 통계 조회 API (실시간 세션 기반 온라인 사용자 추적)
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
        
        // 실시간 온라인 사용자 목록 (세션 기반)
        let onlineUsersList = [];
        
        // 현재 활성 세션에서 로그인한 사용자들 수집
        if (req.session && req.session.user) {
            console.log('현재 세션 사용자:', req.session.user);
            
            // 현재 세션 사용자를 온라인 목록에 추가
            const currentUser = await collection.findOne(
                { username: req.session.user.username },
                { username: 1, name: 1, lastLoginAt: 1, loginCount: 1 }
            );
            
            if (currentUser) {
                onlineUsersList.push({
                    ...currentUser,
                    lastLoginAt: new Date(), // 현재 시간으로 설정
                    isCurrentSession: true
                });
            }
        }
        
        // 추가로 lastLoginAt 필드가 있는 직원들도 포함 (24시간 이내)
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recentLoginUsers = await collection.find(
            { 
                lastLoginAt: { 
                    $exists: true, 
                    $gte: oneDayAgo 
                },
                username: { $ne: req.session?.user?.username } // 현재 세션 사용자 제외
            },
            { 
                username: 1, 
                name: 1, 
                lastLoginAt: 1,
                loginCount: 1
            }
        ).sort({ lastLoginAt: -1 }).toArray();
        
        // 중복 제거하면서 합치기
        const existingUsernames = new Set(onlineUsersList.map(u => u.username));
        recentLoginUsers.forEach(user => {
            if (!existingUsernames.has(user.username)) {
                onlineUsersList.push(user);
                existingUsernames.add(user.username);
            }
        });
        
        const onlineUsers = onlineUsersList.length;
        console.log('실시간 온라인 직원 수:', onlineUsers);
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
        
        // 오류 응답 (400 대신 500 사용)
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
        updateData.updatedAt = new Date();
        
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
        
        // 로그인 카운트 증가
        const newLoginCount = (employee.loginCount || 0) + 1;
        const lastLoginAt = new Date();
        
        // 데이터베이스에 로그인 카운트와 마지막 로그인 시간 업데이트
        await collection.updateOne(
            { username },
            { 
                $set: { 
                    loginCount: newLoginCount,
                    lastLoginAt: lastLoginAt
                } 
            }
        );
        
        // 로그인 성공 - 비밀번호는 제외하고 사용자 정보 반환
        const { password: _, ...userInfo } = employee;
        const updatedUserInfo = {
            ...userInfo,
            loginCount: newLoginCount,
            lastLoginAt: lastLoginAt
        };
        
        console.log('로그인 성공, 세션에 저장할 사용자 정보:', updatedUserInfo);
        
        // 세션에 사용자 정보 저장
        req.session.user = updatedUserInfo;
        console.log('세션 저장 완료:', req.session.user);
        
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

// 현재 로그인한 사용자 정보 가져오기 API (무료 플랜 최적화)
app.get('/api/employee/current-user', (req, res) => {
    try {
        console.log('=== 현재 사용자 정보 요청 ===');
        
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
app.post('/api/employee/logout', (req, res) => {
    try {
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

// 현재 로그인된 사용자 수 조회 API
app.get('/api/employee/online-users', async (req, res) => {
    try {
        if (!db) {
            console.error('MongoDB 연결이 설정되지 않았습니다.');
            return res.status(503).json({ error: '데이터베이스 연결이 준비되지 않았습니다.' });
        }

        const collection = db.collection(COLLECTION_NAME);
        
        // 현재 시간에서 30분 이내에 로그인한 사용자들을 온라인으로 간주
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
        
        const onlineUsers = await collection.find(
            { lastLoginAt: { $gte: thirtyMinutesAgo } },
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
                    updatedAt: new Date()
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

// 고객센터 페이지
app.get('/customer-center.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'customer-center.html'));
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
        await connectDB();
        console.log('[Server] 추가 데이터베이스 연결 성공');
        
        const port = process.env.PORT || 3000;
        app.listen(port, '0.0.0.0', () => {
            console.log(`[Server] 서버가 포트 ${port}에서 실행 중입니다.`);
            console.log(`[Server] 환경: ${process.env.NODE_ENV || 'development'}`);
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

startServer(); 