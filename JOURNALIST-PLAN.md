# JOURNALIST-PLAN — 작가·기자 에이전트 (상류 원천 콘텐츠) 구축 계획

> 목적: 멜라누아 브랜드 스토리·과학 기사를 **상업 작가 + 과학 저널리스트 수준**으로 쓰는 **상류 원천 콘텐츠 레이어**.
> 기존 파이프라인(brief → copywriter → guard → render → 콘솔 → 학습)은 포맷 실행에 강하고, 이 레이어는 그 앞단에서 **리서치·취재·서사**를 공급한다.
> 역할은 2에이전트로 분리: **melanoir-storyteller(작가 — 브랜드가 말한다)** + **melanoir-journalist(기자 — 브랜드에 대해 쓴다)**. 보이스 혼합 방지가 분리 이유.

---

## 1. 포지션 — 기존 파이프라인과의 관계

```
[신규 상류]                                      [기존 하류 — 변경 최소]
/melanoir-story ─→ story.mjs --brief ─→ storyteller│journalist ─→ dossier_NN.json
                        │              (style에 따라 디스패치)
                        │                     │                      │
                        │   (리서치 모드) WebSearch 취재              ├→ ① 자사몰 인사이트 장문 (insight-page 경로)
                        │   → fact-candidates 제출                   ├→ ② 보도자료/미디어킷 (.md/.docx)
                        │   → 콘솔 승인 → verified-sources 등록       └→ ③ generate.mjs brief에 dossier 주입
                        │                                                 → copywriter가 5채널 파생 (기존 그대로)
                        └ 결정론 단계 — LLM 없음 (generate.mjs와 동일 패턴)
```

- 하나의 dossier(마스터 아티클)가 **모든 채널의 원천**. 카피는 dossier에서 파생 → 5채널 서사 일관성 확보.
- 기존 copywriter·guard·render·콘솔은 그대로. 접점은 `brief.dossier` 필드 주입 1곳.

## 2. 신규 구성요소

| 파일 | 역할 |
|---|---|
| `agents/melanoir-storyteller.md` | **작가** 서브에이전트 — essay·campaign (구독 LLM, API 키 불요 — 기존 관례) |
| `agents/melanoir-journalist.md` | **기자** 서브에이전트 — feature·column·press |
| `agents/_writer-locks.md` | 두 에이전트가 공유하는 브랜드락·광고법·인용락 공통 블록 (중복 방지) |
| `engine/story.mjs` | `--brief <topic\|주제> --style <s>` sbrief 생성 + 에이전트 디스패치 / `--finalize <dossier>` 장문 guard + 산출물 변환 |
| `brand/verified-sources.json` | **승인된 출처·사실 레지스트리** (id·값·원문 인용·URL·승인일) — brand-dna facts의 확장판 |
| `reference/gold-articles/` | 골드 아티클 레퍼런스 (품질 절대 기준 — 기존 reference/ 관례) |
| `commands/melanoir-story.md` | `/melanoir-story 6` 또는 `/melanoir-story "멜라닌의 광보호 메커니즘"` |
| `engine/figure.mjs` | 도식·차트 생성 — dossier `figures` 스펙 → 브랜드 스타일 SVG (결정론, LLM 없음) |
| `brand/image-policy.json` | 외부 이미지 스크랩 정책 (허용 라이선스·크레딧 규칙) |
| `scripts/verify-story.mjs` | 인용락·가드·구조·도식 검증 (verify-* 관례) |
| `learnings/02-writer.md` | 기자 전용 학습 규칙 (distill 파이프라인 공유) |
| Supabase `fact_candidates` 테이블 | 리서치 산출 사실 후보 — 콘솔 승인 대기열 (schema.sql v3, 멱등) |

## 3. 에이전트·스타일 설계

### 3-1. dossier 공통 봉투 (스타일 무관 — 하류는 스타일을 몰라도 됨)
```json
{
  "id": 12, "style": "feature",
  "topic": "...", "thesis": "한 문장",
  "voice": "journalist",
  "factRefs": ["P-001", "VS-003"],
  "sections": [ { "h": "소제목", "body": "문단들(markdown)", "pullQuote": "발췌 한 줄" } ],
  "derivatives": {
    "keyLines": ["카드 커버 후보 문장들"],
    "beats": ["긴장", "척도", "숫자", "의미"],
    "seo": { "title": "", "description": "" }
  }
}
```

### 3-2. 스타일 — 상시 2종 + 이벤트성 3종(추후)

