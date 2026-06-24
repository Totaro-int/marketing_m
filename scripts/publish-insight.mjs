#!/usr/bin/env node
// publish-insight.mjs — 인사이트 카드(PNG) + cards.json 항목을 insights 디렉터리에 additive로 발행.
// 출력 스키마 = Melanoir1/melanoir-recruitment 의 web/site/insights/cards.json 과 동일:
//   { date, category, handle:"@melanoir", title, subtitle, image:"<date>.png", link }
//   image = 파일명만(페이지가 cards/ 를 붙임). PNG는 텍스트가 구워진 완성 카드레터.
// 타깃: --target <dir> (기본=로컬 web/site/insights). recruitment clone 의 insights 디렉터리를 주면
//   그 레포 index.html/insights.css 는 건드리지 않고 cards.json + cards/<date>.png 만 갱신(additive).
// 발행(라이브): recruitment 는 ted-dylan write 불가 → fork+PR(사장님 머지). 이 스크립트는 PR 직전까지 자동.
// 사용: node scripts/publish-insight.mjs <specPath> [--date YYYY-MM-DD] [--target dir]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeInsightCard } from '../engine/insight-card.mjs';
import { guardSpec, guardText, topicLayer } from '../engine/guard.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DNA = JSON.parse(fs.readFileSync(path.join(ROOT, 'brand/brand-dna.json'), 'utf-8'));
const CAT = { data: '데이터 인사이트', declaration: '브랜드 인사이트', identity: '브랜드 인사이트', recruit: '인사이트', product: '제품 인사이트', ingredient: '성분 인사이트' };

const argv = process.argv.slice(2);
const specPath = argv.find(a => !a.startsWith('--'));
if (!specPath) { console.error('usage: publish-insight.mjs <specPath> [--date YYYY-MM-DD] [--target dir]'); process.exit(2); }
const di = argv.indexOf('--date'), ti = argv.indexOf('--target');
const date = di >= 0 ? argv[di + 1] : new Date().toISOString().slice(0, 10);
const TARGET = ti >= 0 ? path.resolve(argv[ti + 1]) : path.join(ROOT, 'web', 'site', 'insights');
const spec = JSON.parse(fs.readFileSync(specPath, 'utf-8'));

// 토픽 메타(브랜드 SSoT) → 제목/요약/카테고리 기본값
const tmeta = (DNA.topics || []).find(t => String(t.id) === String(spec.id)) || {};
const layer = spec.layer || tmeta.layer || topicLayer(spec.id) || 'data';
const ins = spec.insight || {};
const firstSentence = s => { s = String(s || '').trim(); const m = s.match(/^[\s\S]*?[.。!?](?=\s|$)/); return (m ? m[0] : s).trim(); };
const clip = (s, n) => (s.length <= n ? s : s.slice(0, n - 1).trim() + '…');
const title = (ins.title || tmeta.title || spec.topic || `#${spec.id}`).trim();
const subtitle = clip(ins.subtitle || firstSentence(spec.thesis || tmeta.thesis || ''), 100);
const category = ins.category || CAT[layer] || '인사이트';
const link = ins.link || '';

// 가드: 스펙 전체 + 발행 문구(제목/요약). 위반이면 발행 차단.
const g1 = guardSpec(spec);
if (g1.blocked) { console.error('✗ guard(스펙) BLOCKED:', JSON.stringify(g1.findings.filter(f => f.sev === 'block'))); process.exit(1); }
const g2 = guardText(`${title} ${subtitle}`, { layer, scope: 'caption' });
const g2b = g2.findings.filter(f => f.sev === 'block');
if (g2b.length) { console.error('✗ guard(제목/요약) BLOCKED:', JSON.stringify(g2b)); process.exit(1); }

