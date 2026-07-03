---
name: melanoir
description: 멜라누아 5채널(IG·LinkedIn·Threads·네이버블로그·자사몰 인사이트)을 골드 품질로 생성→콘솔 검토→학습. 명령 하나 `/melanoir`로 실행(인자 없으면 오늘 자동 토픽, `/melanoir 6`·`/melanoir 카드`로 지정). "오늘 콘텐츠"로도 트리거.
---

# 멜라누아 스튜디오 엔진

멜라누아 콘텐츠를 **골드 품질로 생성 → 콘솔 검토 → 학습**하는 Cowork/Claude Code 스킬. 구동 = **구독**(Anthropic API 키 불요) — 카피는 `melanoir-copywriter`·`melanoir-channel-copywriter` 서브에이전트가 쓴다. 산출물 = **IG 캐러셀 + LinkedIn + Threads + 네이버블로그 + 자사몰 인사이트(5)**.

## 실행 — 명령 하나 `/melanoir`
작업 폴더 = `melanoir-studio` 레포를 연 상태에서 **`/melanoir`** 한 줄이면 끝. 인자(ARGUMENTS)로 변형:
- **인자 없음** → 오늘 자동 토픽으로 **5채널 전체** (아래 하루 사이클 1~7 실행).
- **숫자**(`/melanoir 6`) → 그 토픽 id로. · **토픽 문구**(`/melanoir 97% 세포생존율`) → 그 주제로.
- **`카드`**(`/melanoir 카드`) → IG 카드만. · **`다음`** → 다음 토픽만 알려줌.
- (슬래시가 없는 환경이면 "오늘 콘텐츠"/"멜라누아 카드 만들어"로도 동일 실행.)

## 운영 (Cowork / Claude Code) — 먼저 읽기
- 이 스킬은 **클론된 엔진 레포에서** 동작한다. **작업 폴더 = `melanoir-studio` 레포 루트**(Totaro-int/marketing_m)로 열 것. 스크립트는 cwd 기준 실행(절대경로 권장).
- 새 기기/첫 실행: **`npm run doctor`** 로 준비 점검(node·키·Supabase·폰트). ✓ 면 진행.
- **오류 시 자가수정 루프**: 설치/실행 오류가 나면 **`docs/RUNBOOK.md`** 에서 출력의 `[CODE]`·증상을 찾아 지침대로 고치고 재시도하라(doctor → ✗ → RUNBOOK → 수정 → 재실행, 전부 ✓ 까지 반복). 2회 시도 후에도 안 풀리면 사람에게 보고.
- `canvas`(서버 렌더)는 선택 — 없으면 IG 카드는 **웹 카드 편집기**가 렌더(생성·발행엔 지장 없음).

## 스토리 발굴 (기획) — "다음에 뭘 쓸까" / `/melanoir 피칭`
기존 고정 토픽 10개를 넘어 **새 앵글을 발굴**하는 상류 기획. `/melanoir-pitch [N]`(상세 = commands/melanoir-pitch.md):
1. `node engine/pitch.mjs --brief --n 5` → pbrief(기존 토픽 포함 — 중복 회피). 2. **melanoir-journalist** 디스패치 → `out/pitches.json`(앵글 5개, WebSearch로 시의성 탐색). 3. `node engine/pitch.mjs --score out/pitches.json` — 중복·브랜드락·근거실현성 자동 채점. 4. 사람이 `node scripts/pitch-review.mjs --list`로 보고 `--approve <n>`로 토픽 큐 편입 → `/melanoir-story <새id>`로 집필. 취재 성능은 `node scripts/research-scorecard.mjs`(승인율·원출처 도달률·인용 완결성)로 상시 추적.

## 원천 콘텐츠 (장문) — "브랜드 스토리 써줘" / "과학 기사 써줘" / `/melanoir 스토리`
5채널 상류의 **작가·기자 레이어**. `/melanoir-story <토픽|주제> [essay|feature|column|press]` 실행(상세 = commands/melanoir-story.md):
1. `node engine/story.mjs --brief <topic> [--style s]` → sbrief. 2. 출력의 `agent=` 대로 **melanoir-storyteller**(essay·campaign) 또는 **melanoir-journalist**(feature·column·press) 서브에이전트 디스패치 → `out/dossier_NN.json`. 3. `node engine/story.mjs --finalize out/dossier_NN.json` — 브랜드락+**인용락**(근거 없는 수치 차단)+도식(figure.mjs SVG). PENDING이면 `node scripts/fact-candidates.mjs --submit` → 사람 승인 → `--pull` → 재작성·재finalize. 4. `node scripts/push-article.mjs out/final_article_NN.json` → 콘솔 검토·승인. 승인된 도시어는 하루 사이클 2단계가 자동 주입(`--dossier`)해 5채널의 원천이 된다.

