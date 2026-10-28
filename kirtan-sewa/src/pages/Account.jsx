import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Ban,
  CalendarDays,
  CalendarPlus,
  CircleAlert,
  Clock,
  ExternalLink,
  Hourglass,
  KeyRound,
  Loader2,
  LogOut,
  MapPin,
  MessagesSquare,
  Save,
  Tag,
  Undo2,
  User,
  UserRound,
  UsersRound,
} from 'lucide-react';
import Modal from '../components/Modal';
import PaymentBox from '../components/PaymentBox';
import NotifyButton from '../components/NotifyButton';
import ChatBox from '../components/ChatBox';
import LocationPicker from '../components/LocationPicker';
import IntlTours from '../components/IntlTours';
import { useAuth } from '../components/AuthContext';
import { useSite } from '../components/SiteContext';
import { useToast } from '../components/Toast';
import { prettyDate, rangeTo12 } from '../lib/date';
import { mapsLink } from '../lib/geo';
import { rupees } from '../lib/money';
import { ease } from '../lib/motion';

const REASONS = ['Event date changed', 'Event postponed or called off', 'Booked another jatha', 'Booked by mistake', 'Other'];
const TABS = [
  { id: 'bookings', label: 'My bookings', icon: CalendarDays },
  { id: 'chat', label: 'Chat with jatha', icon: MessagesSquare },
  { id: 'profile', label: 'Profile', icon: UserRound },
];

function OfferNote({ offer }) {
  if (!offer) return null;
  const text = {
    pending: `Your offer of ${rupees(offer.amount)} is waiting for the jatha.`,
    accepted: `Your offer of ${rupees(offer.amount)} was accepted 🙏`,
    countered: `You offered ${rupees(offer.amount)}; the jatha set the bill at ${rupees(offer.counter)}.`,
    declined: `Your offer of ${rupees(offer.amount)} was not accepted.${offer.reply ? ` “${offer.reply}”` : ''}`,
  }[offer.status];
  return (
    <p className={`offer-note o-${offer.status}`}>
      <Tag size={15} /> {text}
    </p>
  );
}

