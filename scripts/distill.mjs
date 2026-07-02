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

// 규칙 후보를 byRule 맵에 누적(정규화 텍스트로 dedup, 빈도=weight). 노트·편집 신호가 같은 파이프라인을 공유.
function addRule(byRule, { scope, kind, rule }, srcId) {
  const id = `${scope}|${kind}|${norm(rule)}`;
  const cur = byRule.get(id) || { scope, kind, rule: rule.trim(), weight: 0, sources: [] };
  cur.weight++; if (srcId) cur.sources.push(srcId);
  byRule.set(id, cur);
}

// 편집(원본 → 수정본) diff → 반복 가능한 do/dont 신호. 결정론적 휴리스틱(LLM 없이 규칙화).
//   여러 편집에서 같은 신호가 반복되면 weight 누적 → 규칙으로 승격된다.
function editSignals(orig, edited, scope) {
  const out = [];
  const o = String(orig || ''), e = String(edited || '');
  const oLen = o.length, eLen = e.length;
  const ratio = oLen ? (eLen - oLen) / oLen : 0;
  if (ratio <= -0.12) out.push({ scope, kind: 'do', rule: '카피를 더 짧고 간결하게 — 불필요한 문장 덜어내기' });
  else if (ratio >= 0.12) out.push({ scope, kind: 'do', rule: '설명·맥락을 한 줄 더 보강하기' });

  const sents = s => (s.match(/[^.!?。\n]+[.!?。]?/g) || []).filter(x => x.trim().length > 1).length;
  if (sents(e) < sents(o)) out.push({ scope, kind: 'do', rule: '문장 수를 줄여 한 문장을 짧게 유지' });

  const nums = s => (s.match(/\d+(?:[.,]\d+)?\s*%?/g) || []).length;
  if (nums(e) > nums(o)) out.push({ scope, kind: 'do', rule: '구체적 수치·근거를 한 줄 추가' });

  const emo = s => (s.match(/\p{Extended_Pictographic}/gu) || []).length;
  if (emo(e) < emo(o)) out.push({ scope, kind: 'dont', rule: '이모지 남용 줄이기(과한 이모지 삭제)' });

  const excl = s => (s.match(/!/g) || []).length;
  if (excl(e) < excl(o)) out.push({ scope, kind: 'dont', rule: '느낌표·과장 톤 줄이기' });
  return out;
}

async function main() {
  if (!fs.existsSync(inboxPath)) { ui.warn(`인박스 없음: ${inboxPath} — pull-supabase 먼저(또는 샘플 작성). 종료.`); process.exit(0); }
  const fb = JSON.parse(fs.readFileSync(inboxPath, 'utf-8'));
  const withNote = fb.filter(f => (f.note || '').trim());
  // 편집 신호: verdict='edit' 또는 edited_body 존재 + 원본 있고 실제로 달라진 행.
  const editRows = fb.filter(f => (f.verdict === 'edit' || f.edited_body) && f.original_body && f.edited_body && norm(f.original_body) !== norm(f.edited_body));
  if (!withNote.length && !editRows.length) { ui.warn('노트/편집 신호 있는 피드백 없음. 종료.'); process.exit(0); }

  const byRule = new Map();
  // ⓐ 노트 → 규칙 후보 (verdict down=dont, up/그외=do). 정규화 텍스트로 dedup + 빈도=weight.
  for (const f of withNote) {
    addRule(byRule, { scope: f.channel || 'global', kind: f.verdict === 'down' ? 'dont' : 'do', rule: f.note.trim() }, f.id);
  }
  // ⓑ 편집 diff → 규칙 후보. 같은 byRule 맵에 누적되어 dedup/weight/제안 로직을 공유한다.
  for (const f of editRows) {
    for (const sig of editSignals(f.original_body, f.edited_body, f.channel || 'global')) addRule(byRule, sig, f.id);
  }
  const rules = [...byRule.values()].sort((a, b) => b.weight - a.weight);
  ui.dim(`  입력: 노트 ${withNote.length}건 · 편집 ${editRows.length}건 → 규칙 후보 ${rules.length}개`);

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
