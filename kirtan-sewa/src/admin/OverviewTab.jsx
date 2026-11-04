import { useEffect, useMemo, useState } from 'react';
import { addDays, format } from 'date-fns';
import { CalendarClock, CalendarDays, CircleAlert, IndianRupee, MessagesSquare, Siren, UserPlus, UsersRound } from 'lucide-react';
import { ActionList, StatCard } from '../components/DashShell';
import { fromKey, rangeTo12, toKey } from '../lib/date';
import { rupees } from '../lib/money';

const active = (b) => b.status === 'pending' || b.status === 'confirmed';
const teamOk = (b) => (b.assignees || []).length > 0 && b.assignees.every((a) => a.state === 'confirmed');

/** The admin's first page: today in numbers, what needs doing, and the next 7 days. */
export default function OverviewTab({ data, api, openTab, openBooking }) {
  const { bookings = [], leaves = [], chats = [], people = [], today } = data;
  const [reported, setReported] = useState(0);
  useEffect(() => {
    api.posts().then((r) => setReported(r.posts.filter((p) => p.reports > 0 && !p.hidden).length), () => {});
  }, [api]);

  const week = toKey(addDays(fromKey(today), 7));
  const upcoming = useMemo(
    () => bookings.filter((b) => active(b) && b.date >= today && b.date <= week).sort((a, b) => (a.date + a.slotTime).localeCompare(b.date + b.slotTime)),
    [bookings, today, week],
  );
  const pending = bookings.filter((b) => b.status === 'pending' && b.date >= today);
  const todays = bookings.filter((b) => active(b) && b.date === today);
  const due = bookings.filter((b) => b.status === 'confirmed' && b.date <= today && b.paymentStatus !== 'paid');
  const unread = chats.reduce((t, c) => t + c.unread, 0);
  const leaveWaiting = leaves.filter((l) => l.status === 'pending' || l.status === 'accepted' || l.cancelRequest?.status === 'pending' || (l.paymentMethod === 'upi' && !l.commissionPaid && l.payment?.status === 'submitted'));
  const signups = people.filter((p) => p.pending);

  const actions = [
    ...pending.filter((b) => b.emergency).map((b) => ({ key: `em-${b.id}`, tone: 'danger', text: `🚨 Emergency kirtan today — ${b.name}`, sub: `${rangeTo12(b.slotTime)} · ${b.address}`, onClick: () => openBooking(b.ref) })),
    ...bookings.filter((b) => b.cancelRequest?.status === 'pending' && active(b)).map((b) => ({ key: `cr-${b.id}`, tone: 'danger', text: `Cancel request — ${b.name}`, sub: `${format(fromKey(b.date), 'd MMM')} · ${b.serviceName}`, onClick: () => openBooking(b.ref) })),
    ...bookings.filter((b) => b.paymentStatus === 'submitted' && b.status !== 'cancelled').map((b) => ({ key: `pv-${b.id}`, tone: 'warn', text: `Verify UPI ${rupees(b.amount || 0)} — ${b.name}`, sub: `UTR ${b.utr}`, onClick: () => openBooking(b.ref) })),
    ...leaves.filter((l) => l.status === 'accepted').map((l) => ({ key: `lc-${l.id}`, tone: 'warn', text: `Confirm team booking — ${l.personName}`, sub: 'Everyone accepted', onClick: () => openTab('leave') })),
    ...leaves.filter((l) => l.paymentMethod === 'upi' && !l.commissionPaid && l.payment?.status === 'submitted').map((l) => ({ key: `lp-${l.id}`, tone: 'warn', text: `Verify team booking payment — ${l.personName}`, sub: `UTR ${l.payment.utr}`, onClick: () => openTab('leave') })),
    ...leaves.filter((l) => l.status === 'pending').map((l) => ({ key: `la-${l.id}`, tone: l.emergency ? 'danger' : 'gold', text: `${l.emergency ? '🚨 ' : ''}Assign people — ${l.personName}'s team booking`, sub: format(fromKey(l.from), 'd MMM'), onClick: () => openTab('leave') })),
    ...upcoming.filter((b) => !(b.assignees || []).length).slice(0, 5).map((b) => ({ key: `un-${b.id}`, text: `Assign the team — ${b.serviceName}`, sub: `${format(fromKey(b.date), 'EEE d MMM')} · ${b.name}`, onClick: () => openBooking(b.ref) })),
    ...(reported ? [{ key: 'rep', tone: 'danger', text: `${reported} reported post${reported === 1 ? '' : 's'}`, sub: 'Check and hide if needed', onClick: () => openTab('posts') }] : []),
    ...(signups.length ? [{ key: 'su', text: `${signups.length} team sign-up${signups.length === 1 ? '' : 's'} to approve`, onClick: () => openTab('team') }] : []),
  ];

  // The week, day by day.
  const days = [...new Set(upcoming.map((b) => b.date))];

  return (
    <div className="overview">
      <div className="stat-row">
        <StatCard label="New requests" value={pending.length} tone="warn" icon={CalendarClock} onClick={() => openTab('bookings')} />
        <StatCard label="Kirtans today" value={todays.length} tone="gold" icon={CalendarDays} onClick={() => openTab('calendar')} />
        <StatCard label="Payment due" value={due.length} tone={due.length ? 'danger' : 'success'} icon={IndianRupee} onClick={() => openTab('bookings')} />
        <StatCard label="Team bookings for you" value={leaveWaiting.length} tone={leaveWaiting.length ? 'warn' : 'success'} icon={UsersRound} onClick={() => openTab('leave')} />
        <StatCard label="Unread messages" value={unread} tone={unread ? 'warn' : 'success'} icon={MessagesSquare} onClick={() => openTab('chat')} />
        {signups.length > 0 && <StatCard label="Team sign-ups" value={signups.length} tone="warn" icon={UserPlus} onClick={() => openTab('team')} />}
      </div>

      <div className="dash-cols">
        <section className="dash-main">
          <h3 className="dash-title">Next 7 days</h3>
          {days.length === 0 && <div className="admin-empty glass">No kirtans in the next 7 days.</div>}
          <ol className="timeline">
            {days.map((d) => (
              <li key={d}>
                <span className="timeline-day">
                  <strong>{format(fromKey(d), 'd')}</strong>
                  <small>{d === today ? 'Today' : format(fromKey(d), 'EEE')}</small>
                </span>
                <div className="timeline-items">
                  {upcoming
                    .filter((b) => b.date === d)
                    .map((b) => (
                      <button key={b.id} type="button" className="timeline-item glass" onClick={() => openBooking(b.ref)}>
                        <span className="timeline-time">{rangeTo12(b.slotTime)}</span>
                        <strong>
                          {b.serviceName}
                          {b.emergency && <span className="emergency-tag">🚨</span>}
                        </strong>
                        <span className="muted">
                          {b.name} · {b.address}
                        </span>
                        <span className="timeline-tags">
                          <span className={`pay-tag ${b.status === 'confirmed' ? 'pay-paid' : 'pay-submitted'}`}>{b.status}</span>
                          {(b.assignees || []).length ? (
                            <span className={`pay-tag ${teamOk(b) ? 'pay-paid' : 'pay-submitted'}`}>👤 {b.assignees.map((a) => a.name.split(' ')[0]).join(', ')}</span>
                          ) : (
                            <span className="pay-tag pay-unpaid">
                              <CircleAlert size={12} /> No team
                            </span>
                          )}
                        </span>
                      </button>
                    ))}
                </div>
              </li>
            ))}
          </ol>
        </section>
        <aside className="dash-side">
          <ActionList items={actions} />
          {todays.some((b) => b.emergency) && (
            <p className="emergency-banner">
              <Siren size={16} /> There is an emergency kirtan today.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
