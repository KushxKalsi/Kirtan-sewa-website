// Drawing logic for the drifting golden motes. Runs in a worker when the browser supports
// OffscreenCanvas (so the page itself does no work per frame), otherwise on the page.

const SPRITE = 64; // px; each mote is this glow image drawn smaller

const newCanvas = (w, h) => {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};

/** A soft round glow in one colour, drawn once and reused for every mote. */
function makeSprite(rgb) {
  const c = newCanvas(SPRITE, SPRITE);
  const g = c.getContext('2d');
  const half = SPRITE / 2;
  const grad = g.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0, `rgba(${rgb},1)`);
  grad.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, SPRITE, SPRITE);
  return c;
}

const nextFrame = (fn) =>
  typeof requestAnimationFrame === 'function' ? requestAnimationFrame(fn) : setTimeout(() => fn(performance.now()), 16);
const cancelFrame = (id) => (typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame(id) : clearTimeout(id));

export function createField(canvas, { density = 1, low = false, reduce = false, colors = [] }) {
  const ctx = canvas.getContext('2d');
  let w = 0;
  let h = 0;
  let raf = 0;
  let last = 0;
  let running = false;
  let particles = [];
  let sprites = colors.map(makeSprite);

  const spawn = (anywhere) => ({
    x: Math.random() * w,
    y: anywhere ? Math.random() * h : h + 10,
    r: Math.random() * 1.8 + 0.4,
    vy: Math.random() * 0.35 + 0.08,
    vx: (Math.random() - 0.5) * 0.15,
    phase: Math.random() * Math.PI * 2,
    tone: Math.random() < 0.7 ? 0 : 1,
  });

  const draw = (t) => {
    // Speeds are per 60 Hz frame; scale by real time so 30/90/120 Hz screens drift the same.
    const step = last ? Math.min((t - last) / 16.67, 3) : 1;
    last = t;
    ctx.clearRect(0, 0, w, h);
    for (const p of particles) {
      if (!reduce) {
        p.y -= p.vy * step;
        p.x += (p.vx + Math.sin(t / 2000 + p.phase) * 0.12) * step;
        if (p.y < -10) Object.assign(p, spawn(false));
      }
      const size = p.r * 6;
      ctx.globalAlpha = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(t / 900 + p.phase));
      ctx.drawImage(sprites[p.tone], p.x - size, p.y - size, size * 2, size * 2);
    }
    ctx.globalAlpha = 1;
  };

  const tick = (t) => {
    if (!running) return;
    raf = nextFrame(tick);
    // Weak phones: 30 fps is plenty for slow drifting light.
    if (low && last && t - last < 30) return;
    draw(t);
  };

  const field = {
    resize(width, height, dpr) {
      const ratio = Math.min(dpr || 1, low ? 1 : 2);
      w = width;
      h = height;
      canvas.width = Math.max(1, Math.round(w * ratio));
      canvas.height = Math.max(1, Math.round(h * ratio));
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      const count = Math.round(Math.min(90, (w * h) / 16000) * density * (low ? 0.45 : 1));
      particles = Array.from({ length: count }, () => spawn(true));
      if (!running) draw(performance.now());
    },
    setColors(next) {
      sprites = next.map(makeSprite);
      if (!running) draw(performance.now());
    },
    setLow(value) {
      low = value;
    },
    setRunning(value) {
      if (reduce) value = false; // reduced motion: one still frame
      if (value === running) return;
      running = value;
      cancelFrame(raf);
      last = 0;
      if (running) raf = nextFrame(tick);
    },
    destroy() {
      running = false;
      cancelFrame(raf);
    },
  };
  return field;
}
