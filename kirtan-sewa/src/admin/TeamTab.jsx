import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BellRing, CalendarOff, Eye, EyeOff, FileText, IdCard, KeyRound, Loader2, MapPin, MessagesSquare, Pencil, Phone, Plus, Save, Trash2, UserRound } from 'lucide-react';
import Modal from '../components/Modal';
import { ease } from '../lib/motion';
import { mapsLink } from '../lib/geo';
import { rupees } from '../lib/money';
import { prettyDate } from '../lib/date';

const blank = { name: '', phone: '', address: '', role: '', defaultPay: '', password: '', skills: [], active: true };
const phoneKey = (p) => String(p || '').replace(/\D/g, '').slice(-10);
const skillKey = (k) => `${k.categoryId}|${k.serviceId}`;

/** Team members and what each one does (sewa within a category). Only matching people can be assigned. */
export default function TeamTab({ data, api, patch, toast, openChat }) {
  const people = data.people || [];
  const categories = data.categories || [];
  const { services, bookings } = data;
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [deleteFor, setDeleteFor] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [roleFilter, setRoleFilter] = useState('');
  const roles = data.roles || {};
  const docKinds = data.docKinds || {};
  const onLeaveToday = (id) => (data.leaves || []).find((l) => l.personId === id && l.status === 'approved' && l.from <= data.today && l.to >= data.today);
  const shown = roleFilter ? people.filter((p) => (p.role || 'none') === roleFilter) : people;

  const serviceName = (id) => services.find((s) => s.id === id)?.name || 'Removed sewa';
  // Skill groups: one per category (its sewas); without categories, just the sewas.
  const groups = categories.length
    ? categories.map((c) => ({ id: c.id, name: c.name, serviceIds: c.serviceIds }))
    : [{ id: '', name: 'Sewas', serviceIds: services.map((s) => s.id) }];
  const notifyOn = new Set(data.notifyPhones || []);
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
    setForm({ ...blank, ...p, defaultPay: p.defaultPay ?? '', password: '' });
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
          <p>
            Add the people who do the sewa, their role (head ragi, side ragi, tabla) and what each one does. Give each a login password: they log in at <strong>Team login</strong> with their mobile number to see and confirm their sewas, fill in their profile and documents, ask for leave and chat with you.
          </p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openNew}>
          <Plus size={16} /> Add person
        </button>
      </div>

      {people.length > 0 && (
        <div className="filter-pills">
          {[{ id: '', label: `All (${people.length})` }, ...Object.entries(roles).map(([id, label]) => ({ id, label: `${label} (${people.filter((p) => p.role === id).length})` })), { id: 'none', label: 'No role' }].map((f) => (
            <button key={f.id} className={roleFilter === f.id ? 'active' : ''} onClick={() => setRoleFilter(f.id)}>
              {roleFilter === f.id && <motion.span layoutId="role-pill" className="pill-bg" transition={{ type: 'spring', stiffness: 400, damping: 34 }} />}
              <span>{f.label}</span>
            </button>
          ))}
        </div>
      )}

      {people.length === 0 && <div className="admin-empty glass">No team members yet. Add people to start assigning them to bookings.</div>}

      <motion.ul className="admin-services" layout>
        <AnimatePresence initial={false}>
          {shown.map((p) => {
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
                  {p.address && (
                    <p className="person-address">
                      <MapPin size={13} /> {p.address}
                    </p>
                  )}
                  <div className="skill-chips">
                    {p.role && <span className="chip role-chip">{roles[p.role]}</span>}
                    {!p.hasPassword && <span className="chip warn-chip">No login password yet</span>}
                    {p.defaultPay != null && <span className="chip">Usual bhet {rupees(p.defaultPay)}</span>}
                    {onLeaveToday(p.id) && (
                      <span className="chip warn-chip">
                        <CalendarOff size={12} /> On leave till {prettyDate(onLeaveToday(p.id).to, 'd MMM')}
                      </span>
                    )}
                    {Object.keys(p.docs || {}).length > 0 && (
                      <span className="chip">
                        <FileText size={12} /> {Object.keys(p.docs).length}/{Object.keys(docKinds).length} documents
                      </span>
                    )}
                    {summary.length ? summary.map((t) => <span className="chip" key={t}>{t}</span>) : <span className="chip warn-chip">No skills ticked — can't be assigned</span>}
                    {upcoming > 0 && <span className="chip">{upcoming} upcoming</span>}
                    {p.phone && notifyOn.has(phoneKey(p.phone)) && (
                      <span className="chip">
                        <BellRing size={12} /> Notifications on
                      </span>
                    )}
                    {!p.active && <span className="chip">Inactive</span>}
                  </div>
                </div>
                <div className="as-actions">
                  <button className="icon-btn" onClick={() => setViewing(p)} aria-label="Profile and documents" title="Profile and documents">
                    <IdCard size={16} />
                  </button>
                  {openChat && (
                    <button className="icon-btn" onClick={() => openChat(`m:${p.id}`)} aria-label="Chat" title="Chat">
                      <MessagesSquare size={16} />
                    </button>
                  )}
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
              <span className="label">Phone (to see their sewas and get notifications)</span>
              <input className="input" type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </label>
          </div>
          <div className="grid-2">
            <label>
              <span className="label">Role in the jatha</span>
              <select className="input" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
                <option value="">—</option>
                {Object.entries(roles).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="label">Usual bhet per sewa (₹, optional)</span>
              <input className="input" type="number" min="0" value={form.defaultPay} onChange={(e) => setForm((f) => ({ ...f, defaultPay: e.target.value }))} placeholder="Set per booking" />
            </label>
          </div>
          <label>
            <span className="label">
              <KeyRound size={13} /> {editing !== 'new' && editing?.hasPassword ? 'New login password (leave empty to keep the current one)' : 'Login password (6+ characters) — give it to them'}
            </span>
            <input className="input" type="text" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} autoComplete="new-password" minLength={6} placeholder={editing !== 'new' && editing?.hasPassword ? '••••••' : 'e.g. their own choice'} />
          </label>
          <label>
            <span className="label">Address (shown to the customer with their name)</span>
            <textarea className="input" rows={2} value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} placeholder="e.g. Model Town, Ludhiana" />
          </label>
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

      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing?.name} subtitle={viewing && [roles[viewing.role], viewing.phone].filter(Boolean).join(' · ')} wide>
        {viewing && (
          <div className="person-profile">
            <dl className="success-details">
              <div>
                <dt>Father’s name</dt>
                <dd>{viewing.fatherName || '—'}</dd>
              </div>
              <div>
                <dt>Experience</dt>
                <dd>{viewing.experience || '—'}</dd>
              </div>
              <div>
                <dt>Address</dt>
                <dd>{viewing.address || '—'}</dd>
              </div>
              <div>
                <dt>Map location</dt>
                <dd>
                  {viewing.location ? (
                    <a href={mapsLink(viewing.location)} target="_blank" rel="noreferrer">
                      <MapPin size={13} /> {viewing.location.label || 'Open map'}
                    </a>
                  ) : (
                    'Not added'
                  )}
                </dd>
              </div>
              <div>
                <dt>Bank account</dt>
                <dd>{viewing.bank?.account ? [viewing.bank.holder, viewing.bank.account, viewing.bank.ifsc, viewing.bank.bankName].filter(Boolean).join(' · ') : 'Not added'}</dd>
              </div>
            </dl>
            <div className="doc-grid">
              {Object.entries(docKinds).map(([kind, label]) => {
                const doc = viewing.docs?.[kind];
                return (
                  <div key={kind} className={`doc-slot glass ${doc ? 'has' : ''}`}>
                    {doc ? (
                      <a className={`doc-thumb ${doc.type === 'application/pdf' ? 'pdf' : ''}`} href={doc.url} target="_blank" rel="noreferrer">
                        {doc.type === 'application/pdf' ? <FileText size={34} /> : <img src={doc.url} alt={label} loading="lazy" />}
                      </a>
                    ) : (
                      <span className="doc-thumb empty">—</span>
                    )}
                    <strong>{label}</strong>
                    <span className="muted">{doc ? 'Tap to open' : 'Not uploaded'}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
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
