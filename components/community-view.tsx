'use client';

// The Community screen: what other readers are doing, open shelves, published flows, reviews, the readers
// themselves, and your own page in the commons.
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ArrowRight, BookOpen, Check, Globe2, LoaderCircle, Lock, MessageSquareText, Route, Star, Trash2, UserCheck, UserPlus, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { ago, authorsLine, initial, readerHref } from '@/lib/commons';
import type { Document, FeedItem, Flow, Folder, ReaderProfile, Review, Shelf } from '@/lib/types';
import { SpiderGlyph, WebCorner } from './spider-bits';
import s from './commons.module.css';
import ws from './workspace.module.css';

export interface CommunityViewProps {
  folders: Folder[]; documents: Document[]; blocked: boolean; gate: ReactNode; viewerHandle: string | null;
  onRefresh: () => void; onProfile: (profile: ReaderProfile) => void; onOpen: (doc: Document) => void; notify: (message: string) => void; onError: (message: string) => void;
}
type Tab = 'feed' | 'shelves' | 'flows' | 'reviews' | 'readers' | 'you';
const TABS: { id: Tab; label: string }[] = [{ id: 'feed', label: 'Feed' }, { id: 'shelves', label: 'Open shelves' }, { id: 'flows', label: 'Flows' }, { id: 'reviews', label: 'Reviews' }, { id: 'readers', label: 'Readers' }, { id: 'you', label: 'You' }];

