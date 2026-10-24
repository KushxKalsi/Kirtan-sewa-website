import { motion } from 'framer-motion';
import { useLowEnd } from '../lib/perf';

const petal = (inner, outer, width) => `M0,${-inner} Q${width},${-(inner + outer) / 2} 0,${-outer} Q${-width},${-(inner + outer) / 2} 0,${-inner} Z`;

/*
 * Each ring spins as its own <svg> layer, so the GPU just rotates a finished picture.
 * (Spinning <g> groups inside one SVG made the browser redraw every path on every frame.)
 */
function Layer({ id, className, children }) {
  return (
    <svg className={`mandala-layer ${className || ''}`} viewBox="-200 -200 400 400">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--mandala-a)' }} />
          <stop offset="0.5" style={{ stopColor: 'var(--mandala-b)' }} />
          <stop offset="1" style={{ stopColor: 'var(--mandala-c)' }} />
        </linearGradient>
      </defs>
      <g stroke={`url(#${id})`} fill="none">
        {children}
      </g>
    </svg>
  );
}

export default function Mandala({ className }) {
  // Weak phones skip the line-by-line drawing (it repaints ~110 paths per frame) and fade in instead.
  const lowEnd = useLowEnd();
  const draw = (delay) =>
    lowEnd
      ? {}
      : {
          initial: { pathLength: 0, opacity: 0 },
          animate: { pathLength: 1, opacity: 1 },
          transition: { pathLength: { duration: 2.4, ease: [0.65, 0, 0.35, 1], delay }, opacity: { duration: 0.4, delay } },
        };

  return (
    <motion.div className={className} aria-hidden="true" {...(lowEnd && { initial: { opacity: 0 }, animate: { opacity: 0.85 }, transition: { duration: 1.2 } })}>
      <svg className="mandala-layer" viewBox="-200 -200 400 400">
        <defs>
          <radialGradient id="mandala-core" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="scale(120)">
            <stop offset="0" stopColor="#FF9933" stopOpacity="0.35" />
            <stop offset="1" stopColor="#FF9933" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle r="120" fill="url(#mandala-core)" />
      </svg>
      <Layer id="mandala-gold-slow" className="m-slow">
        <motion.circle r="192" strokeWidth="0.8" strokeDasharray="2 6" {...draw(0.2)} />
        <motion.circle r="182" strokeWidth="0.6" opacity="0.5" {...draw(0.3)} />
        {Array.from({ length: 12 }, (_, i) => (
          <motion.path key={i} d={petal(86, 118, 16)} strokeWidth="1" transform={`rotate(${i * 30 + 15})`} {...draw(0.9 + i * 0.04)} />
        ))}
        <motion.circle r="84" strokeWidth="1.1" {...draw(1)} />
      </Layer>
      <Layer id="mandala-gold-rev" className="m-rev">
        {Array.from({ length: 24 }, (_, i) => (
          <motion.path key={i} d={petal(140, 176, 11)} strokeWidth="0.9" transform={`rotate(${i * 15})`} {...draw(0.4 + i * 0.03)} />
        ))}
      </Layer>
      <Layer id="mandala-gold-mid" className="m-mid">
        <motion.circle r="132" strokeWidth="0.8" {...draw(0.6)} />
        {Array.from({ length: 72 }, (_, i) => (
          <motion.line key={i} y1="-122" y2={i % 6 === 0 ? -132 : -127} strokeWidth="0.7" transform={`rotate(${i * 5})`} {...draw(0.8 + i * 0.005)} />
        ))}
      </Layer>
    </motion.div>
  );
}
