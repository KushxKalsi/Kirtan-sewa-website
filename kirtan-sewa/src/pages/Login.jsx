import { useRef, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { HeartHandshake, UsersRound } from 'lucide-react';
import Mandala from '../components/Mandala';
import AuthForm from '../components/AuthForm';
import { useAuth } from '../components/AuthContext';
import { ease } from '../lib/motion';

const ROLES = [
  { id: 'user', label: 'Sangat', sub: 'Book & manage kirtan', icon: HeartHandshake },
  { id: 'member', label: 'Team member', sub: 'Ragi or tabla', icon: UsersRound },
];
const home = (role) => (role === 'member' ? '/team' : '/account');

export default function Login() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { session } = useAuth();
  const [role, setRole] = useState(params.get('as') === 'team' ? 'member' : 'user');
  const next = params.get('next');
  const leaving = useRef(false); // just logged in here: done() chooses where to go, not the redirect below

  // Customers land on the home page at the booking calendar, so they can book (more) sewas straight away.
  const done = (d) => {
    leaving.current = true;
    if (next) navigate(next, { replace: true });
    else if (d.role === 'user') navigate('/', { replace: true, state: { scrollTo: 'book' } });
    else navigate(home(d.role), { replace: true });
  };

  if (session && !leaving.current) return <Navigate to={next || home(session.role)} replace />;

  return (
    <main className="page admin-login auth-page">
      <Mandala className="login-mandala" />
      <motion.div className="login-card glass" initial={{ opacity: 0, y: 40, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.9, ease }}>
        <h1>Welcome</h1>
        <p>Log in with your mobile number and password.</p>
        <div className="role-pick" role="tablist">
          {ROLES.map((r) => (
            <button key={r.id} type="button" role="tab" aria-selected={role === r.id} className={role === r.id ? 'active' : ''} onClick={() => setRole(r.id)}>
              {role === r.id && <motion.span layoutId="role-pick" className="role-pick-bg" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
              <r.icon size={20} />
              <strong>{r.label}</strong>
              <small>{r.sub}</small>
            </button>
          ))}
        </div>
        <AuthForm key={role} role={role} startWith={params.get('mode') === 'register' ? 'register' : 'login'} onDone={done} />
      </motion.div>
    </main>
  );
}
