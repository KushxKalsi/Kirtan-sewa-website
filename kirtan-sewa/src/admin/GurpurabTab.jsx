import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { differenceInCalendarDays, format, subMonths } from 'date-fns';
import { BellRing, Eye, EyeOff, ImagePlus, Loader2, Pencil, Plus, Save, Send, Sparkles, Trash2, X } from 'lucide-react';
import Modal from '../components/Modal';
import { fromKey, prettyDate } from '../lib/date';
import { fileToDataUrl } from '../lib/image';
import { ease } from '../lib/motion';

const KINDS = [
  { id: 'prakash', label: 'Prakash Purab', gurmukhi: 'ਪ੍ਰਕਾਸ਼ ਪੁਰਬ' },
  { id: 'jyoti-jot', label: 'Jyoti Jot Divas', gurmukhi: 'ਜੋਤੀ ਜੋਤਿ ਦਿਵਸ' },
  { id: 'shaheedi', label: 'Shaheedi Purab', gurmukhi: 'ਸ਼ਹੀਦੀ ਪੁਰਬ' },
];
const kindOf = (id) => KINDS.find((k) => k.id === id) || KINDS[0];
const blank = { kind: 'prakash', name: '', gurmukhi: '', date: '', images: [], active: true };
const imageUrl = (id) => `/api/gurpurab-images/${id}`;
const MAX_IMAGES = 8;

