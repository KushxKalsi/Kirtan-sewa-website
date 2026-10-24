import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { SiteProvider, useSite } from './components/SiteContext';
import { ToastProvider } from './components/Toast';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Preloader from './components/Preloader';
import CursorGlow from './components/CursorGlow';
import ScrollProgress from './components/ScrollProgress';
import Home from './pages/Home';
import ManageBooking from './pages/ManageBooking';
import { scrollToTop, setLenis } from './lib/scroll';

const Admin = lazy(() => import('./pages/Admin'));

const curtain = {
  initial: { scaleY: 1, transformOrigin: '50% 0%' },
  animate: { scaleY: 0, transformOrigin: '50% 0%', transition: { duration: 0.8, ease: [0.76, 0, 0.24, 1], delay: 0.1 } },
  exit: { scaleY: 1, transformOrigin: '50% 100%', transition: { duration: 0.55, ease: [0.76, 0, 0.24, 1] } },
};

function seenIntro() {
  try {
    return sessionStorage.getItem('sewa.intro') === '1';
  } catch {
    return false;
  }
}

function Shell() {
  const location = useLocation();
  const { site, error, refresh } = useSite();
  const [intro, setIntro] = useState(() => !seenIntro() && location.pathname === '/');
  const ready = !intro && !!site;
  // The curtain only plays between pages, never on the very first load.
  const firstRoute = useRef(true);
  useEffect(() => {
    firstRoute.current = false;
  }, []);

  const finishIntro = useCallback(() => {
    try {
      sessionStorage.setItem('sewa.intro', '1');
    } catch {
      /* ignore */
    }
    setIntro(false);
  }, []);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const lenis = new Lenis({ duration: 1.2, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true });
    setLenis(lenis);
    let id = requestAnimationFrame(function raf(time) {
      lenis.raf(time);
      id = requestAnimationFrame(raf);
    });
    return () => {
      cancelAnimationFrame(id);
      lenis.destroy();
      setLenis(null);
    };
  }, []);

  const site404 = error && !site;

  return (
    <>
      <ScrollProgress />
      <CursorGlow />
      <AnimatePresence>{intro && <Preloader key="pre" onDone={finishIntro} />}</AnimatePresence>
      <Navbar />

      {site404 ? (
        <main className="page offline">
          <h1>Unable to load</h1>
          <p>{error}</p>
          <button className="btn btn-primary" onClick={refresh}>
            Try again
          </button>
        </main>
      ) : (
        <AnimatePresence mode="wait" onExitComplete={() => scrollToTop(true)}>
          <motion.div key={location.pathname} className="route">
            <motion.div className="curtain" variants={curtain} initial={firstRoute.current ? false : 'initial'} animate="animate" exit="exit" aria-hidden="true" />
            <Routes location={location}>
              <Route path="/" element={<Home ready={ready} />} />
              <Route path="/manage" element={<ManageBooking />} />
              <Route path="/admin" element={<Suspense fallback={<main className="page" />}><Admin /></Suspense>} />
              <Route path="*" element={<Home ready={ready} />} />
            </Routes>
            {!location.pathname.startsWith('/admin') && <Footer />}
          </motion.div>
        </AnimatePresence>
      )}
    </>
  );
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <SiteProvider>
        <ToastProvider>
          <Shell />
        </ToastProvider>
      </SiteProvider>
    </MotionConfig>
  );
}
