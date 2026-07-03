#!/usr/bin/env node
// figure.mjs — 도시어 figures 스펙 → 브랜드 스타일 SVG (결정론, LLM 없음, 의존성 0).
//   작가·기자 에이전트는 스펙만 선언하고 여기서 렌더한다 — "이미지를 긁지 말고 데이터를 긁어 자체 도식으로".
//   types: numberCard(대형 숫자+라벨) · bar(가로 막대) · compare(값 대비) · process(단계 도식)
//   색: 렌더 엔진과 동일 SSoT — 순흑 배경 · 골드 rgb(194,161,90) · 회색 rgb(202,202,205) · 흰색.
// 사용: node engine/figure.mjs <dossier.json> [--out out/figures]   ·   import { renderFigure }
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BLACK = '#000000', GOLD = 'rgb(194,161,90)', GRAY = 'rgb(202,202,205)', WHITE = '#ffffff', DIM = 'rgb(120,120,126)';
const FONT = `Pretendard, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif`;
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const W = 1200, H = 675; // 16:9 — 인사이트 본문 인라인 기준
const head = (h = H) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${h}" width="${W}" height="${h}" role="img">
<rect width="${W}" height="${h}" fill="${BLACK}"/>
<rect x="60" y="${h - 78}" width="46" height="3" fill="${GOLD}"/>
<text x="60" y="${h - 44}" font-family="${FONT}" font-size="22" letter-spacing="6" fill="${DIM}">M E L A N O I R</text>`;
const foot = `</svg>`;
const goldLine = (x1, x2, y, w = 4) => `<rect x="${x1}" y="${y}" width="${x2 - x1}" height="${w}" fill="${GOLD}"/>`;

// numberCard — { number, label, sub? }
function numberCard(d) {
  return head() +
    `<text x="${W / 2}" y="330" text-anchor="middle" font-family="${FONT}" font-size="190" font-weight="800" fill="${WHITE}" letter-spacing="-4">${esc(d.number)}</text>` +
    goldLine(W / 2 - 130, W / 2 + 130, 380) +
    `<text x="${W / 2}" y="452" text-anchor="middle" font-family="${FONT}" font-size="42" font-weight="600" fill="${GRAY}">${esc(d.label)}</text>` +
    (d.sub ? `<text x="${W / 2}" y="510" text-anchor="middle" font-family="${FONT}" font-size="26" fill="${DIM}">${esc(d.sub)}</text>` : '') + foot;
}

// bar — { title?, unit?, items: [{label, value, max?, highlight?}] }
function bar(d) {
  const items = d.items || [];
  const max = Math.max(...items.map(i => i.max ?? i.value), 1);
  const x0 = 90, bw = W - x0 - 220, rowH = Math.min(96, 420 / Math.max(items.length, 1));
  const y0 = d.title ? 170 : 120;
  let s = head() + (d.title ? `<text x="60" y="100" font-family="${FONT}" font-size="34" font-weight="700" fill="${WHITE}">${esc(d.title)}</text>` : '');
  items.forEach((it, i) => {
    const y = y0 + i * (rowH + 26), w = Math.max(6, (it.value / max) * bw), c = it.highlight ? GOLD : GRAY;
    s += `<text x="${x0}" y="${y + rowH / 2 - 14}" font-family="${FONT}" font-size="26" fill="${GRAY}">${esc(it.label)}</text>`
      + `<rect x="${x0}" y="${y + rowH / 2}" width="${w}" height="26" rx="4" fill="${c}"/>`
      + `<text x="${x0 + w + 18}" y="${y + rowH / 2 + 21}" font-family="${FONT}" font-size="30" font-weight="700" fill="${it.highlight ? GOLD : WHITE}">${esc(it.display ?? it.value)}${esc(d.unit || '')}</text>`;
  });
  return s + foot;
}

// compare — { title?, items: [{label, value, note?, highlight?}] } — 2~3개 값 대비 카드
function compare(d) {
  const items = (d.items || []).slice(0, 3);
  const cw = (W - 120 - (items.length - 1) * 30) / items.length;
  let s = head() + (d.title ? `<text x="60" y="100" font-family="${FONT}" font-size="34" font-weight="700" fill="${WHITE}">${esc(d.title)}</text>` : '');
  items.forEach((it, i) => {
    const x = 60 + i * (cw + 30), cy = 160, ch = 380, cx = x + cw / 2;
    s += `<rect x="${x}" y="${cy}" width="${cw}" height="${ch}" rx="18" fill="none" stroke="${it.highlight ? GOLD : 'rgb(60,60,64)'}" stroke-width="${it.highlight ? 3 : 1.5}"/>`
      + `<text x="${cx}" y="${cy + 175}" text-anchor="middle" font-family="${FONT}" font-size="84" font-weight="800" fill="${it.highlight ? GOLD : WHITE}">${esc(it.value)}</text>`
      + `<text x="${cx}" y="${cy + 240}" text-anchor="middle" font-family="${FONT}" font-size="28" fill="${GRAY}">${esc(it.label)}</text>`
      + (it.note ? `<text x="${cx}" y="${cy + 292}" text-anchor="middle" font-family="${FONT}" font-size="21" fill="${DIM}">${esc(it.note)}</text>` : '');
  });
  return s + foot;
}

// process — { title?, steps: ["...", ...] } — 단계 도식 (가로 화살표)
function process_(d) {
  const steps = (d.steps || []).slice(0, 5);
  const cw = (W - 120 - (steps.length - 1) * 70) / steps.length;
  let s = head() + (d.title ? `<text x="60" y="100" font-family="${FONT}" font-size="34" font-weight="700" fill="${WHITE}">${esc(d.title)}</text>` : '');
  steps.forEach((st, i) => {
    const x = 60 + i * (cw + 70), cy = 240, ch = 200, cx = x + cw / 2;
    s += `<rect x="${x}" y="${cy}" width="${cw}" height="${ch}" rx="16" fill="none" stroke="rgb(60,60,64)" stroke-width="1.5"/>`
      + `<text x="${cx}" y="${cy - 22}" text-anchor="middle" font-family="${FONT}" font-size="24" font-weight="700" fill="${GOLD}">${String(i + 1).padStart(2, '0')}</text>`;
    const words = String(st).split(/\s+/); let line = '', lines = [];
    for (const w2 of words) { if ((line + ' ' + w2).trim().length > Math.floor(cw / 15)) { lines.push(line.trim()); line = w2; } else line += ' ' + w2; }
    if (line.trim()) lines.push(line.trim());
    lines.slice(0, 3).forEach((ln, li) => { s += `<text x="${cx}" y="${cy + ch / 2 - (lines.length - 1) * 17 + li * 34 + 8}" text-anchor="middle" font-family="${FONT}" font-size="25" fill="${GRAY}">${esc(ln)}</text>`; });
    if (i < steps.length - 1) s += `<text x="${x + cw + 35}" y="${cy + ch / 2 + 10}" text-anchor="middle" font-family="${FONT}" font-size="34" fill="${GOLD}">→</text>`;
  });
  return s + foot;
}

const TYPES = { numberCard, bar, compare, process: process_ };

export function renderFigure(fig) {
  const fn = TYPES[fig.type];
  if (!fn) throw new Error(`figure type '${fig.type}' 미지원 (${Object.keys(TYPES).join('/')})`);
  return fn(fig.data || {});
}

// dossier의 figures 전체 렌더 → { [id]: svg } (+ outDir 지정 시 파일 저장)
export function renderDossierFigures(dossier, outDir) {
  const out = {};
  for (const f of dossier.figures || []) {
    out[f.id] = renderFigure(f);
    if (outDir) {
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(path.join(outDir, `${String(dossier.id).padStart(2, '0')}-${f.id}.svg`), out[f.id]);
    }
  }
  return out;
}

// ---- CLI ----
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const p = args.find(a => !a.startsWith('--'));
  if (!p) { console.error('usage: figure.mjs <dossier.json> [--out dir]'); process.exit(2); }
  const oi = args.indexOf('--out');
  const outDir = oi >= 0 ? args[oi + 1] : path.join(ROOT, 'out', 'figures');
  const d = JSON.parse(fs.readFileSync(p, 'utf-8'));
  const r = renderDossierFigures(d, outDir);
  console.log(`figures → ${path.relative(ROOT, outDir)} (${Object.keys(r).length}개: ${Object.keys(r).join(', ')})`);
}
