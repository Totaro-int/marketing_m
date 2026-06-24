#!/usr/bin/env node
// Melanoir IG 캐러셀 렌더러 (Node 포팅) — JSON 스펙 → 슬라이드 PNG
// 골드 SSoT: reference/gold-reference/melanoir_render_carousel.py (PIL) 를 1:1 포팅.
// 사용: node engine/render.mjs [specPath] [--lib DIR] [--fonts DIR] [--out DIR]
//   기본 lib/fonts = reference/gold-reference/{bg/lib,fonts}, out = out/
//   배경은 lib/ 의 실사 이미지(파일명만 지정). 출력: out/carousel_<id>/s1..sN.png
// 슬라이드 type: cover_stmt | cover_data | body | closing
// 변형(mode): A(디밍+비네팅) B(블러) C(헤더밴드+순흑) D(순흑) E(가운데 숫자)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
// node-canvas (Cairo+FreeType): 골드(PIL/FreeType) 텍스트 래스터화에 가장 근접.
// (Skia 대비 closing MAE 3.99→2.81). loadImage는 Buffer로 — Win 비ASCII 경로 회피.
import canvasPkg from 'canvas';
const { createCanvas, loadImage, registerFont } = canvasPkg;
const loadImg = (p) => loadImage(fs.readFileSync(p));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ---- args ----
function parseArgs(argv) {
  const a = { spec: null, lib: null, fonts: null, out: null };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--lib') a.lib = argv[++i];
    else if (t === '--fonts') a.fonts = argv[++i];
    else if (t === '--out') a.out = argv[++i];
    else rest.push(t);
  }
  a.spec = rest[0] || path.join(ROOT, 'reference/gold-reference/carousel_specs/carousel_01.json');
  a.lib = a.lib || path.join(ROOT, 'reference/gold-reference/bg/lib');
  a.fonts = a.fonts || path.join(ROOT, 'reference/gold-reference/fonts');
  a.out = a.out || path.join(ROOT, 'out');
  return a;
}
const ARGS = parseArgs(process.argv.slice(2));

// ---- constants (from PIL SSoT) ----
const W = 1080, H = 1350;
const GOLD = 'rgb(194,161,90)', GRAY = 'rgb(202,202,205)', WHITE = 'rgb(255,255,255)';
const TITLE_Y = 600;
// PIL renders grayscale AA (FT_RENDER_MODE_NORMAL). Match node-canvas text AA mode.
const AA = process.env.AA || 'gray';
const prep = (ctx) => { if ('antialias' in ctx) ctx.antialias = AA; return ctx; };

// ---- fonts (must register before any createCanvas) ----
registerFont(path.join(ARGS.fonts, 'Pretendard-Bold.otf'), { family: 'PretBold' });
registerFont(path.join(ARGS.fonts, 'Pretendard-Regular.otf'), { family: 'PretReg' });
const FAM_B = 'PretBold', FAM_R = 'PretReg';
const fontStr = (sz, b = true) => `${sz}px ${b ? FAM_B : FAM_R}`;

// shared measuring context (mirrors PIL _s)
const _mc = createCanvas(10, 10).getContext('2d');
function textLen(t, sz, b = true) { _mc.font = fontStr(sz, b); return _mc.measureText(t).width; }
// fit: largest size (step -3) whose width <= mw, floor mn
function fitSize(t, mw, start, mn = 36, b = true) {
  let sz = start;
  while (sz > mn && textLen(t, sz, b) > mw) sz -= 3;
  return sz;
}

function imgpath(name) {
  if (path.isAbsolute(name)) return name;
  return path.join(ARGS.lib, path.basename(name));
}

// ---- image cover (scale-to-fill + focal crop + optional flip) ----
async function cover(imgName, zoom = 1.0, fx = 0.5, fy = 0.5, flip = false) {
  let im = await loadImg(imgpath(imgName));
  let iw = im.width, ih = im.height;
  // optional pre-flip (PIL flips full image before crop)
  let src = im;
  if (flip) {
    const t = createCanvas(iw, ih); const tc = t.getContext('2d');
    tc.translate(iw, 0); tc.scale(-1, 1); tc.drawImage(im, 0, 0);
    src = t;
  }
  const s = Math.max(W / iw, H / ih) * Math.max(1.0, Number(zoom));
  const nw = Math.floor(iw * s + 1), nh = Math.floor(ih * s + 1);
  const ox = Math.floor((nw - W) * Math.min(Math.max(fx, 0), 1));
  const oy = Math.floor((nh - H) * Math.min(Math.max(fy, 0), 1));
  const c = createCanvas(W, H); const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  if ('patternQuality' in ctx) ctx.patternQuality = 'best';
  ctx.drawImage(src, -ox, -oy, nw, nh);
  return c;
}

