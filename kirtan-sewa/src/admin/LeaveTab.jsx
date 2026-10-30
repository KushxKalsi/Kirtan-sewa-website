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

/** Team bookings: a member asks for a Head Ragi / Side Ragi / Tabla in their place; the admin assigns the people, or rejects. */
export default function LeaveTab({ data, api, setData, toast, openChat }) {
  const { today } = data;
  const people = data.people || [];
  const roles = data.roles || {};
  const [filter, setFilter] = useState('current');
  const [picks, setPicks] = useState({}); // leave id -> { booking id: person id } (replacing by hand after approval)
  const [assign, setAssign] = useState({}); // leave id -> { request index: person id }
  const [busy, setBusy] = useState('');
  const [rejectFor, setRejectFor] = useState(null);
  const [note, setNote] = useState('');
  const personOf = (id) => people.find((p) => p.id === id);

  const rank = (l) => (l.status === 'pending' ? (l.emergency ? 0 : 1) : 2);
  const leaves = [...(data.leaves || [])]
    .filter((l) => (filter === 'current' ? l.status === 'pending' || (l.status === 'approved' && l.to >= today) : true))
    // Waiting requests first (emergencies at the very top), then by date.
    .sort((a, b) => rank(a) - rank(b) || a.from.localeCompare(b.from));
  const affected = (l) => data.bookings.filter((b) => active(b) && b.date >= l.from && b.date <= l.to && (b.assignees || []).some((a) => a.id === l.personId)).sort((a, b) => (a.date + a.slotTime).localeCompare(b.date + b.slotTime));
  // Who could take the place: does this sewa, not already on the booking — nearest first.
  const options = (b, leavePersonId) =>
    people
      .filter((p) => p.id !== leavePersonId && canDo(p, b) && !(b.assignees || []).some((a) => a.id === p.id))
      .map((p) => ({ p, km: distanceKm(b.location, p.location) }))
      .sort((x, y) => (x.km ?? 1e9) - (y.km ?? 1e9));
  const pickFor = (l, b) => picks[l.id]?.[b.id] ?? '';
  // Who can be assigned to a request: anyone active (able to do the sewa, if it is one) — the role asked for first, then nearest.
  const candidates = (l, x) => {
    const b = x.bookingId && data.bookings.find((y) => y.id === x.bookingId);
    const where = b?.location || l.location;
    return people
      .filter((p) => p.active && !p.pending && p.id !== l.personId && (!b || (canDo(p, b) && !(b.assignees || []).some((a) => a.id === p.id && a.id !== l.personId))))
      .map((p) => ({ p, km: distanceKm(where, p.location) }))
      .sort((m, n) => (m.p.role === x.role ? 0 : 1) - (n.p.role === x.role ? 0 : 1) || (m.km ?? 1e9) - (n.km ?? 1e9));
  };
  const assignedFor = (l, i) => assign[l.id]?.[i] ?? l.picks?.[i]?.personId ?? '';
  const requestWhat = (x) => {
    const b = x.bookingId && data.bookings.find((y) => y.id === x.bookingId);
    const when = `${format(fromKey(x.date), 'EEE d MMM')}, ${x.start ? rangeTo12(`${x.start} – ${x.end}`) : 'whole day'}`;
    return b ? `${b.serviceName} · ${when} · ${b.name}` : when;
  };

  const mergeBookings = (list) => setData((d) => ({ ...d, bookings: d.bookings.map((b) => list.find((x) => x.id === b.id) || b) }));
  const decide = async (l, action, extra = {}) => {
    setBusy(l.id + action);
    try {
      let body = { action, ...extra };
      if (action === 'approve') {
        const missing = (l.picks || []).findIndex((_, i) => !assignedFor(l, i));
        if (missing >= 0) throw new Error(`Choose who goes as ${roles[l.picks[missing].role] || 'the teammate'} for ${requestWhat(l.picks[missing])}.`);
        body = { ...body, assign: Object.fromEntries((l.picks || []).map((_, i) => [i, assignedFor(l, i)])) };
      }
      const res = await api.decideLeave(l.id, body);
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
          <p>Team members ask for a Head Ragi, Side Ragi or Tabla to go in their place and offer the bhet. Assign a person to each request and approve: their sewas go to the people you chose (at the bhet offered) and everyone is notified. Team bookings never block anyone — several can share the same dates.</p>
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
            // After approval: any of their sewas still with them (e.g. added later) can be handed over by hand.
            const list = l.status === 'approved' ? affected(l) : [];
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

                {(l.picks || []).length > 0 && (
                  <div className="leave-duties">
                    <p className="label">{l.status === 'pending' ? 'What they need — assign a person to each' : 'Assigned'}</p>
                    {l.picks.map((x, i) => {
                      const opts = l.status === 'pending' ? candidates(l, x) : [];
                      const match = opts.filter((o) => o.p.role === x.role);
                      const others = opts.filter((o) => o.p.role !== x.role);
                      const option = ({ p: o, km }) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                          {o.role ? ` — ${roles[o.role]}` : ''}
                          {km != null ? ` · ${kmText(km)}` : ''}
                        </option>
                      );
                      return (
                        <div key={i} className="leave-duty">
                          <span>
                            <strong>{roles[x.role] || 'Teammate'}</strong> · ₹{x.pay} · {requestWhat(x)}
                          </span>
                          {l.status === 'pending' ? (
                            <select className="input" value={assignedFor(l, i)} onChange={(e) => setAssign((a) => ({ ...a, [l.id]: { ...a[l.id], [i]: e.target.value } }))}>
                              <option value="">{opts.length ? `Choose the ${roles[x.role] || 'person'}…` : 'Nobody is free for this'}</option>
                              {match.length > 0 && <optgroup label={roles[x.role]}>{match.map(option)}</optgroup>}
                              {others.length > 0 && <optgroup label="Other roles">{others.map(option)}</optgroup>}
                            </select>
                          ) : (
                            <span className="muted">{x.personId ? `→ ${personOf(x.personId)?.name || 'someone removed'}` : '—'}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {list.length > 0 && (
                  <div className="leave-duties">
                    <p className="label">Still assigned to them during this booking</p>
                    {list.map((b) => {
                      const opts = options(b, l.personId);
                      return (
                        <div key={b.id} className="leave-duty">
                          <span>
                            <strong>{b.serviceName}</strong> · {format(fromKey(b.date), 'EEE d MMM')}, {rangeTo12(b.slotTime)} · {b.name}
                          </span>
                          <select className="input" value={pickFor(l, b)} onChange={(e) => setPicks((x) => ({ ...x, [l.id]: { ...x[l.id], [b.id]: e.target.value } }))}>
                            <option value="">{opts.length ? 'Choose who takes their place…' : 'Nobody else can do this sewa'}</option>
                            {opts.map(({ p: o, km }) => (
                              <option key={o.id} value={o.id}>
                                {o.name}
                                {o.role ? ` — ${roles[o.role]}` : ''}
                                {km != null ? ` · ${kmText(km)}` : ''}
                              </option>
                            ))}
                          </select>
                          <button className="btn btn-ghost btn-sm" onClick={() => replaceNow(l, b)} disabled={!!busy}>
                            {busy === b.id ? <Loader2 size={14} className="spin" /> : <Repeat size={14} />} Replace
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="ab-actions">
                  {l.status === 'pending' && (
                    <>
                      <button className="btn btn-primary btn-sm" onClick={() => decide(l, 'approve')} disabled={!!busy}>
                        {busy === l.id + 'approve' ? <Loader2 size={15} className="spin" /> : <Check size={15} />} Assign & approve
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
