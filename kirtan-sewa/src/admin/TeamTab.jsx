import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Eye, EyeOff, Loader2, Pencil, Phone, Plus, Save, Trash2, UserRound } from 'lucide-react';
import Modal from '../components/Modal';
import { ease } from '../lib/motion';

const blank = { name: '', phone: '', skills: [], active: true };
const skillKey = (k) => `${k.categoryId}|${k.serviceId}`;

/** Team members and what each one does (sewa within a category). Only matching people can be assigned. */
export default function TeamTab({ data, api, patch, toast }) {
  const people = data.people || [];
  const categories = data.categories || [];
  const { services, bookings } = data;
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [deleteFor, setDeleteFor] = useState(null);

  const serviceName = (id) => services.find((s) => s.id === id)?.name || 'Removed sewa';
  // Skill groups: one per category (its sewas); without categories, just the sewas.
  const groups = categories.length
    ? categories.map((c) => ({ id: c.id, name: c.name, serviceIds: c.serviceIds }))
    : [{ id: '', name: 'Sewas', serviceIds: services.map((s) => s.id) }];
  const upcomingFor = (id) => bookings.filter((b) => (b.assignees || []).some((a) => a.id === id) && b.date >= data.today && b.status !== 'cancelled').length;

  const run = async (fn, msg) => {
    try {
      const res = await fn();
      if (res.people) patch({ people: res.people });
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
  const openEdit = (p) => {
    setForm({ ...blank, ...p });
    setEditing(p);
  };
  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    const ok = await run(() => (editing === 'new' ? api.addPerson(form) : api.updatePerson(editing.id, form)), editing === 'new' ? 'Team member added.' : 'Saved.');
    setSaving(false);
    if (ok) setEditing(null);
  };
  const hasSkill = (categoryId, serviceId) => form.skills.some((k) => k.categoryId === categoryId && k.serviceId === serviceId);
  const toggleSkill = (categoryId, serviceId) =>
    setForm((f) => ({
      ...f,
      skills: hasSkill(categoryId, serviceId) ? f.skills.filter((k) => skillKey(k) !== `${categoryId}|${serviceId}`) : [...f.skills, { categoryId, serviceId }],
    }));
  const toggleGroup = (g) => {
    const all = g.serviceIds.every((id) => hasSkill(g.id, id));
    setForm((f) => ({
      ...f,
      skills: all ? f.skills.filter((k) => k.categoryId !== g.id) : [...f.skills.filter((k) => k.categoryId !== g.id), ...g.serviceIds.map((serviceId) => ({ categoryId: g.id, serviceId }))],
    }));
  };
  const skillSummary = (p) =>
    groups
      .map((g) => {
        const mine = (p.skills || []).filter((k) => k.categoryId === g.id).map((k) => serviceName(k.serviceId));
        return mine.length ? `${categories.length ? g.name + ': ' : ''}${mine.length === g.serviceIds.length && mine.length > 1 ? 'all sewas' : mine.join(', ')}` : null;
      })
      .filter(Boolean);

  return (
    <div className="admin-section">
      <div className="admin-section-head">
        <div>
          <h2>Team</h2>
          <p>Add the people who do the sewa and tick what each one does. When you assign people to a booking, only those who do that sewa in that category are listed.</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openNew}>
          <Plus size={16} /> Add person
        </button>
      </div>

      {people.length === 0 && <div className="admin-empty glass">No team members yet. Add people to start assigning them to bookings.</div>}

      <motion.ul className="admin-services" layout>
        <AnimatePresence initial={false}>
          {people.map((p) => {
            const summary = skillSummary(p);
            const upcoming = upcomingFor(p.id);
            return (
              <motion.li key={p.id} layout className={`admin-service glass person ${p.active ? '' : 'inactive'}`} style={{ '--accent': 'var(--blue)' }} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.35, ease }}>
                <span className="as-icon">
                  <UserRound size={20} />
                </span>
                <div className="as-main">
                  <strong>
                    {p.name}
                    {p.phone && (
                      <a className="person-phone" href={`tel:${p.phone}`}>
                        <Phone size={12} /> {p.phone}
                      </a>
                    )}
                  </strong>
                  <div className="skill-chips">
                    {summary.length ? summary.map((t) => <span className="chip" key={t}>{t}</span>) : <span className="chip warn-chip">No skills ticked — can't be assigned</span>}
                    {upcoming > 0 && <span className="chip">{upcoming} upcoming</span>}
                    {!p.active && <span className="chip">Inactive</span>}
                  </div>
                </div>
                <div className="as-actions">
                  <button className="icon-btn" onClick={() => run(() => api.updatePerson(p.id, { ...p, active: !p.active }), p.active ? 'Marked inactive — not offered for new assignments.' : 'Active again.')} aria-label={p.active ? 'Mark inactive' : 'Mark active'}>
                    {p.active ? <Eye size={16} /> : <EyeOff size={16} />}
                  </button>
                  <button className="icon-btn" onClick={() => openEdit(p)} aria-label="Edit">
                    <Pencil size={16} />
                  </button>
                  <button className="icon-btn danger-text" onClick={() => setDeleteFor(p)} aria-label="Delete">
                    <Trash2 size={16} />
                  </button>
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </motion.ul>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'Add a team member' : 'Edit team member'} wide>
        <form className="admin-form" onSubmit={save}>
          <div className="grid-2">
            <label>
              <span className="label">Name *</span>
              <input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required placeholder="e.g. Bhai Jaswant Singh" />
            </label>
            <label>
              <span className="label">Phone (optional)</span>
              <input className="input" type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </label>
          </div>
          <div>
            <span className="label">What does this person do? Tick the sewas, per category.</span>
            <div className="skill-groups">
              {groups.map((g) => (
                <div className="skill-group" key={g.id || 'all'}>
                  <div className="skill-group-head">
                    <strong>{g.name}</strong>
                    {g.serviceIds.length > 1 && (
                      <button type="button" className="link-btn" onClick={() => toggleGroup(g)}>
                        {g.serviceIds.every((id) => hasSkill(g.id, id)) ? 'Clear' : 'Select all'}
                      </button>
                    )}
                  </div>
                  <div className="slot-checks">
                    {g.serviceIds.map((id) => (
                      <button type="button" key={id} className={`check-pill ${hasSkill(g.id, id) ? 'active' : ''}`} onClick={() => toggleSkill(g.id, id)}>
                        {serviceName(id)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <label className="switch-row">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} />
            <span className="switch" />
            Active (can be assigned)
          </label>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button className="btn btn-primary" disabled={saving}>
              {saving ? <Loader2 size={17} className="spin" /> : <Save size={17} />} Save
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={!!deleteFor} onClose={() => setDeleteFor(null)} title={`Remove ${deleteFor?.name}?`} subtitle="Bookings they were assigned to keep their name. To keep them for later, mark them inactive instead.">
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={() => setDeleteFor(null)}>
            Keep
          </button>
          <button
            className="btn btn-danger"
            onClick={async () => {
              if (await run(() => api.deletePerson(deleteFor.id), 'Removed from team.')) setDeleteFor(null);
            }}
          >
            <Trash2 size={17} /> Remove
          </button>
        </div>
      </Modal>
    </div>
  );
}
