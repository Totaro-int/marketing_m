# CARRY-OVER — 기존에서 가져올 것 / 버릴 것

소스 레포: `../마케팅 자동화 에이전트/` (= `C:\Users\WIN10\Desktop\개발공장\마케팅 자동화 에이전트`)
→ 아래 파일들을 **복사해서 적응**(adapt). 나머지 레거시는 무시.

---

## ✅ 가져올 것 (검증됨 — 재사용)

| 소스 경로 | → 새 위치 | 용도 |
|-----------|----------|------|
| `web-review/index.html` | `web/index.html` | **라이트 콘솔 6섹션** (오늘발행·소스·브랜드DNA·학습·캘린더·설정). 검증 완료, 피드백=단일입력 |
| `web-review/fixture.json` | `web/fixture.json` | 데모 데이터(6섹션) — 브랜드DNA 락 포함 |
| `web-review/config.example.js` | `web/config.example.js` | SB_URL/SB_ANON 템플릿 (config.js는 gitignore) |
| `web-review/vercel.json` | `web/vercel.json` | 정적 배포 + noindex |
| `web-review/supabase-schema.sql` | `supabase/schema.sql` | drafts 테이블+RLS+버킷 (→ feedback/sources/learnings 3테이블 추가) |
| `harness/bin/push-supabase.mjs` | `scripts/push-supabase.mjs` | 생성물 → Supabase 전송 (fetch, dry-run, graceful skip, asset 절대/상대 resolve) |
| `harness/bin/screenshot.mjs` | `engine/_screenshot.mjs` | **HTML→PNG (Playwright)** — 렌더러 기반 |
| `harness/bin/insight-card.mjs` | (참고) | 사진+텍스트 오버레이 카드 패턴 (스크림·모드 참고) |
| `harness/src/content-engine/brand-guardian.mjs` | `engine/guard.mjs` | 브랜드 검수(금기어·레이어리크·fact-SSoT) 기반 |
| `harness/bin/self-check.mjs` | `scripts/self-check.mjs` | 브랜드락 grep 가드(28종/28-FREE/@melanoir.official) + 보안 점검 |
| `harness/src/preferences.mjs` + `harness/bin/learn.mjs` | (참고) | 학습 누적/생성 주입 메커니즘 — `learnings/` 설계 참고 |
| `harness/bin/_lib.mjs` | (참고) | .env.local 로더·yaml·paths 유틸 일부 |
| `harness/docs/SUPABASE-WEB-DESIGN.md` | `docs/` | **4테이블·pull·watch·실시간·학습 설계** (이미 작성됨) |
| `out/supabase-loop-design.png`, `out/console-today.png`, `out/console-brand.png` | `docs/` | 설계도·콘솔 캡처 |

> 콘솔(`index.html`)은 fixture가 array→object로 바뀐 최신본. 브랜드DNA 금기어에서 28종/28-FREE 제거됨(PUBLIC 안전). 그대로 가져올 것.

---

## ❌ 버릴 것 (레거시 — 안 가져옴)

| 버림 | 이유 / 대체 |
|------|-------------|
| `harness/bin/` 25-스크립트 잡동사니·`dashboard.mjs` 등 | **클러터만** 버림 (아래 ❌ 목록). 단 **플러그인 모델 자체는 유지** |
| ~~"플러그인 구조 버림"~~ | ⚠️ **정정:** 새 빌드도 **Claude Code 플러그인**(구독 LLM). `.claude-plugin/`+`skills/`+`commands/`+`agents/`(copywriter 등)는 clean하게 **재구성해서 가져옴.** generate=에이전트, API 아님 |
| `harness/bin/dashboard.mjs` (3500줄) | → 라이트 웹 콘솔로 대체 |
| `harness/bin/copy-deck.mjs`, `card-studio.mjs` | → 웹 콘솔 / 콘텐츠 엔진으로 대체 |
| `harness/bin/browser-publish.mjs` + Chrome 9222/Playwright connect | 복붙 발행으로 대체 (봇 의심 0) |
| `harness/src/content-engine/providers/inhouse-slides` 등 | → **골드 콘텐츠 엔진**으로 대체 (훨씬 정교) |
| `harness/bin/generate*.mjs`, `morning-routine.mjs` | → `engine/generate.mjs` + lean 오케스트레이션 재작성 |
| `harness/bin/seed-calendar.mjs`, board/approve/reject 등 | 필요 시 최소만 재구현 |
| `posts/`, `auth/`, `company-profile.yaml` | 멜라누아 데이터는 `brand/brand-dna.json` + `reference/`로 정리 |

---

## 브랜드 DNA 출처
`brand/brand-dna.json` 새로 만들되 소스는: `reference/BRAND_LOCKS.md` + `reference/melanoir_brand_guide.md` + 기존 `company-profile.yaml`(멜라누아). 락: 필수 항목 All N.D. / @melanoir_official / EWG 1등급 평가 / 레이어 분리 / 성적서 비공개.
