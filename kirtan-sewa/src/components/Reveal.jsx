import { motion } from 'framer-motion';
import { ease } from '../lib/motion';

export default function Reveal({ children, delay = 0, y = 40, x = 0, className, as = 'div', once = true, ...rest }) {
  const Comp = motion[as];
  return (
    <Comp
      className={className}
      initial={{ opacity: 0, y, x, filter: 'blur(6px)' }}
      whileInView={{ opacity: 1, y: 0, x: 0, filter: 'blur(0px)' }}
      viewport={{ once, margin: '-60px' }}
      transition={{ duration: 1, ease, delay }}
      {...rest}
    >
      {children}
    </Comp>
  );
}
