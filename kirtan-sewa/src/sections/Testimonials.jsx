import { Quote } from 'lucide-react';
import SplitText from '../components/SplitText';
import Reveal from '../components/Reveal';
import { useSite } from '../components/SiteContext';

function Row({ items, reverse }) {
  return (
    <div className={`marquee ${reverse ? 'reverse' : ''}`}>
      <div className="marquee-track">
        {[0, 1].map((copy) => (
          <div className="marquee-group" key={copy} aria-hidden={copy === 1}>
            {items.map((t, i) => (
              <figure className="testimonial glass" key={i}>
                <Quote size={22} className="t-quote" />
                <blockquote>{t.text}</blockquote>
                <figcaption>
                  <span className="t-avatar">{t.name.charAt(0)}</span>
                  <span>
                    <strong>{t.name}</strong>
                    {t.place && <small>{t.place}</small>}
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Testimonials() {
  const { site } = useSite();
  const items = site?.settings.testimonials || [];
  if (!items.length) return null;
  const half = Math.ceil(items.length / 2);
  const rowA = items.length > 3 ? items.slice(0, half) : items;
  const rowB = items.length > 3 ? items.slice(half) : [];

  return (
    <section id="sangat" className="section testimonials">
      <div className="container">
        <div className="section-head">
          <Reveal>
            <span className="eyebrow">Words from the sangat</span>
            <span className="gurmukhi-sub">ਸੰਗਤ</span>
          </Reveal>
          <SplitText className="section-title" text="Blessed to serve so many families" highlight={[4]} />
        </div>
      </div>
      <Reveal>
        <Row items={rowA.length < 4 ? [...rowA, ...rowA] : rowA} />
        {rowB.length > 0 && <Row items={rowB.length < 4 ? [...rowB, ...rowB] : rowB} reverse />}
      </Reveal>
    </section>
  );
}
