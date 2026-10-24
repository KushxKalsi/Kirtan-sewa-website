import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, Copy, MessageCircle, Plus, Settings2 } from 'lucide-react';
import { useSite } from './SiteContext';
import NotifyButton from './NotifyButton';
import { prettyDate, rangeTo12 } from '../lib/date';
import { ease } from '../lib/motion';

const BURST = Array.from({ length: 18 }, (_, i) => {
  const angle = (i / 18) * Math.PI * 2;
  const dist = 70 + (i % 3) * 22;
  return { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist, s: 4 + (i % 4) * 2, d: (i % 5) * 0.03 };
});

export default function BookingSuccess({ bookings, phone, onAgain }) {
  const booking = bookings[0];
  const many = bookings.length > 1;
  const { site } = useSite();
  const [copied, setCopied] = useState(false);
  const wa = site?.settings.whatsapp?.replace(/\D/g, '');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(bookings.map((b) => b.ref).join(', '));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked */
    }
  };

  const lines = bookings.map((b) => `• ${b.serviceName}${b.categoryName ? ` (${b.categoryName})` : ''} — ${prettyDate(b.date, 'EEE, d MMM yyyy')}, ${b.slotLabel} (${rangeTo12(b.slotTime)}) — ID ${b.ref}`);
  const message = `Waheguru Ji Ka Khalsa, Waheguru Ji Ki Fateh 🙏\n\nI have requested ${many ? `${bookings.length} bookings` : 'a booking'}:\n${lines.join('\n')}\n\nName: ${booking.name}\nVenue: ${booking.address}`;

  return (
    <div className="success">
      <div className="success-badge">
        {BURST.map((p, i) => (
          <motion.span
            key={i}
            className="burst"
            style={{ width: p.s, height: p.s }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 0 }}
            animate={{ x: p.x, y: p.y, opacity: 0, scale: 1 }}
            transition={{ duration: 1.1, ease: 'easeOut', delay: 0.35 + p.d }}
          />
        ))}
        <motion.svg viewBox="0 0 80 80" width="88" height="88" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 16 }}>
          <motion.circle cx="40" cy="40" r="36" fill="none" stroke="url(#ok-grad)" strokeWidth="3" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.7, ease }} />
          <motion.path d="M25 41 l10 10 l20 -22" fill="none" stroke="#F6D58E" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.45, delay: 0.55, ease }} />
          <defs>
            <linearGradient id="ok-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#F6D58E" />
              <stop offset="1" stopColor="#FF9933" />
            </linearGradient>
          </defs>
        </motion.svg>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 0.6, ease }}>
        <h3 className="panel-title">{many ? `${bookings.length} booking requests received` : 'Booking request received'}</h3>
        <p className="panel-sub">Waheguru Ji! The jatha will contact you shortly to confirm.</p>

        {many ? (
          <ul className="success-list">
            {bookings.map((b, i) => (
              <motion.li key={b.ref} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.7 + i * 0.07, duration: 0.4, ease }}>
                <span>
                  <strong>
                    {b.serviceName}
                    {b.categoryName && <small> · {b.categoryName}</small>}
                  </strong>
                  {prettyDate(b.date, 'EEE, d MMM yyyy')} · {b.slotLabel}, {rangeTo12(b.slotTime)}
                </span>
                <code>{b.ref}</code>
              </motion.li>
            ))}
          </ul>
        ) : (
          <>
            <div className="ref-box">
              <span>Your Booking ID</span>
              <strong>{booking.ref}</strong>
              <button className="icon-btn" onClick={copy} aria-label="Copy booking ID">
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>
            <dl className="success-details">
              <div>
                <dt>Sewa</dt>
                <dd>
                  {booking.serviceName}
                  {booking.categoryName && <small className="muted"> · {booking.categoryName}</small>}
                </dd>
              </div>
              <div>
                <dt>Date</dt>
                <dd>{prettyDate(booking.date, 'EEE, d MMM yyyy')}</dd>
              </div>
              <div>
                <dt>Time</dt>
                <dd>
                  {booking.slotLabel} · {rangeTo12(booking.slotTime)}
                </dd>
              </div>
            </dl>
          </>
        )}

        <p className="fine-print">
          You can view {many ? 'these bookings' : 'this booking'} anytime under “Manage booking” using just your phone number. Once the jatha confirms, bills and payment details appear there too.
        </p>

        <NotifyButton phone={phone} />

        <div className="success-actions">
          {wa && (
            <a className="btn btn-primary" href={`https://wa.me/${wa}?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer">
              <MessageCircle size={18} /> Send on WhatsApp
            </a>
          )}
          <Link className="btn btn-ghost" to={`/manage?phone=${encodeURIComponent(phone || '')}`}>
            <Settings2 size={18} /> Manage / cancel
          </Link>
          <button className="btn btn-ghost" onClick={onAgain}>
            <Plus size={18} /> Book another
          </button>
        </div>
      </motion.div>
    </div>
  );
}
