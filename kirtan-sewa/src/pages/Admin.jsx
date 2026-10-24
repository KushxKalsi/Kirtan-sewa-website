import { useState } from 'react';
import AdminLogin from '../admin/AdminLogin';
import AdminDashboard from '../admin/AdminDashboard';
import { readStore, writeStore } from '../lib/storage';

const KEY = 'sewa.adminToken';

export default function Admin() {
  const [token, setToken] = useState(() => {
    const t = readStore(KEY, null);
    return t && Number(t.split('.')[0]) > Date.now() ? t : null;
  });

  const login = (t) => {
    writeStore(KEY, t);
    setToken(t);
  };
  const logout = () => {
    writeStore(KEY, null);
    setToken(null);
  };

  return token ? <AdminDashboard token={token} onLogout={logout} /> : <AdminLogin onLogin={login} />;
}
