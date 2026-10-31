import { format } from 'date-fns';
import { Download } from 'lucide-react';
import Modal from './Modal';
import { prettyDate, rangeTo12 } from '../lib/date';
import { PAYMENT_LABEL, rupees } from '../lib/money';

// Kept as a string so the exact same styles are used on screen and in the print window.
export const BILL_CSS = `
.bill{--ink:#1d1a16;--soft:#6b645a;--line:#e8e1d4;--gold:#b7791f;background:#fffdf8;color:var(--ink);font-family:Manrope,system-ui,sans-serif;font-size:14px;line-height:1.5;padding:36px;border-radius:16px;max-width:760px;margin:0 auto;font-variant-numeric:lining-nums tabular-nums}
.bill *{box-sizing:border-box}
.bill-head{display:flex;justify-content:space-between;gap:24px;padding-bottom:22px;border-bottom:2px solid var(--gold)}
.bill-brand{display:flex;gap:14px;align-items:center}
.bill-mark{display:grid;place-items:center;width:52px;height:52px;border-radius:14px;background:linear-gradient(135deg,#f6d58e,#e9b44c 45%,#ff9933);color:#1a1206;font-family:'Noto Sans Gurmukhi',sans-serif;font-size:28px;flex-shrink:0}
.bill-name{font-family:'Cormorant Garamond',Georgia,serif;font-size:28px;font-weight:700;line-height:1.05;margin:0}
.bill-tag{font-family:'Noto Sans Gurmukhi',sans-serif;color:var(--soft);margin:2px 0 0;font-size:13px}
.bill-title{text-align:right}
.bill-title h2{margin:0;font-family:'Cormorant Garamond',Georgia,serif;font-size:34px;letter-spacing:.12em;color:var(--gold);line-height:1}
.bill-title p{margin:6px 0 0;color:var(--soft);font-size:13px}
.bill-title strong{color:var(--ink)}
.bill-parties{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin:24px 0}
.bill-parties h4{margin:0 0 6px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--soft)}
.bill-parties p{margin:0;white-space:pre-line}
.bill table{width:100%;border-collapse:collapse;margin-top:6px}
.bill th{text-align:left;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--soft);padding:10px 12px;background:#f6efe1}
.bill td{padding:14px 12px;border-bottom:1px solid var(--line);vertical-align:top}
.bill td small{display:block;color:var(--soft)}
.bill .num{text-align:right;white-space:nowrap}
.bill-total td{border-bottom:0;font-weight:800;font-size:17px;padding-top:16px}
.bill-sub td{border-bottom:0;padding-top:8px;padding-bottom:4px;color:var(--soft)}
.bill-foot{display:flex;justify-content:space-between;align-items:flex-end;gap:24px;margin-top:26px}
.bill-stamp{display:inline-block;padding:8px 16px;border:2px solid currentColor;border-radius:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;transform:rotate(-4deg)}
.bill-stamp.paid{color:#15803d}.bill-stamp.due{color:#c2410c}
.bill-stamp-sub{margin:10px 0 0;color:var(--soft);font-size:12.5px}
.bill-pay{display:flex;gap:14px;align-items:center;text-align:right}
.bill-pay img{width:112px;height:112px;object-fit:contain;border:1px solid var(--line);border-radius:10px;background:#fff;padding:4px}
.bill-pay p{margin:0;font-size:13px;color:var(--soft)}
.bill-pay strong{display:block;color:var(--ink);font-size:14px}
.bill-thanks{margin:28px 0 0;padding-top:16px;border-top:1px solid var(--line);text-align:center;color:var(--soft);font-size:12.5px}
.bill-thanks span{display:block;font-family:'Noto Sans Gurmukhi',sans-serif;color:var(--gold);font-size:14px;margin-bottom:4px}
@media (max-width:560px){.bill{padding:22px}.bill-head{flex-direction:column}.bill-title{text-align:left}.bill-parties{grid-template-columns:1fr}.bill-foot{flex-direction:column;align-items:flex-start}.bill-pay{text-align:left}}
`;

