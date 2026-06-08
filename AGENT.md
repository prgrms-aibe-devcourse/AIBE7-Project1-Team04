# AGENT.md

## Purpose

이 문서는 AI Agent가 이 프로젝트의 코드를 생성하거나 수정할 때 따라야 할 작업 규칙을 정리한 문서이다.

AI Agent는 이 문서를 기준으로 다음을 지켜야 한다.

- 기존 폴더 구조 유지
- 필요한 파일만 수정
- Express 구조 준수
- Supabase 보안 규칙 준수
- AI API Key 노출 금지
- 기능 단위 작업
- 수정 결과 요약

---

## Project Summary

이 프로젝트는 사용자가 업로드한 이미지를 기반으로 여행지를 추천하고, 여행 일정을 생성하는 웹 서비스이다.

기본 흐름은 다음과 같다.

```text
회원가입 / 로그인
→ 이미지 업로드
→ 이미지 분석
→ 여행지 추천
→ 여행 조건 입력
→ 여행 일정 생성
→ 여행 일정 저장 / 조회
```

백엔드는 Express를 사용한다.
Supabase는 Auth, Database, Storage 용도로 사용한다.
AI API 호출은 Express 서버에서만 처리한다.

---

## Tech Stack

### Frontend

- HTML
- CSS
- JavaScript

### Backend

- Node.js
- Express

### External Services

- Supabase Auth
- Supabase Database
- Supabase Storage
- AI API

---

## Project Structure

AI Agent는 아래 구조를 기준으로 파일을 생성하거나 수정한다.

```text
project-root/
├─ docs/
│  ├─ requirements.md
│  ├─ wbs.md
│  ├─ flowchart.md
│  ├─ use-case.md
│  └─ screen-definition.md
│
├─ public/
│  ├─ index.html
│  ├─ pages/
│  │  ├─ login.html
│  │  ├─ signup.html
│  │  ├─ image-upload.html
│  │  ├─ recommendation.html
│  │  ├─ itinerary-create.html
│  │  ├─ itinerary-list.html
│  │  ├─ itinerary-detail.html
│  │  └─ mypage.html
│  │
│  ├─ css/
│  │  ├─ reset.css
│  │  ├─ common.css
│  │  ├─ layout.css
│  │  └─ pages/
│  │     ├─ auth.css
│  │     ├─ image-upload.css
│  │     ├─ recommendation.css
│  │     └─ itinerary.css
│  │
│  ├─ js/
│  │  ├─ common/
│  │  │  ├─ api.js
│  │  │  ├─ auth.js
│  │  │  ├─ utils.js
│  │  │  └─ validator.js
│  │  │
│  │  ├─ pages/
│  │  │  ├─ login.js
│  │  │  ├─ signup.js
│  │  │  ├─ image-upload.js
│  │  │  ├─ recommendation.js
│  │  │  ├─ itinerary-create.js
│  │  │  ├─ itinerary-list.js
│  │  │  └─ itinerary-detail.js
│  │  │
│  │  └─ components/
│  │     ├─ header.js
│  │     ├─ footer.js
│  │     ├─ modal.js
│  │     └─ loading.js
│  │
│  └─ assets/
│     ├─ images/
│     ├─ icons/
│     └─ fonts/
│
├─ src/
│  ├─ server.js
│  ├─ app.js
│  │
│  ├─ config/
│  │  ├─ env.js
│  │  └─ supabase.js
│  │
│  ├─ routes/
│  │  ├─ auth.routes.js
│  │  ├─ image.routes.js
│  │  ├─ ai.routes.js
│  │  ├─ recommendation.routes.js
│  │  ├─ itinerary.routes.js
│  │  └─ review.routes.js
│  │
│  ├─ controllers/
│  │  ├─ auth.controller.js
│  │  ├─ image.controller.js
│  │  ├─ ai.controller.js
│  │  ├─ recommendation.controller.js
│  │  ├─ itinerary.controller.js
│  │  └─ review.controller.js
│  │
│  ├─ services/
│  │  ├─ auth.service.js
│  │  ├─ image.service.js
│  │  ├─ ai.service.js
│  │  ├─ recommendation.service.js
│  │  ├─ itinerary.service.js
│  │  └─ review.service.js
│  │
│  ├─ middlewares/
│  │  ├─ auth.middleware.js
│  │  ├─ upload.middleware.js
│  │  └─ error.middleware.js
│  │
│  └─ utils/
│     ├─ response.js
│     ├─ validator.js
│     └─ file.js
│
├─ supabase/
│  ├─ migrations/
│  ├─ policies/
│  └─ seed.sql
│
├─ uploads/
│  └─ .gitkeep
│
├─ .env
├─ .env.example
├─ .gitignore
├─ package.json
├─ README.md
├─ AGENT.md
├─ SKILL.md
└─ DESIGN.md
```

---

## Core Rules

### 1. Do not modify unrelated files

요청받은 기능과 직접 관련 없는 파일은 수정하지 않는다.

수정 범위가 커질 경우 먼저 이유를 설명한다.

---

### 2. Follow Express layer structure

