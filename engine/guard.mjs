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

// ============================================================================
// guardArticle — 작가·기자 레이어(dossier) 장문 검수: 브랜드락 + 인용락(citation-lock)
//   인용락: 본문의 모든 수치·연도는 factRefs(brand-dna facts ∪ verified-sources)의 값에
//   등장해야 한다. ⟦후보⟧ 마커(미승인 사실) 있으면 pending — 발행 불가(draft).
// ============================================================================
const VS_PATH = path.join(ROOT, 'brand/verified-sources.json');
export function loadVerifiedSources() {
  try { return (JSON.parse(fs.readFileSync(VS_PATH, 'utf-8')).sources || []).filter(s => s.active !== false); }
  catch { return []; }
}

// 근거로 허용되는 숫자 토큰 수집 (facts + verified-sources 의 값·라벨·시험명에서 추출)
function allowedNumbersFrom(refs) {
  const toks = new Set();
  const harvest = (v) => { for (const m of String(v || '').match(/\d+(?:[.,]\d+)?\s*%?|ISO[\s-]*\d+(?:-\d+)?/gi) || []) toks.add(m.replace(/\s+/g, '')); };
  for (const r of refs) for (const k of ['value', 'label', 'test', 'language', 'claim', 'quote', 'note', 'publishedAt']) harvest(r[k]);
  return toks;
}
function dossierSectionText(s) { return [s.h, s.body, s.pullQuote].filter(Boolean).join('  '); }
export function dossierFullText(d) {
  return [d.title, d.subtitle, d.lead, ...(d.sections || []).map(dossierSectionText), d.conclusion,
    ...((d.figures || []).map(f => f.caption))].filter(Boolean).join('\n');
}

