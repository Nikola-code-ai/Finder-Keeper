'use client';

// The two characters, as clickable guides. Finder, a kindly spider, explains how documents are gathered;
// Keeper, an old archivist, explains how they are stored, searched and answered from. Each opens a sheet of
// plain-language steps, every step tagged with the technical term it stands for, and drawn as a thread of stations.
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ArrowRight, BookOpen, Boxes, Braces, CheckCheck, Cloud, Database, FileSearch, FileText, Filter, Globe2, HardDrive, Inbox, KeyRound, Layers, ListOrdered, Lock, MessageSquareQuote, Network, Scissors, Search, ServerCog, ShieldCheck, Sparkles, Telescope, X } from 'lucide-react';
import type { Status } from '@/lib/types';
import styles from './guides.module.css';

/** Finder: a round, friendly spider with big eyes, rosy cheeks and a magnifying glass, let down on a thread. */
export function FinderFigure({ size = 64, className }: { size?: number; className?: string }) {
  const legs = ['M30 41 Q22 30 15 31 L10 38', 'M28 46 Q18 40 11 43 L7 50', 'M28 51 Q19 52 13 57 L11 64', 'M31 56 Q25 62 22 68 L22 74'];
  const mirror = (d: string) => d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_, x, y) => `${80 - Number(x)} ${y}`);
  return <svg className={className} width={size} height={size} viewBox="0 0 80 80" fill="none" aria-hidden="true" focusable="false" strokeLinecap="round" strokeLinejoin="round">
    <path d="M40 0 L40 22" stroke="currentColor" strokeWidth="1" opacity=".55" data-thread="" />
    <g stroke="currentColor" strokeWidth="2.2">
      {legs.map(d => <path key={d} d={d} />)}
      {legs.slice(1).map(d => <path key={`r${d}`} d={mirror(d)} />)}
      {/* The first right leg holds the magnifying glass up. */}
      <path d="M50 41 Q58 31 64 30 L67 25" />
    </g>
    <circle cx="70.5" cy="19.5" r="5.5" stroke="var(--guide-accent, #e89b53)" strokeWidth="1.8" fill="var(--guide-glass, rgba(232,155,83,.12))" />
    <ellipse cx="40" cy="51" rx="14.5" ry="13" fill="var(--guide-body, #1b2330)" stroke="currentColor" strokeWidth="2" />
    <path d="M33 47 Q40 44 47 47 M32.5 53 Q40 50 47.5 53" stroke="currentColor" strokeWidth="1" opacity=".45" />
    <circle cx="40" cy="31" r="11.5" fill="var(--guide-body, #1b2330)" stroke="currentColor" strokeWidth="2" />
    <circle cx="35.4" cy="29.6" r="4.2" fill="var(--guide-eye, #f6f1e7)" /><circle cx="44.6" cy="29.6" r="4.2" fill="var(--guide-eye, #f6f1e7)" />
    <circle cx="36" cy="30.4" r="2.1" fill="var(--guide-pupil, #0b0e14)" data-pupil="" /><circle cx="45.2" cy="30.4" r="2.1" fill="var(--guide-pupil, #0b0e14)" data-pupil="" />
    <circle cx="36.7" cy="29.5" r=".7" fill="#fff" /><circle cx="45.9" cy="29.5" r=".7" fill="#fff" />
    <circle cx="31.6" cy="35.4" r="2" fill="var(--guide-accent, #e89b53)" opacity=".45" /><circle cx="48.4" cy="35.4" r="2" fill="var(--guide-accent, #e89b53)" opacity=".45" />
    <path d="M36.6 36.4 Q40 39.4 43.4 36.4" stroke="currentColor" strokeWidth="1.6" />
  </svg>;
}

