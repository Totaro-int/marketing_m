#!/usr/bin/env node
// 가드 검증: ① 골드 10종 스펙(슬라이드+캡션) 전부 통과(block 0) ② 위조 위반 전부 차단.
// 골드 = 절대 기준 → 골드가 하나라도 block되면 가드가 틀린 것.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { guardSpec, guardText, topicLayer } from '../engine/guard.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const specDir = path.join(ROOT, 'reference/gold-reference/carousel_specs');
let pass = 0, fail = 0;

console.log('=== ① 골드 스펙 통과 검증 (block=0 기대) ===');
for (let n = 1; n <= 10; n++) {
  const p = path.join(specDir, `carousel_${String(n).padStart(2, '0')}.json`);
  if (!fs.existsSync(p)) continue;
  const spec = JSON.parse(fs.readFileSync(p, 'utf-8'));
  const r = guardSpec(spec);
  const blocks = r.findings.filter(f => f.sev === 'block');
  const warns = r.findings.filter(f => f.sev === 'warn');
  if (blocks.length === 0) { pass++; console.log(`  ✓ c${String(n).padStart(2, '0')} (layer=${r.layer}) OK — ${warns.length} warn`); }
  else { fail++; console.log(`  ✗ c${String(n).padStart(2, '0')} BLOCKED (가드 오류!):`); for (const b of blocks) console.log(`      ${b.where} ${b.id}: "${b.match}" — ${b.reason}`); }
}

console.log('\n=== ② 위조 위반 차단 검증 (block 기대) ===');
const bad = [
  { t: '이 제품은 안전합니다.', layer: 'data', want: 'L-06' },
  { t: '우리 검정은 안전하다.', layer: 'data', want: 'L-06 (단정)' },
  { t: '무독성 색소입니다.', layer: 'data', want: 'L-06 무독성' },
  { t: '필수 항목 28종 불검출', layer: 'data', want: 'bannedExact 28종' },
  { t: '핸들 @melanoir.official 팔로우', layer: 'data', want: 'bannedExact 핸들' },
  { t: '시험성적서 원본을 공개합니다', layer: 'data', want: '성적서 공개' },
  { t: '자극 지수가 낮아 검출되지 않았습니다', layer: 'data', want: 'term-sep (검출 오용)' },
  { t: '가장 안전한 Black을 만든 멜라누아, 자극 지수 0.00', layer: 'declaration', want: 'L-05 레이어' },
  { t: '트러블이 줄어듭니다', layer: 'data', want: '효능주장' },
];
for (const b of bad) {
  const r = guardText(b.t, { layer: b.layer, scope: 'caption' });
  if (r.blocked) { pass++; console.log(`  ✓ blocked [${b.want}]: "${b.t}" → ${r.findings.filter(f => f.sev === 'block').map(f => f.id).join(',')}`); }
  else { fail++; console.log(`  ✗ NOT blocked [${b.want}]: "${b.t}" (가드 누락!)`); }
}

// 골드가 정당히 쓰는 ‘안전하다’ 인용·메타는 통과해야 (false positive 점검)
console.log('\n=== ③ 정당 사용 통과 검증 (block 안 됨 기대) ===');
const ok = [
  { t: "‘안전하다’고 말하는 대신 측정된 값으로 보여주기 위해서입니다.", layer: 'declaration', want: '인용 메타' },
  { t: '지구에서 가장 안전한 Black을 추구합니다.', layer: 'declaration', want: '슬로건(추구)' },
  { t: '유해물질 자가품질검사 결과 필수 항목 모두 검출되지 않음(N.D.)', layer: 'data', want: '검출=유해물질 맥락' },
];
for (const o of ok) {
  const r = guardText(o.t, { layer: o.layer, scope: 'caption' });
  if (!r.blocked) { pass++; console.log(`  ✓ passed [${o.want}]: "${o.t.slice(0, 30)}..."`); }
  else { fail++; console.log(`  ✗ false-block [${o.want}]: "${o.t}" → ${r.findings.filter(f => f.sev === 'block').map(f => f.id + ':' + f.match).join(',')}`); }
}

console.log(`\n=== guard verify: ${pass} pass / ${fail} fail ===`);
process.exit(fail ? 1 : 0);
