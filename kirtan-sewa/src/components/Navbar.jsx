import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from 'framer-motion';
import { CalendarDays, ClipboardList, Menu, X } from 'lucide-react';
import { useSite } from './SiteContext';
import { useGoTo } from './useGoTo';
import ThemeToggle from './ThemeToggle';
import { ease } from '../lib/motion';
import { lockScroll, unlockScroll } from '../lib/scroll';

const LINKS = [
  { id: 'about', label: 'About' },
  { id: 'sewa', label: 'Sewa' },
  { id: 'book', label: 'Calendar' },
  { id: 'sangat', label: 'Sangat' },
  { id: 'contact', label: 'Contact' },
];

export default function Navbar() {
  const { site } = useSite();
  const goTo = useGoTo();
  const { pathname } = useLocation();
  const { scrollY } = useScroll();
  const [hidden, setHidden] = useState(false);
  const [solid, setSolid] = useState(false);
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(null);

  useMotionValueEvent(scrollY, 'change', (y) => {
    const prev = scrollY.getPrevious() ?? 0;
    setSolid(y > 40);
    setHidden(y > 300 && y > prev && !open);
  });

  useEffect(() => {
    if (!open) return;
    lockScroll();
    document.body.style.overflow = 'hidden';
    return () => {
      unlockScroll();
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => setOpen(false), [pathname]);

  const go = (id) => {
    setOpen(false);
    setTimeout(() => goTo(id), open ? 350 : 0);
  };

  return (
    <>
      <motion.header
        className={`nav ${solid ? 'solid' : ''}`}
        animate={{ y: hidden ? '-110%' : '0%' }}
        transition={{ duration: 0.45, ease }}
      >
        <div className="nav-inner container">
          <button className="brand" onClick={() => go('top')} aria-label="Home">
            <span className="brand-mark gurmukhi">ੴ</span>
            <span className="brand-name">{site?.settings.siteName || 'Kirtan Sewa'}</span>
          </button>

          <nav className="nav-links" onMouseLeave={() => setHovered(null)}>
            {LINKS.map((l) => (
              <button key={l.id} onClick={() => go(l.id)} onMouseEnter={() => setHovered(l.id)}>
                {hovered === l.id && <motion.span layoutId="nav-hover" className="nav-hover" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
                <span>{l.label}</span>
              </button>
            ))}
          </nav>

          <div className="nav-actions">
            <Link to="/manage" className={`nav-manage ${pathname === '/manage' ? 'active' : ''}`} aria-current={pathname === '/manage' ? 'page' : undefined}>
              <ClipboardList size={16} />
              <span className="nm-full">Manage booking</span>
              <span className="nm-short">Manage</span>
            </Link>
            <ThemeToggle className="nav-theme" />
            <button className="btn btn-primary btn-sm nav-cta" onClick={() => go('book')}>
              <CalendarDays size={16} /> Book now
            </button>
            <button className="icon-btn nav-burger" onClick={() => setOpen((o) => !o)} aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open}>
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={open ? 'x' : 'm'}
                  initial={{ rotate: -90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: 90, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  style={{ display: 'grid' }}
                >
                  {open ? <X size={20} /> : <Menu size={20} />}
                </motion.span>
              </AnimatePresence>
            </button>
          </div>
        </div>
      </motion.header>

      <AnimatePresence>
        {open && (
          <motion.div
            className="mobile-menu"
            data-lenis-prevent
            initial={{ clipPath: 'circle(0% at calc(100% - 40px) 36px)' }}
            animate={{ clipPath: 'circle(150% at calc(100% - 40px) 36px)' }}
            exit={{ clipPath: 'circle(0% at calc(100% - 40px) 36px)' }}
            transition={{ duration: 0.7, ease: [0.76, 0, 0.24, 1] }}
          >
            <motion.ul initial="hidden" animate="show" exit="hidden" variants={{ show: { transition: { staggerChildren: 0.06, delayChildren: 0.25 } }, hidden: {} }}>
              {[{ id: 'top', label: 'Home' }, ...LINKS].map((l, i) => (
                <motion.li key={l.id} variants={{ hidden: { y: 50, opacity: 0 }, show: { y: 0, opacity: 1, transition: { duration: 0.6, ease } } }}>
                  <button onClick={() => go(l.id)}>
                    <span className="mm-index">0{i + 1}</span>
                    {l.label}
                  </button>
                </motion.li>
              ))}
            </motion.ul>
            <motion.div className="mobile-menu-foot" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.6 } }} exit={{ opacity: 0 }}>
              <button className="btn btn-primary btn-block" onClick={() => go('book')}>
                <CalendarDays size={18} /> Book a Sewa
              </button>
              <Link to="/manage" className="btn btn-ghost btn-block">
                <ClipboardList size={18} /> Manage / cancel booking
              </Link>
              <ThemeToggle className="menu-theme" showLabel />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
