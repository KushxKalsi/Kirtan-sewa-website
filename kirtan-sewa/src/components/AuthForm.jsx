import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CircleAlert, CircleCheck, Eye, EyeOff, Loader2, LogIn, UserPlus } from 'lucide-react';
import { useAuth } from './AuthContext';
import { api } from '../lib/api';

// What a team member does in the jatha (same ids as the server's ROLES).
const JATHA_ROLES = [
  { id: 'head-ragi', label: 'Head Ragi' },
  { id: 'side-ragi', label: 'Side Ragi' },
  { id: 'tabla', label: 'Tabla' },
];

/**
 * Mobile number + password. Customers and team members can log in or create an account here.
 * A team member's new account waits for the admin's approval before they can log in.
 */
export default function AuthForm({ role = 'user', initial = {}, onDone, startWith = 'login' }) {
  const { login } = useAuth();
  const member = role === 'member';
  const [mode, setMode] = useState(startWith);
  const [form, setForm] = useState({ name: initial.name || '', phone: initial.phone || '', password: '', jathaRole: '' });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [attempt, setAttempt] = useState(0);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const registering = mode === 'register';

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (member && registering) {
        if (!form.jathaRole) throw new Error('Please choose your role: Head Ragi, Side Ragi or Tabla.');
        await api.registerTeam({ name: form.name, phone: form.phone, password: form.password, role: form.jathaRole });
        setNotice('Account created. The admin will check and approve it — you can log in after that.');
        setMode('login');
        setForm((f) => ({ ...f, password: '' }));
        return;
      }
      const data = registering ? await api.register(form) : await api.login({ phone: form.phone, password: form.password, role });
      login(data);
      onDone?.(data);
    } catch (err) {
      setError(err.message);
      setAttempt((n) => n + 1);
      if (err.status === 409 && !/wait/i.test(err.message)) setMode('login');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="auth-form" onSubmit={submit}>
      <div className="auth-switch" role="tablist">
        {[
          { id: 'login', label: 'Log in' },
          { id: 'register', label: 'Create account' },
        ].map((m) => (
          <button key={m.id} type="button" role="tab" aria-selected={mode === m.id} className={mode === m.id ? 'active' : ''} onClick={() => setMode(m.id)}>
            {mode === m.id && <motion.span layoutId={`auth-switch-${role}`} className="auth-switch-bg" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
            <span>{m.label}</span>
          </button>
        ))}
      </div>
      <AnimatePresence initial={false}>
        {registering && member && (
          <motion.div key="jatha-role" className="field-group" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <span className="label">What do you do in the jatha?</span>
            <div className="auth-switch jatha-roles" role="radiogroup">
              {JATHA_ROLES.map((r) => (
                <button key={r.id} type="button" role="radio" aria-checked={form.jathaRole === r.id} className={form.jathaRole === r.id ? 'active' : ''} onClick={() => setForm((f) => ({ ...f, jathaRole: r.id }))}>
                  {form.jathaRole === r.id && <motion.span layoutId="jatha-role" className="auth-switch-bg" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                  <span>{r.label}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
        {registering && (
          <motion.label key="name" className="field" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <input value={form.name} onChange={set('name')} placeholder=" " autoComplete="name" required />
            <span>Full name</span>
          </motion.label>
        )}
      </AnimatePresence>
      <label className="field">
        <input type="tel" inputMode="tel" value={form.phone} onChange={set('phone')} placeholder=" " autoComplete="tel" required />
        <span>Mobile number</span>
      </label>
      <label className="field">
        <input type={show ? 'text' : 'password'} value={form.password} onChange={set('password')} placeholder=" " autoComplete={registering ? 'new-password' : 'current-password'} minLength={registering ? 6 : undefined} required />
        <span>{registering ? 'Choose a password (6+ characters)' : 'Password'}</span>
        <button type="button" className="pw-toggle" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}>
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </label>
      {notice && (
        <div className="form-ok">
          <CircleCheck size={18} /> {notice}
        </div>
      )}
      {error && (
        <motion.div key={attempt} className="form-error" animate={{ x: [0, -8, 8, -4, 4, 0] }} transition={{ duration: 0.4 }}>
          <CircleAlert size={18} /> {error}
        </motion.div>
      )}
      <button className="btn btn-primary btn-block" disabled={busy}>
        {busy ? <Loader2 size={18} className="spin" /> : registering ? <UserPlus size={18} /> : <LogIn size={18} />}
        {registering ? 'Create account' : 'Log in'}
      </button>
      <p className="fine-print">
        {member
          ? registering
            ? 'The admin approves new team accounts and ticks which sewas you do. You can log in once it is approved.'
            : 'Use the mobile number you signed up with. You can change your password in your profile.'
          : registering
            ? 'Your bookings, bills, offers and messages with the jatha are kept in this account.'
            : 'Forgot your password? Message or call the jatha and they will reset it for you.'}
      </p>
    </form>
  );
}
