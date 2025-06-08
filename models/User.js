const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

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

// 비밀번호 해싱
UserSchema.pre('save', async function(next) {
    try {
        console.log('비밀번호 해시화 시작');
        console.log('원본 비밀번호:', this.password);
        
        if (!this.isModified('password')) {
            console.log('비밀번호가 변경되지 않음');
            return next();
        }
        
        const salt = await bcrypt.genSalt(10);
        console.log('생성된 salt:', salt);
        
        this.password = await bcrypt.hash(this.password, salt);
        console.log('해시화된 비밀번호:', this.password);
        
        next();
    } catch (error) {
        console.error('비밀번호 해시화 중 오류:', error);
        next(error);
    }
});

// 비밀번호 검증 메서드
UserSchema.methods.comparePassword = async function(candidatePassword) {
    try {
        console.log('비밀번호 비교 시작');
        console.log('입력된 비밀번호:', candidatePassword);
        console.log('저장된 해시:', this.password);
        
        const isMatch = await bcrypt.compare(candidatePassword, this.password);
        console.log('비밀번호 일치 여부:', isMatch);
        
        return isMatch;
    } catch (error) {
        console.error('비밀번호 비교 중 오류:', error);
        throw error;
    }
};

module.exports = mongoose.model('User', UserSchema); 