/** Keeper: an old archivist, bald with white tufts, round spectacles, a big white beard, a cardigan and a book. */
export function KeeperFigure({ size = 76, className }: { size?: number; className?: string }) {
  return <svg className={className} width={size * 96 / 120} height={size} viewBox="0 0 96 120" fill="none" aria-hidden="true" focusable="false" strokeLinecap="round" strokeLinejoin="round">
    {/* Cardigan and shoulders */}
    <path d="M10 120 Q12 90 33 81 L48 95 L63 81 Q84 90 86 120 Z" fill="var(--guide-body, #1b2330)" stroke="currentColor" strokeWidth="2" />
    <path d="M33 81 L42 120 M63 81 L54 120" stroke="currentColor" strokeWidth="1.3" opacity=".6" />
    <path d="M44 86 L48 83 L52 86 L48 89 Z M41 83 L44 86 L41 89 Z M55 83 L52 86 L55 89 Z" fill="var(--guide-accent, #e89b53)" stroke="var(--guide-accent, #e89b53)" strokeWidth="1" />
    {/* Head, ears, white tufts at the sides of a bald crown */}
    <path d="M31.5 40 Q28 40 28.5 45 Q29.5 50 33 49 M64.5 40 Q68 40 67.5 45 Q66.5 50 63 49" fill="var(--guide-skin, #2a2622)" stroke="currentColor" strokeWidth="1.6" />
    <ellipse cx="48" cy="40" rx="17" ry="20" fill="var(--guide-skin, #2a2622)" stroke="currentColor" strokeWidth="2" />
    <path d="M31.5 37 Q25 33 28 26 Q29 31 32.5 30 Q30 24 35 21 M64.5 37 Q71 33 68 26 Q67 31 63.5 30 Q66 24 61 21" fill="var(--guide-hair, #edeae4)" stroke="currentColor" strokeWidth="1.2" />
    <path d="M42 24 Q48 21.5 54 24" stroke="currentColor" strokeWidth="1" opacity=".4" />
    {/* Brows, spectacles, kind closed eyes, nose */}
    <path d="M36 33.5 Q40.5 30 45 33 M51 33 Q55.5 30 60 33.5" stroke="var(--guide-hair, #edeae4)" strokeWidth="2.4" />
    <circle cx="41" cy="39.5" r="5.6" stroke="var(--guide-accent, #e89b53)" strokeWidth="1.6" fill="var(--guide-glass, rgba(232,155,83,.12))" />
    <circle cx="55" cy="39.5" r="5.6" stroke="var(--guide-accent, #e89b53)" strokeWidth="1.6" fill="var(--guide-glass, rgba(232,155,83,.12))" />
    <path d="M46.6 39.5 Q48 38 49.4 39.5 M35.4 39 L31.5 37.5 M60.6 39 L64.5 37.5" stroke="var(--guide-accent, #e89b53)" strokeWidth="1.4" />
    <path d="M38.6 40 Q41 42 43.4 40 M52.6 40 Q55 42 57.4 40" stroke="currentColor" strokeWidth="1.5" />
    <path d="M48 42 Q51.5 47.5 47.5 48.5" stroke="currentColor" strokeWidth="1.5" />
    {/* The beard, then the moustache over it */}
    <path d="M32 46 Q30.5 63 39.5 71 Q48 78 56.5 71 Q65.5 63 64 46 Q58 53 48 53 Q38 53 32 46 Z" fill="var(--guide-hair, #edeae4)" stroke="currentColor" strokeWidth="1.4" />
    <path d="M40 64 Q44 68 48 66 M50 68 Q54 67 56 63" stroke="var(--guide-body, #1b2330)" strokeWidth="1" opacity=".35" />
    <path d="M39.5 52 Q44 48.5 48 51 Q52 48.5 56.5 52 Q52 55.5 48 53.5 Q44 55.5 39.5 52 Z" fill="var(--guide-hair, #edeae4)" stroke="currentColor" strokeWidth="1.2" />
    {/* An open book held at the chest */}
    <g transform="rotate(-6 48 106)">
      <path d="M26 98 Q37 95 48 100 Q59 95 70 98 L70 116 Q59 113 48 118 Q37 113 26 116 Z" fill="var(--guide-page, #f1ece2)" stroke="currentColor" strokeWidth="1.6" />
      <path d="M48 100 L48 118" stroke="currentColor" strokeWidth="1.2" />
      <path d="M31 103 Q37 101.5 43 103.5 M31 107 Q37 105.5 43 107.5 M53 103.5 Q59 101.5 65 103 M53 107.5 Q59 105.5 65 107" stroke="var(--guide-body, #1b2330)" strokeWidth=".9" opacity=".55" />
      <ellipse cx="25" cy="107" rx="4" ry="5" fill="var(--guide-skin, #2a2622)" stroke="currentColor" strokeWidth="1.4" />
      <ellipse cx="71" cy="107" rx="4" ry="5" fill="var(--guide-skin, #2a2622)" stroke="currentColor" strokeWidth="1.4" />
    </g>
  </svg>;
}

