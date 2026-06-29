#!/usr/bin/env node
// insight-page.mjs — 인사이트를 GEO/SEO 정적 아티클 HTML로 생성.
//   AI 검색(ChatGPT·Perplexity·Gemini·Google AI)과 일반 검색 양쪽 노출을 위해:
//   ① 정적 텍스트 본문(이미지 아닌 실제 글 = 크롤·AI 인용 가능) ② JSON-LD BlogPosting(구조화)
//   ③ 메타/OG/canonical ④ 자사몰 공통 에셋(../assets) 재사용으로 브랜드 일관성.
//   본문은 캐러셀 spec 슬라이드 텍스트를 조합(이미 guard 통과한 골드 카피).
import { guardText } from './guard.mjs';

const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const firstSentence = s => { s = String(s || '').trim(); const m = s.match(/^[\s\S]*?[.。!?](?=\s|$)/); return (m ? m[0] : s).trim(); };
const clip = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length <= n ? s : s.slice(0, n - 1).trim() + '…'; };

// spec → { title, summary, sections:[{h,paras}], lead, conclusion, bodyText }
export function insightContent(spec) {
  const ins = spec.insight || {};
  const title = (ins.title || spec.topic || `#${spec.id}`).trim();
  const lead = (ins.subtitle || firstSentence(spec.thesis || '')).trim();
  const sections = [];
  for (const s of spec.slides || []) {
    if (s.type === 'body') {
      const paras = (s.segments || []).map(seg => Array.isArray(seg) ? seg[0] : seg).map(x => String(x || '').trim()).filter(Boolean);
      if (paras.length) sections.push({ h: (s.title || '').trim(), paras });
    }
  }
  const closing = (spec.slides || []).find(s => s.type === 'closing');
  const conclusion = closing ? (closing.lines || []).join(' ').trim() : '';
  const bodyText = [lead, ...sections.flatMap(x => [x.h, ...x.paras]), conclusion].filter(Boolean).join(' ');
  return { title, lead, sections, conclusion, bodyText };
}

export function buildInsightArticle(spec, opts = {}) {
  const baseUrl = (opts.baseUrl || 'https://melanoir.co.kr').replace(/\/$/, '');
  const date = opts.date || '';
  const slug = opts.slug || date;
  const cardImage = opts.cardImage || '';                 // 절대 URL(Storage) 또는 cards/<date>.png
  const productUrl = opts.productUrl || `${baseUrl}/products/embo`;
  const url = `${baseUrl}/insights/${slug}`;
  const c = insightContent(spec);
  const desc = clip(c.lead || c.bodyText, 155);

  // 가드: 본문 전체 광고법/브랜드락 (발행 차단용은 호출측에서 처리)
  const guard = guardText(`${c.title} ${c.bodyText}`, { layer: spec.layer || 'data', scope: 'caption' });

  const ld = {
    '@context': 'https://schema.org', '@type': 'BlogPosting',
    headline: clip(c.title, 110), description: desc,
    ...(cardImage ? { image: [cardImage] } : {}),
    datePublished: date, dateModified: date, inLanguage: 'ko',
    author: { '@type': 'Organization', name: '멜라누아', url: baseUrl },
    publisher: { '@type': 'Organization', name: '멜라누아', url: baseUrl, logo: { '@type': 'ImageObject', url: `${baseUrl}/apple-touch-icon.png` } },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    isPartOf: { '@type': 'Blog', name: '멜라누아 인사이트', url: `${baseUrl}/insights` },
    articleBody: c.bodyText, keywords: '반영구 색소, 멜라닌 색소, 반영구화장, PMU, 안전성',
  };

  const sectionsHtml = c.sections.map(s =>
    `      <h2>${esc(s.h)}</h2>\n` + s.paras.map(p => `      <p>${esc(p)}</p>`).join('\n')
  ).join('\n');

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(c.title)} — 멜라누아 인사이트</title>
  <meta name="description" content="${esc(desc)}" />
  <link rel="canonical" href="${esc(url)}" />
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${esc(c.title)}" />
  <meta property="og:description" content="${esc(desc)}" />
  <meta property="og:url" content="${esc(url)}" />
  ${cardImage ? `<meta property="og:image" content="${esc(cardImage)}" />` : ''}
  <meta property="article:published_time" content="${esc(date)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <link rel="icon" href="/favicon-32.png" type="image/png" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="stylesheet" crossorigin href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css" />
  <link rel="stylesheet" href="../assets/design-tokens.css" />
  <link rel="stylesheet" href="../assets/melanoir-shell.css" />
  <link rel="stylesheet" href="../assets/melanoir-subpage-header.css" />
  <link rel="stylesheet" href="../assets/mnr-ui.css" />
  <link rel="stylesheet" href="../assets/melanoir-lang.css" />
  <link rel="stylesheet" href="insights.css" />
  <script type="application/ld+json">${JSON.stringify(ld)}</script>
  <style>
    .insight-article{max-width:760px;margin:0 auto;padding:48px 22px 80px;line-height:1.85;font-size:17px;color:#1f1f22}
    .insight-article h1{font-size:30px;line-height:1.35;letter-spacing:-.02em;margin:0 0 10px}
    .insight-article .ia-meta{color:#8a8a90;font-size:13.5px;margin:0 0 24px;padding-bottom:18px;border-bottom:1px solid #eee}
    .insight-article .ia-lead{font-size:19px;color:#2a2a2e;margin:0 0 26px}
    .insight-article h2{font-size:20px;margin:34px 0 12px;letter-spacing:-.01em}
    .insight-article p{margin:0 0 16px}
    .insight-article figure{margin:26px 0;text-align:center}
    .insight-article figure img{width:100%;max-width:480px;border-radius:14px}
    .insight-article .ia-cta{margin-top:34px;padding-top:22px;border-top:1px solid #eee;font-size:15px}
    .insight-article .ia-cta a{color:#9c7a23;font-weight:600;text-decoration:none}
  </style>
</head>
<body class="insights">
  <header data-mnr-header data-theme="dark" data-current="insights"></header>
  <main>
    <article class="insight-article">
      <h1>${esc(c.title)}</h1>
      <p class="ia-meta">멜라누아 인사이트 · ${esc(date)}</p>
      ${c.lead ? `<p class="ia-lead">${esc(c.lead)}</p>` : ''}
      ${cardImage ? `<figure><img src="${esc(cardImage)}" alt="${esc(c.title)}" loading="lazy" /></figure>` : ''}
${sectionsHtml}
      ${c.conclusion ? `<p>${esc(c.conclusion)}</p>` : ''}
      <p class="ia-cta">멜라누아의 시험 기준·데이터는 <a href="${esc(productUrl)}">제품 페이지</a>에서 확인하실 수 있습니다.</p>
    </article>
  </main>
  <script src="../assets/mnr-ui.js"></script>
  <script src="../assets/mnr-nav.js"></script>
  <script src="../assets/melanoir-lang.js"></script>
</body>
</html>
`;
  return { html, url, slug, content: c, ld, guard };
}
