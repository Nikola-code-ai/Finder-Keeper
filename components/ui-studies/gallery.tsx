'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Download, Pause, Play, RotateCcw, SlidersHorizontal } from 'lucide-react';
import Dialog from '../dialog';
import LedgeScene from './ledge';
import { BrokenPanelsScene, ArchiveStepsScene } from './panels-archive';
import { RainWindowScene, SharedDeskScene } from './window-desk';
import { CharacterProvider, type CharacterId, type StudyPhase, type StudySceneProps } from './shared';
import s from './gallery.module.css';

const studies = [
  { id: 'ledge', title: 'The bookseller’s ledge', short: 'The ledge', character: 'bookseller' as CharacterId, person: 'The happy bookseller', subtitle: 'A warm welcome. A solid place to sit.', description: 'The search bar becomes a shop counter. The bookseller sits directly on its inked edge, his legs hanging over the face. The spider keeps watch from a little lost-and-found window, with silk tied to its frame.', try: 'Type a thought, pull a collection drawer, then follow the thread or visit the spider’s sign.', features: ['Bookseller’s warmth', 'Search counter & hanging legs', 'Pull-out collection drawers', 'Pip’s lost-and-found window'], tradeoff: 'The clearest everyday layout. It needs a little clear space above the counter for the character.', Scene: LedgeScene },
  { id: 'panels', title: 'The page between pages', short: 'The panels', character: 'wanderer' as CharacterId, person: 'The curious old wanderer', subtitle: 'The interface is a page you can step into.', description: 'An old wanderer rests across a manga-panel border. Search becomes a small story told in four panels; Pip gets his own close-up, and the gutter becomes a real ledge.', try: 'Turn the page, take a closer look at Pip, and leave a question in panel III.', features: ['Wanderer’s curiosity', 'Characters breaking panel borders', 'Search told across four panels', 'Pip’s close-up & folded notes'], tradeoff: 'The strongest manga-page feeling. The narrative panels take more space than a compact library view.', Scene: BrokenPanelsScene },
  { id: 'web', title: 'The well-connected archive', short: 'The web', character: 'spider' as CharacterId, person: 'The spider librarian', subtitle: 'A little silk. A lot of possibilities.', description: 'A spectacled spider tends a web of discoveries. The collections are physical drawers, silk meets their corners, and Pip looks after the index.', try: 'Follow the thread, open the drawer handles, or ask Pip’s alphabetical index.', features: ['Spider librarian character', 'Silk threads as connections', 'Stepped archive drawers', 'Pip’s physical index'], tradeoff: 'The most distinctive guide to the web. Best as an optional companion for people who like spiders.', Scene: ArchiveStepsScene },
  { id: 'window', title: 'The rain-window reading room', short: 'The window', character: 'mage' as CharacterId, person: 'The kindly archivist mage', subtitle: 'A quiet world, with room for wonder.', description: 'The mage sits on a deep windowsill with his book. The search lives in the sill, Pip peers through the frame, and the latch opens a page from the outside.', try: 'Turn the latch, stop the rain, and leave a question on the sill.', features: ['Mage’s quiet wisdom', 'Deep sill & foreground overlap', 'Rain and window atmosphere', 'Latch revealing a source'], tradeoff: 'The most atmospheric reading space. The dark window asks for more visual attention.', Scene: RainWindowScene },
  { id: 'desk', title: 'A table for two', short: 'The desk', character: 'inventor' as CharacterId, person: 'The absent-minded inventor', subtitle: 'A small discovery, passed from paw to hand.', description: 'A cheerful inventor sits on the desk corner. Pip slides a note toward him, a paper unfolds into a result, and the collection tabs are the desk’s drawers.', try: 'Ask Pip to pass the page, unfold it, and try each desk drawer.', features: ['Inventor’s playful warmth', 'Shared desk & seated corner', 'Pip passing a physical page', 'Paper unfolding into a result'], tradeoff: 'The strongest teamwork between the two characters. Keep the choreography brief for repeated searches.', Scene: SharedDeskScene },
];
type Choices = Record<string, string[]>;
const storageKey = 'finder-keeper-ui-studies-v1';
// The original feature string is a saved-choice key; only its label changes.
const featureLabel = (studyId: string, feature: string) => studyId === 'ledge' && feature === 'Pip’s lost-and-found window' ? 'Spider’s lost-and-found window' : feature;

