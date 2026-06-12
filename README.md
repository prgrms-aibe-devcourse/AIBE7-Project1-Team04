# PicTrip

사진 한 장에서 여행지를 찾고, AI로 국내 여행 일정을 생성하는 웹 서비스입니다.

PicTrip은 사용자가 장소명을 정확히 몰라도 여행 사진이나 분위기 이미지를 업로드하면 AI가 위치 또는 분위기를 분석하고, 실제 지도에서 검색 가능한 국내 여행지를 추천합니다. 추천 장소를 선택하면 기간, 인원, 예산, 출발지 같은 조건을 바탕으로 Day별 여행 일정과 카카오맵 기반 동선을 생성합니다.

## 주요 기능

| 기능 | 설명 |
| --- | --- |
| 이미지 위치 분석 | 업로드한 사진에서 촬영 장소를 추정하고, 사용자 힌트와 모순되는 경우 선택 UI로 보정합니다. |
| 이미지 분위기 분석 | 색감, 지형, 날씨, 분위기를 분석해 비슷한 국내 여행지를 추천합니다. |
| 실제 장소 검증 | AI 추천 장소를 Kakao Local API로 검증해 지도 검색 가능한 장소만 노출합니다. |
| AI 일정 생성 | 키워드, 목적지, 출발지, 기간, 인원, 예산, 추가 요청을 기반으로 Day별 일정을 생성합니다. |
| 진행 상태 스트리밍 | 일정 생성 중 분석, 동선 구성, 장소 검증, 마무리 단계를 NDJSON 스트림으로 표시합니다. |
| 지도 기반 결과 화면 | 카카오맵 마커, 날짜별 탭, 타임라인, 추천 이유, 여행 팁을 함께 보여줍니다. |
| 일정 편집 | 결과 화면에서 장소 검색, 추가, 수정, 삭제, 순서 변경을 지원합니다. |
| 일정 저장 | 로그인 사용자는 생성한 일정을 Supabase `trips` 테이블에 저장하고 마이페이지에서 다시 열 수 있습니다. |
| 인증 | Supabase 이메일 로그인과 별도 Kakao OAuth 플로우를 지원합니다. |

## 기술 스택

| 영역 | 기술 |
| --- | --- |
| Frontend | HTML, CSS, Vanilla JavaScript ES Modules |
| Backend | Node.js, Express |
| AI / LLM | Google Gemini, Groq, NVIDIA NIM, LangChain |
| Image Analysis | Gemini multimodal, LangChain structured output |
| Map / Place | Kakao Maps SDK, Kakao Local API, Google Places API |
| Auth / DB | Supabase Auth, Supabase PostgreSQL |
| Deploy | Render Web Service |

## 프로젝트 구조

```text
.
├── api/
│   └── index.js                    # Vercel 배포 실험용 진입점, server/app.js 재사용
├── public/                         # 정적 프론트엔드
│   ├── index.html                  # 메인 페이지
│   ├── pages/                      # 로그인, 이미지 분석, 일정 생성/결과, 마이페이지
│   ├── css/                        # 페이지별 스타일과 공용 디자인 토큰
│   └── js/
│       ├── auth/                   # 로그인, 회원가입, Kakao 가입 완료
│       ├── common/                 # API 요청, 로그인 가드
│       ├── components/             # 헤더, 푸터
│       └── pages/                  # 페이지별 화면 로직
├── server/
│   ├── app.js                      # Express 앱 진입점
│   ├── ai/                         # AI 호출, 프롬프트, 장소 검증, mock 일정
│   ├── config/                     # Supabase client/admin
│   ├── controllers/                # 요청 처리 로직
│   ├── routes/                     # API 라우터
│   └── utils/                      # Kakao OAuth, OAuth state cache
├── DESIGN.md                       # 디자인 가이드
├── AGENT.md                        # AI 에이전트 명세
├── package.json
└── vercel.json
```

## 실행 방법

### 로컬 실행

```bash
npm install
cp .env.example .env
npm run dev
```

브라우저에서 `http://localhost:3000`으로 접속합니다.

운영 실행은 다음 명령을 사용합니다.

```bash
npm start
```

### Render 실행 설정

Render에서는 Express 서버를 그대로 Web Service로 실행합니다.

| 항목 | 값 |
| --- | --- |
| Service Type | `Web Service` |
| Runtime | `Node` |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Root Directory | repository root |

