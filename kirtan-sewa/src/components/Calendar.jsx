import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { addMonths, endOfMonth, endOfWeek, format, isSameMonth, startOfMonth, startOfWeek, eachDayOfInterval } from 'date-fns';
import { toKey } from '../lib/date';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Month calendar. `getDay(key)` returns { state, slots: [{booked, offered}] } where state is one of
 * 'free' | 'partial' | 'full' | 'blocked' | 'past' | 'closed'.
 */
export default function Calendar({ month, onMonthChange, selected, onSelect, getDay, minMonth, maxMonth, todayKey }) {
  const [dir, setDir] = useState(1);
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month));
    const end = endOfWeek(endOfMonth(month));
    return eachDayOfInterval({ start, end });
  }, [month]);

  const canPrev = !minMonth || startOfMonth(month) > startOfMonth(minMonth);
  const canNext = !maxMonth || startOfMonth(month) < startOfMonth(maxMonth);
  const change = (n) => {
    setDir(n);
    onMonthChange(addMonths(month, n));
  };

  return (
    <div className="calendar">
      <div className="cal-head">
        <button className="icon-btn" onClick={() => change(-1)} disabled={!canPrev} aria-label="Previous month">
          <ChevronLeft size={18} />
        </button>
        <div className="cal-title-wrap">
          <AnimatePresence mode="popLayout" initial={false} custom={dir}>
            <motion.h3
              key={format(month, 'yyyy-MM')}
              className="cal-title"
              custom={dir}
              initial={{ y: dir * 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: dir * -24, opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
              {format(month, 'MMMM')} <span>{format(month, 'yyyy')}</span>
            </motion.h3>
          </AnimatePresence>
        </div>
        <button className="icon-btn" onClick={() => change(1)} disabled={!canNext} aria-label="Next month">
          <ChevronRight size={18} />
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
            className="cal-grid"
            custom={dir}
            initial={{ x: dir * 60, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: dir * -60, opacity: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            {days.map((d, i) => {
              const key = toKey(d);
              const inMonth = isSameMonth(d, month);
              const info = getDay(key);
              const disabled = !inMonth || ['past', 'blocked', 'closed'].includes(info.state);
              const isSel = selected === key;
              return (
                <motion.button
                  key={key}
                  type="button"
                  className={`cal-day s-${info.state} ${inMonth ? '' : 'out'} ${isSel ? 'selected' : ''} ${key === todayKey ? 'today' : ''} ${info.picked ? 'has-picked' : ''}`}
                  disabled={disabled}
                  onClick={() => onSelect(key)}
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: Math.min(i * 0.008, 0.3), duration: 0.3 }}
                  whileTap={disabled ? undefined : { scale: 0.9 }}
                  aria-label={`${format(d, 'd MMMM')} — ${info.state}`}
                  aria-pressed={isSel}
                >
                  {isSel && <motion.span layoutId="cal-selected" className="cal-sel-bg" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                  <span className="cal-num">{format(d, 'd')}</span>
                  <AnimatePresence>
                    {inMonth && info.picked > 0 && (
                      <motion.span key={info.picked} className="cal-picked" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 22 }}>
                        {info.picked}
                      </motion.span>
                    )}
                  </AnimatePresence>
                  {inMonth && info.slots?.length > 0 && info.state !== 'past' && info.state !== 'blocked' && (
                    <span className="cal-dots">
                      {info.slots.map((sl, j) => (
                        <i key={j} className={sl.booked ? 'b' : sl.picked ? 'p' : sl.offered ? 'f' : 'n'} />
                      ))}
                    </span>
                  )}
                </motion.button>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="cal-legend">
        <span>
          <i className="lg-free" /> Available
        </span>
        <span>
          <i className="lg-picked" /> Your pick
        </span>
        <span>
          <i className="lg-partial" /> Few slots left
        </span>
        <span>
          <i className="lg-full" /> Fully booked
        </span>
        <span>
          <i className="lg-blocked" /> Unavailable
        </span>
      </div>
    </div>
  );
}