Express 코드는 반드시 역할에 따라 분리한다.

```text
routes
→ controllers
→ services
```

각 계층의 역할은 다음과 같다.

| Layer       | Role                                 |
| ----------- | ------------------------------------ |
| routes      | API 경로와 HTTP Method 정의          |
| controllers | 요청값 확인, service 호출, 응답 반환 |
| services    | 실제 비즈니스 로직 처리              |
| middlewares | 인증, 업로드, 에러 처리              |
| config      | 환경변수, Supabase 연결              |
| utils       | 공통 함수                            |

라우터에 긴 로직을 작성하지 않는다.
컨트롤러에 AI API 호출이나 Supabase 쿼리를 길게 작성하지 않는다.
실제 처리는 service 파일에서 담당한다.

---

### 3. Keep frontend simple

프론트엔드는 화면과 사용자 이벤트 중심으로 작성한다.

프론트엔드 역할:

- 화면 렌더링
- 입력값 수집
- 버튼 이벤트 처리
- Express API 호출
- 성공/실패 메시지 표시

프론트엔드에서 하면 안 되는 것:

- AI API 직접 호출
- Supabase Service Role Key 사용
- 비밀 API Key 작성
- 복잡한 비즈니스 로직 작성
- 데이터베이스 직접 관리 로직 작성

API 요청은 가능한 `public/js/common/api.js`를 통해 처리한다.

---

### 4. Never expose secrets

다음 값은 프론트엔드 코드에 작성하지 않는다.

- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY`
- `GROQ_API_KEY`
- `JWT_SECRET`
- 실제 운영용 API Key

비밀 값은 `.env`에서 관리한다.
`.env`는 절대 커밋하지 않는다.

`.env.example`에는 값 없이 키 이름만 작성한다.

```env
PORT=3000

SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

GEMINI_API_KEY=
GROQ_API_KEY=

JWT_SECRET=
```

---

### 5. AI API must be called from Express

AI API는 Express 서버에서만 호출한다.

AI 관련 코드는 기본적으로 아래 파일을 사용한다.

```text
src/routes/ai.routes.js
src/controllers/ai.controller.js
src/services/ai.service.js
```

---

### 6. Supabase access should go through Express

가능하면 프론트엔드에서 Supabase에 직접 접근하지 않는다.
프론트엔드는 Express API를 호출하고, Express가 Supabase와 통신한다.

기본 흐름:

```text
Frontend
→ Express API
→ Supabase
→ Express API
→ Frontend
```

Supabase 관련 설정은 아래 파일에서 관리한다.

```text
src/config/supabase.js
```

Supabase 쿼리는 각 기능의 service 파일에서 처리한다.

---

## API Naming Rules

API 경로는 `/api`로 시작한다.
이름은 기능 기준으로 작성한다.

권장 API 예시:

```text
POST   /api/auth/signup
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me

POST   /api/images/upload

POST   /api/ai/analyze-image
POST   /api/ai/generate-itinerary

GET    /api/recommendations
POST   /api/recommendations

GET    /api/itineraries
GET    /api/itineraries/:id
POST   /api/itineraries
PATCH  /api/itineraries/:id
DELETE /api/itineraries/:id

GET    /api/reviews
POST   /api/reviews
```

API 이름은 임의로 복잡하게 만들지 않는다.

---

## File Naming Rules

파일명은 기능을 기준으로 작성한다.
가능하면 기존 패턴을 따른다.

### Backend

```text
auth.routes.js
auth.controller.js
auth.service.js

image.routes.js
image.controller.js
image.service.js

