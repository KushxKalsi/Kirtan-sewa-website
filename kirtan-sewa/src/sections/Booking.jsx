import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { addDays, endOfMonth, format, startOfMonth } from 'date-fns';
import { ArrowLeft, ArrowRight, CalendarDays, CalendarHeart, Check, Loader2, CircleAlert, MapPin, MousePointerClick, X } from 'lucide-react';
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
import { PAY_OPTIONS } from '../lib/money';

const nowHHMM = () => format(new Date(), 'HH:mm');
const emptyForm = { name: '', phone: '', email: '', address: '', notes: '', paymentMethod: '' };

const MAX_ITEMS = 20;
const keyOf = (date, slotId) => `${date}|${slotId}`;

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
  const [selection, setSelection] = useState([]); // [{ serviceId, date, slotId }] — many slots across dates
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
  const settings = site?.settings || {};
  const payMethods = [settings.upiEnabled && settings.upiId && 'upi', settings.cashEnabled && 'cash'].filter(Boolean);
  const [nudge, setNudge] = useState(0); // bumps to shake the sewa picker when a sewa is still missing

  useEffect(() => {
    if (!preselect) return;
    setServiceId(preselect.id);
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

  const bookedMap = useMemo(() => new Map(booked.map((b) => [keyOf(b.date, b.slotId), b])), [booked]);
  const pickedMap = useMemo(() => new Map(selection.map((it) => [keyOf(it.date, it.slotId), it])), [selection]);
  const serviceById = useCallback((id) => services.find((x) => x.id === id), [services]);
  const slotById = useCallback((id) => slots.find((x) => x.id === id), [slots]);
  const sortedSelection = useMemo(
    () => [...selection].sort((a, b) => (a.date + slotById(a.slotId)?.start).localeCompare(b.date + slotById(b.slotId)?.start)),
    [selection, slotById],
  );
  const isOffered = useCallback((slot) => !service?.allowedSlots?.length || service.allowedSlots.includes(slot.id), [service]);

  const slotState = useCallback(
    (key, slot) => {
      if (bookedMap.has(keyOf(key, slot.id))) return 'booked';
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
      const daySlots = states.map((st, i) => ({ booked: st === 'booked', offered: st === 'free', picked: pickedMap.has(keyOf(key, slots[i].id)) }));
      const picked = daySlots.filter((d) => d.picked).length;
      const offered = slots.filter((sl, i) => isOffered(sl) && states[i] !== 'passed').length;
      const free = states.filter((st) => st === 'free').length;
      if (offered === 0) return { state: 'closed', slots: daySlots, picked };
      if (free === 0) return { state: 'full', slots: daySlots, picked };
      if (free < offered) return { state: 'partial', slots: daySlots, picked };
      return { state: 'free', slots: daySlots, picked };
    },
    [today, maxDate, blocked, slots, slotState, isOffered, pickedMap],
  );

  // Drop picked slots that someone else booked (or that got blocked) since they were picked.
  useEffect(() => {
    const keep = selection.filter((it) => !bookedMap.has(keyOf(it.date, it.slotId)) && !blocked.includes(it.date));
    if (keep.length === selection.length) return;
    setSelection(keep);
    toast('A slot you picked was just booked by someone else, so it was removed.', 'error');
  }, [selection, bookedMap, blocked, toast]);

  const toggleSlot = (sl) => {
    const key = keyOf(date, sl.id);
    if (pickedMap.has(key)) return setSelection((list) => list.filter((it) => keyOf(it.date, it.slotId) !== key));
    if (!service) {
      setNudge((n) => n + 1);
      if (window.innerWidth < 960) scrollToId('book', -20);
      return;
    }
    if (selection.length >= MAX_ITEMS) return toast(`You can book up to ${MAX_ITEMS} slots at once.`, 'error');
    setSelection((list) => [...list, { serviceId: service.id, date, slotId: sl.id }]);
  };
  const removeItem = (it) => setSelection((list) => list.filter((x) => x !== it));

  const pickDate = (key) => {
    setDate(key);
    setStep('pick');
    if (window.innerWidth < 960) setTimeout(() => scrollToId(panelRef.current, -90), 80);
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (payMethods.length && !payMethods.includes(form.paymentMethod)) return setError('Please choose how you would like to pay — UPI or cash.');
    setSubmitting(true);
    try {
      const { bookings } = await api.createBooking({ items: selection, ...form });
      bookings.forEach((b) => rememberBooking(b, form.phone));
      setResult(bookings);
      setSelection([]); // clear first, so the refresh below doesn't treat our own new bookings as taken
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
    setSelection([]);
    setResult(null);
    setStep('pick');
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const basket = (editable) => (
    <div className="basket">
      <p className="basket-title">
        Your selection <span>{selection.length}</span>
      </p>
      <motion.ul layout>
        <AnimatePresence initial={false}>
          {sortedSelection.map((it) => {
            const svc = serviceById(it.serviceId);
            const sl = slotById(it.slotId);
            return (
              <motion.li
                key={keyOf(it.date, it.slotId)}
                layout
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.3, ease }}
                style={{ '--accent': svc?.color }}
              >
                <button type="button" className="basket-item" onClick={() => editable && pickDate(it.date)} disabled={!editable}>
                  <strong>{prettyDate(it.date, 'EEE, d MMM')}</strong>
                  <span>
                    {sl?.label} · {sl && slotTime(sl)}
                  </span>
                  <em>{svc?.name}</em>
                </button>
                {editable && (
                  <button type="button" className="icon-btn basket-remove" onClick={() => removeItem(it)} aria-label="Remove">
                    <X size={15} />
                  </button>
                )}
              </motion.li>
            );
          })}
        </AnimatePresence>
      </motion.ul>
      {editable && (
        <div className="basket-continue">
          <button type="button" className="btn btn-primary btn-block" onClick={() => setStep('details')}>
            Continue with {selection.length} slot{selection.length > 1 ? 's' : ''} <ArrowRight size={18} />
          </button>
          <p className="fine-print">Tip: pick more dates on the calendar, or switch sewa, to add more slots.</p>
        </div>
      )}
    </div>
  );

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
            <p className="section-lead">Every booked slot shows on the calendar in real time. Pick a sewa, then as many dates and times as you need — and book them all at once.</p>
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
                  <BookingSuccess bookings={result} phone={form.phone} onAgain={reset} />
                </motion.div>
              ) : step === 'details' && selection.length ? (
                <motion.form key="details" className="details-form" onSubmit={submit} {...panelAnim}>
                  <button type="button" className="back-link" onClick={() => setStep('pick')}>
                    <ArrowLeft size={16} /> Change dates or times
                  </button>
                  <h3 className="panel-title">Your details</h3>
                  {basket(false)}
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

                  {payMethods.length > 0 && (
                    <div className="pay-choose">
                      <span className="label">How would you like to pay? *</span>
                      <div className="pay-options" role="radiogroup">
                        {payMethods.map((m) => {
                          const opt = PAY_OPTIONS[m];
                          const on = form.paymentMethod === m;
                          return (
                            <button type="button" role="radio" aria-checked={on} key={m} className={`pay-option ${on ? 'active' : ''}`} onClick={() => setForm((f) => ({ ...f, paymentMethod: m }))}>
                              {on && <motion.span layoutId="pay-option" className="pay-option-bg" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                              <opt.icon size={20} />
                              <span>
                                <strong>{opt.label}</strong>
                                <small>{opt.sub}</small>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      <p className="fine-print">You pay after the jatha confirms and sends your bill. You can change this later under “Manage booking”.</p>
                    </div>
                  )}

                  <AnimatePresence>
                    {error && (
                      <motion.div key={error} className="form-error" initial={{ opacity: 0, x: 0 }} animate={{ opacity: 1, x: [0, -8, 8, -5, 5, 0] }} exit={{ opacity: 0 }} transition={{ duration: 0.45 }}>
                        <CircleAlert size={18} /> {error}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <button className="btn btn-primary btn-block" disabled={submitting}>
                    {submitting ? <Loader2 size={18} className="spin" /> : <CalendarHeart size={18} />}
                    {submitting ? 'Booking…' : selection.length > 1 ? `Request all ${selection.length} bookings` : 'Confirm booking request'}
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
                        Tap one or more times to add <strong style={{ color: service.color }}>{service.name}</strong> — you can add other dates too
                      </>
                    ) : (
                      'See what is booked below. To book a free slot, first choose your sewa (step 1).'
                    )}
                  </p>
                  <motion.div className="slot-list" initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}>
                    {slots.map((sl) => {
                      const st = slotState(date, sl);
                      const pickedItem = pickedMap.get(keyOf(date, sl.id));
                      const selected = !!pickedItem;
                      const info = bookedMap.get(`${date}|${sl.id}`);
                      return (
                        <motion.button
                          key={sl.id}
                          type="button"
                          className={`slot s-${st} ${selected ? 'selected' : ''}`}
                          disabled={st !== 'free' && !selected}
                          aria-pressed={selected}
                          onClick={() => toggleSlot(sl)}
                          variants={{ hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: { duration: 0.45, ease } } }}
                          whileTap={st === 'free' || selected ? { scale: 0.97 } : undefined}
                        >
                          {selected && <motion.span className="slot-sel-bg" initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 420, damping: 30 }} />}
                          <span className="slot-main">
                            <strong>{sl.label}</strong>
                            <span>{slotTime(sl)}</span>
                            {info && (
                              <span className="slot-booked-info">
                                <em>{info.serviceName || services.find((x) => x.id === info.serviceId)?.name || 'Booked'}</em>
                                {info.location && (
                                  <span>
                                    <MapPin size={12} /> {info.location}
                                  </span>
                                )}
                              </span>
                            )}
                          </span>
                          <span className="slot-status">
                            {selected ? (
                              <>
                                <Check size={14} /> {serviceById(pickedItem.serviceId)?.name}
                              </>
                            ) : st === 'free' ? (
                              service ? 'Tap to add' : 'Free'
                            ) : st === 'booked' ? (
                              'Booked'
                            ) : st === 'passed' ? (
                              'Time passed'
                            ) : (
                              'Not offered'
                            )}
                          </span>
                        </motion.button>
                      );
                    })}
                  </motion.div>
                  <AnimatePresence>
                    {selection.length > 0 && (
                      <motion.div initial={{ opacity: 0, y: 20, height: 0 }} animate={{ opacity: 1, y: 0, height: 'auto' }} exit={{ opacity: 0, y: 10, height: 0 }} transition={{ duration: 0.4, ease }}>
                        {basket(true)}
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
                  {selection.length > 0 && basket(true)}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
