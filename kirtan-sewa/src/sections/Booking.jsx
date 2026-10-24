import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { addDays, endOfMonth, format, startOfMonth } from 'date-fns';
import { ArrowLeft, ArrowRight, CalendarDays, CalendarHeart, Clock, Loader2, CircleAlert, MapPin, MousePointerClick } from 'lucide-react';
import Calendar from '../components/Calendar';
import SplitText from '../components/SplitText';
import Reveal from '../components/Reveal';
import BookingSuccess from '../components/BookingSuccess';
import { useSite } from '../components/SiteContext';
import { useToast } from '../components/Toast';
import { api } from '../lib/api';
import { fromKey, prettyDate, slotTime, toKey } from '../lib/date';
import { rememberBooking } from '../lib/storage';
import { serviceIcon } from '../lib/icons';
import { scrollToId } from '../lib/scroll';
import { ease } from '../lib/motion';

const nowHHMM = () => format(new Date(), 'HH:mm');
const emptyForm = { name: '', phone: '', email: '', address: '', notes: '' };

const panelAnim = {
  initial: { opacity: 0, x: 40, filter: 'blur(6px)' },
  animate: { opacity: 1, x: 0, filter: 'blur(0px)', transition: { duration: 0.55, ease } },
  exit: { opacity: 0, x: -40, filter: 'blur(6px)', transition: { duration: 0.3, ease } },
};

