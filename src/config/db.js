const { MongoClient } = require('mongodb');
require('dotenv').config();

let client;
let db;

const connectDB = async () => {
    try {
        if (!client || !client.topology || !client.topology.isConnected()) {
            const MONGODB_URI = process.env.MONGODB_URI;
            const DB_NAME = process.env.DB_NAME || 'member-management';
            
            console.log('[DB] MongoDB 연결 시도...');
            console.log('[DB] 데이터베이스 이름:', DB_NAME);
            
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
            db = client.db(DB_NAME);
            
            console.log(`[DB] MongoDB Atlas 연결 성공`);
            console.log(`[DB] 데이터베이스: ${db.databaseName}`);
            console.log(`[DB] 호스트: ${client.topology.s.options.hosts[0].host}`);
            
            // 연결 후 컬렉션 목록 확인
            const collections = await db.listCollections().toArray();
            console.log(`[DB] 기존 컬렉션: ${collections.map(c => c.name).join(', ')}`);
        }
        return db;
    } catch (error) {
        console.error(`[DB] 연결 오류: ${error.message}`);
        process.exit(1);
    }
};

const getDb = () => {
    if (!db) {
        throw new Error('Database not connected. Call connectDB() first.');
    }
    return db;
};

module.exports = { connectDB, getDb }; 