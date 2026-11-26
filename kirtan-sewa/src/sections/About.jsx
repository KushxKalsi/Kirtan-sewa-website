import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import Reveal from '../components/Reveal';
import SplitText from '../components/SplitText';
import Counter from '../components/Counter';
import { useSite } from '../components/SiteContext';

export default function About() {
  const { site } = useSite();
  const s = site?.settings;
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const imgY = useTransform(scrollYProgress, [0, 1], [60, -60]);
  const ringRotate = useTransform(scrollYProgress, [0, 1], [-30, 60]);

  const stats = [
    { value: s?.yearsOfSewa, suffix: '+', label: 'Years of sewa' },
    { value: s?.programsDone, suffix: '+', label: 'Programs done' },
    { value: s?.citiesCovered, suffix: '+', label: 'Cities & villages' },
  ];

  return (
    <section id="about" className="section about" ref={ref}>
      <div className="container about-grid">
        <motion.div className="about-visual" style={{ y: imgY }}>
          <motion.div className="about-ring" style={{ rotate: ringRotate }} aria-hidden="true" />
          <Reveal className="about-frame" y={60}>
            {s?.aboutImage ? (
              <img src={s.aboutImage} alt={s.siteName} loading="lazy" />
            ) : (
              <div className="about-placeholder">
                <span className="gurmukhi">ੴ</span>
              </div>
            )}
            <div className="about-quote">
              <p className="gurmukhi">ਧੁਰ ਕੀ ਬਾਣੀ ਆਈ ॥ ਤਿਨਿ ਸਗਲੀ ਚਿੰਤ ਮਿਟਾਈ ॥</p>
              <span>The Bani has come from the Primal Lord; it has erased all anxiety.</span>
            </div>
          </Reveal>
        </motion.div>

        <div className="about-copy">
          <Reveal>
            <span className="eyebrow">Our Jatha</span>
          </Reveal>
          <SplitText className="section-title" text="Carrying the sound of the Guru’s Bani to your home" highlight={[6]} />
          <Reveal delay={0.15}>
            <p className="about-text">{s?.about}</p>
          </Reveal>
          <div className="stats">
            {stats.map((st, i) => (
              <Reveal key={st.label} delay={0.2 + i * 0.1} className="stat">
                <strong className="gold-text">
                  <Counter to={st.value} suffix={st.suffix} />
                </strong>
                <span>{st.label}</span>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
