import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Send, Trash2 } from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';
import { api } from '../lib/api';
import { useToast } from './Toast';

/**
 * A post's comments: anyone can read them, people who are logged in can write one, and they can delete their own.
 * `moderate(postId, commentId)` (the admin) deletes any comment.
 */
export default function Comments({ postId, onCount, moderate, className = '' }) {
  const toast = useToast();
  const [view, setView] = useState(null); // { comments, canComment }
  const [text, setText] = useState('');
  const [busy, setBusy] = useState('');
  const listRef = useRef(null);
  const countRef = useRef(onCount);
  countRef.current = onCount;

  const take = (v) => {
    setView(v);
    countRef.current?.(v.comments.length);
  };
  useEffect(() => {
    api.comments(postId).then(take, (e) => toast(e.message, 'error'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);
  // The newest comment is at the bottom, next to the box.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [view?.comments.length]);

  const run = async (key, fn) => {
    setBusy(key);
    try {
      take(await fn());
      return true;
    } catch (e) {
      toast(e.message, 'error');
      return false;
    } finally {
      setBusy('');
    }
  };
  const send = async (e) => {
    e.preventDefault();
    if (text.trim() && (await run('send', () => api.addComment(postId, text)))) setText('');
  };
  const remove = (c) => window.confirm('Delete this comment?') && run(c.id, () => (c.canDelete ? api.deleteComment(postId, c.id) : moderate(postId, c.id)));

  if (!view) {
    return (
      <div className={`comments ${className}`}>
        <div className="comments-loading">
          <Loader2 size={18} className="spin" />
        </div>
      </div>
    );
  }

  return (
    <div className={`comments ${className}`}>
      <ul className="comment-list" ref={listRef}>
        {view.comments.length === 0 && <li className="comment-empty">No comments yet. Be the first.</li>}
        {view.comments.map((c) => (
          <li key={c.id} className="comment">
            <span className="author-avatar">{c.photo ? <img src={c.photo} alt="" loading="lazy" /> : c.name.slice(0, 1)}</span>
            <div className="comment-body">
              <p>
                {c.memberId ? (
                  <Link to={`/m/${c.memberId}`} className="comment-name">
                    {c.name}
                  </Link>
                ) : (
                  <strong className="comment-name">{c.name}</strong>
                )}{' '}
                {c.text}
              </p>
              <time dateTime={c.at}>{formatDistanceToNowStrict(new Date(c.at), { addSuffix: true })}</time>
            </div>
            {(c.canDelete || moderate) && (
              <button type="button" className="icon-btn comment-delete" onClick={() => remove(c)} disabled={!!busy} aria-label="Delete comment">
                {busy === c.id ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />}
              </button>
            )}
          </li>
        ))}
      </ul>
      {view.canComment ? (
        <form className="comment-form" onSubmit={send}>
          <input className="input" value={text} onChange={(e) => setText(e.target.value)} maxLength={500} placeholder="Add a comment…" aria-label="Add a comment" />
          <button className="icon-btn" disabled={!text.trim() || !!busy} aria-label="Post comment">
            {busy === 'send' ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
          </button>
        </form>
      ) : (
        !moderate && (
          <Link to={`/login?next=${encodeURIComponent(`/p/${postId}`)}`} className="comment-login">
            Log in to comment
          </Link>
        )
      )}
    </div>
  );
}
