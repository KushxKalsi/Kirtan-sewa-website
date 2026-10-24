import { motion } from 'framer-motion';
import { ease } from '../lib/motion';

/** Reveals text word by word, each word sliding up from behind a mask. */
export default function SplitText({ text, as = 'h2', className, delay = 0, stagger = 0.06, play, highlight = [] }) {
  const Tag = motion[as];
  const words = String(text).split(' ');
  const trigger = play !== undefined ? { animate: play ? 'show' : 'hidden' } : { whileInView: 'show', viewport: { once: true, margin: '-40px' } };
  return (
    <Tag
      className={className}
      initial="hidden"
      {...trigger}
      variants={{ hidden: {}, show: { transition: { staggerChildren: stagger, delayChildren: delay } } }}
      aria-label={text}
    >
      {words.map((w, i) => (
        <span className="split-word" key={i} aria-hidden="true">
          <motion.span
            className={highlight.includes(i) ? 'gold-text' : undefined}
            variants={{
              hidden: { y: '110%', rotate: 4 },
              show: { y: '0%', rotate: 0, transition: { duration: 1, ease } },
            }}
          >
            {w}
          </motion.span>
          {i < words.length - 1 && ' '}
        </span>
      ))}
    </Tag>
  );
}