// ---- vertical black gradient mask (per-row alpha) ----
// returns a 1xH canvas of black with per-row alpha; drawn stretched it darkens base.
function gmaskCanvas(top, bot, ease = 1.8, wm = true, topband = 150, topbandTo = 0.15) {
  const c = createCanvas(1, H); const ctx = c.getContext('2d');
  const id = ctx.createImageData(1, H);
  for (let y = 0; y < H; y++) {
    const fy = y / H;
    const t = Math.max(0, Math.min(1, fy / 0.90));
    let a = top + (bot - top) * Math.pow(t, ease);
    if (topband > 0 && fy < topbandTo) a = Math.max(a, topband * ((topbandTo - fy) / topbandTo));
    if (wm) a = Math.max(a, 255 * Math.min(1, Math.max(0, (fy - 0.80) / 0.08)));
    a = Math.min(255, Math.max(0, a));
    const o = y * 4;
    id.data[o] = 0; id.data[o + 1] = 0; id.data[o + 2] = 0; id.data[o + 3] = Math.round(a);
  }
  ctx.putImageData(id, 0, 0);
  return c;
}
// apply black gradient over a base canvas in-place
function dim(base, top, bot, ease = 1.8) {
  const ctx = base.getContext('2d');
  const m = gmaskCanvas(top, bot, ease);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(m, 0, 0, 1, H, 0, 0, W, H);
  return base;
}

// ---- vignette factor map (mode A) ----
// PIL: vmask = filled ellipse [-.25W,-.2H,1.25W,1.2H] blurred Gaussian(240);
//      va = composite(bright(base,.80), bright(base,.50), vmask)
//      => factor = .50 + .30*(vmask/255)
let _vigCache = null;
function boxBlur1D(src, dst, w, h, r, horizontal) {
  // separable box blur with running sum; edge-clamped
  const norm = 1 / (2 * r + 1);
  if (horizontal) {
    for (let y = 0; y < h; y++) {
      const row = y * w;
      let sum = 0;
      for (let k = -r; k <= r; k++) sum += src[row + Math.min(w - 1, Math.max(0, k))];
      for (let x = 0; x < w; x++) {
        dst[row + x] = sum * norm;
        const add = Math.min(w - 1, x + r + 1);
        const sub = Math.max(0, x - r);
        sum += src[row + add] - src[row + sub];
      }
    }
  } else {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let k = -r; k <= r; k++) sum += src[Math.min(h - 1, Math.max(0, k)) * w + x];
      for (let y = 0; y < h; y++) {
        dst[y * w + x] = sum * norm;
        const add = Math.min(h - 1, y + r + 1) * w + x;
        const sub = Math.max(0, y - r) * w + x;
        sum += src[add] - src[sub];
      }
    }
  }
}
function vignetteFactor() {
  if (_vigCache) return _vigCache;
  const cx = W / 2, cy = H / 2, rx = 0.75 * W, ry = 0.70 * H;
  let buf = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    const dy = (y - cy) / ry; const dy2 = dy * dy;
    for (let x = 0; x < W; x++) {
      const dx = (x - cx) / rx;
      buf[y * W + x] = (dx * dx + dy2) <= 1 ? 255 : 0;
    }
  }
  // 3-pass box blur ~= Gaussian sigma 240 (boxRadius ~240)
  const r = 240; let tmp = new Float32Array(W * H);
  for (let p = 0; p < 3; p++) {
    boxBlur1D(buf, tmp, W, H, r, true);
    boxBlur1D(tmp, buf, W, H, r, false);
  }
  const fac = new Float32Array(W * H);
  for (let i = 0; i < buf.length; i++) fac[i] = 0.50 + 0.30 * (buf[i] / 255);
  _vigCache = fac;
  return fac;
}
function applyBrightness(base, factor) { // multiply RGB by scalar
  const ctx = base.getContext('2d');
  const id = ctx.getImageData(0, 0, W, H); const d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i] *= factor; d[i + 1] *= factor; d[i + 2] *= factor;
  }
  ctx.putImageData(id, 0, 0);
}
function applyVignette(base) { // per-pixel factor map
  const fac = vignetteFactor();
  const ctx = base.getContext('2d');
  const id = ctx.getImageData(0, 0, W, H); const d = id.data;
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    const f = fac[p];
    d[i] *= f; d[i + 1] *= f; d[i + 2] *= f;
  }
  ctx.putImageData(id, 0, 0);
}
function gaussianBlurCanvas(base, radius) { // approx PIL GaussianBlur(radius=sigma)
  const ctx = base.getContext('2d');
  const id = ctx.getImageData(0, 0, W, H); const d = id.data;
  const ch = [new Float32Array(W * H), new Float32Array(W * H), new Float32Array(W * H)];
  for (let i = 0, p = 0; i < d.length; i += 4, p++) { ch[0][p] = d[i]; ch[1][p] = d[i + 1]; ch[2][p] = d[i + 2]; }
  const r = Math.max(1, Math.round(radius)); const tmp = new Float32Array(W * H);
  for (const c of ch) for (let p = 0; p < 3; p++) { boxBlur1D(c, tmp, W, H, r, true); boxBlur1D(tmp, c, W, H, r, false); }
  for (let i = 0, p = 0; i < d.length; i += 4, p++) { d[i] = ch[0][p]; d[i + 1] = ch[1][p]; d[i + 2] = ch[2][p]; }
  ctx.putImageData(id, 0, 0);
}