function BookingCard({ booking, today, index, offerMin, onChange, onRequestCancel, onOffer }) {
  const { user } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState('');
  const [editingLoc, setEditingLoc] = useState(false);
  const request = booking.cancelRequest;
  const live = ['pending', 'confirmed'].includes(booking.status) && booking.date >= today;
  const canRequest = live && request?.status !== 'pending';
  const canOffer = live && booking.paymentStatus === 'unpaid' && !['pending', 'accepted'].includes(booking.offer?.status);

  const run = async (key, fn, msg) => {
    setBusy(key);
    try {
      const data = await fn();
      onChange(data.booking);
      if (msg) toast(msg);
      return true;
    } catch (e) {
      toast(e.message, 'error');
      return false;
    } finally {
      setBusy('');
    }
  };
  const saveLocation = async (loc) => {
    if (await run('loc', () => user.setLocation(booking.ref, loc), 'Map location saved.')) setEditingLoc(false);
  };

  return (
    <motion.article
      layout
      className={`booking-card glass st-${booking.status}`}
      initial={{ opacity: 0, y: 40, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.7, ease, delay: Math.min(index, 6) * 0.08 }}
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
          <MapPin size={17} />
          <span>
            {booking.address}
            {booking.location && (
              <a className="bc-map" href={mapsLink(booking.location)} target="_blank" rel="noreferrer">
                <ExternalLink size={12} /> Map pin
              </a>
            )}
          </span>
        </li>
      </ul>
      {booking.notes && <p className="bc-notes">“{booking.notes}”</p>}

      {live && (
        <div className="bc-location">
          {editingLoc ? (
            <>
              <LocationPicker value={booking.location} onChange={saveLocation} label="Search the venue on the map" />
              <button type="button" className="link-btn" onClick={() => setEditingLoc(false)}>
                Close
              </button>
              {busy === 'loc' && <Loader2 size={16} className="spin" />}
            </>
          ) : (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingLoc(true)}>
              <MapPin size={15} /> {booking.location ? 'Change map location' : 'Add Google Maps location'}
            </button>
          )}
        </div>
      )}

      {booking.team?.length > 0 && booking.status !== 'cancelled' && (
        <div className="team-box">
          <span className="team-box-head">
            <UsersRound size={16} /> Sewa by
          </span>
          <ul>
            {booking.team.map((t, i) => (
              <li key={i}>
                <strong>
                  {t.name}
                  {t.role && <small className="muted"> · {t.role}</small>}
                </strong>
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
            <button className="btn btn-ghost btn-sm" onClick={() => run('withdraw', () => user.withdrawCancel(booking.ref), 'Cancellation request withdrawn.')} disabled={!!busy}>
              {busy === 'withdraw' ? <Loader2 size={15} className="spin" /> : <Undo2 size={15} />} Keep my booking (withdraw request)
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

      {booking.status !== 'cancelled' && <OfferNote offer={booking.offer} />}
      {canOffer && (
        <button className="btn btn-ghost btn-sm offer-btn" onClick={() => onOffer(booking)}>
          <Tag size={15} /> {booking.offer ? 'Make a new offer' : 'Offer your own amount'}
          <small className="muted"> (from {rupees(offerMin)})</small>
        </button>
      )}

      <PaymentBox booking={booking} onUpdated={onChange} />

      {canRequest && (
        <button className="btn btn-ghost cancel-btn" onClick={() => onRequestCancel(booking)}>
          <Ban size={17} /> Request cancellation
        </button>
      )}
    </motion.article>
  );
}

function Profile({ me, onSaved }) {
  const { user, setToken, logout } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ name: me.name, email: me.email || '' });
  const [pw, setPw] = useState({ current: '', password: '' });
  const [busy, setBusy] = useState('');

  const save = async (e) => {
    e.preventDefault();
    setBusy('profile');
    try {
      onSaved((await user.updateMe(form)).user);
      toast('Profile saved.');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy('');
    }
  };
  const changePw = async (e) => {
    e.preventDefault();
    setBusy('pw');
    try {
      setToken((await user.changePassword(pw.current, pw.password)).token);
      setPw({ current: '', password: '' });
      toast('Password changed. Other devices have been logged out.');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="profile-grid">
      <form className="glass profile-card" onSubmit={save}>
        <h3>Your details</h3>
        <label className="field">
          <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder=" " required />
          <span>Name</span>
        </label>
        <label className="field">
          <input value={me.phone} disabled placeholder=" " />
          <span>Mobile number (your login)</span>
        </label>
        <label className="field">
          <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder=" " />
          <span>Email (optional)</span>
        </label>
        <button className="btn btn-primary" disabled={!!busy}>
          {busy === 'profile' ? <Loader2 size={17} className="spin" /> : <Save size={17} />} Save
        </button>
      </form>
      <form className="glass profile-card" onSubmit={changePw}>
        <h3>Change password</h3>
        <label className="field">
          <input type="password" value={pw.current} onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))} placeholder=" " autoComplete="current-password" required />
          <span>Current password</span>
        </label>
        <label className="field">
          <input type="password" value={pw.password} onChange={(e) => setPw((p) => ({ ...p, password: e.target.value }))} placeholder=" " autoComplete="new-password" minLength={6} required />
          <span>New password (6+ characters)</span>
        </label>
        <button className="btn btn-primary" disabled={!!busy}>
          {busy === 'pw' ? <Loader2 size={17} className="spin" /> : <KeyRound size={17} />} Change password
        </button>
        <button type="button" className="btn btn-ghost" onClick={logout}>
          <LogOut size={17} /> Log out
        </button>
      </form>
    </div>
  );
}