export function Bill({ booking: b, settings: s, origin = '' }) {
  const paid = b.paymentStatus === 'paid';
  const showUpi = !paid && s.upiEnabled && s.upiId;
  const from = [s.address, s.phone, s.email].filter(Boolean).join('\n');
  const billed = [b.name, b.phone, b.address].filter(Boolean).join('\n');
  const payHow = [showUpi && 'UPI', s.cashEnabled && 'cash on the day'].filter(Boolean).join(' or ');
  let statusLine = payHow ? `Pay by ${payHow}` : '';
  if (paid) {
    statusLine = `Received via ${PAYMENT_LABEL[b.paymentMethod] || '—'}`;
    if (b.paidAt) statusLine += ` on ${format(new Date(b.paidAt), 'd MMM yyyy')}`;
    if (b.utr) statusLine += ` · UTR ${b.utr}`;
  } else if (b.paymentStatus === 'submitted') {
    statusLine = `UPI payment submitted (UTR ${b.utr}) — awaiting verification`;
  }

  return (
    <div className="bill">
      <header className="bill-head">
        <div className="bill-brand">
          <span className="bill-mark">ੴ</span>
          <div>
            <p className="bill-name">{s.siteName}</p>
            {s.gurmukhiTagline && <p className="bill-tag">{s.gurmukhiTagline}</p>}
          </div>
        </div>
        <div className="bill-title">
          <h2>BILL</h2>
          <p>
            No. <strong>{b.billNo}</strong>
          </p>
          <p>Date: {b.billedAt ? format(new Date(b.billedAt), 'd MMM yyyy') : '—'}</p>
          <p>Booking ID: {b.ref}</p>
        </div>
      </header>

      <section className="bill-parties">
        <div>
          <h4>From</h4>
          <p>{from}</p>
        </div>
        <div>
          <h4>Billed to</h4>
          <p>{billed}</p>
        </div>
      </section>

      <table>
        <thead>
          <tr>
            <th>Sewa</th>
            <th>Program</th>
            <th className="num">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              {b.serviceName}
              <small>{b.categoryName || 'Gurbani Kirtan sewa'}</small>
            </td>
            <td>
              {prettyDate(b.date, 'EEE, d MMM yyyy')}
              <small>
                {b.slotLabel} · {rangeTo12(b.slotTime)}
              </small>
            </td>
            <td className="num">{rupees(b.amount)}</td>
          </tr>
          <tr className="bill-total">
            <td colSpan={2}>Total</td>
            <td className="num">{rupees(b.amount)}</td>
          </tr>
        </tbody>
      </table>

      <footer className="bill-foot">
        <div>
          <span className={`bill-stamp ${paid ? 'paid' : 'due'}`}>{paid ? 'Paid' : 'Amount due'}</span>
          <p className="bill-stamp-sub">
            {statusLine}
          </p>
        </div>
        {showUpi && (
          <div className="bill-pay">
            <p>
              Pay via UPI
              <strong>{s.upiId}</strong>
              {s.upiName}
            </p>
            {s.upiQr && <img src={origin + s.upiQr} alt="UPI QR" />}
          </div>
        )}
      </footer>

      <p className="bill-thanks">
        <span>ਵਾਹਿਗੁਰੂ ਜੀ ਕਾ ਖ਼ਾਲਸਾ ਵਾਹਿਗੁਰੂ ਜੀ ਕੀ ਫ਼ਤਿਹ</span>
        Thank you for giving us the opportunity to do sewa.
      </p>
    </div>
  );
}

