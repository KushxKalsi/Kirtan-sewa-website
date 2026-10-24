import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDown, ArrowUp, Eye, EyeOff, LayoutGrid, Loader2, Pencil, Plus, Save, Trash2 } from 'lucide-react';
import Modal from '../components/Modal';
import { SERVICE_ICONS, serviceIcon } from '../lib/icons';
import { ease } from '../lib/motion';

const COLORS = ['#F6C453', '#FF9933', '#E9B44C', '#FF7A59', '#7C9CFF', '#5EEAD4', '#C084FC', '#F472B6'];
const blank = { name: '', gurmukhi: '', description: '', serviceIds: [], icon: 'music', color: '#E9B44C', active: true };

/** Top-level booking choice (e.g. Kirtan with Raag / with Kavishri) and which sewas each one offers. */
export default function CategoriesTab({ data, api, patch, toast }) {
  const categories = data.categories || [];
  const { services } = data;
  const [editing, setEditing] = useState(null); // null | 'new' | category
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [deleteFor, setDeleteFor] = useState(null);

  const run = async (fn, msg) => {
    try {
      const res = await fn();
      const changed = Object.fromEntries(['categories', 'people'].filter((k) => res[k]).map((k) => [k, res[k]]));
      patch(changed);
      if (msg) toast(msg);
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
  const openEdit = (c) => {
    setForm({ ...blank, ...c });
    setEditing(c);
  };
  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    const ok = await run(() => (editing === 'new' ? api.addCategory(form) : api.updateCategory(editing.id, form)), editing === 'new' ? 'Category added.' : 'Category updated.');
    setSaving(false);
    if (ok) setEditing(null);
  };
  const move = (idx, dir) => {
    const ids = categories.map((c) => c.id);
    [ids[idx], ids[idx + dir]] = [ids[idx + dir], ids[idx]];
    patch({ categories: ids.map((id) => categories.find((c) => c.id === id)) });
    run(() => api.reorderCategories(ids));
  };
  const toggleService = (id) =>
    setForm((f) => ({ ...f, serviceIds: f.serviceIds.includes(id) ? f.serviceIds.filter((x) => x !== id) : [...f.serviceIds, id] }));
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const nameOf = (id) => services.find((s) => s.id === id)?.name;

  return (
    <div className="admin-section">
      <div className="admin-section-head">
        <div>
          <h2>Categories</h2>
          <p>Visitors choose a category first, then only its sewas are shown. With no visible categories, all sewas are shown directly.</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openNew}>
          <Plus size={16} /> Add category
        </button>
      </div>

      {categories.length === 0 && <div className="admin-empty glass">No categories yet — visitors pick from all sewas directly.</div>}

      <motion.ul className="admin-services" layout>
        <AnimatePresence initial={false}>
          {categories.map((c, i) => {
            const Icon = c.icon ? serviceIcon(c.icon) : LayoutGrid;
            return (
            <motion.li key={c.id} layout className={`admin-service glass ${c.active ? '' : 'inactive'}`} style={{ '--accent': c.color || 'var(--gold)' }} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.35, ease }}>
              <span className="as-icon">
                <Icon size={20} />
              </span>
              <div className="as-main">
                <strong>
                  {c.name} {c.gurmukhi && <span className="gurmukhi">{c.gurmukhi}</span>}
                </strong>
                <span>
                  {c.serviceIds.map(nameOf).filter(Boolean).join(', ') || 'No sewas'}
                  {!c.active && ' · Hidden'}
                </span>
              </div>
              <div className="as-actions">
                <button className="icon-btn" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
                  <ArrowUp size={16} />
                </button>
                <button className="icon-btn" onClick={() => move(i, 1)} disabled={i === categories.length - 1} aria-label="Move down">
                  <ArrowDown size={16} />
                </button>
                <button className="icon-btn" onClick={() => run(() => api.updateCategory(c.id, { ...c, active: !c.active }), c.active ? 'Hidden from website.' : 'Visible on website.')} aria-label={c.active ? 'Hide' : 'Show'}>
                  {c.active ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
                <button className="icon-btn" onClick={() => openEdit(c)} aria-label="Edit">
                  <Pencil size={16} />
                </button>
                <button className="icon-btn danger-text" onClick={() => setDeleteFor(c)} aria-label="Delete">
                  <Trash2 size={16} />
                </button>
              </div>
            </motion.li>
            );
          })}
        </AnimatePresence>
      </motion.ul>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'Add a category' : 'Edit category'} wide>
        <form className="admin-form" onSubmit={save}>
          <div className="grid-2">
            <label>
              <span className="label">Name *</span>
              <input className="input" value={form.name} onChange={set('name')} required placeholder="e.g. Kirtan with Kavishri" />
            </label>
            <label>
              <span className="label">Name (Gurmukhi)</span>
              <input className="input gurmukhi" value={form.gurmukhi} onChange={set('gurmukhi')} placeholder="ਕਵੀਸ਼ਰੀ ਜਥਾ" />
            </label>
          </div>
          <label>
            <span className="label">Short description</span>
            <textarea className="input" rows={2} value={form.description} onChange={set('description')} />
          </label>
          <div>
            <span className="label">Icon (shown on the home page card)</span>
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
                <button type="button" key={c} className={`swatch ${(form.color || '').toLowerCase() === c.toLowerCase() ? 'active' : ''}`} style={{ background: c }} onClick={() => setForm((f) => ({ ...f, color: c }))} aria-label={c} />
              ))}
              <input type="color" value={form.color || '#E9B44C'} onChange={set('color')} aria-label="Custom colour" />
            </div>
          </div>
          <div>
            <span className="label">Sewas in this category * (only these are shown to visitors who pick it)</span>
            <div className="slot-checks">
              {services.map((s) => {
                const Icon = serviceIcon(s.icon);
                return (
                  <button type="button" key={s.id} className={`check-pill ${form.serviceIds.includes(s.id) ? 'active' : ''}`} onClick={() => toggleService(s.id)}>
                    <Icon size={14} /> {s.name}
                    {!s.active && <small>hidden</small>}
                  </button>
                );
              })}
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
              {saving ? <Loader2 size={17} className="spin" /> : <Save size={17} />} Save category
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={!!deleteFor} onClose={() => setDeleteFor(null)} title={`Delete “${deleteFor?.name}”?`} subtitle="Existing bookings keep their category name. Team members lose the skills they had in this category. To just take it off the website, hide it instead.">
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={() => setDeleteFor(null)}>
            Keep
          </button>
          <button
            className="btn btn-danger"
            onClick={async () => {
              if (await run(() => api.deleteCategory(deleteFor.id), 'Category deleted.')) setDeleteFor(null);
            }}
          >
            <Trash2 size={17} /> Delete
          </button>
        </div>
      </Modal>
    </div>
  );
}
