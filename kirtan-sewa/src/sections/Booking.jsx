import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { addDays, endOfMonth, format, startOfMonth } from 'date-fns';
import { ArrowLeft, ArrowRight, CalendarDays, CalendarHeart, Check, Clock, Loader2, LogOut, Sparkles, CircleAlert, MapPin, MousePointerClick, Plus, Tag, X } from 'lucide-react';
import Calendar from '../components/Calendar';
import SplitText from '../components/SplitText';
import Reveal from '../components/Reveal';
import BookingSuccess from '../components/BookingSuccess';
import AuthForm from '../components/AuthForm';
import LocationPicker from '../components/LocationPicker';
import IntlTours from '../components/IntlTours';
import { useAuth } from '../components/AuthContext';
import { useSite } from '../components/SiteContext';
import { useToast } from '../components/Toast';
import { api } from '../lib/api';
import { fromKey, prettyDate, rangeTo12, slotTime, toKey } from '../lib/date';
import { serviceIcon } from '../lib/icons';
import { scrollToId } from '../lib/scroll';
import { ease } from '../lib/motion';
import { PAY_OPTIONS, rupees } from '../lib/money';

const nowHHMM = () => format(new Date(), 'HH:mm');
const emptyForm = { name: '', email: '', address: '', location: null, notes: '', paymentMethod: '', offer: '', offerNote: '' };

const MAX_ITEMS = 20;
const CUSTOM = 'custom';
// One picked sewa at one time; two different sewas may share a time.
const itemKey = (it) => [it.date, it.slotId, it.start, it.end, it.serviceId, it.categoryId].join('|');
const overlaps = (s1, e1, s2, e2) => s1 < e2 && s2 < e1; // HH:MM strings compare correctly
const rangeOf = (time) => (time || '').split('–').map((t) => t.trim());
const minutes = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));

const panelAnim = {
  initial: { opacity: 0, x: 40, filter: 'blur(6px)' },
  animate: { opacity: 1, x: 0, filter: 'blur(0px)', transition: { duration: 0.55, ease } },
  exit: { opacity: 0, x: -40, filter: 'blur(6px)', transition: { duration: 0.3, ease } },
};

