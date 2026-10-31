'use client';

import { useState } from 'react';
import { ChevronDown, FolderOpen } from 'lucide-react';
import SpiderLookout from '../spider-lookout';
import { KeeperPose, SampleResult, SearchSlip, type StudySceneProps } from './shared';
import s from './ledge.module.css';

export default function LedgeScene(props: StudySceneProps) {
  const [drawer, setDrawer] = useState<number | null>(null);
  const [spiderNote, setSpiderNote] = useState(false);
  const collections = ['Things worth keeping', 'Unfinished thoughts', 'A little inspiration'];
  return <section className={s.scene} data-paused={props.paused} data-phase={props.phase} aria-label="The bookseller’s ledge concept">
    <div className={s.number} aria-hidden="true">01</div>
    <div className={s.intro}><span>THE LITTLE BOOKSHOP AT THE EDGE OF THE PAGE</span><h2>There’s a story<br />in here, somewhere.</h2><p>Take your time. We’ll find it together.</p></div>
    <div className={s.wall} aria-hidden="true"><i /><i /><i /></div>
    <div className={s.ledge}>
      <span className={s.contact} aria-hidden="true" />
      <KeeperPose height={290} pose={props.phase === 'idle' ? 'sit' : 'read'} className={s.keeper} style={{ left: '72%', top: 0 }} paused={props.paused} />
      <span className={s.speech}>{props.phase === 'searching' ? 'Ah, let me see…' : props.phase === 'found' ? 'This one, perhaps?' : 'A good place to start.'}</span>
      <div className={s.counter}><span className={s.counterEdge} aria-hidden="true" /><div className={s.searchArea}><SearchSlip {...props} label="Leave a thought on the counter" /></div><span className={s.counterNumber}>NO. 001</span></div>
      <div className={s.paperTray}>{props.phase === 'found' ? <SampleResult onRead={props.onRead} /> : <span>{props.phase === 'searching' ? 'The bookseller turns a page. The spider keeps watch.' : 'A little room for your next discovery.'}</span>}</div>
    </div>
    <div className={s.lower}>
      <div className={s.drawers}><div className={s.sectionLabel}>THE THINGS YOU KEEP <span>3 collections</span></div>
        {collections.map((name, index) => <div key={name} className={s.drawer} data-open={drawer === index}>
          <button className={s.drawerFace} onClick={() => setDrawer(drawer === index ? null : index)} aria-expanded={drawer === index}><span className={s.handle} aria-hidden="true" /><span><strong>{name}</strong><small>{[8, 5, 12][index]} sample pages</small></span><ChevronDown size={16} /></button>
          {drawer === index && <div className={s.drawerInside}><SampleResult compact onRead={props.onRead} /><span>Pull out a page to read it.</span></div>}
        </div>)}
      </div>
      <div className={s.spiderShelf}>
        <SpiderLookout active={false} paused={props.paused} onExplore={() => setSpiderNote(value => !value)} />
        {spiderNote && <button className={s.spiderNote} onClick={props.onRead}><FolderOpen size={14}/> A sample page, caught in a thread.</button>}
      </div>
    </div>
    <div className={s.footer}><span>INK, PAPER & A LITTLE PATIENCE</span><span>{drawer !== null ? 'Close a drawer by its handle.' : 'Try the search, a drawer handle, or the spider’s sign.'}</span></div>
  </section>;
}
