const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');
const session = require('express-session');

// 환경 변수 설정
dotenv.config();

// Render 배포 환경 최적화
if (process.env.NODE_ENV === 'production') {
    // Production 환경에서는 환경변수가 Render에서 설정됨
    console.log('[Config] Production 환경 감지');
} else {
    // 개발 환경용 기본값 설정
    if (!process.env.MONGODB_URI || process.env.MONGODB_URI.trim() === '') {
        process.env.MONGODB_URI = 'mongodb+srv://ppadun_user:ppadun8267@member-management.bppicvz.mongodb.net/member-management?retryWrites=true&w=majority&appName=member-management';
    }
    if (!process.env.DB_NAME || process.env.DB_NAME.trim() === '') {
        process.env.DB_NAME = 'member-management';
    }
    if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.trim() === '') {
        process.env.SESSION_SECRET = 'ppadun9-secret-key-2024';
    }
}

// 환경 변수 검증
if (process.env.NODE_ENV === 'production' && !process.env.MONGODB_URI) {
    console.error('[Config] Production 환경에서 MONGODB_URI가 설정되지 않았습니다.');
    process.exit(1);
}

console.log('[Config] 환경변수 확인:');
console.log('- NODE_ENV:', process.env.NODE_ENV);
console.log('- MONGODB_URI:', process.env.MONGODB_URI ? '설정됨' : '설정되지 않음');
console.log('- DB_NAME:', process.env.DB_NAME || '기본값 사용');

const app = express();

// MongoDB 연결 설정
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://ppadun_user:ppadun8267@member-management.bppicvz.mongodb.net/member-management?retryWrites=true&w=majority&appName=member-management';
const DB_NAME = process.env.DB_NAME || 'member-management';
const COLLECTION_NAME = 'employee-member';
const DAILYGAMES_COLLECTION = 'dailygames';

let db;

// MongoDB 연결
async function connectToMongoDB() {
    try {
        console.log('MongoDB 연결 시도:', MONGODB_URI);
        const client = new MongoClient(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000,
            connectTimeoutMS: 10000,
        });
        await client.connect();
        db = client.db(DB_NAME);
        console.log(`MongoDB에 성공적으로 연결되었습니다. (DB: ${DB_NAME})`);
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
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 세션 설정
app.use(session({
    secret: process.env.SESSION_SECRET || 'ppadun9-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24시간
    }
}));

// API 라우트 설정
app.use('/api', require('./routes/game'));

// 정적 파일 제공
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

// 오늘의 경기 등록 페이지 (관리 부서만 접근 가능)
app.get('/today-game.html', checkDepartmentPermission('관리'), (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'today-game.html'));
});

// 게임 설정 페이지 (운영 부서만 접근 가능)
app.get('/team-game.html', checkDepartmentPermission('운영'), (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'team-game.html'));
});

// 오늘의 경기 시작 페이지 (관리 부서만 접근 가능)
app.get('/today-game-start.html', checkDepartmentPermission('관리'), (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'today-game-start.html'));
});

// 오늘의 경기 종료 페이지 (관리 부서만 접근 가능)
app.get('/today-game-end.html', checkDepartmentPermission('관리'), (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'today-game-end.html'));
});

// 오늘의 경기 상황 페이지 (관리 부서만 접근 가능)
app.get('/today-game-status.html', checkDepartmentPermission('관리'), (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'today-game-status.html'));
});

// 오늘의 경기 확인 페이지 (관리 부서만 접근 가능)
app.get('/today-game-display.html', checkDepartmentPermission('관리'), (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'today-game-display.html'));
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

// 직원 상세 조회 API
app.get('/api/employee/:id', async (req, res) => {
    try {
        if (!db) {
            console.error('MongoDB 연결이 설정되지 않았습니다.');
            return res.status(503).json({ error: '데이터베이스 연결이 준비되지 않았습니다.' });
        }

        const { id } = req.params;
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
        
        // 필수 필드 검증
        if (!username || !password) {
            return res.status(400).json({ error: '아이디와 비밀번호를 모두 입력해주세요.' });
        }

        const collection = db.collection(COLLECTION_NAME);
        
        // 사용자 검색
        const employee = await collection.findOne({ username });
        
        if (!employee) {
            return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
        }
        
        // 비밀번호 확인 (실제로는 해시화된 비밀번호와 비교해야 함)
        if (employee.password !== password) {
            return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
        }
        
        // 로그인 성공 - 비밀번호는 제외하고 사용자 정보 반환
        const { password: _, ...userInfo } = employee;
        
        // 세션에 사용자 정보 저장
        req.session.user = userInfo;
        
        res.json({ 
            success: true, 
            message: '로그인이 성공했습니다.',
            user: userInfo
        });
    } catch (error) {
        console.error('직원 로그인 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
});

// 현재 로그인한 사용자 정보 가져오기 API
app.get('/api/employee/current-user', (req, res) => {
    try {
        if (req.session.user) {
            res.json({ 
                success: true, 
                user: req.session.user 
            });
        } else {
            res.json({ 
                success: false, 
                message: '로그인되지 않았습니다.' 
            });
        }
    } catch (error) {
        console.error('사용자 정보 조회 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
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
            res.json({ success: true, message: '로그아웃되었습니다.' });
        });
    } catch (error) {
        console.error('로그아웃 오류:', error);
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

// 권한 체크 미들웨어
function checkDepartmentPermission(requiredDepartment) {
    return (req, res, next) => {
        if (!req.session.user) {
            return res.redirect('/employee-login.html');
        }
        
        if (req.session.user.department !== requiredDepartment) {
            return res.status(403).send(`
                <html>
                <head>
                    <title>접근 권한 없음</title>
                    <style>
                        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                        .error { color: red; }
                    </style>
                </head>
                <body>
                    <h1 class="error">접근 권한이 없습니다</h1>
                    <p>${requiredDepartment} 부서만 접근할 수 있습니다.</p>
                    <p>현재 부서: ${req.session.user.department}</p>
                    <a href="/">메인 페이지로 돌아가기</a>
                </body>
                </html>
            `);
        }
        
        next();
    };
}

// 서버 시작
async function startServer() {
    try {
        await connectToMongoDB();
        app.listen(process.env.PORT || 3000, '0.0.0.0', () => {
            console.log(`서버가 포트 ${process.env.PORT || 3000}에서 실행 중입니다.`);
        });
    } catch (error) {
        console.error('서버 시작 오류:', error);
        process.exit(1);
    }
}

startServer(); 