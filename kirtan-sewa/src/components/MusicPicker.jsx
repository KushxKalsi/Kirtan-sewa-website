import { useEffect, useRef, useState } from 'react';
import { Library, Mic, Music, Pause, Play, Square, Trash2, Upload } from 'lucide-react';
import { mediaDuration, withType } from '../lib/media';

const SOURCES = [
  { id: 'upload', label: 'From this phone', icon: Upload },
  { id: 'record', label: 'Record', icon: Mic },
  { id: 'library', label: 'Gurbani library', icon: Library },
];
const MAX_RECORD = 120; // seconds
const baseType = (t) => (t || '').split(';')[0];

/**
 * Music for a post: an audio file from the phone, a recording made here, or a track from the admin's library — and
 * the second it starts from. value: { source, file?, libraryId?, title, url, start, duration }.
 */
export default function MusicPicker({ value, onChange, library = [], maxBytes, toast }) {
  const [source, setSource] = useState(SOURCES.some((s) => s.id === value?.source) ? value.source : library.length ? 'library' : 'upload');
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [previewing, setPreviewing] = useState('');
  const recorder = useRef(null);
  const timer = useRef(null);
  const audio = useRef(null);

  useEffect(
    () => () => {
      clearInterval(timer.current);
      recorder.current?.stream.getTracks().forEach((t) => t.stop());
      audio.current?.pause();
    },
    [],
  );

  const takeFile = async (file, title) => {
    file = withType(file);
    if (!file.type.startsWith('audio/')) return toast('Choose an audio file (MP3, M4A, WAV).', 'error');
    if (maxBytes && file.size > maxBytes) return toast(`That audio is too large (max ${Math.round(maxBytes / 1024 / 1024)} MB).`, 'error');
    onChange({ source: 'file', file, title: title || file.name.replace(/\.\w+$/, ''), url: URL.createObjectURL(file), start: 0, duration: await mediaDuration(file) });
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') return toast('This browser can’t record audio. Choose a file instead.', 'error');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const type = ['audio/webm', 'audio/mp4', 'audio/ogg'].find((t) => MediaRecorder.isTypeSupported?.(t)) || '';
      const rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      const chunks = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const t = baseType(rec.mimeType) || 'audio/webm';
        const blob = new Blob(chunks, { type: t });
        takeFile(new File([blob], `recording.${t.includes('mp4') ? 'm4a' : t.split('/')[1]}`, { type: t }), 'My recording');
      };
      rec.start();
      recorder.current = rec;
      setSeconds(0);
      setRecording(true);
      timer.current = setInterval(
        () =>
          setSeconds((s) => {
            if (s + 1 >= MAX_RECORD) stopRecording();
            return s + 1;
          }),
        1000,
      );
    } catch {
      toast('Allow the microphone to record.', 'error');
    }
  };
  const stopRecording = () => {
    clearInterval(timer.current);
    if (recorder.current?.state === 'recording') recorder.current.stop();
    setRecording(false);
  };

  const preview = (url, key, start = 0) => {
    const a = audio.current;
    if (previewing === key) {
      a.pause();
      return setPreviewing('');
    }
    a.src = url;
    a.currentTime = start;
    a.play().then(() => setPreviewing(key), () => {});
  };

  return (
    <div className="music-picker">
      <audio ref={audio} onEnded={() => setPreviewing('')} />
      {value ? (
        <div className="music-chosen">
          <button type="button" className="icon-btn" onClick={() => preview(value.url, 'chosen', value.start)} aria-label={previewing === 'chosen' ? 'Pause' : 'Play'}>
            {previewing === 'chosen' ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <div>
            <label className="field compact">
              <input value={value.title} onChange={(e) => onChange({ ...value, title: e.target.value })} placeholder=" " maxLength={80} />
              <span>Music name</span>
            </label>
            {value.duration > 5 && (
              <label className="music-start">
                <span className="label">Starts at {Math.floor(value.start / 60)}:{String(Math.round(value.start % 60)).padStart(2, '0')}</span>
                <input type="range" min={0} max={Math.max(0, Math.floor(value.duration - 5))} value={value.start} onChange={(e) => onChange({ ...value, start: Number(e.target.value) })} />
              </label>
            )}
          </div>
          <button type="button" className="icon-btn danger-text" onClick={() => onChange(null)} aria-label="Remove music">
            <Trash2 size={16} />
          </button>
        </div>
      ) : (
        <>
          <div className="filter-pills">
            {SOURCES.filter((s) => s.id !== 'library' || library.length).map((s) => (
              <button key={s.id} type="button" className={source === s.id ? 'active' : ''} onClick={() => setSource(s.id)}>
                {source === s.id && <span className="pill-bg" />}
                <span>
                  <s.icon size={14} /> {s.label}
                </span>
              </button>
            ))}
          </div>
          {source === 'upload' && (
            <label className="btn btn-ghost btn-sm music-file">
              <Music size={15} /> Choose an audio file
              <input type="file" accept="audio/*" hidden onChange={(e) => e.target.files[0] && takeFile(e.target.files[0])} />
            </label>
          )}
          {source === 'record' && (
            <div className="music-record">
              {recording ? (
                <button type="button" className="btn btn-danger btn-sm" onClick={stopRecording}>
                  <Square size={14} /> Stop · {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
                </button>
              ) : (
                <button type="button" className="btn btn-ghost btn-sm" onClick={startRecording}>
                  <Mic size={15} /> Start recording
                </button>
              )}
              <small className="muted">Up to {MAX_RECORD / 60} minutes. You can listen to it before posting.</small>
            </div>
          )}
          {source === 'library' && (
            <ul className="music-library">
              {library.map((t) => (
                <li key={t.id}>
                  <button type="button" className="icon-btn" onClick={() => preview(t.url, t.id)} aria-label={previewing === t.id ? 'Pause' : 'Play'}>
                    {previewing === t.id ? <Pause size={15} /> : <Play size={15} />}
                  </button>
                  <span>{t.title}</span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={async () => {
                      audio.current?.pause();
                      setPreviewing('');
                      const a = new Audio(t.url);
                      a.preload = 'metadata';
                      a.onloadedmetadata = () => onChange({ source: 'library', libraryId: t.id, title: t.title, url: t.url, start: 0, duration: a.duration || 0 });
                      a.onerror = () => onChange({ source: 'library', libraryId: t.id, title: t.title, url: t.url, start: 0, duration: 0 });
                    }}
                  >
                    Use
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
