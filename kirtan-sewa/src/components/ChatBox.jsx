import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { format, isSameDay } from 'date-fns';
import { HandCoins, Info, Loader2, Phone, SendHorizontal, Tag } from 'lucide-react';
import { rupees } from '../lib/money';

const KIND = {
  offer: { icon: Tag, label: 'Offer' },
  'pay-request': { icon: HandCoins, label: 'Bhet request' },
};

/**
 * One conversation with the admin (or, for the admin, with one customer / team member).
 * New messages are fetched every few seconds while the page is visible.
 */
export default function ChatBox({ load, send, side, title, subtitle, callPhone, callLabel = 'Call', renderActions, onMessages, reloadSignal = 0, pollMs = 8000 }) {
  const [messages, setMessages] = useState(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const listRef = useRef(null);
  const count = useRef(0);
  // Callers may pass inline functions; keep the latest without restarting the polling.
  const props = useRef({ load, onMessages });
  props.current = { load, onMessages };

  const show = useCallback((list) => {
    setMessages(list);
    props.current.onMessages?.(list);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const data = await props.current.load();
      show(data.messages);
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, [show]);

  useEffect(() => {
    refresh();
    const t = setInterval(() => document.visibilityState === 'visible' && refresh(), pollMs);
    return () => clearInterval(t);
  }, [refresh, pollMs]);
  // The parent bumps reloadSignal after acting on a message (e.g. setting a bhet) to show the result at once.
  useEffect(() => {
    if (reloadSignal) refresh();
  }, [reloadSignal, refresh]);

  // Keep the newest message in view.
  useEffect(() => {
    if (!messages || messages.length === count.current) return;
    count.current = messages.length;
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const submit = async (e) => {
    e?.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      const data = await send(text.trim());
      show(data.messages);
      setText('');
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const mine = (m) => (side === 'admin' ? m.from === 'admin' : m.from !== 'admin');
  const tel = callPhone ? `tel:${String(callPhone).replace(/[^\d+]/g, '')}` : '';

  return (
    <div className="chat glass">
      <header className="chat-head">
        <div>
          <strong>{title}</strong>
          {subtitle && <span>{subtitle}</span>}
        </div>
        {tel && (
          <a className="btn btn-primary btn-sm chat-call" href={tel}>
            <Phone size={15} /> {callLabel}
          </a>
        )}
      </header>
      <div className="chat-list" ref={listRef} data-lenis-prevent>
        {!messages ? (
          <div className="chat-empty">
            <Loader2 className="spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="chat-empty">
            <p>No messages yet. Ask anything — about the bhet, timings, the venue…</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((m, i) => {
              const at = new Date(m.at);
              const newDay = i === 0 || !isSameDay(at, new Date(messages[i - 1].at));
              const kind = KIND[m.kind];
              return (
                <motion.div key={m.id} layout="position" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
                  {newDay && <p className="chat-day">{format(at, 'EEE, d MMM yyyy')}</p>}
                  {m.kind === 'system' ? (
                    <p className="chat-system">
                      <Info size={13} /> {m.text}
                      <time>{format(at, 'h:mm a')}</time>
                    </p>
                  ) : (
                    <div className={`chat-msg ${mine(m) ? 'mine' : ''} ${kind ? `k-${m.kind}` : ''}`}>
                      {kind && (
                        <span className="chat-kind">
                          <kind.icon size={13} /> {kind.label} · {rupees(m.amount)}
                        </span>
                      )}
                      <p>{m.text}</p>
                      {renderActions?.(m)}
                      <time>{format(at, 'h:mm a')}</time>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
      <form className="chat-input" onSubmit={submit}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) submit(e);
          }}
          rows={1}
          maxLength={1000}
          placeholder="Write a message…"
          aria-label="Message"
        />
        <button className="btn btn-primary" disabled={sending || !text.trim()} aria-label="Send">
          {sending ? <Loader2 size={18} className="spin" /> : <SendHorizontal size={18} />}
        </button>
      </form>
      {error && <p className="chat-error">{error}</p>}
    </div>
  );
}
