import { Link } from 'react-router-dom';
import { differenceInCalendarDays, format } from 'date-fns';
import { CalendarCheck, CalendarPlus, IndianRupee, MessagesSquare, Siren } from 'lucide-react';
import { ActionList, StatCard } from './DashShell';
import IntlTours from './IntlTours';
import { fromKey, rangeTo12 } from '../lib/date';
import { rupees } from '../lib/money';

const live = (b) => b.status === 'pending' || b.status === 'confirmed';

/** Customer's first page: their next booking, what to pay, and quick ways to book or chat. */
export default function AccountOverview({ data, openTab }) {
  const { bookings, today, unread = 0 } = data;
  const upcoming = bookings.filter((b) => live(b) && b.date >= today).sort((a, b) => (a.date + a.slotTime).localeCompare(b.date + b.slotTime));
  const next = upcoming[0];
  const due = bookings.filter((b) => b.status !== 'cancelled' && b.status !== 'pending' && b.amount > 0 && b.paymentStatus === 'unpaid');
  const dueNow = due.filter((b) => b.date <= today);
  const days = next ? differenceInCalendarDays(fromKey(next.date), fromKey(today)) : 0;

  const actions = [
    ...dueNow.map((b) => ({ key: `d-${b.ref}`, tone: 'danger', text: `Pay ${rupees(b.amount)} — ${b.serviceName}`, sub: `Kirtan ${b.date === today ? 'today' : format(fromKey(b.date), 'd MMM')} · ${b.paymentMethod === 'cash' ? 'in cash to the jatha' : 'by UPI'}`, onClick: () => openTab('bookings') })),
    ...due
      .filter((b) => b.date > today && b.paymentMethod === 'upi')
      .map((b) => ({ key: `u-${b.ref}`, text: `Bill ready: ${rupees(b.amount)}`, sub: `${b.serviceName} · ${format(fromKey(b.date), 'd MMM')} — pay by UPI any time`, onClick: () => openTab('bookings') })),
    ...bookings.filter((b) => b.offer?.status === 'countered' && b.paymentStatus === 'unpaid' && live(b)).map((b) => ({ key: `o-${b.ref}`, text: 'The jatha replied to your offer', sub: b.serviceName, onClick: () => openTab('bookings') })),
    ...(unread ? [{ key: 'chat', tone: 'warn', text: `${unread} new message${unread === 1 ? '' : 's'} from the jatha`, onClick: () => openTab('chat') }] : []),
  ];

  return (
    <div className="overview">
      {next ? (
        <button type="button" className="next-booking glass" onClick={() => openTab('bookings')}>
          <span className="eyebrow">{days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`}</span>
          <strong>
            {next.serviceName}
            {next.emergency && <span className="emergency-tag">🚨 Emergency</span>}
          </strong>
          <span>
            {format(fromKey(next.date), 'EEEE, d MMMM')} · {rangeTo12(next.slotTime)}
          </span>
          <span className="muted">{next.address}</span>
          <span className="timeline-tags">
            <span className={`pay-tag ${next.status === 'confirmed' ? 'pay-paid' : 'pay-submitted'}`}>{next.status === 'confirmed' ? 'Confirmed ✓' : 'Waiting for the jatha'}</span>
            {next.team?.length > 0 && <span className="pay-tag pay-paid">👤 {next.team.map((t) => t.name.split(' ')[0]).join(', ')}</span>}
          </span>
        </button>
      ) : (
        <div className="next-booking glass empty">
          <strong>No kirtan booked yet</strong>
          <span className="muted">Choose a date on the calendar — or book an emergency kirtan for today.</span>
        </div>
      )}

      <div className="stat-row">
        <StatCard label="Upcoming bookings" value={upcoming.length} tone="gold" icon={CalendarCheck} onClick={() => openTab('bookings')} />
        <StatCard label="To pay" value={rupees(due.reduce((t, b) => t + b.amount, 0))} tone={dueNow.length ? 'danger' : 'success'} icon={IndianRupee} onClick={() => openTab('bookings')} />
        <StatCard label="New messages" value={unread} tone={unread ? 'warn' : 'success'} icon={MessagesSquare} onClick={() => openTab('chat')} />
      </div>

      <div className="dash-cols">
        <section className="dash-main">
          <div className="quick-actions">
            <Link to="/" state={{ scrollTo: 'book' }} className="quick-action glass">
              <CalendarPlus size={22} />
              <strong>Book a date</strong>
              <small>See the live calendar and pick one or more dates.</small>
            </Link>
            <Link to="/" state={{ emergency: true }} className="quick-action glass danger">
              <Siren size={22} />
              <strong>Emergency kirtan</strong>
              <small>For today, starting at least 2 hours from now.</small>
            </Link>
            <button type="button" className="quick-action glass" onClick={() => openTab('chat')}>
              <MessagesSquare size={22} />
              <strong>Chat with the jatha</strong>
              <small>Ask about the bhet, timings or the venue.</small>
            </button>
          </div>
          <IntlTours compact />
        </section>
        <aside className="dash-side">
          <ActionList items={actions} empty="Nothing to do right now 🙏" />
        </aside>
      </div>
    </div>
  );
}
