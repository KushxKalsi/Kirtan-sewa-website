import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { format } from 'date-fns';
import { Ban, Banknote, BellRing, Check, Lock, LockOpen, UserRound, Users, ChevronDown, CircleCheck, FileText, Loader2, Mail, MapPin, MessageCircle, Pencil, Phone, RotateCcw, Search, Smartphone, Trash2, Undo2, Wallet } from 'lucide-react';
import Modal from '../components/Modal';
import { BillModal } from '../components/Bill';
import { PAYMENT_LABEL, rupees } from '../lib/money';
import { fromKey, prettyDate, rangeTo12 } from '../lib/date';
import { ease } from '../lib/motion';

const FILTERS = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'requests', label: 'Cancel requests' },
  { id: 'unassigned', label: 'Not assigned' },
  { id: 'pending', label: 'Pending' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: 'all', label: 'All' },
];

const active = (b) => b.status === 'pending' || b.status === 'confirmed';
const hasRequest = (b) => b.cancelRequest?.status === 'pending' && active(b);
// Same rule as the server: active, with this sewa in this category among their skills.
const canDo = (p, b) => p.active && (p.skills || []).some((k) => k.serviceId === b.serviceId && (!b.categoryId || k.categoryId === b.categoryId));
const rangeOf = (b) => (b.slotTime || '').split('–').map((t) => t.trim());
const overlap = (a, b) => {
  const [s1, e1] = rangeOf(a);
  const [s2, e2] = rangeOf(b);
  return a.date === b.date && s1 < e2 && s2 < e1;
};
const PAY_TEXT = { unpaid: 'Unpaid', submitted: 'To verify', paid: 'Paid' };

