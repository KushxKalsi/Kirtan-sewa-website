import { useMemo, useState } from 'react';
import BookingCalendar from '../components/BookingCalendar';
import { rangeTo12 } from '../lib/date';

const LEAVE_TEXT = { pending: 'To assign', assigned: 'Waiting for replies', approved: 'Booked' };
const LEGEND = [
  ['pending', 'Pending'],
  ['confirmed', 'Confirmed'],
  ['completed', 'Completed'],
  ['team', 'Team booking'],
  ['busy', 'Team member busy (own kirtan)'],
  ['cancelled', 'Cancelled'],
];
const startOf = (slotTime) => (slotTime || '').split('–')[0].trim();
const awaitingTeam = (b) => b.status === 'confirmed' && !((b.assignees || []).length && b.assignees.every((a) => a.state === 'confirmed'));

/** Every booking, team booking and team member's own kirtan on a month calendar; tapping one opens it in its own tab. */
export default function CalendarTab({ data, openBooking, openTab }) {
  const [showCancelled, setShowCancelled] = useState(false);
  const people = data.people || [];
  const roles = data.roles || {};

  const events = useMemo(() => {
    const nameOf = (id) => people.find((p) => p.id === id)?.name;
    const bookingOf = (id) => data.bookings.find((b) => b.id === id);
    const bookings = data.bookings
      .filter((b) => showCancelled || b.status !== 'cancelled')
      .map((b) => ({
        id: b.id,
        date: b.date,
        start: startOf(b.slotTime),
        time: `${b.slotLabel} · ${rangeTo12(b.slotTime || '')}`,
        title: b.serviceName,
        sub: [b.categoryName, `${b.name} · ${b.ref}`, (b.assignees || []).length ? `👤 ${b.assignees.map((a) => a.name + (a.state === 'confirmed' ? ' ✓' : '')).join(', ')}` : 'Not assigned'].filter(Boolean).join(' · '),
        // You confirmed but the team hasn't accepted yet: still pending for the customer.
        tone: awaitingTeam(b) ? 'pending' : b.status,
        tag: awaitingTeam(b) ? 'awaiting team' : b.status,
        onOpen: () => openBooking(b.ref),
      }));
    const team = (data.leaves || [])
      .filter((l) => LEAVE_TEXT[l.status])
      .flatMap((l) =>
        (l.picks?.length ? l.picks : [{ date: l.from, personId: l.replacementId }]).map((x, i) => {
          const b = x.bookingId && bookingOf(x.bookingId);
          const start = x.start || startOf(b?.slotTime);
          return {
            id: `${l.id}-${i}`,
            date: x.date || b?.date || l.from,
            start,
            time: x.start ? rangeTo12(`${x.start} – ${x.end}`) : b ? rangeTo12(b.slotTime || '') : 'Whole day',
            title: `${roles[x.role] || 'Teammate'} for ${nameOf(l.personId) || l.personName || 'a team member'}`,
            sub: [x.categoryName || b?.categoryName, b?.serviceName || x.serviceName, x.personId ? `→ ${nameOf(x.personId) || 'assigned'}` : 'Nobody assigned yet'].filter(Boolean).join(' · '),
            tone: 'team',
            tag: LEAVE_TEXT[l.status],
            onOpen: () => openTab('leave'),
          };
        }),
      );
    // Kirtans team members booked themselves: they are busy then.
    const busy = people.flatMap((p) =>
      (p.busy || []).map((k) => ({
        id: k.id,
        date: k.date,
        start: k.start,
        time: k.start ? rangeTo12(`${k.start} – ${k.end}`) : 'Whole day',
        title: `${p.name} busy`,
        sub: [k.place, k.note].filter(Boolean).join(' · '),
        tone: 'busy',
        tag: 'Own kirtan',
        onOpen: () => openTab('team'),
      })),
    );
    return [...bookings, ...team, ...busy];
  }, [data.bookings, data.leaves, people, roles, showCancelled, openBooking, openTab]);

  return (
    <div className="admin-section">
      <BookingCalendar events={events} today={data.today} legend={showCancelled ? LEGEND : LEGEND.slice(0, -1)} empty="Nothing booked on this day. Tap another day to see its bookings.">
        <label className="select-all bcal-toggle">
          <input type="checkbox" checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)} />
          <span className="tick" />
          Show cancelled bookings
        </label>
      </BookingCalendar>
    </div>
  );
}
