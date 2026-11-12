'use client';

// Notes left under an open shelf, a published flow or a review. Public to read; sign in to write.
import { useEffect, useState } from 'react';
import { ArrowUp, LoaderCircle, MessageSquareText, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { ago, initial, readerHref } from '@/lib/commons';
import type { Comment, CommentTarget } from '@/lib/types';
import s from './commons.module.css';

export default function CommentThread({ kind, id, canPost, canModerate = false, viewerHandle, signInHref, onError }: {
  kind: CommentTarget; id: string; canPost: boolean; canModerate?: boolean; viewerHandle?: string | null; signInHref?: string; onError?: (message: string) => void;
}) {
  const [comments, setComments] = useState<Comment[] | null>(null), [body, setBody] = useState(''), [busy, setBusy] = useState(false), [failed, setFailed] = useState('');
  useEffect(() => {
    let live = true; setComments(null);
    api<{ comments: Comment[] }>(`/community/comments/${kind}/${encodeURIComponent(id)}`).then(v => { if (live) setComments(v.comments); }).catch(() => { if (live) setComments([]); });
    return () => { live = false; };
  }, [kind, id]);
  const post = async () => {
    if (!body.trim() || busy) return; setBusy(true); setFailed('');
    try { const made = await api<Comment>('/comments', { method: 'POST', body: JSON.stringify({ target_kind: kind, target_id: id, body: body.trim() }) }); setComments(list => [...(list || []), made]); setBody(''); }
    catch (e) { const message = e instanceof Error ? e.message : 'The note could not be left.'; setFailed(message); onError?.(message); }
    finally { setBusy(false); }
  };
  const remove = async (comment: Comment) => {
    try { await api(`/comments/${comment.id}`, { method: 'DELETE' }); setComments(list => (list || []).filter(c => c.id !== comment.id)); }
    catch (e) { onError?.(e instanceof Error ? e.message : 'The note could not be removed.'); }
  };
  return <section className={s.thread} aria-label="Notes">
    <h3><MessageSquareText size={15} aria-hidden="true" /> Notes {comments && comments.length > 0 && <small>{comments.length}</small>}</h3>
    {comments === null ? <p className={s.muted}><LoaderCircle size={14} className="spin" /> Reading the notes…</p>
      : comments.length === 0 ? <p className={s.muted}>No notes yet. {canPost ? 'Leave the first one.' : ''}</p>
      : <ul>{comments.map(c => <li key={c.id} className={s.comment}>
        <span className={s.avatar} aria-hidden="true">{initial(c.author)}</span>
        <div><div className={s.commentTop}>{readerHref(c.author) ? <a href={readerHref(c.author)!}>{c.author.display_name}</a> : <b>{c.author.display_name}</b>}<small>{ago(c.created_at)}</small>{(canModerate || (viewerHandle && c.author.handle === viewerHandle)) && <button type="button" className={s.linkDanger} aria-label="Remove this note" onClick={() => remove(c)}><Trash2 size={13} /></button>}</div><p>{c.body}</p></div>
      </li>)}</ul>}
    {canPost ? <form className={s.commentForm} onSubmit={e => { e.preventDefault(); post(); }}>
      <input value={body} onChange={e => setBody(e.target.value)} maxLength={2000} placeholder="Leave a note…" aria-label="Your note" />
      <button type="submit" disabled={busy || !body.trim()} aria-label="Post the note">{busy ? <LoaderCircle size={15} className="spin" /> : <ArrowUp size={15} />}</button>
    </form> : signInHref ? <p className={s.muted}><a href={signInHref}>Sign in</a> to leave a note.</p> : null}
    {failed && <p className={s.inlineError} role="alert">{failed}</p>}
  </section>;
}
