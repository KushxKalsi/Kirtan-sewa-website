import { motion } from 'framer-motion';
import { ease } from '../lib/motion';
import { useLowEnd } from '../lib/perf';

export default function Reveal({ children, delay = 0, y = 40, x = 0, className, as = 'div', once = true, ...rest }) {
  const Comp = motion[as];
  // Animating blur repaints the element every frame; weak phones get the same slide-in without it.
  const blur = !useLowEnd();
  return (
    <Comp
      className={className}
      initial={{ opacity: 0, y, x, ...(blur && { filter: 'blur(6px)' }) }}
      whileInView={{ opacity: 1, y: 0, x: 0, ...(blur && { filter: 'blur(0px)' }) }}
      viewport={{ once, margin: '-60px' }}
      transition={{ duration: 1, ease, delay }}
      {...rest}
    >
      {children}
    </Comp>
  );
}
