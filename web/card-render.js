// web/card-render.js — 브라우저 카드레터 렌더러.
// engine/render.mjs(node-canvas) 골드 레이아웃을 브라우저 canvas 로 1:1 포팅.
// 텍스트를 배경 위에 렌더 + 배경 교체 가능 + PNG 추출. node-canvas ↔ 브라우저 canvas API 동일.
export const W = 1080, H = 1350;
const GOLD = 'rgb(194,161,90)', GRAY = 'rgb(202,202,205)', WHITE = 'rgb(255,255,255)';
const TITLE_Y = 600;
const FUDGE_K = 0.069;
const topFudge = sz => Math.round(FUDGE_K * sz);
const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

// ---- fonts (Pretendard via FontFace; 골드와 동일 패밀리) ----
let _fontsReady = null;
const FB = 'PretBoldWeb', FR = 'PretRegWeb';
// 같은 출처 호스팅 otf(골드 렌더러와 동일 파일) — CDN 의존 없음. window.MELANOIR_FONTS 로 경로 override 가능.
const FONTS = (typeof window !== 'undefined' && window.MELANOIR_FONTS) || './fonts/';
export function loadFonts() {
  if (_fontsReady) return _fontsReady;
  _fontsReady = (async () => {
    const bold = new FontFace(FB, `url(${FONTS}Pretendard-Bold.otf) format('opentype')`);
    const reg = new FontFace(FR, `url(${FONTS}Pretendard-Regular.otf) format('opentype')`);
    await Promise.all([bold.load(), reg.load()]);
    document.fonts.add(bold); document.fonts.add(reg);
  })();
  return _fontsReady;
}
const fontStr = (sz, b = true) => `${sz}px ${b ? FB : FR}`;
const _mc = cv(10, 10).getContext('2d');
function textLen(t, sz, b = true) { _mc.font = fontStr(sz, b); return _mc.measureText(t).width; }
function fitSize(t, mw, start, mn = 36, b = true) { let sz = start; while (sz > mn && textLen(t, sz, b) > mw) sz -= 3; return sz; }

// ---- image cover (scale-to-fill + focal crop + flip) ----
function cover(img, zoom = 1.0, fx = 0.5, fy = 0.5, flip = false) {
  const iw = img.width, ih = img.height;
  let src = img;
  if (flip) { const t = cv(iw, ih); const tc = t.getContext('2d'); tc.translate(iw, 0); tc.scale(-1, 1); tc.drawImage(img, 0, 0); src = t; }
  const s = Math.max(W / iw, H / ih) * Math.max(1.0, Number(zoom));
  const nw = Math.floor(iw * s + 1), nh = Math.floor(ih * s + 1);
  const ox = Math.floor((nw - W) * Math.min(Math.max(fx, 0), 1));
  const oy = Math.floor((nh - H) * Math.min(Math.max(fy, 0), 1));
  const c = cv(W, H); const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, -ox, -oy, nw, nh);
  return c;
}

// ---- black gradient mask + dim ----
function gmaskCanvas(top, bot, ease = 1.8, wm = true, topband = 150, topbandTo = 0.15) {
  const c = cv(1, H); const ctx = c.getContext('2d'); const id = ctx.createImageData(1, H);
  for (let y = 0; y < H; y++) {
    const fy = y / H; const t = Math.max(0, Math.min(1, fy / 0.90));
    let a = top + (bot - top) * Math.pow(t, ease);
    if (topband > 0 && fy < topbandTo) a = Math.max(a, topband * ((topbandTo - fy) / topbandTo));
    if (wm) a = Math.max(a, 255 * Math.min(1, Math.max(0, (fy - 0.80) / 0.08)));
    a = Math.min(255, Math.max(0, a)); const o = y * 4;
    id.data[o] = 0; id.data[o + 1] = 0; id.data[o + 2] = 0; id.data[o + 3] = Math.round(a);
  }
  ctx.putImageData(id, 0, 0); return c;
}
function dim(base, top, bot, ease = 1.8) {
  const ctx = base.getContext('2d'); const m = gmaskCanvas(top, bot, ease);
  ctx.imageSmoothingEnabled = false; ctx.drawImage(m, 0, 0, 1, H, 0, 0, W, H); return base;
}

