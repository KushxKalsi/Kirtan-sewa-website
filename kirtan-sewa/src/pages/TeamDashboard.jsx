import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { addDays, format } from 'date-fns';
import {
  Ban,
  CalendarDays,
  CalendarOff,
  Check,
  CircleAlert,
  CircleCheck,
  Clock,
  FileText,
  HandCoins,
  Hourglass,
  KeyRound,
  ListChecks,
  Loader2,
  LogOut,
  MapPin,
  MessagesSquare,
  Navigation,
  Phone,
  Save,
  Trash2,
  Undo2,
  Upload,
  User,
  UserRound,
  UsersRound,
} from 'lucide-react';
import Modal from '../components/Modal';
import NotifyButton from '../components/NotifyButton';
import ChatBox from '../components/ChatBox';
import LocationPicker from '../components/LocationPicker';
import { useAuth } from '../components/AuthContext';
import { useSite } from '../components/SiteContext';
import { useToast } from '../components/Toast';
import { fromKey, prettyDate, rangeTo12 } from '../lib/date';
import { directionsLink, mapsLink } from '../lib/geo';
import { fileToDataUrl, readDataUrl } from '../lib/image';
import { rupees } from '../lib/money';
import { ease } from '../lib/motion';

const TABS = [
  { id: 'duties', label: 'My sewas', icon: ListChecks },
  { id: 'leave', label: 'Leave', icon: CalendarOff },
  { id: 'chat', label: 'Chat with admin', icon: MessagesSquare },
  { id: 'profile', label: 'Profile & documents', icon: UserRound },
];
const LEAVE_TEXT = { pending: 'Waiting for admin', approved: 'Approved', rejected: 'Not approved', cancelled: 'Cancelled by admin' };
const live = (d) => d.status === 'pending' || d.status === 'confirmed';
const dayKey = (d) => format(d, 'yyyy-MM-dd');

function DutyCard({ duty, today, person, index, busy, onConfirm, onCancel, onWithdraw, onPay }) {
  const { site } = useSite();
  const past = duty.date < today;
  const status = past && duty.status !== 'cancelled' ? 'completed' : duty.status;
  // No cancelling within 2 days of the program (the server checks this too).
  const lockedFrom = dayKey(addDays(fromKey(today), 2));
  const upcoming = live(duty) && !past;
  const canCancel = upcoming && duty.date > lockedFrom && duty.cancelRequest?.status !== 'pending';
  const adminTel = site?.settings.phone?.replace(/[^\d+]/g, '');

  return (
    <motion.article
      layout
      className={`booking-card duty-card glass st-${duty.status} ${past ? 'past' : ''}`}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5, ease, delay: Math.min(index, 6) * 0.06 }}
    >
      <header>
        <div>
          <span className="bc-ref">{duty.ref}</span>
          <h2>{duty.serviceName}</h2>
          {duty.categoryName && <span className="bc-cat">{duty.categoryName}</span>}
        </div>
        <div className="duty-badges">
          <span className={`badge badge-${status}`}>{status}</span>
          {upcoming && (duty.state === 'confirmed' ? <span className="pay-tag pay-paid">You confirmed</span> : <span className="pay-tag pay-submitted">Please confirm</span>)}
        </div>
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
          <span>
            <a href={mapsLink(duty.location, duty.address)} target="_blank" rel="noreferrer">
              {duty.address}
            </a>
            {duty.location && person.location && (
              <a className="bc-map" href={directionsLink(person.location, duty.location)} target="_blank" rel="noreferrer">
                <Navigation size={12} /> Directions
              </a>
            )}
          </span>
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

      {duty.status !== 'cancelled' && (
        <div className="duty-pay">
          <HandCoins size={18} />
          <div>
            <strong>{duty.pay != null ? rupees(duty.pay) : 'Bhet not set yet'}</strong>
            <span>{duty.payRequest ? `You asked for ${rupees(duty.payRequest.amount)} — waiting for the admin` : 'Your bhet for this sewa'}</span>
          </div>
          {!past && (
            <button className="btn btn-ghost btn-sm" onClick={() => onPay(duty)}>
              Ask for a change
            </button>
          )}
        </div>
      )}

      {duty.status === 'cancelled' && (
        <div className="cancel-note">
          <strong>This sewa was cancelled</strong>
          {duty.cancelReason && <p>Reason: {duty.cancelReason}</p>}
        </div>
      )}
      {duty.cancelRequest?.status === 'pending' && (
        <div className="request-note">
          <Hourglass size={18} />
          <div>
            <strong>You asked to be taken off this sewa — waiting for the admin</strong>
            <p>Your reason: {duty.cancelRequest.reason}</p>
            <button className="btn btn-ghost btn-sm" onClick={() => onWithdraw(duty)} disabled={!!busy}>
              <Undo2 size={15} /> I will do it (withdraw request)
            </button>
          </div>
        </div>
      )}
      {duty.cancelRequest?.status === 'rejected' && upcoming && (
        <div className="cancel-note">
          <strong>Your request to cancel was not accepted</strong>
          {duty.cancelRequest.note && <p>Admin: {duty.cancelRequest.note}</p>}
        </div>
      )}

      {upcoming && (
        <div className="ab-actions duty-actions">
          {duty.state !== 'confirmed' && (
            <button className="btn btn-primary btn-sm" onClick={() => onConfirm(duty)} disabled={!!busy}>
              {busy === duty.id + 'confirm' ? <Loader2 size={15} className="spin" /> : <Check size={15} />} Confirm I will do this sewa
            </button>
          )}
          {canCancel && (
            <button className="btn btn-ghost btn-sm danger-text" onClick={() => onCancel(duty)} disabled={!!busy}>
              <Ban size={15} /> I can’t do this sewa
            </button>
          )}
          {!canCancel && duty.cancelRequest?.status !== 'pending' && (
            <p className="fine-print">
              Within 2 days of the program it can’t be cancelled here.{' '}
              {adminTel && (
                <a href={`tel:${adminTel}`}>
                  <Phone size={12} /> Call the admin
                </a>
              )}
            </p>
          )}
        </div>
      )}
    </motion.article>
  );
}

