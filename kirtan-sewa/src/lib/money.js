import { Banknote, Smartphone } from 'lucide-react';

export const rupees = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

export const upiLink = ({ upiId, upiName, amount, ref }) => {
  const params = new URLSearchParams({ pa: upiId, cu: 'INR' });
  if (upiName) params.set('pn', upiName);
  if (amount) params.set('am', String(amount));
  if (ref) params.set('tn', `Kirtan booking ${ref}`);
  return `upi://pay?${params.toString()}`;
};

export const PAYMENT_LABEL = { upi: 'UPI', cash: 'Cash' };

export const PAY_OPTIONS = {
  upi: { label: 'UPI', sub: 'Scan QR / any UPI app', icon: Smartphone },
  cash: { label: 'Cash', sub: 'Pay on the day', icon: Banknote },
};

export const enabledMethods = (s = {}) => [s.upiEnabled && s.upiId && 'upi', s.cashEnabled && 'cash'].filter(Boolean);
