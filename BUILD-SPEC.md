# BUILD-SPEC — Melanoir Studio (새 클린 빌드)

> **새 세션은 이 문서를 먼저 읽는다.** 레거시(`마케팅 자동화 에이전트` 25-스크립트 하네스)는 버리고,
> 검증된 부분만 가져와(→ `CARRY-OVER.md`) **골드 레퍼런스 기준**으로 새로 빌드한다.
>
> 목표: 멜라누아 IG 카드뉴스(캐러셀)를 **골드 스탠다드 퀄리티로 자동 생성** → 웹에서 검토·수정·피드백 →
> 실시간 학습 루프 → 에이전트 업그레이드. 클라가 매일 복붙으로 발행.

---

## 0. 확정된 결정 (사장님과 합의)

> ⚠️ **정정(2026-06-23):** 초기 스펙이 "새 빌드는 플러그인 아님"이라 잘못 적어 `generate.mjs`가 Anthropic API를 직접 호출하게 빌드됨 → **틀림.** 구동은 **Claude Code 플러그인(구독)** — 생성 = 플러그인 에이전트, **별도 API 키 불필요.** generate의 API fetch 제거 → copywriter 에이전트 방식으로 교체할 것. (렌더러·가드·이미지배정·Supabase·웹은 LLM 안 써서 전부 그대로 유효.)

| 항목 | 결정 |
|------|------|
| 아키텍처 | **Claude Code 플러그인** (clean). "레거시 버리자" = 클러터(25-스크립트 잡동사니)만 버림 · **플러그인 모델은 유지.** 기존에서 필요한 것만 carry-over |
| **LLM (생성)** | **Claude Code 구독 = 플러그인 에이전트가 카피 작성. Anthropic API 직접 호출·별도 키 금지.** generate = copywriter 에이전트 디스패치(API fetch 아님). 무인 cron이 진짜 필요하면 그때만 API 옵션 고려 |
| 웹 스택 | **라이트 콘솔 재사용** (흰배경·검정톤 정적 SPA, 6섹션 — 이미 검증) |
| v1 범위 | **전부 한 번에** (콘텐츠 엔진 + 웹 + Supabase 실시간 + 학습 루프) |
| 운영 | 클라 로컬 실행 · 클라 Supabase 프로젝트 · 비공개 링크 웹 · 복붙 발행(봇 의심 0) |
| 학습 강도 | C — 즉시 주입(매일) + 주기 distill 검토(웹 승인). 에이전트 파일 자동 덮어쓰기 금지 |

---

## 1. 골드 레퍼런스 = 절대 기준 (`reference/`)

이 빌드의 품질 기준. **추측 금지, 항상 여기 맞춘다.**

| 파일 | 무엇 |
|------|------|
| `reference/CAROUSEL_CONTENT_MODEL.md` | 캐러셀 4요소(thesis·후킹커버·스토리비트·마무리)·레이아웃·분량·광고법 |
| `reference/AGENT_LEARNINGS_HANDOFF.md` | 사장님 피드백 distill = 확정 원칙 + 교정 로그 (**학습 루프 seed**) |
| `reference/BRAND_LOCKS.md` | 브랜드·광고법 락 (절대) |
| `reference/LEGAL_REVIEW.md` | 법무 검토 |
| `reference/melanoir_brand_guide.md` | 브랜드 가이드 |
| `reference/melanoir_ig_gold_captions.md` | 골드 IG 캡션 (캡션 생성 few-shot) |
| `reference/IMAGE_STOCK.md` | 이미지 스톡 라벨·배정 규칙 |
| `reference/gold-reference/carousel_specs/carousel_01~10.json` | **캐러셀 스펙 입력 포맷** (생성 출력 형식) |
| `reference/gold-reference/cards/carousel_NN/` | **렌더된 골드 카드** (렌더러 출력 정답 — 비교 검증용) |
| `reference/gold-reference/bg/lib/` | 이미지 스톡 30장 (원자재) |
| `reference/gold-reference/fonts/` | Pretendard Bold/SemiBold/Regular |
| `reference/gold-reference/__pycache__/` | (참고) 기존 파이썬 렌더 흔적 — 로직 참고만, 새 빌드는 Node |

