import { useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { AlignCenter, ArrowLeft, ArrowUp, Camera, Download, Eye, EyeOff, ImagePlus, Images, Loader2, Palette, Plus, RefreshCw, RotateCcw, Send, Share2, SlidersHorizontal, Sparkles, Trash2, Type, UserRound, UsersRound, Wand2, X } from 'lucide-react';
import Modal from './Modal';
import { useSite } from './SiteContext';
import { fromKey, prettyDate } from '../lib/date';
import { shrinkPhoto, uploadMedia } from '../lib/media';
import { BG_PRESETS, H, MAX_PEOPLE, TEMPLATES, W, genBackground, itemColor, loadImage, loadPosterFonts, renderBackground, renderPoster, templateById, textOnlyItems } from '../lib/poster';

const to12 = (t) => {
  const [h, m] = t.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')}`;
};
const timeRange = (start, end) => (start && end ? `${to12(start)} - ${to12(end)}` : start ? to12(start) : '');
const KIRTAN_FIELDS = [
  ['occasion', 'Title, line 1 (occasion)'],
  ['occasionFor', 'Title, line 2 (whose Gurpurab — optional)'],
  ['program', 'Program'],
  ['place', 'Village / place'],
  ['name', 'Your name'],
  ['nameLine', 'Under your name (e.g. … ਵਾਲੇ — optional)'],
  ['date', 'Date'],
  ['timeLabel', 'Time of day (e.g. ਸ਼ਾਮ)'],
  ['time', 'Time'],
  ['footer', 'Bottom line (jatha name)'],
];
const SAMAGAM_FIELDS = [
  ['headline', 'Top line (e.g. ੴ ਸਤਿਗੁਰ ਪ੍ਰਸਾਦਿ)'],
  ['occasion', 'Title, line 1 (occasion)'],
  ['occasionFor', 'Title, line 2 (whose Gurpurab — optional)'],
  ['program', 'Program (e.g. ਮਹਾਨ ਕੀਰਤਨ ਸਮਾਗਮ)'],
  ['place', 'Village / place'],
  ['date', 'Date'],
  ['timeLabel', 'Time of day (e.g. ਸ਼ਾਮ)'],
  ['time', 'Time of the whole samagam'],
  ['footer', 'Bottom line (jatha name)'],
];
const TEXT_FIELDS = [['headline', 'Top line (e.g. ੴ ਸਤਿਗੁਰ ਪ੍ਰਸਾਦਿ)'], ...KIRTAN_FIELDS];
const SHOW = [
  ['khanda', 'Khanda at the top'],
  ['ornaments', 'Corner leaves', 'kirtan'],
  ['frame', 'Border'],
  ['footer', 'Bottom line'],
];
// Templates are grouped by how many photos they have. Frame designs (a picture with banners) are not in the template
// picker — they are chosen in the Background tab, with every other design.
const GROUPS = {
  single: { title: 'Single photo', note: 'One kirtan — one photo, name, date and time.', icon: UserRound },
  multi: { title: 'Multi photo', note: 'Samagam — a photo, name and time for each raagi / jatha.', icon: UsersRound },
  other: { title: 'Others', note: 'Text only — add your own background; just the words go on it. Move and resize anything.', icon: Type },
};
const groupOf = (t) => (t.kind === 'samagam' ? 'multi' : t.kind === 'kirtan' || t.pieces || t.overlayOver ? 'single' : 'other');
function GroupIcon({ group }) {
  const Icon = GROUPS[group].icon;
  return <Icon size={15} />;
}
const inGroup = (g, { frames = true } = {}) => TEMPLATES.filter((t) => groupOf(t) === g && (frames || !t.overlay));
const COLOR_LABELS = {
  text: [
    ['primary', 'Titles'],
    ['accent', 'Highlight'],
    ['ink', 'Other lines'],
  ],
  other: [
    ['primary', 'Banners'],
    ['accent', 'Gold / highlight'],
    ['ink', 'Text'],
  ],
};
const PANELS = [
  { id: 'text', label: 'Text', icon: Type },
  { id: 'photos', label: 'Photos', icon: Images },
  { id: 'background', label: 'Background', icon: ImagePlus },
  { id: 'style', label: 'Style', icon: Palette },
];
const SAMPLE = {
  occasion: 'ਪ੍ਰਕਾਸ਼ ਪੁਰਬ',
  occasionFor: 'ਸ੍ਰੀ ਗੁਰੂ ਨਾਨਕ ਦੇਵ ਜੀ',
  place: 'ਪਿੰਡ: ਸੋਹਾਣਾ',
  name: 'ਭਾਈ ਸਾਹਿਬ',
  nameLine: 'ਸੋਹਾਣੇ ਵਾਲੇ',
  date: '15 Nov, 2026',
  timeLabel: 'ਸ਼ਾਮ',
  headline: 'ੴ ਸਤਿਗੁਰ ਪ੍ਰਸਾਦਿ',
};
const SAMPLE_PEOPLE = ['7:00 - 7:40', '7:40 - 8:20', '8:20 - 9:00', '9:00 - 9:40', '9:40 - 10:20', '10:20 - 11:00'].map((time) => ({ name: '', time }));
const bgKey = (b) => (b.type === 'gen' ? `g:${b.seed}` : b.type === 'image' ? `i:${b.id}` : `p:${b.id}`);
const sameBg = (a, b) => !!a && !!b && bgKey(a) === bgKey(b);
// A small picture of a canvas drawing, for the template and background choices.
function snapshot(draw) {
  try {
    const c = document.createElement('canvas');
    draw(c);
    return c.toDataURL('image/jpeg', 0.82);
  } catch {
    return '';
  }
}
// Size, colour, outline and so on for one line or photo of the text-only template.
function ItemControls({ item, palette, onChange }) {
  const photo = item.type === 'photo';
  return (
    <div className="poster-item-tools">
      <label className="poster-range">
        <span>Size</span>
        <input type="range" min={photo ? 80 : 16} max={photo ? 900 : 160} step="2" value={item.size} onChange={(e) => onChange({ size: Number(e.target.value) })} />
      </label>
      <div className="poster-item-row">
        {photo ? (
          <>
            <div className="poster-chips">
              {[
                ['round', 'Round'],
                ['rect', 'Square'],
              ].map(([v, label]) => (
                <button key={v} type="button" className={item.shape === v ? 'active' : ''} onClick={() => onChange({ shape: v })}>
                  {label}
                </button>
              ))}
            </div>
            <label className="poster-check">
              <input type="checkbox" checked={item.border} onChange={(e) => onChange({ border: e.target.checked })} />
              <span>Border</span>
            </label>
          </>
        ) : (
          <>
            <label className="poster-item-color">
              <input type="color" value={itemColor(item, palette)} onChange={(e) => onChange({ color: e.target.value })} />
              <span>Colour</span>
            </label>
            {item.color && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange({ color: '' })}>
                <RotateCcw size={14} /> Template colour
              </button>
            )}
            <label className="poster-check">
              <input type="checkbox" checked={item.outline} onChange={(e) => onChange({ outline: e.target.checked })} />
              <span>Outline</span>
            </label>
          </>
        )}
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange({ x: W / 2 })}>
          <AlignCenter size={14} /> Centre
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange({ hidden: !item.hidden })}>
          {item.hidden ? <Eye size={14} /> : <EyeOff size={14} />} {item.hidden ? 'Show' : 'Hide'}
        </button>
      </div>
    </div>
  );
}
// A PNG made smaller only if it is very big — as a PNG, so it keeps its see-through parts.
function shrinkPng(file, max = 1600) {
  if (file.size < 5 * 1024 * 1024) return Promise.resolve(file);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      c.toBlob((b) => resolve(b && b.size < file.size ? new File([b], file.name, { type: 'image/png' }) : file), 'image/png');
    };
    img.onerror = () => resolve(file);
    img.src = URL.createObjectURL(file);
  });
}
let nextKey = 0;
const key = () => `p${++nextKey}`;

