#!/usr/bin/env node
// research-scorecard.mjs — 취재(발굴) 성능 상시 지표. fact_candidates 를 집계해 기자의 발굴 품질을 수치화.
//   측정: 승인율(approved/total) · 원출처 도달률(peer-reviewed+institution 비율) · 인용 완결성(quote·url·publisher 구비율)
//        · 병합 반영률(merged) · 반려 사유(note). 라이브 creds 필요 — 없으면 로컬 도시어 pendingFacts 로 정합성만.
// 사용: node scripts/research-scorecard.mjs [--json]   ·   node scripts/research-scorecard.mjs --local out/dossier_99.json
import fs from 'node:fs';
import path from 'node:path';
import { sbEnv, hasCreds, sbSelect, ui, ROOT } from './_lib.mjs';

const argv = process.argv.slice(2);
const AS_JSON = argv.includes('--json');
const localFile = argv.indexOf('--local') >= 0 ? argv[argv.indexOf('--local') + 1] : null;
const pct = (a, b) => b ? Math.round((a / b) * 100) : 0;
const TIER1 = new Set(['peer-reviewed', 'institution']); // 원출처(1차) 위계

function scoreRows(rows) {
  const total = rows.length;
  const by = k => rows.filter(k).length;
  const approved = by(r => r.status === 'approved');
  const rejected = by(r => r.status === 'rejected');
  const pending = by(r => r.status === 'pending');
  const merged = by(r => r.merged);
  const tier1 = by(r => TIER1.has(r.reliability));
  const withUrl = by(r => !!r.url);
  const withQuote = by(r => !!r.quote);
  const withPublisher = by(r => !!r.publisher);
  const complete = by(r => r.url && r.quote && r.publisher && r.value); // 인용 완결(대조 가능)
  return {
    total, approved, rejected, pending, merged,
    approvalRate: pct(approved, approved + rejected),      // 승인/처리(대기 제외)
    sourceReach: pct(tier1, total),                        // 원출처(1차) 도달률
    citationCompleteness: pct(complete, total),            // 대조 가능한 완결 인용 비율
    mergeRate: pct(merged, approved),                      // 승인분의 verified-sources 반영률
    fields: { url: pct(withUrl, total), quote: pct(withQuote, total), publisher: pct(withPublisher, total) },
    rejectionNotes: rows.filter(r => r.status === 'rejected' && r.note).map(r => r.note),
  };
}

function print(s, srcLabel) {
  if (AS_JSON) { console.log(JSON.stringify(s, null, 2)); return; }
  ui.info(`취재 성능 스코어카드 — ${srcLabel} (후보 ${s.total}건)`);
  console.log(`  승인율            ${s.approvalRate}%  (승인 ${s.approved} / 반려 ${s.rejected} / 대기 ${s.pending})`);
  console.log(`  원출처 도달률     ${s.sourceReach}%  (peer-reviewed+institution / 전체)`);
  console.log(`  인용 완결성       ${s.citationCompleteness}%  (url+quote+publisher+value 구비 = 대조 가능)`);
  console.log(`  병합 반영률       ${s.mergeRate}%  (승인 → verified-sources)`);
  console.log(`  필드 구비         url ${s.fields.url}% · quote ${s.fields.quote}% · publisher ${s.fields.publisher}%`);
  if (s.rejectionNotes.length) { console.log('  반려 사유(학습 신호):'); s.rejectionNotes.forEach(n => console.log('    · ' + n)); }
  console.log('');
  const health = s.total === 0 ? '데이터 없음' : s.citationCompleteness >= 80 && s.sourceReach >= 60 ? '양호' : '개선 여지';
  ui.dim(`  종합: ${health}. (승인율·원출처·완결성이 발굴 품질의 3축)`);
}

async function main() {
  if (localFile) {
    const d = JSON.parse(fs.readFileSync(localFile, 'utf-8'));
    const rows = (d.pendingFacts || []).map(p => ({ status: 'pending', merged: false, reliability: p.reliability, url: p.url, quote: p.quote, publisher: p.publisher, value: p.value }));
    print(scoreRows(rows), `로컬 ${path.basename(localFile)} (제출 전 정합성)`);
    return;
  }
  const env = sbEnv();
  if (!hasCreds(env)) { ui.warn('SUPABASE 키 미설정 — 라이브 집계 불가. 로컬 정합성은 --local <dossier.json>'); process.exit(0); }
  const rows = await sbSelect(env, 'fact_candidates', '?select=status,merged,reliability,url,quote,publisher,value,note');
  print(scoreRows(rows), '라이브 fact_candidates');
}
main().catch(e => { ui.err(e.message); process.exit(1); });