/** A team booking's bill to the member: the bhet for each person asked for. The admin's commission is never on it. */
export function TeamBill({ leave: l, settings: s, member, roles = {}, nameOf = () => '', whatOf, origin = '' }) {
  const paid = !!l.commissionPaid;
  const total = (l.picks || []).reduce((t, x) => t + (Number(x.pay) || 0), 0);
  const byUpi = l.paymentMethod === 'upi';
  const showUpi = !paid && byUpi && s.upiId && l.status !== 'cancelled' && l.status !== 'rejected';
  const from = [s.address, s.phone, s.email].filter(Boolean).join('\n');
  const billed = [member?.name || l.personName, member?.phone, 'Team member'].filter(Boolean).join('\n');
  const how = byUpi ? 'UPI' : l.paymentMethod === 'cash' ? 'cash' : '';
  let statusLine = how ? `Paying by ${how}` : '';
  if (paid) statusLine = `Received${how ? ` by ${how}` : ''}${l.commissionPaidAt ? ` on ${format(new Date(l.commissionPaidAt), 'd MMM yyyy')}` : ''}`;
  if (l.status === 'cancelled' || l.status === 'rejected') statusLine = `This team booking was ${l.status}.`;

  return (
    <div className="bill">
      <header className="bill-head">
        <div className="bill-brand">
          <span className="bill-mark">ੴ</span>
          <div>
            <p className="bill-name">{s.siteName}</p>
            {s.gurmukhiTagline && <p className="bill-tag">{s.gurmukhiTagline}</p>}
          </div>
        </div>
        <div className="bill-title">
          <h2>BILL</h2>
          <p>
            No. <strong>{l.billNo || l.id.slice(0, 8).toUpperCase()}</strong>
          </p>
          <p>Date: {format(new Date(l.createdAt), 'd MMM yyyy')}</p>
          <p>
            Team booking: {prettyDate(l.from, 'd MMM yyyy')}
            {l.to !== l.from && ` – ${prettyDate(l.to, 'd MMM yyyy')}`}
          </p>
        </div>
      </header>

      <section className="bill-parties">
        <div>
          <h4>From</h4>
          <p>{from}</p>
        </div>
        <div>
          <h4>Billed to</h4>
          <p>{billed}</p>
        </div>
      </section>

      <table>
        <thead>
          <tr>
            <th>Who goes</th>
            <th>Sewa / time</th>
            <th className="num">Bhet</th>
          </tr>
        </thead>
        <tbody>
          {(l.picks || []).map((x, i) => (
            <tr key={i}>
              <td>
                {roles[x.role] || 'Teammate'}
                <small>{x.personId && x.reply !== 'declined' ? nameOf(x.personId) : 'To be assigned'}</small>
              </td>
              <td>{whatOf(x)}</td>
              <td className="num">{rupees(x.pay)}</td>
            </tr>
          ))}
          <tr className="bill-total">
            <td colSpan={2}>Total</td>
            <td className="num">{rupees(total)}</td>
          </tr>
        </tbody>
      </table>

      <footer className="bill-foot">
        <div>
          <span className={`bill-stamp ${paid ? 'paid' : 'due'}`}>{paid ? 'Paid' : l.status === 'cancelled' || l.status === 'rejected' ? l.status : 'Amount due'}</span>
          <p className="bill-stamp-sub">{statusLine}</p>
        </div>
        {showUpi && (
          <div className="bill-pay">
            <p>
              Pay via UPI
              <strong>{s.upiId}</strong>
              {s.upiName}
            </p>
            {s.upiQr && <img src={origin + s.upiQr} alt="UPI QR" />}
          </div>
        )}
      </footer>

      <p className="bill-thanks">
        <span>ਵਾਹਿਗੁਰੂ ਜੀ ਕਾ ਖ਼ਾਲਸਾ ਵਾਹਿਗੁਰੂ ਜੀ ਕੀ ਫ਼ਤਿਹ</span>
        The bhet goes to the people who take your place.
      </p>
    </div>
  );
}

/** Opens the bill in a clean window and triggers print (Save as PDF works from there). */
export function printBill(booking, settings) {
  return printWindow(`Bill ${booking.billNo} — ${settings.siteName}`, () => <Bill booking={booking} settings={settings} origin={window.location.origin} />);
}
export function printTeamBill(props) {
  return printWindow(`Bill ${props.leave.billNo || ''} — ${props.settings.siteName}`, () => <TeamBill {...props} origin={window.location.origin} />);
}

async function printWindow(title, render) {
  const win = window.open('', '_blank'); // must open synchronously inside the click
  if (!win) return;
  const { renderToStaticMarkup } = await import('react-dom/server');
  const html = renderToStaticMarkup(render());
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=Manrope:wght@400;600;800&family=Noto+Sans+Gurmukhi:wght@400;600&display=swap" rel="stylesheet">
<style>body{margin:0;padding:24px;background:#fff}@media print{body{padding:0}.bill{border-radius:0;padding:12mm}@page{margin:8mm}}${BILL_CSS}</style>
</head><body>${html}<script>Promise.all([document.fonts.ready,...Array.from(document.images).map(i=>i.complete?0:new Promise(r=>{i.onload=i.onerror=r}))]).then(()=>setTimeout(()=>window.print(),150))</script></body></html>`);
  win.document.close();
}

export function BillModal({ booking, settings, onClose }) {
  return (
    <Modal open={!!booking} onClose={onClose} title={booking ? `Bill ${booking.billNo}` : ''} wide>
      {booking && (
        <>
          <style>{BILL_CSS}</style>
          <Bill booking={booking} settings={settings} />
          <div className="modal-actions">
            <button className="btn btn-primary" onClick={() => printBill(booking, settings)}>
              <Download size={17} /> Print / Save as PDF
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

export function TeamBillModal({ bill, onClose }) {
  return (
    <Modal open={!!bill} onClose={onClose} title={bill ? `Bill ${bill.leave.billNo || ''}` : ''} wide>
      {bill && (
        <>
          <style>{BILL_CSS}</style>
          <TeamBill {...bill} />
          <div className="modal-actions">
            <button className="btn btn-primary" onClick={() => printTeamBill(bill)}>
              <Download size={17} /> Print / Save as PDF
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
