import { Check } from 'lucide-react';

const replyOf = (x) => x.reply || (x.personId ? 'accepted' : '');

/**
 * Where a team booking is: request → teammate assigned → teammate accepted → admin confirmed → paid (UPI) → booked.
 * Cash bookings skip the payment step (they pay the people who go on the day).
 */
export default function TeamBookingSteps({ leave: l }) {
  if (['rejected', 'cancelled'].includes(l.status)) return null;
  const upi = l.paymentMethod === 'upi';
  const picks = l.picks || [];
  const steps = [
    { label: 'Request sent', done: true },
    { label: 'Teammate assigned', done: l.status !== 'pending' },
    { label: 'Teammate accepted', done: ['accepted', 'awaiting-payment', 'approved'].includes(l.status) || (picks.length > 0 && picks.every((x) => replyOf(x) === 'accepted')) },
    { label: 'Admin confirmed', done: ['awaiting-payment', 'approved'].includes(l.status) },
    upi && {
      label: l.commissionPaid ? 'Payment verified' : l.payment?.status === 'submitted' ? 'Payment sent — admin verifying' : 'Pay by UPI',
      done: !!l.commissionPaid || l.status === 'approved',
    },
    { label: 'Booked', done: l.status === 'approved' },
  ].filter(Boolean);
  const current = steps.findIndex((s) => !s.done);

  return (
    <ol className="tb-steps" aria-label="Team booking progress">
      {steps.map((s, i) => (
        <li key={s.label} className={s.done ? 'done' : i === current ? 'current' : ''}>
          <span className="tb-dot">{s.done ? <Check size={12} /> : i + 1}</span>
          <span className="tb-label">{s.label}</span>
        </li>
      ))}
    </ol>
  );
}