type Icon = typeof Globe2;
interface Step { icon: Icon; title: string; term: string; body: ReactNode }
interface Chapter { id: string; tab: string; title: string; lede: string; steps: Step[]; note?: ReactNode }

const FINDER: Chapter[] = [{
  id: 'gather', tab: 'Gathering', title: 'How I gather documents',
  lede: 'When you choose Find Online, I go out of the window and come back only with copies you can really read.',
  steps: [
    { icon: Telescope, title: 'I read your request', term: 'Query parsing', body: 'I tidy your words, notice whether you named a title or a topic, and whether you want a book or a paper. That decides which catalogues I ask first.' },
    { icon: Network, title: 'I ask the public catalogues', term: 'Federated search · public APIs', body: 'I do not crawl the whole web. I ask open scholarly and book catalogues (OpenAlex, Crossref, OAPEN, OpenStax, Project Gutenberg) through their own front doors, with a time limit so you are never left waiting.' },
    { icon: FileSearch, title: 'I fetch each copy and check it', term: 'Retrieval & verification', body: 'I download the candidate itself from a public address only, then open it: is the PDF complete and unlocked, is the EPUB or page really full text, does its title match what you asked for? A licence or a link alone is never enough.' },
    { icon: Filter, title: 'I set aside what is not free', term: 'Access classification', body: 'Previews, paywalls and catalogue-only entries go in a separate pile, labelled honestly, and are never shown as free.' },
    { icon: Inbox, title: 'I hand it to Keeper', term: 'Import job', body: 'When you press Keep, the copy joins a queue. Keeper takes it from there: queued, processing, searchable.' },
  ],
  note: <>You can also bring documents yourself: upload a PDF, EPUB, text or HTML file, or paste a link, which I check the same way before it is kept.</>,
}];