**상시 (구현 대상 — 인사이트·블로그에 꾸준히 쌓이는 자산):**
| 스타일 | 담당 | 구조 템플릿 | 보이스·인칭 |
|---|---|---|---|
| **essay** 브랜드 스토리 | 작가 | 내러티브 아크: 긴장→전환→선언 (2,000~4,000자) | 문학적·선언적, 브랜드 1인칭 "우리는" |
| **feature** 과학 기사 | 기자 | 리드→넛그래프→메커니즘→숫자→의미 (1,500~3,000자) | 객관·정밀, 3인칭 — 브랜드도 취재 대상처럼 |

**이벤트성 (필요 시 템플릿만 추가 — 별도 에이전트 불요):**
- **column** = feature의 `stance` 옵션(관점 모드: 통념→반박→근거→제안, 필자 1인칭). 별도 템플릿 없음.
- **press** 보도자료/미디어킷 (기자) — 발표 이벤트 시. 역피라미드 + Q&A.
- **campaign** 캠페인 내러티브 (작가) — 런칭·모집 시. 스토리 아크 + 채널 비트 + CTA.

하나의 논문·출처는 승인 후 verified-sources에 **스타일 중립 사실 묶음**으로 등록되므로, 같은 factRefs로 feature·column·press를 각각 생성할 수 있다(승인 1회, 재사용 무제한).

### 3-3. 페르소나
- **melanoir-storyteller (작가)**: 상업 브랜드 내러티브 작가. 애플식 명료함 + 선언의 무게. "브랜드가 말한다."
- **melanoir-journalist (기자)**: 과학 저널리스트. 검증 습관·출처 규율·근거 계층. "브랜드에 대해 쓴다." 멜라닌·색소화학·ISO 시험·PMU 산업 도메인.

**입력(공통)**: `sbrief_NN.json` = 주제·앵글·style + brand-dna facts + verified-sources + 브랜드락 + 골드 few-shot + learnings. `story.mjs`가 style에 따라 에이전트를 디스패치.

**작법 기준** (골드 카피 원칙의 장문 확장):
- 하나의 thesis, 한 방향. 문단은 생각의 흐름 — 단문 나열·불릿 도배·동일 어미 3연속 금지(AI 냄새 규칙 재사용).
- 기자 스타일: 모든 주장에 근거 계층 명시(제품 시험값 / 성분 분류 / 일반 과학 — 층위 혼합 금지, 기존 레이어 분리 원칙의 장문판).
- 브랜드락·광고법 전면 적용 — `agents/_writer-locks.md` 공통 블록을 두 에이전트가 공유.

## 4. 리서치 + 출처 검증 게이트 (핵심 신규 규율)

현행 "facts에 없는 수치 전면 금지"를 **"미승인 사실 게시 금지"**로 확장:

1. **취재**: 기자 에이전트가 WebSearch로 논문·기관 자료·업계 통계 수집.
2. **후보 제출**: 새 사실은 본문에 바로 쓰지 않고 `fact_candidates`로 제출 — `{ claim, value, 원문 인용, 출처 URL, 발행처, 신뢰도 메모 }`.
3. **콘솔 승인**: 웹 콘솔에 승인 대기열 뷰 추가(기존 sources/learnings 검토 UI 패턴 재사용). 승인 → `brand/verified-sources.json` pull.
4. **인용락(citation-lock)**: dossier의 모든 수치·인용·연구 언급은 `factRef`(brand-dna facts id 또는 verified-sources id) 필수. `story.mjs --finalize`가 미매핑 수치를 **block** — guard.mjs에 `guardArticle()` 추가.
5. 초안 단계에선 미승인 사실을 `⟦후보 FC-012⟧` 마커로 표시 → 승인 전 발행 불가.

→ 리서치의 깊이는 얻되, 할루시네이션·광고법 리스크는 기존 guard 수준으로 봉쇄.

## 5. 실행 모델 — 어떻게 돌아가는가

기존과 동일한 **Claude Code 플러그인 명령 + 서브에이전트** 방식 (구독 LLM, API 키 불요, cwd 기준 node 실행):

```
/melanoir-story 6                       # 토픽 6을 feature로 (토픽 layer에서 스타일 자동 추론)
/melanoir-story "멜라닌의 광보호 메커니즘" --style feature
/melanoir-story 1 --style essay
```

1. 명령이 `node engine/story.mjs --brief …` 실행 → sbrief_NN.json (결정론 — facts·verified-sources·락·few-shot·learnings 주입)
2. 명령이 style에 따라 **storyteller 또는 journalist 서브에이전트 디스패치** → 에이전트가 sbrief를 Read
3. (리서치 필요 시) 에이전트가 WebSearch 취재 → 새 사실은 fact_candidates 제출, 본문엔 `⟦후보⟧` 마커
4. dossier_NN.json Write → `story.mjs --finalize` (guardArticle + 인용락 + figures 렌더)
5. Supabase push(kind: 'article') → **콘솔 검토·승인** → 발행·파생
6. 자연어 트리거(skills): "과학 기사 써줘" / "브랜드 스토리 써줘". 추후 `/melanoir-daily`에 주 1회 story 슬롯 편성 가능.

