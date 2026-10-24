import { format, parseISO } from 'date-fns';

const pad = (n) => String(n).padStart(2, '0');
export const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromKey = (key) => parseISO(key);
export const prettyDate = (key, pattern = 'EEEE, d MMMM yyyy') => format(fromKey(key), pattern);

const to12 = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  return `${((h + 11) % 12) + 1}:${pad(m)} ${suffix}`;
};
export const slotTime = (slot) => `${to12(slot.start)} – ${to12(slot.end)}`;
export const rangeTo12 = (range) =>
  range
    .split('–')
    .map((t) => t.trim())
    .map((t) => (/^\d{2}:\d{2}$/.test(t) ? to12(t) : t))
    .join(' – ');
