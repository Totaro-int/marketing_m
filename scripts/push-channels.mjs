#!/usr/bin/env node
// push-channels.mjs — 채널 카피(channels_NN.json)를 Supabase marketing_drafts 채널별 행으로 전송.
// IG 캐러셀과 같은 campaign_slug로 묶임 → 콘솔 오늘발행에 채널별로 표시(복붙용). env 없으면 skip.
// 사용: node scripts/push-channels.mjs <channelsFile> --slug <slug> [--dry-run]
import fs from 'node:fs';
import path from 'node:path';
import { sbEnv, hasCreds, sbUpsert, ui, ROOT } from './_lib.mjs';
import { finalizeChannels } from '../engine/channels.mjs';

const argv = process.argv.slice(2);
const DRY = argv.includes('--dry-run');
const file = argv.find(a => !a.startsWith('--'));
const slug = argv.indexOf('--slug') >= 0 ? argv[argv.indexOf('--slug') + 1] : null;
if (!file || !slug) { ui.err('usage: push-channels.mjs <channelsFile> --slug <slug> [--dry-run]'); process.exit(2); }

const env = sbEnv();
const r = finalizeChannels(file);
const rows = [];
for (const [ch, x] of Object.entries(r.channels)) {
  if (x.missing) { ui.warn(`${ch}: 누락 — 건너뜀`); continue; }
  rows.push({
    campaign_slug: slug, channel: ch, title: x.title || null,
    body: x.body || '', hashtags: x.hashtags || [], image_urls: [],
    guardian_ok: !x.blocked, guardian_notes: `${x.blocked ? '차단' : '통과'} · ${x.chars}자`,
    status: x.blocked ? 'drafting' : 'preview', generated_at: null,
  });
}

async function main() {
  if (DRY) {
    ui.info(`[DRY-RUN] push-channels — slug=${slug} · ${rows.length}채널`);
    rows.forEach(r => ui.dim(`  ${r.channel.padEnd(11)} ${r.body.length}자 · 태그 ${r.hashtags.length} · guardian ${r.guardian_ok ? '✓' : '✗'}`));
    return;
  }
  if (r.blocked) { ui.err('채널 guard 차단 — 전송 중단. (finalize 위반 확인)'); process.exit(1); }
  if (!hasCreds(env)) { ui.warn('Supabase 키 미설정 — push-channels 건너뜀.'); process.exit(0); }
  await sbUpsert(env, 'marketing_drafts', rows, 'campaign_slug,channel');
  ui.ok(`완료 — ${rows.length}채널 upsert (${rows.map(r => r.channel).join(', ')}). 콘솔에서 확인.`);
}
main().catch(e => { ui.err(e.message); process.exit(1); });