// ---- background by mode ----
async function bg(mode, imgName = null, zoom = 1.0, fx = 0.5, fy = 0.5, flip = false) {
  if (mode === 'D') { const c = createCanvas(W, H); const x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, W, H); return c; }
  const base = await cover(imgName, zoom, fx, fy, flip);
  if (mode === 'A') { applyVignette(base); return dim(base, 30, 255, 0.95); }
  if (mode === 'B') { gaussianBlurCanvas(base, 28); applyBrightness(base, 0.70); return dim(base, 34, 255, 0.95); }
  if (mode === 'C') return dim(base, 30, 255, 0.95);
  if (mode === 'E') return dim(base, 70, 255, 0.90);
  return dim(base, 18, 255, 1.20); // full (cover_stmt)
}

// ---- text helpers (PIL anchor emulation) ----
// PIL anchor "a"(ascender) ≈ y. Canvas 'top' = em-box top, which sits ABOVE PIL's ascender,
// so canvas text lands ~K*size too HIGH. Shift DOWN by topFudge to match PIL.
// Calibrated on the closing slide (pure-black bg = clean signal): 58px → +4px ⇒ K≈0.069.
const FUDGE_K = Number(process.env.FUDGE_K ?? 0.069);
const topFudge = (sz) => Math.round(FUDGE_K * sz);
function setFont(ctx, sz, b = true) { ctx.font = fontStr(sz, b); }
function drawTL(ctx, x, y, txt, sz, b, fill) { // top-left (PIL "la")
  setFont(ctx, sz, b); ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillStyle = fill; ctx.fillText(txt, x, y + topFudge(sz));
}
function drawMA(ctx, x, y, txt, sz, b, fill) { // middle-x, ascender-top (PIL "ma")
  setFont(ctx, sz, b); ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillStyle = fill; ctx.fillText(txt, x, y + topFudge(sz));
}
function drawMM(ctx, x, y, txt, sz, b, fill) { // middle-middle (PIL "mm")
  setFont(ctx, sz, b); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = fill; ctx.fillText(txt, x, y);
}
function wm(ctx, centered = false) { // wordmark
  if (centered) drawMA(ctx, W / 2, 62, 'M E L A N O I R', 25, true, WHITE);
  else drawTL(ctx, 60, 58, 'M E L A N O I R', 25, true, WHITE);
}
function hline(ctx, x1, x2, y, color, width) {
  ctx.strokeStyle = color; ctx.lineWidth = width;
  ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke();
}

// ---- flow: word-wrap segments, gray body + white highlighted (gold underline) ----
function flow(ctx, segments, x0, y0, maxW, sz, lh) {
  setFont(ctx, sz, false);
  const sw = _mc.measureText.call((_mc.font = fontStr(sz, false), _mc), ' ').width;
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  let x = x0, y = y0, pkx = null, py = null;
  const toks = [];
  for (const [txt, key] of segments) for (const wd of txt.split(' ')) if (wd) toks.push([wd, key]);
  for (const [wd, key] of toks) {
    setFont(ctx, sz, false);
    const ww = _mc.measureText.call((_mc.font = fontStr(sz, false), _mc), wd).width;
    if (x + ww > x0 + maxW && x > x0) { x = x0; y += lh; pkx = null; }
    setFont(ctx, sz, false);
    ctx.fillStyle = key ? WHITE : GRAY;
    ctx.fillText(wd, x, y + topFudge(sz));
    if (key) {
      hline(ctx, x, x + ww, y + 45, GOLD, 3);
      if (pkx !== null && py === y) hline(ctx, pkx, x, y + 45, GOLD, 3);
      pkx = x + ww; py = y;
    } else pkx = null;
    x += ww + sw;
  }
  return y + lh;
}