### 캐러셀 스펙 포맷 (carousel_NN.json)
```json
{
  "id": 1, "topic": "...", "thesis": "캐러셀 전체가 증명하는 한 문장",
  "images": ["black_powder(fine).png", "ink_on_skin.png", ...],
  "slides": [
    { "type": "cover_stmt", "image": "...", "lines": ["헤드라인", "..."] },
    { "type": "body", "image": "...", "mode": "C", "num": "01",
      "title": "번호+핵심 메시지(제목)",
      "segments": [ ["회색 부연 2~3문장", false], ["핵심 강조 문장", true] ] }
  ]
}
```
- `mode` = 비주얼 변형: **A**(디밍+비네팅) · **B**(블러) · **C**(헤더밴드+순흑) · **D**(순흑) · **E**(가운데 큰 숫자, 데이터 커버)
- `segments[i] = [텍스트, isHighlight]` — highlight=흰색+골드밑줄(인라인), 나머지=회색
- 길이 7~10장(커버1+본문5~8+마무리1)

---

## 2. 시스템 — 닫힌 학습 루프

```
[로컬 엔진] 생성(골드 캐러셀) ─push─► [Supabase] ◄──► [웹 콘솔·비공개링크]
     ▲ 학습 주입                 drafts/feedback/        오늘발행·소스·브랜드DNA·
     │                          learnings/sources        학습·캘린더·설정
     └── pull ◄── watch(Realtime) ◄────────────────────────┘
        피드백→distill→learnings 누적→다음 생성 주입 = 에이전트 업그레이드
```

---

## 3. 모듈 8개 (필요한 기능 전부 — 확정)

1. **콘텐츠 엔진** — 토픽 → 캐러셀 스펙(JSON) 생성(**= 플러그인 copywriter 에이전트, 구독 LLM · API 아님**) → PNG 렌더(모드 A~E) → 이미지 스톡 자동 배정. §4 상세.
2. **캡션 생성** — IG 캡션(더보기란: 설명+링크). `melanoir_ig_gold_captions.md` few-shot. 슬라이드엔 링크 금지, 캡션에만.
3. **브랜드·광고법 가드** — `BRAND_LOCKS`+`LEGAL_REVIEW` 강제. 레이어 분리(브랜드 선언에 제품 수치 귀속 금지), 용어 분리(N.D.=유해물질 전용 / 피부자극=자극지수), 성적서 비공개, 효능주장 금지. (brand-guardian carry-over)
4. **학습 루프** — 피드백 → distill → `learnings/`(AGENT_LEARNINGS 포맷) 누적 → 생성 주입(즉시) + 주기 distill 웹 승인.
5. **Supabase + 실시간** — 4테이블(drafts/feedback/sources/learnings) + Realtime publication + RLS + 로컬 watch.
6. **웹 콘솔 (6섹션)** — 오늘발행·소스·브랜드DNA·학습·캘린더·설정 (라이트, carry-over).
7. **발행 (2채널)** — ① **SNS 복붙**(사람 직접, 봇 의심 0) ② **웹사이트 발행**(인사이트 카드 → 클라 사이트 insights 페이지, 기존 구조 불변·additive, 자동). 캘린더/토픽 큐. **§4b 상세.**
8. **자산·인프라** — 이미지 스톡·폰트·골드레퍼런스 / 클라 로컬 / 클라 Supabase / 비공개 링크.

---

## 4. 콘텐츠 엔진 상세 (핵심 — 가장 어려움)

```
engine/
  generate.mjs     토픽 + brand-dna + learnings + 골드 few-shot → 캐러셀 스펙 JSON
  image-assign.mjs IMAGE_STOCK 규칙으로 슬라이드별 이미지 배정 (재사용≤2, 표지 비재사용, 의료가운 금지)
  render.mjs       스펙 + 이미지스톡 → PNG (모드 A~E = CSS, 텍스트 오버레이, 하단 스크림 강, 워드마크 상단)
  caption.mjs      캡션 생성
  guard.mjs        브랜드락·광고법 검수 (block/warn)
```

**렌더러 규칙 (AGENT_LEARNINGS + CONTENT_MODEL):**
- 텍스트 시작 Y 고정(스와이프 흔들림 금지), 워드마크 상단 고정.
- 본문 핵심 청크 = 흰색+골드밑줄 인라인(슬라이드당 1개). 회색 부연 60~110자.
- 배경 죽이기(모드별), 실사 컬러 유지(흑백 변환 금지), 하단 스크림으로 우하단 워터마크 차폐.
- 번호를 제목에 결합(인스타 카운터 아님). "→ URL" 화살표 금지.

**★ 검증 앵커 (사장님 룰 = 직접 실행):**
`render.mjs`로 **골드 스펙(carousel_01.json)을 렌더 → `reference/gold-reference/cards/carousel_01/`의 골드 카드와 비교.**
일치하면 렌더러 정확. 이게 엔진 검증의 기준점. (생성은 그다음, 골드를 few-shot으로.)

---

## 4b. 발행 — 2채널 (SNS 복붙 + 웹사이트)

생성물은 **두 곳**으로 나간다:

