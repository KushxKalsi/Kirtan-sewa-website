import { Heart, Images, Music, Play } from 'lucide-react';
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
