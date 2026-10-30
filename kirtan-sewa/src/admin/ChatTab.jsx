import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { formatDistanceToNowStrict } from 'date-fns';
import { Check, HandCoins, Loader2, MessageSquarePlus, Search, UserRound, UsersRound } from 'lucide-react';
import ChatBox from '../components/ChatBox';
import { rupees } from '../lib/money';
import { prettyDate } from '../lib/date';

/** Bhet request in a team member's chat: set the amount right here (more, less or as asked). */
function PayAction({ m, personId, booking, api, onDone, toast }) {
  const current = booking?.assignees?.find((a) => a.id === personId);
  const [amount, setAmount] = useState(String(m.amount));
  const [busy, setBusy] = useState(false);
  if (m.status !== 'pending') return m.status === 'answered' ? <span className="chat-note">Bhet set to {m.answer != null ? rupees(m.answer) : '—'}</span> : null;
  if (!booking || !current) return <span className="chat-note">They are no longer on this booking.</span>;
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      onDone((await api.setAssigneePay(booking.id, personId, amount)).booking);
      toast(`Bhet set to ${rupees(amount)}.`);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="chat-action" onSubmit={save}>
      <span className="muted">Now {current.pay != null ? rupees(current.pay) : 'not set'} ·</span>
      <input className="input" type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Bhet amount" />
      <button className="btn btn-primary btn-sm" disabled={busy}>
        {busy ? <Loader2 size={14} className="spin" /> : <HandCoins size={14} />} Set bhet
      </button>
    </form>
  );
}

/** A customer's price offer: accept it (bill + confirm) or open the booking to set another amount. */
function OfferAction({ m, bookings, api, onDone, openBooking, toast }) {
  const [busy, setBusy] = useState('');
  const list = (m.bookingIds || [m.bookingId]).map((id) => bookings.find((b) => b.id === id)).filter(Boolean);
  const accept = async (b) => {
    setBusy(b.id);
    try {
      onDone((await api.answerOffer(b.id, 'accept')).booking);
      toast(`Accepted — bill ${rupees(b.offer.amount)} sent.`);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy('');
    }
  };
  return (
    <div className="chat-action column">
      {list.map((b) => (
        <div key={b.id} className="chat-offer-row">
          <button type="button" className="link-btn" onClick={() => openBooking(b.ref)}>
            {b.ref} · {prettyDate(b.date, 'd MMM')}
          </button>
          {b.offer?.status === 'pending' && b.status !== 'cancelled' ? (
            <button className="btn btn-primary btn-sm" onClick={() => accept(b)} disabled={!!busy}>
              {busy === b.id ? <Loader2 size={14} className="spin" /> : <Check size={14} />} Accept {rupees(b.offer.amount)}
            </button>
          ) : (
            <span className="chat-note">{b.offer ? { accepted: 'Accepted', countered: `Bill ${rupees(b.offer.counter)}`, declined: 'Declined', pending: 'Booking cancelled' }[b.offer.status] : 'No offer'}</span>
          )}
        </div>
      ))}
    </div>
  );
}

