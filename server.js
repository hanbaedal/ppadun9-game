const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const connectDB = require('./config/database');
const { MongoClient } = require('mongodb');
const { ObjectId } = require('mongodb');

// 환경 변수 설정
dotenv.config();

// 환경 변수 검증 (개발 환경에서만)
if (process.env.NODE_ENV === 'production' && !process.env.MONGODB_URI) {
    console.error('[Config] Production 환경에서 MONGODB_URI가 설정되지 않았습니다.');
    process.exit(1);
}

console.log('[Config] 환경변수 확인:');
console.log('- NODE_ENV:', process.env.NODE_ENV);
console.log('- MONGODB_URI:', process.env.MONGODB_URI ? '설정됨' : '설정되지 않음');
console.log('- DB_NAME:', process.env.DB_NAME || '기본값 사용');

const app = express();

// 데이터베이스 연결
connectDB();

// MongoDB 연결 설정
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'member-management';
const COLLECTION_NAME = 'employee-member';

let db;

// MongoDB 연결
async function connectToMongoDB() {
    try {
        console.log('MongoDB 연결 시도:', MONGODB_URI);
        const client = new MongoClient(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
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

// API 라우트 설정
app.use('/api', require('./routes/game'));

// 정적 파일 제공
app.use(express.static(path.join(__dirname, 'public')));

// 정적 파일 제공
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

// 404 에러 처리
app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
        res.status(404).json({ 
            success: false, 
            msg: 'API 엔드포인트를 찾을 수 없습니다.',
            path: req.path
        });
    } else {
        // 실제 파일이 존재하는지 확인
        const filePath = path.join(__dirname, 'public', req.path);
        const indexPath = path.join(__dirname, 'public', 'index.html');
        
        // 파일이 존재하면 해당 파일 제공
        if (require('fs').existsSync(filePath) && require('fs').statSync(filePath).isFile()) {
            res.sendFile(filePath);
        } else {
            // 파일이 존재하지 않으면 index.html 제공 (SPA 라우팅)
            res.sendFile(indexPath);
        }
    }
});

// 에러 핸들러
app.use((err, req, res, next) => {
    console.error('서버 에러 발생:', err);
    res.status(500).json({ 
        success: false, 
        msg: '서버 오류가 발생했습니다.',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

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

// MongoDB 연결 상태 모니터링
mongoose.connection.on('error', err => {
    console.error('MongoDB 연결 오류:', err);
});

mongoose.connection.on('disconnected', () => {
    console.log('MongoDB 연결이 끊어졌습니다.');
}); 