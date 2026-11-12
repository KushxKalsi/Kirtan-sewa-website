import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, EyeOff, Flag, Heart, ImagePlus, Loader2, Music, Pause, Pencil, Play, Plus, Share2, Trash2 } from 'lucide-react';
import Modal from '../components/Modal';
import PostComposer from '../components/PostComposer';
import PostViewer, { PostTile } from '../components/PostViewer';
import { uploadMedia } from '../lib/media';

/** Posts on the site: post as the jatha or for a team member, edit, hide or delete any post or comment, and the Gurbani music library. */
export default function PostsTab({ data, api, toast }) {
  const [state, setState] = useState(null); // { posts, library, storage }
  const [busy, setBusy] = useState('');
  const [as, setAs] = useState('');
  const [filter, setFilter] = useState('all');
  const [open, setOpen] = useState(null);
  const [editing, setEditing] = useState(null);
  const [track, setTrack] = useState({ title: '', file: null });
  const [playing, setPlaying] = useState('');
  const [player] = useState(() => (typeof Audio !== 'undefined' ? new Audio() : null));
  const people = (data.people || []).filter((p) => p.active && !p.pending);

  const load = useCallback(() => api.posts().then(setState, (e) => toast(e.message, 'error')), [api, toast]);
  useEffect(() => {
    load();
    return () => player?.pause();
  }, [load, player]);

  const run = async (key, fn, msg) => {
    setBusy(key);
    try {
      setState(await fn());
      if (msg) toast(msg);
      return true;
    } catch (e) {
      toast(e.message, 'error');
      return false;
    } finally {
      setBusy('');
    }
  };
  const addTrack = async (e) => {
    e.preventDefault();
    if (!track.file) return toast('Choose an audio file.', 'error');
    const ok = await run('track', async () => api.addTrack((await uploadMedia(api, track.file)).id, track.title), 'Added to the library.');
    if (ok) setTrack({ title: '', file: null });
  };
  const play = (t) => {
    if (playing === t.id) {
      player.pause();
      return setPlaying('');
    }
    player.src = t.url;
    player.onended = () => setPlaying('');
    player.play().then(() => setPlaying(t.id), () => {});
  };

  if (!state) {
    return (
      <div className="admin-loading">
        <Loader2 className="spin" />
      </div>
    );
  }
  const shown = state.posts.filter((p) => (filter === 'reported' ? p.reports > 0 : filter === 'hidden' ? p.hidden : true));
  const reported = state.posts.filter((p) => p.reports > 0).length;

  return (
    <div className="admin-section">
      <div className="admin-section-head">
        <div>
          <h2>Posts</h2>
          <p>
            Photos and videos of kirtans, shown on the website under “Sewa in action” and on each team member’s profile. Members post from their dashboard; you can post as the jatha or for a member, and edit, hide or delete any post. Files are stored in: <strong>{state.storage}</strong>.
          </p>
        </div>
      </div>

      <div className="dash-cols">
        <div className="dash-main">
          <h3>New post</h3>
          <PostComposer
            client={api}
            library={state.library}
            toast={toast}
            onPosted={setState}
            extraBody={{ personId: as }}
            extra={
              <label className="field select">
                <select value={as} onChange={(e) => setAs(e.target.value)}>
                  <option value="">The jatha ({data.settings.siteName})</option>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <span>Post as</span>
              </label>
            }
          />

          <div className="filter-pills">
            {[
              { id: 'all', label: `All (${state.posts.length})` },
              { id: 'reported', label: `Reported (${reported})` },
              { id: 'hidden', label: 'Hidden' },
            ].map((f) => (
              <button key={f.id} className={filter === f.id ? 'active' : ''} onClick={() => setFilter(f.id)}>
                {filter === f.id && <span className="pill-bg" />}
                <span>{f.label}</span>
              </button>
            ))}
          </div>
          {shown.length === 0 && <div className="admin-empty glass">No posts here.</div>}
          <div className="post-grid dense">
            {shown.map((p) => (
              <div key={p.id} className={`own-post ${p.hidden || p.authorOff ? 'is-hidden' : ''}`}>
                <PostTile post={p} onClick={() => setOpen({ post: p })} />
                <div className="own-post-meta">
                  <span>
                    <Heart size={13} /> {p.likes} · <Share2 size={13} /> {p.shares}
                    {p.authorOff && (
                      <em className="req-tag" title="This team member is inactive in the Team tab, so their posts are not on the site.">
                        <EyeOff size={12} /> member inactive
                      </em>
                    )}
                    {p.reports > 0 && (
                      <button type="button" className="req-tag" title="Clear reports" onClick={() => run(p.id + 'r', () => api.updatePost(p.id, { clearReports: true }), 'Reports cleared.')}>
                        <Flag size={12} /> {p.reports}
                      </button>
                    )}
                  </span>
                  <span>
                    {p.author.id && (
                      <Link to={`/m/${p.author.id}`} className="icon-btn" title="Profile" aria-label="Profile">
                        <Eye size={15} />
                      </Link>
                    )}
                    <button type="button" className="icon-btn" onClick={() => setEditing(p)} disabled={!!busy} title="Edit" aria-label="Edit">
                      <Pencil size={15} />
                    </button>
                    <button type="button" className="icon-btn" onClick={() => run(p.id + 'h', () => api.updatePost(p.id, { hidden: !p.hidden }), p.hidden ? 'Shown on the site again.' : 'Hidden from the site.')} disabled={!!busy} title={p.hidden ? 'Show' : 'Hide'} aria-label={p.hidden ? 'Show' : 'Hide'}>
                      {busy === p.id + 'h' ? <Loader2 size={15} className="spin" /> : p.hidden ? <Eye size={15} /> : <EyeOff size={15} />}
                    </button>
                    <button type="button" className="icon-btn danger-text" onClick={() => window.confirm('Delete this post for good?') && run(p.id, () => api.deletePost(p.id), 'Post deleted.')} disabled={!!busy} aria-label="Delete">
                      {busy === p.id ? <Loader2 size={15} className="spin" /> : <Trash2 size={15} />}
                    </button>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside className="dash-side">
          <div className="glass side-card">
            <h3>
              <Music size={16} /> Gurbani music library
            </h3>
            <p className="muted">Tracks members can put on their posts. Only add audio you have the right to share.</p>
            <ul className="music-library">
              {state.library.map((t) => (
                <li key={t.id}>
                  <button type="button" className="icon-btn" onClick={() => play(t)} aria-label="Play">
                    {playing === t.id ? <Pause size={15} /> : <Play size={15} />}
                  </button>
                  <span>{t.title}</span>
                  <button type="button" className="icon-btn danger-text" onClick={() => run(t.id, () => api.deleteTrack(t.id), 'Removed.')} disabled={!!busy} aria-label="Remove">
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
            <form className="track-form" onSubmit={addTrack}>
              <label className="field compact">
                <input value={track.title} onChange={(e) => setTrack((t) => ({ ...t, title: e.target.value }))} placeholder=" " required />
                <span>Track name (e.g. Asa Di Vaar)</span>
              </label>
              <label className="btn btn-ghost btn-sm">
                <Music size={14} /> {track.file ? track.file.name.slice(0, 24) : 'Choose audio'}
                <input type="file" accept="audio/*" hidden onChange={(e) => setTrack((t) => ({ ...t, file: e.target.files[0] || null, title: t.title || e.target.files[0]?.name.replace(/\.\w+$/, '') || '' }))} />
              </label>
              <button className="btn btn-primary btn-sm" disabled={busy === 'track'}>
                {busy === 'track' ? <Loader2 size={14} className="spin" /> : <Plus size={14} />} Add
              </button>
            </form>
          </div>
          <div className="glass side-card">
            <h3>
              <ImagePlus size={16} /> Poster backgrounds
            </h3>
            <p className="muted">Added by team members for everyone’s posters. Remove any that are not suitable.</p>
            {!state.backgrounds?.length && <p className="muted">None added yet.</p>}
            <div className="poster-swatches">
              {(state.backgrounds || []).map((b) => (
                <div key={b.id} className="poster-swatch" title={`${b.title} · added by ${b.by}`}>
                  <img src={b.url} alt={b.title} loading="lazy" />
                  <button
                    type="button"
                    className="poster-swatch-remove"
                    onClick={() => window.confirm(`Remove “${b.title}” (added by ${b.by})?`) && run(b.id, () => api.deletePosterBackground(b.id), 'Background removed.')}
                    disabled={!!busy}
                    aria-label="Remove background"
                  >
                    {busy === b.id ? <Loader2 size={11} className="spin" /> : <Trash2 size={11} />}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
      <PostViewer open={open} onClose={() => setOpen(null)} moderate={api.deleteComment} />
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit post" wide>
        {editing && (
          <PostComposer
            key={editing.id}
            post={editing}
            client={api}
            library={state.library}
            toast={toast}
            onPosted={(next) => {
              setState(next);
              setEditing(null);
            }}
          />
        )}
      </Modal>
    </div>
  );
}