// ---- vignette / blur (mode A/B) ----
function boxBlur1D(src, dst, w, h, r, horizontal) {
  const norm = 1 / (2 * r + 1);
  if (horizontal) {
    for (let y = 0; y < h; y++) {
      const row = y * w; let sum = 0;
      for (let k = -r; k <= r; k++) sum += src[row + Math.min(w - 1, Math.max(0, k))];
      for (let x = 0; x < w; x++) { dst[row + x] = sum * norm; sum += src[row + Math.min(w - 1, x + r + 1)] - src[row + Math.max(0, x - r)]; }
    }
  } else {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let k = -r; k <= r; k++) sum += src[Math.min(h - 1, Math.max(0, k)) * w + x];
      for (let y = 0; y < h; y++) { dst[y * w + x] = sum * norm; sum += src[Math.min(h - 1, y + r + 1) * w + x] - src[Math.max(0, y - r) * w + x]; }
    }
  }
}
let _vigCache = null;
function vignetteFactor() {
  if (_vigCache) return _vigCache;
  const cx = W / 2, cy = H / 2, rx = 0.75 * W, ry = 0.70 * H;
  let buf = new Float32Array(W * H);
  for (let y = 0; y < H; y++) { const dy = (y - cy) / ry, dy2 = dy * dy; for (let x = 0; x < W; x++) { const dx = (x - cx) / rx; buf[y * W + x] = (dx * dx + dy2) <= 1 ? 255 : 0; } }
  const r = 240; let tmp = new Float32Array(W * H);
  for (let p = 0; p < 3; p++) { boxBlur1D(buf, tmp, W, H, r, true); boxBlur1D(tmp, buf, W, H, r, false); }
  const fac = new Float32Array(W * H);
  for (let i = 0; i < buf.length; i++) fac[i] = 0.50 + 0.30 * (buf[i] / 255);
  _vigCache = fac; return fac;
}
function applyBrightness(base, factor) { const ctx = base.getContext('2d'); const id = ctx.getImageData(0, 0, W, H), d = id.data; for (let i = 0; i < d.length; i += 4) { d[i] *= factor; d[i + 1] *= factor; d[i + 2] *= factor; } ctx.putImageData(id, 0, 0); }
function applyVignette(base) { const fac = vignetteFactor(); const ctx = base.getContext('2d'); const id = ctx.getImageData(0, 0, W, H), d = id.data; for (let i = 0, p = 0; i < d.length; i += 4, p++) { const f = fac[p]; d[i] *= f; d[i + 1] *= f; d[i + 2] *= f; } ctx.putImageData(id, 0, 0); }
function gaussianBlurCanvas(base, radius) {
  const ctx = base.getContext('2d'); const id = ctx.getImageData(0, 0, W, H), d = id.data;
  const ch = [new Float32Array(W * H), new Float32Array(W * H), new Float32Array(W * H)];
  for (let i = 0, p = 0; i < d.length; i += 4, p++) { ch[0][p] = d[i]; ch[1][p] = d[i + 1]; ch[2][p] = d[i + 2]; }
  const r = Math.max(1, Math.round(radius)); const tmp = new Float32Array(W * H);
  for (const c of ch) for (let p = 0; p < 3; p++) { boxBlur1D(c, tmp, W, H, r, true); boxBlur1D(tmp, c, W, H, r, false); }
  for (let i = 0, p = 0; i < d.length; i += 4, p++) { d[i] = ch[0][p]; d[i + 1] = ch[1][p]; d[i + 2] = ch[2][p]; } ctx.putImageData(id, 0, 0);
}

// ---- background by mode (img = 로드된 이미지 또는 null) ----
function bg(mode, img, zoom = 1.0, fx = 0.5, fy = 0.5, flip = false) {
  if (mode === 'D' || !img) { const c = cv(W, H); const x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, W, H); return c; }
  const base = cover(img, zoom, fx, fy, flip);
  if (mode === 'A') { applyVignette(base); return dim(base, 30, 255, 0.95); }
  if (mode === 'B') { gaussianBlurCanvas(base, 28); applyBrightness(base, 0.70); return dim(base, 34, 255, 0.95); }
  if (mode === 'C') return dim(base, 30, 255, 0.95);
  if (mode === 'E') return dim(base, 70, 255, 0.90);
  return dim(base, 18, 255, 1.20);
}

// ---- text helpers ----
function setFont(ctx, sz, b = true) { ctx.font = fontStr(sz, b); }
function drawTL(ctx, x, y, txt, sz, b, fill) { setFont(ctx, sz, b); ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = fill; ctx.fillText(txt, x, y + topFudge(sz)); }
function drawMA(ctx, x, y, txt, sz, b, fill) { setFont(ctx, sz, b); ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillStyle = fill; ctx.fillText(txt, x, y + topFudge(sz)); }
function drawMM(ctx, x, y, txt, sz, b, fill) { setFont(ctx, sz, b); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = fill; ctx.fillText(txt, x, y); }
function wm(ctx, centered = false) { if (centered) drawMA(ctx, W / 2, 62, 'M E L A N O I R', 25, true, WHITE); else drawTL(ctx, 60, 58, 'M E L A N O I R', 25, true, WHITE); }
function hline(ctx, x1, x2, y, color, width) { ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke(); }
function flow(ctx, segments, x0, y0, maxW, sz, lh) {
  setFont(ctx, sz, false); ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  _mc.font = fontStr(sz, false); const sw = _mc.measureText(' ').width;
  let x = x0, y = y0, pkx = null, py = null; const toks = [];
  for (const [txt, key] of segments) for (const wd of String(txt).split(' ')) if (wd) toks.push([wd, key]);
  for (const [wd, key] of toks) {
    setFont(ctx, sz, false); _mc.font = fontStr(sz, false); const ww = _mc.measureText(wd).width;
    if (x + ww > x0 + maxW && x > x0) { x = x0; y += lh; pkx = null; }
    setFont(ctx, sz, false); ctx.fillStyle = key ? WHITE : GRAY; ctx.fillText(wd, x, y + topFudge(sz));
    if (key) { hline(ctx, x, x + ww, y + 45, GOLD, 3); if (pkx !== null && py === y) hline(ctx, pkx, x, y + 45, GOLD, 3); pkx = x + ww; py = y; } else pkx = null;
    x += ww + sw;
  }
  return y + lh;
}
function imgkw(sl) { return [sl.zoom ?? 1.0, sl.fx ?? 0.5, sl.fy ?? 0.5, sl.flip ?? false]; }

