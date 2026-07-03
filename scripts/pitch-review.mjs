#!/usr/bin/env node
// pitch-review.mjs — 피칭 앵글 승인 → 토픽 큐 편입 (기획 발굴의 출구).
//   승인된 앵글을 brand-dna.json 의 topics 에 추가(id 자동, source='pitch') → /melanoir-story <새id> 로 집필 가능.
//   승인 = 사람의 결정. 이 스크립트는 로컬 편입만 담당(에이전트 자동 편입 금지).
// 사용:
//   --list [pitches.json]        채점과 함께 앵글 나열 (기본 out/pitches.json)
//   --approve <n> [pitches.json] n번째(1-base) 앵글을 topics 에 편입
// 옵션: --style 로 앵글 style 덮어쓰기.
import fs from 'node:fs';
import path from 'node:path';
import { ui, ROOT } from './_lib.mjs';
import { scorePitches } from '../engine/pitch.mjs';

const DNA_PATH = path.join(ROOT, 'brand', 'brand-dna.json');
const argv = process.argv.slice(2);
const val = f => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const file = argv.find(a => !a.startsWith('--') && a.endsWith('.json')) || path.join(ROOT, 'out', 'pitches.json');

function load() { return JSON.parse(fs.readFileSync(file, 'utf-8')).pitches || []; }

if (argv.includes('--approve')) {
  const n = Number(val('--approve'));
  const pitches = load();
  const p = pitches[n - 1];
  if (!p) { ui.err(`앵글 ${n} 없음 (1~${pitches.length})`); process.exit(2); }
  const dna = JSON.parse(fs.readFileSync(DNA_PATH, 'utf-8'));
  const nextId = Math.max(0, ...dna.topics.map(t => t.id)) + 1;
  const layerByStyle = { essay: 'declaration', column: 'data', feature: 'data' };
  const topic = {
    id: nextId, title: p.title, kind: '발굴/피칭', layer: layerByStyle[p.style] || 'data',
    thesis: p.thesis, source: 'pitch', pitchStyle: p.style,
    whyNow: p.whyNow, researchPlan: p.researchPlan,
  };
  dna.topics.push(topic);
  fs.writeFileSync(DNA_PATH, JSON.stringify(dna, null, 2) + '\n');
  ui.ok(`토픽 #${nextId} 편입 — "${p.title}" (style=${p.style}, layer=${topic.layer})`);
  ui.dim(`  집필: node engine/story.mjs --brief ${nextId} --style ${p.style}${p.style === 'column' ? '' : ''}`);
} else {
  const { rows, passCount, total } = scorePitches(file);
  ui.info(`피칭 ${total}개 · 채점 통과 ${passCount}`);
  const pitches = load();
  rows.forEach((r, i) => {
    console.log(`\n[${i + 1}] ${r.pass ? '✅' : '⚠'} ${r.score}/5 · (${r.style}) ${r.title}`);
    console.log(`    thesis: ${pitches[i].thesis}`);
    if (r.flags.length) console.log(`    flags: ${r.flags.join(' · ')}`);
    console.log(`    → 편입: node scripts/pitch-review.mjs --approve ${i + 1}`);
  });
}
