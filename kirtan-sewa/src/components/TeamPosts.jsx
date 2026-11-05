import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera, EyeOff, Flag, Heart, Loader2, Pencil, Share2, Trash2, UserRound } from 'lucide-react';
import Modal from './Modal';
import PostComposer from './PostComposer';
import PostViewer, { PostTile } from './PostViewer';
import { prettyDate } from '../lib/date';
import { shrinkPhoto, uploadMedia } from '../lib/media';

/** Team member: their public profile photo, a new post, and the posts they made (likes, shares, edit, delete). */
export default function TeamPosts({ data, team, toast }) {
  const [state, setState] = useState(null); // { posts, library, photo, limits }
  const [busy, setBusy] = useState('');
  const [bookingId, setBookingId] = useState('');
  const [open, setOpen] = useState(null);
  const [editing, setEditing] = useState(null);
  const me = data.person;
  // Kirtans they can link a post to: ones they were given that are confirmed or done.
  const kirtans = data.duties.filter((d) => d.status === 'confirmed' || d.status === 'completed').slice(0, 30);

  const load = useCallback(() => team.posts().then(setState, (e) => toast(e.message, 'error')), [team, toast]);
  useEffect(() => {
    load();
  }, [load]);

  const run = async (key, fn, msg) => {
    setBusy(key);
    try {
      setState(await fn());
      if (msg) toast(msg);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy('');
    }
  };
  const changePhoto = (file) =>
    run('photo', async () => {
      const { id } = await uploadMedia(team, await shrinkPhoto(file, 800));
      return team.setPhoto(id);
    }, 'Profile photo updated.');

  if (!state) {
    return (
      <div className="admin-loading">
        <Loader2 className="spin" />
      </div>
    );
  }

  return (
    <div className="team-posts">
      <div className="glass profile-photo-card">
        <span className="member-avatar small">{state.photo ? <img src={state.photo} alt="" /> : me.name.slice(0, 1)}</span>
        <div>
          <strong>Your public profile</strong>
          <p className="muted">Visitors open it from the name under your photos. Add a clear photo of yourself.</p>
          <div className="ab-actions">
            <label className="btn btn-ghost btn-sm">
              {busy === 'photo' ? <Loader2 size={15} className="spin" /> : <Camera size={15} />} {state.photo ? 'Change photo' : 'Add photo'}
              <input type="file" accept="image/*" hidden onChange={(e) => e.target.files[0] && changePhoto(e.target.files[0])} />
            </label>
            <Link to={`/m/${me.id}`} className="btn btn-ghost btn-sm">
              <UserRound size={15} /> See my profile
            </Link>
          </div>
        </div>
      </div>

      <h3>New post</h3>
      <PostComposer
        client={team}
        library={state.library}
        limits={state.limits}
        toast={toast}
        onPosted={setState}
        extraBody={{ bookingId }}
        extra={
          kirtans.length > 0 && (
            <label className="field select">
              <select value={bookingId} onChange={(e) => setBookingId(e.target.value)}>
                <option value="">Not linked to a kirtan</option>
                {kirtans.map((d) => (
                  <option key={d.id} value={d.id}>
                    {prettyDate(d.date, 'd MMM')} · {d.serviceName} · {d.address?.slice(0, 40)}
                  </option>
                ))}
              </select>
              <span>Which kirtan is this from? (optional)</span>
            </label>
          )
        }
      />

      <h3>Your posts ({state.posts.length})</h3>
      {state.posts.some((p) => p.authorOff) && <p className="muted">Your account is set as inactive, so your posts are not shown on the website. Please ask the admin to make it active again.</p>}
      {state.posts.length === 0 && <p className="muted">Nothing posted yet. Photos and videos of your kirtans show on the website and on your profile.</p>}
      <div className="post-grid dense">
        {state.posts.map((p) => (
          <div key={p.id} className="own-post">
            <PostTile post={p} onClick={() => setOpen({ post: p })} />
            <div className="own-post-meta">
              <span>
                <Heart size={13} /> {p.likes} · <Share2 size={13} /> {p.shares}
                {p.hidden && (
                  <em className="req-tag">
                    <EyeOff size={12} /> hidden by admin
                  </em>
                )}
                {p.authorOff && (
                  <em className="req-tag">
                    <EyeOff size={12} /> not on the site
                  </em>
                )}
                {p.reports > 0 && (
                  <em className="req-tag">
                    <Flag size={12} /> {p.reports}
                  </em>
                )}
              </span>
              <span>
                <button type="button" className="icon-btn" onClick={() => setEditing(p)} disabled={!!busy} aria-label="Edit post">
                  <Pencil size={15} />
                </button>
                <button
                  type="button"
                  className="icon-btn danger-text"
                  onClick={() => window.confirm('Delete this post for good?') && run(p.id, () => team.deletePost(p.id), 'Post deleted.')}
                  disabled={!!busy}
                  aria-label="Delete post"
                >
                  {busy === p.id ? <Loader2 size={15} className="spin" /> : <Trash2 size={15} />}
                </button>
              </span>
            </div>
          </div>
        ))}
      </div>
      <PostViewer open={open} onClose={() => setOpen(null)} />
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit post" wide>
        {editing && (
          <PostComposer
            key={editing.id}
            post={editing}
            client={team}
            library={state.library}
            limits={state.limits}
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
