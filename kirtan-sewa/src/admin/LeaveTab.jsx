import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { format } from 'date-fns';
import { Ban, Check, Loader2, MapPin, MessagesSquare, Repeat, Undo2, UsersRound } from 'lucide-react';
import Modal from '../components/Modal';
import { fromKey, prettyDate, rangeTo12 } from '../lib/date';
import { distanceKm, kmText, mapsLink } from '../lib/geo';
import { ease } from '../lib/motion';

const STATUS = { pending: 'Waiting for you', approved: 'Approved', rejected: 'Rejected', cancelled: 'Cancelled' };
const active = (b) => b.status === 'pending' || b.status === 'confirmed';
const canDo = (p, b) => p.active && (p.skills || []).some((k) => k.serviceId === b.serviceId && (!b.categoryId || k.categoryId === b.categoryId));

/** Team members' leave: approve with replacements for their sewas, or reject. */
export default function LeaveTab({ data, api, setData, toast, openChat }) {
  const { today } = data;
  const people = data.people || [];
  const roles = data.roles || {};
  const [filter, setFilter] = useState('current');
  const [picks, setPicks] = useState({}); // leave id -> { booking id: person id }
  const [busy, setBusy] = useState('');
  const [rejectFor, setRejectFor] = useState(null);
  const [note, setNote] = useState('');
  const personOf = (id) => people.find((p) => p.id === id);
  const onLeave = (personId, date) => (data.leaves || []).some((l) => l.personId === personId && l.status === 'approved' && l.from <= date && l.to >= date);

  const rank = (l) => (l.status === 'pending' ? (l.emergency ? 0 : 1) : 2);
  const leaves = [...(data.leaves || [])]
    .filter((l) => (filter === 'current' ? l.status === 'pending' || (l.status === 'approved' && l.to >= today) : true))
    // Waiting requests first (emergencies at the very top), then by date.
    .sort((a, b) => rank(a) - rank(b) || a.from.localeCompare(b.from));
  const affected = (l) => data.bookings.filter((b) => active(b) && b.date >= l.from && b.date <= l.to && (b.assignees || []).some((a) => a.id === l.personId)).sort((a, b) => (a.date + a.slotTime).localeCompare(b.date + b.slotTime));
  // Who could take the place: does this sewa, not on leave that day, not already on the booking — nearest first.
  const options = (b, leavePersonId) =>
    people
      .filter((p) => p.id !== leavePersonId && canDo(p, b) && !onLeave(p.id, b.date) && !(b.assignees || []).some((a) => a.id === p.id))
      .map((p) => ({ p, km: distanceKm(b.location, p.location) }))
      .sort((x, y) => (x.km ?? 1e9) - (y.km ?? 1e9));
  const pickFor = (l, b) => {
    const chosen = picks[l.id]?.[b.id];
    if (chosen !== undefined) return chosen;
    // Start with the teammate they booked for this sewa (older requests had one suggestion for all).
    const booked = (l.picks || []).find((x) => x.bookingId === b.id)?.personId ?? l.replacementId;
    return options(b, l.personId).some((o) => o.p.id === booked) ? booked : '';
  };

  const mergeBookings = (list) => setData((d) => ({ ...d, bookings: d.bookings.map((b) => list.find((x) => x.id === b.id) || b) }));
  const decide = async (l, action, extra = {}) => {
    setBusy(l.id + action);
    try {
      const replacements = action === 'approve' ? Object.fromEntries(affected(l).map((b) => [b.id, pickFor(l, b)])) : undefined;
      const res = await api.decideLeave(l.id, { action, replacements, ...extra });
      setData((d) => ({ ...d, leaves: res.leaves }));
      mergeBookings(res.bookings);
      toast(action === 'approve' ? `Team booking approved${res.bookings.length ? ` — ${res.bookings.length} sewa${res.bookings.length > 1 ? 's' : ''} handed over` : ''}.` : action === 'reject' ? 'Team booking rejected.' : 'Team booking cancelled.');
      if (res.skipped?.length) toast(`Not replaced: ${res.skipped.join('; ')}`, 'error');
      return true;
    } catch (e) {
      toast(e.message, 'error');
      return false;
    } finally {
      setBusy('');
    }
  };
  const replaceNow = async (l, b) => {
    const toId = pickFor(l, b);
    if (!toId) return toast('Choose who takes their place.', 'error');
    setBusy(b.id);
    try {
      mergeBookings([(await api.replaceAssignee(b.id, l.personId, toId)).booking]);
      toast('Replaced — both are notified.');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="admin-section">
      <div className="admin-section-head">
        <div>
          <h2>Team bookings</h2>
          <p>Team members book teammates (Head Ragi, Side Ragi or Tabla) to go in their place and offer each one a bhet. Approving hands their sewas to the people chosen (at the bhet offered) and notifies everyone. While their booking runs they can’t be assigned themselves.</p>
        </div>
      </div>
      <div className="filter-pills">
        {[
          { id: 'current', label: 'Pending & upcoming' },
          { id: 'all', label: 'All' },
        ].map((f) => (
          <button key={f.id} className={filter === f.id ? 'active' : ''} onClick={() => setFilter(f.id)}>
            {filter === f.id && <motion.span layoutId="leave-pill" className="pill-bg" transition={{ type: 'spring', stiffness: 400, damping: 34 }} />}
            <span>{f.label}</span>
          </button>
        ))}
      </div>
      {leaves.length === 0 && <div className="admin-empty glass">No team bookings here.</div>}
      <ul className="leave-admin">
        <AnimatePresence initial={false}>
          {leaves.map((l) => {
            const p = personOf(l.personId);
            const list = l.status === 'pending' || l.status === 'approved' ? affected(l) : [];
            return (
              <motion.li key={l.id} layout className={`glass leave-card l-${l.status}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.35, ease }}>
                <div className="leave-card-head">
                  <UsersRound size={20} />
                  <div>
                    <strong>
                      {p?.name || l.personName}
                      {p?.role && <small className="muted"> · {roles[p.role]}</small>}
                      {l.emergency && <em className="emergency-tag">Emergency</em>}
                    </strong>
                    <span>
                      {prettyDate(l.from, 'EEE, d MMM yyyy')}
                      {l.to !== l.from && ` – ${prettyDate(l.to, 'EEE, d MMM yyyy')}`}
                    </span>
                    <span className="muted">
                      “{l.reason}” · asked {format(new Date(l.createdAt), 'd MMM')}
                      {l.replacementId && !l.picks && ` · suggests ${personOf(l.replacementId)?.name || 'someone removed'}`}
                    </span>
                    {(l.picks || [])
                      .filter((x) => !x.bookingId)
                      .map((x, i) => (
                        <span key={i}>
                          Booked {personOf(x.personId)?.name || 'someone removed'} · {prettyDate(x.date, 'EEE, d MMM')}
                          {x.start ? ` · ${rangeTo12(`${x.start} – ${x.end}`)}` : ' · whole day'} · ₹{x.pay}
                        </span>
                      ))}
                    {l.location && (
                      <a className="muted" href={mapsLink(l.location)} target="_blank" rel="noreferrer">
                        <MapPin size={12} /> Teammates should go to: {l.location.label || 'map pin'}
                      </a>
                    )}
                    {l.note && <span className="muted">Your note: {l.note}</span>}
                  </div>
                  <span className={`pay-tag ${l.status === 'approved' ? 'pay-paid' : l.status === 'pending' ? 'pay-submitted' : 'req-tag'}`}>{STATUS[l.status]}</span>
                  {openChat && (
                    <button className="icon-btn" onClick={() => openChat(`m:${l.personId}`)} aria-label="Chat" title="Chat">
                      <MessagesSquare size={16} />
                    </button>
                  )}
                </div>

                {list.length > 0 && (
                  <div className="leave-duties">
                    <p className="label">{l.status === 'pending' ? 'Their sewas in these days — who should take their place?' : 'Still assigned to them during this booking'}</p>
                    {list.map((b) => {
                      const opts = options(b, l.personId);
                      const booked = (l.picks || []).find((x) => x.bookingId === b.id);
                      return (
                        <div key={b.id} className="leave-duty">
                          <span>
                            <strong>{b.serviceName}</strong> · {format(fromKey(b.date), 'EEE d MMM')}, {rangeTo12(b.slotTime)} · {b.name}
                          </span>
                          {booked && (
                            <span className="muted">
                              They booked {personOf(booked.personId)?.name || 'someone removed'} for ₹{booked.pay} (gets this bhet if you keep them)
                            </span>
                          )}
                          <select className="input" value={pickFor(l, b)} onChange={(e) => setPicks((x) => ({ ...x, [l.id]: { ...x[l.id], [b.id]: e.target.value } }))}>
                            <option value="">{opts.length ? 'Keep as is / decide later' : 'Nobody else can do this sewa'}</option>
                            {opts.map(({ p: o, km }) => (
                              <option key={o.id} value={o.id}>
                                {o.name}
                                {o.role ? ` — ${roles[o.role]}` : ''}
                                {km != null ? ` · ${kmText(km)}` : ''}
                              </option>
                            ))}
                          </select>
                          {l.status === 'approved' && (
                            <button className="btn btn-ghost btn-sm" onClick={() => replaceNow(l, b)} disabled={!!busy}>
                              {busy === b.id ? <Loader2 size={14} className="spin" /> : <Repeat size={14} />} Replace
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="ab-actions">
                  {l.status === 'pending' && (
                    <>
                      <button className="btn btn-primary btn-sm" onClick={() => decide(l, 'approve')} disabled={!!busy}>
                        {busy === l.id + 'approve' ? <Loader2 size={15} className="spin" /> : <Check size={15} />} Approve
                        {list.length > 0 ? ' & hand over' : ''}
                      </button>
                      <button
                        className="btn btn-ghost btn-sm danger-text"
                        onClick={() => {
                          setNote('');
                          setRejectFor(l);
                        }}
                        disabled={!!busy}
                      >
                        <Ban size={15} /> Reject
                      </button>
                    </>
                  )}
                  {l.status === 'approved' && l.to >= today && (
                    <button className="btn btn-ghost btn-sm" onClick={() => decide(l, 'cancel')} disabled={!!busy}>
                      <Undo2 size={15} /> Cancel this booking
                    </button>
                  )}
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>

      <Modal open={!!rejectFor} onClose={() => setRejectFor(null)} title="Reject team booking" subtitle="They are told on their phone. You can add a message.">
        <form
          className="cancel-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await decide(rejectFor, 'reject', { note })) setRejectFor(null);
          }}
        >
          <label className="field">
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder=" " rows={3} />
            <span>Message (optional)</span>
          </label>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setRejectFor(null)}>
              Back
            </button>
            <button className="btn btn-danger" disabled={!!busy}>
              <Ban size={17} /> Reject
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
