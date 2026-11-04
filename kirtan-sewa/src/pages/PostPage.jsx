import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, UserRound } from 'lucide-react';
import PostCard from '../components/PostCard';
import { api } from '../lib/api';

/** A shared post link (/p/:id). */
export default function PostPage() {
  const { id } = useParams();
  const [post, setPost] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .post(id)
      .then((r) => setPost(r.post))
      .catch((e) => setError(e.message));
  }, [id]);

  return (
    <main className="page post-page">
      <div className="container narrow">
        <Link to="/" state={{ scrollTo: 'gallery' }} className="back-link">
          <ArrowLeft size={16} /> More from our kirtans
        </Link>
        {error && <div className="admin-empty glass">{error}</div>}
        {!post && !error && (
          <div className="admin-loading">
            <Loader2 className="spin" />
          </div>
        )}
        {post && (
          <>
            <PostCard post={post} />
            {post.author.id && (
              <Link to={`/m/${post.author.id}`} className="btn btn-ghost post-page-profile">
                <UserRound size={16} /> All photos and videos by {post.author.name}
              </Link>
            )}
          </>
        )}
      </div>
    </main>
  );
}
