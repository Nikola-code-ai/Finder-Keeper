'use client';

import { useState } from 'react';
import { KeeperPose, PipPose, SearchSlip, SampleResult, type StudySceneProps } from './shared';
import styles from './window-desk.module.css';

/** The sill is one continuous surface: drawing, input and result share its edge. */
export function RainWindowScene(props: StudySceneProps) {
  const [rain, setRain] = useState(true);
  const [sashOpen, setSashOpen] = useState(false);
  const search = () => { setSashOpen(true); props.onSearch(); };

  return <section className={`${styles.scene} ${styles.windowScene}`} data-paused={props.paused} data-rain={rain} data-open={sashOpen} aria-label="The rain window interactive study">
    <div className={styles.sceneCaption}><span>16:42 / THE READING ROOM</span><span>the rain can wait.</span></div>
    <div className={styles.windowOpening} aria-hidden="true">
      <div className={styles.city}>
        <i/><i/><i/><i/><i/><i/>
      </div>
      <div className={styles.rain} />
      <span className={styles.rainLettering}>shhh…</span>
    </div>
    <div className={styles.windowHeader} aria-hidden="true" />
    <div className={styles.leftJamb} aria-hidden="true" />
    <div className={styles.rightJamb} aria-hidden="true" />
    <div className={styles.backRail} aria-hidden="true" />
    <PipPose active={props.phase === 'searching'} paused={props.paused} height={136} className={styles.windowCat} />
    <div className={styles.mullion} aria-hidden="true"><i/></div>
    <div className={styles.crossBar} aria-hidden="true" />
    <div className={styles.sillTop} aria-hidden="true" />
    <div className={styles.sillFront} aria-hidden="true"><span/><span/></div>
    <div className={styles.sillBrace} aria-hidden="true" />
    <span className={styles.sittingContact} aria-hidden="true" />
    <KeeperPose pose={props.phase === 'idle' ? 'sit' : 'read'} height={340} animated paused={props.paused} className={styles.sillKeeper} />
    <div className={styles.windowNote}><span>“A good place<br/>to get lost.”</span></div>

    <div className={styles.sillSearch}>
      <SearchSlip query={props.query} onQueryChange={props.onQueryChange} onSearch={search} phase={props.phase} label="Leave a question on the sill" />
    </div>

    <div className={styles.windowSash} aria-hidden="true"><span/><span/><span/></div>
    <button className={styles.sashHandle} aria-expanded={sashOpen} aria-controls="window-source" onClick={() => setSashOpen(!sashOpen)}>
      <span className={styles.handleDrawing} aria-hidden="true"/><span>{sashOpen ? 'Close the window' : 'Open the window'}<small>{sashOpen ? 'a page from the outside' : 'there is something outside ↗'}</small></span>
    </button>
    <div id="window-source" className={styles.windowSource} hidden={!sashOpen}>
      <span className={styles.clip} aria-hidden="true" />
      <span className={styles.sourceEyebrow}>{props.phase === 'searching' ? 'PIP IS LOOKING…' : 'CAUGHT ON THE WINDOWSILL'}</span>
      <SampleResult onRead={props.onRead} compact />
    </div>
    <div className={styles.roomFloor} aria-hidden="true" />
    <div className={styles.windowControls}>
      <button onClick={() => setRain(!rain)} aria-pressed={rain}><span aria-hidden="true">{rain ? '⋰' : '☁'}</span>{rain ? 'Let the rain stop' : 'Bring back the rain'}</button>
      <span>{sashOpen ? 'A page, carried in from outside.' : 'Turn the latch. See what arrives.'}</span>
    </div>
  </section>;
}

const drawers = [
  { name: 'Collected', count: '12', title: 'Notes worth keeping', detail: 'Twelve well-thumbed pages. A little disorder, a lot of possibility.' },
  { name: 'Bookmarks', count: '04', title: 'For another afternoon', detail: 'Four passages marked with folded corners, waiting for you.' },
  { name: 'Loose notes', count: '07', title: 'The unfinished thoughts', detail: 'Seven scraps, questions, and things you almost forgot.' },
];

