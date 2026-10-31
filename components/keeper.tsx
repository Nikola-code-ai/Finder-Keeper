'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Moon, Sparkles } from 'lucide-react';
type Sequence = { frames: string[]; fps: number; loop?: boolean };
type Manifest = { width: number; height: number; sequences: Record<string, Sequence>; box?: string | { src: string }; anchor?: { x: number; y: number } };
type Phase = 'idle' | 'stand' | 'walkAway' | 'away' | 'walkBack' | 'sit';
export default function Keeper({ active, stage, onExample }: { active: boolean; stage: string; onExample: () => void }) {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [reduced, setReduced] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const actor = useRef<HTMLImageElement>(null);
  const activeRef = useRef(active);
  const phaseRef = useRef<Phase>('idle');
  const imagesRef = useRef<Map<string, HTMLImageElement>>(new Map());
  useEffect(() => { activeRef.current = active; }, [active]);
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches); update();
    media.addEventListener('change', update);
    let disposed = false;
    fetch('/character/manifest.json').then(r => r.ok ? r.json() : null).then(async value => {
      if (!value || disposed) return;
      const urls = [...new Set(Object.values(value.sequences as Record<string, Sequence>).flatMap(s => s.frames))];
      await Promise.all(urls.map(src => new Promise<void>(resolve => {
        const img = new Image(); img.src = src; imagesRef.current.set(src, img);
        img.onload = () => resolve(); img.onerror = () => resolve();
      })));
      if (!disposed) setManifest(value);
    }).catch(() => {});
    return () => { disposed = true; media.removeEventListener('change', update); };
  }, []);
  useEffect(() => {
    if (!manifest || reduced) return;
    let frameRequest = 0, start = performance.now(), lastSource = '';
    const transition = (next: Phase, now: number) => { phaseRef.current = next; setPhase(next); start = now; };
    const render = (now: number) => {
      const image = actor.current;
      let current = phaseRef.current;
      if (current === 'idle' && activeRef.current) { transition('stand', now); current = 'stand'; }
      if (current === 'away' && !activeRef.current) { transition('walkBack', now); current = 'walkBack'; }
      const elapsed = (now - start) / 1000;
      const sequence = manifest.sequences[current === 'away' ? 'walkAway' : current];
      if (image && sequence?.frames.length) {
        const index = Math.floor(elapsed * sequence.fps);
        const src = sequence.frames[sequence.loop || current === 'idle' || current.startsWith('walk') ? index % sequence.frames.length : Math.min(index, sequence.frames.length - 1)];
        if (src !== lastSource) { image.src = src; lastSource = src; }
        let travel = 0;
        if (current === 'walkAway') travel = Math.min(1, elapsed / 2.7);
        if (current === 'walkBack') travel = Math.max(0, 1 - elapsed / 2.7);
        if (current === 'away') travel = 1;
        const scale = 1 - travel * .76;
        image.style.transform = `translate(${travel * 350}px, ${travel * -120}px) scale(${scale})`;
        image.style.opacity = current === 'away' ? '0' : String(travel > .91 ? (1 - travel) / .09 : 1);
        if (current === 'stand' && elapsed >= sequence.frames.length / sequence.fps) transition('walkAway', now);
        if (current === 'walkAway' && elapsed >= 2.7) transition('away', now);
        if (current === 'walkBack' && elapsed >= 2.7) transition('sit', now);
        if (current === 'sit' && elapsed >= sequence.frames.length / sequence.fps) transition('idle', now);
      }
      frameRequest = requestAnimationFrame(render);
    };
    frameRequest = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frameRequest);
  }, [manifest, reduced]);
  const hasFrames = manifest && !reduced;
  const boxSrc = typeof manifest?.box === 'string' ? manifest.box : manifest?.box?.src || '/character/box.png';
  return <aside className="keeper-panel" aria-label="Your document-finding companion">
    <div className="keeper-intro"><span className="eyebrow"><span className="tiny-star">✳</span> A LITTLE HELP FROM YOUR KEEPER</span>
      <h2>You bring the curiosity.<br /><em>He’ll do the looking.</em></h2>
      <p>Good things are out there. Let’s find yours.</p>
    </div>
    <div className={`keeper-scene ${active ? 'is-working' : ''}`} data-phase={phase}>
      <div className="scene-orbit" /><div className="scene-floor" />
      <div className="keeper-illustration">
        {hasFrames ? <><img className="keeper-box" src={boxSrc} alt="" /><img ref={actor} className="keeper-actor" src={manifest.sequences.idle.frames[0]} alt="Your Keeper, an ink-drawn man in a rumpled suit" /></> : <img className="keeper-hero" src="/character/seated.webp" alt="Your Keeper: a tired manga librarian in a rumpled suit, resting on a wooden box" />}
      </div>
      <div className={`keeper-note ${active ? 'working-note' : ''}`}><span className="note-star">✧</span><span>{active ? stage || 'Out following a lead…' : '“Alright. What are we looking for?”'}</span></div>
      <span className="scene-coordinate">EST. 2026 / ALWAYS CURIOUS</span>
    </div>
    <button className="keeper-suggestion" onClick={onExample}><span className="suggestion-icon"><Sparkles size={17} /></span><span><small>A LITTLE INSPIRATION</small><strong>Find something worth getting lost in</strong></span><ArrowUpRight size={18} /></button>
    <div className="keeper-rest"><Moon size={12} /><span>{active ? 'On the trail. You can keep browsing.' : 'Currently taking a very well-earned break.'}</span></div>
  </aside>;
}
