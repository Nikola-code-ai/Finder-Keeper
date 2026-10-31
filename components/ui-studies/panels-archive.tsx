'use client';

import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { KeeperPose, PipPose, SampleResult, SearchSlip, type StudySceneProps } from './shared';
import styles from './panels-archive.module.css';

const chapters = [
  { name: 'The thing you almost remembered.', caption: 'Somewhere in all these pages, there is a thread.', note: 'A title. A phrase. A half-remembered thought.', mark: '01' },
  { name: 'Follow the smallest detail.', caption: 'A quiet room. An unfinished question.', note: 'Start with the part that stayed with you.', mark: '02' },
  { name: 'Every good find begins somewhere.', caption: 'One more page. There is always something good ahead.', note: 'The Keeper has left a place for your question.', mark: '03' },
];

/** The border is the seat: the drawing and the form share one local coordinate system. */
export function BrokenPanelsScene(props: StudySceneProps) {
  const { paused, phase, query, onQueryChange, onSearch, onRead } = props;
  const [page, setPage] = useState(0);
  const [closeUp, setCloseUp] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const noteId = useId();
  const chapter = chapters[page];
  const searching = phase === 'searching';
  const found = phase === 'found';

  return <div className={`${styles.panelsScene} ${paused ? styles.paused : ''}`} data-stage={phase}>
    <div className={styles.pageHeading}>
      <span>FINDER / KEEPER</span><span>THE QUIET CHAPTER · {chapter.mark}</span>
    </div>
    <div className={styles.panelsCanvas}>
      <section className={styles.openingPanel} aria-label="Opening panel">
        <span className={styles.panelIndex}>I.</span>
        <p className={styles.caption}>{chapter.caption}</p>
        <h2>{searching ? <>Between<br />the lines.</> : found ? <>Ah.<br />Here it is.</> : chapter.name}</h2>
        <span className={styles.horizon} aria-hidden="true" />
        <span className={styles.inkScratch} aria-hidden="true">〰</span>
      </section>

      <section className={`${styles.windowPanel} ${closeUp ? styles.windowClose : ''}`} aria-label="Pip's window panel">
        <span className={styles.panelIndex}>II.</span>
        <div className={styles.windowLines} aria-hidden="true"><i /><i /><i /><i /><i /></div>
        <div className={styles.windowSpeech}>{searching ? '…rustle.' : found ? 'There.' : closeUp ? 'You rang?' : '…'}</div>
        <div className={styles.pipWindow}>
          <span className={styles.pawContact} aria-hidden="true" />
          <PipPose active={searching || found} paused={paused} height={closeUp ? 185 : 116} style={{ left: '51%', top: '100%', zIndex: 3 }} />
          <div className={styles.windowSill} aria-hidden="true" />
        </div>
        <button type="button" className={styles.closeUpButton} onClick={() => setCloseUp(value => !value)} aria-pressed={closeUp}>
          {closeUp ? 'Pull back ↙' : 'A closer look ↗'}
        </button>
      </section>

      <section className={styles.questionPanel} aria-label="The request panel">
        <div className={styles.sittingContact} aria-hidden="true" />
        <KeeperPose pose={searching || found ? 'read' : 'sit'} height={290} paused={paused} animated={searching} className={styles.panelKeeper} style={{ left: 'var(--keeper-x)', top: 0, zIndex: 5 }} />
        <div className={styles.seatEdge} aria-hidden="true" />
        <div className={styles.questionContent}>
          <span className={styles.panelIndex}>III. &nbsp; YOUR PART OF THE STORY</span>
          <h3>{searching ? 'He is following a lead.' : found ? 'A thread worth following.' : 'What are we looking for?'}</h3>
          <p>{chapter.note}</p>
          <SearchSlip query={query} onQueryChange={onQueryChange} onSearch={onSearch} phase={phase} label="Leave your question on the panel" />
        </div>
        <span className={styles.smallHandwritten} aria-hidden="true">take your time.</span>
      </section>

      <section className={`${styles.lastPanel} ${found ? styles.lastPanelFound : ''}`} aria-label="The final panel">
        <span className={styles.panelIndex}>IV.</span>
        {found ? <SampleResult onRead={onRead} compact /> : <>
          <span className={styles.paperCorner} aria-hidden="true" />
          <p className={styles.lastPanelQuote}>{searching ? 'The answer is out there. Give him a moment.' : '“Nothing is really lost. Just waiting on a different shelf.”'}</p>
          <button type="button" className={styles.marginButton} onClick={() => setNoteOpen(value => !value)} aria-expanded={noteOpen} aria-controls={noteId}>{noteOpen ? 'Fold the note −' : 'Unfold the note +'}</button>
          {noteOpen && <p className={styles.unfoldedNote} id={noteId}>Try a subject, a remembered sentence, or simply something you want to understand.</p>}
        </>}
      </section>
    </div>
    <footer className={styles.pageFooter}>
      <span>{found ? 'A small discovery. The story continues.' : searching ? 'A pause between panels…' : 'Read the room. Leave a question.'}</span>
      <button type="button" onClick={() => { setPage(value => (value + 1) % chapters.length); setNoteOpen(false); }} aria-label="Turn to the next illustrated page">Turn the page <span aria-hidden="true">↗</span></button>
    </footer>
  </div>;
}