export default function Booking({ preselect }) {
  const { site } = useSite();
  const { session, user, logout } = useAuth();
  const toast = useToast();
  const services = useMemo(() => site?.services || [], [site]);
  const slots = useMemo(() => site?.slots || [], [site]);
  const today = site?.today || toKey(new Date());
  const maxDate = toKey(addDays(fromKey(today), Number(site?.settings.maxAdvanceDays) || 365));

  const [categoryId, setCategoryId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [date, setDate] = useState('');
  const [selection, setSelection] = useState([]); // [{ categoryId, serviceId, date, slotId, start?, end? }] — many slots across dates
  const [customOpen, setCustomOpen] = useState(false);
  const [custom, setCustom] = useState({ start: '', end: '' });
  const [customError, setCustomError] = useState('');
  const [step, setStep] = useState('pick');
  const [booked, setBooked] = useState([]);
  const [blocked, setBlocked] = useState([]);
  const [blockedTimes, setBlockedTimes] = useState([]); // only the admin makes a time unavailable
  const [loadingAvail, setLoadingAvail] = useState(false);
  const [form, setForm] = useState(emptyForm);
  // Booking needs a sangat login; the name starts from the account.
  useEffect(() => {
    if (session?.role === 'user' && session.name) setForm((f) => (f.name ? f : { ...f, name: session.name }));
  }, [session]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const panelRef = useRef(null);

  // Step 1 is the category (e.g. Kirtan with Raag / with Kavishri); it decides which sewas can be picked.
  const categories = useMemo(() => site?.categories || [], [site]);
  const hasCats = categories.length > 0;
  const category = categories.find((c) => c.id === categoryId) || null;
  const visibleServices = hasCats ? (category ? services.filter((s) => category.serviceIds.includes(s.id)) : []) : services;
  const service = visibleServices.find((s) => s.id === serviceId) || null;
  const categoryById = useCallback((id) => categories.find((c) => c.id === id), [categories]);

  const chooseCategory = (c) => {
    setCategoryId(c.id);
    const inCat = services.filter((s) => c.serviceIds.includes(s.id));
    if (inCat.length === 1) setServiceId(inCat[0].id); // e.g. Kavishri only has Kirtan Diwan
    else if (!c.serviceIds.includes(serviceId)) setServiceId('');
    if (step === 'details') setStep('pick');
  };
  const settings = site?.settings || {};
  const gurpurabsOn = useCallback((key) => (site?.gurpurabs || []).filter((g) => g.date === key), [site]);
  const customAllowed = settings.customTimeEnabled !== false;
  const payMethods = [settings.upiEnabled && settings.upiId && 'upi', settings.cashEnabled && 'cash'].filter(Boolean);
  const [nudge, setNudge] = useState(0); // bumps to shake the sewa picker when a sewa is still missing

  useEffect(() => {
    if (!preselect) return;
    // From a sewa card: keep the chosen category if it has this sewa, otherwise use the first one that does.
    const cat =
      categories.find((c) => c.id === preselect.categoryId) ||
      categories.find((c) => c.id === categoryId && c.serviceIds.includes(preselect.id)) ||
      categories.find((c) => c.serviceIds.includes(preselect.id));
    if (preselect.date) {
      // From a Gurpurab: open that date on the calendar (the sewa is chosen next).
      setMonth(startOfMonth(fromKey(preselect.date)));
      setDate(preselect.date);
    }
    if (preselect.id) {
      if (cat) setCategoryId(cat.id);
      setServiceId(preselect.id);
    }
    setStep('pick');
    setTimeout(() => scrollToId('booking-calendar', -90), 400); // after the popup has closed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselect]);

  // On phones the sewa row scrolls sideways: bring the chosen sewa into view.
  useEffect(() => {
    if (!serviceId) return;
    const t = setTimeout(() => {
      const row = document.querySelector('.svc-picker');
      const chip = row?.querySelector('.svc-chip.active');
      if (row && chip && row.scrollWidth > row.clientWidth) row.scrollTo({ left: chip.offsetLeft - row.clientWidth / 2 + chip.offsetWidth / 2, behavior: 'smooth' });
    }, 500);
    return () => clearTimeout(t);
  }, [serviceId, categoryId]);

  const loadAvailability = useCallback(async () => {
    setLoadingAvail(true);
    try {
      const data = await api.availability(toKey(startOfMonth(month)), toKey(endOfMonth(month)));
      setBooked(data.booked);
      setBlocked(data.blockedDates);
      setBlockedTimes(data.blockedTimes || []);
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

  const serviceById = useCallback((id) => services.find((x) => x.id === id), [services]);
  const slotById = useCallback((id) => slots.find((x) => x.id === id), [slots]);
  // Confirmed bookings per date — shown for information only; they never stop anyone requesting a time.
  const bookedByDate = useMemo(() => {
    const map = new Map();
    for (const b of booked) {
      const [start, end] = b.time ? rangeOf(b.time) : [slotById(b.slotId)?.start, slotById(b.slotId)?.end];
      if (!start || !end) continue;
      map.set(b.date, [...(map.get(b.date) || []), { ...b, start, end }]);
    }
    return map;
  }, [booked, slotById]);
  const bookingAt = useCallback((date, start, end) => (bookedByDate.get(date) || []).find((b) => overlaps(start, end, b.start, b.end)), [bookedByDate]);
  const blockAt = useCallback((date, start, end) => blockedTimes.find((t) => t.date === date && overlaps(start, end, t.start, t.end)), [blockedTimes]);
  const picksAt = useCallback((date, slotId) => selection.filter((it) => it.date === date && it.slotId === slotId), [selection]);
  const timesOf = useCallback((it) => (it.slotId === CUSTOM ? [it.start, it.end] : [slotById(it.slotId)?.start, slotById(it.slotId)?.end]), [slotById]);
  const sortedSelection = useMemo(() => [...selection].sort((a, b) => (a.date + timesOf(a)[0]).localeCompare(b.date + timesOf(b)[0])), [selection, timesOf]);
  const isOffered = useCallback((slot) => !service?.allowedSlots?.length || service.allowedSlots.includes(slot.id), [service]);

  const slotState = useCallback(
    (key, slot) => {
      if (blockAt(key, slot.start, slot.end)) return 'booked';
      if (!isOffered(slot)) return 'not-offered';
      if (key === today && slot.start <= nowHHMM()) return 'passed';
      return 'free';
    },
    [blockAt, isOffered, today],
  );

  const getDay = useCallback(
    (key) => {
      if (key < today) return { state: 'past' };
      if (key > maxDate) return { state: 'closed' };
      const gurpurab = gurpurabsOn(key);
      if (blocked.includes(key)) return { state: 'blocked', gurpurab };
      const states = slots.map((sl) => slotState(key, sl));
      const daySlots = states.map((st, i) => ({ booked: st === 'booked', offered: st === 'free', picked: picksAt(key, slots[i].id).length > 0 }));
      const picked = selection.filter((it) => it.date === key).length;
      const offered = slots.filter((sl, i) => isOffered(sl) && states[i] !== 'passed').length;
      const free = states.filter((st) => st === 'free').length;
      if (offered === 0) return { state: 'closed', slots: daySlots, picked, gurpurab };
      if (free === 0) return { state: 'full', slots: daySlots, picked, gurpurab };
      if (free < offered) return { state: 'partial', slots: daySlots, picked, gurpurab };
      return { state: 'free', slots: daySlots, picked, gurpurab };
    },
    [today, maxDate, blocked, slots, slotState, isOffered, picksAt, selection, gurpurabsOn],
  );

  // Drop picked times that the jatha has since marked unavailable.
  useEffect(() => {
    const keep = selection.filter((it) => !blockAt(it.date, ...timesOf(it)) && !blocked.includes(it.date));
    if (keep.length === selection.length) return;
    setSelection(keep);
    toast('A time you picked is no longer available, so it was removed.', 'error');
  }, [selection, blockAt, timesOf, blocked, toast]);

  // Tapping a slot adds the current sewa; tapping again removes it. A different sewa can be added to the same slot.
  const toggleSlot = (sl) => {
    const picks = picksAt(date, sl.id);
    if (picks.length && (!service || (hasCats && !category))) return setSelection((list) => list.filter((it) => !picks.includes(it)));
    if (needsSewa()) return;
    const mine = picks.find((it) => it.serviceId === service.id && it.categoryId === (category?.id || ''));
    if (mine) return setSelection((list) => list.filter((it) => it !== mine));
    if (selection.length >= MAX_ITEMS) return toast(`You can book up to ${MAX_ITEMS} slots at once.`, 'error');
    setSelection((list) => [...list, { categoryId: category?.id || '', serviceId: service.id, date, slotId: sl.id }]);
  };
  // Shakes the category/sewa picker when one is still missing.
  const needsSewa = () => {
    if (service && (!hasCats || category)) return false;
    setNudge((n) => n + 1);
    if (window.innerWidth < 960) scrollToId('book', -20);
    return true;
  };
  const addCustom = (e) => {
    e?.preventDefault();
    setCustomError('');
    if (needsSewa()) return;
    const { start, end } = custom;
    if (!start || !end) return setCustomError('Enter both a start and an end time.');
    if (minutes(end) - minutes(start) < 30) return setCustomError('The end time must be at least 30 minutes after the start.');
    if (date === today && start <= nowHHMM()) return setCustomError('That time has already passed today.');
    const block = blockAt(date, start, end);
    if (block) return setCustomError(`The jatha is not available ${rangeTo12(`${block.start} – ${block.end}`)} — please choose a time outside it.`);
    if (selection.some((it) => it.slotId === CUSTOM && it.date === date && it.start === start && it.end === end && it.serviceId === service.id)) return setCustomError('You already picked this time for this sewa.');
    if (selection.length >= MAX_ITEMS) return setCustomError(`You can book up to ${MAX_ITEMS} slots at once.`);
    setSelection((list) => [...list, { categoryId: category?.id || '', serviceId: service.id, date, slotId: CUSTOM, start, end }]);
    setCustom({ start: '', end: '' });
    setCustomOpen(false);
  };
  const removeItem = (it) => setSelection((list) => list.filter((x) => x !== it));

  const pickDate = (key) => {
    setDate(key);
    setCustomOpen(false);
    setCustomError('');
    setStep('pick');
    if (window.innerWidth < 960) setTimeout(() => scrollToId(panelRef.current, -90), 80);
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (payMethods.length && !payMethods.includes(form.paymentMethod)) return setError('Please choose how you would like to pay — UPI or cash.');
    setSubmitting(true);
    try {
      const { bookings } = await user.createBooking({ items: selection, ...form });
      setResult(bookings);
      setSelection([]); // clear first, so the refresh below doesn't treat our own new bookings as taken
      setStep('success');
      loadAvailability();
      setTimeout(() => scrollToId(panelRef.current, -90), 50);
    } catch (err) {
      setError(err.message);
      if (err.status === 409) loadAvailability();
      if (err.status === 401) setError('Please log in again to send your request.');
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setForm({ ...emptyForm, name: session?.name || '' });
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
            const cat = categoryById(it.categoryId);
            const sl = it.slotId === CUSTOM ? { label: 'Custom time', start: it.start, end: it.end } : slotById(it.slotId);
            return (
              <motion.li
                key={itemKey(it)}
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
                  <em>
                    {svc?.name}
                    {cat && <small> · {cat.name}</small>}
                  </em>
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
          <p className="fine-print">Tip: pick more dates on the calendar, or switch the type of kirtan / sewa, to add more slots.</p>
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
            <p className="section-lead">Every booked slot shows on the calendar in real time. Choose the type of kirtan and the sewa, then as many dates and times as you need — and book them all at once.</p>
          </Reveal>
          <Reveal delay={0.15}>
            <IntlTours compact />
          </Reveal>
        </div>

        <Reveal id="booking-calendar" className="booking-shell glass" y={60}>
          <div className="booking-left">
            {hasCats && (
              <>
                <p className={`step-hint ${category ? 'done' : ''}`}>
                  <span className="step-num">1</span>
                  {category ? (
                    <>
                      Type of kirtan: <strong>{category.name}</strong>
                    </>
                  ) : (
                    'Choose the type of kirtan'
                  )}
                </p>
                <motion.div
                  key={`cat-${nudge}`}
                  className={`cat-picker ${category ? '' : 'needs-choice'}`}
                  role="radiogroup"
                  aria-label="Choose the type of kirtan"
                  animate={nudge && !category ? { x: [0, -10, 10, -6, 6, 0] } : undefined}
                  transition={{ duration: 0.5 }}
                >
                  {categories.map((c) => {
                    const on = c.id === category?.id;
                    return (
                      <button key={c.id} type="button" role="radio" aria-checked={on} className={`cat-card ${on ? 'active' : ''}`} onClick={() => chooseCategory(c)}>
                        {on && <motion.span layoutId="cat-active" className="cat-card-bg" transition={{ type: 'spring', stiffness: 400, damping: 34 }} />}
                        <strong>{c.name}</strong>
                        {c.gurmukhi && <span className="gurmukhi">{c.gurmukhi}</span>}
                        <small>
                          {c.serviceIds.length === services.length ? 'All sewas' : c.serviceIds.map((id) => serviceById(id)?.name).filter(Boolean).join(', ')}
                        </small>
                      </button>
                    );
                  })}
                </motion.div>
              </>
            )}

            <AnimatePresence initial={false}>
            {(!hasCats || category) && (
            <motion.div key="sewa-step" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.4, ease }}>
            <p className={`step-hint ${service ? 'done' : ''}`}>
              <span className="step-num">{hasCats ? 2 : 1}</span>
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
              animate={nudge && (!hasCats || category) ? { x: [0, -10, 10, -6, 6, 0] } : undefined}
              transition={{ duration: 0.5 }}
            >
              {visibleServices.map((s) => {
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
            </motion.div>
            )}
            </AnimatePresence>

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
                  <BookingSuccess bookings={result} phone={result[0]?.phone} onAgain={reset} />
                </motion.div>
              ) : step === 'details' && selection.length && session?.role !== 'user' ? (
                <motion.div key="login" className="details-form" {...panelAnim}>
                  <button type="button" className="back-link" onClick={() => setStep('pick')}>
                    <ArrowLeft size={16} /> Change dates or times
                  </button>
                  <h3 className="panel-title">Log in to send your request</h3>
                  {basket(false)}
                  {session?.role === 'member' ? (
                    <>
                      <p className="panel-sub">You are logged in as a team member. To book, log out and log in (or create an account) as sangat.</p>
                      <button type="button" className="btn btn-ghost" onClick={logout}>
                        <LogOut size={17} /> Log out
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="panel-sub">Your bookings, bills and messages with the jatha are kept in your account. New here? Create one with your mobile number — it takes a few seconds.</p>
                      <AuthForm role="user" startWith="register" />
                    </>
                  )}
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
                      { k: 'email', label: 'Email (optional)', type: 'email', auto: 'email' },
                    ].map((f) => (
                      <motion.label key={f.k} className="field" variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}>
                        <input type={f.type} value={form[f.k]} onChange={set(f.k)} placeholder=" " autoComplete={f.auto} required={f.required} />
                        <span>{f.label}</span>
                      </motion.label>
                    ))}
                    <motion.p className="fine-print" variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}>
                      The jatha will contact you on your account’s mobile number.
                    </motion.p>
                    <motion.label className="field" variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}>
                      <textarea value={form.address} onChange={set('address')} placeholder=" " rows={2} required autoComplete="street-address" />
                      <span>Venue address (house no., street, area) *</span>
                    </motion.label>
                    <motion.div variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}>
                      <span className="label">
                        <MapPin size={13} /> Pin the venue on Google Maps (recommended)
                      </span>
                      <LocationPicker value={form.location} onChange={(location) => setForm((f) => ({ ...f, location }))} label="Search the venue and pick it from the list" hint="This helps the jatha find the place and send the nearest team." />
                    </motion.div>
                    <motion.label className="field" variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}>
                      <textarea value={form.notes} onChange={set('notes')} placeholder=" " rows={2} />
                      <span>Occasion / special requests (optional)</span>
                    </motion.label>
                    <motion.div className="offer-box" variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}>
                      <span className="label">
                        <Tag size={13} /> Your offer (optional)
                      </span>
                      <p className="fine-print">
                        Tell the jatha what you would like to give{selection.length > 1 ? ' for each booking' : ''} — at least {rupees(Number(settings.offerMin) || 0)}. They will accept it or reply in your chat.
                      </p>
                      <label className="field amount-field">
                        <input type="number" inputMode="numeric" min={Number(settings.offerMin) || 0} step="1" value={form.offer} onChange={set('offer')} placeholder=" " />
                        <span>Amount (₹)</span>
                      </label>
                    </motion.div>
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
                      <p className="fine-print">You pay after the jatha confirms and sends your bill. You can change this later under “My account”.</p>
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
                    This is a request — the time is booked once the jatha confirms it. After that, the sewa and venue address are shown on the public calendar so the sangat knows where the jatha is. Manage your bookings and chat with the jatha under “My account”.
                  </p>
                </motion.form>
              ) : date ? (
                <motion.div key={`slots-${date}`} {...panelAnim}>
                  <p className="panel-kicker">{format(fromKey(date), 'EEEE')}</p>
                  <h3 className="panel-title">{prettyDate(date, 'd MMMM yyyy')}</h3>
                  {gurpurabsOn(date).map((g) => (
                    <motion.p key={g.id} className={`gp-banner k-${g.kind}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease }}>
                      <Sparkles size={16} />
                      <span>
                        <strong>{g.kindLabel}</strong> · {g.name}
                      </span>
                    </motion.p>
                  ))}
                  <p className="panel-sub">
                    {service ? (
                      <>
                        Tap one or more times to add <strong style={{ color: service.color }}>{service.name}</strong> — you can add other dates too
                      </>
                    ) : (
                      `See what is booked below. To book a free slot, first choose ${hasCats && !category ? 'the type of kirtan and your sewa' : 'your sewa'} on the left.`
                    )}
                  </p>
                  <motion.div className="slot-list" initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}>
                    {slots.map((sl) => {
                      const st = slotState(date, sl);
                      const picks = picksAt(date, sl.id);
                      const selected = picks.length > 0;
                      const info = bookingAt(date, sl.start, sl.end);
                      return (
                        <motion.button
                          key={sl.id}
                          type="button"
                          className={`slot s-${st} ${selected ? 'selected' : ''}`}
                          disabled={st !== 'free' && !selected}
                          title={selected && service && !picks.some((it) => it.serviceId === service.id) ? `Tap to also add ${service.name}` : undefined}
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
                                <small>Already booked{st === 'free' ? ' — you can still request it' : ''}:</small>
                                <em>
                                  {info.serviceName || services.find((x) => x.id === info.serviceId)?.name || 'Booked'}
                                  {info.slotId === CUSTOM && ` · ${rangeTo12(`${info.start} – ${info.end}`)}`}
                                </em>
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
                                <Check size={14} /> {picks.map((it) => serviceById(it.serviceId)?.name).join(' + ')}
                              </>
                            ) : st === 'free' ? (
                              service ? 'Tap to add' : 'Free'
                            ) : st === 'booked' ? (
                              'Not available'
                            ) : st === 'passed' ? (
                              'Time passed'
                            ) : (
                              'Not offered'
                            )}
                          </span>
                        </motion.button>
                      );
                    })}
                    {blockedTimes
                      .filter((t) => t.date === date && !slots.some((sl) => sl.start === t.start && sl.end === t.end))
                      .map((t) => (
                        <motion.div key={`blk-${t.start}-${t.end}`} className="slot s-booked" variants={{ hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: { duration: 0.45, ease } } }}>
                          <span className="slot-main">
                            <strong>{t.label || 'Not available'}</strong>
                            <span>{rangeTo12(`${t.start} – ${t.end}`)}</span>
                          </span>
                          <span className="slot-status">Not available</span>
                        </motion.div>
                      ))}
                    {(bookedByDate.get(date) || [])
                      .filter((b) => b.slotId === CUSTOM)
                      .map((b) => (
                        <motion.div key={`${b.start}-${b.end}`} className="slot s-info" variants={{ hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: { duration: 0.45, ease } } }}>
                          <span className="slot-main">
                            <strong>Custom time</strong>
                            <span>{rangeTo12(`${b.start} – ${b.end}`)}</span>
                            <span className="slot-booked-info">
                              <small>Already booked — you can still request this time:</small>
                              <em>{b.serviceName || 'Booked'}</em>
                              {b.location && (
                                <span>
                                  <MapPin size={12} /> {b.location}
                                </span>
                              )}
                            </span>
                          </span>
                          <span className="slot-status">Booked</span>
                        </motion.div>
                      ))}
                    {selection
                      .filter((it) => it.date === date && it.slotId === CUSTOM)
                      .map((it) => (
                        <motion.button key={itemKey(it)} type="button" className="slot s-free selected" onClick={() => removeItem(it)} aria-pressed variants={{ hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: { duration: 0.45, ease } } }}>
                          <motion.span className="slot-sel-bg" initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 420, damping: 30 }} />
                          <span className="slot-main">
                            <strong>Your time</strong>
                            <span>{rangeTo12(`${it.start} – ${it.end}`)}</span>
                          </span>
                          <span className="slot-status">
                            <Check size={14} /> {serviceById(it.serviceId)?.name}
                          </span>
                        </motion.button>
                      ))}
                  </motion.div>
                  {customAllowed && (
                    <div className={`custom-time ${customOpen ? 'open' : ''}`}>
                      {!customOpen ? (
                        <button
                          type="button"
                          className="custom-time-toggle"
                          onClick={() => {
                            if (needsSewa()) return;
                            setCustomOpen(true);
                          }}
                        >
                          <Clock size={16} /> Need a different time? <strong>Choose your own time</strong>
                        </button>
                      ) : (
                        <motion.div className="custom-time-form" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease }}>
                          <p className="custom-time-title">
                            <Clock size={16} /> Your own time for <strong style={{ color: service?.color }}>{service?.name}</strong>
                          </p>
                          <div className="custom-time-row">
                            <label>
                              <span className="label">From</span>
                              <input className="input" type="time" value={custom.start} onChange={(e) => setCustom((c) => ({ ...c, start: e.target.value }))} required />
                            </label>
                            <label>
                              <span className="label">To</span>
                              <input className="input" type="time" value={custom.end} onChange={(e) => setCustom((c) => ({ ...c, end: e.target.value }))} required />
                            </label>
                          </div>
                          <AnimatePresence>
                            {customError && (
                              <motion.p key={customError} className="form-error" initial={{ opacity: 0 }} animate={{ opacity: 1, x: [0, -6, 6, -3, 3, 0] }} exit={{ opacity: 0 }}>
                                <CircleAlert size={16} /> {customError}
                              </motion.p>
                            )}
                          </AnimatePresence>
                          <div className="custom-time-actions">
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCustomOpen(false)}>
                              Cancel
                            </button>
                            <button type="button" className="btn btn-primary btn-sm" onClick={addCustom}>
                              <Plus size={16} /> Add this time
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </div>
                  )}
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
                  <div className="empty-icon">
                    {service ? <CalendarDays size={34} /> : <MousePointerClick size={34} />}
                  </div>
                  <h3 className="panel-title">{service ? 'Pick a date' : hasCats && !category ? 'Choose the type of kirtan' : 'Choose your sewa'}</h3>
                  <p className="panel-sub">
                    {service
                      ? 'Tap a day on the calendar to see its time slots. Dots under each date show which slots are already booked (confirmed by the jatha).'
                      : `Start by choosing ${hasCats ? 'the type of kirtan, then the sewa' : 'which sewa'} you want to book. You can also tap any day to see what is already booked there and where.`}
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
