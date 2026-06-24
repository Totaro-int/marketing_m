# 이미지 스톡 라벨링 (`bg/lib/`)
**2026-06-19 갱신 · 캐러셀 이미지 배정 가이드.** 괄호 숫자 = 현재 10개 캐러셀 전체 사용 횟수.

> 원칙: ① 캐러셀당 같은 이미지 **최대 2회**(2회째는 zoom/fx·fy/flip 변형). **단, 임팩트 강한 이미지(제품 히어로·니들 등)는 2회도 티가 나므로 1회만.** ② **표지 이미지는 본문 비재사용.** ③ 특정 비트에 맞는 **특수 이미지**가 없으면 **범용 스톡**에서 고른다(특정 이미지 쏠림 방지). ④ 의료가운 컷은 사용 금지.

## A. 범용(General) — 여러 맥락·필러로 자유 사용
| 이미지 | 성격 · 적합 맥락 | 사용 |
|---|---|---|
| `black_powder(fine).png` | 고운 검정 안료 — 소재·순수·단일성분 | 5 |
| `black_powder.png` | 거친 검정 파우더 — 소재·질감 | 3 |
| `black_powder_on_table.png` | 테이블 위 파우더 더미 — 소재·연출 | 2 |
| `black_granule.png` | 검정 과립 — 소재·질감 | 3 |
| `ink_spread_on_glass.png` | 유리 위 잉크 번짐 — 측정·검증·실험 느낌 | 6 ⚠️과다 |
| `ink_on_skin.png` / `_2` / `_3` | 피부 위 잉크 방울 — 피부·잉크(준범용) | 6/6/2 ⚠️과다 |
| `texture.png` / `texture_2.png` | 추상 다크 텍스처 — 배경·필러 | 1/1 ▲활용 |
| `PL-cover-dark-a.png` | 다크 커버 플레이트 — 표지/배경 보조 | 0 ▲미사용 |
| `moon_like.jpg` | 림라이트 구체(월면) — 선언·여백·드라마틱(#9 표지) | 1 |
| `space_station.png` | 다크 구조물 — 추상·드라마틱 | 0 ▲미사용 |

**채움 우선순위(쏠림 완화):** 특수 이미지가 없을 때 → `texture`/`texture_2` → `PL-cover-dark-a` → `moon_like`/`space_station` → `black_powder*` 순으로. `ink_spread_on_glass`·`ink_on_skin*`는 이미 과다이므로 **신규 배정 자제**.

## B. 특수(Specific) — 특정 주제 전용(활용도 낮음, 맥락 맞을 때만)
| 이미지 | 전용 맥락 | 사용 |
|---|---|---|
| `tanned_skin.png` | 멜라닌·피부(#2) | 2 |
| `melanin_color_dilluted.png` | 멜라닌 발색(#2) | 1 |
| `molecular_structure.png` | 분자·과학 라인(데이터 허브 #4) | 2 |
| `melanin_SEM_image.png` / `_2` / `_3` | 세포 SEM(세포 생존율 #6) | 1/1/0 |
| `small_molecules_on_melanin.png` | 멜라닌 위 분자(성분·유해물질 #2·#7) | 2 |
| `black_liquid_and_transparent_gel.png` | 잉크+투명 젤 — 순수·불검출(#7·#3·#10) | 2 |
| `Phothotherm_crop.png` | 과학/포토써멀 — 데이터·과학 | 0 |
| `PL-data-a.png` / `PL-data-b.png` | 숫자 표지 플레이트(cover_data 전용) | 2/1 |
| `[product] Embo_vertical.png` | 제품 히어로 — **임팩트 강함, 1회 권장**(#8 표지) | 1 |
| `[product] Embo_in_sterile_bag.png` | 멸균팩 속 제품(#9·#10) | 3 |
| `sterile_bag.png` | 멸균팩 — 위생·멸균(#10) | 1 |
| `embo_needle_with_ink.png` | **엠보 니들에 멜라누아 잉크 묻힘(클로즈업)** — 제품·시술·소재. 밝은 배경→A/B모드 권장 | 1 ▲신규 |
| `ink_dip_embo_needle.png` | **잉크에 담그는 엠보 니들(액션)** — 시술·개봉·사용. 밝은 배경→A/B모드 권장 | 1 ▲신규 |
| `tattooist_woman.jpg` | 시술 아티스트(정체성·모집 #8·#9) | 2 |
| `hand_grabbing_tattoo_machine.jpg` | 머신 쥔 손(정체성·모집 #8·#9) | 2 |

## C. 사용 금지
| 이미지 | 사유 |
|---|---|
| `man_wearing_black_gown.png` / `_2.png` | 의료가운 — 병원/의료 오인. PMU 맥락 부적합(2026-06-19 오너 지시). |

## D. 메모
- **제품·시술 실사**가 `Embo_vertical`·`Embo_in_sterile_bag`·`sterile_bag`·`embo_needle_with_ink`·`ink_dip_embo_needle` 5종으로 늘어 #8·#9·#10 다양화 여지 확대(니들 2종은 #10 반복 해소에 사용).
- 니들·멸균팩·니들딥 이미지는 **밝은 배경**이라 `C`(헤더)보다 **`A`(디밍+비네팅)/`B`(블러)** 가 워드마크·제목 대비에 유리.
- `ink_spread_on_glass`(6)·`ink_on_skin`(6)·`ink_on_skin_2`(6)는 ‘검증샷·피부샷’ 단골이라 과다 → 새 캐러셀에선 범용 채움 우선순위로 분산.
