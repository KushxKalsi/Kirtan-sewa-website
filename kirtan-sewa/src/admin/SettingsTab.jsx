import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ImageUp, Loader2, Plus, QrCode, Save, Trash2 } from 'lucide-react';
import { ease } from '../lib/motion';
import { fileToDataUrl } from '../lib/image';

const FIELDS = [
  { k: 'siteName', label: 'Jatha / website name' },
  { k: 'gurmukhiTagline', label: 'Gurmukhi tagline', gurmukhi: true },
  { k: 'tagline', label: 'Hero description', area: true },
  { k: 'about', label: 'About the jatha', area: true, rows: 5 },
  { k: 'aboutImage', label: 'About photo URL (optional)', placeholder: 'https://…' },
  { k: 'phone', label: 'Phone number' },
  { k: 'whatsapp', label: 'WhatsApp number (with country code, digits only)', placeholder: '919876543210' },
  { k: 'email', label: 'Email' },
  { k: 'address', label: 'Based in / address' },
];
const NUMBERS = [
  { k: 'yearsOfSewa', label: 'Years of sewa' },
  { k: 'programsDone', label: 'Programs done' },
  { k: 'citiesCovered', label: 'Cities covered' },
  { k: 'maxAdvanceDays', label: 'Allow booking up to (days ahead)' },
];

