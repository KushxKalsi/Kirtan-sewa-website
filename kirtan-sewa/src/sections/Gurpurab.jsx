import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useInView } from 'framer-motion';
import { differenceInCalendarDays } from 'date-fns';
import { Bell, BellRing, CalendarDays, CalendarHeart, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import SplitText from '../components/SplitText';
import Reveal from '../components/Reveal';
import { useSite } from '../components/SiteContext';
import { useToast } from '../components/Toast';
import { fromKey, prettyDate } from '../lib/date';
import { enableGurpurabReminders, gurpurabRemindersOn, isIos, isStandalone, pushSupported } from '../lib/push';
import { ease } from '../lib/motion';
import { useLowEnd } from '../lib/perf';

const AUTOPLAY_MS = 6500;

export const countdown = (date, today) => {
  const days = differenceInCalendarDays(fromKey(date), fromKey(today));
  return days <= 0 ? 'Today' : days === 1 ? 'Tomorrow' : `in ${days} days`;
};

const slideVariants = {
  enter: (dir) => ({ x: dir > 0 ? '12%' : '-12%', opacity: 0 }),
  center: { x: 0, opacity: 1, transition: { duration: 0.7, ease } },
  exit: (dir) => ({ x: dir > 0 ? '-12%' : '12%', opacity: 0, transition: { duration: 0.45, ease } }),
};

function Media({ slide, lowEnd }) {
  if (!slide.image) {
    // No picture added yet: a designed card with the Guru's / Bhagat's name in Gurmukhi.
    return (
      <div className={`gp-media gp-fallback k-${slide.event.kind}`}>
        <span className="gp-fallback-ring" aria-hidden="true" />
        <span className="gp-fallback-mark gurmukhi" aria-hidden="true">
          ੴ
        </span>
        <span className="gp-fallback-name gurmukhi">{slide.event.gurmukhi || slide.event.name}</span>
      </div>
    );
  }
  return (
    <div className="gp-media">
      {/* Posters come in every shape: show the whole picture over a soft copy of itself. */}
      {!lowEnd && <img className="gp-media-bg" src={slide.image} alt="" aria-hidden="true" draggable="false" />}
      <motion.img
        className="gp-media-img"
        src={slide.image}
        alt={`${slide.event.kindLabel} — ${slide.event.name}`}
        draggable="false"
        initial={{ scale: 1.06 }}
        animate={{ scale: 1 }}
        transition={{ duration: 6, ease: 'easeOut' }}
      />
    </div>
  );
}

function Reminders() {
  const toast = useToast();
  const [on, setOn] = useState(() => gurpurabRemindersOn());
  const [busy, setBusy] = useState(false);
  const iosNeedsInstall = !pushSupported() && isIos() && !isStandalone();
  if (!pushSupported() && !iosNeedsInstall) return null;
  const enable = async () => {
    setBusy(true);
    try {
      await enableGurpurabReminders();
      setOn(true);
      toast('Done — we’ll remind you a month before each Gurpurab.');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={`gp-remind ${on ? 'on' : ''}`}>
      {on ? <BellRing size={18} /> : <Bell size={18} />}
      <span>
        {on
          ? 'Gurpurab reminders are on for this device.'
          : iosNeedsInstall
            ? 'On iPhone, add this site to your Home Screen (Share → Add to Home Screen) to get Gurpurab reminders.'
            : 'Get a reminder one month before every Gurpurab, so you can book kirtan in time.'}
      </span>
      {!on && !iosNeedsInstall && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={enable} disabled={busy}>
          {busy ? <Loader2 size={15} className="spin" /> : <Bell size={15} />} Remind me
        </button>
      )}
    </div>
  );
}

/** Upcoming Prakash Purab / Jyoti Jot / Shaheedi days, with the pictures the admin added. */
export default function Gurpurab({ onBookDate, focusId }) {
  const { site } = useSite();
  const lowEnd = useLowEnd();
  const today = site?.today;
  const events = useMemo(() => site?.gurpurabs || [], [site]);
  // One slide per picture; a day without pictures gets one designed slide.
  const slides = useMemo(
    () =>
      events.slice(0, 8).flatMap((event) =>
        event.images.length ? event.images.map((image, i) => ({ key: `${event.id}-${i}`, event, image })) : [{ key: event.id, event, image: '' }],
      ),
    [events],
  );
  const [[index, dir], setPage] = useState([0, 1]);
  const [paused, setPaused] = useState(false);
  const ref = useRef(null);
  const inView = useInView(ref, { margin: '-80px' });
  const count = slides.length;
  const current = slides[((index % count) + count) % count];

  const go = useCallback((next, direction) => setPage(([i]) => [next(i), direction]), []);
  const step = useCallback((d) => go((i) => (i + d + count) % count, d), [go, count]);
  const show = useCallback((eventId) => {
    const at = slides.findIndex((s) => s.event.id === eventId);
    if (at >= 0) go((i) => at, at >= index ? 1 : -1);
  }, [slides, go, index]);

  // Opened from a notification (/?gurpurab=id): show that day.
  useEffect(() => {
    if (focusId) show(focusId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId, count]);

  useEffect(() => {
    if (count < 2 || paused || !inView) return;
    const t = setTimeout(() => step(1), AUTOPLAY_MS);
    return () => clearTimeout(t);
  }, [index, count, paused, inView, step]);

  if (!count || !today) return null;
  const ev = current.event;

  return (
    <section id="gurpurab" className="section gurpurab" ref={ref}>
      <div className="container">
        <div className="section-head">
          <Reveal>
            <span className="eyebrow">Upcoming Gurpurab</span>
            <span className="gurmukhi-sub">ਗੁਰਪੁਰਬ</span>
          </Reveal>
          <SplitText className="section-title" text="Celebrate the Gurpurab with Gurbani Kirtan" highlight={[4, 5]} />
        </div>

        <Reveal className="gp-carousel glass" y={50} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
          <div className="gp-stage">
            <AnimatePresence initial={false} custom={dir} mode="popLayout">
              <motion.div
                key={current.key}
                className={`gp-slide k-${ev.kind}`}
                custom={dir}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                drag={count > 1 ? 'x' : false}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.18}
                onDragEnd={(_, info) => {
                  if (info.offset.x < -60 || info.velocity.x < -500) step(1);
                  else if (info.offset.x > 60 || info.velocity.x > 500) step(-1);
                }}
              >
                <Media slide={current} lowEnd={lowEnd} />
                <div className="gp-content">
                  <span className="gp-kind">
                    {ev.kindLabel} <span className="gurmukhi">· {ev.kindGurmukhi}</span>
                  </span>
                  {ev.gurmukhi && <p className="gp-gurmukhi gurmukhi">{ev.gurmukhi}</p>}
                  <h3>{ev.name}</h3>
                  <p className="gp-date">
                    <CalendarDays size={17} /> {prettyDate(ev.date, 'EEEE, d MMMM yyyy')}
                  </p>
                  <p className="gp-countdown">{countdown(ev.date, today)}</p>
                  <button type="button" className="btn btn-primary" onClick={() => onBookDate(ev.date)}>
                    <CalendarHeart size={18} /> Book kirtan for this day
                  </button>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {count > 1 && (
            <>
              <button type="button" className="icon-btn gp-arrow prev" onClick={() => step(-1)} aria-label="Previous">
                <ChevronLeft size={20} />
              </button>
              <button type="button" className="icon-btn gp-arrow next" onClick={() => step(1)} aria-label="Next">
                <ChevronRight size={20} />
              </button>
              <div className="gp-dots" role="tablist">
                {slides.map((s, i) => {
                  const active = s.key === current.key;
                  return (
                    <button key={s.key} type="button" role="tab" aria-selected={active} aria-label={s.event.name} className={active ? 'active' : ''} onClick={() => go(() => i, i >= index ? 1 : -1)}>
                      {active && !paused && inView && <motion.span key={`${current.key}-${index}`} className="gp-dot-fill" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: AUTOPLAY_MS / 1000, ease: 'linear' }} />}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </Reveal>

        <div className="gp-list">
          {events.slice(0, 10).map((e, i) => (
            <motion.button
              key={e.id}
              type="button"
              className={`gp-item k-${e.kind} ${e.id === ev.id ? 'active' : ''}`}
              onClick={() => show(e.id)}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-30px' }}
              transition={{ duration: 0.5, ease, delay: Math.min(i * 0.05, 0.4) }}
            >
              <span className="gp-item-date">
                <strong>{prettyDate(e.date, 'd')}</strong>
                {prettyDate(e.date, 'MMM')}
              </span>
              <span className="gp-item-text">
                <strong>{e.name}</strong>
                <small>
                  {e.kindLabel} · {countdown(e.date, today)}
                </small>
              </span>
            </motion.button>
          ))}
        </div>
        <Reminders />
      </div>
    </section>
  );
}
