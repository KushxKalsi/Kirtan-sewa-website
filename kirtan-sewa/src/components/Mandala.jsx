import { motion } from 'framer-motion';

const draw = (delay) => ({
  initial: { pathLength: 0, opacity: 0 },
  animate: { pathLength: 1, opacity: 1 },
  transition: { pathLength: { duration: 2.4, ease: [0.65, 0, 0.35, 1], delay }, opacity: { duration: 0.4, delay } },
});

const petal = (inner, outer, width) => `M0,${-inner} Q${width},${-(inner + outer) / 2} 0,${-outer} Q${-width},${-(inner + outer) / 2} 0,${-inner} Z`;

export default function Mandala({ className }) {
  return (
    <svg className={className} viewBox="-200 -200 400 400" aria-hidden="true">
      <defs>
        <linearGradient id="mandala-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F6D58E" />
          <stop offset="0.5" stopColor="#E9B44C" />
          <stop offset="1" stopColor="#FF9933" />
        </linearGradient>
        <radialGradient id="mandala-core" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="scale(120)">
          <stop offset="0" stopColor="#FF9933" stopOpacity="0.35" />
          <stop offset="1" stopColor="#FF9933" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle r="120" fill="url(#mandala-core)" />
      <g stroke="url(#mandala-gold)" fill="none">
        <g className="spin-slow">
          <motion.circle r="192" strokeWidth="0.8" strokeDasharray="2 6" {...draw(0.2)} />
          <motion.circle r="182" strokeWidth="0.6" opacity="0.5" {...draw(0.3)} />
        </g>
        <g className="spin-rev">
          {Array.from({ length: 24 }, (_, i) => (
            <motion.path key={i} d={petal(140, 176, 11)} strokeWidth="0.9" transform={`rotate(${i * 15})`} {...draw(0.4 + i * 0.03)} />
          ))}
        </g>
        <g className="spin-mid">
          <motion.circle r="132" strokeWidth="0.8" {...draw(0.6)} />
          {Array.from({ length: 72 }, (_, i) => (
            <motion.line key={i} y1="-122" y2={i % 6 === 0 ? -132 : -127} strokeWidth="0.7" transform={`rotate(${i * 5})`} {...draw(0.8 + i * 0.005)} />
          ))}
        </g>
        <g className="spin-slow">
          {Array.from({ length: 12 }, (_, i) => (
            <motion.path key={i} d={petal(86, 118, 16)} strokeWidth="1" transform={`rotate(${i * 30 + 15})`} {...draw(0.9 + i * 0.04)} />
          ))}
          <motion.circle r="84" strokeWidth="1.1" {...draw(1)} />
        </g>
      </g>
    </svg>
  );
}
