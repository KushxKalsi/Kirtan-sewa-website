import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUpRight, ChevronLeft, ChevronRight, Clock, Plus } from 'lucide-react';
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, startOfMonth, startOfWeek } from 'date-fns';
import { fromKey, prettyDate, toKey } from '../lib/date';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Month view of bookings, for the admin and team dashboards. Each event is
 * { id, date, start, time, title, sub, tone, tag, onOpen } — `start` (HH:MM) sorts the day, `tone` colours it
 * ('pending' | 'confirmed' | 'completed' | 'cancelled' | 'team' | 'leave' | 'busy'). `legend` is [[tone, label], …].
 * With `onAdd`, the agenda of today or a later day has an `addLabel` button that calls onAdd(date).
 */
export default function BookingCalendar({ events, today, legend = [], empty = 'Nothing booked on this day.', onAdd, addLabel = 'Add', children }) {
  const [month, setMonth] = useState(() => startOfMonth(fromKey(today)));
  const [selected, setSelected] = useState(today);
  const [dir, setDir] = useState(1);

  const byDay = useMemo(() => {
    const map = {};
    for (const e of events) (map[e.date] ||= []).push(e);
    for (const list of Object.values(map)) list.sort((a, b) => (a.start || '').localeCompare(b.start || ''));
    return map;
  }, [events]);
  const days = useMemo(() => eachDayOfInterval({ start: startOfWeek(startOfMonth(month)), end: endOfWeek(endOfMonth(month)) }), [month]);
  const inMonth = days.filter((d) => isSameMonth(d, month)).reduce((t, d) => t + (byDay[toKey(d)]?.length || 0), 0);

  const showMonth = (next) => {
    const m = startOfMonth(next);
    if (+m === +month) return;
    setDir(m > month ? 1 : -1);
    setMonth(m);
  };
  const pick = (d) => {
    setSelected(toKey(d));
    showMonth(d); // a day from the next / last month opens that month
  };
  const list = byDay[selected] || [];

  return (
    <div className="bcal">
      <div className="calendar bcal-month glass">
        <div className="cal-head">
          <button className="icon-btn" onClick={() => showMonth(addMonths(month, -1))} aria-label="Previous month">
            <ChevronLeft size={18} />
          </button>
          <div className="cal-title-wrap">
            <AnimatePresence mode="popLayout" initial={false} custom={dir}>
              <motion.h3
                key={format(month, 'yyyy-MM')}
                className="cal-title"
                initial={{ y: dir * 24, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: dir * -24, opacity: 0 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              >
                {format(month, 'MMMM')} <span>{format(month, 'yyyy')}</span>
              </motion.h3>
            </AnimatePresence>
          </div>
          <button className="icon-btn" onClick={() => showMonth(addMonths(month, 1))} aria-label="Next month">
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="bcal-bar">
          <span className="muted">
            {inMonth} booking{inMonth === 1 ? '' : 's'} this month
          </span>
          <button type="button" className="link-btn" onClick={() => pick(fromKey(today))}>
            Today
          </button>
        </div>

        <div className="cal-weekdays">
          {WEEKDAYS.map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
        <div className="cal-body">
          <AnimatePresence mode="popLayout" initial={false} custom={dir}>
            <motion.div
              key={format(month, 'yyyy-MM')}
              className="cal-grid bcal-grid"
              initial={{ x: dir * 60, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: dir * -60, opacity: 0 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            >
              {days.map((d) => {
                const key = toKey(d);
                const day = byDay[key] || [];
                const isSel = selected === key;
                return (
                  <button
                    key={key}
                    type="button"
                    className={`bcal-day ${isSameMonth(d, month) ? '' : 'out'} ${key < today ? 'past' : ''} ${key === today ? 'today' : ''} ${isSel ? 'selected' : ''} ${day.length ? 'has' : ''}`}
                    onClick={() => pick(d)}
                    aria-pressed={isSel}
                    aria-label={`${format(d, 'd MMMM')} — ${day.length ? `${day.length} booking${day.length > 1 ? 's' : ''}` : 'nothing booked'}`}
                  >
                    {isSel && <motion.span layoutId="bcal-selected" className="bcal-sel-bg" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                    <span className="bcal-num">{format(d, 'd')}</span>
                    {day.length > 0 && (
                      <>
                        <span className="bcal-evs">
                          {day.slice(0, 2).map((e) => (
                            <span key={e.id} className={`bcal-ev t-${e.tone}`}>
                              {e.title}
                            </span>
                          ))}
                          {day.length > 2 && <span className="bcal-more">+{day.length - 2} more</span>}
                        </span>
                        <span className="bcal-dots">
                          {day.slice(0, 4).map((e) => (
                            <i key={e.id} className={`t-${e.tone}`} />
                          ))}
                        </span>
                      </>
                    )}
                  </button>
                );
              })}
            </motion.div>
          </AnimatePresence>
        </div>

        {legend.length > 0 && (
          <div className="cal-legend">
            {legend.map(([tone, label]) => (
              <span key={tone}>
                <i className={`t-${tone}`} /> {label}
              </span>
            ))}
          </div>
        )}
        {children}
      </div>

      <aside className="bcal-agenda glass">
        <header>
          <h3>{prettyDate(selected, 'EEEE')}</h3>
          <span className="muted">
            {prettyDate(selected, 'd MMMM yyyy')}
            {list.length > 0 && ` · ${list.length} booking${list.length > 1 ? 's' : ''}`}
          </span>
        </header>
        {list.length === 0 && <p className="muted">{empty}</p>}
        <AnimatePresence mode="popLayout" initial={false}>
          {list.map((e, i) => (
            <motion.button
              key={selected + e.id}
              type="button"
              className={`bcal-item t-${e.tone}`}
              onClick={e.onOpen}
              disabled={!e.onOpen}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, delay: Math.min(i, 6) * 0.04 }}
            >
              <span className="bcal-time">
                <Clock size={13} /> {e.time}
              </span>
              <strong>{e.title}</strong>
              {e.sub && <span className="muted">{e.sub}</span>}
              {e.tag && <span className={`bcal-tag t-${e.tone}`}>{e.tag}</span>}
              {e.onOpen && <ArrowUpRight size={16} className="bcal-open" />}
            </motion.button>
          ))}
        </AnimatePresence>
        {onAdd && selected >= today && (
          <button type="button" className="btn btn-ghost btn-sm bcal-add" onClick={() => onAdd(selected)}>
            <Plus size={15} /> {addLabel}
          </button>
        )}
      </aside>
    </div>
  );
}