export function guardArticle(dossier) {
  const layer = dossier.layer || (dossier.style === 'feature' ? 'data' : 'declaration');
  const findings = [];
  const vs = loadVerifiedSources();
  const factById = new Map([...DNA.facts.map(f => [f.id, f]), ...vs.map(s => [s.id, s])]);

  // 0) 스키마·구조
  for (const k of ['style', 'thesis', 'title', 'sections']) if (!dossier[k] || (Array.isArray(dossier[k]) && !dossier[k].length))
    findings.push({ where: 'schema', id: 'schema', sev: 'block', match: k, reason: `dossier.${k} 누락` });
  const len = dossierFullText(dossier).replace(/\s/g, '').length;
  const range = dossier.style === 'feature' ? [1200, 3600] : dossier.style === 'essay' ? [1600, 4800] : [400, 4800];
  if (len && (len < range[0] || len > range[1]))
    findings.push({ where: 'length', id: 'length', sev: 'warn', match: `${len}자`, reason: `${dossier.style} 권장 분량(${range[0]}~${range[1]}자, 공백 제외) 벗어남` });

  // 1) 브랜드락 — 섹션 단위 (scope=caption: 슬라이드 전용 화살표 룰 제외)
  const fullText = dossierFullText(dossier);
  const harmContext = HARM_CTX.some(k => fullText.includes(k));
  const parts = [['lead', dossier.lead], ...(dossier.sections || []).map((s, i) => [`§${i + 1} ${s.h || ''}`, dossierSectionText(s)]), ['conclusion', dossier.conclusion]];
  for (const [where, text] of parts) if (text)
    for (const v of check(text, { scope: 'caption', layer, harmContext })) findings.push({ where, ...v });

  // 2) 인용락 — factRefs·citations 유효성
  const refs = [...new Set([...(dossier.factRefs || []), ...((dossier.citations || []).map(c => c.ref)), ...((dossier.figures || []).flatMap(f => f.factRefs || []))])];
  const resolved = [];
  for (const id of refs) {
    const f = factById.get(id);
    if (!f) findings.push({ where: 'citations', id: 'cite-ref', sev: 'block', match: id, reason: `근거 id '${id}' 없음 (facts/verified-sources에 미등록)` });
    else resolved.push(f);
  }
  for (const c of dossier.citations || []) if (!fullText.includes(`[${c.marker}]`))
    findings.push({ where: 'citations', id: 'cite-marker', sev: 'warn', match: `[${c.marker}]→${c.ref}`, reason: '본문에 해당 각주 마커 없음' });

  // 3) 인용락 — 본문 숫자 대조: 근거 값에 없는 수치는 차단 (각주 마커 [n]·figure id 제외)
  const allowed = allowedNumbersFrom(resolved);
  const scanText = fullText.replace(/\[\d+\]/g, ' ').replace(/⟦[^⟧]*⟧/g, ' ');
  for (const tok of new Set(scanText.match(/\d+(?:[.,]\d+)?\s*%|\d+(?:\.\d+)+|ISO[\s-]*\d+(?:-\d+)?|\d{4}년|\d+(?:,\d{3})+/g) || [])) {
    const norm = tok.replace(/\s+/g, '').replace(/년$/, '');
    if (![...allowed].some(a => a === norm || a === norm + '%' || norm === a + '%')) {
      findings.push({ where: 'body', id: 'cite-lock', sev: 'block', match: tok, reason: `인용락: 수치 '${tok}'의 근거(factRefs) 없음 — facts/verified-sources 등록 후 사용` });
    }
  }
  // figure 는 factRefs 필수
  for (const f of dossier.figures || []) if (!(f.factRefs || []).length)
    findings.push({ where: `figure:${f.id}`, id: 'cite-lock', sev: 'block', match: f.id, reason: '도식 수치의 factRefs 누락' });

  // 4) 미승인 후보 마커 → pending (발행 불가, block 과 구분)
  const pendingMarks = fullText.match(/⟦후보[^⟧]*⟧/g) || [];
  const pending = pendingMarks.length + (dossier.pendingFacts || []).length;

  // 5) 외부 이미지 메타 (image-policy)
  let policy = null; try { policy = JSON.parse(fs.readFileSync(path.join(ROOT, 'brand/image-policy.json'), 'utf-8')); } catch { }
  const okLic = new Set((policy?.allowedLicenses || []).map(l => l.license));
  for (const im of dossier.images || []) {
    if (!im.url || !im.license || !im.source) findings.push({ where: 'images', id: 'img-meta', sev: 'block', match: im.url || '(무URL)', reason: '외부 이미지 메타(url/license/source) 불완전' });
    else if (okLic.size && !okLic.has(im.license)) findings.push({ where: 'images', id: 'img-license', sev: 'block', match: im.license, reason: `허용 라이선스 아님 (image-policy: ${[...okLic].join('/')})` });
    else if (im.license === 'CC-BY' && !im.credit) findings.push({ where: 'images', id: 'img-credit', sev: 'block', match: im.url, reason: 'CC-BY는 credit 필수' });
  }

  return { layer, findings, pending, blocked: findings.some(f => f.sev === 'block'), chars: len };
}

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
    if (spec.style && spec.sections) {
      res = guardArticle(spec);
      console.log(`guardArticle ${spec.style}_${spec.id} (layer=${res.layer}): ${res.blocked ? 'BLOCKED' : res.pending ? `PENDING(${res.pending})` : 'OK'} (${res.findings.length} findings, ${res.chars}자)`);
      for (const f of res.findings) console.log(`  [${f.sev}] ${f.where} ${f.id}: ${f.match}  — ${f.reason}`);
      process.exit(res.blocked ? 1 : 0);
    }
    res = guardSpec(spec);
    console.log(`guard carousel_${spec.id} (layer=${res.layer}): ${res.blocked ? 'BLOCKED' : 'OK'} (${res.findings.length} findings)`);
    for (const f of res.findings) console.log(`  [${f.sev}] ${f.where} ${f.id}: ${f.match}  — ${f.reason}`);
  } else { console.error('usage: guard.mjs <specPath> | --text "..." [--layer X] [--scope slide|caption]'); process.exit(2); }
  process.exit(res.blocked ? 1 : 0);
}
