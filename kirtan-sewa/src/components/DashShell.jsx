import { useState } from 'react';
import { motion } from 'framer-motion';
import { MoreHorizontal } from 'lucide-react';
import Modal from './Modal';

function TabButton({ t, active, onClick, layoutId }) {
  return (
    <button role="tab" aria-selected={active} className={active ? 'active' : ''} onClick={onClick}>
      {active && <motion.span layoutId={layoutId} className="dash-tab-bg" transition={{ type: 'spring', stiffness: 400, damping: 34 }} />}
      <t.icon size={17} />
      <span className="dash-tab-label">{t.label}</span>
      {t.badge ? <em className="tab-badge">{t.badge}</em> : null}
    </button>
  );
}

/**
 * The layout every dashboard shares: a side menu on wide screens, a bottom bar (the first `primary` tabs + More) on
 * phones, and the tab's content. tabs: [{ id, label, icon, badge }].
 */
export default function DashShell({ tabs, tab, onTab, name, primary = 4, children }) {
  const [more, setMore] = useState(false);
  const main = tabs.slice(0, primary);
  const rest = tabs.length > primary + 1 ? tabs.slice(primary) : [];
  const shown = rest.length ? main : tabs;
  const inRest = rest.some((t) => t.id === tab);
  const choose = (id) => {
    onTab(id);
    setMore(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="dash-shell">
      <nav className="dash-nav glass" role="tablist" aria-label="Sections">
        {tabs.map((t) => (
          <TabButton key={t.id} t={t} active={tab === t.id} onClick={() => choose(t.id)} layoutId={`${name}-side`} />
        ))}
      </nav>
      <div className="dash-content">{children}</div>
      <nav className="dash-bottom" role="tablist" aria-label="Sections">
        {shown.map((t) => (
          <TabButton key={t.id} t={t} active={tab === t.id} onClick={() => choose(t.id)} layoutId={`${name}-bottom`} />
        ))}
        {rest.length > 0 && (
          <TabButton t={{ id: 'more', label: 'More', icon: MoreHorizontal, badge: rest.some((t) => t.badge) ? '!' : null }} active={inRest} onClick={() => setMore(true)} layoutId={`${name}-bottom`} />
        )}
      </nav>
      <Modal open={more} onClose={() => setMore(false)} title="More">
        <div className="dash-more">
          {rest.map((t) => (
            <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => choose(t.id)}>
              <t.icon size={18} />
              <span>{t.label}</span>
              {t.badge ? <em className="tab-badge">{t.badge}</em> : null}
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}

/** A number card for an overview. tone: gold | warn | danger | success. onClick opens the related tab. */
export function StatCard({ label, value, tone = 'gold', icon: Icon, onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag className={`stat-card glass tone-${tone}`} onClick={onClick}>
      {Icon && <Icon size={18} />}
      <strong>{value}</strong>
      <span>{label}</span>
    </Tag>
  );
}

/** "Needs your action": a short list of things to do, each opening where it's done. items: [{ key, text, sub, tone, onClick }] */
export function ActionList({ title = 'Needs your action', items, empty = 'Nothing waiting for you 🙏' }) {
  return (
    <section className="side-card glass">
      <h3>{title}</h3>
      {items.length === 0 ? (
        <p className="muted">{empty}</p>
      ) : (
        <ul className="action-list">
          {items.map((x) => (
            <li key={x.key}>
              <button type="button" className={`tone-${x.tone || 'gold'}`} onClick={x.onClick}>
                <strong>{x.text}</strong>
                {x.sub && <small>{x.sub}</small>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
