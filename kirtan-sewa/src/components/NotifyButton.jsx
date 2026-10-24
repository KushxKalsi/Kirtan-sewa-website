import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, BellRing, CircleAlert, Loader2 } from 'lucide-react';
import { enableNotifications, isIos, isStandalone, permission, pushSupported, subscribedFor } from '../lib/push';
import { ease } from '../lib/motion';

/** Card asking the customer to allow notifications for their bookings. */
export default function NotifyButton({ phone, compact = false }) {
  const [on, setOn] = useState(() => permission() === 'granted' && subscribedFor(phone));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const iosNeedsInstall = !pushSupported() && isIos() && !isStandalone();
  if (!phone || (!pushSupported() && !iosNeedsInstall)) return null;

  const enable = async () => {
    setBusy(true);
    setError('');
    try {
      await enableNotifications(phone);
      setOn(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div className={`notify-card ${on ? 'on' : ''} ${compact ? 'compact' : ''}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease }}>
      <motion.span className="notify-icon" animate={on ? {} : { rotate: [0, -14, 12, -8, 6, 0] }} transition={{ duration: 1.2, repeat: on ? 0 : Infinity, repeatDelay: 2.5 }}>
        {on ? <BellRing size={20} /> : <Bell size={20} />}
      </motion.span>
      <div>
        <strong>{on ? 'Notifications are on' : 'Get notified when it’s confirmed'}</strong>
        <p>
          {on
            ? 'We’ll notify you on this device when the jatha confirms, sends your bill, or receives your payment.'
            : iosNeedsInstall
              ? 'On iPhone: tap Share → “Add to Home Screen”, open the site from the new icon, then tap below.'
              : 'Allow notifications and we’ll tell you the moment your booking is confirmed — with a link to pay.'}
        </p>
        {!on && (
          <button type="button" className="btn btn-primary btn-sm" onClick={enable} disabled={busy}>
            {busy ? <Loader2 size={15} className="spin" /> : <Bell size={15} />} Turn on notifications
          </button>
        )}
        <AnimatePresence>
          {error && (
            <motion.p className="notify-error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <CircleAlert size={14} /> {error}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
