# 멜라누아 스튜디오 (Melanoir Studio)

멜라누아 인스타그램 카드뉴스(캐러셀)를 **골드 스탠다드 품질로 자동 생성 → 검토 → 학습**하는 **Claude Code 플러그인 + 콘텐츠 엔진**.

- 명령 한 줄 `/melanoir-daily` → **5채널(IG 캐러셀 · LinkedIn · Threads · naver-blog) + 자사몰 인사이트** 생성
- 카피 = **Claude Code 구독 에이전트** (Anthropic API 키 **불요**)
- 렌더 = node-canvas (골드 카드 대조 **~1.6%**), 브랜드·광고법 **가드**가 위반 자동 차단
- Supabase 콘솔에서 검토·수정·승인 → 피드백이 **실시간 학습 루프**로 환류

> 새 개발 세션은 `BUILD-SPEC.md`(마스터 스펙) + `reference/`(품질 절대 기준)부터 읽으세요. 아래는 **설치·운영 가이드**입니다.

---

## 0. 사전 준비물
| 필요 | 확인 / 비고 |
|---|---|
| Node.js 18+ | `node -v` |
| Claude Code Desktop (구독) | 카피 생성 = 구독 에이전트(키 불요) |
| Supabase 프로젝트 | 무료 플랜 OK — 콘솔·학습 루프용 |
| (선택) Vercel | 콘솔 비공개 링크 배포용 |

> Windows는 `npm install` 시 `canvas`/`pg` 네이티브 빌드가 필요할 수 있습니다(안내 메시지대로 빌드툴 설치).

## 1. 내려받기 + 설치
```bash
git clone https://github.com/Totaro-int/marketing_m.git melanoir-studio
cd melanoir-studio
npm install
```

## 2. 비밀키 설정 — ⚠️ 절대 공개 금지
```bash
cp .env.local.example .env.local
```
`.env.local` 값 채우기 (Supabase 대시보드 → Project Settings → API):
```
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_SERVICE_KEY=<service_role 키>   # 로컬 전용 · RLS 우회 · 절대 커밋 금지
SUPABASE_ANON_KEY=<anon 키>
SUPABASE_DB_PASSWORD=<DB 비밀번호>
```

## 3. Supabase 스키마 적용 (최초 1회)
```bash
node scripts/apply-schema.mjs
```
→ 4테이블(`marketing_drafts`·`feedback`·`sources`·`learnings`) + RLS + Realtime 생성. (멱등 — 다시 실행해도 안전)

## 4. 웹 콘솔 연결
```bash
cp web/config.example.js web/config.js
```
→ `SB_URL`, `SB_ANON`(anon 키 — RLS로 제한돼 공개돼도 안전) 채우기.

## 5. 플러그인 설치 (Claude Code Desktop)
- **깃에서:** `/plugin marketplace add Totaro-int/marketing_m` → `/plugin install melanoir-studio`
- **또는 로컬:** `/plugin marketplace add <클론한 폴더 경로>` → `/plugin install melanoir-studio`
- → `/melanoir-daily`·`/melanoir-new` 명령이 보이면 완료.

> ⚠️ **명령은 `node scripts/...` 를 cwd 기준으로 실행**합니다(marketing-agent 와 동일 방식). 즉 **클론한 이 폴더에서 Claude Code 를 열고**(2~4단계 완료 상태) 실행해야 합니다. 플러그인 설치만으로는 `npm install`·`.env.local` 이 갖춰지지 않으니 1~4단계는 필수입니다.

## 6. 매일 운영 — 명령 한 줄
```
/melanoir-daily
```
토픽 자동 선택 → copywriter 에이전트가 5채널 골드 카피 → 가드 → 렌더 → **콘솔에서 검토·승인** → 발행(복붙) → 피드백이 다음 날 학습으로 환류.

- 한 건만: `/melanoir-new 6` (토픽 6)
- 토픽 목록·다음 토픽: `npm run topic-queue -- --list`

## 7. 콘솔 배포 (선택 · Vercel)
```bash
npx vercel deploy web --prod --scope <your-team>
```
→ 비공개 링크를 **운영자에게만** 공유. 커스텀 도메인은 Vercel 프로젝트 → Settings → Domains에서 추가(브랜드 도메인 DNS 접근 필요).

## 8. 검증 (직접 실행)
```bash
npm run verify        # 렌더(골드 대조)·가드·이미지배정·self-check·E2E
npm run verify:live   # 콘솔·인사이트·콘솔쓰기 (Supabase 연결 시)
```
> `verify:render`는 골드 레퍼런스(`reference/gold-reference/`)가 있어야 픽셀 비교가 됩니다.

---

## 🔒 보안 수칙 (필독)
- **`SUPABASE_SERVICE_KEY`(service_role)** = 로컬 `.env.local`만. **절대 커밋·공개 금지** (RLS 우회 = DB 전체 권한).
- `web/config.js`의 **anon 키** = RLS로 제한된 공개키(콘솔용). 기본 gitignore.
- 위 두 파일·`assets/`·`node_modules/`·`out/` 은 `.gitignore`로 제외.
- **SNS 자동 게시 없음**(복붙 발행) — 봇 의심 0.

## 🗂 구조
```
engine/         렌더·생성·가드·채널·캡션·이미지배정
agents/         melanoir-copywriter · melanoir-channel-copywriter (구독 LLM)
commands/       /melanoir-daily · /melanoir-new
skills/         자연어 트리거(멜라누아 카드 만들어)
scripts/        push/pull/distill/publish-insight/topic-queue/verify-*
brand/          브랜드 SSoT (brand-dna · image-stock · channels)
web/            검토 콘솔(정적)   ·   supabase/  스키마
.claude-plugin/ 플러그인 매니페스트   ·   reference/  골드 레퍼런스(품질 기준)
```

## 🔁 데이터 흐름 (요약)
로컬 엔진/에이전트 → **(service_role) push** → Supabase(4테이블+Storage) ↔ **(anon·RLS) read/write** ↔ 웹 콘솔 → **(service_role) pull** → distill → 학습 주입 → 다음 생성. 자사몰 인사이트는 `cards.json` + PR 경로.
