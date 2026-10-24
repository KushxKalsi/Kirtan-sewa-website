import { useRef } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';

/** Wraps a child so it is gently pulled toward the cursor on hover (pointer devices only). */
export default function Magnetic({ children, strength = 0.35, className }) {
  const ref = useRef(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 220, damping: 16, mass: 0.4 });
  const sy = useSpring(y, { stiffness: 220, damping: 16, mass: 0.4 });

  const onMove = (e) => {
    if (e.pointerType !== 'mouse') return;
    const r = ref.current.getBoundingClientRect();
    x.set((e.clientX - (r.left + r.width / 2)) * strength);
    y.set((e.clientY - (r.top + r.height / 2)) * strength);
  };
  const reset = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div ref={ref} className={className} style={{ x: sx, y: sy, display: 'inline-flex' }} onPointerMove={onMove} onPointerLeave={reset}>
      {children}
    </motion.div>
  );
}
