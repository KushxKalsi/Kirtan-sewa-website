import { useEffect, useLayoutEffect, useRef } from 'react';
import { Heart, Images, Loader2, Music, Play, X } from 'lucide-react';
import Modal from './Modal';
import PostCard from './PostCard';

/** A square preview of one photo or video (a video shows its first frame). */
export function MediaTile({ media, onClick, children }) {
  return (
    <button type="button" className="media-tile" onClick={onClick}>
      {media.kind === 'video' ? <video src={`${media.url}#t=0.5`} muted playsInline preload="metadata" /> : <img src={media.url} alt="" loading="lazy" />}
      {media.kind === 'video' && (
        <span className="media-tile-badge">
          <Play size={14} fill="currentColor" />
        </span>
      )}
      {children}
    </button>
  );
}

/** A post's first photo / video, with how many more it has, its music and its likes. */
export function PostTile({ post, onClick }) {
  return (
    <MediaTile media={post.media[0]} onClick={onClick}>
      <span className="post-tile-info">
        <span>{post.author.name}</span>
        <span className="post-tile-icons">
          {post.media.length > 1 && <Images size={14} />}
          {post.audio && <Music size={14} />}
          <Heart size={14} fill={post.liked ? 'currentColor' : 'none'} /> {post.likes}
        </span>
      </span>
    </MediaTile>
  );
}

/** A post opened over the page, at the photo that was tapped. */
export default function PostViewer({ open, onClose }) {
  return (
    <Modal open={!!open} onClose={onClose} size="post-modal">
      {open && <PostCard post={open.post} startIndex={open.index || 0} />}
    </Modal>
  );
}

function FeedList({ posts, startId, more, loading, onLoadMore, onClose }) {
  const headRef = useRef(null);
  const endRef = useRef(null);

  // Open at the post that was tapped, just under the header; the newer posts are above it.
  useLayoutEffect(() => {
    const head = headRef.current;
    const card = head?.parentElement.querySelector(`[data-post="${startId}"]`);
    if (card) head.closest('.modal').scrollTop = card.offsetTop - head.offsetHeight;
  }, [startId]);
  // Load older posts as the bottom of the feed comes near.
  useEffect(() => {
    const el = endRef.current;
    if (!el || !more || loading) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && onLoadMore(), { root: el.closest('.modal'), rootMargin: '600px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [more, loading, onLoadMore]);

  return (
    <>
      <div className="post-feed-head" ref={headRef}>
        <strong>Posts</strong>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>
      </div>
      <div className="post-feed-list">
        {posts.map((p) => (
          <div key={p.id} data-post={p.id}>
            <PostCard post={p} />
          </div>
        ))}
      </div>
      <div className="post-feed-end" ref={endRef}>
        {loading ? <Loader2 size={18} className="spin" /> : !more && 'You have seen all the posts'}
      </div>
    </>
  );
}

/** Posts opened over the page as one scrolling feed, Instagram style: scroll up for newer posts, down for older ones. */
export function PostFeedViewer({ posts, openId, more, loading, onLoadMore, onClose }) {
  return (
    <Modal open={!!openId} onClose={onClose} size="post-modal post-feed">
      {openId && <FeedList posts={posts} startId={openId} more={more} loading={loading} onLoadMore={onLoadMore} onClose={onClose} />}
    </Modal>
  );
}