미승인 fact 후보가 있으면 finalize가 **draft 상태로 멈추고** 승인 대기열을 안내 → 승인 후 재-finalize.

## 6. 인용 · 도식 · 이미지

**인용 표기 (사실 확인 가시화):**
- 본문 내 `[1]` 각주 마커 = verified-sources id 매핑. dossier `factRefs`가 명세, 본문 마커가 표기.
- insight-page 렌더 시 하단 **"참고 문헌"** 섹션 자동 생성(저자·저널·연도·URL/DOI) + JSON-LD `citation` 속성 → AI 검색(GEO) 신뢰도 상승.
- 차트 수치도 인용락 대상 — figure마다 factRefs 필수.

**도식·차트 (`engine/figure.mjs` — 결정론 SVG, LLM이 그리지 않음):**
- 에이전트는 dossier에 **figure 스펙만** 선언: `{ id, type: "bar"|"compare"|"numberCard"|"process", data, caption, factRefs }`
- figure.mjs가 브랜드 스타일(블랙·골드, 기존 렌더 관례)로 SVG 렌더 → 인사이트 본문 삽입 + IG 카드 배경 재사용 가능.
- 논문 그림은 **직접 삽입 금지** → 데이터를 추출해 자체 도식으로 재시각화 (저작권 원천 차단 + 브랜드 일관성).

**외부 이미지 스크랩 (`brand/image-policy.json`):**
- 1순위: 자체 자산(brand/image-stock.json) · 자체 생성 figure.
- 스크랩 허용: **퍼블릭 도메인·CC0 한정** (Wikimedia Commons·Unsplash·Pexels 등). CC-BY는 크레딧 표기 조건부 허용.
- 모든 외부 이미지는 `{ url, license, source, credit }` 메타 필수 기록 → 콘솔 승인 대상. 라이선스 불명 = 사용 금지.
- 기본 전략: **"이미지를 긁지 말고 데이터를 긁어 자체 도식으로."**

## 7. 마케팅 에이전트로의 전달 — 인터페이스 계약

도시어는 **파일 + 승인 상태**로 전달된다. 마케팅 에이전트(기존 파이프라인) 쪽 변경은 brief 주입 1곳:

1. **파일 계약**: 승인된 `out/dossier_NN.json`이 SSoT. `generate.mjs --brief <topic> --dossier out/dossier_NN.json` → brief에 `dossier` 필드(thesis·keyLines·beats·섹션 요약·factRefs·figures 경로) 주입 → copywriter/channel-copywriter는 **무변경**(brief가 풍부해질 뿐, 원천 서사에서 파생).
2. **토픽 큐 연동**: dossier 승인 시 topic-queue에 dossier-backed 표시 → `/melanoir-daily`가 dossier 있는 토픽을 우선 집행 (수동 옵션 지정 불요).
3. **승인 게이트**: 콘솔 승인(approved) 상태의 dossier만 파생 허용 — 미승인 원천에서 카드가 나가는 일 차단.
4. **직접 발행 경로**: 인사이트 장문(insight-page dossier 모드, GEO/SEO·JSON-LD 그대로) · 보도자료 `.md`+docx(out/press/).
5. **학습 루프**: dossier 피드백 → distill → learnings/02-writer.md 환류 (기존 파이프라인 공유).

## 8. 구축 단계

| Phase | 내용 | 완료 기준 |
|---|---|---|
| **P1 골격** | 작가·기자 에이전트 2종 + _writer-locks 공통 블록 + story.mjs(--brief/--finalize, style 디스패치) + guardArticle + essay·feature 템플릿 | 토픽 1로 essay 1건, 토픽 4~7로 feature 1건 생성 → guard 통과 → out/ 저장 |
| **P2 리서치 게이트** | WebSearch 취재 절차 + fact_candidates 테이블·콘솔 승인 뷰 + verified-sources pull + 인용락 | 미승인 수치 포함 dossier가 finalize에서 block, 승인 후 통과 |
| **P3 하류 연결** | brief dossier 주입 + topic-queue 연동 + insight-page 장문 모드(인용 섹션·JSON-LD citation) + figure.mjs + /melanoir-story 명령·스킬 트리거 | dossier 1건(도식 포함) → 인사이트 + 5채널 파생 E2E |
| **P4 품질·학습** | reference/gold-articles 골드 2~3건 확정 + few-shot 주입 + distill 연결 + verify-story.mjs + image-policy | `npm run verify`에 story 포함, 골드 대비 자가검열 체크리스트 통과 |

