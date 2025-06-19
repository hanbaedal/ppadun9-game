const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
    try {
        // 환경 변수에서 MongoDB URI를 가져오거나 기본값 사용
        const mongoURI = process.env.MONGODB_URI || 'mongodb+srv://ppadun_uesr:ppadun8267@cluster0.8jqgq.mongodb.net/ppadun9?retryWrites=true&w=majority';
        
        const conn = await mongoose.connect(mongoURI, {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`MongoDB 연결 오류: ${error.message}`);
        console.error('연결 문자열:', process.env.MONGODB_URI ? '환경변수에서 로드됨' : '기본값 사용');
        process.exit(1);
    }
};

module.exports = connectDB; 