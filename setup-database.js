const { MongoClient, ObjectId } = require('mongodb');

// MongoDB 연결 설정
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://ppadun_user:ppadun8267@member-management.bppicvz.mongodb.net/member-management?retryWrites=true&w=majority&appName=member-management';
const DB_NAME = process.env.DB_NAME || 'member-management';
const COLLECTION_NAME = 'employee-member';

async function setupDatabase() {
    let client;
    try {
        console.log('MongoDB 연결 중...');
        client = new MongoClient(MONGODB_URI, {
            serverSelectionTimeoutMS: 60000,
            socketTimeoutMS: 45000,
            connectTimeoutMS: 60000
        });
        await client.connect();
        
        const db = client.db(DB_NAME);
        const collection = db.collection(COLLECTION_NAME);
        
        console.log('데이터베이스 연결 성공');
        
        // 1. 기존 직원 데이터에 로그인 통계 필드 추가
        console.log('기존 직원 데이터 업데이트 중...');
        const updateResult = await collection.updateMany(
            { 
                $or: [
                    { loginCount: { $exists: false } },
                    { lastLoginAt: { $exists: false } },
                    { createdAt: { $exists: false } }
                ]
            },
            {
                $set: {
                    loginCount: 0,
                    lastLoginAt: null,
                    createdAt: new Date()
                }
            }
        );
        
        console.log(`업데이트된 문서 수: ${updateResult.modifiedCount}`);
        
        // 2. 컬렉션 인덱스 생성 (성능 최적화)
        console.log('인덱스 생성 중...');
        
        // username으로 빠른 검색을 위한 인덱스
        await collection.createIndex({ username: 1 }, { unique: true });
        console.log('username 인덱스 생성 완료');
        
        // 로그인 횟수로 정렬을 위한 인덱스
        await collection.createIndex({ loginCount: -1 });
        console.log('loginCount 인덱스 생성 완료');
        
        // 마지막 로그인 시간으로 정렬을 위한 인덱스
        await collection.createIndex({ lastLoginAt: -1 });
        console.log('lastLoginAt 인덱스 생성 완료');
        
        // 3. 샘플 데이터 확인
        console.log('샘플 데이터 확인 중...');
        const sampleData = await collection.find({}).limit(3).toArray();
        console.log('샘플 데이터:', sampleData.map(doc => ({
            username: doc.username,
            name: doc.name,
            loginCount: doc.loginCount,
            lastLoginAt: doc.lastLoginAt,
            createdAt: doc.createdAt
        })));
        
        // 4. 통계 정보 출력
        const totalEmployees = await collection.countDocuments();
        const totalLogins = await collection.aggregate([
            { $group: { _id: null, total: { $sum: { $ifNull: ['$loginCount', 0] } } } }
        ]).toArray();
        
        console.log('\n=== 데이터베이스 설정 완료 ===');
        console.log(`전체 직원 수: ${totalEmployees}`);
        console.log(`총 로그인 횟수: ${totalLogins[0]?.total || 0}`);
        console.log('로그인 통계 필드가 모든 직원 데이터에 추가되었습니다.');
        
    } catch (error) {
        console.error('데이터베이스 설정 오류:', error);
        throw error;
    } finally {
        if (client) {
            await client.close();
            console.log('MongoDB 연결 종료');
        }
    }
}

// 스크립트 실행
if (require.main === module) {
    setupDatabase()
        .then(() => {
            console.log('데이터베이스 설정이 완료되었습니다.');
            process.exit(0);
        })
        .catch((error) => {
            console.error('데이터베이스 설정 실패:', error);
            process.exit(1);
        });
}

module.exports = { setupDatabase }; 