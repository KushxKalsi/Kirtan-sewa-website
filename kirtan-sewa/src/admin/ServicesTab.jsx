import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDown, ArrowUp, Eye, EyeOff, Loader2, Pencil, Plus, Save, Trash2 } from 'lucide-react';
import Modal from '../components/Modal';
import { SERVICE_ICONS, serviceIcon } from '../lib/icons';
import { ease } from '../lib/motion';

const COLORS = ['#FF9933', '#F6C453', '#E9B44C', '#FF7A59', '#7C9CFF', '#5EEAD4', '#C084FC', '#F472B6'];
const blank = { name: '', gurmukhi: '', description: '', duration: '', icon: 'music', color: '#FF9933', allowedSlots: [], active: true };

export default function ServicesTab({ data, api, patch, toast }) {
  const { services, slots } = data;
  const [editing, setEditing] = useState(null); // null | 'new' | service
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [deleteFor, setDeleteFor] = useState(null);

  const openNew = () => {
    setForm(blank);
    setEditing('new');
  };
  const openEdit = (s) => {
    setForm({ ...blank, ...s });
    setEditing(s);
  };

  const run = async (fn, msg) => {
    try {
      const res = await fn();
      if (res.services) patch({ services: res.services });
      if (msg) toast(msg);
      return true;
    } catch (e) {
      toast(e.message, 'error');
      return false;
    }
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    const ok = await run(() => (editing === 'new' ? api.addService(form) : api.updateService(editing.id, form)), editing === 'new' ? 'Sewa added.' : 'Sewa updated.');
    setSaving(false);
    if (ok) setEditing(null);
  };

  const move = (idx, dir) => {
    const ids = services.map((s) => s.id);
    [ids[idx], ids[idx + dir]] = [ids[idx + dir], ids[idx]];
    patch({ services: ids.map((id) => services.find((s) => s.id === id)) });
    run(() => api.reorderServices(ids));
  };

  const toggleSlot = (id) =>
    setForm((f) => ({ ...f, allowedSlots: f.allowedSlots.includes(id) ? f.allowedSlots.filter((x) => x !== id) : [...f.allowedSlots, id] }));
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="admin-section">
      <div className="admin-section-head">
        <div>
          <h2>Sewa services</h2>
          <p>These appear on the website and in the booking calendar. Add as many as you like.</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openNew}>
          <Plus size={16} /> Add sewa
        </button>
      </div>

      <motion.ul className="admin-services" layout>
        <AnimatePresence initial={false}>
          {services.map((s, i) => {
            const Icon = serviceIcon(s.icon);
            const slotNames = s.allowedSlots?.length ? slots.filter((sl) => s.allowedSlots.includes(sl.id)).map((sl) => sl.label).join(', ') : 'All slots';
            return (
              <motion.li key={s.id} layout className={`admin-service glass ${s.active ? '' : 'inactive'}`} style={{ '--accent': s.color }} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.35, ease }}>
                <span className="as-icon">
                  <Icon size={20} />
                </span>
                <div className="as-main">
                  <strong>
                    {s.name} {s.gurmukhi && <span className="gurmukhi">{s.gurmukhi}</span>}
                  </strong>
                  <span>
                    {s.duration || '—'} · {slotNames}
                    {!s.active && ' · Hidden'}
                  </span>
                </div>
                <div className="as-actions">
                  <button className="icon-btn" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
                    <ArrowUp size={16} />
                  </button>
                  <button className="icon-btn" onClick={() => move(i, 1)} disabled={i === services.length - 1} aria-label="Move down">
                    <ArrowDown size={16} />
                  </button>
                  <button className="icon-btn" onClick={() => run(() => api.updateService(s.id, { ...s, active: !s.active }), s.active ? 'Hidden from website.' : 'Visible on website.')} aria-label={s.active ? 'Hide' : 'Show'}>
                    {s.active ? <Eye size={16} /> : <EyeOff size={16} />}
                  </button>
                  <button className="icon-btn" onClick={() => openEdit(s)} aria-label="Edit">
                    <Pencil size={16} />
                  </button>
                  <button className="icon-btn danger-text" onClick={() => setDeleteFor(s)} aria-label="Delete">
                    <Trash2 size={16} />
                  </button>
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </motion.ul>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'Add a new sewa' : 'Edit sewa'} wide>
        <form className="admin-form" onSubmit={save}>
          <div className="grid-2">
            <label>
              <span className="label">Name (English) *</span>
              <input className="input" value={form.name} onChange={set('name')} required placeholder="e.g. Sukhmani Sahib Path" />
            </label>
            <label>
              <span className="label">Name (Gurmukhi)</span>
              <input className="input gurmukhi" value={form.gurmukhi} onChange={set('gurmukhi')} placeholder="ਸੁਖਮਨੀ ਸਾਹਿਬ" />
            </label>
          </div>
          <label>
            <span className="label">Description</span>
            <textarea className="input" value={form.description} onChange={set('description')} rows={3} />
          </label>
          <label>
            <span className="label">Duration</span>
            <input className="input" value={form.duration} onChange={set('duration')} placeholder="e.g. 2 hours" />
          </label>

          <div>
            <span className="label">Icon</span>
            <div className="icon-grid">
              {Object.entries(SERVICE_ICONS).map(([key, Icon]) => (
                <button type="button" key={key} className={`icon-pick ${form.icon === key ? 'active' : ''}`} onClick={() => setForm((f) => ({ ...f, icon: key }))} aria-label={key}>
                  <Icon size={18} />
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="label">Accent colour</span>
            <div className="color-row">
              {COLORS.map((c) => (
                <button type="button" key={c} className={`swatch ${form.color.toLowerCase() === c.toLowerCase() ? 'active' : ''}`} style={{ background: c }} onClick={() => setForm((f) => ({ ...f, color: c }))} aria-label={c} />
              ))}
              <input type="color" value={form.color} onChange={set('color')} aria-label="Custom colour" />
            </div>
          </div>

          <div>
            <span className="label">Available in these time slots (none selected = all slots)</span>
            <div className="slot-checks">
              {slots.map((sl) => (
                <button type="button" key={sl.id} className={`check-pill ${form.allowedSlots.includes(sl.id) ? 'active' : ''}`} onClick={() => toggleSlot(sl.id)}>
                  {sl.label} <small>{sl.start}–{sl.end}</small>
                </button>
              ))}
            </div>
          </div>

          <label className="switch-row">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} />
            <span className="switch" />
            Show on website
          </label>

          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button className="btn btn-primary" disabled={saving}>
              {saving ? <Loader2 size={17} className="spin" /> : <Save size={17} />} Save sewa
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={!!deleteFor} onClose={() => setDeleteFor(null)} title={`Delete “${deleteFor?.name}”?`} subtitle="Existing bookings for this sewa are kept. To just take it off the website, hide it instead.">
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={() => setDeleteFor(null)}>
            Keep
          </button>
          <button
            className="btn btn-danger"
            onClick={async () => {
              if (await run(() => api.deleteService(deleteFor.id), 'Sewa deleted.')) setDeleteFor(null);
            }}
          >
            <Trash2 size={17} /> Delete
          </button>
        </div>
      </Modal>
    </div>
  );
}