// ---- slide renderers (bg 이미지는 인자로 전달) ----
function s_cover_stmt(sl, img) {
  const im = bg('full', img, ...imgkw(sl)); const ctx = im.getContext('2d');
  const m = cv(1, H); const mctx = m.getContext('2d'); const id = mctx.createImageData(1, H);
  for (let yy = 0; yy < H; yy++) { const a = 180 * Math.max(0, Math.min(1, (H * 0.18 - yy) / (H * 0.18))); const o = yy * 4; id.data[o] = 0; id.data[o + 1] = 0; id.data[o + 2] = 0; id.data[o + 3] = Math.round(a); }
  mctx.putImageData(id, 0, 0); ctx.imageSmoothingEnabled = false; ctx.drawImage(m, 0, 0, 1, H, 0, 0, W, H);
  wm(ctx);
  const lines = sl.lines || []; let sz = 76;
  while (sz > 40 && Math.max(...lines.map(ln => textLen(ln, sz, true))) > W - 120) sz -= 2;
  const lh = Math.floor(sz * 1.18); let y = 1245 - lh * lines.length;
  for (const ln of lines) { drawTL(ctx, 60, y, ln, sz, true, WHITE); y += lh; }
  return im;
}
function s_cover_data(sl, img) {
  const im = bg('E', img, ...imgkw(sl)); const ctx = im.getContext('2d'); wm(ctx, true);
  drawMM(ctx, W / 2, 560, sl.number, fitSize(sl.number, W - 150, 300, 120), true, WHITE);
  hline(ctx, W / 2 - 140, W / 2 + 140, 720, GOLD, 4);
  drawMA(ctx, W / 2, 775, sl.label, 44, false, GRAY);
  if (sl.hook) drawMA(ctx, W / 2, 980, sl.hook, 40, true, WHITE);
  return im;
}
function s_body(sl, img) {
  const im = bg(sl.mode || 'A', img, ...imgkw(sl)); const ctx = im.getContext('2d'); wm(ctx);
  let ty = TITLE_Y; drawTL(ctx, 60, ty, sl.num, 50, true, GOLD);
  const nw = textLen(sl.num + '  ', 50, true);
  drawTL(ctx, 60 + nw, ty, sl.title, fitSize(sl.title, W - (60 + nw) - 60, 50), true, WHITE);
  ty += 116; flow(ctx, sl.segments || [], 60, ty, W - 120, 35, 56);
  return im;
}
function s_closing(sl, _img) {
  const im = bg('D'); const ctx = im.getContext('2d'); wm(ctx, true);
  const lines = sl.lines || []; let cy = Math.floor(H / 2 - lines.length * 44 - 30);
  for (const ln of lines) { drawMA(ctx, W / 2, cy, ln, fitSize(ln, W - 150, 58, 40), true, WHITE); cy += 88; }
  cy += 30; hline(ctx, W / 2 - 55, W / 2 + 55, cy, GOLD, 3); return im;
}
const RENDER = { cover_stmt: s_cover_stmt, cover_data: s_cover_data, body: s_body, closing: s_closing };

// 슬라이드 + 배경이미지(HTMLImageElement|ImageBitmap|null) → 캔버스
export async function renderSlide(slide, bgImg = null) {
  await loadFonts();
  const fn = RENDER[slide.type]; if (!fn) throw new Error('unknown slide type: ' + slide.type);
  return fn(slide, bgImg);
}
// 파일/URL → 이미지 로드 헬퍼
export function loadImageEl(src) {
  return new Promise((resolve, reject) => {
    const im = new Image(); im.crossOrigin = 'anonymous';
    im.onload = () => resolve(im); im.onerror = reject;
    im.src = typeof src === 'string' ? src : URL.createObjectURL(src);
  });
}