function Duties({ data, team, apply, toast }) {
  const [filter, setFilter] = useState('upcoming');
  const [busy, setBusy] = useState('');
  const [cancelFor, setCancelFor] = useState(null);
  const [reason, setReason] = useState('');
  const [payFor, setPayFor] = useState(null);
  const [pay, setPay] = useState({ amount: '', note: '' });
  const { duties, today, person } = data;

  const run = async (key, fn, msg) => {
    setBusy(key);
    try {
      apply(await fn());
      if (msg) toast(msg);
      return true;
    } catch (e) {
      toast(e.message, 'error');
      return false;
    } finally {
      setBusy('');
    }
  };

  const upcoming = duties.filter((d) => live(d) && d.date >= today);
  const done = duties.filter((d) => d.date < today && d.status !== 'cancelled');
  const shown = filter === 'upcoming' ? upcoming : filter === 'done' ? done : duties;
  const earned = done.reduce((s, d) => s + (d.pay || 0), 0);
  const coming = upcoming.reduce((s, d) => s + (d.pay || 0), 0);
  const stats = [
    { label: 'Upcoming sewas', value: upcoming.length, tone: 'gold' },
    { label: 'Waiting for your confirmation', value: upcoming.filter((d) => d.state !== 'confirmed').length, tone: 'warn' },
    { label: 'Sewas done', value: done.length, tone: 'success' },
    { label: 'Bhet earned', value: rupees(earned), tone: 'success' },
    { label: 'Bhet for upcoming sewas', value: rupees(coming), tone: 'gold' },
  ];

  return (
    <>
      <div className="admin-stats">
        {stats.map((s) => (
          <div key={s.label} className={`admin-stat glass tone-${s.tone}`}>
            <strong>{s.value}</strong>
            <span>{s.label}</span>
          </div>
        ))}
      </div>
      <div className="filter-pills">
        {[
          { id: 'upcoming', label: `Upcoming (${upcoming.length})` },
          { id: 'done', label: `Done (${done.length})` },
          { id: 'all', label: 'All' },
        ].map((f) => (
          <button key={f.id} className={filter === f.id ? 'active' : ''} onClick={() => setFilter(f.id)}>
            {filter === f.id && <motion.span layoutId="duty-pill" className="pill-bg" transition={{ type: 'spring', stiffness: 400, damping: 34 }} />}
            <span>{f.label}</span>
          </button>
        ))}
      </div>
      {shown.length === 0 && <div className="admin-empty glass">{filter === 'upcoming' ? 'No upcoming sewas right now. You will be notified when you are given one.' : 'Nothing here yet.'}</div>}
      <AnimatePresence mode="popLayout">
        {shown.map((d, i) => (
          <DutyCard
            key={d.id}
            duty={d}
            today={today}
            person={person}
            index={i}
            busy={busy}
            onConfirm={(x) => run(x.id + 'confirm', () => team.confirmDuty(x.id), 'Thank you — the admin can see you confirmed.')}
            onWithdraw={(x) => run(x.id + 'withdraw', () => team.withdrawDutyCancel(x.id), 'Request withdrawn.')}
            onCancel={(x) => {
              setReason('');
              setCancelFor(x);
            }}
            onPay={(x) => {
              setPay({ amount: x.pay ? String(x.pay) : '', note: '' });
              setPayFor(x);
            }}
          />
        ))}
      </AnimatePresence>

      <Modal open={!!cancelFor} onClose={() => setCancelFor(null)} title="Can’t do this sewa?" subtitle={cancelFor && `${cancelFor.serviceName} on ${prettyDate(cancelFor.date, 'd MMM yyyy')}. The admin will approve it and find someone else.`}>
        <form
          className="cancel-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await run('cancel', () => team.requestDutyCancel(cancelFor.id, reason), 'Request sent to the admin.')) setCancelFor(null);
          }}
        >
          <label className="field">
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder=" " rows={3} required minLength={3} autoFocus />
            <span>Reason *</span>
          </label>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setCancelFor(null)}>
              Back
            </button>
            <button className="btn btn-danger" disabled={!!busy}>
              {busy === 'cancel' ? <Loader2 size={17} className="spin" /> : <Ban size={17} />} Send request
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={!!payFor} onClose={() => setPayFor(null)} title="Ask for a different bhet" subtitle={payFor && `${payFor.serviceName} on ${prettyDate(payFor.date, 'd MMM yyyy')}${payFor.pay != null ? ` · now ${rupees(payFor.pay)}` : ''}. Your request goes to the admin’s chat.`}>
        <form
          className="cancel-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await run('pay', () => team.requestPay(payFor.id, pay.amount, pay.note), 'Request sent. The admin will reply in your chat.')) setPayFor(null);
          }}
        >
          <label className="field amount-field">
            <input type="number" inputMode="numeric" min="1" value={pay.amount} onChange={(e) => setPay((p) => ({ ...p, amount: e.target.value }))} placeholder=" " required autoFocus />
            <span>Bhet you are asking for (₹) *</span>
          </label>
          <label className="field">
            <textarea value={pay.note} onChange={(e) => setPay((p) => ({ ...p, note: e.target.value }))} placeholder=" " rows={2} maxLength={300} />
            <span>Why? (optional — e.g. long travel)</span>
          </label>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setPayFor(null)}>
              Back
            </button>
            <button className="btn btn-primary" disabled={!!busy}>
              {busy === 'pay' ? <Loader2 size={17} className="spin" /> : <HandCoins size={17} />} Send request
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

