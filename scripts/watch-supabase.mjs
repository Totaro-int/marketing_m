#!/usr/bin/env node
// watch-supabase.mjs — Realtime 대용 폴링 워처. feedback/drafts 변경 감지 → pull(+재생성 트리거).
// ws 의존성 0 — REST로 updated_at/created_at > lastSeen 폴링(Node fetch). env 없으면 skip.
// 사용: node scripts/watch-supabase.mjs [--interval 20] [--once] [--dry-run]
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { sbEnv, hasCreds, sbSelect, ui, ROOT } from './_lib.mjs';

const argv = process.argv.slice(2);
const DRY = argv.includes('--dry-run');
const ONCE = argv.includes('--once');
const INTERVAL = Math.max(5, Number(argv[argv.indexOf('--interval') + 1] || 20)) * 1000;
const env = sbEnv();

function runPull() {
  ui.dim('  → pull-supabase.mjs 실행');
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'pull-supabase.mjs')], { stdio: 'inherit' });
  return r.status === 0;
}

async function poll(since) {
  // 가장 최근 feedback created_at 기준 신규 감지
  const q = since ? `created_at=gt.${encodeURIComponent(since)}&select=id,created_at&order=created_at.desc` : 'select=id,created_at&order=created_at.desc&limit=1';
  const rows = await sbSelect(env, 'feedback', q);
  return rows;
}

async function main() {
  if (!hasCreds(env)) {
    ui.warn('SUPABASE_URL / SUPABASE_SERVICE_KEY 미설정 — watch 건너뜀.');
    ui.dim('  .env.local 에 키 넣으면 활성화. 동작 미리보기: --dry-run');
    process.exit(0);
  }
  if (DRY) { ui.ok(`[DRY-RUN] ${INTERVAL / 1000}s 간격으로 feedback 신규행 폴링 → 감지 시 pull 실행 (네트워크 0)`); return; }

  ui.info(`watch — ${env.URL} · ${INTERVAL / 1000}s 폴링 (Ctrl+C 종료)`);
  let last = (await poll())[0]?.created_at || new Date(0).toISOString();
  ui.dim(`  기준 시각: ${last}`);
  const tick = async () => {
    try {
      const fresh = await poll(last);
      if (fresh.length) { ui.ok(`신규 피드백 ${fresh.length}건 감지`); last = fresh[0].created_at; runPull(); }
    } catch (e) { ui.err('poll: ' + e.message); }
  };
  if (ONCE) { await tick(); return; }
  setInterval(tick, INTERVAL);
}
main().catch(e => { ui.err(e.message); process.exit(1); });