export default function UIStudies() {
  const [selected, setSelected] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [phase, setPhase] = useState<StudyPhase>('idle');
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [choices, setChoices] = useState<Choices>({});
  const [notes, setNotes] = useState('');
  const [ready, setReady] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [showChoices, setShowChoices] = useState(false);
  const [reader, setReader] = useState(false);
  const [reset, setReset] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const study = studies[selected];
  const count = Object.values(choices).reduce((total, list) => total + list.length, 0);

  const resetScene = useCallback(() => {
    clearTimeout(timer.current); setPhase('idle'); setQuery(''); setSubmitted(''); setReader(false); setReset(value => value + 1);
  }, []);
  const choose = useCallback((index: number) => {
    setSelected(index); resetScene(); window.history.replaceState(null, '', `#${studies[index].id}`);
  }, [resetScene]);

  useEffect(() => {
    const readHash = () => { const index = studies.findIndex(item => `#${item.id}` === window.location.hash); if (index >= 0) { setSelected(index); resetScene(); } };
    readHash(); window.addEventListener('hashchange', readHash);
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches); update(); media.addEventListener('change', update);
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
      const valid: Choices = {};
      for (const item of studies) if (Array.isArray(saved.choices?.[item.id])) valid[item.id] = item.features.filter(feature => saved.choices[item.id].includes(feature));
      setChoices(valid); if (typeof saved.notes === 'string') setNotes(saved.notes.slice(0, 3000));
    } catch { setStorageAvailable(false); }
    setReady(true);
    return () => { clearTimeout(timer.current); window.removeEventListener('hashchange', readHash); media.removeEventListener('change', update); };
  }, [resetScene]);
  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(storageKey, JSON.stringify({ choices, notes })); } catch { setStorageAvailable(false); }
  }, [choices, notes, ready]);

  const search = () => {
    if (!query.trim() || phase === 'searching') return;
    clearTimeout(timer.current); setSubmitted(query.trim()); setPhase('searching');
    // This intentionally runs a scripted sample; no library or search service is called.
    timer.current = setTimeout(() => setPhase('found'), 2800);
  };
  const play = () => {
    clearTimeout(timer.current); const text = query.trim() || 'The small art of noticing';
    setQuery(text); setSubmitted(text); setPhase('searching'); timer.current = setTimeout(() => setPhase('found'), 2800);
  };
  const toggleFeature = (feature: string) => setChoices(previous => {
    const list = previous[study.id] || [];
    return { ...previous, [study.id]: list.includes(feature) ? list.filter(value => value !== feature) : [...list, feature] };
  });
  const download = () => {
    const text = ['Finder Keeper — my mix of ideas', '', ...studies.flatMap(item => (choices[item.id]?.length ? [`${item.title} / ${item.person}`, ...choices[item.id].map(feature => `- ${featureLabel(item.id, feature)}`), ''] : [])), 'My notes', notes || '(No notes yet)'].join('\n');
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'finder-keeper-my-choices.txt'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const sceneProps: StudySceneProps = { paused: paused || reduced, phase, query, onQueryChange: setQuery, onSearch: search, onRead: () => setReader(true) };
  const Scene = study.Scene;

  return <main className={s.gallery}>
    <header className={s.masthead}><a href="/" className={s.brand}>Finder <em>Keeper</em><span>THE DRAWING ROOM</span></a><a href="/" className={s.back}><ArrowLeft size={14} /> Back to the library</a></header>
    <div className={s.heading}><div><span className={s.eyebrow}>FIVE WORLDS / FIVE COMPANIONS / ONE CURIOUS CAT</span><h1>A place between<br /><em>ink and interaction.</em></h1></div><div className={s.introduction}><p>Five ways to inhabit the page.</p><p>Try the little moments. Keep the pieces you love.<br />We’ll make the final world from your favourites.</p><span>PLAYABLE STUDIES · SAMPLE CONTENT</span></div></div>
    <nav className={s.tabs} aria-label="Choose a design study">{studies.map((item, index) => <button key={item.id} type="button" aria-current={index === selected ? 'page' : undefined} onClick={() => choose(index)}><span>0{index + 1}</span><strong>{item.short}</strong><small>{item.person.replace('The ', '')}</small>{!!choices[item.id]?.length && <i aria-label="Has saved choices">●</i>}</button>)}</nav>
    <div className={s.studyHeader}><div><span className={s.studyNo}>STUDY 0{selected + 1}</span><h2>{study.title}</h2></div><div className={s.controls}><button onClick={play} disabled={phase === 'searching'}><Play size={12}/><span>Play a search</span></button><button onClick={() => setPaused(value => !value)} aria-pressed={paused || reduced} disabled={reduced} aria-label={reduced ? 'Motion reduced by system preference' : paused ? 'Resume animation' : 'Pause animation'}>{paused || reduced ? <Play size={13}/> : <Pause size={13}/>}<span>{reduced ? 'Reduced motion' : paused ? 'Resume' : 'Pause'}</span></button><button onClick={resetScene} aria-label="Reset this study"><RotateCcw size={13}/></button></div></div>
    <div className={s.stage} id="study-stage"><CharacterProvider character={study.character}><Scene key={`${study.id}-${reset}`} {...sceneProps} /></CharacterProvider></div>
    <div className={s.sceneStatus} role="status" aria-live="polite"><span>{phase === 'searching' ? `Playing the search interaction for “${submitted}”…` : phase === 'found' ? 'Sample page ready. Open it in the scene to try the reader.' : study.try}</span><span>{phase === 'idle' ? 'DEMO ROOM' : 'SCRIPTED EXAMPLE · NO LIVE SEARCH'}</span></div>
    <section className={s.notesGrid} aria-label="Review this direction"><div className={s.direction}><span className={s.eyebrow}>THE IDEA</span><h3>{study.subtitle}</h3><p>{study.description}</p><p className={s.tradeoff}><strong>Consideration</strong>{study.tradeoff}</p></div><div className={s.favourites}><span className={s.eyebrow}>TAKE SOMETHING FROM THIS WORLD</span><h3>Keep the parts you like.</h3><div className={s.featureList}>{study.features.map(feature => <label key={feature}><input type="checkbox" checked={choices[study.id]?.includes(feature) || false} onChange={() => toggleFeature(feature)}/><span className={s.checkmark}><Check size={13}/></span><span>{featureLabel(study.id, feature)}</span></label>)}</div></div></section>
    <section className={s.notebook}><label htmlFor="mix-notes">A note for the final version</label><textarea id="mix-notes" value={notes} maxLength={3000} onChange={event => setNotes(event.target.value)} placeholder="For example: the bookseller, the panel borders from 02, and Pip passing the paper from 05…"/><div><span>{storageAvailable ? 'Your choices stay in this browser.' : 'Browser saving unavailable. Download your choices before leaving.'}</span><button onClick={() => setShowChoices(true)}><SlidersHorizontal size={14}/> My mix of ideas <b>{count}</b><ArrowRight size={14}/></button></div></section>
    <footer className={s.pageFooter}><span>ROUGH INK. REAL CONTACT. A LITTLE LIFE.</span><button onClick={() => choose((selected + 1) % studies.length)}>Next little world <ArrowRight size={14}/></button></footer>

    {showChoices && <Dialog title="Your mix of ideas" onClose={() => setShowChoices(false)}><div className={s.choiceSummary}>{count === 0 ? <p>Tick the features beneath each scene to build your own combination.</p> : studies.filter(item => choices[item.id]?.length).map(item => <section key={item.id}><h3>{item.title}</h3><ul>{choices[item.id].map(feature => <li key={feature}>{featureLabel(item.id, feature)}</li>)}</ul></section>)}{notes && <section><h3>Your note</h3><p>{notes}</p></section>}<p className={s.summaryHint}>Nothing is sent automatically. Download this list or tell me which pieces to combine.</p><button onClick={download} className={s.download}><Download size={15}/> Download my choices</button></div></Dialog>}
    {reader && <Dialog title="The small art of noticing" onClose={() => setReader(false)}><article className={s.reader}><span>AN ILLUSTRATIVE PAGE · WRITTEN FOR THIS UI STUDY</span><p>At the edge of the room there was a shelf that no one ever checked. It held the things that did not quite fit: a folded map, an unfinished sentence, a leaf pressed between two pages.</p><p>The bookseller called it the beginning.</p><p>“You don’t always need to know what you’re looking for,” he said. “Sometimes you only need to leave a little room to notice it.”</p><p>The cat, who had understood this for years, put a paw on the next page.</p><button onClick={() => setReader(false)}>Back to the room <ArrowRight size={14}/></button></article></Dialog>}
  </main>;
}