const LEAVE_MIN_PAY = 200; // the least bhet per sewa they can offer the teammate going in their place
const DAY_MS = 24 * 60 * 60 * 1000;
// When a leave really starts: the first affected sewa, or the start of the first day (same rule as the server).
const leaveStart = (from, sewas) => {
  const times = sewas.map((d) => fromKey(`${d.date}T${(d.slotTime || '').split('–')[0].trim() || '00:00'}`).getTime()).filter(Number.isFinite);
  return times.length ? Math.min(...times) : fromKey(from).getTime();
};

/** Who goes in their place for one sewa: role (Head Ragi / Side Ragi / Tabla) → teammate → the bhet offered. */
function SewaCover({ duty, pick, set, teammates, roles, onCopy }) {
  const role = pick.role;
  const choices = teammates.filter((t) => t.role === role);
  const chosen = teammates.find((t) => t.id === pick.personId);
  return (
    <div className="sewa-cover glass">
      <div className="sewa-cover-head">
        <strong>{duty.serviceName}</strong>
        <span className="muted">
          {prettyDate(duty.date, 'EEE, d MMM')} · {duty.slotLabel} · {rangeTo12(duty.slotTime)}
        </span>
      </div>
      <div className="slot-checks">
        {Object.entries(roles).map(([id, label]) => (
          <button type="button" key={id} className={`check-pill ${role === id ? 'active' : ''}`} onClick={() => set({ role: id, personId: '' })}>
            {label} ({teammates.filter((t) => t.role === id).length})
          </button>
        ))}
      </div>
      <div className="replace-people">
        {choices.length === 0 && <p className="muted">No other {roles[role]} in the team yet — choose another role.</p>}
        {choices.map((t) => (
          <button type="button" key={t.id} className={`replace-person glass ${pick.personId === t.id ? 'active' : ''}`} onClick={() => set({ personId: pick.personId === t.id ? '' : t.id })}>
            <UserRound size={18} />
            <span>
              <strong>{t.name}</strong>
              <small>{roles[t.role]}</small>
            </span>
            {pick.personId === t.id && <Check size={18} />}
          </button>
        ))}
      </div>
      {chosen && (
        <label>
          <span className="label">
            <HandCoins size={13} /> Bhet you offer {chosen.name} for this sewa (₹, at least {LEAVE_MIN_PAY}) *
          </span>
          <input className="input" type="number" inputMode="numeric" min={LEAVE_MIN_PAY} step="1" value={pick.pay} onChange={(e) => set({ pay: e.target.value })} placeholder={`e.g. ${LEAVE_MIN_PAY * 5}`} required />
        </label>
      )}
      {onCopy && chosen && (
        <button type="button" className="link-btn" onClick={onCopy}>
          Same person and bhet for all my sewas in these days
        </button>
      )}
    </div>
  );
}

