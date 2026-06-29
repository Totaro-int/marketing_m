# 멜라누아 스튜디오 — 운영 런북 & 자가수정 가이드 (RUNBOOK)

> **이 문서는 Claude Code(Cowork)가 읽고 스스로 고치도록 설계됐다.**
> 설치/실행 중 오류가 나면 — ① 출력의 **[CODE]** 또는 에러 메시지를 확인 → ② 아래에서 해당 항목을 찾아 **자가수정** 명령을 적용 → ③ `npm run doctor` (또는 실패한 명령) 재실행 → 모두 ✓ 될 때까지 반복.
> 모든 자가수정은 **이 폴더 안에서 안전하게 실행 가능**(외부 삭제·파괴 명령 없음). 확신이 없으면 사람에게 물어볼 것.

---

## 0. 자가수정 루프 (설치 → 무오류 가동)

```
설치(setup) → npm run doctor → ✗ 있나?
   ├─ 예: 출력의 [CODE] → 이 문서에서 찾기 → 자가수정 적용 → npm run doctor 재실행 (반복)
   └─ 아니오(전부 ✓): npm run verify (엔진 검증) → /melanoir 1회 테스트 → 완료
```

Claude Code 운영자에게: 위 루프를 **자동으로** 수행하라. doctor가 `✗ [CODE]`를 내면 이 문서의 해당 CODE 지침을 그대로 실행하고 재점검하라. 2회 시도 후에도 안 풀리면 증상·로그를 사람에게 보고하라.

---

## 1. 구동 방식 (한눈에)

- **명령**: `/melanoir` (Cowork/Claude Code, **작업 폴더 = 레포 루트**). 인자: 없음→오늘 자동토픽, `6`→토픽, `카드`→IG만, `다음`→다음토픽.
- **흐름**: 피드백 pull→학습 → 토픽 선택 → **5채널 골드 카피 생성**(구독 LLM, API키 0) → 브랜드·광고법 가드 → **발행**.
- **발행처**:
  - SNS(IG·LinkedIn·Threads·네이버블로그) → **Supabase → 콘솔**(`melanoir-console.vercel.app`)에서 **다운로드/복붙**(수동 업로드).
  - 자사몰 인사이트 → **GEO/SEO 정적 아티클 git push → melanoir.co.kr/insights 자동 배포 + IndexNow 색인**(`MELANOIR_SITE_REPO` 설정 시).
- **데이터**: Supabase(`marketing_drafts`/`feedback`/`sources`/`learnings`) · Storage(`card-images`) · 자사몰 레포(정적 페이지).
- **비용**: 카피는 Claude 구독으로 작성 → Anthropic API 키 불필요.

---

## 2. 진단 코드별 자가수정 ([CODE] = doctor 출력)

### [NODE] — Node 버전
- 증상: `Node.js v16…` / 문법 에러(top-level await 등).
- 자가수정: Node **18+ LTS** 설치(nodejs.org) 또는 `nvm install 20 && nvm use 20`. 재확인 `node -v`.

### [DEPS] — 의존성 미설치
- 증상: `Cannot find package 'pg'` / `ERR_MODULE_NOT_FOUND`.
- 자가수정: `npm install`.
- npm install이 **canvas 빌드 실패**로 멈추면(흔함): canvas는 선택 → `npm install --omit=optional` 로 재시도. (IG 카드는 브라우저 편집기가 렌더하므로 지장 없음.)

### [ENV] — .env.local 없음
- 자가수정: `cp .env.local.example .env.local` → 값 입력(아래 [KEYS]).

### [KEYS] — Supabase 키 미설정
- 값 출처: **Supabase 대시보드 → Project Settings → API**.
  - `SUPABASE_URL` = Project URL · `SUPABASE_SERVICE_KEY` = service_role(⚠️ 비공개) · `SUPABASE_ANON_KEY` = anon public.
- 자가수정: `.env.local` 에 위 3개 입력. **service_role은 절대 공개/커밋 금지**(이미 .gitignore).
- 키 자체는 사람(브랜드)이 보유 → 없으면 사람에게 요청.

### [CONFIG] — web/config.js 없음 (콘솔 anon)
- 자가수정: **`npm run gen:config`** — `.env.local` 의 URL·anon 으로 `web/config.js` 자동 생성. (`npm run setup` 도 자동 호출)
- 실패하면 [KEYS] 먼저 — 특히 `.env.local` 에 **`SUPABASE_ANON_KEY`** 값이 있어야 함(엔진은 service_role을 쓰지만 콘솔 config.js는 anon 필요).