itinerary.routes.js
itinerary.controller.js
itinerary.service.js
```

### Frontend

```text
login.html
login.js
signup.html
signup.js
image-upload.html
image-upload.js
itinerary-create.html
itinerary-create.js
```

새 파일을 만들 때는 기존 네이밍 규칙을 깨지 않는다.

---

## Feature Work Rules

기능을 구현할 때는 아래 순서로 진행한다.

```text
1. 관련 요구사항 ID 확인
2. 필요한 화면 확인
3. 필요한 API 확인
4. HTML 작성 또는 수정
5. CSS 작성 또는 수정
6. 페이지 JS 작성 또는 수정
7. Express route 작성
8. controller 작성
9. service 작성
10. Supabase 또는 AI API 연결
11. 성공 케이스 처리
12. 실패 케이스 처리
13. 사용자 메시지 표시
14. 수정 파일 요약
```

요구사항 ID가 있는 경우 코드 주석이나 응답 요약에서 함께 언급한다.

---

## Error Handling Rules

에러는 사용자에게 보이는 메시지까지 처리한다.
`console.error()`만 작성하지 않는다.

기본 메시지 예시:

| Case             | Message                                                            |
| ---------------- | ------------------------------------------------------------------ |
| 로그인 실패      | 이메일 또는 비밀번호를 확인해주세요.                               |
| 회원가입 실패    | 회원가입 중 문제가 발생했습니다. 입력 정보를 확인해주세요.         |
| 이미지 형식 오류 | JPG, PNG, WEBP 형식의 이미지만 업로드할 수 있습니다.               |
| 이미지 용량 초과 | 이미지 용량은 5MB 이하만 업로드할 수 있습니다.                     |
| 이미지 분석 실패 | 이미지 분석 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.     |
| 일정 생성 실패   | 여행 일정 생성에 실패했습니다. 조건을 확인한 뒤 다시 시도해주세요. |
| 데이터 조회 실패 | 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.             |

서버 에러 응답은 가능하면 같은 형식을 사용한다.

```json
{
  "success": false,
  "message": "오류 메시지"
}
```

성공 응답도 가능하면 같은 형식을 사용한다.

```json
{
  "success": true,
  "data": {}
}
```

---

## Authentication Rules

로그인이 필요한 기능은 반드시 인증 확인을 거친다.

로그인이 필요한 기능 예시:

- 이미지 업로드
- 이미지 분석 요청
- 여행 일정 생성
- 여행 일정 저장
- 저장한 여행 일정 조회
- 후기 작성
- 마이페이지 조회

인증 처리는 가능하면 아래 미들웨어를 사용한다.

```text
src/middlewares/auth.middleware.js
```

프론트엔드에서도 로그인 상태가 필요한 페이지는 접근 제한을 처리한다.

---

## Image Upload Rules

이미지 업로드는 다음 흐름을 따른다.

```text
사용자 이미지 선택
→ 브라우저 미리보기
→ Express 업로드 API 요청
→ upload.middleware.js
→ image.service.js
→ Supabase Storage 저장
→ DB에 이미지 정보 저장
→ 결과 반환
```

이미지 업로드 시 확인할 것:

- 파일 존재 여부
- 이미지 파일 여부
- 파일 용량 제한
- 업로드 성공 여부
- 실패 메시지 표시

---

## Database Rules

사용자별 데이터에는 `user_id`를 포함한다.

예상 테이블:

```text
profiles
uploaded_images
analysis_results
recommendations
itineraries
reviews
```

데이터 조회 시 본인 데이터만 조회되도록 처리한다.

RLS 정책이 필요한 경우 `supabase/policies/`에 SQL 파일로 관리한다.

---

## UI Rules

화면을 수정할 때는 기존 디자인 톤을 유지한다.
전체 레이아웃을 임의로 크게 바꾸지 않는다.

UI 작업 시 확인할 것:

- 버튼 텍스트가 명확한가?
- 입력창 placeholder가 적절한가?
- 오류 메시지 영역이 있는가?
- 로딩 상태가 필요한가?
- 모바일 화면에서 깨지지 않는가?

CSS는 가능한 페이지별 CSS에 작성한다.

공통 스타일은 아래 파일에 작성한다.

```text
public/css/common.css
public/css/layout.css
```

페이지 전용 스타일은 아래 폴더에 작성한다.

```text
public/css/pages/
```

---

## Do Not

AI Agent는 다음 작업을 하지 않는다.

- `.env` 파일 생성 후 실제 Key 작성
- 실제 API Key를 코드에 직접 작성
- 프론트엔드에서 AI API 직접 호출
- 프론트엔드에서 Supabase Service Role Key 사용
- 요청과 관련 없는 파일 대량 수정
- 기존 폴더 구조를 임의로 변경
- 하나의 파일에 모든 기능 몰아넣기
- 라우터에 긴 로직 작성
- 컨트롤러에 긴 비즈니스 로직 작성
- 오류를 콘솔에만 출력
- 사용자 안내 메시지 없이 실패 처리
- 기존 파일명 규칙 무시
- 임의로 새로운 기술 스택 추가

---

## When Creating New Code

새 코드를 작성할 때는 다음 기준을 따른다.

### JavaScript

- `const`, `let` 사용
- 의미 있는 함수명 사용
- 중복 코드 최소화
- 비동기 코드는 `async/await` 사용
- `try/catch`로 오류 처리
- 사용자 메시지 처리 포함

### Express

- route, controller, service 분리
- controller는 짧게 유지
- service에서 실제 로직 처리
- 에러는 `next(error)` 또는 공통 에러 방식 사용
- 응답 형식 통일

### HTML

- 의미 있는 태그 사용
- form에는 id 부여
- input에는 name 부여
- button에는 type 명시
- 이미지에는 alt 작성

### CSS

- 기존 클래스명 스타일을 참고
- 공통 스타일과 페이지 스타일 분리
- 지나치게 복잡한 선택자 사용 금지
- 반응형 고려

---

## Response Rule for AI Agent

작업 완료 후 AI Agent는 다음 내용을 요약한다.

```text
수정한 파일
추가한 파일
구현한 기능
확인해야 할 점
```

---

## Final Check

작업 완료 전 반드시 확인한다.

```text
요구사항과 맞는가?
관련 파일만 수정했는가?
Express 구조를 지켰는가?
route / controller / service가 분리되었는가?
API Key가 노출되지 않았는가?
.env가 커밋되지 않는가?
성공 케이스가 동작하는가?
실패 케이스가 동작하는가?
사용자 오류 메시지가 있는가?
수정 파일을 요약했는가?
```
