import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera, Check, EyeOff, Flag, Heart, Loader2, Pencil, Share2, Sparkles, Trash2, UserRound, UsersRound } from 'lucide-react';
import Modal from './Modal';
import PostComposer from './PostComposer';
import PostViewer, { PostTile } from './PostViewer';
import PosterMaker from './PosterMaker';
import { prettyDate } from '../lib/date';
import { shrinkPhoto, uploadMedia } from '../lib/media';

/** Team member: their public profile (photo, bio, followers), a new post, and the posts they made (likes, shares, edit, delete). */
export default function TeamPosts({ data, team, toast }) {
  const [state, setState] = useState(null); // { posts, library, photo, limits }
  const [busy, setBusy] = useState('');
  const [bookingId, setBookingId] = useState('');
  const [open, setOpen] = useState(null);
  const [editing, setEditing] = useState(null);
  const [bio, setBio] = useState(null); // being edited; null shows the saved one
  const [posterOpen, setPosterOpen] = useState(false);
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
  const saveBio = async (e) => {
    e.preventDefault();
    await run('bio', () => team.setBio(bio), 'Bio saved — it shows on your profile.');
    setBio(null);
  };

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
          <p className="muted">
            Visitors open it from the name under your photos. Add a clear photo of yourself. <UsersRound size={13} /> {state.followers} {state.followers === 1 ? 'follower' : 'followers'}
          </p>
          <div className="ab-actions">
            <label className="btn btn-ghost btn-sm">
              {busy === 'photo' ? <Loader2 size={15} className="spin" /> : <Camera size={15} />} {state.photo ? 'Change photo' : 'Add photo'}
              <input type="file" accept="image/*" hidden onChange={(e) => e.target.files[0] && changePhoto(e.target.files[0])} />
            </label>
            <Link to={`/m/${me.id}`} className="btn btn-ghost btn-sm">
              <UserRound size={15} /> See my profile
            </Link>
          </div>
          <form className="bio-form" onSubmit={saveBio}>
            <label className="field">
              <textarea value={bio ?? state.bio} onChange={(e) => setBio(e.target.value)} placeholder=" " rows={3} maxLength={600} />
              <span>Bio — about you and your kirtan</span>
            </label>
            {bio !== null && bio !== state.bio && (
              <button className="btn btn-primary btn-sm" disabled={busy === 'bio'}>
                {busy === 'bio' ? <Loader2 size={15} className="spin" /> : <Check size={15} />} Save bio
              </button>
            )}
          </form>
        </div>
      </div>

      <div className="glass poster-cta">
        <Sparkles size={22} />
        <div>
          <strong>Make a poster</strong>
          <p className="muted">Kirtan or Samagam templates — change the wording, photos, background and colours, then post it here or download it.</p>
        </div>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setPosterOpen(true)}>
          <Sparkles size={15} /> Generate poster
        </button>
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
      <PosterMaker open={posterOpen} duties={data.duties.filter((d) => d.status !== 'cancelled').slice(0, 30)} person={me} team={team} toast={toast} onClose={() => setPosterOpen(false)} onPosted={setState} />
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
