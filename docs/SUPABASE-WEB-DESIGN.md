# 설계도 — 마케팅 에이전트 → Supabase 닫힌 학습 루프 (웹 운영)

> **핵심 통찰:** 생성·학습·소스는 **이미 로컬 하네스에 있다.** 새로 만드는 건
> 그걸 웹에 연결하는 **다리(push/pull · Supabase · 웹앱)뿐**이다. 에이전트를 새로
> 짜거나 학습 엔진을 발명하는 게 아니다.
>
> 참고 구현: 브랜치 `feat/supabase-web-review` (v1 = push + 웹 검토, 동작 검증, 미푸시).

---

## 0. 전체 구동 (닫힌 루프)

```
[플러그인·로컬] 매일 생성 ─push─► [Supabase] ─► [웹앱·비공개링크]
     ▲  학습 반영                  drafts            검토·수정·복사
     │                            feedback          피드백(잘된점/안된점)
     │                            learnings         소스(참고이미지·지침) 관리
     │                            sources                │
     └──── pull ◄──────────────── [Supabase] ◄───────────┘
        learn.mjs → preferences/learnings 누적 → 다음 생성에 주입 = 에이전트 업그레이드
```

하루 사이클: **pull(피드백·소스) → generate(학습 주입) → push(생성물) → 웹 검토 → 피드백 → (다음날) pull …**

---

## 1. 결정된 운영 모델

| 항목 | 결정 |
|------|------|
| 운영 주체 | 클라가 로컬 Claude Code(플러그인) 실행 |
| DB | 클라 계정 신규 Supabase 프로젝트 |
| 웹 접근 | 비공개 링크 (로그인 없음, RLS + noindex) |

---

## 2. 기존(로컬)에 이미 있는 것 — **재사용, 손대지 않음**

| 기능 | 위치 | 동작 |
|------|------|------|
| **학습 누적** | `posts/preferences.yaml` + `src/preferences.mjs` | approve/reject 시 누적 → 생성 시 카피/이미지 spec에 주입 (`generate-spec.mjs`/`generate-helpers.mjs`). `learn.mjs rebuild`로 재학습 |
| **소스 자료** | `posts/sources/` | 대시보드에서 읽기/저장 → `brief.sourceMaterials.texts/images/designRef`로 생성 주입 |
| **사진 풀** | `posts/insight-photos/` | `insight-card --photo-dir`로 카드 배경 |
| **지침 재검수** | `inspect-guidelines.mjs` + `guideline-reviewer` 에이전트 | 가이드라인 의미 부합 LLM 판정 |

→ 웹 피드백·소스를 **이 경로들에 흘려넣으면** 학습 루프가 그대로 돈다.

---

## 3. 새로 만드는 것 — **다리뿐**

| 컴포넌트 | 신규/변경 | 역할 |
|---------|----------|------|
| `harness/bin/push-supabase.mjs` | 신규(v1✅) | draft+카드 → Supabase `drafts` + Storage |
| `harness/bin/pull-supabase.mjs` | **신규** | Supabase → 로컬: 피드백→learn 입력, 소스이미지/지침→`posts/insight-photos/`·`posts/sources/` |
| Supabase 테이블 4종 | 신규 | `drafts` · `feedback` · `learnings` · `sources` |
| `web-review/` 웹앱 | 신규(v1✅, 확장) | 검토·수정·복사 + **피드백(잘된점/안된점)** + **소스(이미지·지침) 관리** + (선택)업그레이드 검토 |

---

## 4. 데이터 모델 (Supabase 4 테이블)

| 테이블 | 키 컬럼 | 누가 씀 | 누가 읽음 |
|--------|--------|--------|----------|
| `drafts` | campaign_slug, channel, body, hashtags, image_urls, guardian_*, status, **feedback** | push(로컬) | 웹 |
| `feedback` | draft_id, verdict(👍/👎), good_points, bad_points, edited_body, created_at | 웹 | pull(로컬) |
| `learnings` | scope(channel/global), rule, weight, source_feedback_id, active | pull/distill | 생성(주입) · 웹(검토) |
| `sources` | kind(image/guideline), url 또는 text, label, active, updated_at | 웹 | pull(로컬) |

`drafts.feedback`(v1) → 본격 운영은 별도 `feedback` 테이블로 구조화(잘된점/안된점/수정본 분리).

