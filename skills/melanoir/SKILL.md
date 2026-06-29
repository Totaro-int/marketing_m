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

## 하루 사이클 ("멜라누아 카드 만들어" / "오늘 콘텐츠")
1. `node scripts/pull-supabase.mjs` → 피드백 있으면 `node scripts/distill.mjs` (학습 반영).
2. 토픽: `node scripts/topic-queue.mjs`(자동) 또는 사용자 지정.
3. `node engine/generate.mjs --brief <topic>` → `out/brief_NN.json`.
4. **`melanoir-copywriter` 에이전트** → `out/spec_NN.json` → `node engine/generate.mjs --finalize out/spec_NN.json`(이미지·캡션·가드).
5. (canvas시) `node engine/render.mjs out/final_NN.json --out out` → 카드 PNG. 없으면 웹 편집기.
6. 채널: `node engine/channels.mjs --brief <topic>` → **`melanoir-channel-copywriter` 에이전트** → `out/channels_NN.json` → `--finalize`(채널별 가드 + 🖼 이미지 배치 큐).
7. 휴먼 게이트 후 발행: `push-supabase`(IG+spec) · `push-channels`(채널) · (canvas시) `upload-bg`·`publish-insight`.
   - **자사몰 인사이트 자동 발행 + 색인**: `.env.local`의 `MELANOIR_SITE_REPO`(자사몰 레포 insights 경로) 설정 시, publish-insight가 **GEO/SEO 정적 아티클**(텍스트 본문 + JSON-LD + sitemap + llms.txt)을 만들어 **자사몰 레포에 git commit+push → melanoir.co.kr/insights 자동 배포** + **IndexNow로 네이버·Bing·ChatGPT 즉시 색인 통보**(소유자 쓰기 권한 머신). 미설정이면 로컬 스테이징만.
   - **색인 마무리(`/totaro-seo`)**: 발행 직후 **`/totaro-seo` 스킬을 실행**해 새 인사이트 URL(`melanoir.co.kr/insights/<날짜>`)을 **Google Search Console·네이버 서치어드바이저에 색인 요청**한다(1회 등록 후 자동 크롤). 즉 `/melanoir` = 5채널 생성·발행 + 자사몰 발행 + (IndexNow 즉시 + totaro-seo) **색인까지** 한 흐름.

## 검토·복붙 (클라이언트)
- **콘솔** `melanoir-console.vercel.app` — 캠페인별 5채널, 본문 복사, 🖼 이미지 배치.
- IG **카드 편집** `/cards?slug=`(배경 교체·텍스트·PNG) · 네이버 **블로그 미리보기** `/blog?slug=`.

## 절대 기준
- **품질 = `reference/` 골드.** guard(`engine/guard.mjs`) 통과 필수. 직접 실행 검증(렌더 골드 대조·Supabase 라운드트립).
- **브랜드락:** 필수 항목 All N.D.(28종 X) · @melanoir_official · 레이어 분리 · 용어 분리(검출/N.D.=유해물질 전용) · 성적서 비공개 · 효능주장·'안전하다' 단독 금지.
- 상세: `BUILD-SPEC.md` · `README.md` · `reference/CAROUSEL_CONTENT_MODEL.md` · `reference/BRAND_LOCKS.md`.
