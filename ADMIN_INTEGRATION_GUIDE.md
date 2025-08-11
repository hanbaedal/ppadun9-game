# 🚀 관리자 프로그램 연동 가이드

## 📋 **개요**
운영자 프로그램(`ppadun9-game`)과 관리자 프로그램(`c:\haesoo\ppadun9`) 간의 연동을 위한 가이드입니다.

## 🔗 **연동 구조**
```
관리자 프로그램 (c:\haesoo\ppadun9)
    ↓ API 호출
운영자 프로그램 (ppadun9-game)
    ↓ 데이터베이스
MongoDB (OPERATE-MEMBER 컬렉션)
```

## 🌐 **API 엔드포인트**

### **기본 URL**
```
http://localhost:3000/api/operator
```

### **운영자 관리 API**

#### 1. 승인 대기 운영자 목록 조회
```http
GET /api/operator/pending
```

**응답 예시:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "64f8a1b2c3d4e5f6a7b8c9d0",
      "username": "operator1",
      "name": "운영자1",
      "email": "op1@example.com",
      "phone": "010-1234-5678",
      "role": "operator",
      "isActive": true,
      "isApproved": false,
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

#### 2. 운영자 승인/거부
```http
PUT /api/operator/approve/:id
```

**요청 본문:**
```json
{
  "isApproved": true,
  "reason": "승인 사유"
}
```

**응답 예시:**
```json
{
  "success": true,
  "message": "운영자가 승인되었습니다."
}
```

#### 3. 전체 운영자 목록 조회
```http
GET /api/operator/all
```

**응답 예시:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "64f8a1b2c3d4e5f6a7b8c9d0",
      "username": "operator1",
      "name": "운영자1",
      "email": "op1@example.com",
      "phone": "010-1234-5678",
      "role": "operator",
      "isActive": true,
      "isApproved": true,
      "approvedAt": "2024-01-15T11:00:00.000Z",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T11:00:00.000Z"
    }
  ]
}
```

## 🛠️ **관리자 프로그램 수정 방법**

### **1. operator-approval.html 수정**

#### **기존 코드 (예시):**
```javascript
// 기존 API 호출
const response = await fetch('/api/employee/pending');
```

#### **수정된 코드:**
```javascript
// 운영자 프로그램 API 호출
const response = await fetch('http://localhost:3000/api/operator/pending');
```

### **2. CORS 설정 확인**
운영자 프로그램에서 CORS가 이미 설정되어 있으므로, 관리자 프로그램에서 API 호출 시 별도 설정이 필요하지 않습니다.

### **3. 에러 처리 추가**
```javascript
try {
    const response = await fetch('http://localhost:3000/api/operator/pending');
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    // 성공 처리
} catch (error) {
    console.error('API 호출 오류:', error);
    // 에러 처리
}
```

## 📱 **API 테스트**

### **테스트 페이지 접속**
```
http://localhost:3000/api-test
```

### **테스트 항목**
1. **운영자 등록** - 새로운 운영자 계정 생성
2. **아이디 중복 체크** - 사용자명 중복 확인
3. **승인 대기 목록** - 승인 대기 중인 운영자 조회
4. **전체 목록** - 모든 운영자 정보 조회

## 🔧 **문제 해결**

### **1. 연결 오류**
- 운영자 프로그램 서버가 실행 중인지 확인
- 포트 번호 확인 (기본: 3000)
- 방화벽 설정 확인

### **2. CORS 오류**
- 운영자 프로그램의 CORS 설정 확인
- 브라우저 개발자 도구에서 오류 메시지 확인

### **3. 데이터베이스 오류**
- MongoDB 연결 상태 확인
- 데이터베이스 컬렉션 존재 여부 확인

## 📞 **지원**

문제가 발생하면 다음을 확인해주세요:
1. 운영자 프로그램 서버 상태
2. 브라우저 개발자 도구의 네트워크 탭
3. 서버 콘솔 로그

---

**마지막 업데이트:** 2024년 1월 15일
**버전:** 1.0.0
