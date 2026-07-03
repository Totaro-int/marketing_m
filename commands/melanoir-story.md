---
name: melanoir-story
description: 멜라누아 원천 콘텐츠(장문) 생성 — 브랜드 스토리(essay)·과학 기사(feature)·칼럼(column)·보도자료(press). sbrief → 작가/기자 서브에이전트(구독 LLM) 집필 → finalize(브랜드락+인용락+도식) → 콘솔 push. 승인된 도시어는 /melanoir-daily 파생의 원천이 된다. 인자=토픽 id(1~10) 또는 자유 주제 문자열 [+ 스타일].
---

# /melanoir-story `<topicId|"주제"> [essay|feature|column|press]`

멜라누아 장문 원천 콘텐츠 1건을 생성한다. **집필 = melanoir-storyteller(essay·campaign) / melanoir-journalist(feature·column·press) 서브에이전트 (Claude Code 구독, Anthropic API 아님).** cwd = melanoir-studio 프로젝트 루트. 스타일 생략 시 토픽 레이어로 자동(데이터→feature, 그 외→essay).

## 실행 흐름

0. **(최초 1회) 스키마 확인**: `node scripts/fact-candidates.mjs --list` 실행이 `fact_candidates` 테이블 없음 오류(42P01/404)를 내면 → `node scripts/apply-schema.mjs` (멱등 — v3 fact_candidates 포함) 후 재시도.

1. **sbrief 작성** (LLM 없음): `node engine/story.mjs --brief <topic> [--style s] [--stance]`
   → `out/sbrief_NN.json` (주제·thesis·구조템플릿·facts·verified-sources·writer-locks·골드 few-shot·outputPath).
   column은 `--style column`(= feature + stance 모드).

2. **작가/기자 디스패치**: sbrief 출력의 `agent=` 를 보고 해당 서브에이전트를 Task 도구로 실행. 프롬프트:
   > `out/sbrief_NN.json`을 읽고, 지침대로 골드 품질 장문 도시어를 sbrief의 outputPath(`out/dossier_NN.json`)에 JSON으로 써라.
   기자(feature·press)는 필요 시 WebSearch 취재 — **새 사실은 pendingFacts로만**(본문 직접 사용 금지).

3. **finalize** (LLM 없음): `node engine/story.mjs --finalize out/dossier_NN.json`
   - **BLOCKED(exit 1)** → 위반 항목을 에이전트에 알리고 2단계 재작성.
   - **PENDING(exit 3)** → 미승인 사실 후보 있음: `node scripts/fact-candidates.mjs --submit out/dossier_NN.json` 로 제출 → 사람에게 보고(콘솔 '사실 검증' 또는 `--approve <id>` 로 승인) → 승인 후 `--pull` → 에이전트가 ⟦후보⟧ 마커를 VS-id 인용으로 교체 → 재-finalize. **승인 전 발행 절대 불가.**
   - OK → `out/final_article_NN.json` + `out/article_NN.md` + `out/figures/NN-*.svg`.

4. **미리보기**: `out/article_NN.md`를 Read로 확인(품질·락 육안 점검). 도식 SVG도 확인.

5. **push**: `node scripts/push-article.mjs out/final_article_NN.json`
   → 콘솔(channel=article)에서 검토·수정·**승인(approved)**. 승인돼야 파생·발행이 열린다.

## 승인 후 활용 (사람이 승인한 뒤)
- **5채널 파생**: `node engine/generate.mjs --brief <topic> --dossier out/final_article_NN.json` (+ `node engine/channels.mjs --brief <topic> --dossier ...`) → 이후 /melanoir-daily 4~7단계와 동일. 승인 여부 확인: `node engine/story.mjs --check <topicId>`.
- **인사이트 장문 발행**: publish-insight 경로에 dossier를 넘기면 참고 문헌·JSON-LD citation·inline 도식이 포함된 정적 아티클이 생성된다.

## 규칙
- **품질 = 골드.** guard(브랜드락)+인용락 통과 필수. 스켈레톤(`--offline`)은 테스트 전용 — 발행 금지.
- essay = 브랜드 1인칭("우리는"), 제품 수치 금지. feature = 3인칭 저널리즘, 모든 수치에 근거 id.
- 외부 이미지는 brand/image-policy.json 화이트리스트만. 도식은 figures 스펙 → figure.mjs 렌더.
