---
name: melanoir-queue
description: 콘솔 요청 큐(content_requests) 처리기 — 사용자가 콘솔에서 [오늘의 컨텐츠 발행하기](generate) 또는 [채널 파생](derive)을 누르면 쌓이는 요청을 읽어, copywriter 서브에이전트로 gold 생성/파생 → finalize·가드 → push(Supabase). 사용자 액션은 버튼 하나로 최소화. 수동 1회 실행 또는 스케줄 routine으로 무인 가동.
---

# /melanoir-queue `[--once] [--max N] [--dry-run]`

콘솔 요청 큐를 gold 품질로 처리한다. **카피 = melanoir-copywriter / melanoir-channel-copywriter 서브에이전트(구독 LLM, API 불요).** cwd = melanoir-studio 루트.

전제: `supabase/content_requests.sql` 적용 완료(테이블 존재), `.env.local`에 `SUPABASE_URL`+`SUPABASE_SERVICE_KEY`.

## 실행 흐름

### 0. 환경 확인
`.env.local` 없으면 중단(큐는 Supabase 필요). `--dry-run`이면 큐만 읽고 처리 없이 요약 출력.

### 1. 큐 읽기 (오래된 순, 기본 최대 --max 3건)
```
GET {SUPABASE_URL}/rest/v1/content_requests?status=eq.queued&order=requested_at.asc&limit={max}
  헤더: apikey/Authorization = SERVICE_KEY
```
0건이면 "처리할 요청 없음" 출력 후 종료.

### 2. 각 요청 claim (동시 실행 안전)
```
PATCH content_requests?id=eq.{id}&status=eq.queued   body: {status:'running', started_at: now}
  (Prefer: return=representation — 0행 반환이면 다른 처리기가 선점 → 건너뜀)
```

### 3. type 별 처리

#### type = generate  (새 캠페인)
1. `node scripts/pull-supabase.mjs` → 피드백 있으면 `node scripts/distill.mjs` (학습 반영).
2. `/melanoir-daily "<topic>" --push` 흐름을 그대로 수행:
   - topic 이 비면 `node scripts/topic-queue.mjs` 자동 선택.
   - `node engine/generate.mjs --brief "<topic>"` → brief → **melanoir-copywriter 서브에이전트**가 `out/spec_NN.json`(IG 캐러셀) 작성.
   - 채널 카피: `engine/channels.mjs buildChannelBrief` → **melanoir-channel-copywriter 서브에이전트**가 linkedin/threads/naver-blog 작성 → `finalizeChannels`.
   - 인사이트 카드: `node engine/insight-card.mjs`.
   - 가드: `node engine/guard.mjs` (block 있으면 status='error', 사유 기록, push 중단).
   - `node scripts/push-supabase.mjs` (service_role upsert).
3. `result_slug` = 생성된 campaign_slug.

#### type = derive  (칼럼 허브 모델: IG 앵글 → 칼럼 → 나머지 컷)
파생은 "짧은 IG를 여러 롱폼으로 각자 팽창"하지 않는다. 팽창은 논지를 흐리고 군더더기(메타 안내 등)를 부른다.
대신 **가장 완전한 본문 = 자사몰 칼럼(insight)을 허브로 한 번만 정성껏 확장**하고, 나머지 채널은 그 칼럼을 **압축·리프레임**한다.

1. 원본 로드: `GET marketing_drafts?campaign_slug=eq.{source_slug}&channel=eq.instagram&select=title,body,hashtags,spec,image_urls`
   → IG 캡션·카드 스펙(spec.slides)을 **앵글/thesis 소스**(무엇을 말할지)로 사용.

2. **Phase 1 — 칼럼(허브) 먼저**: `insight` 를 자기완결 칼럼으로 작성 —
   제목 + 리드 2~3문장 + `■` 소제목 3~4섹션(각 2~4문장) + 마무리(리프레임/질문), 공백 포함 1000~1500자, 자사몰 GEO/SEO 톤.
   근거·논거를 여기서 완비한다(이 한 번만 확장). 숫자 날조 금지(자가품질검사·All N.D.·측정된 결과 프레임 + 'melanoir.co.kr에서 확인').
   ⚠ **메타 안내 금지**("이 글에서 풀어봅니다/다음 글에서/지금부터 살펴보겠습니다" 류). 뒤에 올 본문 전제 금지.
   - channels 에 insight 가 없어도, 다른 롱폼 품질을 위해 칼럼을 **내부 허브로 먼저 생성**(저장은 요청된 채널만).

3. **Phase 2 — 칼럼에서 컷 파생(압축·리프레임)**: 요청된 나머지 채널을 **칼럼 본문을 소스로**(IG 아님) 작성:
   - `naver-blog`: 칼럼을 **검색 의도로 리프레임**(제목·도입·키워드 재구성, 정보형·친절, 🖼 이미지 큐 2~3). 칼럼 복붙 금지 — 검색용 번역본.
   - `linkedin`: 칼럼의 **B2B/산업 컷**(전문성·인사이트, 마지막 질문).
   - `threads`: 칼럼의 **대화형 훅 컷**(짧은 관점·후킹).
   각 채널 톤/길이 규칙(brand/channels.json) 준수 → `finalizeChannels`.

4. 가드 통과분만 `campaign_slug = source_slug` 로 upsert(채널별 행 추가). instagram 원본은 **미변경**(화이트리스트에서 제외).
   - 인사이트 카드 PNG는 별도 렌더: `node engine/insight-card.mjs` → Storage(service_role) → `image_urls`(텍스트 칼럼과 분리, 없어도 콘솔은 텍스트 노출).
5. `result_slug` = source_slug.

### 4. 완료 기록
```
PATCH content_requests?id=eq.{id}   body: {status:'done'|'error', error?, result_slug?, finished_at: now}
```
성공/실패를 사용자에게 요약 출력(요청별 채널·상태). `--max` 만큼 반복 후 종료.

## 무인 가동 (사용자 액션 최소)
Claude Code 스케줄 routine으로 등록해 주기적으로 큐를 비운다. 예(개념):
```
/schedule  이름="melanoir-queue" 주기="*/15 * * * *"  실행="/melanoir-queue --once --max 3"
```
→ 콘솔에서 버튼만 누르면(요청 INSERT), 15분 내 routine이 gold 생성/파생 후 콘솔에 반영. 크레딧은 실제 생성 시에만 소모.

## 가드레일
- brand-lock/광고법 guard 통과분만 push. 스켈레톤(카피 미작성) 상태로는 push 금지.
- derive 는 원본 IG 행을 변경하지 않는다(추가만).
- 동일 (campaign_slug, channel) 은 upsert 키 → 재파생 시 해당 채널만 갱신.
- **길이 하드플로어**: brand/channels.json 의 lengthChars 하한은 반드시 넘겨라(가드가 미달을 반려함). 컷 프롬프트에 최소 글자수를 명시하고, 미달 시 문장을 더 채워 재생성.
- **blog ≈ 병렬 롱폼(압축 아님)**: naver-blog(1000~2000)는 칼럼을 "압축"하는 게 아니라 **칼럼급 길이로 검색 의도 리프레임**한다. 따라서 허브 칼럼은 하한이 아니라 **상단(1400~1600자)** 을 target 해, 블로그가 충분한 소재를 갖게 한다(칼럼이 얇으면 blog 미달 발생).
- guard 체크(정규식 예): 메타 안내 `이 글에서|다음 글에서|살펴보겠습니다|풀어봅니다`, 금칙 `100\s*%|효능|성적서`, 길이·소제목(■)·해시태그 개수, 블로그 제목≠칼럼 제목(복붙 방지).
