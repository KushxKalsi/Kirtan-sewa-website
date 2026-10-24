import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Banknote, Check, CircleAlert, CircleCheck, Copy, FileText, Hourglass, Loader2, Smartphone } from 'lucide-react';
import { useSite } from './SiteContext';
import { BillModal } from './Bill';
import { api } from '../lib/api';
import { PAYMENT_LABEL, rupees, upiLink } from '../lib/money';
import { ease } from '../lib/motion';

/** Customer view of the bill: appears once the jatha confirms and enters the amount. */
export default function PaymentBox({ booking, phone, onUpdated }) {
  const { site } = useSite();
  const s = site?.settings || {};
  const [utr, setUtr] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [showBill, setShowBill] = useState(false);

  if (booking.status === 'cancelled') return null;
  if (booking.status === 'pending' || !booking.amount) {
    return (
      <section className="pay-box">
        <h4>Payment</h4>
        <p className="muted">Your bill and payment options will appear here once the jatha confirms your booking.</p>
      </section>
    );
  }

  const upi = s.upiEnabled && s.upiId;
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const data = await api.submitPayment(booking.ref, phone, utr);
      onUpdated?.(data.booking);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  const copyUpi = async () => {
    try {
      await navigator.clipboard.writeText(s.upiId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked */
    }
  };

  let body;
  if (booking.paymentStatus === 'paid') {
    body = (
      <div className="pay-state paid">
        <CircleCheck size={20} />
        <div>
          <strong>Payment received</strong>
          <span>
            {rupees(booking.amount)} via {PAYMENT_LABEL[booking.paymentMethod]}. Waheguru Ji, thank you!
          </span>
        </div>
      </div>
    );
  } else if (booking.paymentStatus === 'submitted') {
    body = (
      <div className="pay-state submitted">
        <Hourglass size={20} />
        <div>
          <strong>Payment submitted — awaiting verification</strong>
          <span>UTR: {booking.utr}</span>
        </div>
      </div>
    );
  } else {
    body = (
      <>
        {upi && (
          <div className="pay-upi">
            {s.upiQr && <motion.img src={s.upiQr} alt="UPI QR code" className="pay-qr" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, ease }} />}
            <div className="pay-upi-info">
              <span className="muted">Scan the QR or pay to</span>
              <button type="button" className="chip pay-upi-id" onClick={copyUpi}>
                {s.upiId} {copied ? <Check size={13} /> : <Copy size={13} />}
              </button>
              {s.upiName && <span className="muted">{s.upiName}</span>}
              <a className="btn btn-primary btn-sm" href={upiLink({ upiId: s.upiId, upiName: s.upiName, amount: booking.amount, ref: booking.ref })}>
                <Smartphone size={16} /> Pay {rupees(booking.amount)} with UPI app
              </a>
            </div>
          </div>
        )}
        {upi && (
          <form className="pay-utr" onSubmit={submit}>
            <label className="field">
              <input value={utr} onChange={(e) => setUtr(e.target.value)} placeholder=" " required autoCapitalize="characters" spellCheck="false" />
              <span>UPI transaction ID / UTR</span>
            </label>
            <button className="btn btn-ghost" disabled={busy}>
              {busy ? <Loader2 size={17} className="spin" /> : <Check size={17} />} I have paid
            </button>
          </form>
        )}
        <AnimatePresence>
          {error && (
            <motion.div className="form-error" initial={{ opacity: 0 }} animate={{ opacity: 1, x: [0, -6, 6, 0] }} exit={{ opacity: 0 }}>
              <CircleAlert size={18} /> {error}
            </motion.div>
          )}
        </AnimatePresence>
        {s.cashEnabled && (
          <div className="pay-state cash">
            <Banknote size={20} />
            <div>
              <strong>{upi ? 'Or pay in cash' : 'Pay in cash'}</strong>
              <span>You can pay {rupees(booking.amount)} in cash to the jatha on the day of the program.</span>
            </div>
          </div>
        )}
        {!upi && !s.cashEnabled && <p className="muted">Please contact the jatha to arrange payment.</p>}
        {s.paymentNote && <p className="fine-print">{s.paymentNote}</p>}
      </>
    );
  }

  return (
    <motion.section className="pay-box" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease }}>
      <div className="pay-head">
        <div>
          <h4>Payment</h4>
          <span className="pay-amount">{rupees(booking.amount)}</span>
          <span className="muted">Bill No. {booking.billNo}</span>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowBill(true)}>
          <FileText size={16} /> View bill
        </button>
      </div>
      {body}
      <BillModal booking={showBill ? booking : null} settings={s} onClose={() => setShowBill(false)} />
    </motion.section>
  );
}