### [FONTS] — 카드 폰트 없음
- 증상: 렌더 폰트 깨짐/실패.
- 자가수정: `reference/gold-reference/fonts/*.otf` → `web/fonts/` 로 복사. (레포에 폰트가 없으면 사람에게 골드 폰트 요청.)

### [GIT] — git 미설치/미인증
- 자가수정: git 설치(git-scm.com). 자사몰 자동 발행엔 자사몰 레포 **쓰기 권한 인증** 필요 → `gh auth login` 또는 git 자격증명(소유자 계정).

### [SB] — Supabase 연결/스키마
- HTTP **401/403** → 키 틀림 → [KEYS] 재확인.
- HTTP **404** 또는 `relation "marketing_drafts" does not exist` → 스키마 미적용 → `node scripts/apply-schema.mjs` (또는 Supabase SQL 편집기에 `db/schema.sql` 실행).
- 네트워크 타임아웃 → URL/방화벽/프록시 확인.

### [CANVAS] — (선택) 서버 렌더
- canvas는 **선택**. 미설치/빌드실패여도 생성·발행 정상(IG 카드는 브라우저 편집기 `web/cards.html`).
- 서버 렌더가 굳이 필요 없으면 무시. 강제 비활성: `MELANOIR_NO_CANVAS=1`.
- 설치 시도(선택): macOS `brew install pkg-config cairo pango libpng jpeg giflib librsvg` 후 `npm install canvas`.
- ⚠️ **자사몰 인사이트 카드 이미지**는 canvas 필요. canvas 없으면 인사이트 텍스트 아티클은 발행되나 카드 PNG는 생략됨.

### [SITE] — (선택) 자사몰 자동 발행
- 자가수정: 자사몰 레포를 **쓰기 권한 계정으로 클론** → `.env.local` 에 `MELANOIR_SITE_REPO=/경로/<레포>/web/site/insights`.
- push 실패(권한) → 소유자 계정으로 git 인증. 권한 없으면 PR 방식(fork+PR) 또는 사람에게 권한 요청.

---

## 3. 런타임 오류 (실행 중)

| 증상 | 원인 | 자가수정 |
|---|---|---|
| `canvas` 빌드/로드 실패 | 네이티브 의존성 | 선택이므로 무시 · `MELANOIR_NO_CANVAS=1` · 또는 [CANVAS] |
| node-canvas `loadImage` 한글 경로 에러 | 경로 인코딩 | `fs.readFileSync` 버퍼로 로드(엔진에 이미 적용 — 새 코드에도 동일 패턴) |
| 자사몰 `git push` 권한 거부 | 레포 쓰기 권한 없음 | 소유자 계정 인증 / fork+PR / 사람에게 collaborator 요청 |
| IndexNow **403**(Naver) | 키 파일 미배포 | `<key>.txt`(publish-insight가 생성)가 자사몰에 배포돼야 함 → push·배포 후 정상(202/200) |
| `playwright` 없음(verify 스크립트) | 선택 | 검증 스크립트는 선택 · 필요 시 `npx playwright install chromium` |
| Bash에서 `node`/`tail` 미발견(Windows) | Git Bash PATH | **PowerShell**로 실행 |
| 카피가 스켈레톤(자리표시자)로 발행 거부 | LLM 카피 미작성 | `/melanoir`(에이전트가 골드 카피 작성)로 실행. `daily.mjs` 단독은 스모크용 |
| 가드 BLOCKED | 브랜드락/광고법 위반 | 위반 문구를 가드 메시지대로 수정(예: '안전하다' 단독→측정언어, 제품수치는 데이터 레이어에) |

---

## 4. 검증 (설치 후 테스트)

| 명령 | 확인 |
|---|---|
| `npm run doctor` | 준비 상태(필수 ✓) — **가장 먼저** |
| `npm run verify` | 엔진(렌더 ~1% · 가드 · self-check · e2e) |
| `/melanoir` 1회 | 5채널 생성 + 콘솔 노출 + (설정 시)자사몰 발행 |

전부 통과면 납품 가능 상태. 실패 항목은 §2~§3에서 자가수정 후 재검증.

---

## 5. 색인(SEO/GEO) — /melanoir에 포함

- **자동(매 발행)**: IndexNow → 네이버·Bing·ChatGPT 즉시 색인 통보 + sitemap·llms.txt 갱신(publish-insight).
- **1회 설정**: `/totaro-seo` 로 Google Search Console·네이버 서치어드바이저 등록 + 사이트맵 제출 → 이후 자동 크롤. 새 인사이트 URL은 `/totaro-seo`로 추가 색인 요청 가능.
- 확인: `melanoir.co.kr/sitemap.xml`에 `/insights/<날짜>` 포함, `melanoir.co.kr/<key>.txt` 200(IndexNow 키), `/llms.txt` 200.
