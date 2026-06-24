#!/usr/bin/env node
// 브랜드·광고법 가드 — BRAND_LOCKS + LEGAL_REVIEW + AGENT_LEARNINGS 강제 (block/warn).
// 데이터(금기어·레이어·용어분리)는 brand/brand-dna.json, 판정 로직은 여기(정밀 정규식).
// 사용: node engine/guard.mjs <specPath>            (스펙 전체 검수)
//       node engine/guard.mjs --text "..." [--layer data] [--scope slide|caption]
// 종료코드: block 있으면 1.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DNA = JSON.parse(fs.readFileSync(path.join(ROOT, 'brand/brand-dna.json'), 'utf-8'));
const layerById = Object.fromEntries(DNA.topics.map(t => [t.id, t.layer]));
export const topicLayer = (id) => layerById[id] || 'data';

const L = DNA.locks;
// 유해물질 검사 맥락어 (검출/N.D. 용어가 허용되는 곳)
const HARM_CTX = ['유해물질', '자가품질검사', '필수 항목', 'All N.D.'];

// 판정 체크 — scope: 'any'|'slide'|'caption' / sev: 'block'|'warn'
const CHECKS = [
  // L-06 안전성 단정 (단, ‘안전하다’ 인용·메타 사용은 골드의 정당한 패턴 → 제외)
  { id: 'L-06', sev: 'block', scope: 'any', reason: "법적정의 없는 안전성 단정 금지 → 측정값/ISO 기준 언어로",
    re: /안전합니다|(?<![가-힣‘’'"「『」])안전하다(?![가-힣])|100\s*%?\s*안전|무독성/g },
  // 성적서 공개/원본 (비공개 정책)
  { id: '정책-성적서', sev: 'block', scope: 'any', reason: "시험성적서 공개/원본 표현 금지 → '시험 기준·데이터는 홈페이지에서'",
    re: /성적서[^.\n]{0,8}(공개|원본|확인)|성적서\s*(원본|번호|기관명)/g },
  // 효능 주장
  { id: '효능주장', sev: 'block', scope: 'any', reason: "제품 효능 주장 금지 → 정보·선택 프레임",
    re: /트러블[^.\n]{0,6}(줄|감소|개선|없)|좋아집니다|효과가\s*있습니다/g },
  // EWG 제품 귀속/인증
  { id: 'L-04', sev: 'warn', scope: 'any', reason: "EWG 1등급=성분(멜라닌) 분류. 제품 귀속·본문 노출 금지",
    re: /EWG[^.\n]{0,6}(인증|1\s*등급)/g },
  // L-03 검사 주체
  { id: 'L-03', sev: 'warn', scope: 'any', reason: "시험은 공인기관 수행 → '직접/자체 측정' 금지",
    re: /(직접|자체)\s*측정/g },
  // 슬라이드 화살표 링크 (캡션엔 허용)
  { id: '모델-화살표', sev: 'warn', scope: 'slide', reason: "슬라이드에 '→ URL' 화살표 금지(링크는 캡션)",
    re: /→\s*(https?:\/\/|www\.|melanoir\.co|melanoir\.kr)/g },
  // B-2 수치 → 숫자 (소프트)
  { id: 'B-2', sev: 'warn', scope: 'any', reason: "'수치'보다 '숫자' 권장(고정 용어 '자극 지수' 등 예외)",
    re: /수치/g },
];

function check(text, { scope = 'any', layer = 'data', harmContext } = {}) {
  const out = [];
  if (!text) return out;
  // 1) 정확 금기어 (28종 / 28-FREE / @melanoir.official / 100% 안전 ...)
  for (const term of L.bannedExact) {
    if (text.includes(term)) out.push({ id: 'bannedExact', sev: 'block', match: term, reason: `금지어 '${term}' (BRAND_LOCKS)` });
  }
  // 2) 정규식 클레임 체크
  for (const c of CHECKS) {
    if (c.scope !== 'any' && c.scope !== scope) continue;
    const m = text.match(c.re);
    if (m) out.push({ id: c.id, sev: c.sev, match: [...new Set(m)].join(','), reason: c.reason });
  }
  // 3) 용어 분리: 검출/불검출/N.D. 는 유해물질 검사 맥락에서만 (맥락은 캐러셀 단위 — harmContext)
  const harm = harmContext ?? HARM_CTX.some(k => text.includes(k));
  if (/검출|불검출|N\.D\./.test(text) && !harm) {
    out.push({ id: 'term-sep', sev: 'block', match: '검출/N.D.', reason: '검출/N.D.는 유해물질 자가품질검사 전용 (ISO 자극·세포독성에 사용 금지)' });
  }
  // 4) 레이어 분리: 선언/정체성/모집 레이어 본문에 제품 수치 귀속 금지
  if (L.layerSeparation.forbiddenInLayers.includes(layer)) {
    for (const num of L.layerSeparation.productNumbers) {
      if (text.includes(num)) out.push({ id: 'L-05', sev: 'block', match: num, reason: `${layer} 레이어에 제품 수치 '${num}' 귀속 금지 (데이터 레이어로)` });
    }
  }
  return out;
}

// 슬라이드 텍스트 수집
function slideText(sl) {
  const parts = [];
  for (const k of ['num', 'title', 'label', 'hook', 'number']) if (sl[k]) parts.push(sl[k]);
  if (sl.lines) parts.push(...sl.lines);
  if (sl.segments) for (const seg of sl.segments) parts.push(seg[0]);
  return parts.join('  ');
}

export function guardSpec(spec, { layer } = {}) {
  const lay = layer || topicLayer(spec.id);
  // 유해물질 검사 맥락은 캐러셀 단위로 판정 (검출/N.D. 용어 허용 여부)
  const fullText = spec.slides.map(slideText).join(' ') + ' ' + (spec.caption || '');
  const harmContext = HARM_CTX.some(k => fullText.includes(k));
  const findings = [];
  spec.slides.forEach((sl, i) => {
    for (const v of check(slideText(sl), { scope: 'slide', layer: lay, harmContext })) findings.push({ where: `s${i + 1}`, ...v });
  });
  if (spec.caption) for (const v of check(spec.caption, { scope: 'caption', layer: lay, harmContext })) findings.push({ where: 'caption', ...v });
  return { layer: lay, harmContext, findings, blocked: findings.some(f => f.sev === 'block') };
}

export function guardText(text, opts) { const f = check(text, opts); return { findings: f, blocked: f.some(x => x.sev === 'block') }; }

// ---- CLI ----
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const ti = args.indexOf('--text');
  let res;
  if (ti >= 0) {
    const li = args.indexOf('--layer'), si = args.indexOf('--scope');
    res = guardText(args[ti + 1], { layer: li >= 0 ? args[li + 1] : 'data', scope: si >= 0 ? args[si + 1] : 'any' });
    console.log(JSON.stringify(res, null, 2));
  } else if (args[0]) {
    const spec = JSON.parse(fs.readFileSync(args[0], 'utf-8'));
    res = guardSpec(spec);
    console.log(`guard carousel_${spec.id} (layer=${res.layer}): ${res.blocked ? 'BLOCKED' : 'OK'} (${res.findings.length} findings)`);
    for (const f of res.findings) console.log(`  [${f.sev}] ${f.where} ${f.id}: ${f.match}  — ${f.reason}`);
  } else { console.error('usage: guard.mjs <specPath> | --text "..." [--layer X] [--scope slide|caption]'); process.exit(2); }
  process.exit(res.blocked ? 1 : 0);
}