export default function BookingsTab({ data, api, patch, toast }) {
  // A tapped admin notification opens /admin?q=<booking ID or group> — show that booking straight away.
  const linked = new URLSearchParams(window.location.search).get('q') || '';
  const [filter, setFilter] = useState(linked ? 'all' : 'upcoming');
  const [query, setQuery] = useState(linked);
  const [openId, setOpenId] = useState(null);
  const [busy, setBusy] = useState('');
  const [cancelFor, setCancelFor] = useState(null);
  const [reason, setReason] = useState('');
  const [deleteFor, setDeleteFor] = useState(null);
  const [picked, setPicked] = useState(() => new Set()); // bookings ticked for bulk delete
  const [bulkOpen, setBulkOpen] = useState(false);
  const [confirmFor, setConfirmFor] = useState(null);
  const [amount, setAmount] = useState('');
  const [payFor, setPayFor] = useState(null);
  const [payForm, setPayForm] = useState({ method: 'upi', amount: '', utr: '', note: '' });
  const [billFor, setBillFor] = useState(null);
  const [rejectFor, setRejectFor] = useState(null);
  const [rejectNote, setRejectNote] = useState('');
  const { bookings, today, settings } = data;
  const people = data.people || [];
  const peopleIds = new Set(people.map((p) => p.id));
  const setAssignees = async (b, personIds) => {
    setBusy(b.id + 'assign');
    try {
      const { booking } = await api.assign(b.id, personIds);
      replace(booking);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy('');
    }
  };
  const notifyOn = (phone) => (data.notifyPhones || []).includes(String(phone).replace(/\D/g, '').slice(-10));

  const stats = useMemo(
    () => [
      { label: 'Upcoming', value: bookings.filter((b) => active(b) && b.date >= today).length, tone: 'gold' },
      { label: 'Awaiting confirmation', value: bookings.filter((b) => b.status === 'pending' && b.date >= today).length, tone: 'warn' },
      { label: 'Confirmed', value: bookings.filter((b) => b.status === 'confirmed').length, tone: 'success' },
      { label: 'Cancelled', value: bookings.filter((b) => b.status === 'cancelled').length, tone: 'danger' },
      { label: 'Cancel requests', value: bookings.filter(hasRequest).length, tone: 'danger' },
      { label: 'Payments to verify', value: bookings.filter((b) => b.paymentStatus === 'submitted' && b.status !== 'cancelled').length, tone: 'warn' },
      { label: 'Collected', value: rupees(bookings.filter((b) => b.paymentStatus === 'paid').reduce((sum, b) => sum + (b.amount || 0), 0)), tone: 'success', wide: true },
    ],
    [bookings, today],
  );

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = bookings.filter((b) => {
      if (filter === 'upcoming') return active(b) && b.date >= today;
      if (filter === 'requests') return hasRequest(b);
      if (filter === 'unassigned') return active(b) && b.date >= today && !(b.assignees || []).length;
      if (filter === 'all') return true;
      return b.status === filter;
    });
    if (q) rows = rows.filter((b) => [b.name, b.phone, b.ref, b.serviceName, b.categoryName, b.address, b.groupId, (b.assignees || []).map((a) => a.name).join(' ')].some((v) => v?.toLowerCase().includes(q)));
    const asc = filter === 'upcoming' || filter === 'pending' || filter === 'confirmed';
    return [...rows].sort((a, b) => {
      const ka = a.date + a.slotTime;
      const kb = b.date + b.slotTime;
      return asc ? ka.localeCompare(kb) : kb.localeCompare(ka) || b.createdAt.localeCompare(a.createdAt);
    });
  }, [bookings, filter, query, today]);

  const groupSize = useMemo(() => {
    const count = {};
    for (const b of bookings) if (b.groupId) count[b.groupId] = (count[b.groupId] || 0) + 1;
    return count;
  }, [bookings]);

  // Bookings never block each other; just show which ones share a time so you can decide.
  const clashes = useMemo(() => {
    const map = {};
    const live = bookings.filter((b) => active(b) || b.status === 'completed');
    for (const b of live) {
      if (!active(b)) continue;
      const others = live.filter((o) => o.id !== b.id && overlap(b, o));
      if (others.length) map[b.id] = others;
    }
    return map;
  }, [bookings]);

  // Blocking a time is the only thing that stops customers requesting it.
  const blockedTimes = data.blockedTimes || [];
  const blockOf = (b) => {
    const [start, end] = rangeOf(b);
    return blockedTimes.find((t) => t.date === b.date && t.start === start && t.end === end);
  };
  const toggleBlock = async (b) => {
    const existing = blockOf(b);
    setBusy(b.id + 'block');
    try {
      if (existing) {
        const res = await api.unblockTime(existing.id);
        patch({ blockedTimes: res.blockedTimes });
        toast('Time unblocked — customers can request it again.');
      } else {
        const [start, end] = rangeOf(b);
        const res = await api.blockTimes({ date: b.date, start, end, label: b.slotId === 'custom' ? '' : b.slotLabel, note: `${b.name} · ${b.ref}` });
        patch({ blockedTimes: res.blockedTimes });
        toast('Time blocked — it now shows as not available.');
      }
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy('');
    }
  };

  const replace = (booking) => patch({ bookings: bookings.map((b) => (b.id === booking.id ? booking : b)) });

  const setStatus = async (b, status, why, amt) => {
    setBusy(b.id + status);
    try {
      const { booking } = await api.setStatus(b.id, status, why, amt);
      replace(booking);
      toast(`Booking ${booking.ref} marked ${status}.`);
      return true;
    } catch (e) {
      toast(e.message, 'error');
      return false;
    } finally {
      setBusy('');
    }
  };

  const openConfirm = (b) => {
    setAmount(b.amount ? String(b.amount) : '');
    setConfirmFor(b);
  };
  const submitConfirm = async (e) => {
    e.preventDefault();
    if (await setStatus(confirmFor, 'confirmed', undefined, amount)) setConfirmFor(null);
  };

  const openPayment = (b) => {
    setPayForm({ method: b.paymentStatus === 'submitted' || b.utr ? 'upi' : b.paymentMethod || 'cash', amount: String(b.amount || ''), utr: b.utr || '', note: '' });
    setPayFor(b);
  };
  const savePayment = async (b, payment) => {
    setBusy(b.id + 'pay');
    try {
      const { booking } = await api.setPayment(b.id, payment);
      replace(booking);
      toast(payment.status === 'paid' ? `Payment of ${rupees(booking.amount)} recorded.` : 'Marked as unpaid.');
      return true;
    } catch (e) {
      toast(e.message, 'error');
      return false;
    } finally {
      setBusy('');
    }
  };
  const submitPayment = async (e) => {
    e.preventDefault();
    if (await savePayment(payFor, { status: 'paid', ...payForm })) setPayFor(null);
  };

  const billMessage = (b) => {
    const lines = [
      'Waheguru Ji Ka Khalsa, Waheguru Ji Ki Fateh 🙏',
      '',
      `Your booking for ${b.serviceName} on ${prettyDate(b.date, 'EEE, d MMM yyyy')} (${b.slotLabel}) is confirmed.`,
      `Bill No: ${b.billNo}`,
      `Amount: ${rupees(b.amount)}`,
      settings.upiEnabled && settings.upiId ? `Pay by UPI to: ${settings.upiId}` : '',
      settings.cashEnabled ? 'Cash on the day is also fine.' : '',
      '',
      `View your bill and pay: ${window.location.origin}/manage?phone=${encodeURIComponent(b.phone)}`,
    ];
    return encodeURIComponent(lines.filter((l, i) => l || lines[i - 1]).join('\n'));
  };

  const resolveRequest = async (b, action, note) => {
    setBusy(b.id + action);
    try {
      const { booking } = await api.resolveCancel(b.id, action, note);
      replace(booking);
      toast(action === 'approve' ? `Booking ${booking.ref} cancelled — the slot is free again.` : 'Request rejected. The booking stays active.');
      return true;
    } catch (e) {
      toast(e.message, 'error');
      return false;
    } finally {
      setBusy('');
    }
  };
  const submitReject = async (e) => {
    e.preventDefault();
    if (await resolveRequest(rejectFor, 'reject', rejectNote)) setRejectFor(null);
  };

  const confirmCancel = async (e) => {
    e.preventDefault();
    if (await setStatus(cancelFor, 'cancelled', reason)) setCancelFor(null);
  };

  // Ticks only apply to what is on screen, so start fresh when the filter or search changes.
  useEffect(() => setPicked(new Set()), [filter, query]);
  const togglePick = (id) =>
    setPicked((set) => {
      const next = new Set(set);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const allShownPicked = list.length > 0 && list.every((b) => picked.has(b.id));
  const toggleAllShown = () => setPicked(allShownPicked ? new Set() : new Set(list.map((b) => b.id)));
  const pickedBookings = bookings.filter((b) => picked.has(b.id));

  const confirmBulkDelete = async () => {
    setBusy('bulk');
    try {
      const { deleted } = await api.deleteBookings([...picked]);
      patch({ bookings: bookings.filter((b) => !picked.has(b.id)) });
      toast(`${deleted} booking${deleted === 1 ? '' : 's'} deleted.`);
      setPicked(new Set());
      setBulkOpen(false);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy('');
    }
  };

  const confirmDelete = async () => {
    setBusy('delete');
    try {
      await api.deleteBooking(deleteFor.id);
      patch({ bookings: bookings.filter((b) => b.id !== deleteFor.id) });
      toast('Booking deleted.');
      setDeleteFor(null);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy('');
    }
  };

  const wa = (phone) => {
    const d = phone.replace(/\D/g, '');
    return `https://wa.me/${d.length === 10 ? '91' + d : d}`;
  };

  return (
    <div className="admin-section">
      <div className="admin-stats">
        {stats.map((s, i) => (
          <motion.div key={s.label} className={`admin-stat glass tone-${s.tone} ${s.wide ? 'wide' : ''}`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06, duration: 0.5, ease }}>
            <strong>{s.value}</strong>
            <span>{s.label}</span>
          </motion.div>
        ))}
      </div>

      <div className="admin-toolbar">
        <div className="filter-pills">
          {FILTERS.map((f) => (
            <button key={f.id} className={filter === f.id ? 'active' : ''} onClick={() => setFilter(f.id)}>
              {filter === f.id && <motion.span layoutId="filter-pill" className="pill-bg" transition={{ type: 'spring', stiffness: 400, damping: 34 }} />}
              <span>{f.label}</span>
            </button>
          ))}
        </div>
        <label className="search">
          <Search size={16} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, phone, ID…" />
        </label>
      </div>

      {list.length > 0 && (
        <label className="select-all">
          <input type="checkbox" checked={allShownPicked} onChange={toggleAllShown} />
          <span className="tick" />
          Select all shown ({list.length})
        </label>
      )}

      {list.length === 0 ? (
        <div className="admin-empty glass">No bookings here yet.</div>
      ) : (
        <motion.ul className="admin-bookings" layout>
          <AnimatePresence initial={false}>
            {list.map((b) => {
              const open = openId === b.id;
              const past = b.date < today;
              return (
                <motion.li
                  key={b.id}
                  layout
                  className={`admin-booking glass st-${b.status}`}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -30, transition: { duration: 0.25 } }}
                  transition={{ duration: 0.4, ease }}
                >
                  <div className="ab-top">
                  <label className="ab-check" title="Select for bulk delete">
                    <input type="checkbox" checked={picked.has(b.id)} onChange={() => togglePick(b.id)} aria-label={`Select booking ${b.ref}`} />
                    <span className="tick" />
                  </label>
                  <button className="ab-row" onClick={() => setOpenId(open ? null : b.id)} aria-expanded={open}>
                    <span className="ab-date">
                      <strong>{format(fromKey(b.date), 'd')}</strong>
                      <span>{format(fromKey(b.date), 'MMM yy')}</span>
                    </span>
                    <span className="ab-main">
                      <strong>
                        {b.serviceName}
                        {b.categoryName && <small className="ab-cat"> · {b.categoryName}</small>}
                      </strong>
                      <span>
                        {b.slotLabel} · {rangeTo12(b.slotTime)} · {format(fromKey(b.date), 'EEE')}
                      </span>
                      <span className="ab-who">
                        {b.name} · <code>{b.ref}</code>
                        {active(b) && (
                          <span className={`pay-tag ${(b.assignees || []).length ? 'assign-tag' : 'unassigned-tag'}`}>
                            {(b.assignees || []).length ? `👤 ${b.assignees.map((a) => a.name).join(', ')}` : 'Not assigned'}
                          </span>
                        )}
                        {hasRequest(b) && <span className="pay-tag req-tag">Cancel requested</span>}
                        {clashes[b.id] && (
                          <span className="pay-tag clash-tag" title={clashes[b.id].map((o) => `${o.name} (${o.ref})`).join(', ')}>
                            {clashes[b.id].length} other booking{clashes[b.id].length > 1 ? 's' : ''} at this time
                          </span>
                        )}
                        {active(b) && blockOf(b) && (
                          <span className="pay-tag blocked-tag">
                            <Lock size={11} /> Time blocked
                          </span>
                        )}
                        {b.groupId && groupSize[b.groupId] > 1 && (
                          <span
                            className="pay-tag group-tag"
                            role="button"
                            title="Show all bookings made together"
                            onClick={(e) => {
                              e.stopPropagation();
                              setFilter('all');
                              setQuery(b.groupId);
                            }}
                          >
                            {groupSize[b.groupId]} booked together
                          </span>
                        )}
                        {b.amount > 0 && b.status !== 'cancelled' && (
                          <span className={`pay-tag pay-${b.paymentStatus || 'unpaid'}`}>
                            {rupees(b.amount)} · {PAY_TEXT[b.paymentStatus || 'unpaid']}
                          </span>
                        )}
                      </span>
                    </span>
                    <span className={`badge badge-${b.status}`}>{b.status}</span>
                    <motion.span className="ab-chevron" animate={{ rotate: open ? 180 : 0 }}>
                      <ChevronDown size={18} />
                    </motion.span>
                  </button>
                  </div>

                  <AnimatePresence initial={false}>
                    {open && (
                      <motion.div className="ab-detail" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.35, ease }}>
                        <div className="ab-detail-inner">
                          <div className="ab-contact">
                            <a href={`tel:${b.phone}`} className="chip">
                              <Phone size={13} /> {b.phone}
                            </a>
                            <a href={wa(b.phone)} target="_blank" rel="noreferrer" className="chip">
                              <MessageCircle size={13} /> WhatsApp
                            </a>
                            {b.email && (
                              <a href={`mailto:${b.email}`} className="chip">
                                <Mail size={13} /> {b.email}
                              </a>
                            )}
                            {b.paymentMethod && b.paymentStatus !== 'paid' && (
                              <span className="chip">
                                {b.paymentMethod === 'upi' ? <Smartphone size={13} /> : <Banknote size={13} />} Wants to pay by {PAYMENT_LABEL[b.paymentMethod]}
                              </span>
                            )}
                            {notifyOn(b.phone) && (
                              <span className="chip" title="This customer gets a phone notification when you confirm, bill, mark paid or cancel">
                                <BellRing size={13} /> Notifications on
                              </span>
                            )}
                          </div>
                          <p className="ab-line">
                            <MapPin size={15} /> {b.address}
                          </p>
                          {b.notes && <p className="ab-notes">“{b.notes}”</p>}
                          {b.status !== 'cancelled' && (() => {
                            const assignedIds = (b.assignees || []).map((a) => a.id);
                            const eligible = people.filter((p) => canDo(p, b));
                            const eligibleIds = new Set(eligible.map((p) => p.id));
                            const others = (b.assignees || []).filter((a) => !eligibleIds.has(a.id)); // assigned earlier, no longer matching
                            const keep = (ids) => ids.filter((id) => peopleIds.has(id));
                            return (
                              <div className="assign-box">
                                <div className="assign-head">
                                  <Users size={15} /> <strong>Assigned to</strong>
                                  <span className="muted">
                                    {b.serviceName}
                                    {b.categoryName && ` · ${b.categoryName}`}
                                  </span>
                                  {busy === b.id + 'assign' && <Loader2 size={14} className="spin" />}
                                </div>
                                <div className="slot-checks">
                                  {others.map((a) => (
                                    <button type="button" key={a.id} className="check-pill active" title="Assigned earlier; no longer matches this sewa. Tap to remove." onClick={() => setAssignees(b, keep(assignedIds.filter((x) => x !== a.id)))} disabled={!!busy}>
                                      <UserRound size={13} /> {a.name} ✕
                                    </button>
                                  ))}
                                  {eligible.map((p) => {
                                    const on = assignedIds.includes(p.id);
                                    return (
                                      <button
                                        type="button"
                                        key={p.id}
                                        className={`check-pill ${on ? 'active' : ''}`}
                                        onClick={() => setAssignees(b, keep(on ? assignedIds.filter((x) => x !== p.id) : [...assignedIds, p.id]))}
                                        disabled={!!busy}
                                      >
                                        {on ? <Check size={13} /> : <UserRound size={13} />} {p.name}
                                        {p.address && <small className="pill-address">{p.address}</small>}
                                      </button>
                                    );
                                  })}
                                </div>
                                {eligible.length > 0 && (
                                  <p className="muted assign-hint">People you tick are notified (if they turned notifications on), and reminded on the day and 2 hours before.</p>
                                )}
                                {!eligible.length && (
                                  <p className="muted">
                                    Nobody in your team does {b.serviceName}
                                    {b.categoryName && ` in ${b.categoryName}`} yet — add it to someone under <strong>Team</strong>.
                                  </p>
                                )}
                              </div>
                            );
                          })()}
                          {hasRequest(b) && (
                            <div className="request-note for-admin">
                              <div>
                                <strong>Customer asked to cancel · {format(new Date(b.cancelRequest.at), 'd MMM, h:mm a')}</strong>
                                <p>Reason: {b.cancelRequest.reason}</p>
                                <div className="ab-actions">
                                  <button className="btn btn-danger btn-sm" onClick={() => resolveRequest(b, 'approve')} disabled={!!busy}>
                                    {busy === b.id + 'approve' ? <Loader2 size={15} className="spin" /> : <Check size={15} />} Approve cancellation
                                  </button>
                                  <button
                                    className="btn btn-ghost btn-sm"
                                    onClick={() => {
                                      setRejectNote('');
                                      setRejectFor(b);
                                    }}
                                    disabled={!!busy}
                                  >
                                    <Undo2 size={15} /> Reject
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                          {b.cancelRequest?.status === 'rejected' && active(b) && <p className="ab-meta">Cancellation request was rejected{b.cancelRequest.note && `: “${b.cancelRequest.note}”`}</p>}
                          {b.status === 'cancelled' && (
                            <div className="cancel-note">
                              <strong>
                                Cancelled by {b.cancelledBy === 'admin' ? 'admin' : 'customer'}
                                {b.cancelledAt && ` · ${format(new Date(b.cancelledAt), 'd MMM yyyy, h:mm a')}`}
                              </strong>
                              <p>Reason: {b.cancelReason}</p>
                            </div>
                          )}
                          {b.amount > 0 && b.status !== 'cancelled' && (
                            <div className={`ab-pay pay-${b.paymentStatus || 'unpaid'}`}>
                              <div className="ab-pay-top">
                                <span>
                                  <strong>{rupees(b.amount)}</strong> · Bill {b.billNo}
                                </span>
                                <span className={`pay-tag pay-${b.paymentStatus || 'unpaid'}`}>{PAY_TEXT[b.paymentStatus || 'unpaid']}</span>
                              </div>
                              {b.paymentStatus === 'submitted' && <p>Customer says they paid by UPI · UTR <code>{b.utr}</code>. Check your bank/UPI app, then verify.</p>}
                              {b.paymentStatus === 'paid' && (
                                <p>
                                  Received via {PAYMENT_LABEL[b.paymentMethod]}
                                  {b.paidAt && ` on ${format(new Date(b.paidAt), 'd MMM yyyy')}`}
                                  {b.utr && ` · UTR ${b.utr}`}
                                  {b.paymentNote && ` · ${b.paymentNote}`}
                                </p>
                              )}
                              <div className="ab-actions">
                                {b.paymentStatus === 'submitted' && (
                                  <button className="btn btn-primary btn-sm" onClick={() => savePayment(b, { status: 'paid', method: 'upi', amount: b.amount, utr: b.utr })} disabled={!!busy}>
                                    {busy === b.id + 'pay' ? <Loader2 size={15} className="spin" /> : <Check size={15} />} Verify &amp; mark paid
                                  </button>
                                )}
                                {b.paymentStatus !== 'paid' ? (
                                  <button className="btn btn-ghost btn-sm" onClick={() => openPayment(b)} disabled={!!busy}>
                                    <Wallet size={15} /> Record payment
                                  </button>
                                ) : (
                                  <button className="btn btn-ghost btn-sm" onClick={() => savePayment(b, { status: 'unpaid' })} disabled={!!busy}>
                                    <Undo2 size={15} /> Mark unpaid
                                  </button>
                                )}
                                <button className="btn btn-ghost btn-sm" onClick={() => setBillFor(b)}>
                                  <FileText size={15} /> View bill
                                </button>
                                <a className="btn btn-ghost btn-sm" href={`${wa(b.phone)}?text=${billMessage(b)}`} target="_blank" rel="noreferrer">
                                  <MessageCircle size={15} /> Send bill
                                </a>
                                {b.status === 'confirmed' && b.paymentStatus !== 'paid' && (
                                  <button className="btn btn-ghost btn-sm" onClick={() => openConfirm(b)} disabled={!!busy}>
                                    <Pencil size={15} /> Edit amount
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                          {clashes[b.id] && (
                            <div className="clash-box">
                              <p>
                                <strong>Also at this time:</strong> {clashes[b.id].map((o) => `${o.name} (${o.ref}, ${rangeTo12(o.slotTime)}, ${o.status})`).join(', ')}.
                              </p>
                            </div>
                          )}
                          <p className="ab-meta">Requested {format(new Date(b.createdAt), 'd MMM yyyy, h:mm a')}</p>

                          <div className="ab-actions">
                            {b.status === 'pending' && (
                              <button className="btn btn-primary btn-sm" onClick={() => openConfirm(b)} disabled={!!busy}>
                                <Check size={15} /> Confirm &amp; create bill
                              </button>
                            )}
                            {active(b) && b.date >= today && (
                              <button className="btn btn-ghost btn-sm" onClick={() => toggleBlock(b)} disabled={!!busy} title="Blocked times show as not available to customers">
                                {busy === b.id + 'block' ? <Loader2 size={15} className="spin" /> : blockOf(b) ? <LockOpen size={15} /> : <Lock size={15} />}
                                {blockOf(b) ? 'Unblock this time' : 'Block this time on the calendar'}
                              </button>
                            )}
                            {b.status === 'confirmed' && !b.amount && (
                              <button className="btn btn-primary btn-sm" onClick={() => openConfirm(b)} disabled={!!busy}>
                                <FileText size={15} /> Create bill
                              </button>
                            )}
                            {b.status === 'confirmed' && (
                              <button className="btn btn-ghost btn-sm" onClick={() => setStatus(b, 'completed')} disabled={!!busy}>
                                <CircleCheck size={15} /> Mark completed
                              </button>
                            )}
                            {active(b) && (
                              <button
                                className="btn btn-ghost btn-sm danger-text"
                                onClick={() => {
                                  setReason('');
                                  setCancelFor(b);
                                }}
                                disabled={!!busy}
                              >
                                <Ban size={15} /> Cancel
                              </button>
                            )}
                            {b.status === 'cancelled' && !past && (
                              <button className="btn btn-ghost btn-sm" onClick={() => setStatus(b, 'pending')} disabled={!!busy}>
                                <RotateCcw size={15} /> Restore
                              </button>
                            )}
                            <button className="btn btn-ghost btn-sm danger-text" onClick={() => setDeleteFor(b)} disabled={!!busy}>
                              <Trash2 size={15} /> Delete
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </motion.ul>
      )}

      <Modal open={!!cancelFor} onClose={() => setCancelFor(null)} title="Cancel this booking" subtitle={cancelFor && `${cancelFor.serviceName} for ${cancelFor.name} on ${format(fromKey(cancelFor.date), 'd MMM yyyy')}. The reason is shown to the customer.`}>
        <form onSubmit={confirmCancel} className="cancel-form">
          <label className="field">
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder=" " rows={3} required minLength={3} autoFocus />
            <span>Reason for cancelling *</span>
          </label>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setCancelFor(null)}>
              Back
            </button>
            <button className="btn btn-danger" disabled={!!busy}>
              {busy ? <Loader2 size={17} className="spin" /> : <Ban size={17} />} Cancel booking
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!confirmFor}
        onClose={() => setConfirmFor(null)}
        title={confirmFor?.status === 'confirmed' ? 'Edit bill amount' : 'Confirm & create bill'}
        subtitle={confirmFor && `${confirmFor.serviceName} for ${confirmFor.name} on ${format(fromKey(confirmFor.date), 'd MMM yyyy')}. The customer will see the bill and can pay by ${[settings.upiEnabled && settings.upiId && 'UPI', settings.cashEnabled && 'cash'].filter(Boolean).join(' or ') || '—'}.`}
      >
        <form onSubmit={submitConfirm} className="cancel-form">
          <label className="field amount-field">
            <input type="number" inputMode="numeric" min="1" step="1" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder=" " required autoFocus />
            <span>Amount (₹) *</span>
          </label>
          {!(settings.upiEnabled && settings.upiId) && !settings.cashEnabled && <p className="fine-print">Tip: turn on UPI or Cash in Site settings → Payments so customers know how to pay.</p>}
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setConfirmFor(null)}>
              Back
            </button>
            <button className="btn btn-primary" disabled={!!busy}>
              {busy ? <Loader2 size={17} className="spin" /> : <FileText size={17} />} {confirmFor?.status === 'confirmed' ? 'Update bill' : 'Confirm & create bill'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={!!payFor} onClose={() => setPayFor(null)} title="Record payment" subtitle={payFor && `Bill ${payFor.billNo} · ${payFor.name}`}>
        <form onSubmit={submitPayment} className="cancel-form">
          <div className="pay-options" role="radiogroup">
            {[
              { id: 'upi', label: 'UPI', icon: Smartphone },
              { id: 'cash', label: 'Cash', icon: Banknote },
            ].map((m) => (
              <button type="button" role="radio" aria-checked={payForm.method === m.id} key={m.id} className={`pay-option ${payForm.method === m.id ? 'active' : ''}`} onClick={() => setPayForm((f) => ({ ...f, method: m.id }))}>
                {payForm.method === m.id && <motion.span layoutId="admin-pay-option" className="pay-option-bg" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                <m.icon size={20} />
                <span>
                  <strong>{m.label}</strong>
                </span>
              </button>
            ))}
          </div>
          <label className="field amount-field">
            <input type="number" inputMode="numeric" min="1" value={payForm.amount} onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value }))} placeholder=" " required />
            <span>Amount received (₹) *</span>
          </label>
          {payForm.method === 'upi' && (
            <label className="field">
              <input value={payForm.utr} onChange={(e) => setPayForm((f) => ({ ...f, utr: e.target.value }))} placeholder=" " />
              <span>UTR / transaction ID (optional)</span>
            </label>
          )}
          <label className="field">
            <input value={payForm.note} onChange={(e) => setPayForm((f) => ({ ...f, note: e.target.value }))} placeholder=" " />
            <span>Note (optional)</span>
          </label>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setPayFor(null)}>
              Back
            </button>
            <button className="btn btn-primary" disabled={!!busy}>
              {busy ? <Loader2 size={17} className="spin" /> : <Check size={17} />} Save payment
            </button>
          </div>
        </form>
      </Modal>

      <BillModal booking={billFor} settings={settings} onClose={() => setBillFor(null)} />

      <Modal open={!!rejectFor} onClose={() => setRejectFor(null)} title="Reject cancellation request" subtitle="The booking stays active. You can add a message the customer will see.">
        <form onSubmit={submitReject} className="cancel-form">
          <label className="field">
            <textarea value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} placeholder=" " rows={3} />
            <span>Message to customer (optional)</span>
          </label>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setRejectFor(null)}>
              Back
            </button>
            <button className="btn btn-primary" disabled={!!busy}>
              {busy ? <Loader2 size={17} className="spin" /> : <Undo2 size={17} />} Reject request
            </button>
          </div>
        </form>
      </Modal>

      <AnimatePresence>
        {picked.size > 0 && (
          <motion.div className="bulk-bar glass" initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 32 }}>
            <strong>{picked.size} selected</strong>
            <button className="btn btn-ghost btn-sm" onClick={() => setPicked(new Set())}>
              Clear
            </button>
            <button className="btn btn-danger btn-sm" onClick={() => setBulkOpen(true)}>
              <Trash2 size={15} /> Delete selected
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <Modal
        open={bulkOpen}
        onClose={() => busy !== 'bulk' && setBulkOpen(false)}
        title={`Delete ${picked.size} booking${picked.size === 1 ? '' : 's'}?`}
        subtitle="These records are removed permanently, including their bills and payments. This cannot be undone."
      >
        <ul className="bulk-list">
          {pickedBookings.slice(0, 8).map((b) => (
            <li key={b.id}>
              <code>{b.ref}</code> {b.name} · {b.serviceName} · {format(fromKey(b.date), 'd MMM')}
            </li>
          ))}
          {pickedBookings.length > 8 && <li className="muted">…and {pickedBookings.length - 8} more</li>}
        </ul>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={() => setBulkOpen(false)} disabled={busy === 'bulk'}>
            Keep them
          </button>
          <button className="btn btn-danger" onClick={confirmBulkDelete} disabled={busy === 'bulk'}>
            {busy === 'bulk' ? <Loader2 size={17} className="spin" /> : <Trash2 size={17} />} Delete {picked.size}
          </button>
        </div>
      </Modal>

      <Modal open={!!deleteFor} onClose={() => setDeleteFor(null)} title="Delete booking?" subtitle="This removes the record permanently. To keep a history, cancel it instead.">
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={() => setDeleteFor(null)}>
            Keep
          </button>
          <button className="btn btn-danger" onClick={confirmDelete} disabled={busy === 'delete'}>
            {busy === 'delete' ? <Loader2 size={17} className="spin" /> : <Trash2 size={17} />} Delete
          </button>
        </div>
      </Modal>
    </div>
  );
}