**① SNS 복붙 (사람 직접)**
웹 콘솔 오늘발행 → 채널별 [복사] → 클라가 플랫폼에 붙여넣기 + 카드 이미지 첨부 → 게시. 자동 발행 없음(봇 의심 0).

**② 웹사이트 발행 (자동, 매일)**
- **출력:** 인사이트 카드(PNG) + insights 페이지 항목(제목·요약·날짜·이미지). IG는 캐러셀, **웹은 단일 인사이트 카드/요약**(같은 토픽, 포맷만 다름).
- **타깃:** `Melanoir1/melanoir-recruitment` → `web/site/insights/` (정적 HTML). ⚠️ **기존 사이트 구조 절대 불변 — insights에 항목 추가만 (additive).**
- **카드 생성:** `insight-card.mjs`(carry-over 참고 — 사진+텍스트 오버레이) 또는 엔진 렌더 재사용.
- **발행 방식:** 로컬 생성 → `web/site/insights/`에 카드+항목 추가 → 커밋 → **직접 push** (권한 확보). 과거 `feat/insight-cards` 브랜치(로컬 대기였던 것) 이어가기.
- **자동:** 매일 토픽 1개 → 웹 인사이트 카드 + IG 캐러셀 동시 생성. 콘솔 오늘발행/캘린더에 웹 발행 상태 표시.

> ✅ **확정:** 타깃 `Melanoir1/melanoir-recruitment` `web/site/insights/` · **직접 push** · 과거 `feat/insight-cards` 브랜치 이어가기.

---

## 5. Supabase 스키마 + 실시간

4테이블: `drafts`(생성물) · `feedback`(잘됨/아쉬움+노트, 단일 입력) · `learnings`(누적 규칙) · `sources`(참고이미지·지침).
- Realtime: 테이블을 `supabase_realtime` publication에 추가 + RLS(anon 읽기+지정컬럼 update / service만 insert).
- `scripts/push-supabase.mjs`(carry-over) 전송 · `pull-supabase.mjs`(신규) Supabase→로컬 · `watch-supabase.mjs`(신규) Realtime 구독→pull+재생성 트리거.
- 키: service_role=`.env.local`(로컬), anon=웹 config.js(RLS 보호). PUBLIC 노출 금지.

상세 설계: `CARRY-OVER` 의 `SUPABASE-WEB-DESIGN.md` 참조.

---

## 6. 웹 콘솔 (carry-over 그대로)

`web-review/index.html` (라이트, 6섹션, 검증됨) 가져와 `web/`로. 피드백=**단일 입력**(잘된점/안된점 안 나눔). 데모는 fixture, 실서버는 Supabase.

---

## 7. 빌드 순서 (전부 한 번에, 권장 순서)

1. 스캐폴드 — `engine/ web/ supabase/ scripts/ assets/ learnings/ brand/`. 이미지스톡·폰트 → `assets/`(gitignore).
2. **렌더러** `render.mjs` → 골드 스펙 재현 + 골드 카드 비교 검증. (엔진 정확성 앵커)
3. **생성** `generate.mjs` → 토픽→스펙 (골드 few-shot + learnings 주입) + image-assign + guard + caption.
4. **Supabase** schema 적용(프로젝트 필요) + push 검증.
5. **웹** 콘솔 carry-over + 4테이블 연동.
6. **발행** — ① SNS 복붙(콘솔 [복사]) ② **웹사이트 발행**(인사이트 카드→사이트 insights, additive, 커밋/PR). §4b.
7. **실시간** pull + watch.
8. **학습 루프** 피드백→distill→learnings→generate 주입.
9. **E2E 검증** — 직접 실행, 골드 대비 품질 + 웹/IG 발행까지.

---

## 8. 절대 규칙

- **품질 = 골드 레퍼런스.** 항상 `reference/` 대조. 추측·날림 금지.
- **브랜드락·광고법** (`BRAND_LOCKS`/`LEGAL_REVIEW`): 필수 항목 All N.D.(28종 X) · @melanoir_official · 레이어 분리 · 성적서 비공개 · 효능주장 금지 · 용어 분리.
- **보안:** service_role 키 로컬만, PUBLIC 레포 금지. 클라 민감데이터 커밋 금지.
- **검증 룰(사장님):** "코드만 보지 말고 직접 실행해서 완벽 구동 확인." 렌더는 골드 카드 대조, 전송/실시간은 실제 Supabase 라운드트립.
- 새 빌드라 §0 동결은 없음(자유). 단 골드 품질·브랜드락은 동결.

---

## 9. 가져올 것 / 버릴 것
→ `CARRY-OVER.md` (검증된 carry-over 파일의 정확한 경로 + 버릴 레거시 목록).
