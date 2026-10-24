// Browser storage can be unavailable (private mode, blocked cookies) — never let it break the page.
export function readStore(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function writeStore(key, value) {
  try {
    if (value === undefined || value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

const MY_BOOKINGS = 'sewa.myBookings';
export const getMyBookings = () => readStore(MY_BOOKINGS, []);
export const getMyPhones = () => [...new Set(getMyBookings().map((b) => b.phone).filter(Boolean))];
export function rememberBooking(booking, phone) {
  const list = getMyBookings().filter((b) => b.ref !== booking.ref);
  list.unshift({ ref: booking.ref, phone, serviceName: booking.serviceName, date: booking.date });
  writeStore(MY_BOOKINGS, list.slice(0, 8));
}
