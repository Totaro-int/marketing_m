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
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { writeInsightCard } from '../engine/insight-card.mjs';
import { guardSpec, guardText, topicLayer } from '../engine/guard.mjs';
import { buildInsightArticle } from '../engine/insight-page.mjs';
import { sbEnv, hasCreds, sbUpsert } from './_lib.mjs';

const BASE_URL = 'https://melanoir.co.kr';
// --target 안에서 git 레포 루트 탐색(.git 위로)
function gitRootOf(start) { let d = path.resolve(start); while (d && d !== path.dirname(d)) { if (fs.existsSync(path.join(d, '.git'))) return d; d = path.dirname(d); } return null; }
// IndexNow — 발행 URL 즉시 색인 통보(네이버·Bing·ChatGPT·Yandex 공유). 키는 도메인 루트에 <key>.txt 로 호스팅.
const INDEXNOW_KEY = '7f3c9e21b8d4f06a5c1e9b3d7f2068ca';
async function pingIndexNow(urls) {
  for (const u of urls) for (const ep of ['https://searchadvisor.naver.com/indexnow', 'https://api.indexnow.org/indexnow']) {
    try { const r = await fetch(`${ep}?url=${encodeURIComponent(u)}&key=${INDEXNOW_KEY}`); console.log(`  IndexNow ${ep.includes('naver') ? 'Naver ' : '공통  '} ${r.status} ${u}`); }
    catch (e) { console.log(`  IndexNow 실패(${ep.includes('naver') ? 'Naver' : '공통'}): ${e.message}`); }
  }
}
// sitemap.xml 에 /insights + /insights/<date> 추가(중복 방지)
function updateSitemap(siteRoot, date) {
  const p = path.join(siteRoot, 'sitemap.xml'); if (!fs.existsSync(p)) return false;
  let xml = fs.readFileSync(p, 'utf-8');
  for (const u of [`${BASE_URL}/insights`, `${BASE_URL}/insights/${date}`]) {
    if (!xml.includes(`<loc>${u}</loc>`)) xml = xml.replace('</urlset>', `  <url><loc>${u}</loc></url>\n</urlset>`);
  }
  fs.writeFileSync(p, xml); return true;
}
// llms.txt — AI 크롤러용 사이트/인사이트 안내(emerging standard)
function writeLlmsTxt(siteRoot, cards) {
  const L = ['# 멜라누아 (Melanoir)', '', '> 반영구 색소·멜라닌 기반 PMU 브랜드. 멜라닌 단일 색소 설계와 공인기관 자가품질검사로 안전을 숫자로 증명한다.', '', '## 인사이트 (Insights)', ''];
  for (const c of [...(cards || [])].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))) {
    if (c.date) L.push(`- [${(c.title || c.date)}](${BASE_URL}/insights/${c.date}): ${c.subtitle || ''}`);
  }
  L.push('', '## 제품 (Products)', `- [엠보 반영구 색소](${BASE_URL}/products/embo)`, '');
  fs.writeFileSync(path.join(siteRoot, 'llms.txt'), L.join('\n'));
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DNA = JSON.parse(fs.readFileSync(path.join(ROOT, 'brand/brand-dna.json'), 'utf-8'));
const CAT = { data: '데이터 인사이트', declaration: '브랜드 인사이트', identity: '브랜드 인사이트', recruit: '인사이트', product: '제품 인사이트', ingredient: '성분 인사이트' };

