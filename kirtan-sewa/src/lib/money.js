import { Banknote, Smartphone } from 'lucide-react';

export const rupees = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

export const upiLink = ({ upiId, upiName, amount, ref, note }) => {
  const params = new URLSearchParams({ pa: upiId, cu: 'INR' });
  if (upiName) params.set('pn', upiName);
  if (amount) params.set('am', String(amount));
  if (note || ref) params.set('tn', note || `Kirtan booking ${ref}`);
  return `upi://pay?${params.toString()}`;
};

export const PAYMENT_LABEL = { upi: 'UPI', cash: 'Cash' };

export const PAY_OPTIONS = {
  upi: { label: 'UPI', sub: 'Scan QR / any UPI app', icon: Smartphone },
  cash: { label: 'Cash', sub: 'Pay on the day', icon: Banknote },
};

export const enabledMethods = (s = {}) => [s.upiEnabled && s.upiId && 'upi', s.cashEnabled && 'cash'].filter(Boolean);

/* A member's bhet on a customer booking, settled as on the server. UPI: the admin pays them the bhet less the
 * commission. Cash: they keep the whole bhet and owe the admin the commission (commissionRate % of each bhet, only on
 * bills above commissionAbove). */
export const settleMode = (b) => (b.paymentMethod === 'upi' || b.paymentMethod === 'cash' ? b.paymentMethod : '');
export const dutyCommission = (s, b, a) => {
  const rate = Number(s.commissionRate) || 0;
  return rate > 0 && (b.amount || 0) > (Number(s.commissionAbove) || 0) ? Math.round(((a.pay || 0) * rate) / 100) : 0;
};
export const settleAmount = (s, b, a) => (a.settledAt ? a.settledAmount : settleMode(b) === 'cash' ? dutyCommission(s, b, a) : (a.pay || 0) - dutyCommission(s, b, a));
export const dutyOver = (b, a, today) => b.status !== 'cancelled' && (b.status === 'completed' || !!a.doneAt || b.date < today);
