const { MongoClient } = require('mongodb');
require('dotenv').config();

async function testDatabase() {
    try {
        console.log('=== 데이터베이스 연결 테스트 ===');
        console.log('MONGODB_URI:', process.env.MONGODB_URI ? '설정됨' : '설정되지 않음');
        console.log('DB_NAME:', process.env.DB_NAME);
        
        const client = new MongoClient(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000,
            connectTimeoutMS: 10000
        });
        
        await client.connect();
        console.log('✅ MongoDB 연결 성공');
        
        const db = client.db(process.env.DB_NAME);
        console.log('✅ 데이터베이스 접근 성공:', db.databaseName);
        
        // 컬렉션 목록 확인
        const collections = await db.listCollections().toArray();
        console.log('📋 기존 컬렉션:', collections.map(c => c.name));
        
        // team-games 컬렉션 확인
        const teamGamesCollection = db.collection('team-games');
        
        // 오늘 날짜로 테스트 데이터 생성
        const today = new Date().toISOString().split('T')[0];
        console.log('📅 테스트 날짜:', today);
        
        // 기존 데이터 확인
        const existingData = await teamGamesCollection.find({ date: today }).toArray();
        console.log('📊 기존 데이터 수:', existingData.length);
        
        if (existingData.length > 0) {
            console.log('📋 첫 번째 데이터:', existingData[0]);
        }
        
        // 테스트 데이터 삽입
        const testData = {
            date: today,
            gameNumber: 1,
            matchup: '테스트팀 vs 테스트팀',
            startTime: '18:00',
            endTime: '21:00',
            gameStatus: '정상게임',
            progressStatus: '경기전',
            gameType: '타자',
            bettingStart: '대기',
            bettingStop: '대기',
            predictionResult: '2루', // 한글로 저장
            isSelected: false,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        
        console.log('➕ 테스트 데이터 삽입 시도...');
        const insertResult = await teamGamesCollection.insertOne(testData);
        console.log('✅ 테스트 데이터 삽입 성공:', insertResult.insertedId);
        
        // 삽입된 데이터 확인
        const insertedData = await teamGamesCollection.findOne({ _id: insertResult.insertedId });
        console.log('📋 삽입된 데이터:', insertedData);
        
        // 테스트 데이터 삭제
        await teamGamesCollection.deleteOne({ _id: insertResult.insertedId });
        console.log('🗑️ 테스트 데이터 삭제 완료');
        
        await client.close();
        console.log('✅ 데이터베이스 연결 종료');
        
    } catch (error) {
        console.error('❌ 오류 발생:', error.message);
        console.error('상세 오류:', error);
    }
}

testDatabase(); 