const KEEPER: Chapter[] = [
  {
    id: 'store', tab: 'Storing', title: 'How I file what you keep',
    lede: 'Every document is read, cut into passages, and given a place on the shelf by what it means, not only by its title.',
    steps: [
      { icon: FileText, title: 'I read every page', term: 'Text extraction', body: 'PDF pages, EPUB chapters in reading order, and web pages or text in numbered sections. Pages keep their numbers so I can send you back to the exact one.' },
      { icon: Scissors, title: 'I cut it into passages', term: 'Chunking', body: 'Each page is cut into passages of about 220 words, overlapping by 35 so no idea is cut in half, and never running across a page break.' },
      { icon: Braces, title: 'I write each passage’s meaning as numbers', term: 'Embedding · vectorizing', body: 'A small language model (BGE-small) turns each passage, with the document’s title, into 384 numbers. Passages that mean similar things get similar numbers, even with different words.' },
      { icon: Database, title: 'I shelve the text and its numbers together', term: 'Vector index', body: 'The passage, its page, and its numbers are stored side by side, only under your account. When the job reaches “searchable”, the document is ready to be found.' },
    ],
  },
  {
    id: 'search', tab: 'Searching', title: 'How I find a passage',
    lede: 'Describe what you half-remember. I look for it by meaning and by wording at once, then show you the page it lives on.',
    steps: [
      { icon: Braces, title: 'Your words become numbers too', term: 'Query embedding', body: 'Your description is turned into 384 numbers with the same model, so it can be compared with every passage on the shelf.' },
      { icon: Search, title: 'I gather candidates two ways', term: 'Hybrid retrieval', body: 'The passages whose numbers sit nearest yours (meaning), plus the passages that share your exact words (keywords). Either can find what the other misses.' },
      { icon: ListOrdered, title: 'I rank them', term: 'Scoring & re-ranking', body: 'Mostly by closeness of meaning (82%), partly by shared words (18%), with a small boost when you typed a title. Weak matches are dropped, and I keep one passage per page.' },
      { icon: BookOpen, title: 'I point to the exact lines', term: 'Excerpt pinpointing', body: 'Inside the best passage I pick the sentences that match best and highlight them in the reader, with their page or section.' },
    ],
    note: <>The ranking number orders results. It is not a measure of how sure I am.</>,
  },
  {
    id: 'answer', tab: 'Answering', title: 'How I answer a question',
    lede: 'Synthesize asks me to read before I speak. I answer only from passages you have kept, and every claim carries its source.',
    steps: [
      { icon: Search, title: 'I find the evidence first', term: 'Retrieval', body: 'The same search as above picks the four passages that best fit your question, scoped to a collection if you chose one.' },
      { icon: MessageSquareQuote, title: 'I write from those passages only', term: 'Retrieval-augmented generation (RAG)', body: 'A small language model reads the passages and your question, is told to use nothing else, and to number each source it relies on. Text inside your documents is treated as quotation, never as instructions.' },
      { icon: CheckCheck, title: 'I check every citation', term: 'Grounding check', body: 'Each [1], [2] must point to a passage I actually supplied. If the model says the passages do not answer it, I tell you so instead of guessing.' },
      { icon: Layers, title: 'If I cannot write, I quote', term: 'Extractive fallback', body: 'When no writing model is available or a check fails, I hand you the best passages verbatim, still with their pages.' },
    ],
    note: <>Always read the linked passage before you rely on an answer.</>,
  },
  {
    id: 'cloud', tab: 'The building', title: 'Where the library lives',
    lede: 'The same shop runs two ways: on your own computer, or as a private library in the cloud.',
    steps: [
      { icon: HardDrive, title: 'On your computer', term: 'Local mode', body: 'One person, one machine. The database, the passage numbers, your files and the models all stay in the app’s own folder. Only Finder’s online searches leave the machine.' },
      { icon: Cloud, title: 'In the cloud, the front door', term: 'CDN + serverless web', body: 'Pages are served through CloudFront from a Lambda function, so there is no server to keep running between visits.' },
      { icon: KeyRound, title: 'Your key', term: 'Authentication (Cognito)', body: 'You sign in, and your session lives in a secure cookie. Every document, passage and search is tied to your account.' },
      { icon: ServerCog, title: 'The back room', term: 'API + job queue (Lambda, SQS)', body: 'Requests go to an API function. Imports go onto a queue, and a worker function extracts, chunks and embeds them in the background, so a large book never holds up the page.' },
      { icon: Boxes, title: 'The shelves', term: 'Object storage + vector database', body: 'Original files sit in a private S3 bucket. Text and passage numbers sit in Aurora PostgreSQL with pgvector, which finds the nearest meanings quickly.' },
    ],
  },
];

const SECURITY: Record<string, { icon: Icon; text: string }> = {
  gather: { icon: ShieldCheck, text: 'I only fetch from public addresses and never follow a link into a private network.' },
  store: { icon: Lock, text: 'Your passages are filed under your account and only searched for you, or for a friend you lend a collection to.' },
};

export interface GuidesProps { status: Status | null; busy: boolean; paused?: boolean; mode?: string }