async function main() {
  fs.mkdirSync(path.join(TARGET, 'cards'), { recursive: true });
  // 1) 카드레터 PNG → cards/<date>.png
  const imgFile = `${date}.png`;
  await writeInsightCard(spec, path.join(TARGET, 'cards', imgFile));

  // 2) cards.json — additive upsert (date 기준), 최신순
  const cardsPath = path.join(TARGET, 'cards.json');
  let arr = [];
  if (fs.existsSync(cardsPath)) { try { arr = JSON.parse(fs.readFileSync(cardsPath, 'utf-8')); } catch { arr = []; } }
  const entry = { date, category, handle: '@melanoir', title, subtitle, image: imgFile, link };
  const i = arr.findIndex(c => c.date === date);
  if (i >= 0) arr[i] = entry; else arr.push(entry);
  arr.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  fs.writeFileSync(cardsPath, JSON.stringify(arr, null, 2) + '\n');

  // 3) 로컬 프리뷰: 타깃에 index.html 이 없을 때만 생성(recruitment 의 자체 페이지는 보존)
  if (!fs.existsSync(path.join(TARGET, 'index.html'))) writePreview(TARGET);

  const isRecruit = fs.existsSync(path.join(TARGET, 'insights.css'));
  console.log(`✓ 인사이트 발행(additive) → ${path.relative(ROOT, TARGET) || TARGET}`);
  console.log(`  cards.json '${date}' · cards/${imgFile} · 총 ${arr.length}개 · guard ✓`);
  console.log(`  제목: "${title}" · 요약: "${subtitle}" · ${category}`);
  if (isRecruit) console.log(`  → recruitment 레포 스키마. 발행: 커밋 후 fork+PR(사장님 머지) → /insights 라이브.`);
}

// cards.json 을 읽어 카드레터 그리드로 렌더하는 최소 프리뷰(recruitment render 로직과 동치)
function writePreview(dir) {
  const html = `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>인사이트 — 멜라누아 (preview)</title>
<style>body{font-family:Pretendard,system-ui,sans-serif;max-width:1100px;margin:0 auto;padding:40px 20px;color:#161616;background:#fafafa}
h1{font-size:24px;margin:0 0 24px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:18px}
.insight-card{display:block;border-radius:14px;overflow:hidden;text-decoration:none;color:inherit;box-shadow:0 1px 8px rgba(0,0,0,.08);position:relative}
.ic-img{width:100%;aspect-ratio:4/5;object-fit:cover;display:block;background:#111}
.ic-datechip{position:absolute;top:10px;left:10px;background:rgba(0,0,0,.55);color:#fff;font-size:11px;padding:3px 8px;border-radius:20px}</style>
</head><body><h1>인사이트 <small style="color:#999;font-size:13px">(로컬 프리뷰 · 실서비스는 recruitment /insights)</small></h1>
<section class="grid" id="g"></section>
<script>fetch('cards.json',{cache:'no-store'}).then(r=>r.json()).then(cs=>{cs.sort((a,b)=>String(b.date).localeCompare(String(a.date)));
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
document.getElementById('g').innerHTML=cs.map(c=>{const img=c.image?'cards/'+esc(c.image):'';return img?
'<a class="insight-card" href="'+(c.link?esc(c.link):img)+'" target="_blank"><img class="ic-img" src="'+img+'" alt="'+esc(c.title)+'" loading="lazy"><time class="ic-datechip">'+esc(c.date)+'</time></a>'
:'<a class="insight-card" href="#" style="background:#111;color:#fff;padding:18px;aspect-ratio:4/5"><span style="font-size:12px;opacity:.6">'+esc(c.category)+'</span><h2 style="font-size:18px;margin:8px 0">'+esc(c.title)+'</h2><p style="font-size:13px;opacity:.8">'+esc(c.subtitle)+'</p></a>';}).join('');});</script>
</body></html>`;
  fs.writeFileSync(path.join(dir, 'index.html'), html);
}
main().catch(e => { console.error(e); process.exit(1); });
