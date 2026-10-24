import { motion } from 'framer-motion';
import { ArrowUpRight, Clock } from 'lucide-react';
import TiltCard from '../components/TiltCard';
import SplitText from '../components/SplitText';
import Reveal from '../components/Reveal';
import { useSite } from '../components/SiteContext';
import { serviceIcon } from '../lib/icons';
import { ease } from '../lib/motion';

export default function Services({ onBook }) {
  const { site } = useSite();
  const services = site?.services || [];
  const slots = site?.slots || [];

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
            <p className="section-lead">Choose a sewa and see live availability for it in the calendar below.</p>
          </Reveal>
        </div>

        <div className="service-grid">
          {services.map((svc, i) => {
            const Icon = serviceIcon(svc.icon);
            const allowed = svc.allowedSlots?.length ? slots.filter((sl) => svc.allowedSlots.includes(sl.id)) : slots;
            return (
              <motion.div
                key={svc.id}
                initial={{ opacity: 0, y: 60, rotateX: -12 }}
                whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 1, ease, delay: (i % 4) * 0.1 }}
                style={{ transformPerspective: 1200 }}
              >
                <TiltCard className="service-card" glow={`${svc.color}33`} style={{ '--accent': svc.color }}>
                  <div className="service-top">
                    <motion.div className="service-icon" whileHover={{ rotate: [0, -12, 10, 0], scale: 1.08 }} transition={{ duration: 0.6 }}>
                      <Icon size={26} />
                    </motion.div>
                    <span className="service-num">0{i + 1}</span>
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
                  <button className="service-book" onClick={() => onBook(svc.id)}>
                    Book this sewa
                    <span className="service-arrow">
                      <ArrowUpRight size={18} />
                    </span>
                  </button>
                </TiltCard>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
