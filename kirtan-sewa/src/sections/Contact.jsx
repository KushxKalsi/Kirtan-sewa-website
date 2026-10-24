import { motion } from 'framer-motion';
import { Mail, MapPin, MessageCircle, Phone, CalendarDays } from 'lucide-react';
import SplitText from '../components/SplitText';
import Reveal from '../components/Reveal';
import Magnetic from '../components/Magnetic';
import { useSite } from '../components/SiteContext';
import { scrollToId } from '../lib/scroll';
import { ease } from '../lib/motion';

export default function Contact() {
  const { site } = useSite();
  const s = site?.settings || {};
  const wa = s.whatsapp?.replace(/\D/g, '');
  const cards = [
    s.phone && { icon: Phone, label: 'Call', value: s.phone, href: `tel:${s.phone.replace(/\s/g, '')}` },
    wa && { icon: MessageCircle, label: 'WhatsApp', value: `+${wa}`, href: `https://wa.me/${wa}` },
    s.email && { icon: Mail, label: 'Email', value: s.email, href: `mailto:${s.email}` },
    s.address && { icon: MapPin, label: 'Based in', value: s.address, href: `https://maps.google.com/?q=${encodeURIComponent(s.address)}` },
  ].filter(Boolean);

  return (
    <section id="contact" className="section contact">
      <div className="container">
        <div className="contact-cta glass">
          <div className="contact-cta-glow" aria-hidden="true" />
          <Reveal>
            <span className="eyebrow">Get in touch</span>
          </Reveal>
          <SplitText className="section-title" text="Let the Guru’s Kirtan bless your occasion" highlight={[3]} />
          <Reveal delay={0.1}>
            <Magnetic>
              <button className="btn btn-primary" onClick={() => scrollToId('book')}>
                <CalendarDays size={18} /> Book your date
              </button>
            </Magnetic>
          </Reveal>
        </div>

        <div className="contact-grid">
          {cards.map((c, i) => (
            <motion.a
              key={c.label}
              href={c.href}
              target={c.href.startsWith('http') ? '_blank' : undefined}
              rel="noreferrer"
              className="contact-card glass"
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.8, ease, delay: i * 0.08 }}
              whileHover={{ y: -6 }}
            >
              <span className="contact-icon">
                <c.icon size={20} />
              </span>
              <span className="contact-label">{c.label}</span>
              <span className="contact-value">{c.value}</span>
            </motion.a>
          ))}
        </div>
      </div>
    </section>
  );
}
