const mongoose = require('mongoose');

const gameProgressSchema = new mongoose.Schema({
    gameId: {
        type: String,
        required: true,
        unique: true
    },
    gameSelection: {
        type: String,
        required: true
    },
    teamType: {
        type: String,
        enum: ['홈팀', '원정팀'],
        required: true
    },
    inning: {
        type: String,
        enum: ['1회', '2회', '3회', '4회', '5회', '6회', '7회', '8회', '9회', '연장1', '연장2', '연장3', '연장4', '연장5'],
        required: true
    },
    batter: {
        type: Number,
        min: 1,
        max: 20,
        required: true
    },
    bettingStartTime: {
        type: Date
    },
    bettingEndTime: {
        type: Date
    },
    bettingResult: {
        type: String,
        enum: ['1루', '2루', '3루', '홈런', '아웃']
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('GameProgress', gameProgressSchema); 