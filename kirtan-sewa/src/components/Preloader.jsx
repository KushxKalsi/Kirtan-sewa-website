import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { ease } from '../lib/motion';
import { isLowEnd } from '../lib/perf';

export default function Preloader({ onDone }) {
  const blur = !isLowEnd();
  useEffect(() => {
    const t = setTimeout(onDone, 2100);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <motion.div
      className="preloader"
      initial={{ clipPath: 'inset(0 0 0% 0)' }}
      exit={{ clipPath: 'inset(0 0 100% 0)', transition: { duration: 1, ease: [0.76, 0, 0.24, 1] } }}
    >
      <motion.div
        className="preloader-symbol gurmukhi"
        initial={{ opacity: 0, scale: 0.6, ...(blur && { filter: 'blur(20px)' }) }}
        animate={{ opacity: 1, scale: 1, ...(blur && { filter: 'blur(0px)' }) }}
        exit={{ opacity: 0, y: -60, transition: { duration: 0.6, ease } }}
        transition={{ duration: 1.2, ease }}
      >
        ੴ
      </motion.div>
      <motion.p
        className="preloader-text gurmukhi"
        initial={{ opacity: 0, y: 12, letterSpacing: '0.6em' }}
        animate={{ opacity: 1, y: 0, letterSpacing: '0.25em' }}
        exit={{ opacity: 0 }}
        transition={{ duration: 1.2, ease, delay: 0.3 }}
      >
        ਵਾਹਿਗੁਰੂ
      </motion.p>
      <div className="preloader-bar">
        <motion.span initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 1.8, ease: [0.65, 0, 0.35, 1] }} />
      </div>
    </motion.div>
  );
}
