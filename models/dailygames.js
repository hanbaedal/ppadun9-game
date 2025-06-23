const mongoose = require('mongoose');

const dailygamesSchema = new mongoose.Schema({
    date: {
        type: String,
        required: true,
        unique: true
    },
    games: [{
        number: {
            type: Number,
            required: true,
            min: 1,
            max: 5
        },
        homeTeam: {
            type: String,
            default: null
        },
        awayTeam: {
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
        status: {
            type: String,
            enum: ['정상게임', '우천취소', '기타'],
            default: '정상게임'
        }
    }],
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// 업데이트 시 updatedAt 자동 설정
dailygamesSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

module.exports = mongoose.model('DailyGames', dailygamesSchema); 