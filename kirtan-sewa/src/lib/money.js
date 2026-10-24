export const rupees = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

export const upiLink = ({ upiId, upiName, amount, ref }) => {
  const params = new URLSearchParams({ pa: upiId, cu: 'INR' });
  if (upiName) params.set('pn', upiName);
  if (amount) params.set('am', String(amount));
  if (ref) params.set('tn', `Kirtan booking ${ref}`);
  return `upi://pay?${params.toString()}`;
};

export const PAYMENT_LABEL = { upi: 'UPI', cash: 'Cash' };
