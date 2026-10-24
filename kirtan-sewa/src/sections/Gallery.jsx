import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import SplitText from '../components/SplitText';
import Reveal from '../components/Reveal';
import { useSite } from '../components/SiteContext';
import { ease } from '../lib/motion';

export default function Gallery() {
  const { site } = useSite();
  const images = site?.settings.gallery || [];
  const [open, setOpen] = useState(null);
  if (!images.length) return null;

  return (
    <section id="gallery" className="section gallery">
      <div className="container">
        <div className="section-head">
          <Reveal>
            <span className="eyebrow">Moments of sewa</span>
          </Reveal>
          <SplitText className="section-title" text="From our samagams" highlight={[2]} />
        </div>
        <div className="gallery-grid">
          {images.map((src, i) => (
            <motion.button
              key={src + i}
              className="gallery-item"
              onClick={() => setOpen(src)}
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.9, ease, delay: (i % 3) * 0.08 }}
            >
              <img src={src} alt="" loading="lazy" />
            </motion.button>
          ))}
        </div>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div className="lightbox" onClick={() => setOpen(null)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.img src={open} alt="" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} transition={{ duration: 0.4, ease }} />
            <button className="icon-btn lightbox-close" aria-label="Close">
              <X size={18} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