/** Leave = booking teammates in your place (one per sewa, with the bhet you offer), then the admin approves. */
function Leave({ data, team, apply, toast }) {
  const { today, duties, leaves, teammates, roles } = data;
  const bookedMe = data.bookedMe || [];
  const ownRole = roles[data.person.role] ? data.person.role : Object.keys(roles)[0];
  const blankLeave = { from: '', to: '', reason: '', location: null };
  const [form, setForm] = useState(blankLeave);
  const [picks, setPicks] = useState({}); // duty id -> { role, personId, pay }
  const [busy, setBusy] = useState('');
  const to = form.to || form.from;
  const affected = form.from ? duties.filter((d) => live(d) && d.date >= form.from && d.date <= to).sort((a, b) => (a.date + a.slotTime).localeCompare(b.date + b.slotTime)) : [];
  const emergency = !!form.from && leaveStart(form.from, affected) - Date.now() < DAY_MS;
  const pickOf = (id) => ({ role: ownRole, personId: '', pay: '', ...picks[id] });
  const setPick = (id, patch) => setPicks((all) => ({ ...all, [id]: { ...pickOf(id), ...patch } }));
  const copyToAll = (id) => setPicks((all) => ({ ...all, ...Object.fromEntries(affected.map((d) => [d.id, { ...pickOf(id) }])) }));
  const nameOf = (id) => teammates.find((t) => t.id === id)?.name || 'a team member';
  const dutyOf = (id) => duties.find((d) => d.id === id);

  const run = async (key, fn, msg) => {
    setBusy(key);
    try {
      apply(await fn());
      toast(msg);
      return true;
    } catch (e) {
      toast(e.message, 'error');
      return false;
    } finally {
      setBusy('');
    }
  };
  const submit = async (e) => {
    e.preventDefault();
    for (const d of affected) {
      const pk = pickOf(d.id);
      if (!pk.personId) return toast(`Choose who goes in your place for ${d.serviceName} on ${prettyDate(d.date, 'd MMM')}.`, 'error');
      if (!(Number(pk.pay) >= LEAVE_MIN_PAY)) return toast(`Offer at least ₹${LEAVE_MIN_PAY} for ${d.serviceName} on ${prettyDate(d.date, 'd MMM')}.`, 'error');
    }
    const body = { ...form, to, picks: affected.map((d) => ({ bookingId: d.id, personId: pickOf(d.id).personId, pay: Number(pickOf(d.id).pay) })) };
    if (await run('new', () => team.requestLeave(body), emergency ? 'Emergency leave request sent to the admin.' : 'Leave request sent to the admin.')) {
      setForm(blankLeave);
      setPicks({});
    }
  };
  const canWithdraw = (l) => l.status === 'pending' && new Date(l.startsAt || fromKey(l.from)).getTime() - Date.now() >= DAY_MS;

  return (
    <div className="leave-grid">
      <form className="glass profile-card" onSubmit={submit}>
        <h3>Ask for leave</h3>
        <div className="grid-2">
          <label>
            <span className="label">First day *</span>
            <input className="input" type="date" min={today} value={form.from} onChange={(e) => setForm((f) => ({ ...f, from: e.target.value }))} required />
          </label>
          <label>
            <span className="label">Last day</span>
            <input className="input" type="date" min={form.from || today} value={form.to} onChange={(e) => setForm((f) => ({ ...f, to: e.target.value }))} />
          </label>
        </div>
        {form.from && (
          <p className={`leave-affected ${affected.length ? 'warn' : ''}`}>
            {affected.length
              ? `You have ${affected.length} sewa${affected.length > 1 ? 's' : ''} in these days. Book a teammate for ${affected.length > 1 ? 'each one — they can be different people' : 'it'}.`
              : 'You have no sewas on these days.'}
          </p>
        )}
        {emergency && (
          <p className="leave-emergency">
            <CircleAlert size={16} /> This starts in less than 1 day, so it will be sent as an <strong>emergency</strong> request. It can’t be withdrawn once sent.
          </p>
        )}
        <label className="field">
          <textarea value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} placeholder=" " rows={2} required minLength={3} />
          <span>Reason *</span>
        </label>
        {affected.length > 0 && (
          <div className="sewa-covers">
            <span className="label">Who can do my sewas? *</span>
            {affected.map((d, i) => (
              <SewaCover key={d.id} duty={d} pick={pickOf(d.id)} set={(patch) => setPick(d.id, patch)} teammates={teammates} roles={roles} onCopy={i === 0 && affected.length > 1 ? () => copyToAll(d.id) : null} />
            ))}
          </div>
        )}
        {affected.length > 0 && (
          <div>
            <span className="label">Where should they go? (optional)</span>
            <LocationPicker value={form.location} onChange={(location) => setForm((f) => ({ ...f, location }))} label="Search the place on the map" hint="Pick the place where the people taking your place should go." />
          </div>
        )}
        <p className="fine-print">Leave must be asked at least 1 day before it starts; later requests go as emergencies. A request can’t be withdrawn within 1 day of its start.</p>
        <button className="btn btn-primary" disabled={!!busy}>
          {busy === 'new' ? <Loader2 size={17} className="spin" /> : <CalendarOff size={17} />} {emergency ? 'Send emergency request' : affected.length ? 'Book & send leave request' : 'Send leave request'}
        </button>
      </form>

      <div className="leave-list">
        <h3>Your leave</h3>
        {leaves.length === 0 && <p className="muted">No leave requests yet.</p>}
        {leaves.map((l) => (
          <div key={l.id} className={`glass leave-item l-${l.status}`}>
            <div>
              <strong>
                {prettyDate(l.from, 'd MMM yyyy')}
                {l.to !== l.from && ` – ${prettyDate(l.to, 'd MMM yyyy')}`}
                {l.emergency && <em className="emergency-tag">Emergency</em>}
              </strong>
              <span>{l.reason}</span>
              {(l.picks || []).map((x) => {
                const d = dutyOf(x.bookingId);
                return (
                  <span key={x.bookingId} className="muted">
                    {d ? `${d.serviceName} ${prettyDate(d.date, 'd MMM')} ${rangeTo12(d.slotTime)}: ` : ''}
                    {nameOf(x.personId)} · ₹{x.pay}
                  </span>
                );
              })}
              {l.replacementId && !l.picks && <span className="muted">Suggested: {nameOf(l.replacementId)}</span>}
              {l.location && (
                <a className="muted" href={mapsLink(l.location)} target="_blank" rel="noreferrer">
                  <MapPin size={12} /> {l.location.label || 'Open map'}
                </a>
              )}
              {l.note && <span className="muted">Admin: {l.note}</span>}
              {l.status === 'pending' && !canWithdraw(l) && <span className="muted">Can’t be withdrawn within 1 day of the start — message the admin.</span>}
            </div>
            <span className={`pay-tag ${l.status === 'approved' ? 'pay-paid' : l.status === 'pending' ? 'pay-submitted' : 'req-tag'}`}>{LEAVE_TEXT[l.status]}</span>
            {canWithdraw(l) && (
              <button className="icon-btn" onClick={() => run(l.id, () => team.withdrawLeave(l.id), 'Leave request withdrawn.')} aria-label="Withdraw" disabled={!!busy}>
                {busy === l.id ? <Loader2 size={16} className="spin" /> : <Trash2 size={16} />}
              </button>
            )}
          </div>
        ))}

        {bookedMe.length > 0 && (
          <>
            <h3>Teammates who booked you</h3>
            {bookedMe.map((l) => (
              <div key={l.id} className={`glass leave-item l-${l.status}`}>
                <div>
                  <strong>
                    {l.name}
                    {l.emergency && <em className="emergency-tag">Emergency</em>}
                  </strong>
                  {l.sewas.map((x, i) => (
                    <span key={i}>
                      {x.serviceName} · {prettyDate(x.date, 'EEE, d MMM')}
                      {x.slotTime && ` · ${rangeTo12(x.slotTime)}`} · ₹{x.pay}
                    </span>
                  ))}
                  {l.location && (
                    <a className="muted" href={mapsLink(l.location)} target="_blank" rel="noreferrer">
                      <MapPin size={12} /> {l.location.label || 'Open map'}
                    </a>
                  )}
                </div>
                <span className={`pay-tag ${l.status === 'approved' ? 'pay-paid' : 'pay-submitted'}`}>{l.status === 'approved' ? 'Approved — on your sewas' : 'Waiting for admin'}</span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function DocSlot({ kind, label, doc, team, apply, toast }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const upload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const pdf = file.type === 'application/pdf';
      if (pdf && file.size > 5 * 1024 * 1024) throw new Error('PDF is too large (max 5 MB).');
      const dataUrl = pdf ? await readDataUrl(file) : await fileToDataUrl(file, 1800, 'image/jpeg', 0.88);
      apply(await team.uploadDoc(kind, dataUrl, file.name));
      toast(`${label} uploaded.`);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    setBusy(true);
    try {
      apply(await team.removeDoc(kind));
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={`doc-slot glass ${doc ? 'has' : ''}`}>
      {doc ? (
        doc.type === 'application/pdf' ? (
          <a className="doc-thumb pdf" href={doc.url} target="_blank" rel="noreferrer">
            <FileText size={34} /> PDF
          </a>
        ) : (
          <a className="doc-thumb" href={doc.url} target="_blank" rel="noreferrer">
            <img src={doc.url} alt={label} loading="lazy" />
          </a>
        )
      ) : (
        <button type="button" className="doc-thumb empty" onClick={() => ref.current?.click()}>
          <Upload size={26} />
        </button>
      )}
      <strong>{label}</strong>
      {doc && <span className="muted">Uploaded {format(new Date(doc.at), 'd MMM yyyy')}</span>}
      <div className="doc-actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => ref.current?.click()} disabled={busy}>
          {busy ? <Loader2 size={14} className="spin" /> : <Upload size={14} />} {doc ? 'Replace' : 'Upload'}
        </button>
        {doc && (
          <button type="button" className="icon-btn danger-text" onClick={remove} disabled={busy} aria-label={`Remove ${label}`}>
            <Trash2 size={15} />
          </button>
        )}
      </div>
      <input ref={ref} type="file" accept="image/*,application/pdf" hidden onChange={upload} />
    </div>
  );
}

function Profile({ data, team, apply, toast }) {
  const { setToken, logout } = useAuth();
  const p = data.person;
  const [form, setForm] = useState(() => ({ name: p.name, fatherName: p.fatherName, experience: p.experience, address: p.address, location: p.location, bank: { ...p.bank } }));
  const [pw, setPw] = useState({ current: '', password: '' });
  const [busy, setBusy] = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setBank = (k) => (e) => setForm((f) => ({ ...f, bank: { ...f.bank, [k]: e.target.value } }));

  const save = async (e) => {
    e.preventDefault();
    setBusy('profile');
    try {
      apply(await team.saveProfile(form));
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
      setToken((await team.changePassword(pw.current, pw.password)).token);
      setPw({ current: '', password: '' });
      toast('Password changed.');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy('');
    }
  };

  return (
    <>
      <form className="glass profile-card wide" onSubmit={save}>
        <h3>Your details</h3>
        <p className="muted">
          Role: <strong>{data.roles[p.role] || 'not set'}</strong> (set by the admin) · Mobile: {p.phone}
        </p>
        <div className="grid-2">
          <label className="field">
            <input value={form.name} onChange={set('name')} placeholder=" " required />
            <span>Name *</span>
          </label>
          <label className="field">
            <input value={form.fatherName} onChange={set('fatherName')} placeholder=" " />
            <span>Father’s name</span>
          </label>
        </div>
        <label className="field">
          <textarea value={form.experience} onChange={set('experience')} placeholder=" " rows={2} maxLength={300} />
          <span>Experience (e.g. 12 years, Darbar Sahib hazoori ragi)</span>
        </label>
        <label className="field">
          <textarea value={form.address} onChange={set('address')} placeholder=" " rows={2} />
          <span>Address (shown to customers with your name)</span>
        </label>
        <div>
          <span className="label">Where are you based? Pick it on the map so the admin can give you nearby sewas.</span>
          <LocationPicker value={form.location} onChange={(location) => setForm((f) => ({ ...f, location }))} label="Search your home / base on the map" />
        </div>
        <h4>Bank account (for your bhet)</h4>
        <div className="grid-2">
          <label className="field">
            <input value={form.bank.holder} onChange={setBank('holder')} placeholder=" " />
            <span>Account holder name</span>
          </label>
          <label className="field">
            <input value={form.bank.account} onChange={setBank('account')} placeholder=" " inputMode="numeric" />
            <span>Account number</span>
          </label>
          <label className="field">
            <input value={form.bank.ifsc} onChange={setBank('ifsc')} placeholder=" " autoCapitalize="characters" />
            <span>IFSC code</span>
          </label>
          <label className="field">
            <input value={form.bank.bankName} onChange={setBank('bankName')} placeholder=" " />
            <span>Bank name & branch</span>
          </label>
        </div>
        <button className="btn btn-primary" disabled={!!busy}>
          {busy === 'profile' ? <Loader2 size={17} className="spin" /> : <Save size={17} />} Save profile
        </button>
      </form>

      <section className="docs">
        <h3>Documents</h3>
        <p className="muted">Photos or PDFs, up to 5 MB each. Only you and the admin can open them.</p>
        <div className="doc-grid">
          {Object.entries(data.docKinds).map(([kind, label]) => (
            <DocSlot key={kind} kind={kind} label={label} doc={p.docs[kind]} team={team} apply={apply} toast={toast} />
          ))}
        </div>
      </section>

      <form className="glass profile-card" onSubmit={changePw}>
        <h3>Change password</h3>
        <label className="field">
          <input type="password" value={pw.current} onChange={(e) => setPw((x) => ({ ...x, current: e.target.value }))} placeholder=" " autoComplete="current-password" required />
          <span>Current password</span>
        </label>
        <label className="field">
          <input type="password" value={pw.password} onChange={(e) => setPw((x) => ({ ...x, password: e.target.value }))} placeholder=" " autoComplete="new-password" minLength={6} required />
          <span>New password (6+ characters)</span>
        </label>
        <div className="ab-actions">
          <button className="btn btn-primary" disabled={!!busy}>
            {busy === 'pw' ? <Loader2 size={17} className="spin" /> : <KeyRound size={17} />} Change password
          </button>
          <button type="button" className="btn btn-ghost" onClick={logout}>
            <LogOut size={17} /> Log out
          </button>
        </div>
      </form>
    </>
  );
}

export default function TeamDashboard() {
  const { session, team, logout } = useAuth();
  const { site } = useSite();
  const toast = useToast();
  const [params] = useSearchParams();
  const [tab, setTab] = useState(params.get('chat') ? 'chat' : 'duties');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!team) return;
    try {
      setData(await team.me());
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, [team]);
  useEffect(() => {
    load();
  }, [load]);

  const chatLoad = useCallback(() => team.chat(), [team]);
  const chatSend = useCallback((text) => team.sendChat(text), [team]);
  const chatSeen = useCallback(() => setData((d) => (d && d.unread ? { ...d, unread: 0 } : d)), []);
  const missing = useMemo(() => {
    if (!data) return [];
    const p = data.person;
    return [!p.fatherName && 'father’s name', !p.experience && 'experience', !p.location && 'map location', !p.bank.account && 'bank account', ...Object.entries(data.docKinds).filter(([k]) => !p.docs[k]).map(([, l]) => l.toLowerCase())].filter(Boolean);
  }, [data]);

  if (!session) return <Navigate to="/login?as=team&next=/team" replace />;
  if (session.role !== 'member') return <Navigate to="/account" replace />;

  const ctx = { data, team, apply: setData, toast };
  const p = data?.person;

  return (
    <main className="page manage account team-page">
      <div className="container manage-inner account-inner">
        <header className="account-head">
          <div>
            <span className="eyebrow">Team</span>
            <h1 className="section-title">{p ? `Sat Sri Akal, ${p.name.split(' ')[0]}` : 'Team dashboard'}</h1>
            {p && (
              <p className="muted">
                {data.roles[p.role] || 'Team member'} · {p.phone}
              </p>
            )}
          </div>
          <div className="account-head-actions">
            {site?.settings.phone && (
              <a className="btn btn-ghost btn-sm" href={`tel:${site.settings.phone.replace(/[^\d+]/g, '')}`}>
                <Phone size={16} /> Call admin
              </a>
            )}
            <button className="btn btn-ghost btn-sm" onClick={logout}>
              <LogOut size={16} /> Log out
            </button>
          </div>
        </header>

        {p && <NotifyButton phone={p.phone} client={team} compact team />}
        {missing.length > 0 && tab !== 'profile' && (
          <button type="button" className="profile-nudge glass" onClick={() => setTab('profile')}>
            <CircleAlert size={18} /> Please complete your profile: {missing.join(', ')}.
          </button>
        )}

        <nav className="admin-tabs account-tabs" role="tablist">
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
              {tab === t.id && <motion.span layoutId="team-tab" className="admin-tab-bg" transition={{ type: 'spring', stiffness: 400, damping: 34 }} />}
              <t.icon size={16} />
              <span>{t.label}</span>
              {t.id === 'chat' && data?.unread > 0 && <em className="tab-badge">{data.unread}</em>}
              {t.id === 'duties' && data && data.duties.some((d) => live(d) && d.date >= data.today && d.state !== 'confirmed') && <em className="tab-badge">!</em>}
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
        {data && tab === 'duties' && <Duties {...ctx} />}
        {data && tab === 'leave' && <Leave {...ctx} />}
        {data && tab === 'chat' && (
          <ChatBox side="member" title="Chat with the admin" subtitle="Bhet, timings, leave — anything" callPhone={site?.settings.phone} callLabel="Call admin" load={chatLoad} send={chatSend} onMessages={chatSeen} />
        )}
        {data && tab === 'profile' && <Profile {...ctx} />}
        {data && tab === 'duties' && data.duties.length > 0 && (
          <p className="fine-print team-foot">
            <CircleCheck size={13} /> Sewas you confirm show as confirmed to the admin. Sewas can be cancelled here until 2 days before the program.
          </p>
        )}
      </div>
    </main>
  );
}
