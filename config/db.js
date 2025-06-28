const { MongoClient } = require('mongodb');
require('dotenv').config();

let client;
let db;

const connectDB = async () => {
    try {
        if (!client || !client.topology || !client.topology.isConnected()) {
            const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://ppadun_user:ppadun8267@member-management.bppicvz.mongodb.net/member-management?retryWrites=true&w=majority&appName=member-management';
            const DB_NAME = 'member-management';
            
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
            console.log(`MongoDB Atlas Connected: ${client.topology.s.options.hosts[0].host}`);
        }
        return db;
    } catch (error) {
        console.error(`Error: ${error.message}`);
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