export default function SettingsTab({ data, api, patch, toast }) {
  const [form, setForm] = useState(() => ({ ...data.settings, galleryText: (data.settings.gallery || []).join('\n') }));
  const [saving, setSaving] = useState(false);
  const [qrBusy, setQrBusy] = useState(false);
  const fileRef = useRef(null);
  const check = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.checked }));

  const uploadQr = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setQrBusy(true);
    try {
      const res = await api.uploadQr(await fileToDataUrl(file));
      patch({ settings: res.settings });
      setForm((f) => ({ ...f, upiQr: res.settings.upiQr }));
      toast('UPI QR uploaded.');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setQrBusy(false);
    }
  };
  const removeQr = async () => {
    setQrBusy(true);
    try {
      const res = await api.removeQr();
      patch({ settings: res.settings });
      setForm((f) => ({ ...f, upiQr: '' }));
      toast('QR removed.');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setQrBusy(false);
    }
  };
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const setTestimonial = (i, k, v) => setForm((f) => ({ ...f, testimonials: f.testimonials.map((t, j) => (j === i ? { ...t, [k]: v } : t)) }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { galleryText, ...rest } = form;
      const res = await api.saveSettings({ ...rest, gallery: galleryText.split('\n').map((s) => s.trim()).filter(Boolean) });
      patch({ settings: res.settings });
      toast('Settings saved — the website is updated.');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="admin-section" onSubmit={save}>
      <div className="admin-card glass admin-form">
        <h2>Website content</h2>
        {FIELDS.map((f) => (
          <label key={f.k}>
            <span className="label">{f.label}</span>
            {f.area ? (
              <textarea className="input" rows={f.rows || 3} value={form[f.k] || ''} onChange={set(f.k)} />
            ) : (
              <input className={`input ${f.gurmukhi ? 'gurmukhi' : ''}`} value={form[f.k] || ''} onChange={set(f.k)} placeholder={f.placeholder} />
            )}
          </label>
        ))}
        <div className="grid-2">
          {NUMBERS.map((f) => (
            <label key={f.k}>
              <span className="label">{f.label}</span>
              <input className="input" type="number" min="0" value={form[f.k] ?? ''} onChange={set(f.k)} />
            </label>
          ))}
        </div>
        <label className="switch-row">
          <input type="checkbox" checked={form.customTimeEnabled !== false} onChange={check('customTimeEnabled')} />
          <span className="switch" />
          Let customers enter their own time (besides the fixed time slots)
        </label>
      </div>

      <div className="admin-card glass admin-form">
        <div>
          <h2>Payments</h2>
          <p className="muted">When you confirm a booking you enter the amount and a bill is created. The customer then sees the bill with the options you turn on here.</p>
        </div>
        <label className="switch-row">
          <input type="checkbox" checked={!!form.upiEnabled} onChange={check('upiEnabled')} />
          <span className="switch" />
          Accept UPI (QR / UPI ID)
        </label>
        {form.upiEnabled && (
          <div className="upi-settings">
            <div className="grid-2">
              <label>
                <span className="label">UPI ID *</span>
                <input className="input" value={form.upiId || ''} onChange={set('upiId')} placeholder="yourname@okhdfcbank" autoCapitalize="none" spellCheck="false" />
              </label>
              <label>
                <span className="label">Name shown to payer</span>
                <input className="input" value={form.upiName || ''} onChange={set('upiName')} placeholder="e.g. Bhai Gurpreet Singh" />
              </label>
            </div>
            <div className="qr-upload">
              <div className="qr-preview">{form.upiQr ? <img src={form.upiQr} alt="UPI QR" /> : <QrCode size={40} />}</div>
              <div>
                <span className="label">UPI QR code</span>
                <p className="muted">Upload the QR image from Google Pay / PhonePe / Paytm / your bank app. It is shown on every bill.</p>
                <div className="row-actions start">
                  <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadQr} hidden />
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => fileRef.current?.click()} disabled={qrBusy}>
                    {qrBusy ? <Loader2 size={16} className="spin" /> : <ImageUp size={16} />} {form.upiQr ? 'Replace QR' : 'Upload QR'}
                  </button>
                  {form.upiQr && (
                    <button type="button" className="btn btn-ghost btn-sm danger-text" onClick={removeQr} disabled={qrBusy}>
                      <Trash2 size={16} /> Remove
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        <label className="switch-row">
          <input type="checkbox" checked={!!form.cashEnabled} onChange={check('cashEnabled')} />
          <span className="switch" />
          Accept cash on the day
        </label>
        <label>
          <span className="label">Note shown with payment options</span>
          <textarea className="input" rows={2} value={form.paymentNote || ''} onChange={set('paymentNote')} />
        </label>
      </div>

      <div className="admin-card glass admin-form">
        <h2>Gallery</h2>
        <p className="muted">Paste one image URL per line. The gallery section is hidden while this is empty.</p>
        <textarea className="input" rows={5} value={form.galleryText} onChange={set('galleryText')} placeholder={'https://…/photo1.jpg\nhttps://…/photo2.jpg'} />
      </div>

      <div className="admin-card glass admin-form">
        <div className="admin-section-head">
          <h2>Testimonials</h2>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setForm((f) => ({ ...f, testimonials: [...f.testimonials, { name: '', place: '', text: '' }] }))}>
            <Plus size={16} /> Add
          </button>
        </div>
        <AnimatePresence initial={false}>
          {form.testimonials.map((t, i) => (
            <motion.div key={i} className="testimonial-edit" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3, ease }}>
              <div className="grid-2">
                <input className="input" value={t.name} onChange={(e) => setTestimonial(i, 'name', e.target.value)} placeholder="Name" aria-label="Name" />
                <input className="input" value={t.place} onChange={(e) => setTestimonial(i, 'place', e.target.value)} placeholder="City" aria-label="City" />
              </div>
              <div className="te-row">
                <textarea className="input" rows={2} value={t.text} onChange={(e) => setTestimonial(i, 'text', e.target.value)} placeholder="What they said" aria-label="Testimonial" />
                <button type="button" className="icon-btn danger-text" onClick={() => setForm((f) => ({ ...f, testimonials: f.testimonials.filter((_, j) => j !== i) }))} aria-label="Remove">
                  <Trash2 size={16} />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="sticky-save">
        <button className="btn btn-primary" disabled={saving}>
          {saving ? <Loader2 size={18} className="spin" /> : <Save size={18} />} Save settings
        </button>
      </div>
    </form>
  );
}