Render가 `PORT` 환경 변수를 자동으로 주입하므로 별도로 고정 포트를 설정하지 않아도 됩니다. 배포 후 발급된 Render 도메인을 Supabase와 Kakao Developers 설정에도 함께 등록해야 로그인과 지도 기능이 정상 동작합니다.

## 환경 변수

`.env.example`을 기준으로 `.env`를 구성합니다.

| 변수 | 설명 | 필수 |
| --- | --- | --- |
| `DEFAULT_PROVIDER` | 일정 생성 기본 provider. 기본값은 `gemini`입니다. | 선택 |
| `GEMINI_API_KEY` | Gemini 일정 생성 및 이미지 분석 키 | 필수 |
| `GEMINI_MODEL` | Gemini 일정 생성 모델명 | 선택 |
| `GROQ_API_KEY` | Groq 기반 장소 추천, 힌트 검증, provider 선택 시 일정 생성에 사용 | 선택 |
| `GROQ_MODEL` | Groq 일정 생성 모델명 | 선택 |
| `NIM_API_KEY` | NVIDIA NIM provider 사용 시 필요 | 선택 |
| `NIM_BASE_URL` | NIM OpenAI-compatible API base URL | 선택 |
| `NIM_MODEL` | NIM 모델명 | 선택 |
| `ENABLE_MOCK_FALLBACK` | AI 호출 실패 시 예시 일정 반환 여부 | 선택 |
| `ENABLE_PLACE_VERIFY` | 일정 장소 검증 활성화 여부 | 선택 |
| `SUPABASE_URL` | Supabase 프로젝트 URL | 필수 |
| `SUPABASE_ANON_KEY` | Supabase anon key | 필수 |
| `SUPABASE_SERVICE_ROLE_KEY` | Kakao 가입 완료 및 admin user 조회/생성에 사용 | Kakao OAuth 사용 시 필수 |
| `KAKAO_REST_API_KEY` | Kakao Local API 장소 검색/검증 키 | 필수 |
| `KAKAO_CLIENT_ID` | Kakao OAuth REST API 키 또는 client id | Kakao OAuth 사용 시 필수 |
| `KAKAO_CLIENT_SECRET` | Kakao OAuth client secret | 선택 |
| `KAKAO_REDIRECT_URI` | Kakao OAuth callback URL | Kakao OAuth 사용 시 필수 |
| `GOOGLE_PLACES_API_KEY` | Kakao 검증 실패 시 Google Places 보조 검증에 사용 | 장소 검증 사용 시 권장 |
| `PORT` | Express 서버 포트. 기본값은 `3000`입니다. | 선택 |

참고: 카카오맵 JavaScript SDK 키는 현재 `public/pages/*` HTML의 SDK script URL에 직접 들어가 있습니다. 배포 환경이 바뀌면 Kakao Developers의 JavaScript 키 도메인 설정과 해당 script URL을 함께 확인해야 합니다.

## API 엔드포인트

### Auth: `/api/auth`

| Method | Endpoint | 설명 |
| --- | --- | --- |
| `POST` | `/signup` | 이메일 회원가입 |
| `POST` | `/login` | 이메일 로그인 |
| `GET` | `/kakao/authorize` | Kakao OAuth 인가 페이지로 이동 |
| `GET` | `/kakao/callback` | Kakao code 처리, 기존 사용자 세션 발급 또는 추가 가입 페이지 이동 |
| `POST` | `/kakao/complete` | Kakao 신규 사용자의 이메일/비밀번호 입력 후 Supabase 계정 생성 |

### Image Analyze: `/api`

| Method | Endpoint | 설명 |
| --- | --- | --- |
| `POST` | `/find-location` | 이미지 기반 위치 추정 및 주변 추천지 3곳 반환 |
| `POST` | `/confirm-location` | 사용자가 선택한 위치를 기준으로 추천지 재생성 |
| `POST` | `/find-mood` | 이미지 분위기 분석 및 유사 추천지 3곳 반환 |

### Itinerary: `/api/itineraries`

| Method | Endpoint | 설명 |
| --- | --- | --- |
| `POST` | `/generate` | 일정 생성 후 JSON 응답 |
| `POST` | `/generate-stream` | `application/x-ndjson` 스트림으로 진행 상태와 최종 일정을 반환 |

### Trips: `/api/trips`

모든 요청에 `Authorization: Bearer <access_token>` 헤더가 필요합니다.

