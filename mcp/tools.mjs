// mcp/tools.mjs — 멜라누아 MCP 도구(서버사이드 로직). Supabase service_role 키는 **서버**의 .env.local 에만.
// 모델: 클라 Claude(구독)가 카피(spec/channels)를 작성 → 이 도구로 finalize·guard·push.
//   렌더(IG 카드)는 브라우저 카드 편집기. 키는 클라 머신에 두지 않음(보안).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { guardSpec } from '../engine/guard.mjs';
import { finalizeSpec } from '../engine/generate.mjs';
import { finalizeChannels } from '../engine/channels.mjs';
import { pickNextTopic } from '../scripts/topic-queue.mjs';
import { sbEnv, hasCreds } from '../scripts/_lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const node = process.execPath;

// 캠페인/드래프트 현황(콘솔과 동일 데이터)
export async function status() {
  const e = sbEnv(); if (!hasCreds(e)) return { error: 'Supabase creds 없음(서버 .env.local)' };
  const H = { apikey: e.KEY, Authorization: 'Bearer ' + e.KEY };
  const rows = await (await fetch(`${e.URL}/rest/v1/marketing_drafts?select=campaign_slug,channel,status&order=updated_at.desc`, { headers: H })).json();
  const g = {};
  for (const x of rows) { (g[x.campaign_slug] = g[x.campaign_slug] || { channels: new Set(), status: x.status }).channels.add(x.channel); }
  return { campaigns: Object.entries(g).map(([slug, v]) => ({ slug, channels: [...v.channels], status: v.status })) };
}

// 다음 토픽(큐)
export async function topicNext() { return { topicId: await pickNextTopic() }; }

// 캐러셀 스펙 → 이미지배정+캡션+가드 (canvas 불필요)
export function finalize(spec) {
  const { spec: f, guard } = finalizeSpec(spec);
  return { ok: !guard.blocked, final: f, guard: { blocked: guard.blocked, findings: guard.findings.filter(x => x.sev === 'block') } };
}

// 채널 카피 → 채널별 가드
export function guardChannels(channels, topicId) {
  const r = finalizeChannels({ channels }, String(topicId));
  return { ok: !r.blocked, channels: r.channels, blocked: r.blocked };
}

// 발행: Supabase로 push (service_role = 서버). final/channels 는 클라가 작성해 전달.
export function push(final, channels, slug) {
  const e = sbEnv(); if (!hasCreds(e)) return { ok: false, error: 'Supabase creds 없음' };
  const tmp = path.join(ROOT, 'out', '_mcp'); fs.mkdirSync(tmp, { recursive: true });
  const sf = path.join(tmp, 'final.json'); fs.writeFileSync(sf, JSON.stringify(final));
  const r1 = spawnSync(node, [path.join(ROOT, 'scripts', 'push-supabase.mjs'), sf, '--slug', slug], { encoding: 'utf-8' });
  let r2 = { status: 0, stdout: '(채널 없음)' };
  if (channels) { const cf = path.join(tmp, 'channels.json'); fs.writeFileSync(cf, JSON.stringify({ channels })); r2 = spawnSync(node, [path.join(ROOT, 'scripts', 'push-channels.mjs'), cf, '--slug', slug], { encoding: 'utf-8' }); }
  return { ok: r1.status === 0 && r2.status === 0, ig: (r1.stdout || r1.stderr || '').trim().split('\n').pop(), channels: (r2.stdout || '').trim().split('\n').pop() };
}

export const TOOLS = { status, topicNext, finalize, guardChannels, push };
