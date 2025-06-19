const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const cors = require('cors');
const gameProgressRouter = require('./routes/game-progress');

const app = express();

// 미들웨어 설정
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// MongoDB 연결
const mongoURI = process.env.MONGODB_URI || 'mongodb+srv://haesoo:haesoo@cluster0.8jqgq.mongodb.net/ppadun9?retryWrites=true&w=majority';

mongoose.connect(mongoURI)
.then(() => console.log('MongoDB 연결 성공'))
.catch(err => console.error('MongoDB 연결 실패:', err));

// 라우터 설정
app.use('/api/game-progress', gameProgressRouter);

// 서버 시작
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
}); 