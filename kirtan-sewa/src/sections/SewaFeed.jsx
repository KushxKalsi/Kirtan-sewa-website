import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Images, Loader2 } from 'lucide-react';
import SplitText from '../components/SplitText';
import Reveal from '../components/Reveal';
import { PostTile } from '../components/PostViewer';
import Reels, { onOpenReels } from '../components/Reels';
import { useSite } from '../components/SiteContext';
import { api } from '../lib/api';
import { ease } from '../lib/motion';
import { scrollToId } from '../lib/scroll';
import Gallery from './Gallery';

const PAGE = 9;

/**
 * "Sewa in action": the latest kirtan photos and videos the team posted. Shows the old gallery until there are posts,
 * and a short note when there is neither, so the header's Posts link always has somewhere to go.
 */
export default function SewaFeed() {
  const { site } = useSite();
  const [posts, setPosts] = useState(null);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(null);
  // The header's Posts link (from this page, or from another page via the route state) opens the reels.
  const [wantReels, setWantReels] = useState(!!useLocation().state?.reels);

  useEffect(() => onOpenReels(() => setWantReels(true)), []);
  useEffect(() => {
    if (!wantReels || !posts) return;
    setWantReels(false);
    if (posts.length) setOpen(posts[0].id);
    else scrollToId('gallery');
  }, [wantReels, posts]);

  useEffect(() => {
    api
      .posts({ limit: PAGE })
      .then((r) => {
        setPosts(r.posts);
        setMore(r.more);
      })
      .catch(() => setPosts([]));
  }, []);

  const loadMore = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.posts({ limit: PAGE, before: posts[posts.length - 1].createdAt });
      setPosts((list) => [...list, ...r.posts]);
      setMore(r.more);
    } catch {
      setMore(false);
    } finally {
      setLoading(false);
    }
  }, [posts]);
  const updatePost = useCallback((post) => setPosts((list) => list.map((p) => (p.id === post.id ? post : p))), []);
  const closeReels = useCallback(() => setOpen(null), []);

  if (posts?.length === 0 && site?.settings.gallery?.length) return <Gallery />;

  return (
    <section id="gallery" className="section feed">
      <div className="container">
        <div className="section-head">
          <Reveal>
            <span className="eyebrow">Sewa in action</span>
          </Reveal>
          <SplitText className="section-title" text="From our kirtans" highlight={[2]} />
          <Reveal delay={0.1}>
            <p className="section-lead">Photos and videos the jatha posts from their kirtans. Tap one to scroll through them like reels, and tap a name to see all of their sewa.</p>
          </Reveal>
        </div>
        {posts?.length === 0 && (
          <div className="admin-empty glass feed-empty">
            <Images size={22} /> Photos and videos from our kirtans will appear here soon.
          </div>
        )}
        <div className="post-grid">
          {(posts || []).map((p, i) => (
            <motion.div key={p.id} initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.7, ease, delay: (i % 3) * 0.08 }}>
              <PostTile post={p} onClick={() => setOpen(p.id)} />
            </motion.div>
          ))}
        </div>
        {more && (
          <div className="feed-more">
            <button type="button" className="btn btn-ghost" onClick={loadMore} disabled={loading}>
              {loading && <Loader2 size={16} className="spin" />} Show more
            </button>
          </div>
        )}
      </div>
      <Reels posts={posts || []} openId={open} more={more} loading={loading} onLoadMore={loadMore} onChange={updatePost} onClose={closeReels} />
    </section>
  );
}
