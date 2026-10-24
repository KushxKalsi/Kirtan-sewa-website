import { useState } from 'react';
import { Bell, BellOff, BellRing, Loader2, Send } from 'lucide-react';
import Modal from '../components/Modal';
import { adminPushOn, disableAdminNotifications, enableAdminNotifications, isIos, isStandalone, pushSupported } from '../lib/push';

/** Header control: turn on notifications for every customer action on this device. */
export default function AdminNotify({ api, devices, toast, onChange }) {
  const [on, setOn] = useState(adminPushOn);
  const [busy, setBusy] = useState('');
  const [open, setOpen] = useState(false);

  const run = async (key, fn, done) => {
    setBusy(key);
    try {
      await fn();
      done?.();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy('');
    }
  };

  const enable = () =>
    run('on', () => enableAdminNotifications(api), () => {
      setOn(true);
      onChange?.();
      toast('Notifications on — you’ll hear about every new booking, request and payment.');
    });
  const disable = () =>
    run('off', () => disableAdminNotifications(api), () => {
      setOn(false);
      onChange?.();
      setOpen(false);
      toast('Notifications turned off on this device.');
    });
  const test = () => run('test', () => api.pushTest(), () => toast('Test sent — it should appear in a few seconds.'));

  return (
    <>
      <button className={`btn btn-sm ${on ? 'btn-ghost notify-on' : 'btn-primary'}`} onClick={() => (on ? setOpen(true) : enable())} disabled={!!busy}>
        {busy === 'on' ? <Loader2 size={15} className="spin" /> : on ? <BellRing size={15} /> : <Bell size={15} />}
        {on ? 'Notifications on' : 'Turn on notifications'}
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Admin notifications" subtitle="This device is notified about every customer action.">
        <ul className="notify-list">
          <li>🙏 New booking requests (including multi-slot bookings)</li>
          <li>💰 UPI payments waiting for you to verify</li>
          <li>✋ Cancellation requests and withdrawals</li>
          <li>🔁 Customers switching between UPI and cash</li>
        </ul>
        <p className="muted">
          Devices turned on: <strong>{devices}</strong>. Turn it on from each phone or computer where you want alerts.
          {!pushSupported() && isIos() && !isStandalone() && ' On iPhone, add the site to your Home Screen first.'}
        </p>
        <div className="modal-actions">
            <button className="btn btn-ghost" onClick={disable} disabled={!!busy}>
              {busy === 'off' ? <Loader2 size={16} className="spin" /> : <BellOff size={16} />} Turn off here
            </button>
            <button className="btn btn-primary" onClick={test} disabled={!!busy}>
              {busy === 'test' ? <Loader2 size={16} className="spin" /> : <Send size={16} />} Send test
            </button>
        </div>
      </Modal>
    </>
  );
}
