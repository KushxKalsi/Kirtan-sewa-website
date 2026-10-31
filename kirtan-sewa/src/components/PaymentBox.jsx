import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Banknote, Check, CircleAlert, CircleCheck, Copy, FileText, Hourglass, Loader2, Smartphone } from 'lucide-react';
import { useSite } from './SiteContext';
import { BillModal } from './Bill';
import { useAuth } from './AuthContext';
import { PAYMENT_LABEL, PAY_OPTIONS, enabledMethods, rupees, upiLink } from '../lib/money';
import { ease } from '../lib/motion';

const STATUS = {
  paid: { label: 'Paid', cls: 'pay-paid' },
  submitted: { label: 'Awaiting verification', cls: 'pay-submitted' },
  unpaid: { label: 'Not paid yet', cls: 'pay-unpaid' },
};

/** The jatha's UPI QR code and ID (tap to copy), with a button that opens a UPI app for this amount. */
export function UpiScan({ settings: s, amount, refNo, note }) {
  const [copied, setCopied] = useState(false);
  const copyUpi = async () => {
    try {
      await navigator.clipboard.writeText(s.upiId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked */
    }
  };
  return (
    <div className="pay-upi">
      {s.upiQr && <motion.img src={s.upiQr} alt="UPI QR code" className="pay-qr" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, ease }} />}
      <div className="pay-upi-info">
        <span className="muted">Scan the QR or pay to</span>
        <button type="button" className="chip pay-upi-id" onClick={copyUpi}>
          {s.upiId} {copied ? <Check size={13} /> : <Copy size={13} />}
        </button>
        {s.upiName && <span className="muted">{s.upiName}</span>}
        <a className="btn btn-primary btn-sm" href={upiLink({ upiId: s.upiId, upiName: s.upiName, amount, ref: refNo, note })}>
          <Smartphone size={16} /> Pay {amount ? rupees(amount) : ''} with UPI app
        </a>
      </div>
    </div>
  );
}

/**
 * Customer view of payment for one booking:
 * - always shows whether it is paid, and lets them pick / change UPI or cash until they have paid
 * - once the jatha confirms and sends the bill: UPI shows the QR + "I have paid"; cash shows what to bring
 */
export default function PaymentBox({ booking, onUpdated }) {
  const { site } = useSite();
  const { user } = useAuth();
  const s = site?.settings || {};
  const methods = enabledMethods(s);
  const [utr, setUtr] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [showBill, setShowBill] = useState(false);

  if (booking.status === 'cancelled') return null;

  const status = booking.paymentStatus || 'unpaid';
  const billed = booking.status !== 'pending' && booking.amount > 0;
  const method = methods.includes(booking.paymentMethod) ? booking.paymentMethod : '';
  const canChange = status === 'unpaid' && methods.length > 1;

  const run = async (key, fn) => {
    setBusy(key);
    setError('');
    try {
      const data = await fn();
      onUpdated?.(data.booking);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  };
  const choose = (m) => m !== booking.paymentMethod && run(m, () => user.setPaymentMethod(booking.ref, m));
  const submitUtr = (e) => {
    e.preventDefault();
    run('utr', () => user.submitPayment(booking.ref, utr));
  };
  let body = null;
  if (status === 'paid') {
    body = (
      <div className="pay-state paid">
        <CircleCheck size={20} />
        <div>
          <strong>Payment received</strong>
          <span>
            {rupees(booking.amount)} via {PAYMENT_LABEL[booking.paymentMethod] || '—'}. Waheguru Ji, thank you!
          </span>
        </div>
      </div>
    );
  } else if (status === 'submitted') {
    body = (
      <div className="pay-state submitted">
        <Hourglass size={20} />
        <div>
          <strong>UPI payment submitted — the jatha will verify it</strong>
          <span>UTR: {booking.utr}</span>
        </div>
      </div>
    );
  } else if (!method) {
    body = methods.length ? <p className="muted">Choose how you would like to pay.</p> : <p className="muted">The jatha will tell you how to pay.</p>;
  } else if (!billed) {
    body = (
      <p className="muted">
        {method === 'upi'
          ? 'Once the jatha confirms, your bill and the UPI QR code will appear here. Turn on notifications to be told straight away.'
          : 'Once the jatha confirms, your bill will appear here. You pay in cash on the day of the program.'}
      </p>
    );
  } else if (method === 'cash') {
    body = (
      <div className="pay-state cash">
        <Banknote size={20} />
        <div>
          <strong>Pay {rupees(booking.amount)} in cash</strong>
          <span>Please give it to the jatha on the day of the program.</span>
        </div>
      </div>
    );
  } else {
    body = (
      <>
        <UpiScan settings={s} amount={booking.amount} refNo={booking.ref} />
        <form className="pay-utr" onSubmit={submitUtr}>
          <label className="field">
            <input value={utr} onChange={(e) => setUtr(e.target.value)} placeholder=" " required autoCapitalize="characters" spellCheck="false" />
            <span>UPI transaction ID / UTR</span>
          </label>
          <button className="btn btn-ghost" disabled={!!busy}>
            {busy === 'utr' ? <Loader2 size={17} className="spin" /> : <Check size={17} />} I have paid
          </button>
        </form>
      </>
    );
  }

  return (
    <motion.section className="pay-box" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease }}>
      <div className="pay-head">
        <div>
          <h4>Payment</h4>
          {billed ? <span className="pay-amount">{rupees(booking.amount)}</span> : <span className="pay-amount small">Bill after confirmation</span>}
          {billed && <span className="muted">Bill No. {booking.billNo}</span>}
        </div>
        <div className="pay-head-side">
          <span className={`pay-tag ${STATUS[status].cls}`}>{STATUS[status].label}</span>
          {billed && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowBill(true)}>
              <FileText size={16} /> View bill
            </button>
          )}
        </div>
      </div>

      {status === 'unpaid' && methods.length > 0 && (canChange || !method) && (
        <div className="pay-choose">
          <span className="label">{method ? 'Paying by — tap to change' : 'How would you like to pay?'}</span>
          <div className="pay-options" role="radiogroup">
            {methods.map((m) => {
              const opt = PAY_OPTIONS[m];
              const on = method === m;
              return (
                <button type="button" role="radio" aria-checked={on} key={m} className={`pay-option ${on ? 'active' : ''}`} onClick={() => choose(m)} disabled={!!busy}>
                  {on && <motion.span layoutId={`pay-${booking.ref}`} className="pay-option-bg" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                  {busy === m ? <Loader2 size={20} className="spin" /> : <opt.icon size={20} />}
                  <span>
                    <strong>{opt.label}</strong>
                    <small>{opt.sub}</small>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {body}

      <AnimatePresence>
        {error && (
          <motion.div className="form-error" initial={{ opacity: 0 }} animate={{ opacity: 1, x: [0, -6, 6, 0] }} exit={{ opacity: 0 }}>
            <CircleAlert size={18} /> {error}
          </motion.div>
        )}
      </AnimatePresence>
      {s.paymentNote && status === 'unpaid' && <p className="fine-print">{s.paymentNote}</p>}
      {billed && <BillModal booking={showBill ? booking : null} settings={s} onClose={() => setShowBill(false)} />}
    </motion.section>
  );
}
