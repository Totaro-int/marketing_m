#!/usr/bin/env node
// fact-candidates.mjs — 인용락 승인 대기열 운영 (JOURNALIST-PLAN §4).
//   기자 에이전트가 취재한 새 사실 후보 → Supabase fact_candidates → 승인 → verified-sources 병합.
//   승인 경로 2개: 웹 콘솔(anon update status) 또는 여기 --approve/--reject (로컬 service_role).
// 사용:
//   --submit <dossier.json|draft.json>   도시어의 pendingFacts[] 를 제출 (dedup: url+value)
//   --list [--all]                       대기열 (기본 pending, --all 전체)
//   --approve <id> / --reject <id> [--note "..."]
//   --pull                               approved & !merged → brand/verified-sources.json 병합(VS-###) + merged 마킹
// 의존성 0 (Node fetch). creds 없으면 graceful 안내.
import fs from 'node:fs';
import path from 'node:path';
import { sbEnv, hasCreds, sbHeaders, sbSelect, ui, ROOT } from './_lib.mjs';

const VS_PATH = path.join(ROOT, 'brand', 'verified-sources.json');
const argv = process.argv.slice(2);
const has = f => argv.includes(f);
const val = f => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const env = sbEnv();
if (!hasCreds(env)) { ui.err('SUPABASE_URL / SUPABASE_SERVICE_KEY 필요 (.env.local)'); process.exit(2); }
const H = { ...sbHeaders(env.KEY), 'Content-Type': 'application/json' };
const T = `${env.URL}/rest/v1/fact_candidates`;

async function submit(file) {
  const d = JSON.parse(fs.readFileSync(file, 'utf-8'));
  const pend = d.pendingFacts || [];
  if (!pend.length) { ui.warn('pendingFacts 없음 — 제출할 후보가 없습니다.'); return; }
  const existing = await sbSelect(env, 'fact_candidates', '?select=url,value');
  const seen = new Set(existing.map(r => `${r.url}|${r.value}`));
  const rows = pend
    .filter(p => !seen.has(`${p.url}|${p.value}`))
    .map(p => ({
      claim: p.claim, value: p.value ?? null, quote: p.quote ?? null,
      source_title: p.sourceTitle ?? null, publisher: p.publisher ?? null,
      published_at: p.publishedAt ?? null, url: p.url ?? null, reliability: p.reliability ?? null,
      dossier_ref: `dossier_${String(d.id).padStart(2, '0')}`, submitted_by: d.voice === 'storyteller' ? 'melanoir-storyteller' : 'melanoir-journalist',
    }));
  if (!rows.length) { ui.warn(`전부 이미 제출됨 (${pend.length}건 중복).`); return; }
  const r = await fetch(T, { method: 'POST', headers: H, body: JSON.stringify(rows) });
  if (!r.ok) throw new Error(`insert ${r.status}: ${await r.text()}`);
  ui.ok(`제출 완료 — ${rows.length}건 (pending). 콘솔 '사실 검증' 탭 또는 --approve <id> 로 승인.`);
}

async function list(all) {
  const q = all ? '?order=created_at.desc&limit=50' : '?status=eq.pending&order=created_at.desc';
  const rows = await sbSelect(env, 'fact_candidates', q + (all ? '' : '&select=*'));
  if (!rows.length) { ui.info(all ? '후보 없음.' : '대기(pending) 후보 없음.'); return; }
  for (const r of rows) {
    const flag = r.status === 'pending' ? '◻' : r.status === 'approved' ? (r.merged ? '✅' : '✔ (미병합)') : '✗';
    console.log(`${flag} [${r.status}] ${r.id.slice(0, 8)} · ${r.claim?.slice(0, 60)}${(r.claim || '').length > 60 ? '…' : ''}`);
    console.log(`     value=${r.value ?? '-'} · ${r.publisher ?? '?'} (${r.published_at ?? '?'}) · ${r.reliability ?? '?'} · ${r.url ?? '-'}`);
  }
  ui.dim(`총 ${rows.length}건. 승인: --approve <id 앞8자리도 가능> · 병합: --pull`);
}

async function resolveId(part) {
  const rows = await sbSelect(env, 'fact_candidates', `?select=id`);
  const hit = rows.filter(r => r.id.startsWith(part));
  if (hit.length !== 1) throw new Error(`id '${part}' ${hit.length ? '중복' : '없음'}`);
  return hit[0].id;
}

async function setStatus(part, status, note) {
  const id = await resolveId(part);
  const r = await fetch(`${T}?id=eq.${id}`, { method: 'PATCH', headers: H, body: JSON.stringify({ status, ...(note ? { note } : {}) }) });
  if (!r.ok) throw new Error(`update ${r.status}: ${await r.text()}`);
  ui.ok(`${status} — ${id.slice(0, 8)}${status === 'approved' ? '. 병합하려면 --pull' : ''}`);
}

async function pull() {
  const rows = await sbSelect(env, 'fact_candidates', '?status=eq.approved&merged=eq.false');
  if (!rows.length) { ui.info('병합할 승인 후보 없음.'); return; }
  const reg = JSON.parse(fs.readFileSync(VS_PATH, 'utf-8'));
  let n = Math.max(0, ...reg.sources.map(s => Number((s.id || '').replace('VS-', '')) || 0));
  const today = new Date().toISOString().slice(0, 10);
  for (const r of rows) {
    n += 1;
    reg.sources.push({
      id: `VS-${String(n).padStart(3, '0')}`, claim: r.claim, value: r.value ?? undefined,
      quote: r.quote ?? undefined, sourceTitle: r.source_title ?? undefined, publisher: r.publisher ?? undefined,
      publishedAt: r.published_at ?? undefined, url: r.url ?? undefined, reliability: r.reliability ?? undefined,
      approvedAt: today, active: true,
    });
    const pr = await fetch(`${T}?id=eq.${r.id}`, { method: 'PATCH', headers: H, body: JSON.stringify({ merged: true }) });
    if (!pr.ok) throw new Error(`merged 마킹 실패 ${pr.status}`);
  }
  fs.writeFileSync(VS_PATH, JSON.stringify(reg, null, 2) + '\n');
  ui.ok(`병합 완료 — ${rows.length}건 → brand/verified-sources.json (VS-${String(n).padStart(3, '0')} 까지). 이제 factRefs 로 사용 가능.`);
}

const main = async () => {
  if (has('--submit')) return submit(val('--submit'));
  if (has('--approve')) return setStatus(val('--approve'), 'approved', val('--note'));
  if (has('--reject')) return setStatus(val('--reject'), 'rejected', val('--note'));
  if (has('--pull')) return pull();
  return list(has('--all'));
};
main().catch(e => { ui.err(e.message); process.exit(1); });
