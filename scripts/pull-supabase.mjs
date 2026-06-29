#!/usr/bin/env node
// pull-supabase.mjs — Supabase → 로컬: 웹 피드백·소스를 가져와 학습 입력으로 떨군다.
//   [웹 콘솔 피드백/소스] ──pull──► learnings/_inbox-feedback.json · brand/_pulled-guidelines.txt
// 그다음 distill(scripts/distill.mjs)이 learnings/ 규칙으로 승격 → generate 주입.
// env 없으면 graceful skip. 사용: node scripts/pull-supabase.mjs [--dry-run]
import fs from 'node:fs';
import path from 'node:path';
import { sbEnv, hasCreds, sbSelect, ui, ROOT } from './_lib.mjs';

const DRY = process.argv.includes('--dry-run');
const env = sbEnv();

async function main() {
  if (!hasCreds(env)) {
    ui.warn('SUPABASE_URL / SUPABASE_SERVICE_KEY 미설정 — pull 건너뜀 (로컬 단독 동작 유지).');
    ui.dim('  .env.local 에 키 넣으면 활성화.');
    process.exit(0);
  }
  ui.info(`Supabase pull — ${env.URL}`);
  const feedback = await sbSelect(env, 'feedback', 'select=*&order=created_at.asc');
  const sources = await sbSelect(env, 'sources', 'kind=eq.guideline&active=eq.true&select=*');
  const learnings = await sbSelect(env, 'learnings', 'active=eq.true&select=scope,kind,rule,weight&order=weight.desc');
  ui.dim(`  feedback ${feedback.length}건 · 활성 지침 ${sources.length}개 · 승인 학습 ${learnings.length}개`);

  if (DRY) { ui.ok(`[DRY-RUN] 받을 데이터: feedback ${feedback.length} · guidelines ${sources.length} · 승인학습 ${learnings.length} (저장 안 함)`); return; }

  // 피드백 인박스 (distill 입력) — 백업 후 기록 (사용자 편집 덮지 않게 스냅샷)
  const inbox = path.join(ROOT, 'learnings', '_inbox-feedback.json');
  if (fs.existsSync(inbox)) fs.copyFileSync(inbox, inbox + '.bak');
  fs.writeFileSync(inbox, JSON.stringify(feedback, null, 2));

  // 활성 지침 → 로컬 (생성 주입 참고)
  if (sources.length) {
    const txt = sources.map(s => s.text).filter(Boolean).join('\n\n');
    fs.writeFileSync(path.join(ROOT, 'brand', '_pulled-guidelines.txt'), txt);
  }

  // 승인된 학습(콘솔 active=true) → learnings/00-approved.md — generate readLearnings 가 매 생성 자동 주입.
  // (즉시경로 01-distilled.md = 원피드백 distill, 이건 사람이 승인한 확정 규칙)
  const apPath = path.join(ROOT, 'learnings', '00-approved.md');
  if (learnings.length) {
    const md = ['# 승인된 학습 규칙 (콘솔에서 승인 active=true — 매 생성 자동 주입)', ''];
    for (const r of learnings) md.push(`- [${String(r.kind || 'do').toUpperCase()}] (${r.scope || 'global'}, w${r.weight || 1}) ${r.rule}`);
    fs.writeFileSync(apPath, md.join('\n') + '\n');
  } else if (fs.existsSync(apPath)) fs.rmSync(apPath); // 승인 0건 → 정리

  ui.ok(`완료 — feedback → _inbox-feedback.json · 지침 → _pulled-guidelines.txt · 승인학습 → learnings/00-approved.md. 다음: distill.mjs`);
}
main().catch(e => { ui.err(e.message); process.exit(1); });
