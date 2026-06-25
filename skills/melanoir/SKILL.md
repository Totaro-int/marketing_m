---
name: melanoir
description: 멜라누아 IG 카드뉴스·5채널(LinkedIn·Threads·네이버블로그)+자사몰 인사이트를 골드 품질로 생성→콘솔 검토→학습. "멜라누아 카드 만들어", "오늘 콘텐츠", "인스타 카드뉴스 발행", "반영구 색소 콘텐츠" 요청에 사용.
---

# 멜라누아 스튜디오 엔진

멜라누아 IG 캐러셀을 **골드 스탠다드 품질로 생성→검토→학습**하는 Claude Code 플러그인. 구동은 **구독**(Anthropic API 키 불요): 카피는 `melanoir-copywriter` 서브에이전트가 쓴다.

## 빠른 사용
- 캐러셀 1건: **`/melanoir-new <topicId|"토픽">`**
- 하루 사이클(학습+발행): **`/melanoir-daily <topic> [--push]`**

## 파이프라인 (cwd = 프로젝트 루트)
1. `node engine/generate.mjs --brief <topic>` → `out/brief_NN.json` (LLM 없음).
2. **`melanoir-copywriter` 에이전트**가 brief 읽고 `out/spec_NN.json` 작성 (구독 LLM).
3. `node engine/generate.mjs --finalize out/spec_NN.json` → 이미지배정+캡션+가드 → `out/final_NN.json`.
4. `node engine/render.mjs out/final_NN.json --out out` → 카드 PNG (골드 대조 = `node scripts/verify-render.mjs`).
5. 발행: `scripts/push-supabase.mjs`(콘솔) · `scripts/publish-insight.mjs`(웹).

## 절대 기준
- **품질 = `reference/` 골드.** 추측 금지, 항상 대조. guard(`engine/guard.mjs`) 통과 필수.
- **브랜드락:** 필수 항목 All N.D.(28종 X) · @melanoir_official · 레이어 분리 · 용어 분리(검출/N.D.=유해물질 전용) · 성적서 비공개 · 효능주장 금지 · '안전하다' 단독 금지.
- **직접 실행 검증:** 코드만 보지 말고 렌더→골드 대조, Supabase 라운드트립.
- 상세: `BUILD-SPEC.md`(§0 정정: 플러그인·구독), `reference/CAROUSEL_CONTENT_MODEL.md`, `reference/BRAND_LOCKS.md`.

## 결정론 스크립트 (LLM 없음)
render · guard · image-assign · caption · push/pull/watch-supabase · distill · publish-insight · daily(오프라인 스모크) · verify-*. 전부 `npm run verify`로 검증.
