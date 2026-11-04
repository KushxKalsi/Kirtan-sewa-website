import { useEffect, useState } from 'react';
import { differenceInCalendarDays, format } from 'date-fns';
import { CalendarClock, Hand, Heart, Wallet } from 'lucide-react';
import { ActionList, StatCard } from './DashShell';
import { fromKey, rangeTo12 } from '../lib/date';
import { rupees } from '../lib/money';

const live = (d) => d.status === 'pending' || d.status === 'confirmed';
const when = (date, today) => {
  const days = differenceInCalendarDays(fromKey(date), fromKey(today));
  return days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`;
};

/** Team member's first page: the next kirtan, what needs their answer, money, and likes on their posts. */
export default function TeamOverview({ data, team, openTab }) {
  const { duties, today, leaves = [], bookedMe = [], commissionDue = [] } = data;
  const [likes, setLikes] = useState(null);
  useEffect(() => {
    team.posts().then((r) => setLikes(r.posts.reduce((t, p) => t + p.likes, 0)), () => {});
  }, [team]);

  const upcoming = duties.filter((d) => live(d) && d.date >= today && !d.doneAt).sort((a, b) => (a.date + a.slotTime).localeCompare(b.date + b.slotTime));
  const next = upcoming[0];
  const toConfirm = upcoming.filter((d) => d.state !== 'confirmed');
  const toAnswer = bookedMe.filter((l) => l.sewas.some((x) => x.reply === 'waiting'));
  const toPay = leaves.filter((l) => l.status === 'awaiting-payment' && l.paymentMethod === 'upi' && !l.commissionPaid && l.payment?.status !== 'submitted');
  const toGet = duties.filter((d) => d.status !== 'cancelled' && d.over && d.pay != null && !d.settledAt && d.paymentMethod === 'upi').reduce((t, d) => t + d.net, 0);
  const owed = commissionDue.reduce((t, d) => t + d.amount, 0);

  const actions = [
    ...toAnswer.map((l) => ({ key: `a-${l.id}`, tone: l.emergency ? 'danger' : 'warn', text: `${l.emergency ? '🚨 ' : ''}Can you go in ${l.name}'s place?`, sub: 'Accept or decline', onClick: () => openTab('leave') })),
    ...toConfirm.map((d) => ({ key: `c-${d.id}`, tone: 'warn', text: `Confirm: ${d.serviceName}`, sub: `${format(fromKey(d.date), 'EEE d MMM')} · ${rangeTo12(d.slotTime)}`, onClick: () => openTab('duties') })),
    ...toPay.map((l) => ({ key: `p-${l.id}`, tone: 'danger', text: 'Pay your team booking by UPI', sub: `${format(fromKey(l.from), 'd MMM')} · the admin confirmed it`, onClick: () => openTab('leave') })),
    ...(owed ? [{ key: 'owed', tone: 'danger', text: `Give the admin ${rupees(owed)} commission`, sub: 'From cash team bookings', onClick: () => openTab('leave') }] : []),
  ];

  return (
    <div className="overview">
      <div className="stat-row">
        <StatCard label={next ? `${next.serviceName} · ${rangeTo12(next.slotTime)}` : 'No kirtan coming up'} value={next ? when(next.date, today) : '—'} tone="gold" icon={CalendarClock} onClick={() => openTab('duties')} />
        <StatCard label="Waiting for your answer" value={toConfirm.length + toAnswer.length} tone={toConfirm.length + toAnswer.length ? 'warn' : 'success'} icon={Hand} onClick={() => openTab(toAnswer.length ? 'leave' : 'duties')} />
        <StatCard label="Bhet to get by UPI" value={rupees(toGet)} tone="success" icon={Wallet} onClick={() => openTab('duties')} />
        <StatCard label="Likes on your posts" value={likes ?? '…'} tone="gold" icon={Heart} onClick={() => openTab('posts')} />
      </div>
      <div className="dash-cols">
        <section className="dash-main">
          <h3 className="dash-title">Your next sewas</h3>
          {upcoming.length === 0 && <div className="admin-empty glass">No sewas coming up. You will be notified when the admin gives you one.</div>}
          <div className="timeline-items">
            {upcoming.slice(0, 6).map((d) => (
              <button key={d.id} type="button" className="timeline-item glass" onClick={() => openTab('duties')}>
                <span className="timeline-time">
                  {when(d.date, today)} · {format(fromKey(d.date), 'EEE d MMM')} · {rangeTo12(d.slotTime)}
                </span>
                <strong>{d.serviceName}</strong>
                <span className="muted">{d.address}</span>
                <span className="timeline-tags">
                  <span className={`pay-tag ${d.state === 'confirmed' ? 'pay-paid' : 'pay-submitted'}`}>{d.state === 'confirmed' ? 'You confirmed' : 'Please confirm'}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
        <aside className="dash-side">
          <ActionList items={actions} />
        </aside>
      </div>
    </div>
  );
}
