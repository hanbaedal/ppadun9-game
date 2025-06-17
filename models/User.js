const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    userId: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    phone: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    team: {
        type: String,
        required: true,
        enum: ['KIA', 'LG', 'NC', 'SSG', 'KT', '두산', '롯데', '삼성', '한화']
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user'
    },
    points: {
        type: Number,
        default: 3000
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

// 비밀번호 검증 메서드
userSchema.methods.comparePassword = function(candidatePassword) {
    return this.password === candidatePassword;
};

module.exports = mongoose.model('User', userSchema); 