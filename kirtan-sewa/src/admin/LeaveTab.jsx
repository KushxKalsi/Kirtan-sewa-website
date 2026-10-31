import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { format } from 'date-fns';
import { Ban, Check, CircleCheck, FileText, Loader2, MapPin, MessagesSquare, Repeat, Send, Trash2, Undo2, UsersRound } from 'lucide-react';
import Modal from '../components/Modal';
import { TeamBillModal } from '../components/Bill';
import { fromKey, prettyDate, rangeTo12 } from '../lib/date';
import { distanceKm, kmText, mapsLink } from '../lib/geo';
import { rupees } from '../lib/money';
import { ease } from '../lib/motion';

const STATUS = { pending: 'Waiting for you', assigned: 'Waiting for teammates', approved: 'Booked', rejected: 'Rejected', cancelled: 'Cancelled' };
const REPLY = { waiting: 'Asked — waiting for their yes', accepted: 'Accepted ✓', declined: 'Declined' };
const replyOf = (x) => x.reply || (x.personId ? 'accepted' : ''); // approved before replies existed = accepted
const live = (l) => l.status === 'pending' || l.status === 'assigned' || l.status === 'approved';
const asking = (l) => l.status === 'pending' || l.status === 'assigned';
// The member pays the bhet offered; the admin keeps the commission out of it and the people who go get the rest.
const cut = (l, x) => Math.round(((Number(x.pay) || 0) * (l.commissionRate ?? 0)) / 100);
const netOf = (l, x) => (Number(x.pay) || 0) - cut(l, x);
// Cash: each person who accepted collects their whole bhet and owes the commission on it — one share per person.
const cashShares = (l) =>
  l.paymentMethod !== 'cash'
    ? []
    : [...new Set((l.picks || []).filter((x) => x.personId && replyOf(x) === 'accepted').map((x) => x.personId))]
        .map((id) => {
          const mine = l.picks.filter((x) => x.personId === id && replyOf(x) === 'accepted');
          return { id, amount: mine.reduce((t, x) => t + cut(l, x), 0), paid: mine.every((x) => x.commissionPaidAt) };
        })
        .filter((sh) => sh.amount > 0);
const moneyOf = (l) => {
  const total = l.total ?? (l.picks || []).reduce((t, x) => t + (Number(x.pay) || 0), 0);
  const commission = l.commission ?? (l.picks || []).reduce((t, x) => t + cut(l, x), 0);
  return { total, rate: l.commissionRate ?? 0, commission };
};
const NOTE_FOR = {
  reject: { title: 'Reject team booking', button: 'Reject', sub: 'They are told on their phone. You can add a message.' },
  cancel: { title: 'Cancel team booking', button: 'Cancel it', sub: 'They and anyone asked to go are told. A sewa already handed over stays with the new person — use Replace on the booking to change it.' },
  keep: { title: 'Keep the team booking', button: 'Keep it', sub: 'Turns down their request to cancel. You can add a message.' },
  delete: { title: 'Delete team booking', button: 'Delete', sub: 'Removes it for good, for the member too. If it is still on, the people asked are told it is cancelled.' },
};
const active = (b) => b.status === 'pending' || b.status === 'confirmed';
const canDo = (p, b) => p.active && (p.skills || []).some((k) => k.serviceId === b.serviceId && (!b.categoryId || k.categoryId === b.categoryId));

/**
 * Team bookings: a member asks for a Head Ragi / Side Ragi / Tabla in their place; the admin assigns the people, who
 * then accept or decline. The admin can also reject, cancel (or answer a request to cancel) and delete them.
 */
