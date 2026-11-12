import { readStore, writeStore } from './storage';
import { API_BASE, withBase } from './native';

// This browser's random id, so a visitor who isn't logged in can like a post once.
function deviceId() {
  let id = readStore('sewa.device', '');
  if (!/^[a-z0-9]{16,64}$/.test(id)) {
    id = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
    writeStore('sewa.device', id);
  }
  return id;
}
// Logged in on this device as a customer or team member: likes count once per account.
const sessionToken = () => readStore('sewa.session', null)?.token;

async function request(path, { method = 'GET', body, token, device } = {}) {
  const headers = {};
  if (device) headers['X-Device'] = deviceId();
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(`${API_BASE}/api${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch {
    throw new Error('Cannot reach the server. Check your connection.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'Something went wrong.');
    err.status = res.status;
    throw err;
  }
  return withBase(data);
}

export const api = {
  site: () => request('/public'),
  availability: (from, to) => request(`/availability?from=${from}&to=${to}`),
  pushKey: () => request('/push/key'),
  pushSubscribePublic: (subscription) => request('/push/subscribe-public', { method: 'POST', body: { subscription } }),
  searchPlaces: (q) => request(`/geo/search?q=${encodeURIComponent(q)}`),
  reversePlace: (lat, lng) => request(`/geo/reverse?lat=${lat}&lng=${lng}`),
  register: (body) => request('/auth/register', { method: 'POST', body }),
  registerTeam: (body) => request('/auth/register-team', { method: 'POST', body }),
  login: (body) => request('/auth/login', { method: 'POST', body }),
  posts: ({ member = '', before = '', limit = 12 } = {}) => request(`/posts?member=${member}&before=${encodeURIComponent(before)}&limit=${limit}`, { device: true, token: sessionToken() }),
  // The home page feed: followed members first; a seed shuffles it (the same order on every page of one refresh).
  feed: ({ seed = 0, offset = 0, limit = 12 } = {}) => request(`/posts?feed=1&seed=${seed}&offset=${offset}&limit=${limit}`, { device: true, token: sessionToken() }),
  post: (id) => request(`/posts/${id}`, { device: true, token: sessionToken() }),
  member: (id) => request(`/members/${id}`, { device: true, token: sessionToken() }),
  follow: (id) => request(`/members/${id}/follow`, { method: 'POST', body: {}, device: true, token: sessionToken() }),
  comments: (id) => request(`/posts/${id}/comments`, { device: true, token: sessionToken() }),
  addComment: (id, text) => request(`/posts/${id}/comments`, { method: 'POST', body: { text }, device: true, token: sessionToken() }),
  deleteComment: (id, commentId) => request(`/posts/${id}/comments/${commentId}`, { method: 'DELETE', device: true, token: sessionToken() }),
  likePost: (id) => request(`/posts/${id}/like`, { method: 'POST', body: {}, device: true, token: sessionToken() }),
  sharePost: (id) => request(`/posts/${id}/share`, { method: 'POST', body: {} }),
  reportPost: (id, reason) => request(`/posts/${id}/report`, { method: 'POST', body: { reason }, device: true, token: sessionToken() }),
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
  addBusy: (body) => request('/team/busy', { method: 'POST', body, token }),
  removeBusy: (id) => request(`/team/busy/${id}`, { method: 'DELETE', token }),
  confirmDuty: (id) => request(`/team/duties/${id}/confirm`, { method: 'POST', body: {}, token }),
  markDutyDone: (id) => request(`/team/duties/${id}/done`, { method: 'POST', body: {}, token }),
  requestDutyCancel: (id, reason) => request(`/team/duties/${id}/cancel-request`, { method: 'POST', body: { reason }, token }),
  withdrawDutyCancel: (id) => request(`/team/duties/${id}/cancel-request/withdraw`, { method: 'POST', body: {}, token }),
  requestPay: (id, amount, note) => request(`/team/duties/${id}/pay-request`, { method: 'POST', body: { amount, note }, token }),
  requestLeave: (body) => request('/team/leaves', { method: 'POST', body, token }),
  withdrawLeave: (id) => request(`/team/leaves/${id}`, { method: 'DELETE', token }),
  payLeave: (id, utr) => request(`/team/leaves/${id}/payment`, { method: 'POST', body: { utr }, token }),
  requestLeaveCancel: (id, reason) => request(`/team/leaves/${id}/cancel-request`, { method: 'POST', body: { reason }, token }),
  withdrawLeaveCancel: (id) => request(`/team/leaves/${id}/cancel-request/withdraw`, { method: 'POST', body: {}, token }),
  answerLeave: (id, accept, note) => request(`/team/leaves/${id}/answer`, { method: 'POST', body: { accept, note }, token }),
  chat: () => request('/team/chat', { token }),
  sendChat: (text) => request('/team/chat', { method: 'POST', body: { text }, token }),
  changePassword: (current, password) => request('/team/password', { method: 'POST', body: { current, password }, token }),
  pushSubscribe: (subscription) => request('/push/subscribe', { method: 'POST', body: { subscription }, token }),
  posts: () => request('/team/posts', { token }),
  startUpload: (type, size) => request('/team/media', { method: 'POST', body: { type, size }, token }),
  createPost: (post) => request('/team/posts', { method: 'POST', body: post, token }),
  editPost: (id, post) => request(`/team/posts/${id}`, { method: 'PUT', body: post, token }),
  deletePost: (id) => request(`/team/posts/${id}`, { method: 'DELETE', token }),
  setPhoto: (id) => request('/team/photo', { method: 'PUT', body: { id }, token }),
  setBio: (bio) => request('/team/bio', { method: 'PUT', body: { bio }, token }),
  posterText: (dutyId, body) => request(dutyId ? `/team/duties/${dutyId}/poster-text` : '/team/poster-text', { method: 'POST', body, token }),
  addPosterBackground: (id, title) => request('/team/poster-backgrounds', { method: 'POST', body: { id, title }, token }),
  deletePosterBackground: (id) => request(`/team/poster-backgrounds/${id}`, { method: 'DELETE', token }),
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
  confirmAssignee: (id, personId, confirmed) => request(`/admin/bookings/${id}/assignees/${personId}/confirm`, { method: 'PATCH', body: { confirmed }, token }),
  settleAssignee: (id, personId, settled) => request(`/admin/bookings/${id}/assignees/${personId}/settle`, { method: 'PATCH', body: { settled }, token }),
  resolveDutyCancel: (id, personId, action, note) => request(`/admin/bookings/${id}/assignees/${personId}/cancel`, { method: 'PATCH', body: { action, note }, token }),
  replaceAssignee: (id, fromId, toId) => request(`/admin/bookings/${id}/replace`, { method: 'POST', body: { fromId, toId }, token }),
  answerOffer: (id, action, note) => request(`/admin/bookings/${id}/offer`, { method: 'PATCH', body: { action, note }, token }),
  decideLeave: (id, body) => request(`/admin/leaves/${id}`, { method: 'PATCH', body, token }),
  deleteLeave: (id) => request(`/admin/leaves/${id}`, { method: 'DELETE', token }),
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
  posts: () => request('/admin/posts', { token }),
  startUpload: (type, size) => request('/admin/media', { method: 'POST', body: { type, size }, token }),
  createPost: (post) => request('/admin/posts', { method: 'POST', body: post, token }),
  editPost: (id, post) => request(`/admin/posts/${id}`, { method: 'PUT', body: post, token }),
  updatePost: (id, body) => request(`/admin/posts/${id}`, { method: 'PATCH', body, token }),
  deletePost: (id) => request(`/admin/posts/${id}`, { method: 'DELETE', token }),
  deleteComment: (id, commentId) => request(`/admin/posts/${id}/comments/${commentId}`, { method: 'DELETE', token }),
  addTrack: (id, title) => request('/admin/audio-library', { method: 'POST', body: { id, title }, token }),
  deleteTrack: (id) => request(`/admin/audio-library/${id}`, { method: 'DELETE', token }),
  deletePosterBackground: (id) => request(`/admin/poster-backgrounds/${id}`, { method: 'DELETE', token }),
});

export const adminLogin = (password) => request('/admin/login', { method: 'POST', body: { password } });
