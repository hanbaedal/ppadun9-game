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
│   │   ├── operator-login.html    # 운영자 로그인
│   │   ├── operator-register.html # 운영자 등록
│   │   ├── css/          # 스타일시트
│   │   └── js/           # 클라이언트 스크립트
│   ├── routes/           # API 라우트
│   ├── models/           # 데이터 모델
│   ├── config/           # 설정 파일
│   ├── utils/            # 유틸리티
│   └── server.js         # 메인 서버 파일
├── package.json          # 프로젝트 설정
└── render.yaml           # Render 배포 설정
```

## 🔧 주요 기능

### 운영자 관리
- 운영자 회원가입 및 로그인
- 중복 로그인 방지
- 관리자 승인 시스템

### 게임 운영
- 팀 게임 관리
- 실시간 게임 상태 모니터링
- 배팅 시스템 운영

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

### 운영자 관리 API
- `POST /api/employee/register` - 운영자 등록
- `POST /api/employee/login` - 운영자 로그인
- `POST /api/employee/logout` - 운영자 로그아웃
- `GET /api/employee/current-user` - 현재 사용자 정보
- `POST /api/employee/approve` - 운영자 승인
- `GET /api/employee/pending-approval` - 승인 대기 중인 운영자 목록

### 게임 운영 API
- `GET /api/team-games/{date}` - 특정 날짜의 게임 목록
- `POST /api/team-games/import-from-daily/{date}` - 일일 게임에서 팀 게임으로 가져오기
- `PUT /api/team-games/{date}/{gameNumber}` - 게임 상태 업데이트

## 🔒 보안

- 세션 기반 인증
- 중복 로그인 방지
- 관리자 승인 시스템
- CORS 설정
- Helmet 보안 헤더

## 📞 지원

문제가 발생하면 관리자에게 문의하세요.
