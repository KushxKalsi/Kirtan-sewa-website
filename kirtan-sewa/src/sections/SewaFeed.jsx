import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Images, Loader2, RefreshCw } from 'lucide-react';
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
 * "Sewa in action": kirtan photos and videos the team posted, by the members this visitor follows first. Refresh
 * shuffles them. Shows the old gallery until there are posts, and a short note when there is neither, so the header's
 * Posts link always has somewhere to go.
 */
export default function SewaFeed() {
  const { site } = useSite();
  const [posts, setPosts] = useState(null);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [seed, setSeed] = useState(0); // 0: newest first; a refresh picks a new shuffle
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
      .feed({ limit: PAGE })
      .then((r) => {
        setPosts(r.posts);
        setMore(r.more);
      })
      .catch(() => setPosts([]));
  }, []);

  const refresh = async () => {
    const next = 1 + Math.floor(Math.random() * 2 ** 30);
    setRefreshing(true);
    try {
      const r = await api.feed({ seed: next, limit: PAGE });
      setSeed(next);
      setPosts(r.posts);
      setMore(r.more);
    } catch {
      // keep what is on screen
    } finally {
      setRefreshing(false);
    }
  };

  const loadMore = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.feed({ seed, offset: posts.length, limit: PAGE });
      setPosts((list) => [...list, ...r.posts]);
      setMore(r.more);
    } catch {
      setMore(false);
    } finally {
      setLoading(false);
    }
  }, [posts, seed]);
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
            <p className="section-lead">Photos and videos the jatha posts from their kirtans. Tap one to scroll through them like reels, and tap a name to see all of their sewa and follow them.</p>
          </Reveal>
          {posts?.length > 0 && (
            <Reveal delay={0.15}>
              <button type="button" className="btn btn-ghost btn-sm feed-refresh" onClick={refresh} disabled={refreshing}>
                <RefreshCw size={15} className={refreshing ? 'spin' : ''} /> Refresh
              </button>
            </Reveal>
          )}
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
