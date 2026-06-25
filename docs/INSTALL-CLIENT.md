# 멜라누아 스튜디오 — 설치 안내 (macOS · Claude Desktop)

> 매일 **명령 한 줄**로 5채널 콘텐츠를 만들고, 웹에서 **검토·복붙**합니다. 1회 설치 ~15분.

## 0. 준비물
- macOS + **Claude Desktop**(구독) — Cowork / Claude Code 사용 중
- **Node.js 18+** — 없으면 [nodejs.org](https://nodejs.org) 에서 LTS 설치
- **Supabase 키** — Totaro가 전달 (`.env.local` / `config.js` 값)

---

## 1. 스킬 등록 (5분)
1. Claude Desktop → **설정 → 커스터마이징 → Skills**

   ![설정 → 커스터마이징 → Skills](img/01-skills.png)

2. **`+` → "스킬 만들기" → `melanoir-skill.zip` 업로드** → 토글 **ON**
   (ZIP은 엔진 레포 루트의 `melanoir-skill.zip`)

   ![스킬 ZIP 업로드](img/02-upload-zip.png)

3. **설정 → Capabilities → "코드 실행 및 파일 생성" ON** (스킬이 엔진을 돌리려면 필요)

   ![코드 실행 ON](img/03-code-execution.png)

---

## 2. 엔진 설치 (한 방, 10분)
Cowork(또는 터미널)에서:
```bash
git clone https://github.com/Totaro-int/marketing_m.git melanoir-studio
cd melanoir-studio
node scripts/setup.mjs        # 설정 템플릿 복사 + npm install + 점검
```
그다음 **`.env.local`** 과 **`web/config.js`** 에 Totaro가 준 키를 붙여넣고:
```bash
npm run doctor                # ✓ "준비 완료" 뜨면 끝
```

   ![npm run doctor — 준비 완료](img/04-doctor-ok.png)

> `canvas`(서버 렌더)는 설치 안 돼도 됩니다 — 인스타 카드는 **웹 카드 편집기**가 그립니다.

---

## 3. 매일 사용
1. Cowork / Claude Code 작업 폴더 = **`melanoir-studio`**
2. **"오늘 콘텐츠 만들어줘"** (또는 "멜라누아 카드 만들어")
3. 5채널 생성 → **콘솔**에서 검토·복붙: **https://melanoir-console.vercel.app**

   ![콘솔 — 캠페인별 5채널](img/05-console.png)

   - **인스타**: `카드 편집` → 배경 교체·텍스트 수정 → `이 카드 PNG`/`8장 모두 저장` → 인스타 업로드
   - **네이버 블로그**: `블로그 미리보기` → 글+이미지 위치 확인 → `본문 텍스트 복사`
   - **LinkedIn · Threads**: 본문 `복사` → 플랫폼에 붙여넣기 (🖼 이미지 배치 표시 참고)

   ![인스타 카드 편집기](img/06-card-editor.png)

---

## 문제 해결
- `npm run doctor` 의 빨간(✗) 항목 안내대로 조치
- 스킬이 목록에 안 보이면: ZIP 재업로드 · "코드 실행" ON 확인 · Desktop 재시작
- 키/권한 문의: **Totaro**

*(이미지 자리(img/*.png)는 실제 화면 캡처로 교체하세요.)*
