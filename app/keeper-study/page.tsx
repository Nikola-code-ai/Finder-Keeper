'use client';

import { useState } from 'react';
import KeeperWorld from '@/components/keeper-world';
import type { KeeperActivity } from '@/lib/keeper-choreography';
import room from '@/components/reading-room.module.css';

/** Local art-direction harness. Its controls never issue library/API requests. */
export default function KeeperStudy() {
  const [activity, setActivity] = useState<KeeperActivity>({ id: 0, operation: 'discover', active: false });
  const [studyTime, setStudyTime] = useState<number | undefined>();
  const [studyPhase, setStudyPhase] = useState<string | undefined>();
  const [paused, setPaused] = useState(false);
  return <main className={room.room} style={{ maxWidth: 1100, margin: '60px auto', padding: '0 50px', color: '#292929' }}>
    <a href="/" style={{ fontSize: 12 }}>← Back to the library</a>
    <h1 style={{ font: '40px var(--serif)', margin: '25px 0 8px' }}>Keeper, between the lines.</h1>
    <p style={{ fontSize: 12, color: '#777' }}>Motion study. These controls exercise the drawings; they do not run searches or change your library.</p>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 24 }}>
      <button className="button secondary" onClick={() => { setStudyPhase(undefined); setStudyTime(undefined); setActivity(a => ({ id: a.id + 1, operation: 'discover', active: true })); }}>Begin looking</button>
      <button className="button secondary" onClick={() => { setStudyPhase(undefined); setStudyTime(undefined); setActivity(a => ({id:a.id+1,operation:'search',active:true})); }}>Search saved documents</button>
      <button className="button secondary" onClick={() => { setStudyPhase(undefined); setStudyTime(undefined); setActivity(a => ({id:a.id+1,operation:'ask',active:true})); }}>Read saved documents</button>
      <button className="button secondary" onClick={() => { setStudyPhase(undefined); setStudyTime(undefined); setActivity(a => ({id:a.id+1,operation:'ask',active:false,outcome:'success'})); }}>Instant answer</button>
      <button className="button secondary" onClick={() => { setStudyPhase(undefined); setStudyTime(undefined); setActivity(a => ({ ...a, active: false, outcome: 'success' })); }}>A result arrives</button>
      <button className="button secondary" onClick={() => { setStudyPhase(undefined); setStudyTime(undefined); setActivity(a => ({ ...a, active: false, outcome: 'empty' })); }}>Empty-handed</button>
      <button className="button secondary" onClick={() => { setStudyPhase(undefined); setStudyTime(undefined); setActivity(a => ({ ...a, active: false, outcome: 'error' })); }}>A snag</button>
      <button className="button secondary" onClick={() => { setStudyPhase(undefined); setStudyTime(undefined); setActivity(a => ({ ...a, active: false, outcome: 'cancelled' })); }}>Cancel</button>
    </div>
    <div style={{ display: 'flex', gap: 15, flexWrap: 'wrap', marginTop: 15, fontSize: 12 }}>
      {([{name:'Open storage',phase:'opening-folder'}, {name:'Rummage in storage',phase:'checking-storage'}, {name:'Read a passage',phase:'reading-passages'}]).map(item => <button key={item.name} onClick={() => {setActivity(a=>({id:a.id+1,operation:'ask',active:true})); setStudyTime(undefined);setStudyPhase(item.phase);}}>{item.name}</button>)}
      {([{ name: 'Gravity drop', phase: 'falling' }, { name: 'Behind the glass', phase: 'searching-behind-glass' }, { name: 'Walking away', phase: 'leaving-page' }, { name: 'Off the page', phase: 'off-page' }]).map(item => <button key={item.name} onClick={() => { setActivity(a => ({ id: a.id + 1, operation: 'discover', active: true })); setStudyTime(undefined); setStudyPhase(item.phase); }}>{item.name}</button>)}
      {([{ name: 'Set up ladder', phase: 'deploying-ladder' }, { name: 'Climb ladder', phase: 'climbing-ladder' }, { name: 'Onto the shelf', phase: 'dismounting-ladder' }]).map(item => <button key={item.name} onClick={() => { setActivity(a => ({ id: a.id + 1, operation: 'discover', active: false, outcome: 'success' })); setStudyTime(undefined); setStudyPhase(item.phase); }}>{item.name}</button>)}
      <label>Timeline seconds <input aria-label="Timeline seconds" type="number" min="0" step="0.25" value={studyTime ?? ''} style={{ width: 65 }} onChange={e => { setStudyPhase(undefined); setStudyTime(e.target.value === '' ? undefined : Number(e.target.value)); }} /></label>
      <button onClick={() => setPaused(value => !value)}>{paused ? 'Resume motion' : 'Pause motion'}</button>
    </div>
    <section style={{ marginTop: 160, width: '58%', minWidth: 240 }}>
      <div data-keeper-anchor="collection:study" className="collection-row" style={{ marginBottom: 24 }}><button className="collection-open"><span className="collection-info"><strong>Unfinished thoughts</strong><small>A place to sit. A place to look.</small></span></button></div>
      <div data-keeper-anchor="collection:notes" className="collection-row"><button className="collection-open"><span className="collection-info"><strong>Loose pages</strong><small>He insists he left it here.</small></span></button></div>
    </section>
    <article data-keeper-anchor="result:study" className="discovery-card" style={{ margin: '90px 0 0 auto', width: '50%', background: 'white', borderColor: '#ddd' }}><h3 style={{ color: '#333' }}>A promising passage</h3><p style={{ color: '#777' }}>A real DOM surface for hand contact and displacement.</p></article>
    <KeeperWorld activity={activity} motionPaused={paused} studyTime={studyTime} studyPhase={studyPhase} />
  </main>;
}
