import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Clapperboard, Heart, Image as ImageIcon, Loader2, Music2, UserCheck, UserPlus } from 'lucide-react';
import PostViewer, { MediaTile } from '../components/PostViewer';
import { api } from '../lib/api';
import { ease } from '../lib/motion';
import { useToast } from '../components/Toast';

const TABS = [
  { id: 'image', label: 'Photos', icon: ImageIcon },
  { id: 'video', label: 'Videos', icon: Clapperboard },
];

/** A team member's public page: who they are, their bio, followers (follow them here), and every photo and video they posted. */
export default function MemberProfile() {
  const { id } = useParams();
  const [member, setMember] = useState(null);
  const [posts, setPosts] = useState([]);
  const [more, setMore] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('image');
  const [open, setOpen] = useState(null);
  const [loading, setLoading] = useState(false);
  const [following, setFollowing] = useState(false);
  const toast = useToast();

  useEffect(() => {
    setMember(null);
    setError('');
    Promise.all([api.member(id), api.posts({ member: id, limit: 30 })])
      .then(([m, p]) => {
        setMember(m.member);
        setPosts(p.posts);
        setMore(p.more);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  const follow = async () => {
    const before = member;
    setMember((m) => ({ ...m, following: !m.following, followers: m.followers + (m.following ? -1 : 1) }));
    setFollowing(true);
    try {
      const r = await api.follow(id);
      setMember((m) => ({ ...m, ...r }));
    } catch (e) {
      setMember(before);
      toast(e.message, 'error');
    } finally {
      setFollowing(false);
    }
  };

  const loadMore = async () => {
    setLoading(true);
    try {
      const r = await api.posts({ member: id, limit: 30, before: posts[posts.length - 1].createdAt });
      setPosts((list) => [...list, ...r.posts]);
      setMore(r.more);
    } finally {
      setLoading(false);
    }
  };

  // Every photo / video on its own, remembering which post it is in.
  const items = useMemo(() => posts.flatMap((post) => post.media.map((m, index) => ({ post, m, index }))).filter((x) => x.m.kind === tab), [posts, tab]);

  return (
    <main className="page member-page">
      <div className="container">
        <Link to="/" state={{ scrollTo: 'gallery' }} className="back-link">
          <ArrowLeft size={16} /> Back to the site
        </Link>
        {error && <div className="admin-empty glass">{error}</div>}
        {!member && !error && (
          <div className="admin-loading">
            <Loader2 className="spin" />
          </div>
        )}
        {member && (
          <>
            <motion.header className="member-head glass" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease }}>
              <span className="member-avatar">{member.photo ? <img src={member.photo} alt="" /> : member.name.slice(0, 1)}</span>
              <div className="member-info">
                <div className="member-title">
                  <div>
                    <h1>{member.name}</h1>
                    {member.role && <p className="eyebrow">{member.role}</p>}
                  </div>
                  {!member.self && (
                    <motion.button type="button" className={`btn btn-sm ${member.following ? 'btn-ghost' : 'btn-primary'}`} onClick={follow} disabled={following} whileTap={{ scale: 0.94 }} aria-pressed={member.following}>
                      {member.following ? <UserCheck size={15} /> : <UserPlus size={15} />} {member.following ? 'Following' : 'Follow'}
                    </motion.button>
                  )}
                </div>
                <ul className="member-stats">
                  <li>
                    <strong>{member.followers}</strong> {member.followers === 1 ? 'follower' : 'followers'}
                  </li>
                  <li>
                    <strong>{member.kirtans}</strong> kirtans
                  </li>
                  <li>
                    <strong>{member.photos}</strong> photos
                  </li>
                  <li>
                    <strong>{member.videos}</strong> videos
                  </li>
                  <li>
                    <Heart size={14} /> <strong>{member.likes}</strong>
                  </li>
                </ul>
                {member.bio && <p className="member-bio">{member.bio}</p>}
              </div>
            </motion.header>

            <nav className="filter-pills member-tabs" role="tablist">
              {TABS.map((t) => (
                <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
                  {tab === t.id && <motion.span layoutId="member-tab" className="pill-bg" transition={{ type: 'spring', stiffness: 400, damping: 34 }} />}
                  <span>
                    <t.icon size={15} /> {t.label}
                  </span>
                </button>
              ))}
            </nav>

            {items.length === 0 ? (
              <div className="admin-empty glass">No {tab === 'image' ? 'photos' : 'videos'} yet.</div>
            ) : (
              <div className="post-grid dense">
                {items.map(({ post, m, index }) => (
                  <MediaTile key={m.id} media={m} onClick={() => setOpen({ post, index })}>
                    {post.audio && index === 0 && (
                      <span className="media-tile-music">
                        <Music2 size={13} />
                      </span>
                    )}
                  </MediaTile>
                ))}
              </div>
            )}
            {more && (
              <div className="feed-more">
                <button type="button" className="btn btn-ghost" onClick={loadMore} disabled={loading}>
                  {loading && <Loader2 size={16} className="spin" />} Show more
                </button>
              </div>
            )}
          </>
        )}
      </div>
      <PostViewer open={open} onClose={() => setOpen(null)} />
    </main>
  );
}
