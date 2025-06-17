const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: {
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
    email: {
        type: String,
        required: true
    },
    phone: {
        type: String,
        required: true
    },
    team: {
        type: String,
        required: true
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
    timestamps: true
});

// 비밀번호 검증 메서드
userSchema.methods.comparePassword = function(candidatePassword) {
    return this.password === candidatePassword;
};

module.exports = mongoose.model('User', userSchema); 