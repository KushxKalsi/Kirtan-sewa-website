import { Globe2, MessageCircle, Phone } from 'lucide-react';
import { useSite } from './SiteContext';

/** "International tour bookings also available" — with a quick way to ask. */
export default function IntlTours({ compact = false }) {
  const { site } = useSite();
  const s = site?.settings || {};
  const wa = s.whatsapp?.replace(/\D/g, '');
  const text = encodeURIComponent('Waheguru Ji Ka Khalsa, Waheguru Ji Ki Fateh 🙏\n\nI would like to ask about booking the jatha for an international tour.');
  return (
    <div className={`intl-tours ${compact ? 'compact' : ''}`}>
      <span className="intl-icon">
        <Globe2 size={22} />
      </span>
      <div>
        <strong>International tour bookings also available</strong>
        <p>Kirtan for Gurdwaras and sangat abroad — UK, Canada, USA, Australia and beyond. Tell us the country, dates and occasion.</p>
      </div>
      <div className="intl-actions">
        {wa && (
          <a className="btn btn-primary btn-sm" href={`https://wa.me/${wa}?text=${text}`} target="_blank" rel="noreferrer">
            <MessageCircle size={15} /> Ask on WhatsApp
          </a>
        )}
        {s.phone && (
          <a className="btn btn-ghost btn-sm" href={`tel:${s.phone.replace(/[^\d+]/g, '')}`}>
            <Phone size={15} /> Call
          </a>
        )}
      </div>
    </div>
  );
}
