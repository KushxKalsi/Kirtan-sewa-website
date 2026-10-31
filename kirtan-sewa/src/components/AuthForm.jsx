import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CircleAlert, CircleCheck, Eye, EyeOff, FileText, Hourglass, Loader2, LogIn, ShieldCheck, Trash2, Upload, UserPlus } from 'lucide-react';
import { useAuth } from './AuthContext';
import { useSite } from './SiteContext';
import LocationPicker from './LocationPicker';
import { api } from '../lib/api';
import { fileToDataUrl, readDataUrl } from '../lib/image';

// Documents added when a team member signs up (same ids as the server's DOC_KINDS; Aadhaar is required there).
const SIGNUP_DOCS = [
  { id: 'aadhaar', label: 'Aadhaar card', required: true },
  { id: 'headPhoto', label: 'Jatha head photo' },
  { id: 'jathaPhoto', label: 'Jatha photo' },
  { id: 'bankProof', label: 'Bank passbook / cancelled cheque' },
];

/** One document to attach: a photo (shrunk before sending) or a PDF, kept in the form until it is submitted. */
function DocPick({ doc, label, required, value, onChange, onError }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const pdf = file.type === 'application/pdf';
      if (pdf && file.size > 5 * 1024 * 1024) throw new Error('PDF is too large (max 5 MB).');
      const dataUrl = pdf ? await readDataUrl(file) : await fileToDataUrl(file, 1600, 'image/jpeg', 0.85);
      onChange(doc, { dataUrl, name: file.name, pdf });
    } catch (err) {
      onError(err.message);
    } finally {
      setBusy(false);
    }
  };
  let thumb = <Upload size={22} />;
  if (busy) thumb = <Loader2 size={22} className="spin" />;
  else if (value?.pdf) thumb = <><FileText size={26} /> PDF</>;
  else if (value) thumb = <img src={value.dataUrl} alt={label} />;
  return (
    <div className={`doc-slot glass ${value ? 'has' : ''}`}>
      <button type="button" className={`doc-thumb ${value?.pdf ? 'pdf' : ''}`} onClick={() => ref.current?.click()} aria-label={`Choose ${label}`}>
        {thumb}
      </button>
      <strong>
        {label}
        {required && <em className="req"> *</em>}
      </strong>
      {value && (
        <div className="doc-actions">
          <span className="muted doc-name">{value.name}</span>
          <button type="button" className="icon-btn danger-text" onClick={() => onChange(doc, null)} aria-label={`Remove ${label}`}>
            <Trash2 size={14} />
          </button>
        </div>
      )}
      <input ref={ref} type="file" accept="image/*,application/pdf" hidden onChange={pick} />
    </div>
  );
}

/** Shown to a team member whose account is waiting for the admin: after signing up, or when they try to log in too early. */
function Verifying({ fresh, onBack }) {
  const steps = [
    { done: true, text: fresh ? 'Account created' : 'Account found' },
    { done: true, text: 'Details and documents sent to the admin' },
    { done: false, text: 'The admin is verifying your account' },
  ];
  return (
    <motion.div className="verifying" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <span className="verifying-icon">
        <ShieldCheck size={30} />
      </span>
      <h2>Your account is being verified</h2>
      <p className="muted">The admin checks every new team member's details and documents. You can log in as soon as your account is approved.</p>
      <ol className="verifying-steps">
        {steps.map((st) => (
          <li key={st.text} className={st.done ? 'done' : 'now'}>
            {st.done ? <CircleCheck size={18} /> : <Hourglass size={18} />} {st.text}
          </li>
        ))}
      </ol>
      <button type="button" className="btn btn-ghost btn-block" onClick={onBack}>
        <LogIn size={18} /> Back to log in
      </button>
    </motion.div>
  );
}

/**
 * Mobile number + password. Customers and team members can log in or create an account here.
 * A team member's new account waits for the admin's approval before they can log in.
 */