const drawers = [
  { title: 'In the margins', subtitle: 'Notes & loose thoughts', number: '01', count: '12 fragments', folder: 'A note on paying attention', letter: 'M' },
  { title: 'The long way home', subtitle: 'Essays & stories', number: '02', count: '08 chapters', folder: 'A room of one’s own', letter: 'H' },
  { title: 'Things worth keeping', subtitle: 'Research & discoveries', number: '03', count: '16 discoveries', folder: 'The art of noticing', letter: 'K' },
];

/** Every cabinet owns its actor anchor, top plane, contact mark, and foreground drawer. */
export function ArchiveStepsScene(props: StudySceneProps) {
  const { paused, phase, query, onQueryChange, onSearch, onRead } = props;
  const [selected, setSelected] = useState(1);
  const [opened, setOpened] = useState<number | null>(() => phase === 'idle' ? null : 1);
  const [indexOpen, setIndexOpen] = useState(false);
  const [fileSelected, setFileSelected] = useState(false);
  const [crawling, setCrawling] = useState(false);
  const [crawlX, setCrawlX] = useState(48);
  const [crawlFacing, setCrawlFacing] = useState<'left' | 'right'>('right');
  const [patrolComplete, setPatrolComplete] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const crawlElapsed = useRef(0);
  const previousPhase = useRef(phase);
  const searching = phase === 'searching';
  const found = phase === 'found';

  useEffect(() => {
    if (phase === 'searching' && previousPhase.current !== phase) {
      setOpened(selected);
      setFileSelected(false);
    }
    previousPhase.current = phase;
  }, [phase, selected]);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(preference.matches);
    update();
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!crawling) return;
    if (reducedMotion) {
      setCrawlX(48);
      setCrawling(false);
      setPatrolComplete(true);
      return;
    }
    if (paused) return;
    let frame = 0;
    let previous: number | null = null;
    let lastStep = -1;
    const animate = (now: number) => {
      if (previous !== null) crawlElapsed.current += Math.min(now - previous, 100);
      previous = now;
      // Twelve held positions per second match the deliberately drawn gait.
      const step = Math.floor(crawlElapsed.current / (1000 / 12));
      if (step !== lastStep) {
        lastStep = step;
        const distance = Math.min(88, (step / 12 / 4.8) * 88);
        const x = distance <= 22 ? 48 + distance : distance <= 66 ? 70 - (distance - 22) : 26 + (distance - 66);
        setCrawlX(x);
        setCrawlFacing(distance > 22 && distance < 66 ? 'left' : 'right');
      }
      if (crawlElapsed.current >= 4800) {
        setCrawlX(48);
        setCrawlFacing('right');
        setCrawling(false);
        setPatrolComplete(true);
      } else frame = window.requestAnimationFrame(animate);
    };
    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, [crawling, paused, reducedMotion]);

  const followThread = () => {
    if (crawling) return;
    setPatrolComplete(false);
    crawlElapsed.current = 0;
    setCrawlX(48);
    setCrawlFacing('right');
    if (reducedMotion) setPatrolComplete(true);
    else setCrawling(true);
  };
  const toggleDrawer = (index: number) => {
    if (crawling) return;
    setSelected(index);
    setOpened(value => value === index ? null : index);
    setFileSelected(false);
    setPatrolComplete(false);
  };

  return <div className={`${styles.archiveScene} ${paused ? styles.paused : ''}`} data-stage={phase}>
    <div className={styles.archiveMasthead}><span>FINDER / KEEPER</span><span>THE WEB ARCHIVE</span></div>
    <div className={styles.archiveCanvas}>
      <header className={styles.archiveHeading}>
        <span className={styles.archiveEyebrow}>GOOD THINGS ARE CONNECTED</span>
        <h2>A web of<br /><em>wonderful things.</em></h2>
        <p>Pull a drawer. Follow a thread.</p>
      </header>
      <div className={styles.archiveSearch}>
        <SearchSlip query={query} onQueryChange={onQueryChange} onSearch={() => { followThread(); onSearch(); }} phase={phase} label="Ask the Keeper to look" />
      </div>
      <div className={styles.wallRuling} aria-hidden="true"><span>ONE VERY WELL-CONNECTED LIBRARIAN</span><i /><i /></div>
      <div className={styles.archiveAside}>{crawling ? <>“Eight legs.<br />One good lead.”</> : searching ? <>“Eight legs.<br />I’ll find it!”</> : found ? <>“Caught a good one.<br />Come and see.”</> : <>“Follow my thread.<br />It leads somewhere good.”</>}</div>

      <div className={`${styles.indexBox} ${indexOpen ? styles.indexOpen : ''}`}>
        <span className={styles.indexTop} aria-hidden="true" />
        <span className={styles.indexContact} aria-hidden="true" />
        <PipPose active={indexOpen || searching} paused={paused} height={72} style={{ left: '50%', top: 0, zIndex: 4 }} />
        <button type="button" onClick={() => setIndexOpen(value => !value)} aria-expanded={indexOpen} className={styles.indexButton}>
          <span>A — Z</span><small>{indexOpen ? 'Close index −' : 'Pip’s index +'}</small>
        </button>
        {indexOpen && <div className={styles.indexCards}>
          {drawers.map((drawer, index) => <button key={drawer.letter} type="button" disabled={crawling} onClick={() => { setSelected(index); setOpened(index); setIndexOpen(false); setPatrolComplete(false); }} aria-label={`Find ${drawer.title}`}>{drawer.letter}<span>{drawer.title}</span></button>)}
        </div>}
      </div>

      <div className={styles.cabinetFloor} aria-hidden="true" />
      <div className={styles.cabinetRow}>
        {drawers.map((drawer, index) => {
          const isSelected = selected === index;
          const isOpen = opened === index;
          return <section key={drawer.number} className={`${styles.cabinet} ${styles[`cabinet${index}`]} ${isSelected ? styles.selectedCabinet : ''} ${isOpen ? styles.openCabinet : ''}`} style={{ '--spider-x': `${crawlX}%` } as CSSProperties} aria-label={`${drawer.title} collection`}>
            <div className={styles.cabinetTop} aria-hidden="true" />
            <svg className={styles.cabinetWeb} viewBox="0 0 100 80" preserveAspectRatio="none" aria-hidden="true">
              <path d="M1 79Q49 13 99 79M1 79L49 2L99 79M1 79L99 79M49 2L49 79M1 79L73 41M99 79L25 41M13 61Q49 30 87 61M7 70Q49 47 93 70M25 41Q49 23 73 41" />
              <circle cx="1" cy="79" r="1.1" /><circle cx="99" cy="79" r="1.1" />
            </svg>
            {isSelected && <>
              <span className={styles.cabinetContact} aria-hidden="true" />
              <KeeperPose pose={crawling ? 'walk' : searching || isOpen ? 'read' : 'sit'} height={195} facing={crawlFacing} paused={paused} animated={crawling || searching} className={styles.archiveKeeper} style={{ left: 'var(--spider-x)', top: 0, zIndex: 5 }} />
              <span className={styles.cabinetSeatLip} aria-hidden="true" />
              <svg className={styles.spiderLine} viewBox="0 0 100 80" preserveAspectRatio="none" aria-hidden="true"><path d={`M${crawlX} 0Q58 17 50 58M${crawlX} 0Q28 9 1 0M${crawlX} 0Q73 16 99 0`} /></svg>
            </>}
            {isOpen && <div className={styles.openFiles} aria-hidden="true"><i /><i /><i /><span>{searching ? 'RUSTLE…' : 'SHH—K'}</span></div>}
            <div className={styles.drawerFront}>
              <span className={styles.drawerNumber}>{drawer.number}</span>
              <button type="button" className={styles.drawerHandle} disabled={crawling} onClick={() => toggleDrawer(index)} aria-expanded={isOpen} aria-label={`${isOpen ? 'Close' : 'Open'} ${drawer.title} drawer`}>
                <span className={styles.labelHolder}>{drawer.title}</span>
                <span className={styles.metalHandle} aria-hidden="true" />
              </button>
              <p>{drawer.subtitle}</p>
              <span className={styles.drawerCount}>{drawer.count}</span>
              {isOpen && <div className={styles.drawerContents}>
                <button type="button" onClick={() => { setFileSelected(true); onRead(); }} className={styles.folderButton}>
                  <span aria-hidden="true">↳</span><span>{found && isSelected ? 'Your found document' : drawer.folder}</span><span aria-hidden="true">↗</span>
                </button>
                <span className={styles.folderHint}>{fileSelected && isSelected ? 'Opened at the reading table.' : searching && isSelected ? 'The Keeper is checking the files…' : 'Take a page to the reading table.'}</span>
              </div>}
            </div>
            <span className={styles.cabinetSide} aria-hidden="true" />
          </section>;
        })}
      </div>
      <span className={styles.floorCaption}>a little silk. a lot of possibilities.</span>
    </div>
    <footer className={styles.archiveFooter}>
      <span role="status" aria-live="polite">{crawling ? paused ? 'Patrol paused on the drawer edge.' : 'Following the edge, one step at a time.' : patrolComplete ? reducedMotion ? 'The thread leads back to this drawer.' : 'A complete patrol. Back at the drawer.' : found ? 'A discovery, filed within reach.' : 'Every drawer has a story.'}</span>
      <button type="button" className={styles.patrolButton} onClick={followThread} disabled={crawling}>{crawling ? paused ? 'Patrol paused' : 'Following the thread…' : 'Follow the thread ↝'}</button>
    </footer>
  </div>;
}
