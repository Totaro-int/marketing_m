# BRAND_LOCKS — 되돌리면 안 되는 브랜드 결정 (회귀 금지)
**소유: Melanoir (Chief Architect) · 상류 SSoT: `[Build] Brand Identity` 문서군**
**이 파일은 추적(committed)된다. 템플릿 머지·리팩터링이 아래 값을 되돌리면 안 된다.**

> 외주(벤더) 안내: 이 레포는 멜라누아 브랜드 운영에 쓰인다. 아래는 광고법·브랜드 표준에서
> 확정된 값이며, 코드/템플릿 변경 시에도 **유지**되어야 한다. PR 전 이 표를 확인할 것.

| 락 ID | 항목 | 확정 값 | 절대 금지(되돌림 금지) | 근거 |
|---|---|---|---|---|
| L-01 | 유해물질 표기 | **"필수 항목 All N.D.(불검출)"** | "28종", "28-FREE", "28종 N.D.", "28종 불검출" | BI `07_fact_ssot_v2 §4` P-003 |
| L-02 | 공식 인스타 핸들 | **@melanoir_official** | "@melanoir.official" | BI git `5d34a05` |
| L-03 | 제품 수치 출처 | **공인기관 성적서 · melanoir.co.kr 게시** | 무출처 인용, 사이트 미게시 수치 | BI `07 §4` |
| L-04 | EWG 표기 | **EWG가 성분(멜라닌)을 1등급으로 평가**(NGO 자체평가·법적 인증 아님). 마케팅 본문 비노출·성분 안전성 맥락만·원본 등급 직접 확인 후 사용 | "EWG 인증"·"공인 인증", **제품에 EWG 1등급 귀속**, 제품 시험값(0.00·97%·All N.D.)과 병렬 배치 | BI `science_data_sheets`·`07 F-006` · 2026-06-19 개정 |
| L-05 | 레이어 분리 | 교육(A/C)에 제품 수치 귀속 금지 | A/C 본문에 0.00·97%·All N.D. 제품 귀속 | BI `03 §1`·`08` Check A |
| L-06 | 법적정의 없는 단어 | "면역 반응 없음/검출되지 않음/ISO 기준 통과" | "안전하다/무독성" 단독, "100% 안전" | BI `03 §3` |
| L-07 | 베타 모집 사실 | 마감 ~6/30 · 선정자 전원 혜택 · SMS 본인인증 · 선정 후 DM 코드 | 임의 마감일·"한정 수량" 압박 | BI git `d2af7ec·2fb771a·73add3e` |

## 통제 지점 (회귀가 자동으로 막히는 곳)
1. **`company-profile.yaml > banned.claims`** (gitignore — 템플릿이 못 덮음). guardian가 발행 전 `text.includes()`로 L-01·L-06 위반을 **block**.
2. **`facts.json` / `product-claims.json`** (gitignore — 브랜드 소유). guardian Check A/B 데이터 원천. `product-claims.json.forbidden_phrasings`에 L-01 금지어.
3. **self-check 회귀 가드**(요청 PR) — 추적 파일에 금지 토큰이 되살아나면 self-check FAIL.

## 변경 규칙
- 위 값의 변경은 **상류 BI 문서에서 먼저** 결정하고, 그 다음 이 표·`company-profile.yaml`·데이터 파일로 내려보낸다(일방향).
- template/main 머지 후 **반드시 `node harness/bin/self-check.mjs` 실행**. 브랜드 파일은 fast-forward 덮어쓰기 금지.

## 변경 이력
- **2026-06-19 · L-04(EWG) 개정** — EWG는 성분(멜라닌)을 평가하는 NGO 자체평가 DB이며 제품 평가가 아님. 제품 귀속·제품 시험값과 병렬 배치 금지, 표시광고 민감으로 본문 비노출. 상류 근거: `[Build] Brand Identity/_session/EWG_FRAMING_DECISION_2026-06-19.md`.
