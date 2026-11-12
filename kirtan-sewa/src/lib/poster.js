/**
 * Kirtan program posters (1024 × 1536), drawn on a canvas in the style of Punjab Gurdwara / village posters. Text is
 * drawn with Noto Sans Gurmukhi so the letters are always right.
 *
 * Two layouts:
 *  - kirtan:  one featured person — title banner, program and place, their photo, name banner, date and time box.
 *  - samagam: many people — title banner, program, then a card per person (photo, name and their own time).
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
  { id: 'kirtan-classic', kind: 'kirtan', name: 'Classic', note: 'Navy and gold on cream', palette: { primary: '#14285a', accent: '#d4a227', ink: '#14285a' }, bg: { type: 'preset', id: 'paper' } },
  { id: 'kirtan-kesri', kind: 'kirtan', name: 'Kesri', note: 'Saffron light', palette: { primary: '#8c2f0c', accent: '#f0a830', ink: '#5e1f08' }, bg: { type: 'preset', id: 'rays' } },
  { id: 'kirtan-neela', kind: 'kirtan', name: 'Neela', note: 'Soft blue with Khanda', palette: { primary: '#1f4f8a', accent: '#d0a53a', ink: '#163a66' }, bg: { type: 'preset', id: 'khanda' } },
  { id: 'samagam-board', kind: 'samagam', name: 'Samagam board', note: 'Maroon and yellow', palette: { primary: '#6b1f22', accent: '#f2c318', ink: '#3b1214' }, bg: { type: 'preset', id: 'ikonkar' } },
  { id: 'samagam-neela', kind: 'samagam', name: 'Samagam neela', note: 'Blue and gold, morning sky', palette: { primary: '#14285a', accent: '#d4a227', ink: '#14285a' }, bg: { type: 'preset', id: 'sky' } },
  { id: 'samagam-lotus', kind: 'samagam', name: 'Lotus', note: 'Soft pink and maroon', palette: { primary: '#7a2340', accent: '#e6a23c', ink: '#5a1a2f' }, bg: { type: 'preset', id: 'lotus' } },
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
// bg: { type: 'preset', id } | { type: 'gen', seed } | { type: 'image', img, wash }
function paintBackground(ctx, bg) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (bg?.type === 'image' && bg.img) {
    cover(ctx, bg.img, 0, 0, W, H, 0.5);
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

/**
 * Draws a poster. width < W gives a smaller copy (thumbnails); the layout is the same.
 * design: { layout: 'kirtan' | 'samagam', text, palette, bg, show, photo, titlePhoto, people }
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
  (design.layout === 'samagam' ? drawSamagam : drawKirtan)(ctx, design.text || {}, themeOf(design.palette), show, design);
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
