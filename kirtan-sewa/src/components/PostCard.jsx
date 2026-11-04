import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronLeft, ChevronRight, Flag, Heart, Link2, MessageCircle, Music, Pause, Share2 } from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';
import { api } from '../lib/api';
import { useToast } from './Toast';

export const postLink = (id) => `${window.location.origin}/p/${id}`;

/** Avatar + name + role, linking to the member's profile (the jatha's own posts have no profile page). */
export function AuthorChip({ author, small }) {
  const inner = (
    <>
      <span className="author-avatar">{author.photo ? <img src={author.photo} alt="" loading="lazy" /> : author.name.slice(0, 1)}</span>
      <span className="author-text">
        <strong>{author.name}</strong>
        {author.role && <small>{author.role}</small>}
      </span>
    </>
  );
  return author.id ? (
    <Link to={`/m/${author.id}`} className={`author-chip ${small ? 'small' : ''}`} onClick={(e) => e.stopPropagation()}>
      {inner}
    </Link>
  ) : (
    <span className={`author-chip ${small ? 'small' : ''}`}>{inner}</span>
  );
}

/**
 * One post: swipe through its photos and videos, like it, share it, play its music, and open the member's profile from
 * the chip under the picture.
 */
export default function PostCard({ post: initial, startIndex = 0 }) {
  const toast = useToast();
  const [post, setPost] = useState(initial);
  const [index, setIndex] = useState(startIndex);
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [playing, setPlaying] = useState(false);
  const trackRef = useRef(null);
  const audioRef = useRef(null);
  const many = post.media.length > 1;

  useEffect(() => setPost(initial), [initial]);
  // Open at the photo that was tapped.
  useEffect(() => {
    const el = trackRef.current;
    if (el && startIndex) el.scrollTo({ left: startIndex * el.clientWidth });
  }, [startIndex]);
  useEffect(() => () => audioRef.current?.pause(), []);

  const go = (i) => {
    const el = trackRef.current;
    if (el) el.scrollTo({ left: Math.max(0, Math.min(post.media.length - 1, i)) * el.clientWidth, behavior: 'smooth' });
  };
  const onScroll = () => {
    const el = trackRef.current;
    if (el) setIndex(Math.round(el.scrollLeft / el.clientWidth));
  };

  const like = async () => {
    const before = post;
    setPost((p) => ({ ...p, liked: !p.liked, likes: p.likes + (p.liked ? -1 : 1) }));
    try {
      const r = await api.likePost(post.id);
      setPost((p) => ({ ...p, ...r }));
    } catch (e) {
      setPost(before);
      toast(e.message, 'error');
    }
  };
  const share = async () => {
    const url = postLink(post.id);
    api.sharePost(post.id).catch(() => {});
    if (navigator.share) {
      try {
        await navigator.share({ title: post.author.name, text: post.caption || 'Gurbani Kirtan sewa', url });
        return;
      } catch (e) {
        if (e.name === 'AbortError') return;
      }
    }
    setShareOpen((o) => !o);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(postLink(post.id));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast('Could not copy — long-press the address bar instead.', 'error');
    }
  };
  const report = async () => {
    setShareOpen(false);
    try {
      await api.reportPost(post.id, '');
      toast('Thank you — the admin will look at this post.');
    } catch (e) {
      toast(e.message, 'error');
    }
  };
  // Browsers only play sound after a tap, so music starts from the music button.
  const toggleMusic = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
      return setPlaying(false);
    }
    if (a.currentTime < post.audio.start) a.currentTime = post.audio.start;
    a.play().then(() => setPlaying(true), () => toast('This music could not be played.', 'error'));
  };

  return (
    <article className="post-card">
      <div className="post-media">
        <div className="post-track" ref={trackRef} onScroll={onScroll}>
          {post.media.map((m, i) => (
            <div key={m.id} className="post-slide">
              {m.kind === 'video' ? (
                <video src={m.url} controls playsInline preload="metadata" muted={playing} />
              ) : (
                <img src={m.url} alt={post.caption || `Photo ${i + 1}`} loading="lazy" onDoubleClick={() => !post.liked && like()} />
              )}
            </div>
          ))}
        </div>
        {many && (
          <>
            <button type="button" className="icon-btn post-nav prev" onClick={() => go(index - 1)} disabled={index === 0} aria-label="Previous">
              <ChevronLeft size={18} />
            </button>
            <button type="button" className="icon-btn post-nav next" onClick={() => go(index + 1)} disabled={index === post.media.length - 1} aria-label="Next">
              <ChevronRight size={18} />
            </button>
            <div className="post-dots">
              {post.media.map((m, i) => (
                <span key={m.id} className={i === index ? 'on' : ''} />
              ))}
            </div>
          </>
        )}
        {post.audio && (
          <button type="button" className={`post-music ${playing ? 'on' : ''}`} onClick={toggleMusic}>
            {playing ? <Pause size={14} /> : <Music size={14} />}
            <span>{post.audio.title}</span>
          </button>
        )}
        {post.audio && <audio ref={audioRef} src={post.audio.url} preload="none" loop onEnded={() => setPlaying(false)} />}
      </div>

      <div className="post-body">
        <AuthorChip author={post.author} />
        <div className="post-actions">
          <motion.button type="button" className={`post-like ${post.liked ? 'on' : ''}`} onClick={like} whileTap={{ scale: 0.85 }} aria-pressed={post.liked} aria-label={post.liked ? 'Unlike' : 'Like'}>
            <Heart size={20} fill={post.liked ? 'currentColor' : 'none'} />
            <span>{post.likes}</span>
          </motion.button>
          <button type="button" className="post-share" onClick={share} aria-label="Share">
            <Share2 size={19} />
          </button>
        </div>
        <AnimatePresence>
          {shareOpen && (
            <motion.div className="post-share-menu" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
              <a className="btn btn-ghost btn-sm" href={`https://wa.me/?text=${encodeURIComponent(`${post.caption ? `${post.caption}\n` : ''}${postLink(post.id)}`)}`} target="_blank" rel="noreferrer">
                <MessageCircle size={15} /> WhatsApp
              </a>
              <button type="button" className="btn btn-ghost btn-sm" onClick={copy}>
                {copied ? <Check size={15} /> : <Link2 size={15} />} {copied ? 'Copied' : 'Copy link'}
              </button>
              <button type="button" className="btn btn-ghost btn-sm danger-text" onClick={report}>
                <Flag size={15} /> Report
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        {post.caption && <p className="post-caption">{post.caption}</p>}
        <time className="post-time" dateTime={post.createdAt}>
          {formatDistanceToNowStrict(new Date(post.createdAt), { addSuffix: true })}
        </time>
      </div>
    </article>
  );
}