export default function LeaveTab({ data, api, setData, toast, openChat }) {
  const { today } = data;
  const people = data.people || [];
  const roles = data.roles || {};
  const [filter, setFilter] = useState('current');
  const [picks, setPicks] = useState({}); // leave id -> { booking id: person id } (replacing by hand after approval)
  const [assign, setAssign] = useState({}); // leave id -> { request index: person id }
  const [busy, setBusy] = useState('');
  const [noteFor, setNoteFor] = useState(null); // { leave, action: reject | cancel | keep | delete }
  const [note, setNote] = useState('');
  const [bill, setBill] = useState(null);
  const personOf = (id) => people.find((p) => p.id === id);
  const askNote = (leave, action) => {
    setNote('');
    setNoteFor({ leave, action });
  };

  const needsYou = (l) => l.status === 'pending' || l.cancelRequest?.status === 'pending';
  const rank = (l) => (needsYou(l) ? (l.emergency ? 0 : 1) : l.status === 'assigned' ? 2 : 3);
  const leaves = [...(data.leaves || [])]
    .filter((l) => (filter === 'current' ? needsYou(l) || (live(l) && l.to >= today) : true))
    // What needs you first (emergencies at the very top), then those waiting for teammates, then by date.
    .sort((a, b) => rank(a) - rank(b) || a.from.localeCompare(b.from));
  // Every cash commission still with the person who collected it (past bookings too).
  const owed = (data.leaves || [])
    .filter(live)
    .flatMap((l) => cashShares(l).filter((sh) => !sh.paid).map((sh) => ({ ...sh, leave: l })))
    .sort((a, b) => a.leave.from.localeCompare(b.leave.from));
  const affected = (l) => data.bookings.filter((b) => active(b) && b.date >= l.from && b.date <= l.to && (b.assignees || []).some((a) => a.id === l.personId)).sort((a, b) => (a.date + a.slotTime).localeCompare(b.date + b.slotTime));
  // Who could take the place: does this sewa, not already on the booking — nearest first.
  const options = (b, leavePersonId) =>
    people
      .filter((p) => p.id !== leavePersonId && canDo(p, b) && !(b.assignees || []).some((a) => a.id === p.id))
      .map((p) => ({ p, km: distanceKm(b.location, p.location) }))
      .sort((x, y) => (x.km ?? 1e9) - (y.km ?? 1e9));
  const pickFor = (l, b) => picks[l.id]?.[b.id] ?? '';
  // Who does the type of kirtan asked for (any sewa in it); 1 = yes. Requests without a type count everyone.
  const doesKind = (p, x) => (!x.categoryId || (p.skills || []).some((k) => k.categoryId === x.categoryId) ? 1 : 0);
  // Who can be assigned to a request: anyone active (able to do the sewa, if it is one) — the role asked for first, then
  // those who do that type of kirtan, then nearest.
  const candidates = (l, x) => {
    const b = x.bookingId && data.bookings.find((y) => y.id === x.bookingId);
    const where = b?.location || l.location;
    return people
      .filter((p) => p.active && !p.pending && p.id !== l.personId && (!b || (canDo(p, b) && !(b.assignees || []).some((a) => a.id === p.id && a.id !== l.personId))))
      .map((p) => ({ p, km: distanceKm(where, p.location) }))
      .sort((m, n) => (m.p.role === x.role ? 0 : 1) - (n.p.role === x.role ? 0 : 1) || doesKind(n.p, x) - doesKind(m.p, x) || (m.km ?? 1e9) - (n.km ?? 1e9));
  };
  // Someone who declined isn't chosen again unless the admin picks them.
  const assignedFor = (l, i) => assign[l.id]?.[i] ?? (replyOf(l.picks[i]) === 'declined' ? '' : (l.picks[i].personId ?? ''));
  const open = (l, x) => asking(l) && replyOf(x) !== 'accepted'; // still to be (re)assigned
  const changedFor = (l) => Object.entries(assign[l.id] || {}).some(([i, id]) => id !== (l.picks[i]?.personId ?? ''));
  const requestWhat = (x) => {
    const b = x.bookingId && data.bookings.find((y) => y.id === x.bookingId);
    const when = `${format(fromKey(x.date), 'EEE d MMM')}, ${x.start ? rangeTo12(`${x.start} – ${x.end}`) : 'whole day'}`;
    const kind = x.categoryName || b?.categoryName;
    return `${kind ? `${kind} · ` : ''}${b ? `${b.serviceName} · ${when} · ${b.name}` : `${x.serviceName ? `${x.serviceName} · ` : ''}${when}`}`;
  };
  const billOf = (l) => ({
    leave: l,
    settings: data.settings,
    member: { name: personOf(l.personId)?.name || l.personName, phone: personOf(l.personId)?.phone },
    roles,
    nameOf: (id) => personOf(id)?.name || 'someone removed',
    whatOf: requestWhat,
  });

  const mergeBookings = (list) => setData((d) => ({ ...d, bookings: d.bookings.map((b) => list.find((x) => x.id === b.id) || b) }));
  const DONE = { approve: 'Sent — each person is asked to accept.', reject: 'Team booking rejected.', cancel: 'Team booking cancelled.', keep: 'Kept — they are told.', paid: 'Commission marked as received.', unpaid: 'Commission marked as not received.', settle: 'Commission received — their balance is cleared.', unsettle: 'Marked as not received.', delete: 'Team booking deleted.' };
  const decide = async (l, action, extra = {}) => {
    setBusy(l.id + action);
    try {
      let body = { action, ...extra };
      if (action === 'approve') {
        const idx = (l.picks || []).map((x, i) => (open(l, x) ? i : -1)).filter((i) => i >= 0);
        const missing = idx.find((i) => !assignedFor(l, i));
        if (missing !== undefined) throw new Error(`Choose who goes as ${roles[l.picks[missing].role] || 'the teammate'} for ${requestWhat(l.picks[missing])}.`);
        body = { ...body, assign: Object.fromEntries(idx.map((i) => [i, assignedFor(l, i)])) };
      }
      const res = action === 'delete' ? await api.deleteLeave(l.id) : await api.decideLeave(l.id, body);
      setData((d) => ({ ...d, leaves: res.leaves }));
      if (action === 'approve') setAssign((a) => ({ ...a, [l.id]: undefined }));
      toast(DONE[action]);
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
          <p>Team members ask for a Head Ragi, Side Ragi or Tabla to go in their place — with the type of kirtan — and offer the bhet; you keep the commission out of it. The role asked for is listed first, then those who do that type of kirtan. Assign a person to each request: each one is asked to accept, and only then is it booked and their sewa handed over. If someone declines, the request comes back here to choose someone else. Team bookings never block anyone — several can share the same dates.</p>
        </div>
      </div>
      {owed.length > 0 && (
        <div className="glass balance-card admin-owed">
          <span className="label">Commission to collect (cash) — {rupees(owed.reduce((t, o) => t + o.amount, 0))}</span>
          <p className="muted">These people were paid the whole bhet in cash and owe you the commission. They see it as a negative balance.</p>
          <ul>
            {owed.map((o) => (
              <li key={o.leave.id + o.id}>
                <span>
                  <strong>{personOf(o.id)?.name || 'someone removed'}</strong> · in place of {personOf(o.leave.personId)?.name || o.leave.personName} · {prettyDate(o.leave.from, 'd MMM')}
                </span>
                <strong className="balance-neg">−{rupees(o.amount)}</strong>
                <button className="btn btn-ghost btn-sm" onClick={() => decide(o.leave, 'settle', { personId: o.id })} disabled={!!busy}>
                  {busy === o.leave.id + 'settle' ? <Loader2 size={14} className="spin" /> : <CircleCheck size={14} />} Received
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
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
                    {(() => {
                      const m = moneyOf(l);
                      return (
                        <span className="commission-line">
                          They pay {rupees(m.total)} · your commission ({m.rate}%) <strong>{rupees(m.commission)}</strong> · teammates get {rupees(m.total - m.commission)}
                          {l.paymentMethod && ` · pays by ${l.paymentMethod === 'upi' ? 'UPI' : 'cash'}`}
                          {m.commission > 0 && l.paymentMethod !== 'cash' && <small> · {l.commissionPaid ? 'commission received ✓' : 'commission not received yet'}</small>}
                          {l.paymentMethod === 'cash' && <small> · paid in cash to the people who go — they owe you the commission</small>}
                        </span>
                      );
                    })()}
                    {l.location && (
                      <a className="muted" href={mapsLink(l.location)} target="_blank" rel="noreferrer">
                        <MapPin size={12} /> Teammates should go to: {l.location.label || 'map pin'}
                      </a>
                    )}
                    {l.note && <span className="muted">Your note: {l.note}</span>}
                    {l.cancelRequest?.status === 'rejected' && <span className="muted">Their request to cancel was turned down{l.cancelRequest.note ? `: ${l.cancelRequest.note}` : ''}.</span>}
                  </div>
                  <span className={`pay-tag ${l.status === 'approved' ? 'pay-paid' : asking(l) ? 'pay-submitted' : 'req-tag'}`}>{STATUS[l.status] || l.status}</span>
                  {openChat && (
                    <button className="icon-btn" onClick={() => openChat(`m:${l.personId}`)} aria-label="Chat" title="Chat">
                      <MessagesSquare size={16} />
                    </button>
                  )}
                </div>

                {l.cancelRequest?.status === 'pending' && (
                  <div className="leave-cancel-ask">
                    <span>
                      <strong>They ask to cancel this team booking.</strong> “{l.cancelRequest.reason}” · {format(new Date(l.cancelRequest.at), 'd MMM, h:mm a')}
                    </span>
                    <div className="ab-actions">
                      <button className="btn btn-danger btn-sm" onClick={() => askNote(l, 'cancel')} disabled={!!busy}>
                        <Undo2 size={15} /> Cancel it
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => askNote(l, 'keep')} disabled={!!busy}>
                        <Check size={15} /> Keep it
                      </button>
                    </div>
                  </div>
                )}

                {cashShares(l).length > 0 && (
                  <div className="leave-duties">
                    <p className="label">Commission they collected in cash</p>
                    {cashShares(l).map((sh) => (
                      <div key={sh.id} className="leave-duty">
                        <span>
                          <strong>{personOf(sh.id)?.name || 'someone removed'}</strong> owes{' '}
                          <strong className={sh.paid ? '' : 'balance-neg'}>{rupees(sh.amount)}</strong>
                          {sh.paid && ' · received ✓'}
                        </span>
                        <button className="btn btn-ghost btn-sm" onClick={() => decide(l, sh.paid ? 'unsettle' : 'settle', { personId: sh.id })} disabled={!!busy}>
                          {sh.paid ? <Undo2 size={14} /> : <CircleCheck size={14} />} {sh.paid ? 'Not received' : 'Received'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {(l.picks || []).length > 0 && (
                  <div className="leave-duties">
                    <p className="label">{l.status === 'pending' ? 'What they need — assign a person to each; they are asked to accept' : 'Who goes'}</p>
                    {l.picks.map((x, i) => {
                      const editable = open(l, x);
                      const reply = replyOf(x);
                      const opts = editable ? candidates(l, x) : [];
                      const match = opts.filter((o) => o.p.role === x.role);
                      const others = opts.filter((o) => o.p.role !== x.role);
                      const option = ({ p: o, km }) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                          {o.role ? ` — ${roles[o.role]}` : ''}
                          {x.categoryId && !doesKind(o, x) ? ` · not ${x.categoryName}` : ''}
                          {km != null ? ` · ${kmText(km)}` : ''}
                        </option>
                      );
                      return (
                        <div key={i} className="leave-duty">
                          <span>
                            <strong>{roles[x.role] || 'Teammate'}</strong> · ₹{x.pay}
                            {cut(l, x) > 0 && ` (they get ₹${netOf(l, x)})`} · {requestWhat(x)}
                            {x.personId && reply && (
                              <small className={`reply-tag r-${reply}`}>
                                {personOf(x.personId)?.name || 'someone removed'}: {REPLY[reply]}
                                {x.replyNote ? ` — “${x.replyNote}”` : ''}
                              </small>
                            )}
                          </span>
                          {editable ? (
                            <select className="input" value={assignedFor(l, i)} onChange={(e) => setAssign((a) => ({ ...a, [l.id]: { ...a[l.id], [i]: e.target.value } }))}>
                              <option value="">{opts.length ? `Choose the ${roles[x.role] || 'person'}…` : 'Nobody is free for this'}</option>
                              {match.length > 0 && <optgroup label={roles[x.role]}>{match.map(option)}</optgroup>}
                              {others.length > 0 && <optgroup label="Other roles">{others.map(option)}</optgroup>}
                            </select>
                          ) : (
                            <span className="muted">{x.personId && reply !== 'declined' ? `→ ${personOf(x.personId)?.name || 'someone removed'}` : '—'}</span>
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
                  {(l.status === 'pending' || (l.status === 'assigned' && changedFor(l))) && (
                    <button className="btn btn-primary btn-sm" onClick={() => decide(l, 'approve')} disabled={!!busy}>
                      {busy === l.id + 'approve' ? <Loader2 size={15} className="spin" /> : <Send size={15} />} {l.status === 'pending' ? 'Assign & ask them' : 'Save & ask them'}
                    </button>
                  )}
                  {asking(l) && (
                    <button className="btn btn-ghost btn-sm danger-text" onClick={() => askNote(l, 'reject')} disabled={!!busy}>
                      <Ban size={15} /> Reject
                    </button>
                  )}
                  {live(l) && l.cancelRequest?.status !== 'pending' && (
                    <button className="btn btn-ghost btn-sm" onClick={() => askNote(l, 'cancel')} disabled={!!busy}>
                      <Undo2 size={15} /> Cancel
                    </button>
                  )}
                  {moneyOf(l).commission > 0 && l.paymentMethod !== 'cash' && (l.status === 'approved' || l.commissionPaid) && (
                    <button className="btn btn-ghost btn-sm" onClick={() => decide(l, l.commissionPaid ? 'unpaid' : 'paid')} disabled={!!busy}>
                      {busy === l.id + 'paid' || busy === l.id + 'unpaid' ? <Loader2 size={15} className="spin" /> : <CircleCheck size={15} />} {l.commissionPaid ? 'Commission not received' : 'Commission received'}
                    </button>
                  )}
                  <button className="btn btn-ghost btn-sm" onClick={() => setBill(billOf(l))}>
                    <FileText size={15} /> Bill
                  </button>
                  <button className="icon-btn danger-text" onClick={() => askNote(l, 'delete')} disabled={!!busy} aria-label="Delete" title="Delete">
                    <Trash2 size={16} />
                  </button>
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>

      <Modal open={!!noteFor} onClose={() => setNoteFor(null)} title={noteFor ? NOTE_FOR[noteFor.action].title : ''} subtitle={noteFor ? NOTE_FOR[noteFor.action].sub : ''}>
        {noteFor && (
          <form
            className="cancel-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await decide(noteFor.leave, noteFor.action, { note })) setNoteFor(null);
            }}
          >
            {noteFor.action !== 'delete' && (
              <label className="field">
                <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder=" " rows={3} />
                <span>Message (optional)</span>
              </label>
            )}
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setNoteFor(null)}>
                Back
              </button>
              <button className={`btn ${noteFor.action === 'keep' ? 'btn-primary' : 'btn-danger'}`} disabled={!!busy}>
                {busy ? <Loader2 size={17} className="spin" /> : noteFor.action === 'delete' ? <Trash2 size={17} /> : noteFor.action === 'keep' ? <Check size={17} /> : <Ban size={17} />} {NOTE_FOR[noteFor.action].button}
              </button>
            </div>
          </form>
        )}
      </Modal>
      <TeamBillModal bill={bill} onClose={() => setBill(null)} />
    </div>
  );
}
