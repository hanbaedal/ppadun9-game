// 한국 시간 관련 유틸리티 함수들

// 한국 시간대 오프셋 (UTC+9)
const KST_OFFSET = 9 * 60 * 60 * 1000; // 9시간을 밀리초로

/**
 * 현재 한국 시간을 반환
 * @returns {Date} 한국 시간
 */
function getKoreanTime() {
    return new Date(); // 시스템 시간을 그대로 반환
}

/**
 * UTC 시간을 한국 시간으로 변환
 * @param {Date|string} utcDate - UTC 시간
 * @returns {Date} 한국 시간
 */
function toKoreanTime(utcDate) {
    const date = new Date(utcDate);
    return new Date(date.getTime() + KST_OFFSET);
}

/**
 * 한국 시간을 UTC로 변환
 * @param {Date} koreanDate - 한국 시간
 * @returns {Date} UTC 시간
 */
function toUTCTime(koreanDate) {
    const date = new Date(koreanDate);
    return new Date(date.getTime() - KST_OFFSET);
}

/**
 * 한국 시간으로 포맷된 문자열 반환
 * @param {Date|string} date - 날짜
 * @param {string} format - 포맷 ('date', 'time', 'datetime', 'iso')
 * @returns {string} 포맷된 문자열
 */
function formatKoreanTime(date, format = 'datetime') {
    const koreanDate = toKoreanTime(date);
    
    switch (format) {
        case 'date':
            return koreanDate.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' });
        case 'time':
            return koreanDate.toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul' });
        case 'datetime':
            return koreanDate.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
        case 'iso':
            return koreanDate.toISOString();
        default:
            return koreanDate.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
    }
}

/**
 * 오늘 날짜를 YYYY-MM-DD 형식으로 반환 (한국 시간 기준)
 * @returns {string} YYYY-MM-DD 형식의 날짜
 */
function getKoreanDateString() {
    const koreanTime = getKoreanTime();
    const year = koreanTime.getFullYear();
    const month = String(koreanTime.getMonth() + 1).padStart(2, '0');
    const day = String(koreanTime.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * 한국 시간 기준으로 특정 날짜의 시작 시간 (00:00:00)
 * @param {Date|string} date - 날짜
 * @returns {Date} 해당 날짜의 시작 시간
 */
function getKoreanDateStart(date) {
    const koreanDate = toKoreanTime(date);
    return new Date(koreanDate.getFullYear(), koreanDate.getMonth(), koreanDate.getDate());
}

/**
 * 한국 시간 기준으로 특정 날짜의 끝 시간 (23:59:59)
 * @param {Date|string} date - 날짜
 * @returns {Date} 해당 날짜의 끝 시간
 */
function getKoreanDateEnd(date) {
    const koreanDate = toKoreanTime(date);
    return new Date(koreanDate.getFullYear(), koreanDate.getMonth(), koreanDate.getDate(), 23, 59, 59, 999);
}

/**
 * 한국 시간 기준으로 이번 주의 시작 (월요일)
 * @returns {Date} 이번 주 월요일 00:00:00
 */
function getKoreanWeekStart() {
    const koreanTime = getKoreanTime();
    const day = koreanTime.getDay();
    const diff = koreanTime.getDate() - day + (day === 0 ? -6 : 1); // 월요일이 1, 일요일이 0
    return new Date(koreanTime.setDate(diff));
}

/**
 * 한국 시간 기준으로 이번 달의 시작
 * @returns {Date} 이번 달 1일 00:00:00
 */
function getKoreanMonthStart() {
    const koreanTime = getKoreanTime();
    return new Date(koreanTime.getFullYear(), koreanTime.getMonth(), 1);
}

/**
 * 한국 시간 기준으로 이번 년도의 시작
 * @returns {Date} 이번 년도 1월 1일 00:00:00
 */
function getKoreanYearStart() {
    const koreanTime = getKoreanTime();
    return new Date(koreanTime.getFullYear(), 0, 1);
}

/**
 * 한국 시간 기준으로 N일 전 날짜
 * @param {number} days - 일수
 * @returns {Date} N일 전 날짜
 */
function getKoreanDaysAgo(days) {
    const koreanTime = getKoreanTime();
    return new Date(koreanTime.getTime() - (days * 24 * 60 * 60 * 1000));
}

/**
 * 한국 시간 기준으로 N시간 전 시간
 * @param {number} hours - 시간
 * @returns {Date} N시간 전 시간
 */
function getKoreanHoursAgo(hours) {
    const koreanTime = getKoreanTime();
    return new Date(koreanTime.getTime() - (hours * 60 * 60 * 1000));
}

/**
 * 한국 시간 기준으로 N분 전 시간
 * @param {number} minutes - 분
 * @returns {Date} N분 전 시간
 */
function getKoreanMinutesAgo(minutes) {
    const koreanTime = getKoreanTime();
    return new Date(koreanTime.getTime() - (minutes * 60 * 1000));
}

// 전역 객체에 함수들 추가
window.KoreanTime = {
    getKoreanTime,
    toKoreanTime,
    toUTCTime,
    formatKoreanTime,
    getKoreanDateString,
    getKoreanDateStart,
    getKoreanDateEnd,
    getKoreanWeekStart,
    getKoreanMonthStart,
    getKoreanYearStart,
    getKoreanDaysAgo,
    getKoreanHoursAgo,
    getKoreanMinutesAgo
}; 