export default function AuthForm({ role = 'user', initial = {}, onDone, startWith = 'login' }) {
  const { login } = useAuth();
  const { site } = useSite();
  const kinds = site?.categories || []; // types of kirtan a new team member can say they do
  const member = role === 'member';
  const [mode, setMode] = useState(startWith);
  const [form, setForm] = useState({ name: initial.name || '', phone: initial.phone || '', password: '', kinds: [], location: null });
  const [docs, setDocs] = useState({});
  const setDoc = (id, value) => setDocs((d) => ({ ...d, [id]: value }));
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [waiting, setWaiting] = useState(null); // 'new' just signed up | 'login' tried to log in before approval
  const [attempt, setAttempt] = useState(0);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const registering = mode === 'register';

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (member && registering) {
        if (kinds.length && !form.kinds.length) throw new Error('Please choose the type of kirtan you do.');
        if (!form.location) throw new Error('Please pick where you are based on the map.');
        const missing = SIGNUP_DOCS.filter((d) => d.required && !docs[d.id]);
        if (missing.length) throw new Error(`Please add your ${missing.map((d) => d.label).join(', ')}.`);
        const attached = Object.fromEntries(Object.entries(docs).filter(([, v]) => v).map(([id, v]) => [id, { dataUrl: v.dataUrl, name: v.name }]));
        await api.registerTeam({ name: form.name, phone: form.phone, password: form.password, categoryIds: form.kinds, location: form.location, docs: attached });
        setWaiting('new');
        setMode('login');
        setForm((f) => ({ ...f, password: '' }));
        setDocs({});
        return;
      }
      const data = registering ? await api.register(form) : await api.login({ phone: form.phone, password: form.password, role });
      login(data);
      onDone?.(data);
    } catch (err) {
      // 403 = the team account exists but the admin has not approved it yet.
      if (member && err.status === 403) return setWaiting('login');
      setError(err.message);
      setAttempt((n) => n + 1);
      if (err.status === 409) setMode('login');
    } finally {
      setBusy(false);
    }
  };

  if (waiting) return <Verifying fresh={waiting === 'new'} onBack={() => setWaiting(null)} />;

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
        {registering && member && kinds.length > 0 && (
          <motion.div key="kirtan-kinds" className="field-group" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <span className="label">
              Which type of kirtan do you do? <em className="req">*</em>
            </span>
            <div className="slot-checks" role="group">
              {kinds.map((c) => {
                const on = form.kinds.includes(c.id);
                return (
                  <button key={c.id} type="button" aria-pressed={on} className={`check-pill ${on ? 'active' : ''}`} onClick={() => setForm((f) => ({ ...f, kinds: on ? f.kinds.filter((k) => k !== c.id) : [...f.kinds, c.id] }))}>
                    {c.name}
                  </button>
                );
              })}
            </div>
            <p className="fine-print">Choose all that apply.</p>
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
      <AnimatePresence initial={false}>
        {registering && member && (
          <motion.div key="location" className="field-group" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <span className="label">
              Where are you based? <em className="req">*</em>
            </span>
            <LocationPicker value={form.location} onChange={(location) => setForm((f) => ({ ...f, location }))} label="Search your home / base on the map" hint="The admin uses this to give you nearby sewas." />
          </motion.div>
        )}
        {registering && member && (
          <motion.div key="docs" className="field-group" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <span className="label">Your documents (photo or PDF, up to 5 MB each)</span>
            <div className="doc-grid signup-docs">
              {SIGNUP_DOCS.map((d) => (
                <DocPick key={d.id} doc={d.id} label={d.label} required={d.required} value={docs[d.id]} onChange={setDoc} onError={setError} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <label className="field">
        <input type={show ? 'text' : 'password'} value={form.password} onChange={set('password')} placeholder=" " autoComplete={registering ? 'new-password' : 'current-password'} minLength={registering ? 6 : undefined} required />
        <span>{registering ? 'Choose a password (6+ characters)' : 'Password'}</span>
        <button type="button" className="pw-toggle" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}>
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </label>
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
            ? 'Only you and the admin can see your documents. The admin approves new team accounts and ticks which sewas you do; you can log in once it is approved. More details can be added later in your profile.'
            : 'Use the mobile number you signed up with. You can change your password in your profile.'
          : registering
            ? 'Your bookings, bills, offers and messages with the jatha are kept in this account.'
            : 'Forgot your password? Message or call the jatha and they will reset it for you.'}
      </p>
    </form>
  );
}
