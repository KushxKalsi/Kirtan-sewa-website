import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Heart, Loader2, Music, Share2, Volume2, VolumeX, X } from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';
import { AuthorChip, ShareMenu, usePostActions } from './PostCard';
import { lockScroll, unlockScroll } from '../lib/scroll';

const OPEN_EVENT = 'reels:open';
let openViews = 0;

/** Open the home page's reels at the newest post (the header's Posts link). */
export const openReels = () => window.dispatchEvent(new Event(OPEN_EVENT));
export const onOpenReels = (fn) => {
  window.addEventListener(OPEN_EVENT, fn);
  return () => window.removeEventListener(OPEN_EVENT, fn);
};

/** One post filling the screen: swipe sideways through its photos and videos, double-tap to like, tap for sound. */
function Reel({ post: initial, active, muted, onMute, onChange }) {
  const actions = usePostActions(initial, onChange);
  const { post, like, share } = actions;
  const [index, setIndex] = useState(0);
  const [burst, setBurst] = useState(0);
  const [captionOpen, setCaptionOpen] = useState(false);
  const trackRef = useRef(null);
  const audioRef = useRef(null);
  const many = post.media.length > 1;
  const hasSound = !!post.audio || post.media.some((m) => m.kind === 'video');

  // Play only what is on screen: the shown video, and the post's music while this is the reel in view.
  useEffect(() => {
    trackRef.current?.querySelectorAll('video').forEach((v) => {
      if (!active || Number(v.dataset.i) !== index) return v.pause();
      v.muted = muted || !!post.audio;
      v.play().catch(() => {
        // The browser would not play it with sound: play it muted instead.
        v.muted = true;
        onMute(true);
        v.play().catch(() => {});
      });
    });
    const a = audioRef.current;
    if (!a) return;
    if (!active || muted) return a.pause();
    if (a.currentTime < post.audio.start) a.currentTime = post.audio.start;
    a.play().catch(() => onMute(true));
  }, [active, index, muted, post.audio, onMute]);
  useEffect(() => () => audioRef.current?.pause(), []);

  const go = (i) => {
    const el = trackRef.current;
    if (el) el.scrollTo({ left: Math.max(0, Math.min(post.media.length - 1, i)) * el.clientWidth, behavior: 'smooth' });
  };
  const onScroll = () => {
    const el = trackRef.current;
    if (el) setIndex(Math.round(el.scrollLeft / el.clientWidth));
  };
  const doubleTap = () => {
    if (!post.liked) like();
    setBurst(Date.now());
  };

  return (
    <section className="reel" data-post={post.id}>
      <div className="reel-frame">
        <div className="reel-track" ref={trackRef} onScroll={onScroll} onClick={() => hasSound && onMute(!muted)} onDoubleClick={doubleTap}>
          {post.media.map((m, i) => (
            <div key={m.id} className="reel-slide">
              {m.kind === 'video' ? (
                <video data-i={i} src={m.url} loop playsInline preload="metadata" />
              ) : (
                <>
                  <img className="reel-blur" src={m.url} alt="" aria-hidden="true" loading="lazy" />
                  <img src={m.url} alt={post.caption || `Photo ${i + 1}`} loading="lazy" />
                </>
              )}
            </div>
          ))}
        </div>
        {post.audio && <audio ref={audioRef} src={post.audio.url} preload="none" loop />}

        <AnimatePresence>
          {burst > 0 && (
            <motion.span
              key={burst}
              className="reel-burst"
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: [0.3, 1.15, 1], opacity: [0, 1, 1] }}
              exit={{ scale: 1.3, opacity: 0 }}
              transition={{ duration: 0.45 }}
              onAnimationComplete={() => setTimeout(() => setBurst(0), 250)}
            >
              <Heart size={96} fill="currentColor" />
            </motion.span>
          )}
        </AnimatePresence>

        {many && (
          <>
            <button type="button" className="icon-btn reel-side-nav prev" onClick={() => go(index - 1)} disabled={index === 0} aria-label="Previous photo">
              <ChevronLeft size={18} />
            </button>
            <button type="button" className="icon-btn reel-side-nav next" onClick={() => go(index + 1)} disabled={index === post.media.length - 1} aria-label="Next photo">
              <ChevronRight size={18} />
            </button>
            <div className="post-dots reel-dots">
              {post.media.map((m, i) => (
                <span key={m.id} className={i === index ? 'on' : ''} />
              ))}
            </div>
          </>
        )}

        <div className="reel-info">
          <AuthorChip author={post.author} small />
          {post.caption && (
            <p className={`reel-caption ${captionOpen ? 'open' : ''}`} onClick={() => setCaptionOpen((o) => !o)}>
              {post.caption}
            </p>
          )}
          {post.audio && (
            <span className="reel-music">
              <Music size={13} /> <span>{post.audio.title}</span>
            </span>
          )}
          <time dateTime={post.createdAt}>{formatDistanceToNowStrict(new Date(post.createdAt), { addSuffix: true })}</time>
        </div>

        <div className="reel-actions">
          <motion.button type="button" className={`reel-act ${post.liked ? 'liked' : ''}`} onClick={like} whileTap={{ scale: 0.8 }} aria-pressed={post.liked} aria-label={post.liked ? 'Unlike' : 'Like'}>
            <Heart size={28} fill={post.liked ? 'currentColor' : 'none'} />
            <span>{post.likes}</span>
          </motion.button>
          <button type="button" className="reel-act" onClick={share} aria-label="Share">
            <Share2 size={26} />
            <span>Share</span>
          </button>
          {hasSound && (
            <button type="button" className="reel-act" onClick={() => onMute(!muted)} aria-label={muted ? 'Sound on' : 'Sound off'}>
              {muted ? <VolumeX size={26} /> : <Volume2 size={26} />}
            </button>
          )}
        </div>
        <ShareMenu actions={actions} className="reel-share-menu" />
      </div>
    </section>
  );
}

