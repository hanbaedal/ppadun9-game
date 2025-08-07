# 빠던나인 게임 운영 시스템

빠던나인 야구 게임의 운영을 위한 전용 시스템입니다.

## 🚀 배포 정보

### Render 배포
- **서비스명**: ppadun9-game-operation
- **환경**: Node.js 18.x
- **포트**: 10000
- **자동 배포**: 활성화

### 환경 변수
다음 환경 변수들이 필요합니다:

```bash
NODE_ENV=production
MONGODB_URI=your_mongodb_connection_string
DB_NAME=member-management
SESSION_SECRET=your_session_secret
PORT=10000
JWT_SECRET=member-management-secret-key-2024
```

## 📁 프로젝트 구조

```
ppadun9-game/
├── src/                   # 소스 코드
│   ├── public/           # 정적 파일
│   │   ├── index.html    # 메인 게임 운영 페이지
│   │   ├── employee-management.html  # 직원 관리
│   │   ├── operate-member.html  # 운영자 관리
│   │   ├── team-game.html       # 팀 게임 관리
│   │   ├── operator-login.html  # 운영자 로그인
│   │   ├── operator-register.html # 운영자 등록
│   │   ├── css/          # 스타일시트
│   │   └── js/           # 클라이언트 스크립트
│   ├── routes/           # API 라우트
│   │   ├── employee-management.js  # 직원 관리 API
│   │   ├── operate-member.js    # 운영자 관리 API
│   │   ├── members.js           # 회원 관리 API
│   │   ├── betting.js           # 배팅 시스템 API
│   │   ├── team-games.js        # 팀 게임 API
│   │   ├── monitoring.js        # 모니터링 API
│   │   └── game-stats.js        # 게임 통계 API
│   ├── models/           # 데이터 모델
│   ├── config/           # 설정 파일
│   ├── utils/            # 유틸리티
│   └── server.js         # 메인 서버 파일
├── package.json          # 프로젝트 설정
└── render.yaml           # Render 배포 설정
```

## 🔧 핵심 기능

### 1. 사용자 관리 시스템
- **직원 관리** (`employee-member` 컬렉션)
  - 직원 등록/수정/삭제
  - 승인 시스템 (관리자 승인 필요)
  - 로그인/로그아웃 관리
  - 부서별 분류

- **운영자 관리** (`OPERATE-MEMBER` 컬렉션)
  - 운영자 전용 관리 시스템
  - 역할 기반 권한 관리
  - 독립적인 로그인 시스템

- **회원 관리** (`game-member` 컬렉션)
  - 게임 회원 관리
  - 로그인/로그아웃 관리

### 2. 게임 운영 시스템
- **팀 게임 관리**
  - 일일 게임 스케줄링
  - 게임 상태 실시간 업데이트
  - 경기 결과 관리

- **배팅 시스템**
  - 실시간 배팅 기능
  - 배팅 예측 및 결과 관리
  - 게임별 배팅 세션 관리

### 3. 모니터링 및 통계
- **실시간 모니터링**
  - 접속자 수 실시간 추적
  - 게임 진행 상황 모니터링
  - 시스템 상태 확인

- **통계 대시보드**
  - 사용자 통계
  - 게임 통계
  - 배팅 통계

## 🛠️ 개발 환경 설정

1. **의존성 설치**
   ```bash
   npm install
   ```

2. **환경 변수 설정**
   `.env` 파일을 생성하고 필요한 환경 변수를 설정하세요.

3. **개발 서버 실행**
   ```bash
   npm run dev
   ```

## 🚀 배포 방법

### Render 배포
1. GitHub 저장소에 코드를 푸시합니다.
2. Render 대시보드에서 새 Web Service를 생성합니다.
3. GitHub 저장소를 연결합니다.
4. 환경 변수를 설정합니다.
5. 배포를 시작합니다.

### 환경 변수 설정 (Render)
- `MONGODB_URI`: MongoDB 연결 문자열
- `DB_NAME`: 데이터베이스 이름 (member-management)
- `SESSION_SECRET`: 세션 시크릿 (자동 생성)
- `NODE_ENV`: production
- `PORT`: 10000
- `JWT_SECRET`: JWT 시크릿 키

## 📝 API 문서

### 사용자 관리 API
- `GET /api/employee-management` - 직원 목록 조회
- `POST /api/employee-management` - 직원 등록
- `PUT /api/employee-management/:id` - 직원 정보 수정
- `DELETE /api/employee-management/:id` - 직원 삭제
- `PATCH /api/employee-management/:id/approval` - 직원 승인

- `GET /api/operate-member` - 운영자 목록 조회
- `POST /api/operate-member` - 운영자 등록
- `POST /api/operate-member/login` - 운영자 로그인
- `POST /api/operate-member/logout` - 운영자 로그아웃

### 게임 관리 API
- `GET /api/team-games/:date` - 특정 날짜 게임 조회
- `POST /api/team-games/import-from-daily/:date` - 일일 게임 가져오기
- `PUT /api/team-games/:date/:gameNumber` - 게임 상태 업데이트

### 배팅 시스템 API
- `GET /api/betting/sessions` - 배팅 세션 조회
- `POST /api/betting/predictions` - 배팅 예측 등록
- `GET /api/betting/results` - 배팅 결과 조회

### 모니터링 API
- `GET /api/monitoring/comprehensive` - 종합 모니터링
- `GET /api/monitoring/total-users` - 총 접속자 수
- `GET /api/system/stats` - 시스템 통계

## 🗄️ 데이터베이스 구조

### 주요 컬렉션
1. **`employee-member`** - 직원 관리
2. **`OPERATE-MEMBER`** - 운영자 관리
3. **`game-member`** - 게임 회원
4. **`todaygames`** - 오늘의 게임
5. **`daily-games`** - 일일 게임
6. **`betting-sessions`** - 배팅 세션
7. **`betting-predictions`** - 배팅 예측
8. **`betting-results`** - 배팅 결과

## 🔒 보안

- 세션 기반 인증
- 중복 로그인 방지
- 관리자 승인 시스템
- CORS 설정
- Helmet 보안 헤더

## 🎯 주요 특징

1. **모듈화된 구조**: 각 기능별로 독립적인 라우트와 모듈
2. **확장 가능한 설계**: 새로운 기능 추가가 용이
3. **실시간 업데이트**: 실시간 기능 구현
4. **사용자 친화적**: 직관적인 UI/UX
5. **보안 강화**: 다층 보안 시스템
6. **모바일 최적화**: 모든 디바이스에서 최적화된 경험

## 📞 지원

문제가 발생하면 관리자에게 문의하세요.