P1·P2가 본체. P3·P4는 기존 인프라 재사용이라 증분이 작다. 이벤트성 스타일(press·campaign·column 플래그)은 P4 이후 필요 시 템플릿 추가.

## 8-B. 발굴 레이어 — 취재·기획 성능 (P5, 2026-07-03 추가)

작가·기자의 본질은 "규율 지키며 잘 쓰기"를 넘어 **재료·스토리를 발굴하는 것**. 이를 위한 상시 장치:

- **기획 발굴** `/melanoir-pitch` (engine/pitch.mjs + scripts/pitch-review.mjs): 기자가 새 스토리 앵글 N개 피칭 → 결정론 채점(기존 토픽 중복·브랜드락 위험어·근거 실현성·시의성) → 사람 승인 시 brand-dna topics 편입 → `/melanoir-story <새id>`. 고정 10토픽을 넘어서는 경로.
- **취재 발굴**: `/melanoir-story` 자유 주제 → 기자가 WebSearch 취재 → pendingFacts → 인용락 게이트. 이미 P2에 내장.
- **성능 지표** `scripts/research-scorecard.mjs`: fact_candidates 집계 → 승인율·**원출처 도달률**·**인용 완결성**·병합 반영률. 콘솔 데이터가 쌓일수록 발굴 품질이 수치화.

**실전 검증 결과 (2026-07-03):**
- 취재 테스트("EU 반영구 잉크 규제") — brand facts에 없는 주제로 7건 발굴, **원문(EUR-Lex/legislation.gov.uk 규정 본문·Appendix 13) 직접 대조 결과 6/7 quote 정확 일치, 할루시네이션 0**(1건은 소스가 JS 렌더라 미확인·허위 아님). `0,00005 %` 유럽식 표기 원형 보존. 인용락이 미승인 수치 100% 차단.
- 피칭 테스트 — 앵글 5개 전부 기존 토픽 중복 없음·브랜드락 충돌 없음·출처 구체(식약처 고시·FDA·ISO·EUR-Lex), 채점 5/5.
- **채택률**(피칭→발행)은 운영 누적 지표로 콘솔에서 관측.

## 9. 빌드 현황 (2026-07-03 — P1~P5 구현 완료)

| 구성요소 | 상태 |
|---|---|
| agents/ melanoir-storyteller · melanoir-journalist · _writer-locks | ✅ |
| engine/story.mjs (--brief/--finalize/--offline/--check) · figure.mjs (SVG 4종) | ✅ |
| guard.mjs guardArticle (브랜드락+인용락+이미지정책+pending) | ✅ |
| brand/ verified-sources.json · image-policy.json | ✅ |
| supabase schema v3 fact_candidates + scripts/fact-candidates.mjs (submit/list/approve/pull) | ✅ SQL 준비 — **라이브 적용은 로컬에서 `node scripts/apply-schema.mjs` 1회** (명령 0단계가 자동 감지·실행) |
| generate/channels `--dossier` 주입 · topic-queue 도시어 표시 · daily 명령 연동 | ✅ |
| insight-page dossier 모드 (참고 문헌 + JSON-LD citation + inline 도식) | ✅ |
| scripts/push-article.mjs (channel=article) · 콘솔 아티클 뷰(web/article.html) · 사실 검증 탭 | ✅ |
| commands/melanoir-story.md · 스킬 트리거 | ✅ |
| scripts/verify-story.mjs — 31 케이스 (npm run verify에 포함) | ✅ 전체 통과 |
| 샘플: essay(토픽 1)·feature(토픽 5) → reference/gold-articles/candidate_* | ✅ guard 통과 — 콘솔 승인 후 `gold_`로 승격 |
| **발굴(P5)**: /melanoir-pitch(engine/pitch.mjs·pitch-review.mjs) + research-scorecard.mjs | ✅ 실전 검증 — 취재 6/7 원문 대조·할루시네이션 0, 피칭 5/5 |

## 10. 리스크 / 결정 필요

- **광고법**: 외부 연구 인용도 제품 효능 암시로 읽힐 수 있음 → 인용락에 더해 "일반 과학 층위" 문장에는 제품명 병치 금지 규칙을 guardArticle에 포함.
- **골드 아티클 부재**: 카드와 달리 장문 골드 레퍼런스가 아직 없음 → P1에서 생성한 초안 중 Chief Architect가 승인한 것을 골드로 승격하는 방식(콜드 스타트).
- **결정**: fact_candidates 승인 권한을 콘솔 anon으로 열지, 로컬 승인(service_role pull 시 확인)만 둘지 → 운영자 1인이면 로컬 승인으로 시작 권장.
