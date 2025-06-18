const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
    try {
        const conn = await mongoose.connect('mongodb+srv://ppadun_uesr:ppadun8267@member-management.mongodb.net/member-management?retryWrites=true&w=majority', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`MongoDB 연결 오류: ${error.message}`);
        console.error('연결 문자열:', 'mongodb+srv://ppadun_uesr:****@member-management.mongodb.net/member-management?retryWrites=true&w=majority');
        process.exit(1);
    }
};

module.exports = connectDB; 