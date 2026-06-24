#!/usr/bin/env node
// topic-queue.mjs — 다음 발행 토픽 자동 선택. "가장 적게(오래) 발행된 토픽" 우선 → 10개를 고르게 순환.
//   라이브: marketing_drafts(instagram) 의 campaign_slug/title 에서 토픽 빈도 집계 → 최소빈도·최소id.
//   오프라인/실패: out/.topic-state.json 로컬 라운드로빈.
// 사용: node scripts/topic-queue.mjs [--list]   ·   import { pickNextTopic } from './topic-queue.mjs'
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { sbEnv, hasCreds } from './_lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TOPICS = (JSON.parse(fs.readFileSync(path.join(ROOT, 'brand/brand-dna.json'), 'utf-8')).topics || [])
  .filter(t => typeof t.id === 'number');
const IDS = TOPICS.map(t => t.id);
const titleOf = id => (TOPICS.find(t => t.id === id) || {}).title || `#${id}`;

function topicIdFromSlug(slug) {
  let m = String(slug || '').match(/daily-\d{4}-\d{2}-\d{2}-(\d{1,2})/); if (m) return +m[1];
  m = String(slug || '').match(/carousel_?(\d{1,2})/); if (m) return +m[1];
  return null;
}
function topicIdFromTitle(title) {
  if (!title) return null;
  const t = TOPICS.find(x => x.title && (title.includes(x.title) || x.title.includes(title)));
  return t ? t.id : null;
}

// 토픽별 발행 빈도(라이브). 실패 시 null.
async function liveCounts(env) {
  const headers = { apikey: env.KEY, Authorization: 'Bearer ' + env.KEY };
  const r = await fetch(`${env.URL}/rest/v1/marketing_drafts?channel=eq.instagram&select=campaign_slug,title`, { headers });
  if (!r.ok) throw new Error('rest ' + r.status);
  const rows = await r.json();
  const counts = new Map(IDS.map(id => [id, 0]));
  for (const row of rows) {
    const id = topicIdFromSlug(row.campaign_slug) ?? topicIdFromTitle(row.title);
    if (id && counts.has(id)) counts.set(id, counts.get(id) + 1);
  }
  return counts;
}

export async function pickNextTopic() {
  const env = sbEnv();
  if (hasCreds(env)) {
    try {
      const counts = await liveCounts(env);
      // 최소 빈도 → 최소 id (미발행 토픽이 먼저, 그다음 가장 적게 발행된 것)
      return [...counts.entries()].sort((a, b) => a[1] - b[1] || a[0] - b[0])[0][0];
    } catch { /* 폴백 */ }
  }
  const sp = path.join(ROOT, 'out', '.topic-state.json');
  let last = 0; try { last = JSON.parse(fs.readFileSync(sp, 'utf-8')).last || 0; } catch { }
  const next = IDS[(IDS.indexOf(last) + 1 + IDS.length) % IDS.length] ?? IDS[0];
  fs.mkdirSync(path.dirname(sp), { recursive: true }); fs.writeFileSync(sp, JSON.stringify({ last: next }));
  return next;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const env = sbEnv();
  if (process.argv.includes('--list') && hasCreds(env)) {
    try {
      const counts = await liveCounts(env);
      console.log('토픽 발행 빈도 (instagram):');
      [...counts.entries()].sort((a, b) => a[1] - b[1] || a[0] - b[0]).forEach(([id, c]) => console.log(`  #${id} ${titleOf(id)} — ${c}회`));
    } catch (e) { console.log('라이브 집계 실패:', e.message); }
  }
  const next = await pickNextTopic();
  console.log(`\n다음 토픽: #${next} — ${titleOf(next)}`);
}
