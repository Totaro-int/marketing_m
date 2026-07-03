# 통합 노트 — 세 갈래 패치 병합 (2026-07-03)

> 목적: **업체 패치 · 어제 Claude Code 패치 · 오늘 작가/기자 빌드** 세 갈래를 충돌 없이 하나의 `main`으로 합친다.
> 결론 먼저: **파일 겹침 0 → 충돌 불가.** 위험은 "충돌"이 아니라 **fresh clone/`npm run setup` 실행 시 우리 로컬 작업이 통째로 사라지는 것.** 그러니 설치 스크립트를 돌리지 말고, 아래 순서로 병합한다.

---

## 1. 현재 지형 (공통 조상 `34dad46`)

```
34dad46 (공통 조상)
├─ origin/main  e020dfe  ← ① 업체 패치 (+3): 설치문서 + 인사이트 섹션 페이지
└─ 로컬 fix/edit-learning-loop  da6d56d  ← ② 어제 Claude Code (+3): 학습루프·채널뷰·큐
        └─ (워킹트리 미커밋)             ← ③ 오늘 작가/기자 레이어 (32개 코드/문서)
```

## 2. 세 갈래가 건드린 파일 — 겹침 0

| 갈래 | 바꾼 파일 |
|---|---|
| **① 업체 (origin/main)** | `docs/CLIENT-SETUP.txt` · `web/insights-preview.html` · `web/insights.html` |
| **② 어제 CC (로컬 3커밋)** | `web/index.html`(콘솔) · `web/blog.html` · `commands/melanoir-queue.md` · `scripts/distill.mjs` · `scripts/pull-supabase.mjs` · `supabase/content_requests.sql` · `supabase/schema.sql` |
| **③ 오늘 작가/기자 (미커밋)** | `agents/*` · `engine/story·figure·pitch·guard·generate·channels·insight-page.mjs` · `commands/melanoir-story·pitch.md` · `scripts/*` · `brand/verified-sources·image-policy.json` · `web/article.html` · `web/index.html`(+82줄) · `supabase/schema.sql`(v3) · README · SKILL |

- **① ∩ (②∪③) = ∅** — 업체는 *인사이트 섹션 페이지*를, 우리는 *콘솔(web/index.html)·엔진·스키마*를 건드려 **한 파일도 겹치지 않는다.** 3-way 머지 충돌은 물리적으로 불가능.
- **② ∩ ③ = {`web/index.html`, `supabase/schema.sql`}** — 겹치지만 ③이 ②의 커밋 **위에** 얹혀 있어 순차 수정(충돌 아님). 커밋하면 한 덩어리.

## 3. 병합 절차 (우리 로컬 = Cursor에서 실행)

우리가 `origin`(= 업체 repo `Totaro-int/marketing_m`)에 push 권한이 있으므로, **우리가 브랜치를 올리고 업체가 main에 머지**하는 방식이 가장 깔끔하다(이력 보존·리뷰 가능).

```bash
# 0. (샌드박스 잔여 lock이 있으면) 정리 — 로컬에서만
rm -f .git/index.lock .git/objects/maintenance.lock

# 1. 오늘 작가/기자 작업을 어제 브랜치 위에 커밋
git add -A
git commit -m "feat(writer): 작가·기자 레이어 — storyteller·journalist 에이전트 + 인용락(citation-lock) + 발굴(pitch·취재 스코어카드) + figure SVG + 콘솔 아티클/사실검증 뷰"

# 2. 업체 최신 main을 우리 브랜치로 병합 (파일 안 겹쳐 자동 병합)
git fetch origin
git merge origin/main -m "merge: 업체 인사이트/설치문서 패치(origin/main) 통합"
#   → 충돌 없이 병합됨. 혹시 병합 커밋 편집기가 뜨면 그대로 저장.

# 3. 검증 (병합 후 우리 파이프라인 정상 확인)
npm run verify:story && npm run verify:guard && npm run self-check

# 4. push → GitHub에서 PR 생성 (base: main ← compare: fix/edit-learning-loop)
git push origin fix/edit-learning-loop
```

> 대안(직접 머지 권한이 있으면): 2단계 대신 `git checkout main && git merge fix/edit-learning-loop && git push origin main`. 단 PR 경유가 리뷰·롤백에 안전.

## 4. 업체에 전달할 메시지

아래를 그대로 전달하면 된다.

---

**제목: [marketing_m] main 병합 요청 — 로컬 작업 2건 (충돌 없음)**

현재 `origin/main`(`e020dfe`)에는 저희 로컬 작업 두 갈래가 아직 반영되지 않았습니다.

1. **콘텐츠 엔진 확장** (어제) — 편집 학습 루프, 콘솔 채널별 뷰, 요청 큐/칼럼 허브. (`web/index.html` 콘솔, `blog.html`, `distill.mjs`, `pull-supabase.mjs`, `content_requests.sql`, `schema.sql`, `melanoir-queue.md`)
2. **작가·기자 레이어** (오늘) — 브랜드 스토리/과학 기사 원천 콘텐츠 생성 에이전트(storyteller·journalist), 인용락(근거 없는 수치 차단), 스토리 발굴(pitch)·취재 스코어카드, 도식 SVG, 콘솔 아티클/사실검증 뷰. (`agents/*`, `engine/story·figure·pitch.mjs` 등, `web/article.html`, `schema.sql` v3)

**중요 — 충돌 없음이 확인되었습니다.** 귀사 최신 패치(`docs/CLIENT-SETUP.txt`, `web/insights-preview.html`, `web/insights.html`)와 저희 작업은 **건드린 파일이 하나도 겹치지 않습니다**(귀사=인사이트 섹션 페이지, 저희=콘솔·엔진·스키마). 3-way 머지 시 충돌이 발생하지 않습니다.

**요청:** 저희가 `fix/edit-learning-loop` 브랜치를 push하고 PR을 올리겠습니다. 이를 `main`에 머지해 주십시오. (또는 저희에게 직접 머지 권한을 주시면 저희가 병합 후 알려드리겠습니다.)

**주의:** 배포/재설치 시 이 브랜치가 `main`에 병합된 **이후에** clone/setup 해주세요. 병합 전 fresh clone(`e020dfe`)을 배포하면 위 두 작업이 빠진 구버전이 나갑니다.

`schema.sql`은 additive(v3에서 `fact_candidates` 테이블 추가)라 기존 4테이블·데이터에 영향이 없으며, 재적용해도 안전(멱등)합니다.

---

## 5. 배포 주의 (요약)

- **여기서 `git clone` / `npm run setup` 을 새로 돌리지 말 것** — 로컬 작업(②③)이 소실된다.
- 백업은 이전 세션에서 확보됨(`~/melanoir-ourwork.bundle`, patch 파일들). 최악의 경우 복원 가능.
- 병합·push 후에는 `main`이 세 갈래를 모두 포함하므로, 이후부터는 clone/setup을 정상 사용해도 안전.
