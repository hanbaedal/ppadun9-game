const { MongoClient } = require('mongodb');

// MongoDB 연결 설정
const MONGODB_URI = 'mongodb+srv://ppadun_user:ppadun8267@member-management.bppicvz.mongodb.net/member-management?retryWrites=true&w=majority&appName=member-management';

async function testInviteCollection() {
    let client;
    try {
        console.log('MongoDB 연결 시도...');
        client = new MongoClient(MONGODB_URI, {
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
        const db = client.db('member-management');
        console.log('MongoDB 연결 성공!');
        
        // 모든 컬렉션 목록 확인
        console.log('\n=== 데이터베이스의 모든 컬렉션 목록 ===');
        const collections = await db.listCollections().toArray();
        collections.forEach(collection => {
            console.log(`- ${collection.name}`);
        });
        
        // game-invite 컬렉션 확인
        console.log('\n=== game-invite 컬렉션 확인 ===');
        const inviteCollection = db.collection('game-invite');
        const inviteCount = await inviteCollection.countDocuments();
        console.log(`game-invite 컬렉션 문서 수: ${inviteCount}`);
        
        if (inviteCount > 0) {
            console.log('\n=== game-invite 컬렉션의 첫 번째 문서 ===');
            const firstDoc = await inviteCollection.findOne();
            console.log(JSON.stringify(firstDoc, null, 2));
            
            console.log('\n=== game-invite 컬렉션의 모든 문서 ===');
            const allDocs = await inviteCollection.find({}).toArray();
            allDocs.forEach((doc, index) => {
                console.log(`문서 ${index + 1}:`, {
                    _id: doc._id,
                    phoneNumber: doc.phoneNumber,
                    inviteDate: doc.inviteDate,
                    status: doc.status
                });
            });
        } else {
            console.log('game-invite 컬렉션에 데이터가 없습니다.');
            
            // 다른 관련 컬렉션들도 확인
            console.log('\n=== 다른 관련 컬렉션들 확인 ===');
            const relatedCollections = ['game-member', 'game-progress', 'game-charging'];
            
            for (const collectionName of relatedCollections) {
                try {
                    const collection = db.collection(collectionName);
                    const count = await collection.countDocuments();
                    console.log(`${collectionName} 컬렉션 문서 수: ${count}`);
                    
                    if (count > 0) {
                        const firstDoc = await collection.findOne();
                        console.log(`  첫 번째 문서 샘플:`, {
                            _id: firstDoc._id,
                            ...Object.keys(firstDoc).filter(key => key !== '_id').reduce((obj, key) => {
                                obj[key] = firstDoc[key];
                                return obj;
                            }, {})
                        });
                    }
                } catch (error) {
                    console.log(`${collectionName} 컬렉션 접근 오류:`, error.message);
                }
            }
        }
        
    } catch (error) {
        console.error('오류 발생:', error);
    } finally {
        if (client) {
            await client.close();
            console.log('\nMongoDB 연결 종료');
        }
    }
}

testInviteCollection(); 