import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ImagePlus, Loader2, Music, Play, Send, X } from 'lucide-react';
import MusicPicker from './MusicPicker';
import { mediaDuration, shrinkPhoto, uploadMedia, withType } from '../lib/media';
import { ease } from '../lib/motion';

const MAX_ITEMS = 10;
const MAX_VIDEO_SECONDS = 60;

// A post's own photos / videos and music, as the composer holds them while editing it.
const itemsOf = (post) => (post?.media || []).map((m) => ({ key: m.id, id: m.id, url: m.url, kind: m.kind, progress: 1 }));
const musicOf = (post) => post?.audio && { source: 'existing', title: post.audio.title, url: post.audio.url, start: post.audio.start, duration: 0 };

/**
 * New post: photos and videos (up to 10), a caption and optional music. `client` is the team or admin API; `extra`
 * goes above the post button (e.g. "post as" for the admin) and `extraBody` is sent with the post.
 * With `post` it edits that post instead: remove or add photos and videos, change the caption and the music.
 */
export default function PostComposer({ client, library, limits = {}, toast, onPosted, initialFiles, extra, extraBody, submitLabel, post }) {
  const [items, setItems] = useState(() => itemsOf(post)); // { key, file | id (already in the post), url, kind, progress }
  const [caption, setCaption] = useState(post?.caption || '');
  const [music, setMusic] = useState(() => musicOf(post));
  const [showMusic, setShowMusic] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);
  const urls = useRef([]);
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);
  // The start slider needs the length of the post's own music.
  useEffect(() => {
    if (!post?.audio) return;
    const a = new Audio(post.audio.url);
    a.preload = 'metadata';
    a.onloadedmetadata = () => setMusic((m) => (m?.source === 'existing' ? { ...m, duration: a.duration || 0 } : m));
  }, [post]);

  const add = async (files) => {
    const next = [];
    for (const raw of files) {
      const file = withType(raw);
      const kind = file.type.startsWith('video/') ? 'video' : file.type.startsWith('image/') ? 'image' : '';
      if (!kind) {
        toast(`${file.name}: choose photos or videos.`, 'error');
        continue;
      }
      if (kind === 'video') {
        const secs = await mediaDuration(file);
        if (secs > MAX_VIDEO_SECONDS + 1) {
          toast(`${file.name}: videos can be up to ${MAX_VIDEO_SECONDS} seconds — trim it first.`, 'error');
          continue;
        }
        if (limits.video && file.size > limits.video) {
          toast(`${file.name}: the video is too large (max ${Math.round(limits.video / 1024 / 1024)} MB).`, 'error');
          continue;
        }
      }
      const url = URL.createObjectURL(file);
      urls.current.push(url);
      next.push({ key: `${Date.now()}-${Math.random()}`, file, url, kind, progress: 0 });
    }
    setItems((list) => {
      const all = [...list, ...next];
      if (all.length > MAX_ITEMS) toast(`Up to ${MAX_ITEMS} photos and videos in one post.`, 'error');
      return all.slice(0, MAX_ITEMS);
    });
  };
  useEffect(() => {
    if (initialFiles?.length) add(initialFiles);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFiles]);

  const remove = (key) => setItems((list) => list.filter((x) => x.key !== key));
  const setProgress = (key, progress) => setItems((list) => list.map((x) => (x.key === key ? { ...x, progress } : x)));

  const submit = async (e) => {
    e.preventDefault();
    if (!items.length) return toast('Add at least one photo or video.', 'error');
    setBusy(true);
    try {
      const media = [];
      for (const it of items) {
        if (it.id) continue; // already in the post
        const file = it.kind === 'image' ? await shrinkPhoto(it.file) : it.file;
        if (limits[it.kind] && file.size > limits[it.kind]) throw new Error(`${it.file.name} is too large (max ${Math.round(limits[it.kind] / 1024 / 1024)} MB).`);
        media.push((await uploadMedia(client, file, (p) => setProgress(it.key, p))).id);
      }
      let audio = null;
      if (music?.source === 'existing') audio = { keep: true, title: music.title, start: music.start };
      else if (music?.source === 'library') audio = { libraryId: music.libraryId, start: music.start };
      else if (music?.file) audio = { id: (await uploadMedia(client, music.file)).id, title: music.title, start: music.start };
      if (post) {
        const keep = items.filter((it) => it.id).map((it) => it.id);
        const result = await client.editPost(post.id, { caption, keep, media, audio, ...extraBody });
        toast('Post updated.');
        return onPosted?.(result);
      }
      const result = await client.createPost({ caption, media, audio, ...extraBody });
      setItems([]);
      setCaption('');
      setMusic(null);
      setShowMusic(false);
      toast('Posted 🙏 It now shows on the website.');
      onPosted?.(result);
    } catch (err) {
      toast(err.message, 'error');
      setItems((list) => list.map((x) => (x.id ? x : { ...x, progress: 0 })));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="composer glass" onSubmit={submit}>
      <div className="composer-media">
        <AnimatePresence initial={false}>
          {items.map((it) => (
            <motion.div key={it.key} className="composer-thumb" layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.25, ease }}>
              {it.kind === 'video' ? <video src={it.url} muted playsInline preload="metadata" /> : <img src={it.url} alt="" />}
              {it.kind === 'video' && (
                <span className="media-tile-badge">
                  <Play size={12} fill="currentColor" />
                </span>
              )}
              {busy ? (
                <span className="composer-progress" style={{ '--p': it.progress }} />
              ) : (
                <button type="button" className="icon-btn composer-remove" onClick={() => remove(it.key)} aria-label="Remove">
                  <X size={14} />
                </button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        {items.length < MAX_ITEMS && (
          <button type="button" className="composer-add" onClick={() => inputRef.current?.click()} disabled={busy}>
            <ImagePlus size={22} />
            <span>Add photos / videos</span>
          </button>
        )}
        <input ref={inputRef} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => (add([...e.target.files]), (e.target.value = ''))} />
      </div>
      <label className="field">
        <textarea value={caption} onChange={(e) => setCaption(e.target.value)} placeholder=" " rows={2} maxLength={1000} />
        <span>Caption — where, what occasion (optional)</span>
      </label>
      {showMusic || music ? (
        <MusicPicker value={music} onChange={setMusic} library={library} maxBytes={limits.audio} toast={toast} />
      ) : (
        <button type="button" className="link-btn" onClick={() => setShowMusic(true)}>
          <Music size={14} /> Add music
        </button>
      )}
      {extra}
      <button className="btn btn-primary" disabled={busy || !items.length}>
        {busy ? <Loader2 size={17} className="spin" /> : post ? <Check size={17} /> : <Send size={17} />} {busy ? (post ? 'Saving…' : 'Uploading…') : submitLabel || (post ? 'Save changes' : 'Post')}
      </button>
    </form>
  );
}