---

## 5. 학습 메커니즘 — "에이전트 업그레이드"가 실제로 되는 법

에이전트 파일(`harness/agents/*.md`)은 **§0 동결**. 자동 덮어쓰기 금지. 업그레이드는 2층으로:

**① 즉시 (매일, 자동) — 학습 주입**
웹 피드백 → `pull-supabase.mjs` → `learn.mjs ingest`(신규 서브커맨드) → `preferences.yaml`/`learnings`에 누적
→ **다음 생성 시 spec에 주입** (기존 preferences 주입 경로 그대로). 에이전트 파일 불변, 즉시 반영.

**② 주기적 (주1회 등, 검토) — 지침 distill**
누적 `learnings` 요약 → 에이전트/채널 지침 **개선안 제안** → **웹에서 Totaro 검토·승인** → 적용
(`company-profile` 가이드라인 또는 채널 톤 문서에 반영, 백업 + git diff로 추적). 에이전트 .md는 사람 승인 후에만.

> 즉 "하네스 엔지니어링 학습"은 ①(자동 주입)이 매일 돌고, ②(지침 개선)는 사람 게이트로 가끔.

---

## 6. 소스 관리 — 웹 입력이 생성에 반영되는 법

| 웹에서 | → Supabase | → pull이 로컬에 | → 생성 반영 |
|--------|-----------|----------------|------------|
| 참고이미지 업로드 | `sources`(image) + Storage | `posts/insight-photos/` 또는 sourceMaterials.images | 카드 배경 / 비주얼 참고 |
| 지침 편집 | `sources`(guideline) | `posts/sources/` 또는 profile 가이드라인 | `brief.sourceMaterials` + `guideline-reviewer` |

---

## 7. 구현 단계

| Phase | 내용 | 상태 |
|-------|------|------|
| 0 | Supabase 프로젝트 + 스키마(`drafts`) | v1 ✅ (SQL 있음) |
| 1 | `push-supabase.mjs` (생성물 → Supabase) | v1 ✅ |
| 2 | 웹앱 배포(Vercel) — 검토·수정·복사 | v1 ✅ |
| **3** | `feedback` 테이블 + 웹 피드백 UI(잘된점/안된점) + `pull-supabase.mjs` → `learn.mjs ingest` | 신규 |
| **4** | `sources` 테이블 + 웹 소스 관리(이미지 업로드·지침 편집) → pull → 생성 주입 | 신규 |
| **5** | `learnings` distill + 웹 업그레이드 검토·승인 | 신규 |
| **6** | `morning-routine`에 `pull → generate → push` 자동 연결 | 신규 |

각 Phase는 독립 동작 (additive). 3까지면 학습 루프, 4~5까지면 완전 자율.

---

## 8. 한 가지 정할 것 — 에이전트 업그레이드 강도

| 안 | 내용 | 권장 |
|----|------|------|
| A | 즉시 학습 주입만 (preferences). 에이전트 파일 영영 불변 | 가장 안전 |
| B | + 주기적 distill을 웹에서 검토·승인해 지침 반영 | 실제 "업그레이드" |
| **C** | **A(매일 자동) + B(주기 검토)** | **★ 추천 — 사용자가 말한 "학습→업그레이드" 완성** |

---

## 9. 회귀 함정 (반드시)

- `service_role` 키 = `.env.local`만. PUBLIC 레포·웹·config.js 금지. anon키는 RLS로 보호.
- **에이전트 .md 자동 덮어쓰기 금지** (§0). 업그레이드는 ①주입 / ②사람 승인 후 지침 변경만.
- `pull`은 로컬 사용자 편집을 덮지 않게 — merge 전략(타임스탬프/필드 단위), 백업(`*.bak`).
- Storage 키 ASCII(`channel/basename`). RLS 필수(anon 읽기+지정 컬럼 update만).
- env 없으면 push/pull graceful skip → 로컬 단독 동작 유지.
- 멜라누아 레포 PUBLIC — fixture/소스에 확정표기(`필수 항목 All N.D.`/`@melanoir_official`)만, "28종/28-FREE" 금지.
- `learn.mjs` 기존 동작(approve/reject 학습) 깨지 않게 — ingest는 **추가** 입력원으로.
