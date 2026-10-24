import { useState } from 'react';
import { motion } from 'framer-motion';
import { CircleAlert, Eye, EyeOff, Loader2, Lock } from 'lucide-react';
import Mandala from '../components/Mandala';
import { adminLogin } from '../lib/api';
import { ease } from '../lib/motion';

export default function AdminLogin({ onLogin }) {
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { token } = await adminLogin(password);
      onLogin(token);
    } catch (err) {
      setError(err.message);
      setAttempt((n) => n + 1);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="page admin-login">
      <Mandala className="login-mandala" />
      <motion.form className="login-card glass" onSubmit={submit} initial={{ opacity: 0, y: 40, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.9, ease }}>
        <motion.div className="login-icon" initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', delay: 0.3, stiffness: 200, damping: 14 }}>
          <Lock size={24} />
        </motion.div>
        <h1>Admin panel</h1>
        <p>Manage bookings, sewa services and your schedule.</p>
        <label className="field">
          <input type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder=" " autoFocus required autoComplete="current-password" />
          <span>Password</span>
          <button type="button" className="pw-toggle" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}>
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </label>
        {error && (
          <motion.div key={attempt} className="form-error" animate={{ x: [0, -8, 8, -4, 4, 0] }} transition={{ duration: 0.4 }}>
            <CircleAlert size={18} /> {error}
          </motion.div>
        )}
        <button className="btn btn-primary btn-block" disabled={loading}>
          {loading && <Loader2 size={18} className="spin" />} Log in
        </button>
      </motion.form>
    </main>
  );
}