/** Prakash Purab / Jyoti Jot / Shaheedi days: dates, pictures for the home page carousel, and the one-month notice. */
export default function GurpurabTab({ data, api, patch, toast }) {
  const all = data.gurpurabs || [];
  const today = data.today;
  const upcoming = all.filter((g) => g.date >= today);
  const past = all.filter((g) => g.date < today).reverse();
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [busy, setBusy] = useState('');
  const [deleteFor, setDeleteFor] = useState(null);
  const [notifyFor, setNotifyFor] = useState(null);

  const run = async (fn, msg) => {
    try {
      const res = await fn();
      if (res.gurpurabs) patch({ gurpurabs: res.gurpurabs });
      if (msg) toast(typeof msg === 'function' ? msg(res) : msg);
      return true;
    } catch (e) {
      toast(e.message, 'error');
      return false;
    }
  };
  const openNew = () => {
    setForm(blank);
    setEditing('new');
  };
  const openEdit = (g) => {
    setForm({ ...blank, ...g });
    setEditing(g);
  };
  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    const ok = await run(() => (editing === 'new' ? api.addGurpurab(form) : api.updateGurpurab(editing.id, form)), editing === 'new' ? 'Added.' : 'Saved.');
    setSaving(false);
    if (ok) setEditing(null);
  };
  const upload = async (e) => {
    const files = [...(e.target.files || [])].slice(0, MAX_IMAGES - form.images.length);
    e.target.value = '';
    for (const file of files) {
      setUploading((n) => n + 1);
      try {
        const { id } = await api.uploadGurpurabImage(await fileToDataUrl(file, 1600, 'image/jpeg', 0.85));
        setForm((f) => ({ ...f, images: [...f.images, id] }));
      } catch (err) {
        toast(err.message, 'error');
      } finally {
        setUploading((n) => n - 1);
      }
    }
  };
  const sendNotice = async (g) => {
    setBusy(g.id);
    await run(() => api.notifyGurpurab(g.id), (res) => `Sent to ${res.sent} device${res.sent === 1 ? '' : 's'}.`);
    setBusy('');
    setNotifyFor(null);
  };

  const noticeText = (g) => {
    if (g.noticeSentFor === g.date) return `Notice sent ${g.noticeSentAt ? format(new Date(g.noticeSentAt), 'd MMM') : ''}${g.noticeDevices != null ? ` to ${g.noticeDevices} device${g.noticeDevices === 1 ? '' : 's'}` : ''}`;
    const at = subMonths(fromKey(g.date), 1);
    return differenceInCalendarDays(at, fromKey(today)) >= 0 ? `Notice goes out ${format(at, 'd MMM')}, 10 AM` : 'One-month notice time has passed — you can send it now';
  };

  const row = (g, isPast) => {
    const kind = kindOf(g.kind);
    return (
      <motion.li key={g.id} layout className={`admin-service glass gp-admin k-${g.kind} ${g.active ? '' : 'inactive'}`} style={{ '--accent': 'var(--gp)' }} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.3, ease }}>
        <span className="gp-item-date">
          <strong>{prettyDate(g.date, 'd')}</strong>
          {prettyDate(g.date, 'MMM yy')}
        </span>
        <div className="as-main">
          <strong>
            {g.name} {g.gurmukhi && <span className="gurmukhi">{g.gurmukhi}</span>}
          </strong>
          <div className="skill-chips">
            <span className="chip gp-kind-chip">{kind.label}</span>
            {g.images?.length > 0 && <span className="chip">{g.images.length} picture{g.images.length > 1 ? 's' : ''}</span>}
            {!g.active && <span className="chip">Hidden</span>}
            {!isPast && g.active && (
              <span className="chip">
                <BellRing size={12} /> {noticeText(g)}
              </span>
            )}
            {isPast && <span className="chip warn-chip">Passed — set next year’s date</span>}
          </div>
          {g.images?.length > 0 && (
            <div className="gp-thumbs">
              {g.images.map((id) => (
                <img key={id} src={imageUrl(id)} alt="" loading="lazy" />
              ))}
            </div>
          )}
        </div>
        <div className="as-actions">
          {!isPast && g.active && (
            <button className="icon-btn" onClick={() => setNotifyFor(g)} disabled={!!busy} aria-label="Send notification now" title="Send notification to everyone now">
              {busy === g.id ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
            </button>
          )}
          <button className="icon-btn" onClick={() => run(() => api.updateGurpurab(g.id, { ...g, active: !g.active }), g.active ? 'Hidden from website.' : 'Shown on website.')} aria-label={g.active ? 'Hide' : 'Show'}>
            {g.active ? <Eye size={16} /> : <EyeOff size={16} />}
          </button>
          <button className="icon-btn" onClick={() => openEdit(g)} aria-label="Edit">
            <Pencil size={16} />
          </button>
          <button className="icon-btn danger-text" onClick={() => setDeleteFor(g)} aria-label="Delete">
            <Trash2 size={16} />
          </button>
        </div>
      </motion.li>
    );
  };

  return (
    <div className="admin-section">
      <div className="admin-section-head">
        <div>
          <h2>Gurpurab</h2>
          <p>
            Prakash Purab, Jyoti Jot Divas and Shaheedi Purab of the Gurus and Bhagats. Upcoming days show in the home page carousel (add pictures to them) and on the booking calendar. One month before each day,
            everyone with notifications on gets a reminder — {data.everyoneDevices ?? 0} device{data.everyoneDevices === 1 ? '' : 's'} right now.
          </p>
          <p className="muted gp-note">
            <Sparkles size={14} /> Dates are from the SGPC calendar (Nanakshahi 558). Most follow the moon and change every year — when the SGPC publishes the new Jantri, edit each past day and set its new date.
          </p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openNew}>
          <Plus size={16} /> Add day
        </button>
      </div>

      <h3 className="gp-admin-title">Upcoming · {upcoming.length}</h3>
      <motion.ul className="admin-services" layout>
        <AnimatePresence initial={false}>{upcoming.map((g) => row(g, false))}</AnimatePresence>
      </motion.ul>
      {past.length > 0 && (
        <>
          <h3 className="gp-admin-title">Passed this year · {past.length}</h3>
          <motion.ul className="admin-services" layout>
            <AnimatePresence initial={false}>{past.map((g) => row(g, true))}</AnimatePresence>
          </motion.ul>
        </>
      )}

      <Modal open={!!editing} onClose={() => !uploading && setEditing(null)} title={editing === 'new' ? 'Add a Gurpurab' : 'Edit Gurpurab'} wide>
        <form className="admin-form" onSubmit={save}>
          <div>
            <span className="label">Type</span>
            <div className="slot-checks">
              {KINDS.map((k) => (
                <button type="button" key={k.id} className={`check-pill ${form.kind === k.id ? 'active' : ''}`} onClick={() => setForm((f) => ({ ...f, kind: k.id }))}>
                  {k.label} <small className="gurmukhi">{k.gurmukhi}</small>
                </button>
              ))}
            </div>
          </div>
          <div className="grid-2">
            <label>
              <span className="label">Name *</span>
              <input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required placeholder="e.g. Sri Guru Nanak Dev Ji" />
            </label>
            <label>
              <span className="label">Name (Gurmukhi)</span>
              <input className="input gurmukhi" value={form.gurmukhi} onChange={(e) => setForm((f) => ({ ...f, gurmukhi: e.target.value }))} placeholder="ਸ੍ਰੀ ਗੁਰੂ ਨਾਨਕ ਦੇਵ ਜੀ" />
            </label>
          </div>
          <label>
            <span className="label">Date *</span>
            <input className="input" type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} required />
          </label>
          <div>
            <span className="label">Pictures for the home page carousel (posters or photos, up to {MAX_IMAGES})</span>
            <div className="gp-edit-images">
              <AnimatePresence initial={false}>
                {form.images.map((id) => (
                  <motion.span key={id} className="gp-edit-image" layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}>
                    <img src={imageUrl(id)} alt="" />
                    <button type="button" onClick={() => setForm((f) => ({ ...f, images: f.images.filter((x) => x !== id) }))} aria-label="Remove picture">
                      <X size={14} />
                    </button>
                  </motion.span>
                ))}
              </AnimatePresence>
              {form.images.length < MAX_IMAGES && (
                <label className="gp-add-image">
                  {uploading ? <Loader2 size={20} className="spin" /> : <ImagePlus size={20} />}
                  <span>{uploading ? 'Uploading…' : 'Add pictures'}</span>
                  <input type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={upload} hidden />
                </label>
              )}
            </div>
            <p className="fine-print">Without a picture, the carousel shows a designed card with the name in Gurmukhi.</p>
          </div>
          <label className="switch-row">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} />
            <span className="switch" />
            Show on website and send the one-month notice
          </label>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)} disabled={!!uploading}>
              Cancel
            </button>
            <button className="btn btn-primary" disabled={saving || !!uploading}>
              {saving ? <Loader2 size={17} className="spin" /> : <Save size={17} />} Save
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!notifyFor}
        onClose={() => !busy && setNotifyFor(null)}
        title="Send notification now?"
        subtitle={notifyFor && `“${kindOf(notifyFor.kind).label} — ${notifyFor.name}” goes to all ${data.everyoneDevices ?? 0} devices with notifications on (customers, team, admins and visitors who asked for reminders).${notifyFor.noticeSentFor === notifyFor.date ? ' It was already sent once for this date.' : ''}`}
      >
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={() => setNotifyFor(null)} disabled={!!busy}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={() => sendNotice(notifyFor)} disabled={!!busy}>
            {busy ? <Loader2 size={17} className="spin" /> : <Send size={17} />} Send to everyone
          </button>
        </div>
      </Modal>

      <Modal open={!!deleteFor} onClose={() => setDeleteFor(null)} title={`Delete “${deleteFor?.name}”?`} subtitle="Its pictures are deleted too. To just take it off the website, hide it instead.">
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={() => setDeleteFor(null)}>
            Keep
          </button>
          <button
            className="btn btn-danger"
            onClick={async () => {
              if (await run(() => api.deleteGurpurab(deleteFor.id), 'Deleted.')) setDeleteFor(null);
            }}
          >
            <Trash2 size={17} /> Delete
          </button>
        </div>
      </Modal>
    </div>
  );
}
