import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Ban, CalendarDays, CircleAlert, Clock, Hourglass, Loader2, MapPin, Phone, Search, Undo2, User, UsersRound } from 'lucide-react';
import Modal from '../components/Modal';
import PaymentBox from '../components/PaymentBox';
import NotifyButton from '../components/NotifyButton';
import SplitText from '../components/SplitText';
import Particles from '../components/Particles';
import { useToast } from '../components/Toast';
import { api } from '../lib/api';
import { prettyDate, rangeTo12, toKey } from '../lib/date';
import { getMyPhones } from '../lib/storage';
import { ease } from '../lib/motion';

const REASONS = ['Event date changed', 'Event postponed or called off', 'Booked another jatha', 'Booked by mistake', 'Other'];

function BookingCard({ booking, phone, index, onChange, onRequestCancel }) {
  const toast = useToast();
  const [withdrawing, setWithdrawing] = useState(false);
  const request = booking.cancelRequest;
  const upcoming = booking.date >= toKey(new Date());
  const canRequest = ['pending', 'confirmed'].includes(booking.status) && upcoming && request?.status !== 'pending';

  const withdraw = async () => {
    setWithdrawing(true);
    try {
      const data = await api.withdrawCancel(booking.ref, phone);
      onChange(data.booking);
      toast('Cancellation request withdrawn.');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setWithdrawing(false);
    }
  };

  return (
    <motion.article
      layout
      className={`booking-card glass st-${booking.status}`}
      initial={{ opacity: 0, y: 40, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.7, ease, delay: index * 0.08 }}
    >
      <header>
        <div>
          <span className="bc-ref">{booking.ref}</span>
          <h2>{booking.serviceName}</h2>
          {booking.categoryName && <span className="bc-cat">{booking.categoryName}</span>}
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

      {booking.team?.length > 0 && booking.status !== 'cancelled' && (
        <div className="team-box">
          <span className="team-box-head">
            <UsersRound size={16} /> Sewa by
          </span>
          <ul>
            {booking.team.map((t, i) => (
              <li key={i}>
                <strong>{t.name}</strong>
                {t.address && (
                  <span>
                    <MapPin size={13} /> {t.address}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {booking.status === 'cancelled' && (
        <div className="cancel-note">
          <strong>Cancelled {booking.cancelledBy === 'admin' ? 'by the jatha' : 'on your request'}</strong>
          <p>Reason: {booking.cancelReason}</p>
        </div>
      )}
      {request?.status === 'pending' && (
        <div className="request-note">
          <Hourglass size={18} />
          <div>
            <strong>Cancellation requested — waiting for the jatha to approve</strong>
            <p>Your reason: {request.reason}</p>
            <button className="btn btn-ghost btn-sm" onClick={withdraw} disabled={withdrawing}>
              {withdrawing ? <Loader2 size={15} className="spin" /> : <Undo2 size={15} />} Keep my booking (withdraw request)
            </button>
          </div>
        </div>
      )}
      {request?.status === 'rejected' && booking.status !== 'cancelled' && (
        <div className="cancel-note">
          <strong>Your cancellation request was not accepted</strong>
          {request.note && <p>Message from the jatha: {request.note}</p>}
        </div>
      )}
      {booking.status === 'pending' && request?.status !== 'pending' && <p className="fine-print">Awaiting confirmation — the jatha will contact you soon.</p>}

      <PaymentBox booking={booking} phone={phone} onUpdated={onChange} />

      {canRequest && (
        <button className="btn btn-ghost cancel-btn" onClick={() => onRequestCancel(booking)}>
          <Ban size={17} /> Request cancellation
        </button>
      )}
    </motion.article>
  );
}

const mapsLink = (address) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

/** A sewa the looked-up phone number (a team member) is assigned to. */
function DutyCard({ duty, index }) {
  const past = duty.date < toKey(new Date());
  const status = past && duty.status !== 'cancelled' ? 'completed' : duty.status;
  return (
    <motion.article
      layout
      className={`booking-card duty-card glass st-${duty.status} ${past ? 'past' : ''}`}
      initial={{ opacity: 0, y: 40, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.7, ease, delay: index * 0.08 }}
    >
      <header>
        <div>
          <span className="bc-ref">{duty.ref}</span>
          <h2>{duty.serviceName}</h2>
          {duty.categoryName && <span className="bc-cat">{duty.categoryName}</span>}
        </div>
        <span className={`badge badge-${status}`}>{status}</span>
      </header>
      <ul className="bc-list">
        <li>
          <CalendarDays size={17} /> {prettyDate(duty.date)}
        </li>
        <li>
          <Clock size={17} /> {duty.slotLabel} · {rangeTo12(duty.slotTime)}
        </li>
        <li>
          <MapPin size={17} />
          <a href={mapsLink(duty.address)} target="_blank" rel="noreferrer">
            {duty.address}
          </a>
        </li>
        <li>
          <User size={17} /> Booked by {duty.name}
          <a className="duty-call" href={`tel:${duty.phone}`}>
            <Phone size={13} /> {duty.phone}
          </a>
        </li>
        {duty.with.length > 0 && (
          <li>
            <UsersRound size={17} /> With {duty.with.join(', ')}
          </li>
        )}
      </ul>
      {duty.notes && <p className="bc-notes">“{duty.notes}”</p>}
      {duty.status === 'cancelled' && (
        <div className="cancel-note">
          <strong>This sewa was cancelled</strong>
          {duty.cancelReason && <p>Reason: {duty.cancelReason}</p>}
        </div>
      )}
    </motion.article>
  );
}

export default function ManageBooking() {
  const [params] = useSearchParams();
  const toast = useToast();
  const [phone, setPhone] = useState(params.get('phone') || '');
  const [searched, setSearched] = useState('');
  const [bookings, setBookings] = useState(null);
  const [duties, setDuties] = useState([]);
  const [isTeam, setIsTeam] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cancelFor, setCancelFor] = useState(null);
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [sending, setSending] = useState(false);
  const [cancelError, setCancelError] = useState('');
  const recentPhones = getMyPhones();

  const lookup = async (p = phone) => {
    setError('');
    setLoading(true);
    try {
      const data = await api.lookupBookings(p.trim());
      setBookings(data.bookings);
      setDuties(data.duties || []);
      setIsTeam(!!data.isTeam);
      setSearched(p.trim());
    } catch (e) {
      setBookings(null);
      setDuties([]);
      setIsTeam(false);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (params.get('phone')) lookup(params.get('phone'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const replace = (b) => setBookings((list) => list.map((x) => (x.ref === b.ref ? b : x)));

  const openCancel = (b) => {
    setReason('');
    setDetails('');
    setCancelError('');
    setCancelFor(b);
  };

  const sendRequest = async (e) => {
    e.preventDefault();
    const full = reason === 'Other' ? details.trim() : [reason, details.trim()].filter(Boolean).join(' — ');
    if (!reason) return setCancelError('Please choose a reason.');
    if (full.length < 3) return setCancelError('Please tell us a little about why you want to cancel.');
    setSending(true);
    setCancelError('');
    try {
      const data = await api.requestCancel(cancelFor.ref, searched, full);
      replace(data.booking);
      setCancelFor(null);
      toast('Request sent. The jatha will review it shortly.');
    } catch (err) {
      setCancelError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="page manage">
      <Particles className="page-particles" density={0.6} />
      <div className="container manage-inner">
        <div className="section-head">
          <motion.span className="eyebrow" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease }}>
            Your bookings
          </motion.span>
          <SplitText as="h1" className="section-title" text="Manage your bookings" highlight={[1, 2]} play />
          <motion.p className="section-lead" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5, duration: 0.8 }}>
            Enter the phone number you used while booking to see all your bookings, bills and payments. Team members: enter your number to see the sewas you are assigned to.
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
            <input type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder=" " required autoComplete="tel" />
            <span>Phone number</span>
          </label>
          <button className="btn btn-primary" disabled={loading}>
            {loading ? <Loader2 size={18} className="spin" /> : <Search size={18} />} Find my bookings
          </button>
          {recentPhones.length > 0 && (
            <div className="recent">
              <span>Used on this device:</span>
              {recentPhones.map((p) => (
                <button
                  type="button"
                  key={p}
                  className="chip"
                  onClick={() => {
                    setPhone(p);
                    lookup(p);
                  }}
                >
                  {p}
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
        </AnimatePresence>

        {bookings && <NotifyButton phone={searched} key={`notify-${searched}`} compact team={isTeam} />}

        {duties.length > 0 && (
          <>
            <motion.h2 className="results-count duty-title" key={`d-${searched}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              Your sewa duties · {duties.length}
            </motion.h2>
            <AnimatePresence mode="popLayout">
              {duties.map((d, i) => (
                <DutyCard key={d.ref} duty={d} index={i} />
              ))}
            </AnimatePresence>
          </>
        )}

        {bookings?.length > 0 && (
          <motion.p className="results-count" key={searched} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {bookings.length} booking{bookings.length === 1 ? '' : 's'} for {searched}
          </motion.p>
        )}
        <AnimatePresence mode="popLayout">
          {bookings?.map((b, i) => (
            <BookingCard key={b.ref} booking={b} phone={searched} index={i} onChange={replace} onRequestCancel={openCancel} />
          ))}
        </AnimatePresence>
      </div>

      <Modal
        open={!!cancelFor}
        onClose={() => !sending && setCancelFor(null)}
        title="Request cancellation"
        subtitle={cancelFor && `${cancelFor.serviceName} on ${prettyDate(cancelFor.date, 'd MMM yyyy')}. The jatha will review your request — your booking stays active until they approve it.`}
      >
        <form onSubmit={sendRequest} className="cancel-form">
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
            <button type="button" className="btn btn-ghost" onClick={() => setCancelFor(null)} disabled={sending}>
              Keep booking
            </button>
            <button className="btn btn-danger" disabled={sending}>
              {sending ? <Loader2 size={18} className="spin" /> : <Ban size={18} />} Send request
            </button>
          </div>
        </form>
      </Modal>
    </main>
  );
}