function ReelsView({ posts, startId, more, loading, onLoadMore, onChange, onClose }) {
  const scrollerRef = useRef(null);
  const [active, setActive] = useState(String(startId));
  const [muted, setMuted] = useState(false);
  const at = posts.findIndex((p) => String(p.id) === active);

  const step = (d) => {
    const el = scrollerRef.current;
    el?.scrollBy({ top: d * el.clientHeight, behavior: 'smooth' });
  };

  useEffect(() => {
    lockScroll();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        step(e.key === 'ArrowDown' ? 1 : -1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      unlockScroll();
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);
  // The phone's back button closes the reels instead of leaving the page.
  useEffect(() => {
    openViews += 1;
    if (!window.history.state?.reels) window.history.pushState({ ...window.history.state, reels: true }, '');
    window.addEventListener('popstate', onClose);
    return () => {
      openViews -= 1;
      window.removeEventListener('popstate', onClose);
      // Closed with X / Esc: drop the entry pushed above (the check skips React's remount in development).
      setTimeout(() => !openViews && window.history.state?.reels && window.history.back());
    };
  }, [onClose]);
  // Start at the post that was tapped; the newer posts are above it.
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    const reel = el.querySelector(`[data-post="${startId}"]`);
    if (reel) el.scrollTop = reel.offsetTop;
  }, [startId]);
  // The reel that fills most of the screen is the one playing.
  useEffect(() => {
    const root = scrollerRef.current;
    const io = new IntersectionObserver((entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.dataset.post)), { root, threshold: 0.6 });
    root.querySelectorAll('.reel').forEach((r) => io.observe(r));
    return () => io.disconnect();
  }, [posts.length]);
  // Fetch older posts a few reels before the end.
  useEffect(() => {
    if (more && !loading && at >= posts.length - 3) onLoadMore();
  }, [at, more, loading, posts.length, onLoadMore]);

  return (
    <motion.div className="reels" role="dialog" aria-modal="true" aria-label="Posts" data-lenis-prevent initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.25 }}>
      <div className="reels-scroller" ref={scrollerRef}>
        {posts.map((p) => (
          <Reel key={p.id} post={p} active={String(p.id) === active} muted={muted} onMute={setMuted} onChange={onChange} />
        ))}
        {loading && (
          <div className="reels-loading">
            <Loader2 size={22} className="spin" />
          </div>
        )}
      </div>
      <div className="reels-top">
        <strong>Posts</strong>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
          <X size={20} />
        </button>
      </div>
      <div className="reels-step">
        <button type="button" className="icon-btn" onClick={() => step(-1)} disabled={at <= 0} aria-label="Newer post">
          <ChevronUp size={20} />
        </button>
        <button type="button" className="icon-btn" onClick={() => step(1)} disabled={at >= posts.length - 1} aria-label="Older post">
          <ChevronDown size={20} />
        </button>
      </div>
    </motion.div>
  );
}

/** Posts as full-screen reels: scroll up for newer posts and down for older ones, which load as you go. */
export default function Reels({ posts, openId, more, loading, onLoadMore, onChange, onClose }) {
  return createPortal(
    <AnimatePresence>{openId != null && <ReelsView posts={posts} startId={openId} more={more} loading={loading} onLoadMore={onLoadMore} onChange={onChange} onClose={onClose} />}</AnimatePresence>,
    document.body,
  );
}
