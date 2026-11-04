import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Images, Loader2 } from 'lucide-react';
import SplitText from '../components/SplitText';
import Reveal from '../components/Reveal';
import PostViewer, { PostTile } from '../components/PostViewer';
import { useSite } from '../components/SiteContext';
import { api } from '../lib/api';
import { ease } from '../lib/motion';
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

  useEffect(() => {
    api
      .posts({ limit: PAGE })
      .then((r) => {
        setPosts(r.posts);
        setMore(r.more);
      })
      .catch(() => setPosts([]));
  }, []);

  const loadMore = async () => {
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
  };

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
            <p className="section-lead">Photos and videos the jatha posts from their kirtans. Tap one to see more, like it or share it, and tap a name to see all of their sewa.</p>
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
              <PostTile post={p} onClick={() => setOpen({ post: p })} />
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
      <PostViewer open={open} onClose={() => setOpen(null)} />
    </section>
  );
}