/**
 * "Generate poster": pick a Kirtan or Samagam template, the AI writes the Punjabi wording, then every part can be changed
 * in the side column (text, photos, background, colours). Post it to their profile or download it.
 *
 * duty: a kirtan the admin gave them (from My sewas) — fills in the details. Without it (from Posts) they can choose one
 * of `duties`, or type everything themselves.
 */
export default function PosterMaker({ open, duty: givenDuty, duties = [], person, team, toast, onClose, onPosted }) {
  const { site } = useSite();
  const canvasRef = useRef(null);
  const [step, setStep] = useState('pick'); // pick → details → edit
  const [busy, setBusy] = useState('');
  const [info, setInfo] = useState(null); // { posterAi, backgrounds }
  const [fontsOk, setFontsOk] = useState(false);
  const [duty, setDuty] = useState(null);
  const [templateId, setTemplateId] = useState(TEMPLATES[0].id);
  const kind = templateById(templateId).kind;
  const [details, setDetails] = useState({});
  const [text, setText] = useState(null);
  const [palette, setPalette] = useState(TEMPLATES[0].palette);
  const [bg, setBg] = useState(TEMPLATES[0].bg);
  const [bgImg, setBgImg] = useState(null);
  const [wash, setWash] = useState(0.35);
  const [fit, setFit] = useState('cover'); // a picture background: 'cover' fills the page, 'whole' shows all of it
  const [overlays, setOverlays] = useState({}); // template id → its frame picture
  const [show, setShow] = useState({ khanda: true, ornaments: true, frame: true, footer: true });
  const [photo, setPhoto] = useState(null); // { url, img }
  const [titlePhoto, setTitlePhoto] = useState(null);
  const [people, setPeople] = useState([]); // [{ key, url, img, name, time }]
  const [generated, setGenerated] = useState([]);
  const [items, setItems] = useState(textOnlyItems); // text-only template: where each line / photo goes
  const [sel, setSel] = useState(null); // the item being moved / changed
  const hitsRef = useRef([]);
  const drag = useRef(null);
  const [panel, setPanel] = useState('text');
  const [caption, setCaption] = useState('');
  const footer = site?.settings.siteName || '';

  const detailsFor = (d) => {
    const gp = d && (site?.gurpurabs || []).find((g) => g.date === d.date);
    const [start = '', end = ''] = (d?.slotTime || '').split('–').map((t) => t.trim());
    return { occasion: gp ? `${gp.kindLabel} ${gp.name}` : d?.serviceName || '', venue: d?.address || '', name: person.name, from: '', date: d?.date || '', start, end };
  };
  const chooseTemplate = (id) => {
    const t = templateById(id);
    setTemplateId(id);
    setPalette(t.palette);
    setWash(t.wash ?? 0.35);
    setFit(t.kind === 'text' ? 'whole' : 'cover');
    setShow((s) => ({ ...s, ornaments: t.show?.ornaments ?? true }));
    if (t.kind === 'text' && id !== templateId) {
      setItems(textOnlyItems(id)); // each text template places the lines its own way
      setSel(null);
    }
    // Text only is made for their own background, so keep a picture background they already chose.
    if (t.kind === 'text' && bg.type === 'image') return;
    setBg(t.bg);
    setBgImg(null);
  };

  useEffect(() => {
    if (!open) return;
    setStep('pick');
    setPanel('text');
    setDuty(givenDuty || null);
    setDetails(detailsFor(givenDuty));
    setText(null);
    setTitlePhoto(null);
    setItems(textOnlyItems());
    setSel(null);
    setShow({ khanda: true, ornaments: true, frame: true, footer: true });
    setGenerated([genBackground(), genBackground(), genBackground()]);
    chooseTemplate(TEMPLATES[0].id);
    setCaption(givenDuty ? `${givenDuty.serviceName} · ${format(fromKey(givenDuty.date), 'd MMM yyyy')}` : '');
    loadPosterFonts().then(() => setFontsOk(true));
    Promise.all(TEMPLATES.filter((t) => t.overlay).map(async (t) => [t.id, await loadImage(t.overlay)])).then((list) => setOverlays(Object.fromEntries(list.filter(([, img]) => img))));
    team.posts().then(
      async (r) => {
        setInfo(r);
        // Their profile photo, or the Jatha head photo from their documents.
        const url = r.photo || person.docs?.headPhoto?.url;
        const img = url ? await loadImage(url) : null;
        const me = img ? { url, img } : null;
        setPhoto(me);
        setPeople([{ key: 'me', url: me?.url || '', img: me?.img || null, name: person.name, time: '' }]);
      },
      () => setInfo({ posterAi: false, backgrounds: [] }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, givenDuty?.id]);

  const design = text && {
    layout: kind,
    text,
    palette,
    bg: bg.type === 'image' ? { type: 'image', img: bgImg, wash, fit } : bg,
    show,
    photo: photo?.img,
    titlePhoto: titlePhoto?.img,
    people,
    items,
    templateId,
    overlay: kind === 'text' ? overlays[templateId] : null,
  };
  // Redraw whenever anything on the poster changes (with the chosen item outlined, and where each item sits).
  useEffect(() => {
    if (step !== 'edit' || !design || !canvasRef.current) return;
    const hits = [];
    renderPoster(canvasRef.current, { ...design, selected: kind === 'text' ? sel : null, hits });
    hitsRef.current = hits;
  });

  // Small previews of each template (sample wording) and of each background.
  const templateThumbs = useMemo(() => {
    if (!open) return {};
    return Object.fromEntries(
      TEMPLATES.map((t) => [
        t.id,
        snapshot((c) =>
          renderPoster(
            c,
            {
              layout: t.kind,
              palette: t.palette,
              bg: t.bg,
              show: t.show,
              overlay: overlays[t.id],
              templateId: t.id,
              items: t.kind === 'text' ? textOnlyItems(t.id) : null,
              people: SAMPLE_PEOPLE,
              text: { ...SAMPLE, program: t.kind === 'samagam' ? 'ਮਹਾਨ ਕੀਰਤਨ ਸਮਾਗਮ' : 'ਕੀਰਤਨ ਹਾਜ਼ਰੀ', time: t.kind === 'samagam' ? '7:00 - 11:00' : '7:00 - 9:00', footer },
            },
            220,
          ),
        ),
      ]),
    );
  }, [open, fontsOk, footer, overlays]);
  const bgThumbs = useMemo(() => {
    if (!open || step !== 'edit') return {};
    return Object.fromEntries([...BG_PRESETS, ...generated].map((b) => [bgKey(b), snapshot((c) => renderBackground(c, b, 84))]));
  }, [open, step, generated, fontsOk]);

  const run = async (name, fn) => {
    setBusy(name);
    try {
      await fn();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy('');
    }
  };

  const generate = (e) => {
    e?.preventDefault();
    return run('generate', async () => {
      let words;
      if (info?.posterAi) {
        const { occasion, venue, name, from, date, start, end } = details;
        words = (await team.posterText(duty?.id, { occasion, venue, name, from, date, start, end, program: kind === 'samagam' ? 'Kirtan samagam' : '' })).text;
        if (kind === 'samagam') delete words.program; // the AI writes a one-person program; keep the samagam wording
      } else {
        // No AI on this site: start from what they typed; they can write it in Punjabi in the editor.
        words = { occasion: details.occasion, occasionFor: '', place: (details.venue || '').split(',')[0], name: details.name, nameLine: details.from, timeLabel: '' };
      }
      setText((t) => ({
        headline: 'ੴ ਸਤਿਗੁਰ ਪ੍ਰਸਾਦਿ',
        program: kind === 'samagam' ? 'ਮਹਾਨ ਕੀਰਤਨ ਸਮਾਗਮ' : 'ਕੀਰਤਨ ਹਾਜ਼ਰੀ',
        footer,
        ...t,
        date: details.date ? format(fromKey(details.date), 'dd MMM, yyyy') : '',
        time: timeRange(details.start, details.end),
        ...words,
      }));
      if (words.name) setPeople((list) => list.map((p) => (p.key === 'me' && p.name === person.name ? { ...p, name: words.name } : p)));
      if (!caption) setCaption([details.occasion, details.date && format(fromKey(details.date), 'd MMM yyyy')].filter(Boolean).join(' · '));
      if (!text && kind === 'text') setPanel('background'); // first thing for text only: their background
      setStep('edit');
    });
  };

  /* ---------- photos ---------- */
  const fromFile = async (file) => {
    const url = URL.createObjectURL(file);
    return { url, img: await loadImage(url) };
  };
  const setPerson = (k, patch) => setPeople((list) => list.map((p) => (p.key === k ? { ...p, ...patch } : p)));
  const addPeople = async (files) => {
    const room = MAX_PEOPLE - people.length;
    if (files.length > room) toast(`Up to ${MAX_PEOPLE} people fit on a samagam poster.`, 'error');
    const added = await Promise.all([...files].slice(0, room).map(async (f) => ({ key: key(), ...(await fromFile(f)), name: '', time: '' })));
    setPeople((list) => [...list, ...added]);
  };
  /* ---------- text only: move and change each item ---------- */
  const setItem = (id, patch) => setItems((list) => list.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  const toPoster = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * W) / r.width, y: ((e.clientY - r.top) * H) / r.height };
  };
  const onCanvasDown = (e) => {
    if (kind !== 'text') return;
    const p = toPoster(e);
    const pad = 14;
    const hit = [...hitsRef.current].reverse().find((b) => p.x >= b.x - pad && p.x <= b.x + b.w + pad && p.y >= b.y - pad && p.y <= b.y + b.h + pad);
    if (!hit) return setSel(null);
    const it = items.find((i) => i.id === hit.id);
    setSel(hit.id);
    setPanel(it.type === 'photo' ? 'photos' : 'text');
    drag.current = { id: hit.id, dx: p.x - it.x, dy: p.y - it.y, moved: false };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onCanvasMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const p = toPoster(e);
    let x = Math.round(Math.max(0, Math.min(W, p.x - d.dx)));
    if (Math.abs(x - W / 2) < 12) x = W / 2; // snaps to the middle
    const y = Math.round(Math.max(0, Math.min(H, p.y - d.dy)));
    d.moved = true;
    setItem(d.id, { x, y });
  };
  const onCanvasUp = () => {
    const d = drag.current;
    drag.current = null;
    // A tap (no drag) on a wide screen: bring its controls into view in the side column.
    if (d && !d.moved && window.matchMedia('(min-width: 861px)').matches)
      setTimeout(() => document.querySelector(`[data-item="${d.id}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 0);
  };

  const movePerson = (i) => setPeople((list) => (i < 1 ? list : [...list.slice(0, i - 1), list[i], list[i - 1], ...list.slice(i + 1)]));

  /* ---------- backgrounds ---------- */
  const chooseBg = async (b) => {
    setBg(b);
    if (b.type !== 'image') return setBgImg(null);
    setBgImg(null);
    const img = await loadImage(b.url);
    if (!img) toast('This background could not be loaded.', 'error');
    setBgImg(img);
  };
  const generateBg = () => {
    const g = genBackground();
    setGenerated((list) => [g, ...list].slice(0, 9));
    chooseBg(g);
  };
  const teamBg = (b) => ({ type: 'image', id: b.id, url: b.url, name: b.title });
  // Adds a background to the team library (theirs, or the one on the poster now) and puts it on the poster.
  const shareBg = (file, title) =>
    run('bg', async () => {
      const { id } = await uploadMedia(team, file);
      const r = await team.addPosterBackground(id, title);
      setInfo(r);
      const added = r.backgrounds.filter((b) => b.mine).at(-1);
      if (added) await chooseBg(teamBg(added));
      toast('Background added — the whole team can use it now 🙏');
    });
  // PNGs stay PNG so see-through parts (a frame with no background) stay see-through.
  const uploadBg = async (file) => shareBg(file.type === 'image/png' ? await shrinkPng(file) : await shrinkPhoto(file, 1600), file.name.replace(/\.\w+$/, '').slice(0, 60));
  const shareCurrentBg = async () => {
    const c = renderBackground(document.createElement('canvas'), bg, W);
    const blob = await new Promise((resolve) => c.toBlob(resolve, 'image/jpeg', 0.9));
    if (!blob) return toast('Could not make the image.', 'error');
    const name = bg.type === 'gen' ? 'Generated background' : BG_PRESETS.find((p) => p.id === bg.id)?.name || 'Background';
    shareBg(new File([blob], 'background.jpg', { type: 'image/jpeg' }), name);
  };
  const removeBg = (b) =>
    window.confirm('Remove this background for the whole team?') &&
    run(b.id, async () => {
      setInfo(await team.deletePosterBackground(b.id));
      if (bg.type === 'image' && bg.id === b.id) chooseBg(templateById(templateId).bg);
    });

  /* ---------- result ---------- */
  // Drawn again on its own canvas, so the editor's selection outline is not in the picture.
  const blob = () =>
    new Promise((resolve, reject) =>
      renderPoster(document.createElement('canvas'), design).toBlob((b) => (b ? resolve(b) : reject(new Error('Could not make the image — try another photo or background.'))), 'image/jpeg', 0.92),
    );
  const fileName = `poster-${details.date || format(new Date(), 'yyyy-MM-dd')}.jpg`;
  const download = () =>
    run('download', async () => {
      const url = URL.createObjectURL(await blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    });
  const post = () =>
    run('post', async () => {
      const file = new File([await blob()], fileName, { type: 'image/jpeg' });
      const { id } = await uploadMedia(team, file);
      const r = await team.createPost({ caption, media: [id], bookingId: duty?.id || '', poster: true });
      onPosted?.(r);
      toast('Poster posted to your profile 🙏');
      onClose();
    });

  const set = (k) => (e) => setDetails((d) => ({ ...d, [k]: e.target.value }));
  const fields = kind === 'samagam' ? SAMAGAM_FIELDS : kind === 'text' ? TEXT_FIELDS : KIRTAN_FIELDS;
  const itemFor = (id) => (kind === 'text' ? items.find((it) => it.id === id) : null);
  const photoControls = (id) => {
    const it = itemFor(id);
    return it && <ItemControls item={it} palette={palette} onChange={(patch) => setItem(id, patch)} />;
  };
  const templateCard = (t) => (
    <button
      key={t.id}
      type="button"
      className={`poster-template-card ${templateId === t.id ? 'active' : ''}`}
      onClick={() => {
        chooseTemplate(t.id);
        if (text && t.kind === 'text') setPanel('background');
        setStep(text ? 'edit' : 'details');
      }}
    >
      {templateThumbs[t.id] ? <img src={templateThumbs[t.id]} alt="" /> : <span className="poster-thumb-empty" />}
      <strong>{t.name}</strong>
      <span>{t.note}</span>
    </button>
  );
  const subtitle = duty ? `${duty.serviceName} · ${format(fromKey(duty.date), 'EEE d MMM yyyy')}` : 'Choose a template, then change anything you like.';

  return (
    <Modal open={!!open} onClose={onClose} title="Generate poster" subtitle={subtitle} size="xl">
      {open && step === 'pick' && (
        <div className="poster-kinds">
          <section className="poster-kind">
            <header>
              <Sparkles size={18} />
              <div>
                <strong>Kirtan &amp; Samagam</strong>
                <span>Single photo for one kirtan, multi photo for a samagam with many raagis / jathas.</span>
              </div>
            </header>
            <div className="poster-groups">
              {['single', 'multi'].map((g) => (
                <div key={g} className="poster-group">
                  <h4>
                    <GroupIcon group={g} />
                    {GROUPS[g].title}
                  </h4>
                  <p className="fine-print">{GROUPS[g].note}</p>
                  <div className="poster-template-grid">{inGroup(g, { frames: false }).map(templateCard)}</div>
                </div>
              ))}
            </div>
          </section>
          <section className="poster-kind poster-kind-other">
            <header>
              <Type size={18} />
              <div>
                <strong>{GROUPS.other.title}</strong>
                <span>{GROUPS.other.note}</span>
              </div>
            </header>
            <div className="poster-template-grid">{inGroup('other', { frames: false }).map(templateCard)}</div>
            <p className="fine-print">More designs with frames and banners are in the Background tab after this.</p>
          </section>
        </div>
      )}

      {open && step === 'details' && (
        <form className="poster-form" onSubmit={generate}>
          <button type="button" className="poster-chosen" onClick={() => setStep('pick')}>
            <ArrowLeft size={15} /> {GROUPS[groupOf(templateById(templateId))].title} · {templateById(templateId).name} <em>change</em>
          </button>
          {!givenDuty && duties.length > 0 && (
            <label className="field select">
              <select
                value={duty?.id || ''}
                onChange={(e) => {
                  const d = duties.find((x) => x.id === e.target.value) || null;
                  setDuty(d);
                  setDetails(detailsFor(d));
                  if (d) setCaption(`${d.serviceName} · ${format(fromKey(d.date), 'd MMM yyyy')}`);
                }}
              >
                <option value="">None — I will type the details</option>
                {duties.map((d) => (
                  <option key={d.id} value={d.id}>
                    {prettyDate(d.date, 'd MMM')} · {d.serviceName} · {d.address?.slice(0, 40)}
                  </option>
                ))}
              </select>
              <span>Fill in from one of my sewas (optional)</span>
            </label>
          )}
          <label className="field">
            <input value={details.occasion || ''} onChange={set('occasion')} placeholder=" " required />
            <span>Occasion (e.g. Prakash Purab, Sukhmani Sahib)</span>
          </label>
          <label className="field">
            <input value={details.venue || ''} onChange={set('venue')} placeholder=" " required />
            <span>Village / place</span>
          </label>
          {kind !== 'samagam' && (
            <div className="form-row">
              <label className="field">
                <input value={details.name || ''} onChange={set('name')} placeholder=" " required />
                <span>Your name (e.g. Baba Pritpal Singh)</span>
              </label>
              <label className="field">
                <input value={details.from || ''} onChange={set('from')} placeholder=" " />
                <span>Known as / from (e.g. Sohane wale)</span>
              </label>
            </div>
          )}
          <div className="form-row poster-when">
            <label className="field">
              <input type="date" value={details.date || ''} onChange={set('date')} placeholder=" " />
              <span>Date</span>
            </label>
            <label className="field">
              <input type="time" value={details.start || ''} onChange={set('start')} placeholder=" " />
              <span>From</span>
            </label>
            <label className="field">
              <input type="time" value={details.end || ''} onChange={set('end')} placeholder=" " />
              <span>To</span>
            </label>
          </div>
          <p className="fine-print">
            {info?.posterAi ? 'The AI writes the poster in Punjabi (Gurmukhi). Next you can change every line, the photos, the background and the colours.' : 'Next you can write the lines in Punjabi and change the photos, the background and the colours.'}
            {kind === 'samagam' && ' Add each person’s photo, name and time on the next step.'}
          </p>
          <button className="btn btn-primary" disabled={!!busy || !info}>
            {busy === 'generate' ? <Loader2 size={17} className="spin" /> : <Sparkles size={17} />} Generate poster
          </button>
        </form>
      )}

      {open && step === 'edit' && text && (
        <div className="poster-editor">
          <div className="poster-stage">
            <canvas
              ref={canvasRef}
              className={`poster-canvas ${kind === 'text' ? 'movable' : ''}`}
              onPointerDown={onCanvasDown}
              onPointerMove={onCanvasMove}
              onPointerUp={onCanvasUp}
              onPointerCancel={onCanvasUp}
            />
            {kind === 'text' && <p className="fine-print poster-stage-hint">Drag any line or photo to move it. Tap it to change its size and colour.</p>}
          </div>

          <div className="poster-side">
            <div className="poster-tabs" role="tablist">
              {PANELS.map((p) => (
                <button key={p.id} type="button" role="tab" aria-selected={panel === p.id} className={panel === p.id ? 'active' : ''} onClick={() => setPanel(p.id)}>
                  <p.icon size={15} /> {p.label}
                </button>
              ))}
            </div>

            {panel === 'text' && (
              <div className="poster-panel">
                {fields.map(([k, label]) => {
                  const it = itemFor(k);
                  const input = (
                    <label className="field compact">
                      <input value={text[k] || ''} onChange={(e) => setText((t) => ({ ...t, [k]: e.target.value }))} placeholder=" " lang="pa" />
                      <span>{label}</span>
                    </label>
                  );
                  if (!it) return <div key={k}>{input}</div>;
                  return (
                    <div key={k} className={`poster-line ${sel === k ? 'active' : ''} ${it.hidden ? 'hidden-item' : ''}`} data-item={k}>
                      <div className="poster-line-row">
                        {input}
                        <button type="button" className={`icon-btn ${sel === k ? 'active' : ''}`} onClick={() => setSel(sel === k ? null : k)} aria-label={`Size and colour: ${label}`} title="Size, colour, hide">
                          {it.hidden ? <EyeOff size={15} /> : <SlidersHorizontal size={15} />}
                        </button>
                      </div>
                      {sel === k && <ItemControls item={it} palette={palette} onChange={(patch) => setItem(k, patch)} />}
                    </div>
                  );
                })}
                {info?.posterAi && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStep('details')} disabled={!!busy}>
                    <RefreshCw size={15} /> Change details and write again
                  </button>
                )}
              </div>
            )}

            {panel === 'photos' && (
              <div className="poster-panel">
                <div className="poster-photo-row" data-item="titlePhoto">
                  {titlePhoto ? <img src={titlePhoto.url} alt="" className="poster-photo-thumb round" /> : <span className="poster-photo-thumb round empty">Title</span>}
                  <div>
                    <strong>Title photo</strong>
                    <p className="fine-print">Guru Sahib, the Gurdwara or Nishan Sahib — {kind === 'text' ? 'at the top; drag it anywhere.' : 'in a round frame at the top.'}</p>
                    <div className="ab-actions">
                      <label className="btn btn-ghost btn-sm">
                        <Camera size={15} /> {titlePhoto ? 'Change' : 'Add title photo'}
                        <input type="file" accept="image/*" hidden onChange={async (e) => e.target.files[0] && setTitlePhoto(await fromFile(e.target.files[0]))} />
                      </label>
                      {titlePhoto && (
                        <button type="button" className="btn btn-ghost btn-sm danger-text" onClick={() => setTitlePhoto(null)}>
                          <X size={15} /> Remove
                        </button>
                      )}
                    </div>
                    {titlePhoto && photoControls('titlePhoto')}
                  </div>
                </div>

                {kind !== 'samagam' ? (
                  <div className="poster-photo-row" data-item="photo">
                    {photo ? <img src={photo.url} alt="" className="poster-photo-thumb" /> : <span className="poster-photo-thumb empty">No photo</span>}
                    <div>
                      <strong>Your photo</strong>
                      <div className="ab-actions">
                        <label className="btn btn-ghost btn-sm">
                          <Camera size={15} /> {photo ? 'Use another photo' : 'Add your photo'}
                          <input type="file" accept="image/*" hidden onChange={async (e) => e.target.files[0] && setPhoto(await fromFile(e.target.files[0]))} />
                        </label>
                        {photo && (
                          <button type="button" className="btn btn-ghost btn-sm danger-text" onClick={() => setPhoto(null)}>
                            <X size={15} /> Remove
                          </button>
                        )}
                      </div>
                      {(photo || itemFor('photo')?.placeholder) && photoControls('photo')}
                    </div>
                  </div>
                ) : (
                  <div className="poster-people">
                    <strong>
                      People on the poster ({people.length}/{MAX_PEOPLE})
                    </strong>
                    <p className="fine-print">Tap a photo to change it. The time shows under each person’s name.</p>
                    {people.map((p, i) => (
                      <div key={p.key} className="poster-person">
                        <label className="poster-person-photo" aria-label={`Photo of person ${i + 1}`}>
                          {p.url ? <img src={p.url} alt="" /> : <Camera size={18} />}
                          <input type="file" accept="image/*" hidden onChange={async (e) => e.target.files[0] && setPerson(p.key, await fromFile(e.target.files[0]))} />
                        </label>
                        <div className="poster-person-fields">
                          <input value={p.name} onChange={(e) => setPerson(p.key, { name: e.target.value })} placeholder={`Person ${i + 1} name`} aria-label={`Person ${i + 1} name`} lang="pa" />
                          <input value={p.time} onChange={(e) => setPerson(p.key, { time: e.target.value })} placeholder="Time (e.g. 7:00 - 7:40)" aria-label={`Person ${i + 1} time`} />
                        </div>
                        <div className="poster-person-tools">
                          <button type="button" className="icon-btn" onClick={() => movePerson(i)} disabled={i === 0} aria-label="Move up">
                            <ArrowUp size={15} />
                          </button>
                          <button type="button" className="icon-btn danger-text" onClick={() => setPeople((list) => list.filter((x) => x.key !== p.key))} aria-label={`Remove person ${i + 1}`}>
                            <X size={15} />
                          </button>
                        </div>
                      </div>
                    ))}
                    {people.length < MAX_PEOPLE && (
                      <div className="ab-actions">
                        <label className="btn btn-ghost btn-sm">
                          <Camera size={15} /> Add photos
                          <input type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files?.length && addPeople(e.target.files)} />
                        </label>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPeople((list) => [...list, { key: key(), url: '', img: null, name: '', time: '' }])}>
                          <Plus size={15} /> Add person
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {panel === 'background' && (
              <div className="poster-panel">
                <strong>Designs</strong>
                <p className="fine-print">Changing the design keeps your wording and photos; colours and background go back to the design’s own.</p>
                {[
                  ['single', 'Single photo'],
                  ['multi', 'Multi photo'],
                  ['other', 'Text only'],
                ].map(([g, label]) => (
                  <div key={g} className="poster-design-group">
                    <span className="poster-subhead">{label}</span>
                    <div className="poster-swatches designs">
                      {inGroup(g).map((t) => (
                        <button key={t.id} type="button" className={`poster-swatch ${templateId === t.id ? 'active' : ''}`} onClick={() => chooseTemplate(t.id)} title={`${t.name} — ${t.note}`}>
                          {templateThumbs[t.id] && <img src={templateThumbs[t.id]} alt={t.name} />}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <hr className="poster-sep" />
                {kind === 'text' && <p className="fine-print">Choose a background or add your own — only your words and photos go on top of it, nothing else.</p>}
                <div className="poster-panel-head">
                  <strong>For Gurbani kirtan</strong>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={generateBg}>
                    <Wand2 size={15} /> Generate new
                  </button>
                </div>
                <div className="poster-swatches">
                  {[...generated, ...BG_PRESETS].map((b) => (
                    <button key={bgKey(b)} type="button" className={`poster-swatch ${sameBg(bg, b) ? 'active' : ''}`} onClick={() => chooseBg(b)} title={b.name}>
                      {bgThumbs[bgKey(b)] && <img src={bgThumbs[bgKey(b)]} alt={b.name} />}
                      {b.type === 'gen' && <Sparkles size={12} className="poster-swatch-tag" />}
                    </button>
                  ))}
                </div>
                {bg.type !== 'image' && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={shareCurrentBg} disabled={!!busy}>
                    {busy === 'bg' ? <Loader2 size={15} className="spin" /> : <Share2 size={15} />} Share this background with the team
                  </button>
                )}

                <div className="poster-panel-head">
                  <strong>Team backgrounds ({info?.backgrounds?.length || 0})</strong>
                  <label className="btn btn-ghost btn-sm">
                    {busy === 'bg' ? <Loader2 size={15} className="spin" /> : <ImagePlus size={15} />} Add your own
                    <input type="file" accept="image/*" hidden disabled={!!busy} onChange={(e) => e.target.files[0] && uploadBg(e.target.files[0])} />
                  </label>
                </div>
                <p className="fine-print">Backgrounds you add here can be used by every team member.</p>
                {info?.backgrounds?.length > 0 && (
                  <div className="poster-swatches">
                    {info.backgrounds.map((b) => (
                      <div key={b.id} className={`poster-swatch ${bg.type === 'image' && bg.id === b.id ? 'active' : ''}`}>
                        <button type="button" onClick={() => chooseBg(teamBg(b))} title={`${b.title} · added by ${b.by}`}>
                          <img src={b.url} alt={b.title} loading="lazy" />
                        </button>
                        {b.mine && (
                          <button type="button" className="poster-swatch-remove" onClick={() => removeBg(b)} disabled={!!busy} aria-label="Remove background">
                            {busy === b.id ? <Loader2 size={11} className="spin" /> : <Trash2 size={11} />}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {bg.type === 'image' && (
                  <div>
                    <strong>Picture</strong>
                    <div className="poster-chips">
                      {[
                        ['whole', 'Whole picture (no crop)'],
                        ['cover', 'Fill the page (crops the edges)'],
                      ].map(([v, label]) => (
                        <button key={v} type="button" className={fit === v ? 'active' : ''} onClick={() => setFit(v)}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {bg.type === 'image' && (
                  <label className="poster-range">
                    <span>Lighten the background ({Math.round(wash * 100)}%)</span>
                    <input type="range" min="0" max="0.8" step="0.05" value={wash} onChange={(e) => setWash(Number(e.target.value))} />
                  </label>
                )}
              </div>
            )}

            {panel === 'style' && (
              <div className="poster-panel">
                <p className="fine-print">To change the design, use the Background tab.</p>
                <strong>Colours</strong>
                <div className="poster-colors">
                  {COLOR_LABELS[kind === 'text' ? 'text' : 'other'].map(([k, label]) => (
                    <label key={k}>
                      <input type="color" value={palette[k]} onChange={(e) => setPalette((p) => ({ ...p, [k]: e.target.value }))} />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
                {kind === 'text' ? (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setItems(textOnlyItems(templateId));
                      setSel(null);
                    }}
                  >
                    <RotateCcw size={15} /> Put every line back in its place
                  </button>
                ) : (
                  <>
                    <strong>Show on the poster</strong>
                    <div className="poster-toggles">
                      {SHOW.filter(([, , only]) => !only || only === kind).map(([k, label]) => (
                        <label key={k} className="check">
                          <input type="checkbox" checked={show[k]} onChange={(e) => setShow((s) => ({ ...s, [k]: e.target.checked }))} />
                          <span>{label}</span>
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="poster-finish">
              <label className="field compact">
                <input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder=" " />
                <span>Caption for the post</span>
              </label>
              <div className="ab-actions">
                <button type="button" className="btn btn-primary btn-sm" onClick={post} disabled={!!busy}>
                  {busy === 'post' ? <Loader2 size={15} className="spin" /> : <Send size={15} />} Post to my profile
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={download} disabled={!!busy}>
                  {busy === 'download' ? <Loader2 size={15} className="spin" /> : <Download size={15} />} Download
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStep('pick')} disabled={!!busy}>
                  <ArrowLeft size={15} /> Templates
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