// ---- slide renderers ----
async function s_cover_stmt(sl) {
  const im = await bg('full', sl.image, ...imgkw(sl));
  const ctx = prep(im.getContext('2d'));
  // 상단 스크림: 밝은 배경에서도 워드마크 가독 (180*linear top→0.18H)
  const m = createCanvas(1, H); const mctx = m.getContext('2d');
  const id = mctx.createImageData(1, H);
  for (let yy = 0; yy < H; yy++) {
    const a = 180 * Math.max(0, Math.min(1, (H * 0.18 - yy) / (H * 0.18)));
    const o = yy * 4; id.data[o] = 0; id.data[o + 1] = 0; id.data[o + 2] = 0; id.data[o + 3] = Math.round(a);
  }
  mctx.putImageData(id, 0, 0);
  ctx.imageSmoothingEnabled = false; ctx.drawImage(m, 0, 0, 1, H, 0, 0, W, H);
  wm(ctx);
  const lines = sl.lines; let sz = 76;
  while (sz > 40 && Math.max(...lines.map(ln => textLen(ln, sz, true))) > W - 120) sz -= 2;
  const lh = Math.floor(sz * 1.18); let y = 1245 - lh * lines.length;
  for (const ln of lines) { drawTL(ctx, 60, y, ln, sz, true, WHITE); y += lh; }
  return im;
}
async function s_cover_data(sl) {
  const im = await bg('E', sl.image, ...imgkw(sl)); const ctx = prep(im.getContext('2d')); wm(ctx, true);
  drawMM(ctx, W / 2, 560, sl.number, fitSize(sl.number, W - 150, 300, 120), true, WHITE);
  hline(ctx, W / 2 - 140, W / 2 + 140, 720, GOLD, 4);
  drawMA(ctx, W / 2, 775, sl.label, 44, false, GRAY);
  if (sl.hook) drawMA(ctx, W / 2, 980, sl.hook, 40, true, WHITE);
  return im;
}
async function s_body(sl) {
  const im = await bg(sl.mode || 'A', sl.image, ...imgkw(sl)); const ctx = prep(im.getContext('2d')); wm(ctx);
  let ty = TITLE_Y;
  drawTL(ctx, 60, ty, sl.num, 50, true, GOLD);
  const nw = textLen(sl.num + '  ', 50, true);
  drawTL(ctx, 60 + nw, ty, sl.title, fitSize(sl.title, W - (60 + nw) - 60, 50), true, WHITE);
  ty += 116;
  flow(ctx, sl.segments, 60, ty, W - 120, 35, 56);
  return im;
}
async function s_closing(sl) {
  const im = await bg('D'); const ctx = prep(im.getContext('2d')); wm(ctx, true);
  const lines = sl.lines; let cy = Math.floor(H / 2 - lines.length * 44 - 30);
  for (const ln of lines) { drawMA(ctx, W / 2, cy, ln, fitSize(ln, W - 150, 58, 40), true, WHITE); cy += 88; }
  cy += 30; hline(ctx, W / 2 - 55, W / 2 + 55, cy, GOLD, 3);
  return im;
}
function imgkw(sl) {
  return [sl.zoom ?? 1.0, sl.fx ?? 0.5, sl.fy ?? 0.5, sl.flip ?? false];
}
const RENDER = { cover_stmt: s_cover_stmt, cover_data: s_cover_data, body: s_body, closing: s_closing };

// ---- exported API (재사용: insight-card 등) ----
export async function renderSlide(sl) {
  const fn = RENDER[sl.type];
  if (!fn) throw new Error(`unknown slide type: ${sl.type}`);
  return fn(sl); // canvas 반환
}
export async function renderSpecToDir(spec, outRoot = ARGS.out) {
  const id2 = String(spec.id).padStart(2, '0');
  const out = path.join(outRoot, `carousel_${id2}`);
  fs.mkdirSync(out, { recursive: true });
  const paths = [];
  for (let i = 0; i < spec.slides.length; i++) {
    const im = await renderSlide(spec.slides[i]);
    const p = path.join(out, `s${i + 1}.png`);
    fs.writeFileSync(p, im.toBuffer('image/png'));
    paths.push(p);
  }
  return { out, paths };
}

// ---- main (CLI only) ----
async function main() {
  const spec = JSON.parse(fs.readFileSync(ARGS.spec, 'utf-8'));
  const { out, paths } = await renderSpecToDir(spec, ARGS.out);
  console.log(`rendered ${paths.length} slides → ${out}`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(e => { console.error(e); process.exit(1); });
}