| Method | Endpoint | 설명 |
| --- | --- | --- |
| `GET` | `/` | 내 여행 일정 목록 조회 |
| `GET` | `/:id` | 내 특정 여행 일정 조회 |
| `POST` | `/` | 새 일정 저장 |
| `PUT` | `/:id` | 기존 일정 제목, 조건, 결과 수정 |
| `DELETE` | `/:id` | 일정 삭제 |

## 사용자 흐름

1. 메인 화면에서 사진 기반 추천 또는 직접 일정 생성을 선택합니다.
2. 이미지 위치/분위기 분석 페이지에서 사진을 업로드하면 AI가 추천 여행지 3곳을 제공합니다.
3. 추천지를 선택하면 일정 조건 입력 페이지로 이동하며 키워드와 목적지가 자동 반영됩니다.
4. 조건을 제출하면 로딩 페이지에서 NDJSON 스트림으로 진행 상태를 표시합니다.
5. 결과 페이지에서 지도, Day별 타임라인, 장소 상세 정보를 확인하고 필요한 항목을 편집합니다.
6. 로그인 후 결과를 저장하면 마이페이지에서 다시 열고 수정할 수 있습니다.

## Render 배포 메모

이 프로젝트는 `server/app.js`를 직접 실행하는 Express 서버 구조입니다. 현재 배포 환경은 Render Web Service이며, `npm start`가 `node server/app.js`를 실행합니다.

Render 무료 플랜을 사용하는 경우 일정 시간 요청이 없으면 인스턴스가 sleep 상태가 될 수 있고, 첫 요청에서 콜드 스타트 지연이 발생할 수 있습니다.

`api/index.js`와 `vercel.json`은 Vercel 배포를 시도했던 설정 파일로 남아 있습니다. 현재 운영 기준은 Render입니다.

배포 시 다음 외부 서비스 설정도 함께 맞춰야 합니다.

| 서비스 | 확인 항목 |
| --- | --- |
| Supabase | Site URL, Redirect URLs에 Render 도메인 등록, `trips` 테이블 RLS, anon/service role key |
| Kakao Developers | Web 플랫폼 도메인에 Render 도메인 등록, Redirect URI 갱신, JavaScript 키 허용 도메인 |
| Google / Groq / NVIDIA | API key, 모델명, 과금/쿼터 |

## 데이터 저장

저장된 일정은 Supabase `trips` 테이블을 사용합니다. 서버 코드는 다음 필드를 기준으로 동작합니다.

| 필드 | 용도 |
| --- | --- |
| `id` | 일정 id |
| `user_id` | Supabase 사용자 id |
| `title` | 일정 카드 제목 |
| `payload` | 일정 생성 조건 |
| `itinerary` | 생성 및 편집된 일정 JSON |
| `created_at` | 생성일 |
| `updated_at` | 수정일 |

`/api/trips` 라우트는 Supabase 사용자 토큰으로 user client를 생성하고 `user_id` 조건을 함께 적용합니다. RLS 정책도 사용자 본인 데이터만 접근하도록 구성해야 합니다.

## 구현상 주의사항

- 프론트엔드는 `localStorage.session`에 Supabase 세션을 저장하고, 일정 생성 상태는 `sessionStorage`를 사용합니다.
- 일정 생성 화면은 현재 provider 선택 없이 `gemini`를 기본 provider로 고정합니다.
- `/generate-stream`은 브라우저 `ReadableStream`으로 줄 단위 JSON을 파싱합니다. EventSource 기반 SSE가 아닙니다.
- `ENABLE_PLACE_VERIFY=true`일 때 일정 장소 검증은 Kakao Local API를 먼저 사용하고, 일부 케이스에서 Google Places를 보조로 사용합니다.
- Kakao OAuth는 Supabase provider를 직접 쓰지 않고, 백엔드에서 Kakao 토큰 교환 후 Supabase admin API로 사용자를 생성하는 별도 플로우입니다.
- `server/controllers/kakaoAuthController.js`의 Kakao 사용자 검색은 admin `listUsers` 페이지 조회를 사용합니다. 사용자가 많아지면 별도 매핑 테이블로 분리하는 것이 좋습니다.

## 관련 문서

- [DESIGN.md](./DESIGN.md)
- [AGENT.md](./AGENT.md)

## 라이선스 / 출처

부트캠프 프로젝트: AIBE 7기 1차 Team 04

외부 API 및 서비스: Google Gemini, Groq, NVIDIA NIM, Kakao Maps, Kakao Local, Google Places, Supabase
