import { useEffect, useRef } from 'react';

/** Soft golden motes drifting upward, like light in a Darbar. Canvas based to stay light on phones. */
export default function Particles({ className, density = 1 }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext('2d');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let w = 0;
    let h = 0;
    let raf = 0;
    let visible = true;
    let particles = [];

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round(Math.min(90, (w * h) / 16000) * density);
      particles = Array.from({ length: count }, () => spawn(true));
    };

    const spawn = (anywhere) => ({
      x: Math.random() * w,
      y: anywhere ? Math.random() * h : h + 10,
      r: Math.random() * 1.8 + 0.4,
      vy: Math.random() * 0.35 + 0.08,
      vx: (Math.random() - 0.5) * 0.15,
      phase: Math.random() * Math.PI * 2,
      hue: Math.random() < 0.7 ? '246,213,142' : '255,153,51',
    });

    const tick = (t) => {
      ctx.clearRect(0, 0, w, h);
      for (const p of particles) {
        if (!reduce) {
          p.y -= p.vy;
          p.x += p.vx + Math.sin(t / 2000 + p.phase) * 0.12;
          if (p.y < -10) Object.assign(p, spawn(false));
        }
        const alpha = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(t / 900 + p.phase));
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 6);
        g.addColorStop(0, `rgba(${p.hue},${alpha})`);
        g.addColorStop(1, `rgba(${p.hue},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 6, 0, Math.PI * 2);
        ctx.fill();
      }
      if (visible && !reduce) raf = requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      cancelAnimationFrame(raf);
      if (visible) raf = requestAnimationFrame(tick);
    });

    resize();
    io.observe(canvas);
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
    };
  }, [density]);

  return <canvas ref={ref} className={className} aria-hidden="true" />;
}