export default function Booking({ preselect }) {
  const { site } = useSite();
  const toast = useToast();
  const services = useMemo(() => site?.services || [], [site]);
  const slots = useMemo(() => site?.slots || [], [site]);
  const today = site?.today || toKey(new Date());
  const maxDate = toKey(addDays(fromKey(today), Number(site?.settings.maxAdvanceDays) || 365));

  const [serviceId, setServiceId] = useState('');
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [date, setDate] = useState('');
  const [slotId, setSlotId] = useState('');
  const [step, setStep] = useState('pick');
  const [booked, setBooked] = useState([]);
  const [blocked, setBlocked] = useState([]);
  const [loadingAvail, setLoadingAvail] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const panelRef = useRef(null);

  const service = services.find((s) => s.id === serviceId) || null;
  const [nudge, setNudge] = useState(0); // bumps to shake the sewa picker when a sewa is still missing

  useEffect(() => {
    if (!preselect) return;
    setServiceId(preselect.id);
    setSlotId('');
    setStep('pick');
    scrollToId('book');
  }, [preselect]);

  const loadAvailability = useCallback(async () => {
    setLoadingAvail(true);
    try {
      const data = await api.availability(toKey(startOfMonth(month)), toKey(endOfMonth(month)));
      setBooked(data.booked);
      setBlocked(data.blockedDates);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setLoadingAvail(false);
    }
  }, [month, toast]);

  useEffect(() => {
    loadAvailability();
  }, [loadAvailability]);

  // Keep the calendar fresh when people come back to the tab.
  useEffect(() => {
    const onFocus = () => document.visibilityState === 'visible' && loadAvailability();
    document.addEventListener('visibilitychange', onFocus);
    return () => document.removeEventListener('visibilitychange', onFocus);
  }, [loadAvailability]);

  const bookedMap = useMemo(() => new Map(booked.map((b) => [`${b.date}|${b.slotId}`, b])), [booked]);
  const isOffered = useCallback((slot) => !service?.allowedSlots?.length || service.allowedSlots.includes(slot.id), [service]);

  const slotState = useCallback(
    (key, slot) => {
      if (bookedMap.has(`${key}|${slot.id}`)) return 'booked';
      if (!isOffered(slot)) return 'not-offered';
      if (key === today && slot.start <= nowHHMM()) return 'passed';
      return 'free';
    },
    [bookedMap, isOffered, today],
  );

  const getDay = useCallback(
    (key) => {
      if (key < today) return { state: 'past' };
      if (key > maxDate) return { state: 'closed' };
      if (blocked.includes(key)) return { state: 'blocked' };
      const states = slots.map((sl) => slotState(key, sl));
      const daySlots = states.map((st) => ({ booked: st === 'booked', offered: st === 'free' }));
      const offered = slots.filter((sl, i) => isOffered(sl) && states[i] !== 'passed').length;
      const free = states.filter((st) => st === 'free').length;
      if (offered === 0) return { state: 'closed', slots: daySlots };
      if (free === 0) return { state: 'full', slots: daySlots };
      if (free < offered) return { state: 'partial', slots: daySlots };
      return { state: 'free', slots: daySlots };
    },
    [today, maxDate, blocked, slots, slotState, isOffered],
  );

  // If the chosen service changes, drop a slot it does not offer.
  useEffect(() => {
    if (date && slotId) {
      const sl = slots.find((s) => s.id === slotId);
      if (!sl || slotState(date, sl) !== 'free') setSlotId('');
    }
  }, [serviceId, date, slotId, slots, slotState]);

  const pickDate = (key) => {
    setDate(key);
    setSlotId('');
    setStep('pick');
    if (window.innerWidth < 960) setTimeout(() => scrollToId(panelRef.current, -90), 80);
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const { booking } = await api.createBooking({ serviceId: service.id, date, slotId, ...form });
      rememberBooking(booking, form.phone);
      setResult(booking);
      setStep('success');
      loadAvailability();
      setTimeout(() => scrollToId(panelRef.current, -90), 50);
    } catch (err) {
      setError(err.message);
      if (err.status === 409) loadAvailability();
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setForm(emptyForm);
    setDate('');
    setSlotId('');
    setResult(null);
    setStep('pick');
  };

  const slot = slots.find((s) => s.id === slotId);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <section id="book" className="section booking">
      <div className="container">
        <div className="section-head">
          <Reveal>
            <span className="eyebrow">Live calendar</span>
            <span className="gurmukhi-sub">ਬੁਕਿੰਗ</span>
          </Reveal>
          <SplitText className="section-title" text="Check availability & book your date" highlight={[3, 4, 5]} />
          <Reveal delay={0.1}>
            <p className="section-lead">Every booked slot shows on the calendar in real time. Pick a sewa, a date and a time — it takes under a minute.</p>
          </Reveal>
        </div>

        <Reveal className="booking-shell glass" y={60}>
          <div className="booking-left">
            <p className={`step-hint ${service ? 'done' : ''}`}>
              <span className="step-num">1</span>
              {service ? (
                <>
                  Booking for <strong style={{ color: service.color }}>{service.name}</strong>
                </>
              ) : (
                'Choose the sewa you want to book'
              )}
            </p>
            <motion.div
              key={nudge}
              className={`svc-picker ${service ? '' : 'needs-choice'}`}
              role="radiogroup"
              aria-label="Choose a sewa"
              animate={nudge ? { x: [0, -10, 10, -6, 6, 0] } : undefined}
              transition={{ duration: 0.5 }}
            >
              {services.map((s) => {
                const Icon = serviceIcon(s.icon);
                const active = s.id === service?.id;
                return (
                  <button
                    key={s.id}
                    role="radio"
                    aria-checked={active}
                    className={`svc-chip ${active ? 'active' : ''}`}
                    onClick={() => {
                      setServiceId(s.id);
                      if (step === 'details') setStep('pick');
                    }}
                    style={{ '--accent': s.color }}
                  >
                    {active && <motion.span layoutId="svc-active" className="svc-chip-bg" transition={{ type: 'spring', stiffness: 400, damping: 34 }} />}
                    <Icon size={16} />
                    <span>{s.name}</span>
                  </button>
                );
              })}
            </motion.div>

            <div className="cal-wrap">
              <AnimatePresence>
                {loadingAvail && (
                  <motion.div className="cal-loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <Loader2 size={16} className="spin" />
                  </motion.div>
                )}
              </AnimatePresence>
              <Calendar
                month={month}
                onMonthChange={setMonth}
                selected={date}
                onSelect={pickDate}
                getDay={getDay}
                minMonth={fromKey(today)}
                maxMonth={fromKey(maxDate)}
                todayKey={today}
              />
            </div>
          </div>

          <div className="booking-right" ref={panelRef}>
            <AnimatePresence mode="wait">
              {step === 'success' && result ? (
                <motion.div key="success" {...panelAnim}>
                  <BookingSuccess booking={result} phone={form.phone} onAgain={reset} />
                </motion.div>
              ) : step === 'details' && slot ? (
                <motion.form key="details" className="details-form" onSubmit={submit} {...panelAnim}>
                  <button type="button" className="back-link" onClick={() => setStep('pick')}>
                    <ArrowLeft size={16} /> Change date or time
                  </button>
                  <h3 className="panel-title">Your details</h3>
                  <div className="summary-chips">
                    <span className="chip" style={{ color: service.color }}>
                      {service.name}
                    </span>
                    <span className="chip">
                      <CalendarDays size={13} /> {prettyDate(date, 'EEE, d MMM yyyy')}
                    </span>
                    <span className="chip">
                      <Clock size={13} /> {slot.label} · {slotTime(slot)}
                    </span>
                  </div>
                  <motion.div className="form-stack" initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } } }}>
                    {[
                      { k: 'name', label: 'Full name *', type: 'text', auto: 'name', required: true },
                      { k: 'phone', label: 'Phone / WhatsApp *', type: 'tel', auto: 'tel', required: true, mode: 'tel' },
                      { k: 'email', label: 'Email (optional)', type: 'email', auto: 'email' },
                    ].map((f) => (
                      <motion.label key={f.k} className="field" variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}>
                        <input type={f.type} value={form[f.k]} onChange={set(f.k)} placeholder=" " autoComplete={f.auto} required={f.required} inputMode={f.mode} />
                        <span>{f.label}</span>
                      </motion.label>
                    ))}
                    <motion.label className="field" variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}>
                      <textarea value={form.address} onChange={set('address')} placeholder=" " rows={2} required autoComplete="street-address" />
                      <span>Venue address *</span>
                    </motion.label>
                    <motion.label className="field" variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}>
                      <textarea value={form.notes} onChange={set('notes')} placeholder=" " rows={2} />
                      <span>Occasion / special requests (optional)</span>
                    </motion.label>
                  </motion.div>

                  <AnimatePresence>
                    {error && (
                      <motion.div key={error} className="form-error" initial={{ opacity: 0, x: 0 }} animate={{ opacity: 1, x: [0, -8, 8, -5, 5, 0] }} exit={{ opacity: 0 }} transition={{ duration: 0.45 }}>
                        <CircleAlert size={18} /> {error}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <button className="btn btn-primary btn-block" disabled={submitting}>
                    {submitting ? <Loader2 size={18} className="spin" /> : <CalendarHeart size={18} />}
                    {submitting ? 'Booking…' : 'Confirm booking request'}
                  </button>
                  <p className="fine-print">
                    The sewa and venue address will be shown on the public calendar so the sangat knows where the jatha is. Manage your booking anytime with your phone number — the jatha will call you to confirm.
                  </p>
                </motion.form>
              ) : date ? (
                <motion.div key={`slots-${date}`} {...panelAnim}>
                  <p className="panel-kicker">{format(fromKey(date), 'EEEE')}</p>
                  <h3 className="panel-title">{prettyDate(date, 'd MMMM yyyy')}</h3>
                  <p className="panel-sub">
                    {service ? (
                      <>
                        Choose a time for <strong style={{ color: service.color }}>{service.name}</strong>
                      </>
                    ) : (
                      'See what is booked below. To book a free slot, first choose your sewa (step 1).'
                    )}
                  </p>
                  <motion.div className="slot-list" initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}>
                    {slots.map((sl) => {
                      const st = slotState(date, sl);
                      const selected = slotId === sl.id;
                      const info = bookedMap.get(`${date}|${sl.id}`);
                      return (
                        <motion.button
                          key={sl.id}
                          type="button"
                          className={`slot s-${st} ${selected ? 'selected' : ''}`}
                          disabled={st !== 'free'}
                          onClick={() => {
                            if (service) return setSlotId(sl.id);
                            setNudge((n) => n + 1);
                            if (window.innerWidth < 960) scrollToId('book', -20);
                          }}
                          variants={{ hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: { duration: 0.45, ease } } }}
                          whileTap={st === 'free' ? { scale: 0.97 } : undefined}
                        >
                          {selected && <motion.span layoutId="slot-selected" className="slot-sel-bg" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                          <span className="slot-main">
                            <strong>{sl.label}</strong>
                            <span>{slotTime(sl)}</span>
                            {info && (
                              <span className="slot-booked-info">
                                <em>{info.serviceName}</em>
                                {info.location && (
                                  <span>
                                    <MapPin size={12} /> {info.location}
                                  </span>
                                )}
                              </span>
                            )}
                          </span>
                          <span className="slot-status">
                            {st === 'free' ? (selected ? 'Selected' : service ? 'Available' : 'Free') : st === 'booked' ? 'Booked' : st === 'passed' ? 'Time passed' : 'Not offered'}
                          </span>
                        </motion.button>
                      );
                    })}
                  </motion.div>
                  <AnimatePresence>
                    {slotId && (
                      <motion.div initial={{ opacity: 0, y: 20, height: 0 }} animate={{ opacity: 1, y: 0, height: 'auto' }} exit={{ opacity: 0, y: 10, height: 0 }} transition={{ duration: 0.4, ease }}>
                        <button className="btn btn-primary btn-block continue-btn" onClick={() => setStep('details')}>
                          Continue <ArrowRight size={18} />
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ) : (
                <motion.div key="empty" className="panel-empty" {...panelAnim}>
                  <motion.div className="empty-icon" animate={{ y: [0, -10, 0] }} transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}>
                    {service ? <CalendarDays size={34} /> : <MousePointerClick size={34} />}
                  </motion.div>
                  <h3 className="panel-title">{service ? 'Pick a date' : 'Choose your sewa'}</h3>
                  <p className="panel-sub">
                    {service
                      ? 'Tap a day on the calendar to see its time slots. Dots under each date show which slots are already booked.'
                      : 'Start by choosing which sewa you want to book. You can also tap any day to see what is already booked there and where.'}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