export default function Account() {
  const { session, user, logout } = useAuth();
  const { site } = useSite();
  const toast = useToast();
  const [params] = useSearchParams();
  const [tab, setTab] = useState(params.get('chat') ? 'chat' : 'bookings');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [cancelFor, setCancelFor] = useState(null);
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [sending, setSending] = useState(false);
  const [cancelError, setCancelError] = useState('');
  const [offerFor, setOfferFor] = useState(null);
  const [offer, setOffer] = useState({ amount: '', note: '' });
  const offerMin = Number(site?.settings.offerMin) || 0;

  const load = useCallback(async () => {
    if (!user) return;
    try {
      setData(await user.me());
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, [user]);
  useEffect(() => {
    load();
  }, [load]);

  const chatLoad = useCallback(() => user.chat(), [user]);
  const chatSend = useCallback((text) => user.sendChat(text), [user]);
  const chatSeen = useCallback(() => setData((d) => (d && d.unread ? { ...d, unread: 0 } : d)), []);

  if (!session) return <Navigate to="/login?next=/account" replace />;
  if (session.role === 'member') return <Navigate to="/team" replace />;

  const replace = (b) => setData((d) => ({ ...d, bookings: d.bookings.map((x) => (x.ref === b.ref ? b : x)) }));

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
      replace((await user.requestCancel(cancelFor.ref, full)).booking);
      setCancelFor(null);
      toast('Request sent. The jatha will review it shortly.');
    } catch (err) {
      setCancelError(err.message);
    } finally {
      setSending(false);
    }
  };

  const openOffer = (b) => {
    setOffer({ amount: b.offer?.amount ? String(b.offer.amount) : '', note: '' });
    setOfferFor(b);
  };
  const sendOffer = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      replace((await user.makeOffer(offerFor.ref, offer.amount, offer.note)).booking);
      setOfferFor(null);
      toast('Offer sent. The jatha will reply in your chat.');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSending(false);
    }
  };

  const me = data?.user;
  const today = data?.today || '';

  return (
    <main className="page manage account">
      <div className="container manage-inner account-inner">
        <header className="account-head">
          <div>
            <span className="eyebrow">Your account</span>
            <h1 className="section-title">{me ? `Sat Sri Akal, ${me.name.split(' ')[0]}` : 'Your account'}</h1>
            {me && <p className="muted">{me.phone}</p>}
          </div>
          <div className="account-head-actions">
            <Link to="/" state={{ scrollTo: 'book' }} className="btn btn-primary btn-sm">
              <CalendarPlus size={16} /> Book a date
            </Link>
            <button className="btn btn-ghost btn-sm" onClick={logout}>
              <LogOut size={16} /> Log out
            </button>
          </div>
        </header>

        <IntlTours compact />

        {me && <NotifyButton phone={me.phone} client={user} compact />}

        <nav className="admin-tabs account-tabs" role="tablist">
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
              {tab === t.id && <motion.span layoutId="account-tab" className="admin-tab-bg" transition={{ type: 'spring', stiffness: 400, damping: 34 }} />}
              <t.icon size={16} />
              <span>{t.label}</span>
              {t.id === 'chat' && data?.unread > 0 && <em className="tab-badge">{data.unread}</em>}
            </button>
          ))}
        </nav>

        {error && (
          <div className="form-error manage-error">
            <CircleAlert size={18} /> {error}
          </div>
        )}
        {!data && !error && (
          <div className="admin-loading">
            <Loader2 className="spin" />
          </div>
        )}

        {data && tab === 'bookings' && (
          <>
            {data.bookings.length === 0 ? (
              <div className="admin-empty glass">
                No bookings yet.{' '}
                <Link to="/" state={{ scrollTo: 'book' }}>
                  Check dates and book your first sewa
                </Link>
                .
              </div>
            ) : (
              <p className="results-count">
                {data.bookings.length} booking{data.bookings.length === 1 ? '' : 's'}
              </p>
            )}
            <AnimatePresence mode="popLayout">
              {data.bookings.map((b, i) => (
                <BookingCard key={b.ref} booking={b} today={today} index={i} offerMin={offerMin} onChange={replace} onRequestCancel={openCancel} onOffer={openOffer} />
              ))}
            </AnimatePresence>
          </>
        )}

        {data && tab === 'chat' && (
          <ChatBox
            side="user"
            title="Chat with the jatha"
            subtitle="About the bhet, timings, the venue or anything else"
            callPhone={site?.settings.phone}
            callLabel="Call jatha"
            load={chatLoad}
            send={chatSend}
            onMessages={chatSeen}
          />
        )}

        {data && tab === 'profile' && <Profile me={me} onSaved={(u) => setData((d) => ({ ...d, user: u }))} />}
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

      <Modal
        open={!!offerFor}
        onClose={() => !sending && setOfferFor(null)}
        title="Offer your own amount"
        subtitle={offerFor && `${offerFor.serviceName} on ${prettyDate(offerFor.date, 'd MMM yyyy')}${offerFor.amount ? ` · current bill ${rupees(offerFor.amount)}` : ''}. The jatha will accept it or reply in your chat.`}
      >
        <form onSubmit={sendOffer} className="cancel-form">
          <label className="field amount-field">
            <input type="number" inputMode="numeric" min={offerMin} step="1" value={offer.amount} onChange={(e) => setOffer((o) => ({ ...o, amount: e.target.value }))} placeholder=" " required autoFocus />
            <span>Your offer (₹, at least {rupees(offerMin)}) *</span>
          </label>
          <label className="field">
            <textarea value={offer.note} onChange={(e) => setOffer((o) => ({ ...o, note: e.target.value }))} placeholder=" " rows={2} maxLength={300} />
            <span>Note (optional)</span>
          </label>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setOfferFor(null)} disabled={sending}>
              Back
            </button>
            <button className="btn btn-primary" disabled={sending}>
              {sending ? <Loader2 size={18} className="spin" /> : <Tag size={18} />} Send offer
            </button>
          </div>
        </form>
      </Modal>
    </main>
  );
}
