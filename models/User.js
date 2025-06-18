const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        maxlength: 16
    },
    position: {
        type: String,
        required: true,
        enum: ['대표', '고문', '감사', '이사', '본부장', '팀장', '팀원']
    },
    department: {
        type: String,
        required: true,
        enum: ['경영', '기획', '재무', '관리', '운영', '영업']
    },
    username: {
        type: String,
        required: true,
        unique: true,
        minlength: 8,
        maxlength: 16
    },
    password: {
        type: String,
        required: true
    },
    phone: {
        type: String,
        required: true,
        match: /^[0-9]{3}-[0-9]{4}-[0-9]{4}$/
    },
    points: {
        type: Number,
        default: 3000
    },
    joinDate: {
        type: String,
        required: true
    }
}, {
    timestamps: true,
    collection: 'members'
});

// 비밀번호 검증 메서드
userSchema.methods.comparePassword = function(candidatePassword) {
    return this.password === candidatePassword;
};

module.exports = mongoose.model('Member', userSchema); 