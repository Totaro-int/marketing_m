---
name: melanoir-daily
description: 멜라누아 하루 사이클 — 피드백 pull→distill → 토픽 1개 → 5채널(IG 캐러셀·LinkedIn·Threads·naver-blog) + 자사몰 인사이트 카드를 copywriter 에이전트로 골드 생성 → finalize·가드 → 렌더 → 휴먼 게이트 → push(Supabase 콘솔). 매일 1건, 전 채널.
---

# /melanoir-daily `[<topicId|"토픽">] [--push]`

닫힌 학습 루프 하루 사이클. **카피 = melanoir-copywriter 서브에이전트(구독 LLM, API 불요).** cwd = melanoir-studio 루트.

## 실행 흐름

### 0. 환경
`.env.local` 확인. 없으면 Supabase 단계는 graceful skip(로컬 단독). 토픽 미지정 시 캘린더/큐에서 오늘 토픽 1개 선택(또는 사용자에게 질문).

### 1. pull → distill (학습 반영)
`node scripts/pull-supabase.mjs` → 피드백이 있으면 `node scripts/distill.mjs`.
→ `learnings/01-distilled.md` 갱신 → 다음 brief에 자동 주입(즉시 학습).

### 2. brief
`node engine/generate.mjs --brief <topic>` → `out/brief_NN.json`.

### 3. copywriter 디스패치 (핵심)
`melanoir-copywriter` 서브에이전트를 Task 도구로 실행 — `out/brief_NN.json` 읽고 `out/spec_NN.json` 작성. **Anthropic API 아님, 구독.**

### 4. finalize
`node engine/generate.mjs --finalize out/spec_NN.json` → 이미지배정+캡션+가드.
- **guard BLOCKED → 발행 중단.** 위반을 copywriter에 전달해 3단계 재작성(최대 1회). 통과까지.

### 5. render (IG 캐러셀)
`node engine/render.mjs out/final_NN.json --out out` → `out/carousel_NN/s*.png`. 골드 카드 대비 육안 확인.

### 5b. 채널 카피 (LinkedIn·Threads·naver-blog) — 같은 thesis 파생
1. `node engine/channels.mjs --brief <topic>` → `out/chbrief_NN.json`.
2. **`melanoir-channel-copywriter` 서브에이전트를 Task로 디스패치** — chbrief 읽고 `out/channels_NN.json` 작성(채널 최적화, 구독 LLM).
3. `node engine/channels.mjs --finalize out/channels_NN.json` → 채널별 guard. **BLOCKED → 재작성(최대 1회).**
> IG 캐러셀 + 자사몰 인사이트 + LinkedIn + Threads + naver-blog = **5 산출물**. 5채널 모두 골드·guard 통과 필수.

### 6. 휴먼 게이트
5 산출물(카드 PNG·캡션·채널 카피) 미리보기. `--push` 없으면 여기서 정지(검토만).
```
이 캐러셀로 발행할까요?  [Y] push  [N] 검토만(수정은 다시 생성)
```

### 7. 발행 (승인 + --push) — 같은 campaign_slug 로 묶음
- IG(복붙용): `node scripts/push-supabase.mjs out/final_NN.json --cards out/carousel_NN --slug <slug>` (spec 포함 → 웹 카드 편집기)
- 카드 편집기 기본 배경: `node scripts/upload-bg.mjs out/final_NN.json` (배경은 콘솔 `cards.html` 에서 클라가 교체)
- 채널: `node scripts/push-channels.mjs out/channels_NN.json --slug <slug>` → LinkedIn·Threads·naver-blog 행.
  → 콘솔(비공개 링크) 오늘발행에 5채널 표시. [복사]→플랫폼 붙여넣기(자동 발행 없음, 봇 의심 0).
- 자사몰 인사이트: `node scripts/publish-insight.mjs out/final_NN.json` (사이트 insights additive; 권한 있으면 push).

### 8. 완료
콘솔에서 검토·복붙. 피드백은 다음날 1단계 pull→distill로 학습.

## 규칙
- **품질 = 골드.** guard 통과 필수. 스켈레톤 발행 금지 — 반드시 copywriter 에이전트.
- **직접 실행 검증**(렌더 골드 대조, Supabase 라운드트립). 코드만 보지 말 것.
- service_role 키 로컬만. 슬라이드에 링크·"→URL" 금지(캡션만).
