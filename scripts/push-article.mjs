#!/usr/bin/env node
// push-article.mjs — 작가·기자 도시어(final_article_NN.json)를 Supabase 콘솔로 전송.
//   marketing_drafts channel='article' — 기존 콘솔·피드백·학습 루프를 그대로 탄다.
//   body = 검토용 markdown(참고 문헌 포함), spec = dossier 원본(JSON — 콘솔 아티클 뷰·파생용).
// 사용: node scripts/push-article.mjs <final_article_NN.json> [--slug s] [--dry-run]
import fs from 'node:fs';
import path from 'node:path';
import { sbEnv, hasCreds, sbUpsert, ui, ROOT } from './_lib.mjs';
import { guardArticle } from '../engine/guard.mjs';
import { dossierToMarkdown } from '../engine/story.mjs';

const argv = process.argv.slice(2);
const DRY = argv.includes('--dry-run');
const p = argv.find(a => !a.startsWith('--'));
const slugArg = argv.indexOf('--slug') >= 0 ? argv[argv.indexOf('--slug') + 1] : null;
if (!p) { ui.err('usage: push-article.mjs <final_article_NN.json> [--slug s] [--dry-run]'); process.exit(2); }

const d = JSON.parse(fs.readFileSync(p, 'utf-8'));
const id2 = String(d.id).padStart(2, '0');
const slug = slugArg || `article_${id2}-${(d.title || d.topic || '').slice(0, 24).replace(/\s+/g, '-')}`;
const g = guardArticle(d);
const blocks = g.findings.filter(f => f.sev === 'block').length, warns = g.findings.filter(f => f.sev === 'warn').length;
if (g.blocked) { ui.err(`guard BLOCKED (${blocks}) — push 중단. story.mjs --finalize 로 확인.`); process.exit(1); }
if (g.pending) { ui.err(`미승인 사실 후보 ${g.pending}건 — push 중단(draft). fact-candidates 승인 → --pull 후 재시도.`); process.exit(3); }
if (d._generated === 'skeleton-offline' && !argv.includes('--force')) { ui.err('스켈레톤(테스트용) — push 거부. (--force 로만)'); process.exit(2); }

const row = {
  campaign_slug: slug, channel: 'article', title: d.title || d.topic,
  body: dossierToMarkdown(d), hashtags: [], image_urls: [],
  spec: d, // 콘솔 아티클 뷰 + 파생(--dossier) 원본
  guardian_ok: true, guardian_notes: `통과 · block 0 / warn ${warns} · ${g.chars}자 · ${d.style}`,
  status: 'preview', generated_at: null,
};

async function main() {
  const env = sbEnv();
  if (DRY) { ui.info(`[DRY-RUN] slug=${slug} · style=${d.style} · ${g.chars}자`); return; }
  if (!hasCreds(env)) { ui.warn('SUPABASE 키 미설정 — push 건너뜀.'); process.exit(0); }
  await sbUpsert(env, 'marketing_drafts', [row], 'campaign_slug,channel');
  ui.ok(`완료 — article 1 upsert (${slug}). 콘솔에서 검토·승인하면 파생(--dossier)·인사이트 발행 가능.`);
}
main().catch(e => { ui.err(e.message); process.exit(1); });
