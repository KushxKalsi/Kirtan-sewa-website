import { useEffect, useState } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';

export default function CursorGlow() {
  const [enabled, setEnabled] = useState(false);
  const x = useMotionValue(-500);
  const y = useMotionValue(-500);
  const gx = useSpring(x, { stiffness: 80, damping: 20 });
  const gy = useSpring(y, { stiffness: 80, damping: 20 });
  const dx = useSpring(x, { stiffness: 900, damping: 40 });
  const dy = useSpring(y, { stiffness: 900, damping: 40 });

  useEffect(() => {
    const mq = window.matchMedia('(pointer: fine) and (prefers-reduced-motion: no-preference)');
    setEnabled(mq.matches);
    if (!mq.matches) return;
    const move = (e) => {
      x.set(e.clientX);
      y.set(e.clientY);
    };
    window.addEventListener('pointermove', move, { passive: true });
    return () => window.removeEventListener('pointermove', move);
  }, [x, y]);

  if (!enabled) return null;
  return (
    <>
      <motion.div className="cursor-glow" style={{ x: gx, y: gy }} />
      <motion.div className="cursor-dot" style={{ x: dx, y: dy }} />
    </>
  );
}