const argv = process.argv.slice(2);
const specPath = argv.find(a => !a.startsWith('--'));
if (!specPath) { console.error('usage: publish-insight.mjs <specPath> [--date YYYY-MM-DD] [--target dir]'); process.exit(2); }
const di = argv.indexOf('--date'), ti = argv.indexOf('--target');
const date = di >= 0 ? argv[di + 1] : new Date().toISOString().slice(0, 10);
const TARGET = ti >= 0 ? path.resolve(argv[ti + 1]) : path.join(ROOT, 'web', 'site', 'insights');
const si = argv.indexOf('--slug');
const slug = si >= 0 ? argv[si + 1] : null;
const PUSH = argv.includes('--push'); // 자사몰 레포에 commit+push (소유자 쓰기 권한 머신)
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

  // 2b) GEO/SEO 정적 아티클 페이지(검색·AI 노출용 텍스트 본문 + JSON-LD) + sitemap + llms.txt
  const siteRoot = path.resolve(TARGET, '..');
  const art = buildInsightArticle(spec, { baseUrl: BASE_URL, date, slug: date, cardImage: `${BASE_URL}/insights/cards/${imgFile}` });
  if (art.guard.blocked) {
    console.warn('  ⚠ 아티클 guard 차단 — 정적 페이지 생략:', JSON.stringify(art.guard.findings.filter(f => f.sev === 'block')));
  } else {
    fs.writeFileSync(path.join(TARGET, `${date}.html`), art.html);
    const sm = updateSitemap(siteRoot, date);
    writeLlmsTxt(siteRoot, arr);
    const keyFile = path.join(siteRoot, `${INDEXNOW_KEY}.txt`); if (!fs.existsSync(keyFile)) fs.writeFileSync(keyFile, INDEXNOW_KEY);
    console.log(`  GEO/SEO 아티클 → insights/${date}.html (본문 ${art.content.bodyText.length}자 + JSON-LD) · sitemap ${sm ? '갱신' : '없음'} · llms.txt · IndexNow키`);

    // 2c) --push: 자사몰 레포에 commit + push → Vercel 자동 배포 (명령 한 줄 발행)
    if (PUSH) {
      const root = gitRootOf(TARGET);
      if (!root) { console.warn('  ⚠ --push: git 레포 못 찾음 — --target 이 자사몰 클론 안인지 확인'); }
      else {
        const files = [path.join(TARGET, `${date}.html`), path.join(TARGET, 'cards', imgFile), cardsPath, path.join(siteRoot, 'sitemap.xml'), path.join(siteRoot, 'llms.txt'), path.join(siteRoot, `${INDEXNOW_KEY}.txt`)]
          .filter(f => fs.existsSync(f)).map(f => path.relative(root, f));
        spawnSync('git', ['-C', root, 'add', ...files], { stdio: 'inherit' });
        const c = spawnSync('git', ['-C', root, 'commit', '-m', `insight: ${title} (${date})`], { stdio: 'inherit' });
        if (c.status === 0) {
          const p = spawnSync('git', ['-C', root, 'push'], { stdio: 'inherit' });
          console.log(p.status === 0 ? '  ✓ 자사몰 push 완료 → Vercel 자동 배포 (melanoir.co.kr/insights)' : '  ✗ push 실패 — 레포 쓰기 권한/원격 확인');
          if (p.status === 0) { console.log('  IndexNow 색인 통보:'); await pingIndexNow([`${BASE_URL}/insights/${date}`, `${BASE_URL}/insights`]); }
        } else console.log('  (변경 없음 — 이미 발행됨)');
      }
    }
  }

  // 3) 로컬 프리뷰: 타깃에 index.html 이 없을 때만 생성(recruitment 의 자체 페이지는 보존)
  if (!fs.existsSync(path.join(TARGET, 'index.html'))) writePreview(TARGET);

  // 4) 콘솔(marketing_drafts)에 insight 행 — 슬러그가 있으면(daily 캠페인) 5번째 채널로 표시.
  //    카드레터 PNG를 Storage에 올려 콘솔/다운로드용 이미지로 첨부. 발행 자체는 브랜드가 자사몰에 직접.
  const env = sbEnv();
  if (slug && hasCreds(env)) {
    const obj = `insight/${slug}.png`;
    const up = await fetch(`${env.URL}/storage/v1/object/card-images/${obj}`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + env.KEY, apikey: env.KEY, 'content-type': 'image/png', 'x-upsert': 'true' },
      body: fs.readFileSync(path.join(TARGET, 'cards', imgFile)),
    });
    const imgUrl = `${env.URL}/storage/v1/object/public/card-images/${obj}`;
    await sbUpsert(env, 'marketing_drafts', [{
      campaign_slug: slug, channel: 'insight', title,
      body: subtitle, hashtags: [], image_urls: up.ok ? [imgUrl] : [],
      guardian_ok: true, guardian_notes: '인사이트 · 자사몰 직접 발행용(카드 다운로드+요약)', status: 'preview', generated_at: null,
    }], 'campaign_slug,channel');
    console.log(`  → 콘솔 insight 행 upsert (카드 이미지 ${up.ok ? 'OK' : 'HTTP ' + up.status}) · slug ${slug}`);
  }

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
