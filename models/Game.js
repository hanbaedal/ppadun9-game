const mongoose = require('mongoose');

const gameSchema = new mongoose.Schema({
    number: {
        type: Number,
        required: true,
        enum: [1, 2, 3, 4, 5]
    },
    homeTeam: {
        type: String,
        enum: ['두산 베어스', 'LG 트윈스', 'SSG 랜더스', '키움 히어로즈', 'KT 위즈', 
               'KIA 타이거즈', 'NC 다이노스', '롯데 자이언츠', '삼성 라이온즈', '한화 이글스'],
        default: null
    },
    awayTeam: {
        type: String,
        enum: ['두산 베어스', 'LG 트윈스', 'SSG 랜더스', '키움 히어로즈', 'KT 위즈', 
               'KIA 타이거즈', 'NC 다이노스', '롯데 자이언츠', '삼성 라이온즈', '한화 이글스'],
        default: null
    },
    stadium: {
        type: String,
        default: null
    },
    startTime: {
        type: String,
        default: null
    },
    endTime: {
        type: String,
        default: null
    },
    noGame: {
        type: String,
        enum: ['정상게임', '콜드게임', '서스펜디드 게임', '노 게임'],
        default: '정상게임'
    }
}, { _id: false });

const dailyGameSchema = new mongoose.Schema({
    date: {
        type: String,
        required: true,
        unique: true
    },
    games: [gameSchema]
}, { 
    timestamps: true,
    versionKey: false
});

module.exports = mongoose.model('DailyGame', dailyGameSchema); 