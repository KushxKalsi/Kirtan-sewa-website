/**
 * Draws a kirtan program poster (1024 × 1536) in the style of a Punjab Gurdwara / village poster: Khanda at the top,
 * the occasion in a navy banner, the program and village, the member's photo, their name on a banner with a gold
 * ribbon, and the date and time in a framed box. Text is drawn with Noto Sans Gurmukhi so the letters are always right.
 *
 * text: { occasion, occasionFor, program, place, name, nameLine, date, timeLabel, time, footer }
 */
const W = 1024;
const H = 1536;
const NAVY = '#14285a';
const NAVY_DEEP = '#0d1c44';
const GOLD = '#d4a227';
const GOLD_LIGHT = '#f6d27a';
const CREAM = '#fbf5e6';
const GURMUKHI = '"Noto Sans Gurmukhi", "Mukta Mahee", sans-serif';
const SERIF = '"Noto Serif", Georgia, serif';

let fontsReady;
export function loadPosterFonts() {
  if (!document.getElementById('poster-fonts')) {
    const link = document.createElement('link');
    link.id = 'poster-fonts';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+Gurmukhi:wght@600;800&family=Noto+Serif:wght@700&display=swap';
    document.head.appendChild(link);
  }
  fontsReady ||= Promise.all([`800 60px ${GURMUKHI}`, `600 40px ${GURMUKHI}`, `700 60px ${SERIF}`].map((f) => document.fonts.load(f, 'ਸ 0'))).catch(() => {});
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

// Biggest font size (down to min) at which the text fits the width.
function fit(ctx, text, maxWidth, weight, size, family = GURMUKHI, min = 24) {
  let s = size;
  do {
    ctx.font = `${weight} ${s}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    s -= 2;
  } while (s > min);
  return s;
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
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
// The Khanda: double-edged sword, chakkar and the two kirpans.
function khanda(ctx, cx, cy, s, color) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  // chakkar
  ctx.lineWidth = 11;
  ctx.beginPath();
  ctx.arc(0, 8, 34, 0, Math.PI * 2);
  ctx.stroke();
  // khanda blade
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
  // kirpans
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
function sprays(ctx) {
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
      const t = i / 6;
      leaf(x + dx * (30 + t * 150), y + dy * (30 + Math.sin(t * 3) * 40), 22 - i, (dx * dy > 0 ? 0.6 : -0.6) + t, i % 2 ? GOLD : NAVY);
      leaf(x + dx * (30 + Math.sin(t * 3) * 40), y + dy * (30 + t * 150), 22 - i, (dx * dy > 0 ? 0.9 : -0.9) - t, i % 2 ? NAVY : GOLD);
    }
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x + dx * 46, y + dy * 46, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = GOLD;
    ctx.beginPath();
    ctx.arc(x + dx * 46, y + dy * 46, 6, 0, Math.PI * 2);
    ctx.fill();
  };
  corner(18, 18, 1, 1);
  corner(W - 18, 18, -1, 1);
  corner(18, H - 18, 1, -1);
  corner(W - 18, H - 18, -1, -1);
}
function calendarIcon(ctx, x, y) {
  ctx.strokeStyle = NAVY;
  ctx.fillStyle = NAVY;
  ctx.lineWidth = 6;
  roundRect(ctx, x, y + 8, 64, 58, 8);
  ctx.stroke();
  ctx.fillRect(x, y + 8, 64, 16);
  ctx.fillRect(x + 14, y, 7, 18);
  ctx.fillRect(x + 43, y, 7, 18);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) ctx.fillRect(x + 9 + c * 13, y + 31 + r * 11, 8, 7);
}
function clockIcon(ctx, x, y) {
  ctx.strokeStyle = NAVY;
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

export function drawPoster(canvas, text, photo) {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // paper
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#fdf9ef');
  bg.addColorStop(1, '#f4ead3');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, 640, 40, W / 2, 640, 620);
  glow.addColorStop(0, 'rgba(246, 210, 122, 0.25)');
  glow.addColorStop(1, 'rgba(246, 210, 122, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 3;
  roundRect(ctx, 26, 26, W - 52, H - 52, 26);
  ctx.stroke();
  sprays(ctx);

  // Khanda and the title banner
  khanda(ctx, W / 2, 98, 0.95, NAVY);
  banner(ctx, 70, 180, W - 140, 270, NAVY, GOLD, 60);
  ctx.fillStyle = '#fff';
  const s1 = fit(ctx, text.occasion, W - 280, 800, 92);
  ctx.font = `800 ${s1}px ${GURMUKHI}`;
  ctx.fillText(text.occasion, W / 2, text.occasionFor ? 262 : 312);
  if (text.occasionFor) {
    const s2 = fit(ctx, text.occasionFor, W - 260, 800, 86);
    const gold = ctx.createLinearGradient(0, 330, 0, 410);
    gold.addColorStop(0, GOLD_LIGHT);
    gold.addColorStop(1, GOLD);
    ctx.fillStyle = gold;
    ctx.font = `800 ${s2}px ${GURMUKHI}`;
    ctx.fillText(text.occasionFor, W / 2, 365);
  }
  divider(ctx, W / 2, 425, 300, GOLD);

  // member photo (right side, fading into the paper at the bottom)
  const px = 540;
  const py = 470;
  const pw = 440;
  const ph = 600;
  ctx.save();
  roundRect(ctx, px, py, pw, ph, 36);
  ctx.clip();
  if (photo) {
    const scale = Math.max(pw / photo.width, ph / photo.height);
    const iw = photo.width * scale;
    const ih = photo.height * scale;
    ctx.drawImage(photo, px + (pw - iw) / 2, py + (ph - ih) / 3, iw, ih);
  } else {
    ctx.fillStyle = '#efe3c6';
    ctx.fillRect(px, py, pw, ph);
    khanda(ctx, px + pw / 2, py + ph / 2 - 30, 1.7, 'rgba(20, 40, 90, 0.18)');
  }
  const fade = ctx.createLinearGradient(0, py + ph - 160, 0, py + ph);
  fade.addColorStop(0, 'rgba(244, 234, 211, 0)');
  fade.addColorStop(1, 'rgba(244, 234, 211, 0.95)');
  ctx.fillStyle = fade;
  ctx.fillRect(px, py + ph - 160, pw, 160);
  ctx.restore();

  // program and place (left column)
  const lx = 300;
  divider(ctx, lx, 500, 170, NAVY);
  ctx.fillStyle = CREAM;
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 5;
  roundRect(ctx, 70, 530, 460, 130, 30);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = NAVY;
  ctx.font = `800 ${fit(ctx, text.program, 400, 800, 70)}px ${GURMUKHI}`;
  ctx.fillText(text.program, lx, 597);
  divider(ctx, lx, 690, 170, NAVY);
  if (text.place) {
    banner(ctx, 70, 735, 460, 105, NAVY, GOLD, 30);
    ctx.fillStyle = '#fff';
    ctx.font = `600 ${fit(ctx, text.place, 380, 600, 50)}px ${GURMUKHI}`;
    ctx.fillText(text.place, lx, 789);
  }

  // name banner with the gold ribbon under it
  banner(ctx, 40, 930, 700, 135, NAVY, GOLD, 50);
  ctx.fillStyle = '#fff';
  ctx.font = `800 ${fit(ctx, text.name, 560, 800, 74)}px ${GURMUKHI}`;
  ctx.fillText(text.name, 390, 999);
  if (text.nameLine) {
    const ribbon = ctx.createLinearGradient(0, 1060, 0, 1140);
    ribbon.addColorStop(0, GOLD_LIGHT);
    ribbon.addColorStop(1, GOLD);
    banner(ctx, 150, 1062, 480, 82, ribbon, null, 26);
    ctx.fillStyle = NAVY_DEEP;
    ctx.font = `800 ${fit(ctx, text.nameLine, 380, 800, 50)}px ${GURMUKHI}`;
    ctx.fillText(text.nameLine, 390, 1104);
    diamond(ctx, 200, 1103, 14, NAVY);
    diamond(ctx, 580, 1103, 14, NAVY);
  }

  // date and time box
  ctx.fillStyle = 'rgba(255, 252, 243, 0.94)';
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 5;
  roundRect(ctx, 150, 1180, W - 300, 260, 34);
  ctx.fill();
  ctx.stroke();
  ctx.textAlign = 'left';
  calendarIcon(ctx, 270, 1214);
  ctx.fillStyle = NAVY;
  ctx.font = `700 ${fit(ctx, text.date, 420, 700, 66, SERIF)}px ${SERIF}`;
  ctx.fillText(text.date, 365, 1252);
  divider(ctx, W / 2, 1310, 230, NAVY);
  clockIcon(ctx, 270, 1342);
  const timeLine = `${text.timeLabel ? `${text.timeLabel}: ` : ''}${text.time}`;
  // Serif digits like the date; the Gurmukhi word falls back to the Gurmukhi font.
  const timeFont = `"Noto Serif", ${GURMUKHI}`;
  ctx.font = `700 ${fit(ctx, timeLine, 420, 700, 62, timeFont)}px ${timeFont}`;
  ctx.fillText(timeLine, 365, 1378);
  ctx.textAlign = 'center';
  if (text.footer) {
    ctx.fillStyle = 'rgba(20, 40, 90, 0.6)';
    ctx.font = `600 26px ${GURMUKHI}`;
    ctx.fillText(text.footer, W / 2, H - 58);
  }
  return canvas;
}
