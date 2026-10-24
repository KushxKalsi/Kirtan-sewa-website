import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarX, Clock, Loader2, Lock, Plus, Save, Trash2, X } from 'lucide-react';
import { prettyDate, rangeTo12 } from '../lib/date';
import { ease } from '../lib/motion';

export default function ScheduleTab({ data, api, patch, toast }) {
  const [slots, setSlots] = useState(data.slots.map((s) => ({ ...s })));
  const [savingSlots, setSavingSlots] = useState(false);
  const [newDate, setNewDate] = useState('');
  const blocked = data.blockedDates;
  const upcomingBlocked = blocked.filter((d) => d >= data.today);

  // Blocked times: the only thing that makes a time unavailable to customers.
  const blockedTimes = (data.blockedTimes || []).filter((t) => t.date >= data.today);
  const [blockForm, setBlockForm] = useState({ date: '', slotIds: [], start: '', end: '', note: '' });
  const [blocking, setBlocking] = useState(false);
  const toggleBlockSlot = (id) =>
    setBlockForm((f) => ({ ...f, slotIds: f.slotIds.includes(id) ? f.slotIds.filter((x) => x !== id) : [...f.slotIds, id] }));
  const blockTimes = async (e) => {
    e.preventDefault();
    setBlocking(true);
    try {
      const { date, slotIds, start, end, note } = blockForm;
      const res = await api.blockTimes({ date, slotIds, note, ...(start || end ? { start, end } : {}) });
      patch({ blockedTimes: res.blockedTimes });
      toast(`Blocked on ${prettyDate(date, 'd MMM yyyy')}.`);
      setBlockForm((f) => ({ ...f, slotIds: [], start: '', end: '', note: '' }));
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBlocking(false);
    }
  };
  const unblockTime = async (id) => {
    try {
      const res = await api.unblockTime(id);
      patch({ blockedTimes: res.blockedTimes });
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const update = (i, k, v) => setSlots((list) => list.map((s, j) => (j === i ? { ...s, [k]: v } : s)));
  const remove = (i) => setSlots((list) => list.filter((_, j) => j !== i));
  const add = () => setSlots((list) => [...list, { id: '', label: '', start: '10:00', end: '12:00' }]);

  const saveSlots = async () => {
    setSavingSlots(true);
    try {
      const res = await api.saveSlots(slots);
      patch({ slots: res.slots, services: res.services });
      setSlots(res.slots.map((s) => ({ ...s })));
      toast('Time slots saved.');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSavingSlots(false);
    }
  };

  const saveBlocked = async (dates) => {
    try {
      const res = await api.saveBlockedDates(dates);
      patch({ blockedDates: res.blockedDates });
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const block = (e) => {
    e.preventDefault();
    if (!newDate || blocked.includes(newDate)) return;
    saveBlocked([...blocked, newDate]);
    toast(`${prettyDate(newDate, 'd MMM yyyy')} blocked.`);
    setNewDate('');
  };

  return (
    <div className="admin-section">
      <div className="admin-card glass">
        <div className="admin-section-head">
          <div>
            <h2>Daily time slots</h2>
            <p>The times customers can pick. Bookings don't block a slot — block a time below when the jatha is not available. Existing bookings keep their original times.</p>
          </div>
        </div>
        <motion.ul className="slot-editor" layout>
          <AnimatePresence initial={false}>
            {slots.map((s, i) => (
              <motion.li key={s.id || `new-${i}`} layout initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 30 }} transition={{ duration: 0.3, ease }}>
                <input className="input" value={s.label} onChange={(e) => update(i, 'label', e.target.value)} placeholder="Slot name" aria-label="Slot name" />
                <input className="input" type="time" value={s.start} onChange={(e) => update(i, 'start', e.target.value)} aria-label="Start time" />
                <span className="slot-to">to</span>
                <input className="input" type="time" value={s.end} onChange={(e) => update(i, 'end', e.target.value)} aria-label="End time" />
                <button className="icon-btn danger-text" onClick={() => remove(i)} aria-label="Remove slot">
                  <Trash2 size={16} />
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>
        <div className="row-actions">
          <button className="btn btn-ghost btn-sm" onClick={add}>
            <Plus size={16} /> Add slot
          </button>
          <button className="btn btn-primary btn-sm" onClick={saveSlots} disabled={savingSlots || slots.length === 0}>
            {savingSlots ? <Loader2 size={16} className="spin" /> : <Save size={16} />} Save slots
          </button>
        </div>
      </div>

      <div className="admin-card glass">
        <div className="admin-section-head">
          <div>
            <h2>Blocked times</h2>
            <p>Customers can request any time, even one that is already booked. Block a time here when the jatha can't take more bookings for it; it then shows as not available.</p>
          </div>
        </div>
        <form className="admin-form block-times-form" onSubmit={blockTimes}>
          <label>
            <span className="label">Date *</span>
            <input className="input" type="date" value={blockForm.date} min={data.today} onChange={(e) => setBlockForm((f) => ({ ...f, date: e.target.value }))} required />
          </label>
          <div>
            <span className="label">Time slots</span>
            <div className="slot-checks">
              {data.slots.map((sl) => (
                <button type="button" key={sl.id} className={`check-pill ${blockForm.slotIds.includes(sl.id) ? 'active' : ''}`} onClick={() => toggleBlockSlot(sl.id)}>
                  {sl.label} <small>{rangeTo12(`${sl.start} – ${sl.end}`)}</small>
                </button>
              ))}
            </div>
          </div>
          <div className="grid-2">
            <label>
              <span className="label">Or a time from</span>
              <input className="input" type="time" value={blockForm.start} onChange={(e) => setBlockForm((f) => ({ ...f, start: e.target.value }))} />
            </label>
            <label>
              <span className="label">to</span>
              <input className="input" type="time" value={blockForm.end} onChange={(e) => setBlockForm((f) => ({ ...f, end: e.target.value }))} />
            </label>
          </div>
          <label>
            <span className="label">Note (only you see it)</span>
            <input className="input" value={blockForm.note} onChange={(e) => setBlockForm((f) => ({ ...f, note: e.target.value }))} placeholder="e.g. Booked for Singh family" />
          </label>
          <div className="row-actions">
            <button className="btn btn-primary btn-sm" disabled={blocking}>
              {blocking ? <Loader2 size={16} className="spin" /> : <Lock size={16} />} Block
            </button>
          </div>
        </form>
        <ul className="blocked-times">
          <AnimatePresence initial={false}>
            {blockedTimes.length === 0 && (
              <motion.li className="muted" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                No upcoming times blocked.
              </motion.li>
            )}
            {blockedTimes.map((t) => (
              <motion.li key={t.id} layout initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 30 }} transition={{ duration: 0.3, ease }}>
                <Clock size={15} />
                <span>
                  <strong>{prettyDate(t.date, 'EEE, d MMM yyyy')}</strong> · {t.label ? `${t.label} (${rangeTo12(`${t.start} – ${t.end}`)})` : rangeTo12(`${t.start} – ${t.end}`)}
                  {t.note && <small>{t.note}</small>}
                </span>
                <button className="icon-btn" onClick={() => unblockTime(t.id)} aria-label="Unblock">
                  <X size={15} />
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </div>

      <div className="admin-card glass">
        <div className="admin-section-head">
          <div>
            <h2>Unavailable dates</h2>
            <p>Block days when the jatha is travelling or busy. They show as unavailable on the calendar.</p>
          </div>
        </div>
        <form className="block-form" onSubmit={block}>
          <input className="input" type="date" value={newDate} min={data.today} onChange={(e) => setNewDate(e.target.value)} required aria-label="Date to block" />
          <button className="btn btn-primary btn-sm">
            <CalendarX size={16} /> Block date
          </button>
        </form>
        <div className="blocked-list">
          <AnimatePresence initial={false}>
            {upcomingBlocked.length === 0 && (
              <motion.p className="muted" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                No upcoming dates blocked.
              </motion.p>
            )}
            {upcomingBlocked.map((d) => (
              <motion.span key={d} layout className="chip blocked-chip" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}>
                {prettyDate(d, 'EEE, d MMM yyyy')}
                <button onClick={() => saveBlocked(blocked.filter((x) => x !== d))} aria-label="Unblock">
                  <X size={14} />
                </button>
              </motion.span>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
