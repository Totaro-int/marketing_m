---
name: melanoir-pitch
description: 멜라누아 스토리 앵글 발굴(기획). 기자 에이전트가 다음 달 다룰 만한 새 스토리 앵글 N개를 피칭 → 결정론 채점(중복·브랜드락·근거실현성) → 사람 승인 시 토픽 큐 편입 → /melanoir-story 로 집필. 기존 고정 토픽 10개를 넘어 "무엇을 쓸지"를 발굴하는 상류 단계.
---

# /melanoir-pitch `[N]`

멜라누아가 다룰 새 스토리 앵글을 발굴한다. **기획 = melanoir-journalist 서브에이전트(구독 LLM).** cwd = melanoir-studio 루트. N=앵글 수(기본 5).

## 실행 흐름

1. **pbrief 작성** (LLM 없음): `node engine/pitch.mjs --brief --n 5`
   → `out/pbrief.json` (브랜드 DNA + facts + **기존 토픽 목록**(중복 회피용) + 피칭 규칙 + writer-locks).

2. **기자 디스패치**: `melanoir-journalist` 서브에이전트를 Task로 실행. 프롬프트:
   > `out/pbrief.json`을 읽고, 지침대로 스토리 앵글 5개를 pitchSchema 형식으로 `out/pitches.json`에 Write하라. 필요하면 WebSearch로 업계·과학·규제 동향을 탐색해 시의성 있는 앵글을 발굴(취재까지는 불요 — 계획만).
   각 앵글 = `{ title, style(essay|feature|column), thesis, whyNow, researchPlan, brandFit }`.

3. **채점** (LLM 없음): `node engine/pitch.mjs --score out/pitches.json`
   → 중복(기존 토픽 재포장)·브랜드락 위험어·근거 구체성(기관·규정·저널 명시)·시의성 자동 채점. ⚠ 표시 앵글은 재피칭 또는 반려.

4. **검토·편입** (사람): `node scripts/pitch-review.mjs --list` 로 채점과 함께 보고 → 좋은 앵글을 `node scripts/pitch-review.mjs --approve <n>` 로 **토픽 큐에 편입**(brand-dna.json topics 에 새 id, source='pitch').

5. **집필**: 편입된 토픽 id로 `/melanoir-story <새id>` → 기자가 researchPlan대로 취재(WebSearch) → pendingFacts 제출 → 인용락 → 콘솔 승인. 이후는 기존 흐름과 동일.

## 성능 추적
- 취재 품질 상시 지표: `node scripts/research-scorecard.mjs` — 승인율·원출처 도달률·인용 완결성·병합 반영률. 콘솔 fact_candidates 데이터가 쌓일수록 발굴 성능이 수치로 보인다.
- 채택률(피칭 → 실제 발행) = 편입된 pitch 토픽 중 승인된 도시어 비율. 기획 발굴의 최종 성능 지표.

## 규칙
- 기존 토픽 재포장·브랜드락 충돌·막연한 출처("인터넷 자료") 앵글은 채점에서 감점 → 편입 금지.
- 편입은 **사람의 결정**. 에이전트가 topics를 자동 수정하지 않는다.
