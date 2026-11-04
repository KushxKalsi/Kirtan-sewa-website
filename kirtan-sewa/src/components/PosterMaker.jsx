import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { Camera, Download, Loader2, RefreshCw, Send, Sparkles, X } from 'lucide-react';
import Modal from './Modal';
import { useSite } from './SiteContext';
import { fromKey } from '../lib/date';
import { uploadMedia } from '../lib/media';
import { drawPoster, loadImage, loadPosterFonts } from '../lib/poster';

const to12 = (t) => {
  const [h, m] = t.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')}`;
};
const FIELDS = [
  ['occasion', 'Title, line 1 (occasion)'],
  ['occasionFor', 'Title, line 2 (whose Gurpurab — optional)'],
  ['program', 'Program'],
  ['place', 'Village / place'],
  ['name', 'Your name'],
  ['nameLine', 'Under your name (e.g. … ਵਾਲੇ — optional)'],
  ['timeLabel', 'Time of day (e.g. ਸ਼ਾਮ)'],
];

/**
 * "Generate poster" for a kirtan the admin gave them: AI writes the Punjabi wording, the poster is drawn here, and they
 * choose to post it to their profile, download it, or leave it.
 */
export default function PosterMaker({ duty, person, team, toast, onClose }) {
  const { site } = useSite();
  const canvasRef = useRef(null);
  const [step, setStep] = useState('details'); // details → preview
  const [busy, setBusy] = useState('');
  const [info, setInfo] = useState(null); // { posterAi, photo }
  const [photo, setPhoto] = useState(null); // { url, img }
  const gurpurab = (site?.gurpurabs || []).find((g) => g.date === duty?.date);
  const [details, setDetails] = useState({ occasion: '', venue: '', name: '', from: '' });
  const [text, setText] = useState(null);
  const [caption, setCaption] = useState('');

  useEffect(() => {
    if (!duty) return;
    setStep('details');
    setText(null);
    setDetails({ occasion: gurpurab ? `${gurpurab.kindLabel} ${gurpurab.name}` : duty.serviceName, venue: duty.address || '', name: person.name, from: '' });
    setCaption(`${duty.serviceName} · ${format(fromKey(duty.date), 'd MMM yyyy')}`);
    loadPosterFonts();
    team.posts().then(
      async (r) => {
        setInfo(r);
        // Their profile photo, or the Jatha head photo from their documents.
        const url = r.photo || person.docs?.headPhoto?.url;
        if (url) setPhoto({ url, img: await loadImage(url) });
      },
      () => setInfo({ posterAi: false }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duty?.id]);

  const [start, end] = (duty?.slotTime || '').split('–').map((t) => t.trim());
  const base = duty && {
    date: format(fromKey(duty.date), 'dd MMM, yyyy'),
    time: start && end ? `${to12(start)} - ${to12(end)}` : '',
    footer: site?.settings.siteName || '',
  };

  // Redraw whenever the wording or photo changes.
  useEffect(() => {
    if (step !== 'preview' || !text || !canvasRef.current) return;
    loadPosterFonts().then(() => drawPoster(canvasRef.current, { ...base, ...text }, photo?.img));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, text, photo]);

  const generate = async (e) => {
    e?.preventDefault();
    setBusy('generate');
    try {
      if (info?.posterAi) {
        const r = await team.posterText(duty.id, { occasion: details.occasion, venue: details.venue, name: details.name, from: details.from });
        setText(r.text);
      } else {
        // No AI on this site: start from what they typed; they can write it in Punjabi below.
        setText({ occasion: details.occasion, occasionFor: '', program: 'ਕੀਰਤਨ ਹਾਜ਼ਰੀ', place: details.venue.split(',')[0], name: details.name, nameLine: details.from, timeLabel: '' });
      }
      setStep('preview');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy('');
    }
  };
  const choosePhoto = async (file) => {
    const url = URL.createObjectURL(file);
    setPhoto({ url, img: await loadImage(url) });
  };
  const blob = () => new Promise((resolve, reject) => canvasRef.current.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not make the image — try another photo.'))), 'image/jpeg', 0.92));
  const download = async () => {
    try {
      const url = URL.createObjectURL(await blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = `poster-${duty.date}.jpg`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (err) {
      toast(err.message, 'error');
    }
  };
  const post = async () => {
    setBusy('post');
    try {
      const file = new File([await blob()], `poster-${duty.date}.jpg`, { type: 'image/jpeg' });
      const { id } = await uploadMedia(team, file);
      await team.createPost({ caption, media: [id], bookingId: duty.id, poster: true });
      toast('Poster posted to your profile 🙏');
      onClose();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy('');
    }
  };
  const set = (k) => (e) => setDetails((d) => ({ ...d, [k]: e.target.value }));

  return (
    <Modal open={!!duty} onClose={onClose} title="Generate poster" subtitle={duty && `${duty.serviceName} · ${format(fromKey(duty.date), 'EEE d MMM yyyy')}`} wide>
      {duty && step === 'details' && (
        <form className="poster-form" onSubmit={generate}>
          <label className="field">
            <input value={details.occasion} onChange={set('occasion')} placeholder=" " required />
            <span>Occasion (e.g. Prakash Purab Sri Guru Nanak Dev Ji, Sukhmani Sahib path)</span>
          </label>
          <label className="field">
            <input value={details.venue} onChange={set('venue')} placeholder=" " required />
            <span>Village / place</span>
          </label>
          <div className="form-row">
            <label className="field">
              <input value={details.name} onChange={set('name')} placeholder=" " required />
              <span>Your name as on the poster (e.g. Baba Pritpal Singh)</span>
            </label>
            <label className="field">
              <input value={details.from} onChange={set('from')} placeholder=" " />
              <span>Known as / from (e.g. Sohane wale)</span>
            </label>
          </div>
          <div className="poster-photo-row">
            {photo?.url ? <img src={photo.url} alt="" className="poster-photo-thumb" /> : <span className="poster-photo-thumb empty">No photo</span>}
            <label className="btn btn-ghost btn-sm">
              <Camera size={15} /> {photo ? 'Use another photo' : 'Add your photo'}
              <input type="file" accept="image/*" hidden onChange={(e) => e.target.files[0] && choosePhoto(e.target.files[0])} />
            </label>
          </div>
          <p className="fine-print">{info?.posterAi ? 'The AI writes the poster in Punjabi (Gurmukhi). You can change every line before posting.' : 'Write the lines in Punjabi on the next step.'}</p>
          <button className="btn btn-primary" disabled={!!busy || !info}>
            {busy === 'generate' ? <Loader2 size={17} className="spin" /> : <Sparkles size={17} />} Generate poster
          </button>
        </form>
      )}
      {duty && step === 'preview' && text && (
        <div className="poster-preview">
          <canvas ref={canvasRef} className="poster-canvas" />
          <div className="poster-side">
            {FIELDS.map(([k, label]) => (
              <label key={k} className="field compact">
                <input value={text[k] || ''} onChange={(e) => setText((t) => ({ ...t, [k]: e.target.value }))} placeholder=" " lang="pa" />
                <span>{label}</span>
              </label>
            ))}
            <label className="field compact">
              <input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder=" " />
              <span>Caption for the post</span>
            </label>
            <div className="ab-actions">
              <button type="button" className="btn btn-primary btn-sm" onClick={post} disabled={!!busy}>
                {busy === 'post' ? <Loader2 size={15} className="spin" /> : <Send size={15} />} Post to my profile
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={download} disabled={!!busy}>
                <Download size={15} /> Download
              </button>
              {info?.posterAi && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={generate} disabled={!!busy}>
                  {busy === 'generate' ? <Loader2 size={15} className="spin" /> : <RefreshCw size={15} />} Write again
                </button>
              )}
              <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} disabled={!!busy}>
                <X size={15} /> Don’t post
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
