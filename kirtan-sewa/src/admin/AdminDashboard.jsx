import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarDays, Clock, ExternalLink, Layers, LayoutGrid, Loader2, LogOut, Settings, Sparkles, Users } from 'lucide-react';
import BookingsTab from './BookingsTab';
import ServicesTab from './ServicesTab';
import ScheduleTab from './ScheduleTab';
import SettingsTab from './SettingsTab';
import AdminNotify from './AdminNotify';
import CategoriesTab from './CategoriesTab';
import TeamTab from './TeamTab';
import GurpurabTab from './GurpurabTab';
import { adminApi } from '../lib/api';
import { useSite } from '../components/SiteContext';
import { useToast } from '../components/Toast';
import { ease } from '../lib/motion';

const TABS = [
  { id: 'bookings', label: 'Bookings', icon: CalendarDays },
  { id: 'categories', label: 'Categories', icon: LayoutGrid },
  { id: 'services', label: 'Sewa services', icon: Layers },
  { id: 'team', label: 'Team', icon: Users },
  { id: 'schedule', label: 'Schedule', icon: Clock },
  { id: 'gurpurab', label: 'Gurpurab', icon: Sparkles },
  { id: 'settings', label: 'Site settings', icon: Settings },
];

export default function AdminDashboard({ token, onLogout }) {
  const [tab, setTab] = useState('bookings');
  const [data, setData] = useState(null);
  const { refresh: refreshSite } = useSite();
  const toast = useToast();

  // Every admin call goes through here so an expired session logs out cleanly.
  const api = useMemo(() => {
    const raw = adminApi(token);
    return Object.fromEntries(
      Object.entries(raw).map(([k, fn]) => [
        k,
        async (...args) => {
          try {
            return await fn(...args);
          } catch (e) {
            if (e.status === 401) onLogout();
            throw e;
          }
        },
      ]),
    );
  }, [token, onLogout]);

  const load = useCallback(async () => {
    try {
      setData(await api.data());
    } catch (e) {
      toast(e.message, 'error');
    }
  }, [api, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const patch = useCallback(
    (partial) => {
      setData((d) => ({ ...d, ...partial }));
      refreshSite();
    },
    [refreshSite],
  );

  const ctx = { data, api, patch, reload: load, toast };

  return (
    <main className="page admin">
      <div className="container">
        <header className="admin-head">
          <div>
            <span className="eyebrow">Admin</span>
            <h1>Sewa dashboard</h1>
          </div>
          <div className="admin-head-actions">
            <AdminNotify api={api} devices={data?.adminDevices || 0} toast={toast} onChange={load} />
            <Link to="/" className="btn btn-ghost btn-sm">
              <ExternalLink size={15} /> View site
            </Link>
            <button className="btn btn-ghost btn-sm" onClick={onLogout}>
              <LogOut size={15} /> Log out
            </button>
          </div>
        </header>

        <nav className="admin-tabs" role="tablist">
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
              {tab === t.id && <motion.span layoutId="admin-tab" className="admin-tab-bg" transition={{ type: 'spring', stiffness: 400, damping: 34 }} />}
              <t.icon size={16} />
              <span>{t.label}</span>
            </button>
          ))}
        </nav>

        {!data ? (
          <div className="admin-loading">
            <Loader2 className="spin" />
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div key={tab} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.4, ease }}>
              {tab === 'bookings' && <BookingsTab {...ctx} />}
              {tab === 'categories' && <CategoriesTab {...ctx} />}
              {tab === 'services' && <ServicesTab {...ctx} />}
              {tab === 'team' && <TeamTab {...ctx} />}
              {tab === 'schedule' && <ScheduleTab {...ctx} />}
              {tab === 'gurpurab' && <GurpurabTab {...ctx} />}
              {tab === 'settings' && <SettingsTab {...ctx} />}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </main>
  );
}
