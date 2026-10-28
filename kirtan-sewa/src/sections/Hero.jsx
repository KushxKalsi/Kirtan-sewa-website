import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, ClipboardList } from 'lucide-react';
import Mandala from '../components/Mandala';
import Particles from '../components/Particles';
import SplitText from '../components/SplitText';
import Magnetic from '../components/Magnetic';
import { useSite } from '../components/SiteContext';
import { scrollToId } from '../lib/scroll';
import { ease } from '../lib/motion';
import { useLowEnd } from '../lib/perf';

export default function Hero({ ready }) {
  const { site } = useSite();
  const s = site?.settings;
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], [0, 220]);
  const opacity = useTransform(scrollYProgress, [0, 0.75], [1, 0]);
  const emblemScale = useTransform(scrollYProgress, [0, 1], [1, 1.35]);
  const emblemRotate = useTransform(scrollYProgress, [0, 1], [0, 40]);
  const blur = !useLowEnd();
  const name = s?.siteName || 'Kirtan Sewa';
  const words = name.split(' ');

  const appear = (delay) => ({
    initial: { opacity: 0, y: 30 },
    animate: ready ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 },
    transition: { duration: 1.1, ease, delay },
  });

  return (
    <section id="top" className="hero" ref={ref}>
      <div className="hero-rays" aria-hidden="true" />
      <Particles className="hero-particles" />
      <div className="hero-vignette" aria-hidden="true" />

      <motion.div className="hero-inner container" style={{ y, opacity }}>
        <motion.div
          className="hero-emblem"
          style={{ scale: emblemScale, rotate: emblemRotate }}
          initial={{ opacity: 0, scale: 0.7 }}
          animate={ready ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 1.6, ease }}
        >
          {ready && <Mandala className="hero-mandala" />}
          <motion.span
            className="ik-onkar gurmukhi"
            initial={{ opacity: 0, ...(blur && { filter: 'blur(16px)' }) }}
            animate={ready ? { opacity: 1, ...(blur && { filter: 'blur(0px)' }) } : {}}
            transition={{ duration: 1.4, ease, delay: 0.5 }}
          >
            ੴ
          </motion.span>
        </motion.div>

        <motion.p className="hero-gurmukhi gurmukhi" {...appear(0.6)}>
          {s?.gurmukhiTagline || 'ਗੁਰਬਾਣੀ ਕੀਰਤਨ ਸੇਵਾ'}
        </motion.p>

        <SplitText as="h1" className="hero-title" text={name} play={ready} delay={0.75} stagger={0.1} highlight={[words.length - 1]} />

        <motion.p className="hero-sub" {...appear(1.1)}>
          {s?.tagline}
        </motion.p>

        <motion.div className="hero-ctas" {...appear(1.3)}>
          <Magnetic>
            <button className="btn btn-primary" onClick={() => scrollToId('book')}>
              <CalendarDays size={18} /> Check dates &amp; book
            </button>
          </Magnetic>
          <Magnetic>
            <button className="btn btn-ghost" onClick={() => scrollToId('sewa')}>
              Explore sewa <ArrowRight size={18} />
            </button>
          </Magnetic>
          <Magnetic>
            <Link className="btn btn-ghost" to="/account">
              <ClipboardList size={18} /> My bookings
            </Link>
          </Magnetic>
        </motion.div>
      </motion.div>

      <motion.button
        className="scroll-cue"
        onClick={() => scrollToId('about')}
        aria-label="Scroll down"
        initial={{ opacity: 0 }}
        animate={ready ? { opacity: 1 } : {}}
        transition={{ delay: 1.8, duration: 1 }}
      >
        <span className="scroll-mouse">
          <span />
        </span>
        <span>Scroll</span>
      </motion.button>
    </section>
  );
}
