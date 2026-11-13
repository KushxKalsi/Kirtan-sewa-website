/**
 * Kirtan program posters (1024 × 1536), drawn on a canvas in the style of Punjab Gurdwara / village posters. Text is
 * drawn with Noto Sans Gurmukhi so the letters are always right.
 *
 * Three layouts:
 *  - kirtan:  one featured person — title banner, program and place, their photo, name banner, date and time box.
 *  - samagam: many people — title banner, program, then a card per person (photo, name and their own time).
 *  - text:    text only — nothing but the words (and photos, if added) on the background. Every line and photo is an
 *             "item" with its own place, size and colour, so it can be moved around to suit any background. A text
 *             template can also have an `overlay`: a see-through picture (frame and empty banners) drawn whole over
 *             the background, with its items placed to sit inside the banners.
 *
 * Everything is themeable: a palette (banner / highlight / text colours), a background (a light Gurbani-themed preset,
 * a generated one from a seed, or an uploaded picture), an optional title photo at the top, and show / hide switches.
 */
export const W = 1024;
export const H = 1536;
const GURMUKHI = '"Noto Sans Gurmukhi", "Mukta Mahee", sans-serif';
const SERIF = '"Noto Serif", Georgia, serif';
export const MAX_PEOPLE = 12;

/* ---------------- colours ---------------- */
const hexRgb = (hex) => {
  let h = String(hex || '#000').replace('#', '');
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  const n = parseInt(h, 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const toHex = (rgb) => `#${rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;
const mix = (a, b, t) => {
  const x = hexRgb(a);
  const y = hexRgb(b);
  return toHex(x.map((v, i) => v + (y[i] - v) * t));
};
const rgba = (hex, a) => `rgba(${hexRgb(hex).join(', ')}, ${a})`;
function hslHex(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return toHex([f(0) * 255, f(8) * 255, f(4) * 255]);
}
function themeOf(p = {}) {
  const primary = p.primary || '#14285a';
  const accent = p.accent || '#d4a227';
  return {
    primary,
    deep: mix(primary, '#000000', 0.3),
    accent,
    accentLight: mix(accent, '#ffffff', 0.45),
    paper: mix(accent, '#ffffff', 0.9),
    ink: p.ink || primary,
    onPrimary: '#ffffff',
  };
}
// Small seeded random numbers, so a generated background looks the same every time it is drawn.
function seeded(seed) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------------- templates ---------------- */
export const TEMPLATES = [
  { id: 'kirtan-classic', kind: 'kirtan', name: 'Classic', note: 'Navy and gold on cream', palette: { primary: '#14285a', accent: '#d4a227', ink: '#14285a' }, bg: { type: 'preset', id: 'paper' }, show: { ornaments: false } },
  { id: 'kirtan-kesri', kind: 'kirtan', name: 'Kesri', note: 'Saffron light', palette: { primary: '#8c2f0c', accent: '#f0a830', ink: '#5e1f08' }, bg: { type: 'preset', id: 'rays' } },
  { id: 'kirtan-neela', kind: 'kirtan', name: 'Neela', note: 'Soft blue with Khanda', palette: { primary: '#1f4f8a', accent: '#d0a53a', ink: '#163a66' }, bg: { type: 'preset', id: 'khanda' } },
  { id: 'samagam-board', kind: 'samagam', name: 'Samagam board', note: 'Maroon and yellow', palette: { primary: '#6b1f22', accent: '#f2c318', ink: '#3b1214' }, bg: { type: 'preset', id: 'ikonkar' } },
  { id: 'samagam-neela', kind: 'samagam', name: 'Samagam neela', note: 'Blue and gold, morning sky', palette: { primary: '#14285a', accent: '#d4a227', ink: '#14285a' }, bg: { type: 'preset', id: 'sky' } },
  { id: 'samagam-lotus', kind: 'samagam', name: 'Lotus', note: 'Soft pink and maroon', palette: { primary: '#7a2340', accent: '#e6a23c', ink: '#5a1a2f' }, bg: { type: 'preset', id: 'lotus' } },
  { id: 'text-only', kind: 'text', name: 'Text only', note: 'Your background, just the words', palette: { primary: '#14285a', accent: '#d4a227', ink: '#14285a' }, bg: { type: 'preset', id: 'paper' }, wash: 0 },
  { id: 'text-royal-photo', kind: 'text', name: 'Royal with photo', note: 'Navy and gold banners, your photo on the right', palette: { primary: '#14306a', accent: '#f0c22e', ink: '#14306a' }, bg: { type: 'preset', id: 'paper' }, wash: 0, overlay: '/posters/royal-frame.webp', pieces: 'royalPhoto', items: 'royalPhoto' },
  ...[
    ['cream', 'Arch · cream', 'Cream and navy, Gurdwara sketch', { primary: '#0f2b4a', accent: '#f0c22e', ink: '#0f2b4a' }],
    ['blue', 'Arch · royal blue', 'Deep blue with golden Gurdwara', { primary: '#0d2a5a', accent: '#f2c94c', ink: '#0d2a5a' }],
    ['lavender', 'Arch · lavender', 'Lavender with flowers', { primary: '#4f3470', accent: '#f6d36b', ink: '#4f3470' }],
    ['maroon', 'Arch · maroon', 'Peach and maroon', { primary: '#6b1414', accent: '#f2c14e', ink: '#6b1414' }],
    ['teal', 'Arch · teal', 'Sea green and teal', { primary: '#0f3b4a', accent: '#f2c94c', ink: '#0f3b4a' }],
  ].map(([id, name, note, palette]) => ({ id: `text-arch-${id}`, kind: 'text', name, note, palette, bg: { type: 'preset', id: 'paper' }, wash: 0, overlay: `/posters/arch-${id}.webp`, overlayOver: true, items: `arch-${id}` })),
  { id: 'text-royal', kind: 'text', name: 'Royal frame', note: 'Navy and gold banners, no photo', palette: { primary: '#14306a', accent: '#f0c22e', ink: '#14306a' }, bg: { type: 'preset', id: 'paper' }, wash: 0, overlay: '/posters/royal-frame.webp', items: 'royal' },
];
export const templateById = (id) => TEMPLATES.find((t) => t.id === id) || TEMPLATES[0];

/* ---------------- backgrounds ---------------- */
// Light backgrounds, so the poster text stays easy to read.
const PRESETS = {
  paper: { name: 'Cream paper', top: '#fdf9ef', bottom: '#f4ead3', glow: '#f6d27a', tint: '#d4a227', motifs: [] },
  rays: { name: 'Golden light', top: '#fffaf0', bottom: '#fde3b8', glow: '#ffd27a', tint: '#f0a830', motifs: ['rays'] },
  ikonkar: { name: 'Ik Onkar', top: '#fffdf7', bottom: '#f2ead8', glow: '#f6d27a', tint: '#c9962a', motifs: ['ikonkar'] },
  khanda: { name: 'Khanda', top: '#f9fbff', bottom: '#e6edf7', glow: '#ffffff', tint: '#1f4f8a', motifs: ['khanda'] },
  mandala: { name: 'Mandala', top: '#fff8f0', bottom: '#fbe6d4', glow: '#ffe2b0', tint: '#c86b2c', motifs: ['mandala'] },
  lotus: { name: 'Lotus', top: '#fff7f6', bottom: '#fde0dc', glow: '#ffe9d6', tint: '#d0607a', motifs: ['lotus', 'bokeh'] },
  sky: { name: 'Morning sky', top: '#eef6ff', bottom: '#fdf8ec', glow: '#fff1c4', tint: '#5d8fc9', motifs: ['rays', 'bokeh'] },
  waheguru: { name: 'Waheguru', top: '#fbfaf3', bottom: '#efe8d2', glow: '#f6e3a8', tint: '#9b7a2a', motifs: ['waheguru'] },
};
export const BG_PRESETS = Object.entries(PRESETS).map(([id, p]) => ({ type: 'preset', id, name: p.name }));

// Colours that suit a Gurdwara / kirtan poster: saffron, gold, sky blue, lotus pink, sage, peach, lavender.
const HUES = [38, 46, 205, 350, 140, 22, 265, 190];
const MOTIFS_FOR_GEN = ['rays', 'ikonkar', 'khanda', 'mandala', 'lotus', 'waheguru'];
function genRecipe(seed) {
  const r = seeded(seed);
  const h = HUES[Math.floor(r() * HUES.length)];
  const main = MOTIFS_FOR_GEN[Math.floor(r() * MOTIFS_FOR_GEN.length)];
  const extra = r() < 0.5 ? (r() < 0.5 ? 'bokeh' : 'dots') : null;
  return {
    top: hslHex(h, 70 + r() * 20, 96 + r() * 2),
    bottom: hslHex((h + r() * 24 - 12 + 360) % 360, 55 + r() * 25, 85 + r() * 5),
    glow: hslHex(h, 90, 86),
    tint: hslHex(h, 50 + r() * 20, 36 + r() * 10),
    motifs: [main, ...(extra && extra !== main ? [extra] : [])],
  };
}
export const newSeed = () => Math.floor(Math.random() * 2 ** 31) + 1;
export const genBackground = (seed = newSeed()) => ({ type: 'gen', seed, name: 'Generated' });

const MOTIFS = {
  rays(ctx, tint) {
    ctx.save();
    ctx.translate(W / 2, 420);
    ctx.fillStyle = rgba(tint, 0.07);
    const n = 32;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 1900, a, a + Math.PI / n);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  },
  ikonkar(ctx, tint) {
    ctx.fillStyle = rgba(tint, 0.08);
    ctx.font = `800 760px ${GURMUKHI}`;
    ctx.fillText('ੴ', W / 2, H * 0.52);
  },
  khanda(ctx, tint) {
    khanda(ctx, W / 2, H * 0.5, 6, rgba(tint, 0.06));
  },
  mandala(ctx, tint) {
    ctx.save();
    ctx.translate(W / 2, H * 0.48);
    ctx.strokeStyle = rgba(tint, 0.13);
    ctx.lineWidth = 3;
    for (const [r, n, len] of [
      [150, 12, 70],
      [270, 18, 90],
      [410, 24, 110],
      [570, 32, 120],
      [740, 40, 120],
    ]) {
      ctx.beginPath();
      ctx.arc(0, 0, r - len / 2 - 8, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < n; i++) {
        ctx.save();
        ctx.rotate((i / n) * Math.PI * 2);
        ctx.beginPath();
        ctx.ellipse(0, -r, len / 4, len / 2, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }
    ctx.restore();
  },
  lotus(ctx, tint) {
    const flower = (cx, cy, s, a) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(s, s);
      for (let i = -4; i <= 4; i++) {
        ctx.save();
        ctx.rotate(i * 0.3);
        ctx.fillStyle = rgba(tint, i % 2 ? a : a * 1.5);
        ctx.beginPath();
        ctx.ellipse(0, -150, 60, 160, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    };
    flower(W / 2, H + 40, 1.6, 0.06);
    flower(90, 140, 0.45, 0.06);
    flower(W - 90, 140, 0.45, 0.06);
  },
  waheguru(ctx, tint) {
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(-0.4);
    ctx.fillStyle = rgba(tint, 0.06);
    ctx.font = `600 44px ${GURMUKHI}`;
    for (let row = -14; row <= 14; row++) {
      const line = 'ਵਾਹਿਗੁਰੂ     '.repeat(8);
      ctx.fillText(line, (row % 2) * 120, row * 110);
    }
    ctx.restore();
  },
  dots(ctx, tint) {
    for (let y = 40; y < H; y += 72)
      for (let x = (y / 72) % 2 ? 76 : 40; x < W; x += 72) diamond(ctx, x, y, 9, rgba(tint, 0.08));
  },
  bokeh(ctx, tint, r) {
    for (let i = 0; i < 18; i++) {
      ctx.fillStyle = rgba(tint, 0.03 + r() * 0.04);
      ctx.beginPath();
      ctx.arc(r() * W, r() * H, 20 + r() * 80, 0, Math.PI * 2);
      ctx.fill();
    }
  },
};
function paintRecipe(ctx, recipe, seed) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, recipe.top);
  g.addColorStop(1, recipe.bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  if (recipe.glow) {
    const glow = ctx.createRadialGradient(W / 2, 600, 40, W / 2, 600, 720);
    glow.addColorStop(0, rgba(recipe.glow, 0.35));
    glow.addColorStop(1, rgba(recipe.glow, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
  }
  const r = seeded(seed);
  for (const m of recipe.motifs) MOTIFS[m]?.(ctx, recipe.tint, r);
}
// bg: { type: 'preset', id } | { type: 'gen', seed } | { type: 'image', img, wash, fit: 'cover' | 'whole' }
function paintBackground(ctx, bg) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (bg?.type === 'image' && bg.img) {
    // Cream paper under the picture: shows through see-through PNGs and around a picture shown whole.
    paintRecipe(ctx, PRESETS.paper, 7);
    if (bg.fit === 'whole') contain(ctx, bg.img, 0, 0, W, H);
    else cover(ctx, bg.img, 0, 0, W, H, 0.5);
    if (bg.wash) {
      ctx.fillStyle = `rgba(255, 255, 255, ${bg.wash})`;
      ctx.fillRect(0, 0, W, H);
    }
  } else if (bg?.type === 'gen') {
    paintRecipe(ctx, genRecipe(bg.seed), bg.seed);
  } else {
    paintRecipe(ctx, PRESETS[bg?.id] || PRESETS.paper, 7);
  }
  ctx.restore();
}

/* ---------------- loading ---------------- */
let fontsReady;
export function loadPosterFonts() {
  if (!document.getElementById('poster-fonts')) {
    const link = document.createElement('link');
    link.id = 'poster-fonts';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+Gurmukhi:wght@600;800&family=Noto+Serif:wght@700&display=swap';
    document.head.appendChild(link);
  }
  fontsReady ||= Promise.all([`800 60px ${GURMUKHI}`, `600 40px ${GURMUKHI}`, `700 60px ${SERIF}`].map((f) => document.fonts.load(f, 'ਸ ੴ 0'))).catch(() => {});
  return fontsReady;
}

export function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/* ---------------- drawing helpers ---------------- */
// Biggest font size (down to min) at which the text fits the width.
function fit(ctx, text, maxWidth, weight, size, family = GURMUKHI, min = 24) {
  let s = size;
  do {
    ctx.font = `${weight} ${s}px ${family}`;
    if (ctx.measureText(text || '').width <= maxWidth) break;
    s -= 2;
  } while (s > min);
  return s;
}
function write(ctx, text, x, y, maxWidth, weight, size, family = GURMUKHI, min = 24) {
  if (!text) return;
  ctx.font = `${weight} ${fit(ctx, text, maxWidth, weight, size, family, min)}px ${family}`;
  ctx.fillText(text, x, y);
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}
// The image fills the box (cropped, not stretched); anchorY 0 keeps the top, 0.5 the middle.
function cover(ctx, img, x, y, w, h, anchorY = 1 / 3) {
  const scale = Math.max(w / img.width, h / img.height);
  const iw = img.width * scale;
  const ih = img.height * scale;
  ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) * anchorY, iw, ih);
}
// The whole image fits in the box (nothing cut off), centred.
function contain(ctx, img, x, y, w, h) {
  const scale = Math.min(w / img.width, h / img.height);
  const iw = img.width * scale;
  const ih = img.height * scale;
  ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
}
// A banner with pointed ends, like the ones on printed posters.
function banner(ctx, x, y, w, h, fill, stroke, point = 34) {
  ctx.beginPath();
  ctx.moveTo(x + point, y);
  ctx.lineTo(x + w - point, y);
  ctx.quadraticCurveTo(x + w - point / 3, y + h / 4, x + w, y + h / 2);
  ctx.quadraticCurveTo(x + w - point / 3, y + (3 * h) / 4, x + w - point, y + h);
  ctx.lineTo(x + point, y + h);
  ctx.quadraticCurveTo(x + point / 3, y + (3 * h) / 4, x, y + h / 2);
  ctx.quadraticCurveTo(x + point / 3, y + h / 4, x + point, y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.lineWidth = 5;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}
function diamond(ctx, x, y, s, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = color;
  ctx.fillRect(-s / 2, -s / 2, s, s);
  ctx.restore();
}
function divider(ctx, cx, y, half, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - half, y);
  ctx.lineTo(cx - 18, y);
  ctx.moveTo(cx + 18, y);
  ctx.lineTo(cx + half, y);
  ctx.stroke();
  diamond(ctx, cx, y, 14, color);
}
function goldText(ctx, t, y0, y1) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, t.accentLight);
  g.addColorStop(1, t.accent);
  return g;
}
// The Khanda: double-edged sword, chakkar and the two kirpans.
function khanda(ctx, cx, cy, s, color) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 11;
  ctx.beginPath();
  ctx.arc(0, 8, 34, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -78);
  ctx.lineTo(11, -58);
  ctx.lineTo(9, 40);
  ctx.lineTo(-9, 40);
  ctx.lineTo(-11, -58);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(-20, 38, 40, 8);
  ctx.fillRect(-5, 46, 10, 22);
  ctx.beginPath();
  ctx.arc(0, 72, 7, 0, Math.PI * 2);
  ctx.fill();
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 12, 64);
    ctx.quadraticCurveTo(side * 62, 52, side * 66, -6);
    ctx.quadraticCurveTo(side * 74, 40, side * 18, 76);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(side * 12 - 4, 66, 8, 18);
  }
  ctx.restore();
}
// Small leaf sprays in the corners.
function sprays(ctx, t) {
  const leaf = (x, y, r, a, color) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 0, r, r / 2.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };
  const corner = (x, y, dx, dy) => {
    for (let i = 0; i < 7; i++) {
      const k = i / 6;
      leaf(x + dx * (30 + k * 150), y + dy * (30 + Math.sin(k * 3) * 40), 22 - i, (dx * dy > 0 ? 0.6 : -0.6) + k, i % 2 ? t.accent : t.primary);
      leaf(x + dx * (30 + Math.sin(k * 3) * 40), y + dy * (30 + k * 150), 22 - i, (dx * dy > 0 ? 0.9 : -0.9) - k, i % 2 ? t.primary : t.accent);
    }
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x + dx * 46, y + dy * 46, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = t.accent;
    ctx.beginPath();
    ctx.arc(x + dx * 46, y + dy * 46, 6, 0, Math.PI * 2);
    ctx.fill();
  };
  corner(18, 18, 1, 1);
  corner(W - 18, 18, -1, 1);
  corner(18, H - 18, 1, -1);
  corner(W - 18, H - 18, -1, -1);
}
function calendarIcon(ctx, x, y, color) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 6;
  roundRect(ctx, x, y + 8, 64, 58, 8);
  ctx.stroke();
  ctx.fillRect(x, y + 8, 64, 16);
  ctx.fillRect(x + 14, y, 7, 18);
  ctx.fillRect(x + 43, y, 7, 18);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) ctx.fillRect(x + 9 + c * 13, y + 31 + r * 11, 8, 7);
}
function clockIcon(ctx, x, y, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(x + 34, y + 34, 31, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + 34, y + 14);
  ctx.lineTo(x + 34, y + 36);
  ctx.lineTo(x + 50, y + 44);
  ctx.stroke();
}
// The title photo (e.g. Guru Sahib or the Gurdwara) in a round frame.
function medallion(ctx, img, cx, cy, r, t) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fillStyle = t.paper;
  ctx.fill();
  ctx.clip();
  cover(ctx, img, cx - r, cy - r, r * 2, r * 2, 0.3);
  ctx.restore();
  ctx.lineWidth = 8;
  ctx.strokeStyle = t.accent;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.strokeStyle = t.primary;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 8, 0, Math.PI * 2);
  ctx.stroke();
}
const timeLine = (text) => (text.time ? `${text.timeLabel ? `${text.timeLabel}: ` : ''}${text.time}` : '');

/* ---------------- layouts ---------------- */
// text: { occasion, occasionFor, program, place, name, nameLine, date, timeLabel, time, footer }
function drawKirtan(ctx, text, t, show, d) {
  if (show.frame) {
    ctx.strokeStyle = t.accent;
    ctx.lineWidth = 3;
    roundRect(ctx, 26, 26, W - 52, H - 52, 26);
    ctx.stroke();
  }
  if (show.ornaments) sprays(ctx, t);

  // Title photo (or the Khanda) and the title banner
  if (d.titlePhoto) medallion(ctx, d.titlePhoto, W / 2, 96, 70, t);
  else if (show.khanda) khanda(ctx, W / 2, 98, 0.95, t.primary);
  banner(ctx, 70, 180, W - 140, 270, t.primary, t.accent, 60);
  ctx.fillStyle = t.onPrimary;
  write(ctx, text.occasion, W / 2, text.occasionFor ? 262 : 312, W - 280, 800, 92);
  if (text.occasionFor) {
    ctx.fillStyle = goldText(ctx, t, 330, 410);
    write(ctx, text.occasionFor, W / 2, 365, W - 260, 800, 86);
  }
  divider(ctx, W / 2, 425, 300, t.accent);

  // member photo (right side, fading at the bottom)
  const px = 540;
  const py = 470;
  const pw = 440;
  const ph = 600;
  ctx.save();
  roundRect(ctx, px, py, pw, ph, 36);
  ctx.clip();
  if (d.photo) {
    cover(ctx, d.photo, px, py, pw, ph);
  } else {
    ctx.fillStyle = t.paper;
    ctx.fillRect(px, py, pw, ph);
    khanda(ctx, px + pw / 2, py + ph / 2 - 30, 1.7, rgba(t.primary, 0.18));
  }
  const fade = ctx.createLinearGradient(0, py + ph - 160, 0, py + ph);
  fade.addColorStop(0, rgba(t.paper, 0));
  fade.addColorStop(1, rgba(t.paper, 0.95));
  ctx.fillStyle = fade;
  ctx.fillRect(px, py + ph - 160, pw, 160);
  ctx.restore();

  // program and place (left column)
  const lx = 300;
  divider(ctx, lx, 500, 170, t.ink);
  ctx.fillStyle = t.paper;
  ctx.strokeStyle = t.accent;
  ctx.lineWidth = 5;
  roundRect(ctx, 70, 530, 460, 130, 30);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = t.ink;
  write(ctx, text.program, lx, 597, 400, 800, 70);
  divider(ctx, lx, 690, 170, t.ink);
  if (text.place) {
    banner(ctx, 70, 735, 460, 105, t.primary, t.accent, 30);
    ctx.fillStyle = t.onPrimary;
    write(ctx, text.place, lx, 789, 380, 600, 50);
  }

  // name banner with the gold ribbon under it
  if (text.name) {
    banner(ctx, 40, 930, 700, 135, t.primary, t.accent, 50);
    ctx.fillStyle = t.onPrimary;
    write(ctx, text.name, 390, 999, 560, 800, 74);
  }
  if (text.nameLine) {
    const ribbon = ctx.createLinearGradient(0, 1060, 0, 1140);
    ribbon.addColorStop(0, t.accentLight);
    ribbon.addColorStop(1, t.accent);
    banner(ctx, 150, 1062, 480, 82, ribbon, null, 26);
    ctx.fillStyle = t.deep;
    write(ctx, text.nameLine, 390, 1104, 380, 800, 50);
    diamond(ctx, 200, 1103, 14, t.primary);
    diamond(ctx, 580, 1103, 14, t.primary);
  }

  // date and time box
  const time = timeLine(text);
  if (text.date || time) {
    ctx.fillStyle = rgba(t.paper, 0.94);
    ctx.strokeStyle = t.accent;
    ctx.lineWidth = 5;
    roundRect(ctx, 150, 1180, W - 300, 260, 34);
    ctx.fill();
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.fillStyle = t.ink;
    if (text.date) {
      calendarIcon(ctx, 270, 1214, t.ink);
      write(ctx, text.date, 365, 1252, 420, 700, 66, `"Noto Serif", ${GURMUKHI}`);
    }
    divider(ctx, W / 2, 1310, 230, t.ink);
    if (time) {
      clockIcon(ctx, 270, 1342, t.ink);
      ctx.fillStyle = t.ink;
      // Serif digits like the date; the Gurmukhi word falls back to the Gurmukhi font.
      write(ctx, time, 365, 1378, 420, 700, 62, `"Noto Serif", ${GURMUKHI}`);
    }
    ctx.textAlign = 'center';
  }
  if (show.footer && text.footer) {
    ctx.fillStyle = rgba(t.ink, 0.65);
    write(ctx, text.footer, W / 2, H - 58, W - 200, 600, 26, GURMUKHI, 16);
  }
}

// text: { headline, occasion, occasionFor, program, place, date, timeLabel, time, footer }; d.people: [{ img, name, time }]
function drawSamagam(ctx, text, t, show, d) {
  if (show.frame) {
    ctx.strokeStyle = t.accent;
    ctx.lineWidth = 10;
    ctx.strokeRect(14, 14, W - 28, H - 28);
    ctx.strokeStyle = t.primary;
    ctx.lineWidth = 3;
    ctx.strokeRect(32, 32, W - 64, H - 64);
  }

  // Top: Mool Mantar line, title photo with Khandas either side (or just the Khanda)
  ctx.fillStyle = t.ink;
  write(ctx, text.headline, W / 2, 76, 700, 800, 42);
  if (d.titlePhoto) {
    medallion(ctx, d.titlePhoto, W / 2, 196, 88, t);
    if (show.khanda) {
      khanda(ctx, W / 2 - 240, 196, 0.62, t.primary);
      khanda(ctx, W / 2 + 240, 196, 0.62, t.primary);
    }
  } else if (show.khanda) {
    khanda(ctx, W / 2, 196, 1, t.primary);
  }
  const top = d.titlePhoto || show.khanda ? 306 : 120;

  // Title banner
  const bannerH = text.occasionFor ? 200 : 130;
  banner(ctx, 50, top, W - 100, bannerH, t.primary, t.accent, 50);
  ctx.fillStyle = t.onPrimary;
  write(ctx, text.occasion, W / 2, top + (text.occasionFor ? 62 : 66), W - 220, 800, 76);
  if (text.occasionFor) {
    ctx.fillStyle = goldText(ctx, t, top + 100, top + 180);
    write(ctx, text.occasionFor, W / 2, top + 140, W - 200, 800, 84);
  }

  // Program, place and date
  let y = top + bannerH + 18;
  const placeDate = [text.place, text.date].filter(Boolean).join(' · ');
  if (text.program || placeDate) {
    const boxH = text.program && placeDate ? 132 : 84;
    ctx.fillStyle = rgba(t.paper, 0.95);
    ctx.strokeStyle = t.accent;
    ctx.lineWidth = 5;
    roundRect(ctx, 70, y, W - 140, boxH, 22);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = t.primary;
    if (text.program) write(ctx, text.program, W / 2, y + (placeDate ? 48 : boxH / 2), W - 200, 800, 66);
    ctx.fillStyle = t.ink;
    if (placeDate) write(ctx, placeDate, W / 2, y + (text.program ? 104 : boxH / 2), W - 200, 700, 40, `"Noto Serif", ${GURMUKHI}`, 20);
    y += boxH + 22;
  }

  // Footer band: time and the jatha's name
  const time = timeLine(text);
  const footer = show.footer ? text.footer : '';
  const footH = time && footer ? 120 : time || footer ? 86 : 0;
  const bottom = H - 44 - (footH ? footH + 18 : 0);
  if (footH) {
    const fy = H - 44 - footH;
    banner(ctx, 60, fy, W - 120, footH, t.primary, t.accent, 40);
    ctx.fillStyle = t.onPrimary;
    if (time) write(ctx, time, W / 2, fy + (footer ? 44 : footH / 2), W - 220, 800, 48, `"Noto Serif", ${GURMUKHI}`);
    ctx.fillStyle = t.accentLight;
    if (footer) write(ctx, footer, W / 2, fy + (time ? 90 : footH / 2), W - 220, 600, 28, GURMUKHI, 16);
  }

  // A card per person: photo, name, and their own time
  const people = (d.people || []).slice(0, MAX_PEOPLE);
  const n = people.length;
  if (!n) return;
  const cols = n <= 3 ? n : n === 4 ? 2 : n <= 9 ? 3 : 4;
  const rows = Math.ceil(n / cols);
  const gap = 18;
  const areaW = W - 100;
  const areaH = bottom - y;
  const hasTime = people.some((p) => p.time);
  const nameH = 52;
  const timeH = hasTime ? 40 : 0;
  const cardH = Math.min((areaH - gap * (rows - 1)) / rows, 560);
  const cardW = Math.min((areaW - gap * (cols - 1)) / cols, (cardH - nameH - timeH) * 0.95);
  const gridH = rows * cardH + (rows - 1) * gap;
  const y0 = y + (areaH - gridH) / 2;
  const nameSize = Math.min(32, Math.max(18, cardW / 8));
  people.forEach((p, i) => {
    const row = Math.floor(i / cols);
    const inRow = row === rows - 1 ? n - row * cols : cols;
    const rowW = inRow * cardW + (inRow - 1) * gap;
    const x = (W - rowW) / 2 + (i % cols) * (cardW + gap);
    const cy = y0 + row * (cardH + gap);
    const photoH = cardH - nameH - timeH;
    ctx.save();
    roundRect(ctx, x, cy, cardW, cardH, 20);
    ctx.clip();
    ctx.fillStyle = t.paper;
    ctx.fillRect(x, cy, cardW, cardH);
    if (p.img) cover(ctx, p.img, x, cy, cardW, photoH, 0.25);
    else khanda(ctx, x + cardW / 2, cy + photoH / 2, Math.min(0.9, cardW / 220), rgba(t.primary, 0.16));
    ctx.fillStyle = t.accent;
    ctx.fillRect(x, cy + photoH, cardW, nameH);
    ctx.fillStyle = t.deep;
    write(ctx, p.name || `ਸੇਵਾਦਾਰ ${i + 1}`, x + cardW / 2, cy + photoH + nameH / 2, cardW - 14, 800, nameSize, GURMUKHI, 14);
    if (timeH) {
      ctx.fillStyle = t.primary;
      ctx.fillRect(x, cy + photoH + nameH, cardW, timeH);
      ctx.fillStyle = t.onPrimary;
      if (p.time) write(ctx, p.time, x + cardW / 2, cy + photoH + nameH + timeH / 2, cardW - 14, 700, Math.min(24, nameSize - 4), `"Noto Serif", ${GURMUKHI}`, 12);
    }
    ctx.restore();
    ctx.strokeStyle = t.primary;
    ctx.lineWidth = 4;
    roundRect(ctx, x, cy, cardW, cardH, 20);
    ctx.stroke();
  });
}

/* ---------------- text only ---------------- */
// [id, type, y, size, colour role or photo shape, extra]. Everything starts centred; they can move it anywhere.
// extra: { maxW (widest the line may be), hidden, outline }.
const PLAIN_ITEMS = [
  ['headline', 'text', 80, 38, 'ink'],
  ['titlePhoto', 'photo', 210, 200, 'round'],
  ['occasion', 'text', 380, 88, 'primary'],
  ['occasionFor', 'text', 475, 76, 'accent'],
  ['program', 'text', 575, 66, 'ink'],
  ['place', 'text', 660, 50, 'primary'],
  ['photo', 'photo', 910, 360, 'rect'],
  ['name', 'text', 1190, 72, 'primary'],
  ['nameLine', 'text', 1265, 46, 'ink'],
  ['date', 'text', 1345, 52, 'ink'],
  ['time', 'text', 1415, 52, 'ink'],
  ['footer', 'text', 1490, 28, 'ink'],
];
// Royal frame (public/posters/royal-frame.webp): each line sits inside one of the banners of the picture.
const PLAIN = { outline: false };
const ROYAL_ITEMS = [
  ['headline', 'text', 80, 34, 'ink', { hidden: true }],
  ['titlePhoto', 'photo', 300, 200, 'round', { hidden: true }],
  ['occasion', 'text', 262, 90, 'onPrimary', { ...PLAIN, maxW: 720 }],
  ['occasionFor', 'text', 368, 78, 'accent', { ...PLAIN, maxW: 780 }],
  ['program', 'text', 603, 66, 'primary', { ...PLAIN, maxW: 580 }],
  ['place', 'text', 795, 52, 'onPrimary', { ...PLAIN, maxW: 480 }],
  ['photo', 'photo', 770, 340, 'round', { hidden: true }],
  ['name', 'text', 948, 78, 'onPrimary', { ...PLAIN, maxW: 620 }],
  ['nameLine', 'text', 1060, 46, 'deep', { ...PLAIN, maxW: 440 }],
  ['date', 'text', 1215, 60, 'ink', { ...PLAIN, maxW: 600 }],
  ['time', 'text', 1300, 58, 'ink', { ...PLAIN, maxW: 600 }],
  ['footer', 'text', 1372, 28, 'ink', { ...PLAIN, maxW: 560 }],
];
// Royal with photo: the frame cut into pieces — program and place banners move into a left column, the photo goes
// on the right and the name banner (bottom piece) sits over the bottom of the photo.
const ROYAL_PHOTO_ITEMS = ROYAL_ITEMS.map((row) => {
  const [id] = row;
  if (id === 'program') return ['program', 'text', 590, 54, 'primary', { ...PLAIN, maxW: 380, x: 280 }];
  if (id === 'place') return ['place', 'text', 743, 42, 'onPrimary', { ...PLAIN, maxW: 320, x: 280 }];
  if (id === 'photo') return ['photo', 'photo', 742, 440, 'rect', { x: 770 }];
  return row;
});
// Arch frames (public/posters/arch-*.webp): the photo shows through the arch window; the frame is drawn over it.
// Boxes measured on the 1024 × 1536 pictures, as [centre x, centre y, width, height]. `dark`: a dark banner (white words).
const ARCH_SLOTS = {
  cream: { title: [514, 343, 685, 179], program: [266, 822, 358, 125], place: [266, 979, 360, 93, 'dark'], name: [509, 1210, 779, 142], when: [511, 1368, 616, 128], win: [450, 463, 491, 689] },
  blue: { title: [506, 340, 713, 166], program: [267, 795, 326, 120], place: [262, 970, 312, 104], name: [519, 1207, 646, 137], when: [509, 1364, 546, 128], win: [447, 462, 469, 719] },
  lavender: { title: [515, 354, 700, 160], program: [259, 801, 347, 121], place: [262, 970, 340, 116], name: [515, 1212, 694, 136], when: [515, 1372, 541, 122], win: [447, 461, 489, 695] },
  maroon: { title: [530, 416, 643, 145], program: [287, 818, 386, 110], place: [287, 951, 358, 78, 'dark'], name: [523, 1147, 676, 113], when: [522, 1275, 587, 99], win: [482, 509, 458, 618], top: 76, bottom: 1462 },
  teal: { title: [483, 384, 632, 145], program: [267, 811, 308, 107], place: [269, 941, 304, 79, 'dark'], name: [548, 1147, 661, 127], when: [544, 1294, 571, 123], win: [452, 482, 511, 639], top: 60, bottom: 1478 },
};
const rnd = Math.round;
// Each box may end with `dark`: true for a dark banner (white words), false for a light one (dark words). Unset, the
// title and name banners are dark and the rest light.
function archItems({ title: [tx, ty, tw, th, tDark = true], program: [px, py, pw, ph, pDark], place: [lx, ly, lw, lh, lDark], name: [nx, ny, nw, nh, nDark = true], when: [wx, wy, ww, wh, wDark], win: [vx, vy, vw, vh], top, bottom }) {
  const text = (x, maxW, more) => ({ ...PLAIN, x, maxW: rnd(maxW * 0.8), ...more });
  const main = (dark) => (dark ? 'onPrimary' : 'primary');
  const second = (dark) => (dark ? 'accent' : 'ink');
  return [
    ['headline', 'text', top || 70, 38, 'primary', { ...PLAIN, hidden: !top }],
    ['titlePhoto', 'photo', 200, 180, 'round', { hidden: true }],
    // Two lines in the title banner; one line moves to the middle when the other is empty.
    ['occasion', 'text', rnd(ty - th * 0.2), rnd(th * 0.36), main(tDark), text(tx, tw, { pair: { with: 'occasionFor', dy: rnd(th * 0.2) } })],
    ['occasionFor', 'text', rnd(ty + th * 0.21), rnd(th * 0.32), second(tDark), text(tx, tw, { pair: { with: 'occasion', dy: -rnd(th * 0.21) } })],
    ['program', 'text', py, Math.min(56, rnd(ph * 0.42)), main(pDark), text(px, pw)],
    ['place', 'text', ly, Math.min(52, rnd(lh * 0.44)), main(lDark), text(lx, lw)],
    // Covers the whole window (a little more, under the frame's edge).
    ['photo', 'photo', rnd(vy + vh / 2), vw + 16, 'rect', { x: rnd(vx + vw / 2), ratio: (vh + 16) / (vw + 16), border: false, placeholder: true }],
    ['name', 'text', rnd(ny - nh * 0.13), rnd(nh * 0.42), main(nDark), text(nx, nw, { pair: { with: 'nameLine', dy: rnd(nh * 0.13) } })],
    ['nameLine', 'text', rnd(ny + nh * 0.27), rnd(nh * 0.24), second(nDark), text(nx, nw)],
    ['date', 'text', rnd(wy - wh * 0.21), rnd(wh * 0.34), main(wDark), text(wx, ww, { pair: { with: 'time', dy: rnd(wh * 0.21) } })],
    ['time', 'text', rnd(wy + wh * 0.23), rnd(wh * 0.32), main(wDark), text(wx, ww, { pair: { with: 'date', dy: -rnd(wh * 0.23) } })],
    ['footer', 'text', bottom || 1490, 28, 'primary', { ...PLAIN, hidden: !bottom }],
  ];
}

// Where a picture sits on the poster when shown whole (never cropped or stretched): [x, y, w, h].
function containRect(img) {
  const k = Math.min(W / img.width, H / img.height);
  return [(W - img.width * k) / 2, (H - img.height * k) / 2, img.width * k, img.height * k];
}

/**
 * A frame design someone uploaded (a PNG with a see-through window for the photo): finds the window and the banners,
 * and puts each line in a banner — title above the window, program and place beside it, name and date / time below.
 * Returns { items, palette }, or null when the picture has no see-through window.
 */
export function detectFrame(img) {
  const S = 0.5; // looked at half size: quick, and plenty for finding banners
  const w = W * S;
  const h = H * S;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const cx = c.getContext('2d', { willReadFrequently: true });
  const [rx, ry, rw, rh] = containRect(img);
  cx.drawImage(img, rx * S, ry * S, rw * S, rh * S);
  let data;
  try {
    data = cx.getImageData(0, 0, w, h).data;
  } catch {
    return null;
  }
  const n = w * h;
  const seen = new Uint8Array(n);
  const stack = new Int32Array(n);
  // Joins neighbours while `same(from, to)` holds; returns the area's size, box and average colour.
  const flood = (start, same) => {
    let top = 0;
    let count = 0;
    let x0 = w;
    let y0 = h;
    let x1 = -1;
    let y1 = -1;
    let edge = false;
    const sum = [0, 0, 0];
    stack[top++] = start;
    seen[start] = 1;
    while (top) {
      const i = stack[--top];
      const x = i % w;
      const y = (i - x) / w;
      count++;
      sum[0] += data[i * 4];
      sum[1] += data[i * 4 + 1];
      sum[2] += data[i * 4 + 2];
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      if (!x || !y || x === w - 1 || y === h - 1) edge = true;
      for (const j of [x ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) {
        if (j >= 0 && j < n && !seen[j] && same(i, j)) {
          seen[j] = 1;
          stack[top++] = j;
        }
      }
    }
    return { count, x0, y0, x1, y1, edge, color: sum.map((v) => v / count) };
  };
  const alpha = (i) => data[i * 4 + 3];

  // The photo window: the biggest see-through area that does not reach the edge of the poster.
  let win = null;
  for (let i = 0; i < n; i++) {
    if (seen[i] || alpha(i) >= 60) continue;
    const r = flood(i, (_, j) => alpha(j) < 60);
    if (!r.edge && r.count > n * 0.03 && (!win || r.count > win.count)) win = r;
  }
  if (!win) return null;
  const box = (r) => [(r.x0 + (r.x1 - r.x0 + 1) / 2) / S, (r.y0 + (r.y1 - r.y0 + 1) / 2) / S, (r.x1 - r.x0 + 1) / S, (r.y1 - r.y0 + 1) / S];
  const [wcx, wcy, ww, wh] = box(win);
  const wTop = wcy - wh / 2;
  const wBottom = wcy + wh / 2;
  const wLeft = wcx - ww / 2;
  const wRight = wcx + ww / 2;

  // Banners: wide, filled areas of one colour (shading allowed), outlined by something else (the gold edge).
  seen.fill(0);
  const diff = (i, j) => Math.abs(data[i * 4] - data[j * 4]) + Math.abs(data[i * 4 + 1] - data[j * 4 + 1]) + Math.abs(data[i * 4 + 2] - data[j * 4 + 2]);
  const slots = [];
  for (let i = 0; i < n; i++) {
    if (seen[i] || alpha(i) < 200) continue;
    const r = flood(i, (a, b) => alpha(b) >= 200 && diff(a, b) < 24);
    const bw = r.x1 - r.x0 + 1;
    const bh = r.y1 - r.y0 + 1;
    if (r.count < n * 0.004 || r.count > n * 0.25 || bw < w * 0.18 || bw < 1.8 * bh || bh < h * 0.025 || r.count / (bw * bh) < 0.6) continue;
    const [scx, scy, sw, sh] = box(r);
    if (scx > wLeft && scx < wRight && scy > wTop && scy < wBottom) continue; // inside the window
    const [cr, cg, cb] = r.color;
    slots.push({ at: [scx, scy, sw, sh], dark: 0.299 * cr + 0.587 * cg + 0.114 * cb < 140, color: r.color });
  }
  slots.sort((a, b) => a.at[1] - b.at[1]);
  const beside = slots.filter((s) => s.at[1] > wTop && s.at[1] < wBottom - s.at[3] / 2 && (s.at[0] + s.at[2] / 2 <= wLeft + 30 || s.at[0] - s.at[2] / 2 >= wRight - 30));
  const above = slots.filter((s) => s.at[1] <= wTop);
  const below = slots.filter((s) => s.at[1] >= wBottom - s.at[3] / 2 && !beside.includes(s));
  const title = [...above].sort((a, b) => b.at[2] - a.at[2])[0];
  const found = { title, program: beside[0], place: beside[1], name: below[0], when: below[1] };
  // A banner it could not find falls back to where it is on the cream arch frame; they can drag the line.
  // Dark or light is read from the picture at that place.
  const darkAt = ([x, y]) => {
    const i = Math.round(y * S) * w + Math.round(x * S);
    const [r, g, b, a] = data.slice(i * 4, i * 4 + 4);
    return a >= 200 && 0.299 * r + 0.587 * g + 0.114 * b < 140;
  };
  const slot = (k) => (found[k] ? [...found[k].at, found[k].dark] : [...ARCH_SLOTS.cream[k].slice(0, 4), darkAt(ARCH_SLOTS.cream[k])]);
  const topGap = ry;
  const bottomGap = H - (ry + rh);
  const items = archItems({
    title: slot('title'),
    program: slot('program'),
    place: slot('place'),
    name: slot('name'),
    when: slot('when'),
    win: [wLeft, wTop, ww, wh],
    top: topGap >= 100 ? rnd(topGap / 2) : 0,
    bottom: bottomGap >= 100 ? rnd(H - bottomGap / 2) : 0,
  });
  const darkest = [found.title, found.name].filter((s) => s?.dark).sort((a, b) => a.color.reduce((x, y) => x + y) - b.color.reduce((x, y) => x + y))[0];
  const primary = darkest ? toHex(darkest.color) : '#14285a';
  return { items: rowsToItems(items), palette: { primary, accent: '#f0c22e', ink: primary } };
}
const ITEM_SETS = { plain: PLAIN_ITEMS, royal: ROYAL_ITEMS, royalPhoto: ROYAL_PHOTO_ITEMS, ...Object.fromEntries(Object.entries(ARCH_SLOTS).map(([k, v]) => [`arch-${k}`, archItems(v)])) };
// Pieces of a template's frame picture: src [x, y, w, h] in the picture (1024 × 1536) → dst [x, y, w, h] on the poster.
// `over` pieces are drawn on top of the photos.
const PIECE_SETS = {
  royalPhoto: [
    { src: [0, 0, 1024, 468], dst: [0, 0, 1024, 468] }, // Khanda, corners and the title banner
    { src: [280, 466, 465, 62], dst: [100, 482, 360, 48] }, // diamond divider
    { src: [150, 527, 724, 158], dst: [30, 535, 500, 109] }, // cream program banner
    { src: [290, 684, 445, 50], dst: [110, 652, 340, 38] }, // diamond divider
    { src: [160, 734, 710, 122], dst: [30, 700, 500, 86] }, // place banner
    { src: [280, 466, 465, 62], dst: [100, 800, 360, 48] }, // diamond divider
    { src: [0, 866, 1024, 670], dst: [0, 866, 1024, 670], over: true }, // name banner, ribbon, date box, bottom corners
  ],
};
/** Starting place, size and colour of every line and photo for a text template (by template id). */
export const textOnlyItems = (templateId) => rowsToItems(ITEM_SETS[templateById(templateId).items] || PLAIN_ITEMS);
function rowsToItems(rows) {
  return rows.map(([id, type, y, size, look, extra = {}]) => ({
    id,
    type,
    x: W / 2,
    y,
    size,
    ...(type === 'photo' ? { shape: look, border: true } : { role: look, color: '', outline: true, maxW: W - 60 }),
    hidden: false,
    ...extra,
  }));
}
// Numbers read better in the serif font; Gurmukhi letters fall back to the Gurmukhi font.
const SERIF_ITEMS = new Set(['date', 'time']);
const lightness = (hex) => {
  const [r, g, b] = hexRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
};
// Text colour for an item: its own colour, or the template colour for its role.
export const itemColor = (it, palette) => it.color || themeOf(palette)[it.role] || themeOf(palette).ink;

// d.items: [{ id, type, x, y, size, … }]; d.selected: id to outline (editor only); d.hits: filled with each item's box.
function drawTextOnly(ctx, text, t, show, d) {
  // The template's frame picture over the background: whole (never cropped), or cut into pieces and rearranged.
  const tpl = d.template || templateById(d.templateId);
  const pieces = d.overlay && (PIECE_SETS[tpl.pieces] || [{ src: [0, 0, d.overlay.width, d.overlay.height], dst: containRect(d.overlay), over: !!tpl.overlayOver }]);
  const drawPieces = (over) => {
    for (const p of pieces.filter((x) => !!x.over === over)) ctx.drawImage(d.overlay, ...p.src, ...p.dst);
  };
  if (pieces) drawPieces(false);
  const items = d.items || textOnlyItems(d.templateId);
  const wordsOf = (it) => (it.hidden ? '' : it.id === 'time' ? timeLine(text) : text[it.id]);
  // Photos first, then the frame pieces that go over them, then all the words on top.
  const ordered = [...items.filter((it) => it.type === 'photo'), 'pieces', ...items.filter((it) => it.type !== 'photo')];
  for (const it of ordered) {
    if (it === 'pieces') {
      if (pieces) drawPieces(true);
      continue;
    }
    if (it.hidden) continue;
    let box;
    if (it.type === 'photo') {
      const img = it.id === 'titlePhoto' ? d.titlePhoto : d.photo;
      if (!img && !it.placeholder) continue;
      const w = it.size;
      const h = it.shape === 'round' ? w : Math.round(w * (it.ratio || 1.2));
      box = { x: it.x - w / 2, y: it.y - h / 2, w, h };
      const shape = () => {
        ctx.beginPath();
        if (it.shape === 'round') ctx.arc(it.x, it.y, w / 2, 0, Math.PI * 2);
        else ctx.roundRect(box.x, box.y, w, h, Math.min(36, w / 10));
      };
      ctx.save();
      shape();
      ctx.clip();
      if (img) cover(ctx, img, box.x, box.y, w, h, it.shape === 'round' ? 0.3 : 1 / 3);
      else {
        // No photo yet: a soft panel with the Khanda, so the frame's window is not empty.
        ctx.fillStyle = t.paper;
        ctx.fillRect(box.x, box.y, w, h);
        khanda(ctx, it.x, it.y, Math.min(w, h) / 200, rgba(t.primary, 0.16));
      }
      ctx.restore();
      if (it.border) {
        shape();
        ctx.lineWidth = Math.max(4, w / 45);
        ctx.strokeStyle = t.accent;
        ctx.stroke();
      }
    } else {
      const words = wordsOf(it);
      if (!words) continue;
      // Paired lines (e.g. the two title lines): alone, the line moves to where the pair's middle was.
      const partner = it.pair && items.find((x) => x.id === it.pair.with);
      const y = it.y + (it.pair && !(partner && wordsOf(partner)) ? it.pair.dy : 0);
      const family = SERIF_ITEMS.has(it.id) ? `"Noto Serif", ${GURMUKHI}` : GURMUKHI;
      const weight = SERIF_ITEMS.has(it.id) ? 700 : 800;
      const size = fit(ctx, words, it.maxW || W - 60, weight, it.size, family, 14);
      ctx.font = `${weight} ${size}px ${family}`;
      const color = it.color || t[it.role] || t.ink;
      if (it.outline) {
        ctx.lineJoin = 'round';
        ctx.lineWidth = Math.max(4, size * 0.16);
        ctx.strokeStyle = lightness(color) > 0.55 ? 'rgba(20, 16, 10, 0.9)' : 'rgba(255, 255, 255, 0.92)';
        ctx.strokeText(words, it.x, y);
      }
      ctx.fillStyle = color;
      ctx.fillText(words, it.x, y);
      const w = ctx.measureText(words).width;
      box = { x: it.x - w / 2, y: y - size * 0.75, w, h: size * 1.5 };
    }
    d.hits?.push({ id: it.id, ...box });
    if (d.selected === it.id) {
      ctx.save();
      ctx.setLineDash([14, 10]);
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#e8343a';
      ctx.strokeRect(box.x - 10, box.y - 10, box.w + 20, box.h + 20);
      ctx.restore();
    }
  }
}

/**
 * Draws a poster. width < W gives a smaller copy (thumbnails); the layout is the same.
 * design: { layout: 'kirtan' | 'samagam' | 'text', text, palette, bg, show, photo, titlePhoto, people, items, selected, hits }
 */
export function renderPoster(canvas, design, width = W) {
  const k = width / W;
  canvas.width = Math.round(W * k);
  canvas.height = Math.round(H * k);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(k, 0, 0, k, 0, 0);
  paintBackground(ctx, design.bg);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const show = { khanda: true, ornaments: true, frame: true, footer: true, ...design.show };
  ({ samagam: drawSamagam, text: drawTextOnly }[design.layout] || drawKirtan)(ctx, design.text || {}, themeOf(design.palette), show, design);
  return canvas;
}

/** Just the background, e.g. for a swatch or to share it with the team. */
export function renderBackground(canvas, bg, width = W) {
  const k = width / W;
  canvas.width = Math.round(W * k);
  canvas.height = Math.round(H * k);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(k, 0, 0, k, 0, 0);
  paintBackground(ctx, bg);
  return canvas;
}
