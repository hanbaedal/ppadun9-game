const express = require('express');
const router = express.Router();

// 동영상 시청 기록 모델 (임시 데이터 구조)
let videoWatchRecords = [
    {
        id: 1,
        memberId: 'user001',
        memberName: '김철수',
        videoId: 'video_001',
        videoTitle: '야구 하이라이트 영상 1',
        watchDate: '2024-01-15T10:30:00Z',
        watchDuration: 180, // 초 단위
        completed: true,
        pointsEarned: 50
    },
    {
        id: 2,
        memberId: 'user002',
        memberName: '이영희',
        videoId: 'video_002',
        videoTitle: '야구 하이라이트 영상 2',
        watchDate: '2024-01-15T14:20:00Z',
        watchDuration: 240,
        completed: true,
        pointsEarned: 75
    },
    {
        id: 3,
        memberId: 'user003',
        memberName: '박민수',
        videoId: 'video_001',
        videoTitle: '야구 하이라이트 영상 1',
        watchDate: '2024-01-16T09:15:00Z',
        watchDuration: 90,
        completed: false,
        pointsEarned: 0
    },
    {
        id: 4,
        memberId: 'user001',
        memberName: '김철수',
        videoId: 'video_003',
        videoTitle: '야구 하이라이트 영상 3',
        watchDate: '2024-01-16T16:45:00Z',
        watchDuration: 300,
        completed: true,
        pointsEarned: 100
    },
    {
        id: 5,
        memberId: 'user004',
        memberName: '정수진',
        videoId: 'video_002',
        videoTitle: '야구 하이라이트 영상 2',
        watchDate: '2024-01-17T11:30:00Z',
        watchDuration: 240,
        completed: true,
        pointsEarned: 75
    }
];

// 동영상 시청 기록 목록 조회
router.get('/video-watch', (req, res) => {
    try {
        // 페이지네이션 파라미터
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;

        // 필터링 파라미터
        const memberName = req.query.memberName;
        const videoTitle = req.query.videoTitle;
        const completed = req.query.completed;

        let filteredRecords = [...videoWatchRecords];

        // 회원명으로 필터링
        if (memberName) {
            filteredRecords = filteredRecords.filter(record => 
                record.memberName.toLowerCase().includes(memberName.toLowerCase())
            );
        }

        // 동영상 제목으로 필터링
        if (videoTitle) {
            filteredRecords = filteredRecords.filter(record => 
                record.videoTitle.toLowerCase().includes(videoTitle.toLowerCase())
            );
        }

        // 완료 여부로 필터링
        if (completed !== undefined) {
            const isCompleted = completed === 'true';
            filteredRecords = filteredRecords.filter(record => record.completed === isCompleted);
        }

        // 날짜순으로 정렬 (최신순)
        filteredRecords.sort((a, b) => new Date(b.watchDate) - new Date(a.watchDate));

        // 페이지네이션 적용
        const paginatedRecords = filteredRecords.slice(startIndex, endIndex);

        // 통계 계산
        const totalRecords = filteredRecords.length;
        const totalCompleted = filteredRecords.filter(record => record.completed).length;
        const totalPointsEarned = filteredRecords.reduce((sum, record) => sum + record.pointsEarned, 0);
        const avgWatchDuration = filteredRecords.length > 0 
            ? Math.round(filteredRecords.reduce((sum, record) => sum + record.watchDuration, 0) / filteredRecords.length)
            : 0;

        // 고유 회원 수 계산
        const uniqueMembers = new Set(filteredRecords.map(record => record.memberId)).size;

        res.json({
            success: true,
            records: paginatedRecords,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(totalRecords / limit),
                totalRecords: totalRecords,
                hasNext: endIndex < totalRecords,
                hasPrev: page > 1
            },
            stats: {
                totalRecords,
                totalCompleted,
                totalPointsEarned,
                avgWatchDuration,
                uniqueMembers
            }
        });
    } catch (error) {
        console.error('동영상 시청 기록 조회 오류:', error);
        res.status(500).json({
            success: false,
            message: '동영상 시청 기록을 불러오는데 실패했습니다.'
        });
    }
});

