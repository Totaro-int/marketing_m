---
name: melanoir-new
description: 토픽 1개로 멜라누아 IG 캐러셀 생성. brief → melanoir-copywriter 에이전트(구독 LLM)가 카피 작성 → finalize(이미지배정+캡션+가드) → 렌더 → 골드 대조. push 없음(검토용). 인자=토픽 id(1~10) 또는 자유 토픽 문자열.
---

# /melanoir-new `<topicId|"토픽">`

멜라누아 캐러셀 1건을 골드 스탠다드로 생성한다. **카피 = melanoir-copywriter 서브에이전트(Claude Code 구독, Anthropic API 아님).** cwd = melanoir-studio 프로젝트 루트.

## 실행 흐름

1. **brief 작성** (LLM 없음): `node engine/generate.mjs --brief <topic>`
   → `out/brief_NN.json` (토픽·thesis·레이어·facts·브랜드락·톤·콘텐츠모델·골드 few-shot·outputPath).

2. **copywriter 디스패치**: `melanoir-copywriter` 서브에이전트를 Task 도구로 실행한다. 프롬프트로 brief 경로를 준다:
   > `out/brief_NN.json`을 읽고, 지침대로 골드 품질 캐러셀 스펙을 brief의 outputPath(`out/spec_NN.json`)에 JSON으로 써라.
   에이전트가 spec JSON을 작성한다.

3. **finalize** (LLM 없음): `node engine/generate.mjs --finalize out/spec_NN.json`
   → 이미지 배정 + (없으면)캡션 + 가드. **guard BLOCKED 이면 중단** → 위반 항목을 copywriter에 알리고 2단계 재작성. → `out/final_NN.json`.

4. **렌더**: `node engine/render.mjs out/final_NN.json --out out` → `out/carousel_NN/s*.png`.

5. **미리보기**: 카드 PNG들을 Read로 띄워 골드 품질·브랜드락 육안 확인. 캡션 출력.

## 규칙
- **품질 = 골드.** guard 통과 필수. 스켈레톤(`--offline`)은 테스트 전용 — 발행 금지.
- **코드만 보지 말고 직접 실행**해서 확인(렌더는 골드 카드 대조).
- 발행하려면 `/melanoir-daily <topic> --push` 또는 `node scripts/push-supabase.mjs out/final_NN.json --cards out/carousel_NN`.
