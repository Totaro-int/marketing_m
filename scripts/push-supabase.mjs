#!/usr/bin/env node
// push-supabase.mjs — 생성된 캐러셀(스펙+캡션+렌더 카드)을 Supabase로 전송.
//   [로컬 생성] ──push──► [클라 Supabase marketing_drafts + Storage] ◄── [웹 콘솔]
// 의존성 0(Node fetch). env 없으면 graceful skip(로컬 파이프라인 안 깨짐). --dry-run = payload만.
// 사용: node scripts/push-supabase.mjs <specPath> [--cards <dir>] [--slug <slug>] [--dry-run]
import fs from 'node:fs';
import path from 'node:path';
import { sbEnv, hasCreds, sbUpsert, sbUploadObject, ui, ROOT } from './_lib.mjs';
import { guardSpec } from '../engine/guard.mjs';

const argv = process.argv.slice(2);
const DRY = argv.includes('--dry-run');
const specPath = argv.find(a => !a.startsWith('--'));
const cardsArg = argv.indexOf('--cards') >= 0 ? argv[argv.indexOf('--cards') + 1] : null;
const slugArg = argv.indexOf('--slug') >= 0 ? argv[argv.indexOf('--slug') + 1] : null;
if (!specPath) { ui.err('usage: push-supabase.mjs <specPath> [--cards dir] [--slug s] [--dry-run]'); process.exit(2); }

const env = sbEnv();
const spec = JSON.parse(fs.readFileSync(specPath, 'utf-8'));
const id2 = String(spec.id).padStart(2, '0');
const cardsDir = cardsArg || path.join(ROOT, 'out', `carousel_${id2}`);
const slug = slugArg || `carousel_${id2}-${(spec.topic || '').slice(0, 24).replace(/\s+/g, '-')}`;

// caption → body + hashtags 분리
const caption = spec.caption || '';
const tagLine = caption.split('\n').reverse().find(l => /(^|\s)#/.test(l)) || '';
const hashtags = (tagLine.match(/#[^\s#]+/g) || []);

// 카드 PNG 수집
const cards = fs.existsSync(cardsDir) ? fs.readdirSync(cardsDir).filter(f => /^s\d+\.png$/.test(f)).sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1))) : [];

// guard
const g = guardSpec(spec);
const blocks = g.findings.filter(f => f.sev === 'block').length, warns = g.findings.filter(f => f.sev === 'warn').length;
const row = {
  campaign_slug: slug, channel: 'instagram', title: spec.topic || null,
  body: caption, hashtags, image_urls: [],
  // 브라우저 카드 편집기용 슬라이드 스펙(텍스트·레이아웃). 배경은 편집기에서 교체.
  spec: { id: spec.id, topic: spec.topic, slides: spec.slides },
  guardian_ok: !g.blocked, guardian_notes: `${g.blocked ? '차단' : '통과'} · block ${blocks} / warn ${warns}`,
  status: g.blocked ? 'drafting' : 'preview', generated_at: null,
};

async function main() {
  if (DRY) {
    ui.info(`[DRY-RUN] push 미리보기 — slug=${slug}`);
    const cardUrls = cards.map(f => `${env.URL || '<SUPABASE_URL>'}/storage/v1/object/public/${env.BUCKET}/instagram/${id2}-${f}`);
    ui.dim(JSON.stringify({ ...row, image_urls: cardUrls, body: row.body.slice(0, 60) + (row.body.length > 60 ? '…' : '') }, null, 2));
    ui.ok(`[DRY-RUN] row 1 · 카드 ${cards.length}장 · guardian ${row.guardian_ok ? '✓' : '✗'} (실제 전송 안 함)`);
    return;
  }
  if (!hasCreds(env)) {
    ui.warn('SUPABASE_URL / SUPABASE_SERVICE_KEY 미설정 — push 건너뜀.');
    ui.dim('  .env.local 에 키 넣으면 활성화. payload 미리보기: --dry-run');
    process.exit(0);
  }
  ui.info(`Supabase push — ${slug} · ${env.URL}`);
  for (const f of cards) {
    const url = await sbUploadObject(env, `instagram/${id2}-${f}`, fs.readFileSync(path.join(cardsDir, f)), 'image/png');
    row.image_urls.push(url);
  }
  await sbUpsert(env, 'marketing_drafts', [row], 'campaign_slug,channel');
  ui.ok(`완료 — row 1 upsert · 카드 ${row.image_urls.length}장. guardian ${row.guardian_ok ? '✓ 통과' : '✗ 차단'}. 웹에서 확인.`);
}
main().catch(e => { ui.err(e.message); process.exit(1); });