## 하루 사이클 ("멜라누아 카드 만들어" / "오늘 콘텐츠")
1. `node scripts/pull-supabase.mjs` → 피드백 있으면 `node scripts/distill.mjs` (학습 반영).
2. 토픽: `node scripts/topic-queue.mjs`(자동) 또는 사용자 지정.
3. `node engine/generate.mjs --brief <topic>` → `out/brief_NN.json`.
4. **`melanoir-copywriter` 에이전트** → `out/spec_NN.json` → `node engine/generate.mjs --finalize out/spec_NN.json`(이미지·캡션·가드).
5. (canvas시) `node engine/render.mjs out/final_NN.json --out out` → 카드 PNG. 없으면 웹 편집기.
6. 채널: `node engine/channels.mjs --brief <topic>` → **`melanoir-channel-copywriter` 에이전트** → `out/channels_NN.json` → `--finalize`(채널별 가드 + 🖼 이미지 배치 큐).
7. 휴먼 게이트 후 발행: `push-supabase`(IG+spec) · `push-channels`(채널) · (canvas시) `upload-bg`·`publish-insight`.
   - **자사몰 인사이트 자동 발행 + 색인**: `.env.local`의 `MELANOIR_SITE_REPO`(자사몰 레포 insights 경로) 설정 시, publish-insight가 **GEO/SEO 정적 아티클**(텍스트 본문 + JSON-LD + sitemap + llms.txt)을 만들어 **자사몰 레포에 git commit+push → melanoir.co.kr/insights 자동 배포** + **IndexNow로 네이버·Bing·ChatGPT 즉시 색인 통보**(소유자 쓰기 권한 머신). 미설정이면 로컬 스테이징만.
   - **색인은 내장·자동**: 발행(--push) 성공 시 색인기(`engine/seo.mjs` · = `npm run seo:index`)가 자동으로 **IndexNow 즉시 색인 통보**(네이버 서치어드바이저·Bing·Yandex·ChatGPT)를 보내고 sitemap.xml·llms.txt·IndexNow 키파일을 유지한다. **인증키·외부 스킬 불요**(예전 `/totaro-seo` 참조는 폐기 — 이 로직이 패키지에 내장됨). 재통보가 필요하면 `npm run seo:index` 단독 실행. 즉 `/melanoir` = 5채널 생성·발행 + 자사몰 발행 + **색인(IndexNow 즉시)** 까지 한 흐름.
   - **구글·네이버 콘솔은 1회만(소유자 수동)**: 구글은 공식 즉시색인 API가 없어 **sitemap 자동 크롤**로 색인된다. 최초 1회 **Google Search Console·네이버 서치어드바이저 사이트 소유확인**(소유자 계정 로그인 필요 — 패키지 자동화 대상 아님)만 하면 이후 자동. (RUNBOOK `[SEO]` 참고)

## 검토·복붙 (클라이언트)
- **콘솔** `melanoir-console.vercel.app` — 캠페인별 5채널, 본문 복사, 🖼 이미지 배치.
- IG **카드 편집** `/cards?slug=`(배경 교체·텍스트·PNG) · 네이버 **블로그 미리보기** `/blog?slug=`.

## 절대 기준
- **품질 = `reference/` 골드.** guard(`engine/guard.mjs`) 통과 필수. 직접 실행 검증(렌더 골드 대조·Supabase 라운드트립).
- **브랜드락:** 필수 항목 All N.D.(28종 X) · @melanoir_official · 레이어 분리 · 용어 분리(검출/N.D.=유해물질 전용) · 성적서 비공개 · 효능주장·'안전하다' 단독 금지.
- 상세: `BUILD-SPEC.md` · `README.md` · `reference/CAROUSEL_CONTENT_MODEL.md` · `reference/BRAND_LOCKS.md`.
