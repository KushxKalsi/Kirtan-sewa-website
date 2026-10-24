import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Ban, CalendarDays, CircleAlert, Clock, Loader2, MapPin, Search, User } from 'lucide-react';
import Modal from '../components/Modal';
import PaymentBox from '../components/PaymentBox';
import SplitText from '../components/SplitText';
import Particles from '../components/Particles';
import { useToast } from '../components/Toast';
import { api } from '../lib/api';
import { prettyDate, rangeTo12, toKey } from '../lib/date';
import { getMyBookings } from '../lib/storage';
import { ease } from '../lib/motion';

const REASONS = ['Event date changed', 'Event postponed or called off', 'Booked another jatha', 'Booked by mistake', 'Other'];

export default function ManageBooking() {
  const [params] = useSearchParams();
  const toast = useToast();
  const [ref, setRef] = useState(params.get('ref') || '');
  const [phone, setPhone] = useState(params.get('phone') || '');
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState('');
  const recent = getMyBookings();

  const lookup = async (r = ref, p = phone) => {
    setError('');
    setLoading(true);
    try {
      const data = await api.lookupBooking(r.trim(), p.trim());
      setBooking(data.booking);
    } catch (e) {
      setBooking(null);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (params.get('ref') && params.get('phone')) lookup(params.get('ref'), params.get('phone'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCancel = () => {
    setReason('');
    setDetails('');
    setCancelError('');
    setCancelOpen(true);
  };

  const confirmCancel = async (e) => {
    e.preventDefault();
    const full = reason === 'Other' ? details.trim() : [reason, details.trim()].filter(Boolean).join(' — ');
    if (!reason) return setCancelError('Please choose a reason.');
    if (full.length < 3) return setCancelError('Please tell us a little about why you are cancelling.');
    setCancelling(true);
    setCancelError('');
    try {
      const data = await api.cancelBooking(booking.ref, phone, full);
      setBooking(data.booking);
      setCancelOpen(false);
      toast('Your booking has been cancelled.');
    } catch (err) {
      setCancelError(err.message);
    } finally {
      setCancelling(false);
    }
  };

  const canCancel = booking && ['pending', 'confirmed'].includes(booking.status) && booking.date >= toKey(new Date());

  return (
    <main className="page manage">
      <Particles className="page-particles" density={0.6} />
      <div className="container manage-inner">
        <div className="section-head">
          <motion.span className="eyebrow" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease }}>
            Your booking
          </motion.span>
          <SplitText as="h1" className="section-title" text="Manage or cancel a booking" highlight={[1, 2, 3]} play />
          <motion.p className="section-lead" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5, duration: 0.8 }}>
            Enter the Booking ID you received and the phone number used while booking.
          </motion.p>
        </div>

        <motion.form
          className="lookup glass"
          onSubmit={(e) => {
            e.preventDefault();
            lookup();
          }}
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease, delay: 0.3 }}
        >
          <label className="field">
            <input value={ref} onChange={(e) => setRef(e.target.value.toUpperCase())} placeholder=" " required autoCapitalize="characters" spellCheck="false" />
            <span>Booking ID</span>
          </label>
          <label className="field">
            <input type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder=" " required autoComplete="tel" />
            <span>Phone number</span>
          </label>
          <button className="btn btn-primary" disabled={loading}>
            {loading ? <Loader2 size={18} className="spin" /> : <Search size={18} />} Find booking
          </button>
          {recent.length > 0 && (
            <div className="recent">
              <span>On this device:</span>
              {recent.map((r) => (
                <button
                  type="button"
                  key={r.ref}
                  className="chip"
                  onClick={() => {
                    setRef(r.ref);
                    setPhone(r.phone);
                    lookup(r.ref, r.phone);
                  }}
                >
                  {r.ref} · {r.serviceName}
                </button>
              ))}
            </div>
          )}
        </motion.form>

        <AnimatePresence mode="wait">
          {error && (
            <motion.div key="err" className="form-error manage-error" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <CircleAlert size={18} /> {error}
            </motion.div>
          )}
          {booking && (
            <motion.article
              key={booking.ref + booking.status}
              className={`booking-card glass st-${booking.status}`}
              initial={{ opacity: 0, y: 40, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.7, ease }}
            >
              <header>
                <div>
                  <span className="bc-ref">{booking.ref}</span>
                  <h2>{booking.serviceName}</h2>
                </div>
                <span className={`badge badge-${booking.status}`}>{booking.status}</span>
              </header>
              <ul className="bc-list">
                <li>
                  <CalendarDays size={17} /> {prettyDate(booking.date)}
                </li>
                <li>
                  <Clock size={17} /> {booking.slotLabel} · {rangeTo12(booking.slotTime)}
                </li>
                <li>
                  <User size={17} /> {booking.name}
                </li>
                <li>
                  <MapPin size={17} /> {booking.address}
                </li>
              </ul>
              {booking.notes && <p className="bc-notes">“{booking.notes}”</p>}

              {booking.status === 'cancelled' && (
                <motion.div className="cancel-note" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} transition={{ duration: 0.5, ease }}>
                  <strong>Cancelled {booking.cancelledBy === 'admin' ? 'by the jatha' : 'by you'}</strong>
                  <p>Reason: {booking.cancelReason}</p>
                </motion.div>
              )}
              {booking.status === 'pending' && <p className="fine-print">Awaiting confirmation — the jatha will contact you soon.</p>}

              <PaymentBox booking={booking} phone={phone} onUpdated={setBooking} />

              {canCancel && (
                <button className="btn btn-ghost cancel-btn" onClick={openCancel}>
                  <Ban size={17} /> Cancel this booking
                </button>
              )}
            </motion.article>
          )}
        </AnimatePresence>
      </div>

      <Modal open={cancelOpen} onClose={() => !cancelling && setCancelOpen(false)} title="Cancel booking?" subtitle="Please let us know why — it helps the jatha plan its sewa.">
        <form onSubmit={confirmCancel} className="cancel-form">
          <div className="reason-list" role="radiogroup">
            {REASONS.map((r) => (
              <button type="button" role="radio" aria-checked={reason === r} key={r} className={`reason ${reason === r ? 'active' : ''}`} onClick={() => setReason(r)}>
                <span className="reason-dot">{reason === r && <motion.span layoutId="reason-dot" />}</span>
                {r}
              </button>
            ))}
          </div>
          <label className="field">
            <textarea value={details} onChange={(e) => setDetails(e.target.value)} placeholder=" " rows={3} required={reason === 'Other'} />
            <span>{reason === 'Other' ? 'Your reason *' : 'Anything else? (optional)'}</span>
          </label>
          <AnimatePresence>
            {cancelError && (
              <motion.div className="form-error" initial={{ opacity: 0 }} animate={{ opacity: 1, x: [0, -8, 8, -4, 4, 0] }} exit={{ opacity: 0 }}>
                <CircleAlert size={18} /> {cancelError}
              </motion.div>
            )}
          </AnimatePresence>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setCancelOpen(false)} disabled={cancelling}>
              Keep booking
            </button>
            <button className="btn btn-danger" disabled={cancelling}>
              {cancelling ? <Loader2 size={18} className="spin" /> : <Ban size={18} />} Cancel booking
            </button>
          </div>
        </form>
      </Modal>
    </main>
  );
}
