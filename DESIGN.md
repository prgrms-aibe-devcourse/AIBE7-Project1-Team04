# DESIGN.md

## 디자인 방향

여행 웹 서비스.
밝고 깔끔하게.
여행 느낌은 살리고, 너무 장난스럽지 않게.
AI 여행 플래너 느낌이라 신뢰감 있어야 함.

키워드:

- 여행
- 설렘
- 신뢰감
- 깔끔함
- 카드형 UI
- AI 추천
- 밝은 하늘색 분위기

---

## 폰트

전체 폰트는 **Pretendard만 사용**.

```css
body {
  font-family:
    "Pretendard",
    -apple-system,
    BlinkMacSystemFont,
    system-ui,
    sans-serif;
}
```

폰트 굵기:

- Hero 제목: `800`
- 섹션 제목: `700`
- 카드 제목: `600`
- 버튼: `600`
- 본문: `400`
- 설명/보조 텍스트: `400`

---

## 색상

```css
:root {
  --color-primary: #2563eb;
  --color-secondary: #ff6b5a;

  --color-bg: #f4f8ff;
  --color-card: #ffffff;

  --color-text: #111827;
  --color-subtext: #6b7280;
  --color-border: #dde7f3;

  --color-success: #10b981;
  --color-warning: #f59e0b;
  --color-danger: #ef4444;
}
```

사용 규칙:

- `#2563EB`: 메인 버튼, 링크, 선택 상태
- `#FF6B5A`: CTA, 추천 태그, 강조 버튼
- `#F4F8FF`: 전체 배경
- `#FFFFFF`: 카드, 입력창, 모달
- `#111827`: 주요 텍스트
- `#6B7280`: 설명 텍스트
- `#DDE7F3`: 테두리, 구분선

---

## 기본 스타일

```css
:root {
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 24px;

  --shadow-card: 0 8px 24px rgba(17, 24, 39, 0.08);
  --shadow-hover: 0 12px 32px rgba(17, 24, 39, 0.12);
}
```

전체 느낌:

- 배경은 연한 하늘색
- 카드는 흰색
- 모서리는 둥글게
- 그림자는 약하게
- 여백은 넉넉하게

---

## 레이아웃

기본 구조:

```text
Header
Hero Section
Search / Planner Card
Popular Destination Cards
AI Recommendation Section
CTA Banner
Footer
```

기본 컨테이너:

```css
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
}
```

모바일:

```css
@media (max-width: 768px) {
  .container {
    padding: 0 16px;
  }
}
```

---

## Header

구성:

- 로고
- 메뉴
- 로그인 / 회원가입 / 프로필

스타일:

- 배경 흰색
- 높이 `72px`
- 하단 border 사용
- 활성 메뉴는 Primary Blue

```css
.header {
  height: 72px;
  background: var(--color-card);
  border-bottom: 1px solid var(--color-border);
}

.nav-link.active {
  color: var(--color-primary);
  font-weight: 700;
}
```

---

## Hero

역할:

- 첫인상 담당
- 여행 이미지 사용
- 큰 문구 + CTA 버튼 배치

예시 문구:

```text
새로운 여행,
설레는 순간

AI가 나에게 맞는 여행 일정을 추천해드려요.
```

규칙:

- 밝은 여행 이미지 사용
- 텍스트 잘 보이게 그라데이션 추가
- 메인 버튼은 Primary Blue

---

## Button

Primary Button:

```css
.btn-primary {
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: var(--radius-md);
  padding: 14px 22px;
  font-weight: 600;
}
```

Accent Button:

```css
.btn-accent {
  background: var(--color-secondary);
  color: #fff;
  border: none;
  border-radius: var(--radius-md);
  padding: 14px 22px;
  font-weight: 600;
}
```

사용 규칙:

- Primary: 검색, 저장, 일정 생성
- Accent: 회원가입, 추천 확인, 강한 CTA
- Coral 남발 금지

---

## Card

```css
.card {
  background: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
  overflow: hidden;
}
```

Hover:

```css
.card:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow-hover);
}
```

사용 위치:

- 여행지 카드
- 추천 일정 카드
- AI 결과 카드
- 검색 카드

---

## Input

```css
.input {
  height: 48px;
  padding: 0 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: #fff;
  color: var(--color-text);
}

.input:focus {
  border-color: var(--color-primary);
  outline: none;
}
```

---

## Badge

```css
.badge {
  border-radius: 999px;
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 700;
}
```

종류:

- BEST: 파란색
- 추천: 코랄색
- 인기: 연한 파란색
- NEW: 코랄 outline

---

## 이미지

Hero 이미지:

- 밝은 여행지
- 하늘, 바다, 도시, 자연
- 너무 어두운 이미지 금지

카드 이미지:

- 비율 통일
- `object-fit: cover`
- 둥근 카드 안에 자연스럽게 배치

---

## 반응형

Desktop:

- 여행지 카드 4열
- 검색 폼 가로 배치

Tablet:

- 여행지 카드 2열

Mobile:

- 여행지 카드 1열
- 검색 폼 세로 배치
- Header 메뉴는 햄버거 처리

---

## 금지사항

하지 말 것:

- 폰트 여러 개 섞기
- 색상 많이 추가하기
- Coral 너무 많이 쓰기
- 그림자 진하게 쓰기
- 배경 완전 흰색만 쓰기
- 카드 모서리 제각각 쓰기
- 어두운 여행 이미지 쓰기

---

## 최종 느낌

```text
밝은 하늘색 배경
+ 흰색 카드
+ 파란색 메인 버튼
+ 코랄 포인트
+ Pretendard 단독
+ 둥글고 깔끔한 UI
```
  
한 줄 요약:

```text
여행의 설렘은 살리고, AI 서비스의 신뢰감은 유지하는 디자인.
```