export function Stars({ value, onChange, size = 15 }: { value: number; onChange?: (n: number) => void; size?: number }) {
  return <span className={s.stars} role={onChange ? 'radiogroup' : 'img'} aria-label={`${value} of 5 stars`}>
    {[1, 2, 3, 4, 5].map(n => onChange
      ? <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} ${n === 1 ? 'star' : 'stars'}`} data-on={n <= value} onClick={() => onChange(n)}><Star size={size + 3} /></button>
      : <i key={n} data-on={n <= value}><Star size={size} /></i>)}
  </span>;
}

/** A reader's name with their initial. Inside a card that is itself a link, the name is plain text (links do not nest). */
function Who({ who, suffix, link = true }: { who: ReaderProfile; suffix?: ReactNode; link?: boolean }) {
  const href = link ? readerHref(who) : null;
  return <span className={s.who}><span className={s.avatar} aria-hidden="true">{initial(who)}</span>{href ? <a href={href}>{who.display_name}</a> : <b>{who.display_name}</b>}{suffix}</span>;
}

export function ShelfCard({ shelf }: { shelf: Shelf }) {
  return <a className={s.card} href={shelf.href}>
    <span className={s.cardKind}><BookOpen size={12} aria-hidden="true" /> Open shelf</span>
    <strong>{shelf.name}</strong>
    {shelf.description && <p>{shelf.description}</p>}
    <small><Who who={shelf.author} link={false} /> · {shelf.count} {shelf.count === 1 ? 'work' : 'works'}{shelf.comment_count ? ` · ${shelf.comment_count} notes` : ''}</small>
  </a>;
}

export function FlowCard({ flow }: { flow: Flow }) {
  const forks = flow.graph.steps.filter(st => st.kind === 'choice').length;
  return <a className={s.card} href={flow.href}>
    <span className={s.cardKind}><Route size={12} aria-hidden="true" /> Reading flow</span>
    <strong>{flow.title}</strong>
    <p>{flow.description || flow.goal}</p>
    <small><Who who={flow.author} link={false} /> · {flow.step_count} steps · {forks} {forks === 1 ? 'fork' : 'forks'} · <Users size={11} aria-hidden="true" /> {flow.reader_count}</small>
  </a>;
}

export function ReviewCard({ review, mine, onEdit, onDelete }: { review: Review; mine?: boolean; onEdit?: () => void; onDelete?: () => void }) {
  return <article className={s.review}>
    <header><Stars value={review.rating} /><strong>{review.title}</strong><small>{authorsLine(review, '')}{review.year ? ` · ${review.year}` : ''}</small></header>
    {review.body && <p>{review.body}</p>}
    <footer><Who who={review.author} suffix={<small> · {ago(review.updated_at)}</small>} />{mine && <span className={s.rowTools}><button type="button" className={s.textLink} onClick={onEdit}>Edit</button><button type="button" className={s.linkDanger} onClick={onDelete} aria-label="Delete this review"><Trash2 size={13} /></button></span>}</footer>
  </article>;
}

export default function CommunityView(p: CommunityViewProps) {
  const [tab, setTab] = useState<Tab>('feed');
  const [feed, setFeed] = useState<FeedItem[] | null>(null), [feedScope, setFeedScope] = useState<'all' | 'following'>('all');
  const [shelves, setShelves] = useState<Shelf[] | null>(null), [flows, setFlows] = useState<Flow[] | null>(null), [reviews, setReviews] = useState<Review[] | null>(null), [readers, setReaders] = useState<ReaderProfile[] | null>(null);
  const [profile, setProfile] = useState<ReaderProfile | null>(null), [handle, setHandle] = useState(''), [name, setName] = useState(''), [bio, setBio] = useState(''), [saving, setSaving] = useState(false);
  const [reviewDoc, setReviewDoc] = useState(''), [rating, setRating] = useState(0), [body, setBody] = useState(''), [reviewing, setReviewing] = useState(false);
  const [shelfNotes, setShelfNotes] = useState<Record<string, string>>({});
  const fail = (e: unknown, fallback: string) => p.onError(e instanceof Error ? e.message : fallback);

  const loadFeed = useCallback(async (scope: 'all' | 'following') => { setFeed(null); try { setFeed((await api<{ items: FeedItem[] }>(`/community/feed?scope=${scope}`)).items); } catch (e) { setFeed([]); fail(e, 'The feed could not be read.'); } }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (p.blocked) return;
    if (tab === 'feed') loadFeed(feedScope);
    if (tab === 'shelves' && !shelves) api<{ shelves: Shelf[] }>('/community/shelves').then(v => setShelves(v.shelves)).catch(e => { setShelves([]); fail(e, 'The shelves could not be read.'); });
    if (tab === 'flows' && !flows) api<{ flows: Flow[] }>('/community/flows').then(v => setFlows(v.flows)).catch(e => { setFlows([]); fail(e, 'The flows could not be read.'); });
    if (tab === 'reviews' && !reviews) api<{ reviews: Review[] }>('/community/reviews').then(v => setReviews(v.reviews)).catch(e => { setReviews([]); fail(e, 'The reviews could not be read.'); });
    if (tab === 'readers') api<{ readers: ReaderProfile[] }>('/community/readers').then(v => setReaders(v.readers)).catch(e => { setReaders([]); fail(e, 'The readers could not be listed.'); });
    if (tab === 'you' && !profile) api<ReaderProfile>('/me/profile').then(v => { setProfile(v); setHandle(v.handle || ''); setName(v.display_name); setBio(v.bio); p.onProfile(v); }).catch(e => fail(e, 'Your page could not be read.'));
  }, [tab, feedScope, p.blocked]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveProfile = async () => {
    setSaving(true);
    try { const next = await api<ReaderProfile>('/me/profile', { method: 'PATCH', body: JSON.stringify({ handle: handle.trim().toLowerCase(), display_name: name.trim(), bio: bio.trim() }) }); setProfile(next); p.onProfile(next); p.notify('Your page is up to date.'); }
    catch (e) { fail(e, 'Your page could not be saved.'); } finally { setSaving(false); }
  };
  const follow = async (reader: ReaderProfile) => {
    if (!reader.handle) return;
    try { const r = await api<{ following: boolean; follower_count: number }>(`/follows/${reader.handle}`, { method: 'POST' }); setReaders(list => (list || []).map(x => x.handle === reader.handle ? { ...x, following: r.following, follower_count: r.follower_count } : x)); p.notify(r.following ? `Following ${reader.display_name}.` : `No longer following ${reader.display_name}.`); }
    catch (e) { fail(e, 'Could not follow this reader.'); }
  };
  const openShelf = async (folder: Folder, published: boolean) => {
    try { await api(`/folders/${folder.id}/publish`, { method: 'POST', body: JSON.stringify({ published, description: shelfNotes[folder.id] ?? folder.description ?? '' }) }); p.onRefresh(); setShelves(null); p.notify(published ? `“${folder.name}” is open to the commons.` : `“${folder.name}” is yours alone again.`); }
    catch (e) { fail(e, 'Could not change the shelf.'); }
  };
  const submitReview = async () => {
    if (!reviewDoc || !rating || reviewing) return; setReviewing(true);
    try { const made = await api<Review>('/reviews', { method: 'POST', body: JSON.stringify({ document_id: reviewDoc, rating, body: body.trim() }) }); setReviews(list => [made, ...(list || []).filter(r => r.id !== made.id)]); setReviewDoc(''); setRating(0); setBody(''); p.notify('Review posted to the commons.'); }
    catch (e) { fail(e, 'The review could not be posted.'); } finally { setReviewing(false); }
  };
  const deleteReview = async (review: Review) => {
    try { await api(`/reviews/${review.id}`, { method: 'DELETE' }); setReviews(list => (list || []).filter(r => r.id !== review.id)); p.notify('Review removed.'); } catch (e) { fail(e, 'The review could not be removed.'); }
  };
  const editReview = (review: Review) => { if (review.document_id) { setReviewDoc(review.document_id); setRating(review.rating); setBody(review.body); window.scrollTo({ top: 0, behavior: 'smooth' }); } else p.onError('That copy has left your library; review the book again from a copy you keep.'); };

  const verb = (item: FeedItem) => item.kind === 'shelf' ? 'opened a shelf' : item.kind === 'flow' ? 'published a reading flow' : item.kind === 'review' ? 'reviewed' : `left a note on ${item.target_kind === 'review' ? '' : item.target_kind === 'shelf' ? 'the shelf ' : 'the flow '}`;
  const icon = (kind: FeedItem['kind']) => kind === 'shelf' ? <BookOpen size={14} /> : kind === 'flow' ? <Route size={14} /> : kind === 'review' ? <Star size={14} /> : <MessageSquareText size={14} />;
  const loading = <p className={s.muted}><LoaderCircle size={14} className="spin" /> Reading the commons…</p>;
  const nothing = (what: string, hint: string) => <div className={ws.empty}><WebCorner corner="top-left" size={60} className={ws.emptyWeb} /><SpiderGlyph size={22} eyes={false} /><h3>{what}</h3><p>{hint}</p></div>;
  const readyDocs = p.documents.filter(d => ['ready', 'searchable', 'completed'].includes(d.status));
  const topFolders = p.folders.filter(f => !f.parent_id);

  return <div className={s.screen} data-screen="community">
    <header className={s.screenHead}><h1>Community <small>the commons</small></h1><p className={s.lede}>Readers open shelves, publish the flows they walked, review the books they keep, and leave notes for one another.</p></header>
    <div className={s.tabs} role="tablist" aria-label="Community sections">{TABS.map(t => <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</button>)}</div>
    {p.gate || <>
      {tab === 'feed' && <section aria-label="Feed">
        <div className={s.rowBetween}><div className={ws.toggle} role="group" aria-label="Whose activity"><button aria-pressed={feedScope === 'all'} onClick={() => setFeedScope('all')}>Everyone</button><button aria-pressed={feedScope === 'following'} onClick={() => setFeedScope('following')}>Readers you follow</button></div></div>
        {feed === null ? loading : feed.length === 0 ? nothing(feedScope === 'following' ? 'Nothing from the readers you follow yet.' : 'The commons is quiet.', feedScope === 'following' ? 'Follow a reader on the Readers tab.' : 'Open a shelf, publish a flow, or review a book to start it off.')
          : <ol className={s.feed}>{feed.map(item => <li key={`${item.kind}-${item.id}`} className={s.feedItem} data-kind={item.kind}>
            <span className={s.feedIcon} aria-hidden="true">{icon(item.kind)}</span>
            <div><p className={s.feedLine}><Who who={item.author} /> {verb(item)} <a href={item.href}>{item.title}</a>{item.kind === 'review' && item.rating ? <Stars value={item.rating} size={12} /> : null}<small>{ago(item.at)}</small></p>{item.summary && <p className={s.feedSummary}>{item.summary}</p>}</div>
          </li>)}</ol>}
      </section>}
      {tab === 'shelves' && <section aria-label="Open shelves">{shelves === null ? loading : shelves.length === 0 ? nothing('No open shelves yet.', 'Open one of your collections from the You tab.') : <div className={s.cards}>{shelves.map(sh => <ShelfCard key={sh.id} shelf={sh} />)}</div>}</section>}
      {tab === 'flows' && <section aria-label="Published flows">{flows === null ? loading : flows.length === 0 ? nothing('No published flows yet.', 'Build one on the Flows screen and publish it to the commons.') : <div className={s.cards}>{flows.map(f => <FlowCard key={f.id} flow={f} />)}</div>}</section>}
      {tab === 'reviews' && <section aria-label="Reviews">
        <form className={s.reviewForm} onSubmit={e => { e.preventDefault(); submitReview(); }} aria-labelledby="review-title">
          <h2 id="review-title"><Star size={16} aria-hidden="true" /> Review a book you keep</h2>
          <div className={s.reviewRow}>
            <label className="visually-hidden" htmlFor="review-doc">Which book</label>
            <select id="review-doc" className={s.scope} value={reviewDoc} onChange={e => setReviewDoc(e.target.value)} disabled={reviewing}><option value="">Choose from your library…</option>{readyDocs.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}</select>
            <Stars value={rating} onChange={setRating} />
          </div>
          <textarea className={s.textarea} value={body} onChange={e => setBody(e.target.value)} maxLength={4000} rows={3} placeholder="What stayed with you? Who should read it?" aria-label="Your review" disabled={reviewing} />
          <div className={s.rowEnd}><button type="submit" className={s.primary} disabled={reviewing || !reviewDoc || !rating}>{reviewing ? <><LoaderCircle size={14} className="spin" /> Posting…</> : <>Post the review <ArrowRight size={14} /></>}</button></div>
        </form>
        {reviews === null ? loading : reviews.length === 0 ? nothing('No reviews yet.', 'Be the first: choose a book above and give it a rating.') : <div className={s.reviewList}>{reviews.map(r => <ReviewCard key={r.id} review={r} mine={!!p.viewerHandle && r.author.handle === p.viewerHandle} onEdit={() => editReview(r)} onDelete={() => deleteReview(r)} />)}</div>}
      </section>}
      {tab === 'readers' && <section aria-label="Readers">{readers === null ? loading : readers.length === 0 ? nothing('No readers have stepped forward yet.', 'Your page appears here once you open a shelf, publish a flow, or write a review.') : <div className={s.cards}>{readers.map(r => <article key={r.handle} className={s.readerCard}>
        <span className={s.avatar} data-large="true" aria-hidden="true">{initial(r)}</span>
        <div className={s.readerText}><a href={readerHref(r) || '#'}><strong>{r.display_name}</strong></a><small>@{r.handle}{r.you ? ' · you' : ''}</small>{r.bio && <p>{r.bio}</p>}<small>{r.shelf_count} shelves · {r.flow_count} flows · {r.review_count} reviews · {r.follower_count} followers</small></div>
        {!r.you && <button type="button" className={r.following ? s.ghost : s.amber} onClick={() => follow(r)}>{r.following ? <><UserCheck size={14} /> Following</> : <><UserPlus size={14} /> Follow</>}</button>}
      </article>)}</div>}</section>}
      {tab === 'you' && <section aria-label="Your page" className={s.youGrid}>
        <form className={s.form} onSubmit={e => { e.preventDefault(); saveProfile(); }}>
          <h2>Your page in the commons</h2>
          {!profile ? loading : <>
            <label className={s.field}><span>Handle</span><div className={s.handleInput}><i>@</i><input value={handle} onChange={e => setHandle(e.target.value)} maxLength={40} pattern="[a-z0-9][a-z0-9-]{0,38}[a-z0-9]?" aria-describedby="handle-hint" /></div><small id="handle-hint">Letters, digits and hyphens. Your page lives at /u/{handle || '…'}.</small></label>
            <label className={s.field}><span>Name</span><input value={name} onChange={e => setName(e.target.value)} maxLength={80} /></label>
            <label className={s.field}><span>About you</span><textarea className={s.textarea} value={bio} onChange={e => setBio(e.target.value)} maxLength={600} rows={3} placeholder="What you read, what you are looking for." /></label>
            <div className={s.rowBetween}><a className={s.textLink} href={`/u/${profile.handle}`}>See your public page <ArrowRight size={13} /></a><button type="submit" className={s.primary} disabled={saving || !name.trim() || !handle.trim()}>{saving ? 'Saving…' : <><Check size={14} /> Save</>}</button></div>
          </>}
        </form>
        <div className={s.form}>
          <h2>Your shelves</h2>
          <p className={s.muted}>An open shelf lists a collection's catalogue for everyone. Full text opens only where the licence allows it (open licences, public domain, starter notes); other works show their card and where to find them.</p>
          {topFolders.length === 0 ? <p className={s.muted}>You have no collections yet.</p> : <ul className={s.shelfList}>{topFolders.map(f => <li key={f.id} data-open={!!f.published}>
            <div className={s.shelfRowTop}><strong>{f.published ? <Globe2 size={14} aria-label="Open" /> : <Lock size={14} aria-label="Closed" />} {f.name}</strong><small>{f.count} {f.count === 1 ? 'work' : 'works'}</small>
              <button type="button" className={f.published ? s.ghost : s.amber} onClick={() => openShelf(f, !f.published)}>{f.published ? 'Close the shelf' : 'Open to the commons'}</button></div>
            <input className={s.input} value={shelfNotes[f.id] ?? f.description ?? ''} onChange={e => setShelfNotes(n => ({ ...n, [f.id]: e.target.value }))} onBlur={() => { if (f.published && (shelfNotes[f.id] ?? '') !== (f.description ?? '')) openShelf(f, true); }} maxLength={600} placeholder="A line about what is on this shelf" aria-label={`Description of ${f.name}`} />
            {f.published && <a className={s.textLink} href={`/shelves/${f.id}`}>See the open shelf <ArrowRight size={12} /></a>}
          </li>)}</ul>}
        </div>
      </section>}
    </>}
  </div>;
}
