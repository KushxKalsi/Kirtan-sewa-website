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
  pushKey: () => request('/push/key'),
  pushSubscribePublic: (subscription) => request('/push/subscribe-public', { method: 'POST', body: { subscription } }),
  searchPlaces: (q) => request(`/geo/search?q=${encodeURIComponent(q)}`),
  reversePlace: (lat, lng) => request(`/geo/reverse?lat=${lat}&lng=${lng}`),
  register: (body) => request('/auth/register', { method: 'POST', body }),
  login: (body) => request('/auth/login', { method: 'POST', body }),
};

// A logged-in customer ("sangat" account).
export const userApi = (token) => ({
  me: () => request('/me', { token }),
  updateMe: (body) => request('/me', { method: 'PUT', body, token }),
  changePassword: (current, password) => request('/me/password', { method: 'POST', body: { current, password }, token }),
  createBooking: (booking) => request('/bookings', { method: 'POST', body: booking, token }),
  requestCancel: (ref, reason) => request('/bookings/cancel-request', { method: 'POST', body: { ref, reason }, token }),
  withdrawCancel: (ref) => request('/bookings/cancel-request/withdraw', { method: 'POST', body: { ref }, token }),
  submitPayment: (ref, utr) => request('/bookings/payment', { method: 'POST', body: { ref, utr }, token }),
  setPaymentMethod: (ref, method) => request('/bookings/payment-method', { method: 'POST', body: { ref, method }, token }),
  setLocation: (ref, location) => request(`/me/bookings/${ref}/location`, { method: 'PUT', body: { location }, token }),
  makeOffer: (ref, amount, note) => request(`/me/bookings/${ref}/offer`, { method: 'POST', body: { amount, note }, token }),
  chat: () => request('/me/chat', { token }),
  sendChat: (text) => request('/me/chat', { method: 'POST', body: { text }, token }),
  pushSubscribe: (subscription) => request('/push/subscribe', { method: 'POST', body: { subscription }, token }),
});

// A logged-in team member.
export const teamApi = (token) => ({
  me: () => request('/team/me', { token }),
  saveProfile: (body) => request('/team/profile', { method: 'PUT', body, token }),
  uploadDoc: (kind, dataUrl, name) => request(`/team/documents/${kind}`, { method: 'POST', body: { dataUrl, name }, token }),
  removeDoc: (kind) => request(`/team/documents/${kind}`, { method: 'DELETE', token }),
  confirmDuty: (id) => request(`/team/duties/${id}/confirm`, { method: 'POST', body: {}, token }),
  requestDutyCancel: (id, reason) => request(`/team/duties/${id}/cancel-request`, { method: 'POST', body: { reason }, token }),
  withdrawDutyCancel: (id) => request(`/team/duties/${id}/cancel-request/withdraw`, { method: 'POST', body: {}, token }),
  requestPay: (id, amount, note) => request(`/team/duties/${id}/pay-request`, { method: 'POST', body: { amount, note }, token }),
  requestLeave: (body) => request('/team/leaves', { method: 'POST', body, token }),
  withdrawLeave: (id) => request(`/team/leaves/${id}`, { method: 'DELETE', token }),
  chat: () => request('/team/chat', { token }),
  sendChat: (text) => request('/team/chat', { method: 'POST', body: { text }, token }),
  changePassword: (current, password) => request('/team/password', { method: 'POST', body: { current, password }, token }),
  pushSubscribe: (subscription) => request('/push/subscribe', { method: 'POST', body: { subscription }, token }),
});

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
  setAssigneePay: (id, personId, pay) => request(`/admin/bookings/${id}/assignees/${personId}`, { method: 'PATCH', body: { pay }, token }),
  resolveDutyCancel: (id, personId, action, note) => request(`/admin/bookings/${id}/assignees/${personId}/cancel`, { method: 'PATCH', body: { action, note }, token }),
  replaceAssignee: (id, fromId, toId) => request(`/admin/bookings/${id}/replace`, { method: 'POST', body: { fromId, toId }, token }),
  answerOffer: (id, action, note) => request(`/admin/bookings/${id}/offer`, { method: 'PATCH', body: { action, note }, token }),
  decideLeave: (id, body) => request(`/admin/leaves/${id}`, { method: 'PATCH', body, token }),
  chats: () => request('/admin/chats', { token }),
  chat: (thread) => request(`/admin/chats/${encodeURIComponent(thread)}`, { token }),
  sendChat: (thread, text) => request(`/admin/chats/${encodeURIComponent(thread)}`, { method: 'POST', body: { text }, token }),
  resetUserPassword: (id, password) => request(`/admin/users/${id}/password`, { method: 'POST', body: { password }, token }),
  deleteUser: (id) => request(`/admin/users/${id}`, { method: 'DELETE', token }),
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
