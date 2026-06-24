# gold-reference/ — 골드 10종 실물 레퍼런스 (진짜 기준)
**2026-06-20 인계.** 이 폴더가 손수 만든 골드스탠다드(6/18~20) IG 카드의 **실물 + 디자인 SSoT**입니다. `.md` 가이드의 “근사치”가 아니라 여기 파일을 기준으로 폰트·레이아웃·색을 맞추세요.

## 무엇이 들어있나
- `cards/carousel_01~10/sX.png` — **실제 렌더된 골드 카드**(슬라이드별 원본). `cards/carousel_NN_preview.png` — 카드별 한눈.
- `_FINAL_REVIEW/00_표지_한눈보기.png` — 10종 표지 대조 · `NN_미리보기.png` — 캐러셀별 미리보기 · `INDEX.md` — 캡션 전문.
- `carousel_specs/carousel_01~10.json` — 카피·이미지·모드·변형 스펙(렌더 입력).
- `melanoir_render_carousel.py` — **디자인 SSoT(렌더러).** 폰트·레이아웃·색·디밍이 전부 여기서 결정됨.
- `fonts/` — **Pretendard-Bold/Regular/SemiBold.otf**(+OFL.txt). 렌더러가 스크립트 옆 `fonts/`를 우선 사용 → 어떤 환경에서도 Pretendard로 렌더.
- `bg/lib/*` — 배경 실사(렌더 입력). `멜라누아_IG_카피_10종.docx` — 카피 문서.

## 재현(파이프라인이 같은 스타일로 렌더)
```
python3 melanoir_render_carousel.py carousel_specs/carousel_06.json
# → cards/carousel_06/s1..sN.png + carousel_06_preview.png
```

## 디자인 상수 (렌더러에서 추출 — 텍스트 기준값)
- 캔버스: **1080×1350**.
- 색: **골드 #C2A15A = RGB(194,161,90)** · 회색 본문 #CACACD = RGB(202,202,205) · 흰색 #FFFFFF · 마무리 배경 순흑 #000000.
- 폰트: **Pretendard**(번들됨: `fonts/`) → 없으면 Noto Sans CJK 폴백. **현 골드 카드는 Pretendard로 렌더됨.** 제목·숫자 Bold, 본문 Regular.
- 워드마크: `M E L A N O I R`, **상단**(본문·마무리 상단 좌측 / 데이터·마무리는 상단 중앙), size 25.
- 본문(body): 제목 Y 고정(≈600px), `골드 번호(fo50) + 흰색 제목(자동 폭맞춤)`, 그 아래 **회색 부연(fo35)** 흐름. **핵심 문장 = 흰색 + 골드 밑줄(문단 인라인, 슬라이드당 1개)**.
- 선언 표지(cover_stmt): 헤드라인 좌하단, **자동 축소(≤76px)**.
- 데이터 표지(cover_data): **대형 숫자 중앙(≤120px) + 골드 헤어라인 + 회색 라벨(44) + 흰 후킹(40)**.
- 마무리(closing): 순흑 배경, 중앙 정렬, 얇은 골드 룰.
- 디밍(모드): A=디밍+비네팅, B=블러, C=헤더형, D=순흑, E=가운데 숫자. 곡선=상단 밝게→절반쯤부터 충분히 어둡게→하단 넓고 완만(top/bot/ease 모드별). **하단 워터마크는 0.80~0.88부터 전 폭 완전 불투명으로 차폐**(표지 포함).
- 이미지 변형: 슬라이드 필드 `zoom`(확대)·`fx`/`fy`(초점)·`flip`(반전) — 같은 이미지 2회째 변형용.

> ※ 이전에 `posts/sources/`의 `.md`만으로 인코딩하면 폰트·여백·골드 HEX가 어긋날 수 있었습니다. 이제 **실물 카드 + 렌더러**가 함께 있으니 이 폴더를 단일 기준으로 삼으세요. 6/16 캠페인 카드(`posts/.../campaigns/2026-06-16-*`)는 골드 *이전* 스타일이므로 기준 아님.