export default function ChatTab({ data, api, setData, toast, initialThread, openBooking }) {
  const [thread, setThread] = useState(initialThread || data.chats?.[0]?.id || '');
  const [query, setQuery] = useState('');
  const [starting, setStarting] = useState(false);
  const [reload, setReload] = useState(0);
  const chats = data.chats || [];
  const current = chats.find((c) => c.id === thread);
  const [kind, personId] = thread.split(':');
  const who = current || (kind === 'u' ? data.users?.find((u) => u.id === personId) : data.people?.find((p) => p.id === personId));

  // Keep the list (and unread counts) fresh.
  useEffect(() => {
    const t = setInterval(async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const { chats } = await api.chats();
        setData((d) => ({ ...d, chats }));
      } catch {
        /* next time */
      }
    }, 10000);
    return () => clearInterval(t);
  }, [api, setData]);

  const load = useCallback(() => api.chat(thread), [api, thread]);
  const send = useCallback(
    async (text) => {
      const res = await api.sendChat(thread, text);
      setData((d) => ({ ...d, chats: res.chats }));
      return res;
    },
    [api, thread, setData],
  );
  const seen = useCallback(() => setData((d) => ({ ...d, chats: (d.chats || []).map((c) => (c.id === thread ? { ...c, unread: 0 } : c)) })), [thread, setData]);
  const replaceBooking = (booking) => {
    setData((d) => ({ ...d, bookings: d.bookings.map((b) => (b.id === booking.id ? booking : b)) }));
    setReload((n) => n + 1);
  };

  const q = query.trim().toLowerCase();
  const shown = q ? chats.filter((c) => [c.name, c.phone].some((v) => v?.toLowerCase().includes(q))) : chats;
  const everyone = [...(data.users || []).map((u) => ({ id: `u:${u.id}`, label: `${u.name} · ${u.phone} (sangat)` })), ...(data.people || []).filter((p) => !p.pending).map((p) => ({ id: `m:${p.id}`, label: `${p.name}${p.phone ? ` · ${p.phone}` : ''} (team)` }))];

  return (
    <div className="admin-section chat-admin">
      <aside className="chat-threads glass">
        <div className="chat-threads-head">
          <label className="search">
            <Search size={16} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search chats…" />
          </label>
          <button className="icon-btn" onClick={() => setStarting((s) => !s)} aria-label="Start a new chat" title="Start a new chat">
            <MessageSquarePlus size={18} />
          </button>
        </div>
        {starting && (
          <select
            className="input"
            value=""
            onChange={(e) => {
              setThread(e.target.value);
              setStarting(false);
            }}
          >
            <option value="">Message someone…</option>
            {everyone.map((x) => (
              <option key={x.id} value={x.id}>
                {x.label}
              </option>
            ))}
          </select>
        )}
        {shown.length === 0 && <p className="muted chat-threads-empty">No conversations yet. Customers and team members can message you from their account.</p>}
        <ul>
          {shown.map((c) => (
            <li key={c.id}>
              <button className={`chat-thread ${c.id === thread ? 'active' : ''}`} onClick={() => setThread(c.id)}>
                {c.id === thread && <motion.span layoutId="chat-thread" className="chat-thread-bg" transition={{ type: 'spring', stiffness: 400, damping: 34 }} />}
                <span className="chat-thread-icon">{c.kind === 'member' ? <UsersRound size={16} /> : <UserRound size={16} />}</span>
                <span className="chat-thread-main">
                  <strong>
                    {c.name}
                    {c.role && <small> · {c.role}</small>}
                    {c.kind === 'member' && !c.role && <small> · team</small>}
                  </strong>
                  <span>
                    {c.last?.from === 'admin' ? 'You: ' : ''}
                    {c.last?.text}
                  </span>
                </span>
                <span className="chat-thread-side">
                  <small>{formatDistanceToNowStrict(new Date(c.lastAt))}</small>
                  {c.unread > 0 && <em className="tab-badge">{c.unread}</em>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {thread && who ? (
        <ChatBox
          key={thread}
          side="admin"
          title={who.name}
          subtitle={[kind === 'm' ? (current ? current.role : data.roles?.[who.role]) || 'Team member' : 'Sangat', who.phone].filter(Boolean).join(' · ')}
          callPhone={who.phone}
          load={load}
          send={send}
          onMessages={seen}
          reloadSignal={reload}
          renderActions={(m) =>
            m.kind === 'pay-request' ? (
              <PayAction m={m} personId={personId} booking={data.bookings.find((b) => b.id === m.bookingId)} api={api} onDone={replaceBooking} toast={toast} />
            ) : m.kind === 'offer' ? (
              <OfferAction m={m} bookings={data.bookings} api={api} onDone={replaceBooking} openBooking={openBooking} toast={toast} />
            ) : null
          }
        />
      ) : (
        <div className="admin-empty glass">Choose a conversation, or start one with the + button.</div>
      )}
    </div>
  );
}
