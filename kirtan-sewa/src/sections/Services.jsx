import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight, Clock, LayoutGrid } from 'lucide-react';
import TiltCard from '../components/TiltCard';
import SplitText from '../components/SplitText';
import Reveal from '../components/Reveal';
import Modal from '../components/Modal';
import { useSite } from '../components/SiteContext';
import { serviceIcon } from '../lib/icons';
import { ease } from '../lib/motion';

const FALLBACK_COLOR = '#E9B44C';

// The whole card is the button (tap anywhere on it); Enter/Space work from the keyboard too.
const pressable = (label, onPress) => ({
  role: 'button',
  tabIndex: 0,
  'aria-label': label,
  onClick: onPress,
  onKeyDown: (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onPress();
    }
  },
});

/** Entrance animation: on scroll into view on the page, immediately inside the popup. */
const entrance = (i, instant) => ({
  initial: { opacity: 0, y: 60, rotateX: -12 },
  ...(instant ? { animate: { opacity: 1, y: 0, rotateX: 0 } } : { whileInView: { opacity: 1, y: 0, rotateX: 0 }, viewport: { once: true, margin: '-60px' } }),
  transition: { duration: instant ? 0.7 : 1, ease, delay: (i % 4) * (instant ? 0.07 : 0.1) },
  style: { transformPerspective: 1200 },
});

function SewaCard({ svc, index, slots, onBook, instant }) {
  const Icon = serviceIcon(svc.icon);
  const allowed = svc.allowedSlots?.length ? slots.filter((sl) => svc.allowedSlots.includes(sl.id)) : slots;
  return (
    <motion.div {...entrance(index, instant)}>
      <TiltCard className="service-card pressable" glow={`${svc.color}33`} style={{ '--accent': svc.color }} {...pressable(`Book ${svc.name}`, () => onBook(svc.id))}>
        <div className="service-top">
          <motion.div className="service-icon" whileHover={{ rotate: [0, -12, 10, 0], scale: 1.08 }} transition={{ duration: 0.6 }}>
            <Icon size={26} />
          </motion.div>
          <span className="service-num">0{index + 1}</span>
        </div>
        <p className="service-gurmukhi gurmukhi">{svc.gurmukhi}</p>
        <h3>{svc.name}</h3>
        <p className="service-desc">{svc.description}</p>
        <div className="service-meta">
          {svc.duration && (
            <span className="chip">
              <Clock size={13} /> {svc.duration}
            </span>
          )}
          {allowed.length !== slots.length &&
            allowed.map((sl) => (
              <span className="chip" key={sl.id}>
                {sl.label}
              </span>
            ))}
        </div>
        <span className="service-book" aria-hidden="true">
          Book this sewa
          <span className="service-arrow">
            <ArrowUpRight size={18} />
          </span>
        </span>
      </TiltCard>
    </motion.div>
  );
}

function CategoryCard({ cat, index, sewas, total, onOpen }) {
  const Icon = cat.icon ? serviceIcon(cat.icon) : LayoutGrid;
  const color = cat.color || FALLBACK_COLOR;
  return (
    <motion.div {...entrance(index, false)}>
      <TiltCard className="service-card category-card pressable" glow={`${color}33`} style={{ '--accent': color }} {...pressable(`${cat.name}: view sewas`, onOpen)}>
        <div className="service-top">
          <motion.div className="service-icon" whileHover={{ rotate: [0, -12, 10, 0], scale: 1.08 }} transition={{ duration: 0.6 }}>
            <Icon size={26} />
          </motion.div>
          <span className="service-num">0{index + 1}</span>
        </div>
        <p className="service-gurmukhi gurmukhi">{cat.gurmukhi}</p>
        <h3>{cat.name}</h3>
        <p className="service-desc">{cat.description}</p>
        <div className="service-meta">
          <span className="chip">{sewas.length === total ? `All ${total} sewas` : `${sewas.length} sewa${sewas.length > 1 ? 's' : ''}`}</span>
          {sewas.slice(0, 4).map((s) => (
            <span className="chip" key={s.id}>
              {s.name}
            </span>
          ))}
        </div>
        <span className="service-book" aria-hidden="true">
          {sewas.length > 1 ? 'View sewas' : 'View sewa'}
          <span className="service-arrow">
            <ArrowUpRight size={18} />
          </span>
        </span>
      </TiltCard>
    </motion.div>
  );
}

export default function Services({ onBook }) {
  const { site } = useSite();
  const services = site?.services || [];
  const slots = site?.slots || [];
  const categories = site?.categories || [];
  const [openCat, setOpenCat] = useState(null);
  const sewasOf = (cat) => services.filter((s) => cat.serviceIds.includes(s.id));

  const book = (serviceId, categoryId) => {
    setOpenCat(null);
    onBook(serviceId, categoryId);
  };

  return (
    <section id="sewa" className="section services">
      <div className="services-glow" aria-hidden="true" />
      <div className="container">
        <div className="section-head">
          <Reveal>
            <span className="eyebrow">Sewa we offer</span>
            <span className="gurmukhi-sub">ਸੇਵਾ</span>
          </Reveal>
          <SplitText className="section-title" text="Kirtan for every sacred occasion" highlight={[1]} />
          <Reveal delay={0.1}>
            <p className="section-lead">
              {categories.length ? 'Choose the type of kirtan, then the sewa — and see live availability in the calendar below.' : 'Choose a sewa and see live availability for it in the calendar below.'}
            </p>
          </Reveal>
        </div>

        {categories.length ? (
          <div className={`service-grid ${categories.length <= 3 ? 'few' : ''}`}>
            {categories.map((cat, i) => (
              <CategoryCard key={cat.id} cat={cat} index={i} sewas={sewasOf(cat)} total={services.length} onOpen={() => setOpenCat(cat)} />
            ))}
          </div>
        ) : (
          <div className="service-grid">
            {services.map((svc, i) => (
              <SewaCard key={svc.id} svc={svc} index={i} slots={slots} onBook={(id) => book(id, '')} />
            ))}
          </div>
        )}
      </div>

      <Modal
        open={!!openCat}
        onClose={() => setOpenCat(null)}
        title={openCat?.name}
        subtitle={openCat && [openCat.gurmukhi, 'Choose a sewa to see its dates and times'].filter(Boolean).join(' · ')}
        size="xl"
      >
        {openCat && (
          <div className="service-grid in-modal">
            {sewasOf(openCat).map((svc, i) => (
              <SewaCard key={svc.id} svc={svc} index={i} slots={slots} onBook={(id) => book(id, openCat.id)} instant />
            ))}
          </div>
        )}
      </Modal>
    </section>
  );
}
