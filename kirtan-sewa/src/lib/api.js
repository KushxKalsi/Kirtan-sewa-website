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
  lookupBookings: (phone) => request('/bookings/lookup', { method: 'POST', body: { phone } }),
  requestCancel: (ref, phone, reason) => request('/bookings/cancel-request', { method: 'POST', body: { ref, phone, reason } }),
  withdrawCancel: (ref, phone) => request('/bookings/cancel-request/withdraw', { method: 'POST', body: { ref, phone } }),
  submitPayment: (ref, phone, utr) => request('/bookings/payment', { method: 'POST', body: { ref, phone, utr } }),
  setPaymentMethod: (ref, phone, method) => request('/bookings/payment-method', { method: 'POST', body: { ref, phone, method } }),
  pushKey: () => request('/push/key'),
  pushSubscribe: (phone, subscription) => request('/push/subscribe', { method: 'POST', body: { phone, subscription } }),
  pushSubscribePublic: (subscription) => request('/push/subscribe-public', { method: 'POST', body: { subscription } }),
};

export const adminApi = (token) => ({
  data: () => request('/admin/data', { token }),
  saveSettings: (settings) => request('/admin/settings', { method: 'PUT', body: settings, token }),
  addService: (service) => request('/admin/services', { method: 'POST', body: service, token }),
  updateService: (id, service) => request(`/admin/services/${id}`, { method: 'PUT', body: service, token }),
  deleteService: (id) => request(`/admin/services/${id}`, { method: 'DELETE', token }),
  reorderServices: (ids) => request('/admin/services-order', { method: 'PUT', body: { ids }, token }),
  saveSlots: (slots) => request('/admin/slots', { method: 'PUT', body: { slots }, token }),
  addCategory: (c) => request('/admin/categories', { method: 'POST', body: c, token }),
  updateCategory: (id, c) => request(`/admin/categories/${id}`, { method: 'PUT', body: c, token }),
  deleteCategory: (id) => request(`/admin/categories/${id}`, { method: 'DELETE', token }),
  reorderCategories: (ids) => request('/admin/categories-order', { method: 'PUT', body: { ids }, token }),
  addPerson: (p) => request('/admin/people', { method: 'POST', body: p, token }),
  updatePerson: (id, p) => request(`/admin/people/${id}`, { method: 'PUT', body: p, token }),
  deletePerson: (id) => request(`/admin/people/${id}`, { method: 'DELETE', token }),
  assign: (id, personIds) => request(`/admin/bookings/${id}/assign`, { method: 'PATCH', body: { personIds }, token }),
  saveBlockedDates: (dates) => request('/admin/blocked-dates', { method: 'PUT', body: { dates }, token }),
  blockTimes: (body) => request('/admin/blocked-times', { method: 'POST', body, token }),
  unblockTime: (id) => request(`/admin/blocked-times/${id}`, { method: 'DELETE', token }),
  setStatus: (id, status, reason, amount) => request(`/admin/bookings/${id}`, { method: 'PATCH', body: { status, reason, amount }, token }),
  deleteBooking: (id) => request(`/admin/bookings/${id}`, { method: 'DELETE', token }),
  deleteBookings: (ids) => request('/admin/bookings/delete', { method: 'POST', body: { ids }, token }),
  pushSubscribe: (subscription) => request('/admin/push/subscribe', { method: 'POST', body: { subscription }, token }),
  pushUnsubscribe: (endpoint) => request('/admin/push/unsubscribe', { method: 'POST', body: { endpoint }, token }),
  pushTest: () => request('/admin/push/test', { method: 'POST', body: {}, token }),
  resolveCancel: (id, action, note) => request(`/admin/bookings/${id}/cancel-request`, { method: 'PATCH', body: { action, note }, token }),
  setPayment: (id, payment) => request(`/admin/bookings/${id}/payment`, { method: 'PATCH', body: payment, token }),
  uploadQr: (dataUrl) => request('/admin/upi-qr', { method: 'POST', body: { dataUrl }, token }),
  removeQr: () => request('/admin/upi-qr', { method: 'DELETE', token }),
  addGurpurab: (g) => request('/admin/gurpurabs', { method: 'POST', body: g, token }),
  updateGurpurab: (id, g) => request(`/admin/gurpurabs/${id}`, { method: 'PUT', body: g, token }),
  deleteGurpurab: (id) => request(`/admin/gurpurabs/${id}`, { method: 'DELETE', token }),
  notifyGurpurab: (id) => request(`/admin/gurpurabs/${id}/notify`, { method: 'POST', body: {}, token }),
  uploadGurpurabImage: (dataUrl) => request('/admin/gurpurab-images', { method: 'POST', body: { dataUrl }, token }),
});

export const adminLogin = (password) => request('/admin/login', { method: 'POST', body: { password } });
