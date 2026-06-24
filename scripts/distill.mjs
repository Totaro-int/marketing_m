#!/usr/bin/env node
// distill.mjs — 피드백(learnings/_inbox-feedback.json) → 학습 규칙 distill.
//   ① 즉시 주입: learnings/01-distilled.md (generate 가 다음 생성에 자동 주입)
//   ② 주기 검토: learnings/_proposals.json (웹에서 승인 후 지침 반영 — 에이전트 .md 자동 덮어쓰기 금지, §0)
// 사용: node scripts/distill.mjs [--inbox file]
import fs from 'node:fs';
import path from 'node:path';
import { ui, ROOT, sbEnv, hasCreds } from './_lib.mjs';

const argv = process.argv.slice(2);
const inboxPath = argv.indexOf('--inbox') >= 0 ? argv[argv.indexOf('--inbox') + 1] : path.join(ROOT, 'learnings', '_inbox-feedback.json');
const NO_PUSH = argv.includes('--no-push'); // 테스트/오프라인: learnings 테이블 push 생략
const LEARN = path.join(ROOT, 'learnings');
const norm = s => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();

async function main() {
  if (!fs.existsSync(inboxPath)) { ui.warn(`인박스 없음: ${inboxPath} — pull-supabase 먼저(또는 샘플 작성). 종료.`); process.exit(0); }
  const fb = JSON.parse(fs.readFileSync(inboxPath, 'utf-8'));
  const withNote = fb.filter(f => (f.note || '').trim());
  if (!withNote.length) { ui.warn('노트 있는 피드백 없음. 종료.'); process.exit(0); }

  // 노트 → 규칙 후보 (verdict down=dont, up=do). 정규화 텍스트로 dedup + 빈도=weight.
  const byRule = new Map();
  for (const f of withNote) {
    const key = norm(f.note);
    const scope = f.channel || 'global';
    const kind = f.verdict === 'down' ? 'dont' : 'do';
    const id = `${scope}|${kind}|${key}`;
    const cur = byRule.get(id) || { scope, kind, rule: f.note.trim(), weight: 0, sources: [] };
    cur.weight++; if (f.id) cur.sources.push(f.id);
    byRule.set(id, cur);
  }
  const rules = [...byRule.values()].sort((a, b) => b.weight - a.weight);

  // ① 즉시 주입용 .md (generate readLearnings 가 읽음)
  const md = ['# 학습 distill — 피드백 누적 규칙 (자동 생성, 즉시 주입)',
    '> 피드백에서 distill. 웹 승인 전이라도 다음 생성에 참고로 주입된다(에이전트 .md 변경은 아님).', ''];
  for (const r of rules) md.push(`- [${r.kind.toUpperCase()}] (${r.scope}, w${r.weight}) ${r.rule}`);
  fs.writeFileSync(path.join(LEARN, '01-distilled.md'), md.join('\n') + '\n');

  // ② 웹 검토용 proposals: _proposals.json(로컬 기록) + learnings 테이블(active=false → 콘솔 승인 대기)
  const cands = rules.filter(r => r.weight >= 2);
  const proposals = cands.map((r, i) => ({
    id: `d${i + 1}`, title: `${r.kind === 'dont' ? '회피' : '강화'}: ${r.rule.slice(0, 36)}`,
    detail: `피드백 ${r.weight}건 누적 (${r.scope}). 채널/지침 반영 검토.`, scope: r.scope, kind: r.kind, weight: r.weight, status: 'pending',
  }));
  fs.writeFileSync(path.join(LEARN, '_proposals.json'), JSON.stringify(proposals, null, 2));

  ui.ok(`distill 완료 — 규칙 ${rules.length}개 → learnings/01-distilled.md (즉시 주입) · 제안 ${proposals.length}개 → _proposals.json`);
  rules.slice(0, 6).forEach(r => ui.dim(`  [${r.kind}] (${r.scope} w${r.weight}) ${r.rule}`));
  if (NO_PUSH) ui.dim('  (--no-push: learnings 테이블 제안 push 생략)'); else await pushProposals(cands);
}

// 제안 → learnings 테이블(active=false). 기존 규칙/제안과 중복 시 skip. 콘솔 학습탭에서 승인(active=true) → 다음 생성 주입.
async function pushProposals(cands) {
  const env = sbEnv();
  if (!hasCreds(env)) { ui.dim('  Supabase creds 없음 — 제안 테이블 push 건너뜀(_proposals.json 만).'); return; }
  const auth = { apikey: env.KEY, Authorization: 'Bearer ' + env.KEY };
  let existing = [];
  try { existing = await (await fetch(env.URL + '/rest/v1/learnings?select=scope,kind,rule', { headers: auth })).json(); }
  catch (e) { ui.warn('  learnings 조회 실패 — push 건너뜀: ' + e.message); return; }
  const seen = new Set((existing || []).map(r => `${norm(r.scope)}|${norm(r.kind)}|${norm(r.rule)}`));
  const rows = cands.filter(r => !seen.has(`${norm(r.scope)}|${norm(r.kind)}|${norm(r.rule)}`))
    .map(r => ({ scope: r.scope, kind: r.kind, rule: r.rule, weight: r.weight, active: false }));
  if (!rows.length) { ui.dim('  새 제안 없음(모두 기존 규칙/제안과 중복).'); return; }
  const res = await fetch(env.URL + '/rest/v1/learnings', { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify(rows) });
  if (res.ok) ui.ok(`  제안 ${(await res.json()).length}개 → learnings(active=false) — 콘솔 학습탭 승인 대기.`);
  else ui.warn(`  제안 push 실패: ${res.status} ${await res.text()}`);
}

main().catch(e => { ui.err(String(e && e.stack || e)); process.exit(1); });