/** A page changes hands before it becomes a reader; the drawers are the navigation. */
export function SharedDeskScene(props: StudySceneProps) {
  const [nudged, setNudged] = useState(false);
  const [unfolded, setUnfolded] = useState(false);
  const [drawer, setDrawer] = useState<number | null>(null);
  const search = () => { setNudged(true); setUnfolded(true); props.onSearch(); };

  return <section className={`${styles.scene} ${styles.deskScene}`} data-paused={props.paused} data-nudged={nudged} data-unfolded={unfolded} aria-label="The shared desk interactive study">
    <div className={styles.sceneCaption}><span>18:06 / THE LAST TABLE</span><span>two heads. one desk.</span></div>
    <div className={styles.wallHatching} aria-hidden="true" />
    <div className={styles.deskWallNote}><span>Nothing good<br/>gets found alone.</span><i aria-hidden="true"/></div>
    <div className={styles.wallShelf} aria-hidden="true"><i/><i/><i/><i/><i/></div>
    <div className={styles.deskFloor} aria-hidden="true" />
    <span className={styles.feetContact} aria-hidden="true" />
    <KeeperPose pose={props.phase !== 'idle' || nudged || unfolded ? 'read' : 'sit'} height={340} animated paused={props.paused} facing="right" className={styles.deskKeeper} />
    <div className={styles.tableLegLeft} aria-hidden="true" />
    <div className={styles.tableLegRight} aria-hidden="true" />
    <div className={styles.tableTop} aria-hidden="true"><span/><span/><span/></div>
    <div className={styles.tableFront} aria-hidden="true" />
    <div className={styles.pencilCup} aria-hidden="true"><i/><i/><i/></div>
    <div className={styles.closedBooks} aria-hidden="true"><span/><span/><span/></div>
    <div className={styles.pipShadow} aria-hidden="true" />
    <PipPose active={nudged || props.phase === 'searching'} paused={props.paused} height={142} className={styles.deskCat} />
    <button className={styles.pipNudge} onClick={() => { setNudged(!nudged); setUnfolded(false); }} aria-pressed={nudged}>
      <span>{nudged ? '“This one.”' : 'Pip has a page.'}</span><small>{nudged ? 'slide it back ↗' : 'ask him to pass it ↙'}</small>
    </button>
    <button className={styles.loosePage} aria-expanded={unfolded} aria-controls="desk-page" onClick={() => { setUnfolded(!unfolded); setNudged(true); }}>
      <span>FIELD NOTES</span><strong>On finding<br/>a little meaning.</strong><i/><i/><i/><small>{unfolded ? 'fold the page ↘' : 'unfold this page ↗'}</small>
    </button>
    {nudged && <span className={styles.nudgeMark} aria-hidden="true">shff</span>}
    <div className={styles.deskSearch}>
      <SearchSlip query={props.query} onQueryChange={props.onQueryChange} onSearch={search} phase={props.phase} label="A question for the desk" />
    </div>

    <div className={styles.deskDrawers} aria-label="Desk drawers">
      {drawers.map((item, index) => <button key={item.name} className={drawer === index ? styles.drawerOpen : ''} onClick={() => setDrawer(drawer === index ? null : index)} aria-expanded={drawer === index} aria-controls="desk-drawer-content">
        <span>{item.name}<small>{item.count}</small></span><i aria-hidden="true"/>
      </button>)}
    </div>
    {drawer !== null && <div id="desk-drawer-content" className={styles.drawerContent}>
      <button className={styles.closeSheet} onClick={() => setDrawer(null)} aria-label="Close drawer">×</button>
      <span>FROM THE {drawers[drawer].name.toUpperCase()} DRAWER</span>
      <strong>{drawers[drawer].title}</strong><p>{drawers[drawer].detail}</p>
      <button className={styles.drawerRead} onClick={props.onRead}>Take a look inside ↗</button>
    </div>}
    <div id="desk-page" className={styles.unfoldedPage} hidden={!unfolded}>
      <button className={styles.closeSheet} onClick={() => setUnfolded(false)} aria-label="Fold the source page">×</button>
      <span className={styles.sourceEyebrow}>{props.phase === 'searching' ? 'LOOKING THROUGH THE PAGES…' : 'PIP THOUGHT YOU MIGHT LIKE THIS'}</span>
      <SampleResult onRead={props.onRead} compact />
    </div>
    <p className={styles.deskFooter} aria-live="polite">{unfolded ? 'The page is yours. Follow the thread.' : nudged ? 'Pip slides the page across. Unfold it to read.' : 'Ask Pip for the paper, or pull open a drawer.'}</p>
  </section>;
}