/** The two characters at the corner of the page, and the guide sheet each one opens. */
export default function Guides({ status, busy, paused, mode }: GuidesProps) {
  const [open, setOpen] = useState<'finder' | 'keeper' | null>(null);
  const [chapter, setChapter] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const chapters = open === 'finder' ? FINDER : KEEPER;
  const ch = chapters[Math.min(chapter, chapters.length - 1)];
  const cloud = !!status?.auth_required;

  useEffect(() => {
    const d = dialog.current; if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const show = (who: 'finder' | 'keeper', button: HTMLButtonElement) => { opener.current = button; setChapter(0); setOpen(who); };
  const close = () => { setOpen(null); opener.current?.focus(); };
  const finderBusy = busy && mode === 'discover', keeperBusy = busy && mode !== 'discover';

  return <>
    <div className={styles.dock} data-paused={paused || undefined} aria-label="Guides">
      <button className={styles.guide} data-who="finder" data-busy={finderBusy || undefined} aria-haspopup="dialog" onClick={e => show('finder', e.currentTarget)}>
        <FinderFigure size={58} className={styles.finder} />
        <span className={styles.tag}><strong>Finder</strong><small>how gathering works</small></span>
      </button>
      <button className={styles.guide} data-who="keeper" data-busy={keeperBusy || undefined} aria-haspopup="dialog" onClick={e => show('keeper', e.currentTarget)}>
        <KeeperFigure size={72} className={styles.keeper} />
        <span className={styles.tag}><strong>Keeper</strong><small>how storing &amp; search work</small></span>
      </button>
    </div>

    <dialog ref={dialog} className={styles.sheet} data-who={open || undefined} aria-labelledby="guide-title" onCancel={e => { e.preventDefault(); close(); }} onClick={e => { if (e.target === e.currentTarget) close(); }}>
      {open && <div className={styles.sheetInner}>
        <header className={styles.sheetHead}>
          <span className={styles.portrait}>{open === 'finder' ? <FinderFigure size={70} /> : <KeeperFigure size={84} />}</span>
          <div>
            <p className={styles.who}>{open === 'finder' ? 'Finder · the spider who fetches' : 'Keeper · the old archivist'}</p>
            <h2 id="guide-title">{ch.title}</h2>
          </div>
          <button className={styles.close} aria-label="Close guide" onClick={close}><X size={19} /></button>
        </header>

        {chapters.length > 1 && <div className={styles.tabs} role="tablist" aria-label="Chapters">
          {chapters.map((c, i) => <button key={c.id} role="tab" id={`guide-tab-${c.id}`} aria-selected={i === chapter} aria-controls="guide-panel" onClick={() => setChapter(i)}>{c.tab}</button>)}
        </div>}

        <div className={styles.panel} id="guide-panel" role={chapters.length > 1 ? 'tabpanel' : undefined} aria-labelledby={chapters.length > 1 ? `guide-tab-${ch.id}` : undefined} key={`${open}-${ch.id}`}>
          <p className={styles.lede}>“{ch.lede}”</p>
          {ch.id === 'cloud' && status && <p className={styles.here}><i aria-hidden="true" data-cloud={cloud} />This library is running {cloud ? 'as a private cloud library' : 'on this computer'}{status?.embedding_model ? <> · model <code>{status.embedding_model}</code></> : null}</p>}
          <ol className={styles.thread}>
            {ch.steps.map((s, i) => { const I = s.icon; return <li key={s.title} style={{ '--i': i } as CSSProperties} data-here={ch.id === 'cloud' && status ? (i === 0 ? !cloud : cloud) : undefined}>
              <span className={styles.node} aria-hidden="true"><I size={17} /></span>
              <div>
                <h3><span className={styles.stepNo}>{String(i + 1).padStart(2, '0')}</span>{s.title}</h3>
                <span className={styles.term}>{s.term}</span>
                <p>{s.body}</p>
              </div>
            </li>; })}
          </ol>
          {SECURITY[ch.id] && (() => { const S = SECURITY[ch.id]; const I = S.icon; return <p className={styles.note}><I size={15} aria-hidden="true" />{S.text}</p>; })()}
          {ch.note && <p className={styles.note}><Sparkles size={15} aria-hidden="true" />{ch.note}</p>}
          <footer className={styles.sheetFoot}>
            {open === 'finder'
              ? <button className={styles.handoff} onClick={() => { setChapter(0); setOpen('keeper'); }}><KeeperFigure size={30} /> What Keeper does next <ArrowRight size={14} aria-hidden="true" /></button>
              : <button className={styles.handoff} onClick={() => { setChapter(0); setOpen('finder'); }}><FinderFigure size={28} /> How Finder gathers documents <ArrowRight size={14} aria-hidden="true" /></button>}
            {chapters.length > 1 && chapter < chapters.length - 1 && <button className={styles.next} onClick={() => setChapter(chapter + 1)}>Next: {chapters[chapter + 1].tab} →</button>}
          </footer>
        </div>
      </div>}
    </dialog>
  </>;
}
