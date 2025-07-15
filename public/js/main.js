// 빠던나인 프로젝트 관리 시스템
console.log('빠던나인 프로젝트 관리 시스템이 로드되었습니다.');

// 시스템 초기화
function initializeSystem() {
    console.log('프로젝트 관리 시스템이 초기화되었습니다.');
    setupEventListeners();
    loadSystemStatus();
}

// 이벤트 리스너 설정
function setupEventListeners() {
    // 메뉴 아이템 호버 효과
    const menuItems = document.querySelectorAll('.menu-item');
    menuItems.forEach(item => {
        item.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-5px)';
        });
        
        item.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
        });
    });
}

// 시스템 상태 로드
function loadSystemStatus() {
    // 현재 시간 표시
    updateDateTime();
    
    // 시스템 통계 로드 (필요시)
    loadSystemStats();
}

// 현재 시간 업데이트
function updateDateTime() {
    const dateTimeString = KoreanTime.formatKoreanTime(KoreanTime.getKoreanTime(), 'datetime');
    
    // 시간 표시 요소가 있다면 업데이트
    const timeElement = document.getElementById('current-time');
    if (timeElement) {
        timeElement.textContent = dateTimeString;
    }
}

// 시스템 통계 로드
function loadSystemStats() {
    // API 호출을 통한 시스템 통계 로드
    fetch('/api/system/stats')
        .then(response => response.json())
        .then(data => {
            console.log('시스템 통계:', data);
        })
        .catch(error => {
            console.log('시스템 통계 로드 실패:', error);
        });
}

// 메뉴 네비게이션 함수들
function navigateToEmployeeManagement() {
    window.location.href = '/employee-management.html';
}

function navigateToGameManagement() {
    window.location.href = '/team-game.html';
}

function navigateToMemberManagement() {
    window.location.href = '/member-management.html';
}

function navigateToSystemManagement() {
    window.location.href = '/system-management.html';
}

// 페이지 로드 시 시스템 초기화
document.addEventListener('DOMContentLoaded', function() {
    initializeSystem();
    
    // 1초마다 시간 업데이트
    setInterval(updateDateTime, 1000);
});

// 전역 함수로 노출
window.navigateToEmployeeManagement = navigateToEmployeeManagement;
window.navigateToGameManagement = navigateToGameManagement;
window.navigateToMemberManagement = navigateToMemberManagement;
window.navigateToSystemManagement = navigateToSystemManagement; 