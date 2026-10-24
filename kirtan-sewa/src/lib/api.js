async function request(path, { method = 'GET', body, token } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(`/api${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch {
    throw new Error('Cannot reach the server. Check your connection.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'Something went wrong.');
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  site: () => request('/public'),
  availability: (from, to) => request(`/availability?from=${from}&to=${to}`),
  createBooking: (booking) => request('/bookings', { method: 'POST', body: booking }),
  lookupBooking: (ref, phone) => request('/bookings/lookup', { method: 'POST', body: { ref, phone } }),
  cancelBooking: (ref, phone, reason) => request('/bookings/cancel', { method: 'POST', body: { ref, phone, reason } }),
  submitPayment: (ref, phone, utr) => request('/bookings/payment', { method: 'POST', body: { ref, phone, utr } }),
};

export const adminApi = (token) => ({
  data: () => request('/admin/data', { token }),
  saveSettings: (settings) => request('/admin/settings', { method: 'PUT', body: settings, token }),
  addService: (service) => request('/admin/services', { method: 'POST', body: service, token }),
  updateService: (id, service) => request(`/admin/services/${id}`, { method: 'PUT', body: service, token }),
  deleteService: (id) => request(`/admin/services/${id}`, { method: 'DELETE', token }),
  reorderServices: (ids) => request('/admin/services-order', { method: 'PUT', body: { ids }, token }),
  saveSlots: (slots) => request('/admin/slots', { method: 'PUT', body: { slots }, token }),
  saveBlockedDates: (dates) => request('/admin/blocked-dates', { method: 'PUT', body: { dates }, token }),
  setStatus: (id, status, reason, amount) => request(`/admin/bookings/${id}`, { method: 'PATCH', body: { status, reason, amount }, token }),
  deleteBooking: (id) => request(`/admin/bookings/${id}`, { method: 'DELETE', token }),
  setPayment: (id, payment) => request(`/admin/bookings/${id}/payment`, { method: 'PATCH', body: payment, token }),
  uploadQr: (dataUrl) => request('/admin/upi-qr', { method: 'POST', body: { dataUrl }, token }),
  removeQr: () => request('/admin/upi-qr', { method: 'DELETE', token }),
});

export const adminLogin = (password) => request('/admin/login', { method: 'POST', body: { password } });