// 동영상 시청 기록 통계 조회
router.get('/video-watch/stats', (req, res) => {
    try {
        // 전체 통계
        const totalRecords = videoWatchRecords.length;
        const totalCompleted = videoWatchRecords.filter(record => record.completed).length;
        const totalPointsEarned = videoWatchRecords.reduce((sum, record) => sum + record.pointsEarned, 0);
        const avgWatchDuration = videoWatchRecords.length > 0 
            ? Math.round(videoWatchRecords.reduce((sum, record) => sum + record.watchDuration, 0) / videoWatchRecords.length)
            : 0;

        // 고유 회원 수
        const uniqueMembers = new Set(videoWatchRecords.map(record => record.memberId)).size;

        // 동영상별 통계
        const videoStats = {};
        videoWatchRecords.forEach(record => {
            if (!videoStats[record.videoId]) {
                videoStats[record.videoId] = {
                    videoId: record.videoId,
                    videoTitle: record.videoTitle,
                    watchCount: 0,
                    completedCount: 0,
                    totalPointsEarned: 0,
                    avgWatchDuration: 0,
                    totalWatchDuration: 0
                };
            }
            
            videoStats[record.videoId].watchCount++;
            videoStats[record.videoId].totalWatchDuration += record.watchDuration;
            videoStats[record.videoId].totalPointsEarned += record.pointsEarned;
            
            if (record.completed) {
                videoStats[record.videoId].completedCount++;
            }
        });

        // 평균 시청 시간 계산
        Object.values(videoStats).forEach(video => {
            video.avgWatchDuration = Math.round(video.totalWatchDuration / video.watchCount);
        });

        // 회원별 통계
        const memberStats = {};
        videoWatchRecords.forEach(record => {
            if (!memberStats[record.memberId]) {
                memberStats[record.memberId] = {
                    memberId: record.memberId,
                    memberName: record.memberName,
                    watchCount: 0,
                    completedCount: 0,
                    totalPointsEarned: 0,
                    avgWatchDuration: 0,
                    totalWatchDuration: 0
                };
            }
            
            memberStats[record.memberId].watchCount++;
            memberStats[record.memberId].totalWatchDuration += record.watchDuration;
            memberStats[record.memberId].totalPointsEarned += record.pointsEarned;
            
            if (record.completed) {
                memberStats[record.memberId].completedCount++;
            }
        });

        // 평균 시청 시간 계산
        Object.values(memberStats).forEach(member => {
            member.avgWatchDuration = Math.round(member.totalWatchDuration / member.watchCount);
        });

        res.json({
            success: true,
            overallStats: {
                totalRecords,
                totalCompleted,
                totalPointsEarned,
                avgWatchDuration,
                uniqueMembers,
                completionRate: totalRecords > 0 ? Math.round((totalCompleted / totalRecords) * 100) : 0
            },
            videoStats: Object.values(videoStats),
            memberStats: Object.values(memberStats)
        });
    } catch (error) {
        console.error('동영상 시청 통계 조회 오류:', error);
        res.status(500).json({
            success: false,
            message: '동영상 시청 통계를 불러오는데 실패했습니다.'
        });
    }
});

// 새로운 동영상 시청 기록 추가 (테스트용)
router.post('/video-watch', (req, res) => {
    try {
        const { memberId, memberName, videoId, videoTitle, watchDuration, completed } = req.body;
        
        const newRecord = {
            id: videoWatchRecords.length + 1,
            memberId,
            memberName,
            videoId,
            videoTitle,
            watchDate: new Date().toISOString(),
            watchDuration: watchDuration || 0,
            completed: completed || false,
            pointsEarned: completed ? Math.round(watchDuration / 60) * 25 : 0 // 1분당 25포인트
        };
        
        videoWatchRecords.push(newRecord);
        
        res.json({
            success: true,
            message: '동영상 시청 기록이 추가되었습니다.',
            record: newRecord
        });
    } catch (error) {
        console.error('동영상 시청 기록 추가 오류:', error);
        res.status(500).json({
            success: false,
            message: '동영상 시청 기록 추가에 실패했습니다.'
        });
    }
});

module.exports = router; 