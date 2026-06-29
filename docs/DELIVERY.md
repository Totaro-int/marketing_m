# 멜라누아 스튜디오 — 납품 안내

> 매일 **명령 한 줄 `/melanoir`** 로 5개 채널 콘텐츠를 만들고, 웹에서 검토·복붙하고, 자사몰엔 자동 발행·색인까지.

---

## 이게 무엇인가요
멜라누아 브랜드 콘텐츠를 **골드 품질로 자동 생성**하는 시스템입니다.

- **5채널** — 인스타그램 카드뉴스 · LinkedIn · Threads · 네이버 블로그 · 자사몰 인사이트
- **비용 0** — Claude 구독으로 카피 작성 (별도 API 요금 없음)
- **품질 보장** — 골드 레퍼런스 기준 + 브랜드·광고법 자동 검수(가드)
- **학습** — 콘솔에 피드백을 남기면 다음 생성에 자동 반영
- **자가수정** — 환경 이전 오류는 Claude가 런북 보고 스스로 고침

---

## 포함된 것
- ✅ 콘텐츠 엔진 (5채널 생성·검수·학습)
- ✅ 검토 콘솔(웹) — 채널별 미리보기·다운로드·복붙
- ✅ 인스타 카드 편집기 — 배경 교체·텍스트 수정·**PNG 저장**
- ✅ 네이버 블로그 미리보기 · 자사몰 인사이트 미리보기
- ✅ 자사몰 자동 발행 + 검색 색인(네이버 즉시 · 구글)
- ✅ 설치 가이드 PDF + 자가수정 런북

---

## 빠른 시작 (1회 · 약 15분)
1. Claude Desktop → 설정 → **Skills 에 `melanoir-skill.zip` 업로드** + "코드 실행" ON
2. 엔진 설치 — `git clone … && npm run setup` → `.env.local` 에 키 입력 → **`npm run doctor`** 가 ✓
3. (자사몰 자동발행 쓰면) 자사몰 레포 클론 + `.env.local` 에 `MELANOIR_SITE_REPO`

> 그림과 함께 한 단계씩 → **설치 가이드 PDF**(아래 링크)

---

## 매일 사용
작업 폴더(레포)를 연 채 **`/melanoir`** 한 줄 →
5채널 자동 생성 → **콘솔에서 검토** → 인스타 카드 **다운로드** / 글 **복붙** → 자사몰은 **자동 발행·색인**.

| 채널 | 발행 방법 |
|---|---|
| 인스타그램 | 콘솔 `카드 편집` → PNG 다운로드 → 업로드 |
| LinkedIn · Threads · 네이버블로그 | 콘솔 본문 `복사` → 붙여넣기 |
| 자사몰 인사이트 | **자동** (git push → 배포 → 네이버·구글 색인) |

---

## 전체 링크
| 항목 | 링크 |
|---|---|
| 🖥 검토 콘솔 | https://melanoir-console.vercel.app |
| 📘 설치 가이드 PDF | https://inrvgokeuyewwvaxwitc.supabase.co/storage/v1/object/public/card-images/docs/INSTALL-CLIENT.pdf |
| 📄 이 납품 안내 PDF | https://inrvgokeuyewwvaxwitc.supabase.co/storage/v1/object/public/card-images/docs/DELIVERY.pdf |
| 📦 스킬 ZIP | 엔진 레포 루트 `melanoir-skill.zip` (항상 최신) |
| 💻 엔진 소스 | https://github.com/Totaro-int/marketing_m |
| 🏠 자사몰 인사이트 | https://melanoir.co.kr/insights |

---

## 문제가 생기면 (자가수정)
환경을 옮기면 오류가 날 수 있습니다. 순서대로:
1. **`npm run doctor`** 실행 → ✗ 항목 `[CODE]` 확인
2. Cowork에서 **"오류났어, RUNBOOK 보고 고쳐줘"** → Claude가 `docs/RUNBOOK.md` 보고 스스로 수정 → 재점검 (✓ 까지 반복)

## 지원
키 · 권한 · 도메인 문의: **Totaro**
