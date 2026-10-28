import { useState } from 'react';
import { format } from 'date-fns';
import { KeyRound, Loader2, MessagesSquare, Phone, Search, Trash2, UserRound } from 'lucide-react';
import Modal from '../components/Modal';

/** Sangat (customer) accounts: reset a forgotten password, chat, or remove a login. */
export default function CustomersTab({ data, api, setData, toast, openChat }) {
  const users = data.users || [];
  const [query, setQuery] = useState('');
  const [resetFor, setResetFor] = useState(null);
  const [password, setPassword] = useState('');
  const [deleteFor, setDeleteFor] = useState(null);
  const [busy, setBusy] = useState(false);
  const q = query.trim().toLowerCase();
  const shown = [...users].filter((u) => !q || [u.name, u.phone, u.email].some((v) => v?.toLowerCase().includes(q))).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const reset = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.resetUserPassword(resetFor.id, password);
      toast(`New password set for ${resetFor.name}. Tell them on the phone.`);
      setResetFor(null);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    setBusy(true);
    try {
      await api.deleteUser(deleteFor.id);
      setData((d) => ({ ...d, users: d.users.filter((u) => u.id !== deleteFor.id), chats: (d.chats || []).filter((c) => c.id !== `u:${deleteFor.id}`) }));
      toast('Account removed. Their bookings are kept.');
      setDeleteFor(null);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-section">
      <div className="admin-section-head">
        <div>
          <h2>Sangat accounts</h2>
          <p>Customers create an account with their mobile number and a password before booking. If someone forgets their password, set a new one here and tell them.</p>
        </div>
        <label className="search">
          <Search size={16} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, mobile…" />
        </label>
      </div>
      {shown.length === 0 && <div className="admin-empty glass">{users.length ? 'No match.' : 'No accounts yet.'}</div>}
      <ul className="admin-services">
        {shown.map((u) => (
          <li key={u.id} className="admin-service glass person" style={{ '--accent': 'var(--gold)' }}>
            <span className="as-icon">
              <UserRound size={20} />
            </span>
            <div className="as-main">
              <strong>
                {u.name}
                <a className="person-phone" href={`tel:${u.phone}`}>
                  <Phone size={12} /> {u.phone}
                </a>
              </strong>
              <div className="skill-chips">
                <span className="chip">
                  {u.bookings} booking{u.bookings === 1 ? '' : 's'}
                </span>
                <span className="chip">Joined {format(new Date(u.createdAt), 'd MMM yyyy')}</span>
                {u.email && <span className="chip">{u.email}</span>}
              </div>
            </div>
            <div className="as-actions">
              <button className="icon-btn" onClick={() => openChat(`u:${u.id}`)} aria-label="Chat" title="Chat">
                <MessagesSquare size={16} />
              </button>
              <button
                className="icon-btn"
                onClick={() => {
                  setPassword('');
                  setResetFor(u);
                }}
                aria-label="Reset password"
                title="Reset password"
              >
                <KeyRound size={16} />
              </button>
              <button className="icon-btn danger-text" onClick={() => setDeleteFor(u)} aria-label="Remove account" title="Remove account">
                <Trash2 size={16} />
              </button>
            </div>
          </li>
        ))}
      </ul>

      <Modal open={!!resetFor} onClose={() => setResetFor(null)} title={`New password for ${resetFor?.name}`} subtitle="They are logged out on other devices and log in with this password.">
        <form className="cancel-form" onSubmit={reset}>
          <label className="field">
            <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder=" " minLength={6} required autoFocus />
            <span>New password (6+ characters)</span>
          </label>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setResetFor(null)}>
              Back
            </button>
            <button className="btn btn-primary" disabled={busy}>
              {busy ? <Loader2 size={17} className="spin" /> : <KeyRound size={17} />} Set password
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={!!deleteFor} onClose={() => setDeleteFor(null)} title={`Remove ${deleteFor?.name}'s account?`} subtitle="Their login and chat are deleted. Their bookings stay. They can create a new account with the same number.">
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={() => setDeleteFor(null)}>
            Keep
          </button>
          <button className="btn btn-danger" onClick={remove} disabled={busy}>
            {busy ? <Loader2 size={17} className="spin" /> : <Trash2 size={17} />} Remove
          </button>
        </div>
      </Modal>
    </div>
  );
}
