import { useEffect, useRef } from 'react';
import { createField } from '../lib/particleField';
import { isLowEnd, onLowEndChange } from '../lib/perf';

const readColors = () => {
  const css = getComputedStyle(document.documentElement);
  return [css.getPropertyValue('--particle-1').trim(), css.getPropertyValue('--particle-2').trim()];
};

/** Talks to a field drawn in a worker; returns null when the browser can't do that. */
function workerField(canvas, options) {
  if (!canvas.transferControlToOffscreen || typeof Worker === 'undefined') return null;
  try {
    const offscreen = canvas.transferControlToOffscreen();
    const worker = new Worker(new URL('../lib/particles.worker.js', import.meta.url), { type: 'module' });
    worker.postMessage({ type: 'init', canvas: offscreen, options }, [offscreen]);
    return {
      resize: (width, height, dpr) => worker.postMessage({ type: 'resize', width, height, dpr }),
      setColors: (colors) => worker.postMessage({ type: 'colors', colors }),
      setLow: (low) => worker.postMessage({ type: 'low', low }),
      setRunning: (running) => worker.postMessage({ type: 'running', running }),
      destroy: () => worker.terminate(),
    };
  } catch {
    return null;
  }
}

/** Soft golden motes drifting upward, like light in a Darbar. Drawn off the main thread where possible. */
export default function Particles({ className, density = 1 }) {
  const ref = useRef(null);

  useEffect(() => {
    // A canvas can only be handed to a worker once, so each mount gets a fresh one.
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'display:block;width:100%;height:100%';
    ref.current.appendChild(canvas);

    const options = { density, low: isLowEnd(), reduce: window.matchMedia('(prefers-reduced-motion: reduce)').matches, colors: readColors() };
    const field = workerField(canvas, options) || createField(canvas, options);

    const resize = () => field.resize(canvas.clientWidth, canvas.clientHeight, window.devicePixelRatio || 1);
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();
    // Only animate while on screen.
    const io = new IntersectionObserver(([entry]) => field.setRunning(entry.isIntersecting));
    io.observe(canvas);

    const onTheme = () => field.setColors(readColors());
    window.addEventListener('themechange', onTheme);
    const offLow = onLowEndChange(() => field.setLow(isLowEnd()));

    return () => {
      field.destroy();
      ro.disconnect();
      io.disconnect();
      offLow();
      window.removeEventListener('themechange', onTheme);
      canvas.remove();
    };
  }, [density]);

  return <div ref={ref} className={className} aria-hidden="true" />;
}
