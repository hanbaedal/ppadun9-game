const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    userId: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    phone: {
        type: String,
        required: true,
        unique: true
    },
    team: {
        type: String,
        required: true,
        enum: ['KIA', 'LG', 'NC', 'SSG', 'KT', '두산', '롯데', '삼성', '한화']
    },
    points: {
        type: Number,
        default: 3000
    },
    joinDate: {
        type: Date,
        default: Date.now
    }
});

// 비밀번호 검증 메서드
UserSchema.methods.comparePassword = function(candidatePassword) {
    return this.password === candidatePassword;
};

module.exports = mongoose.model('User', UserSchema); 