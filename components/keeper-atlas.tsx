'use client';

import { useEffect, useRef, useState } from 'react';
import type { KeeperActivity, KeeperOperation } from '@/lib/keeper-choreography';
import { advanceClerkClock, clerkAnimationFrame, CLERK_PHASE_LABELS, startClerkClock, syncClerkClock, type ClerkAnimationPhase } from '@/lib/clerk-animation';

interface Clip { src: string; frames: number; columns: number; rows: number; durationMs: number; loop: boolean }
export type ClipName = ClerkAnimationPhase | 'greet' | 'web-return' | 'web-settle';
export interface KeeperManifest {
  version: number; frameWidth: number; frameHeight: number; fps: number; poster: string;
  /** The character crop's box inside the room frame, as fractions of its width and height. */
  box: [number, number, number, number];
  phases: Record<string, Clip>;
  landmarks: Record<string, unknown>;
}
export interface MotionPreview { operation: KeeperOperation; run: number }
const ROOT = '/herbarium/';

/**
 * The modelled Keeper and his spider, rendered in Blender as alpha atlases and drawn into one canvas
 * placed over the room at the manifest's box. The request lifecycle drives which clip plays; nothing
 * here owns request state. On arrival he looks up from the register once (the greet clip), then idles.
 */
export default function KeeperAtlas({ activity, paused, reducedMotion, preview, manifest }: {
  activity: KeeperActivity; paused: boolean; reducedMotion: boolean; preview: MotionPreview | null; manifest: KeeperManifest | null;
}) {
  const effectiveActivity: KeeperActivity = preview ? { id: -preview.run - 1, operation: preview.operation, active: true } : activity;
  const clock = useRef(startClerkClock(effectiveActivity));
  const [frame, setFrame] = useState(() => clerkAnimationFrame(clock.current, reducedMotion));
  const [greeting, setGreeting] = useState(true);
  const greetStart = useRef<number | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const images = useRef(new Map<string, HTMLImageElement>());
  const [loaded, setLoaded] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    clock.current = syncClerkClock(clock.current, effectiveActivity);
    if (!paused || reducedMotion) setFrame(clerkAnimationFrame(clock.current, reducedMotion));
    if (effectiveActivity.active) setGreeting(false);
  }, [effectiveActivity.id, effectiveActivity.operation, effectiveActivity.active, effectiveActivity.outcome, reducedMotion, paused]);

  useEffect(() => {
    if (paused || reducedMotion) return;
    let handle = 0, previous = 0;
    const tick = (now: number) => {
      if (document.hidden) previous = 0;
      else if (!previous) previous = now;
      else if (now - previous >= 1000 / 24) {
        clock.current = advanceClerkClock(clock.current, Math.min((now - previous) / 1000, 0.1));
        if (preview && clock.current.elapsed >= 6 && clock.current.completionAt === null) clock.current = { ...clock.current, completionAt: 6, outcome: 'success' };
        setFrame(clerkAnimationFrame(clock.current));
        previous = now;
      }
      handle = requestAnimationFrame(tick);
    };
    handle = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(handle);
  }, [paused, reducedMotion, preview?.run]);

  const webEnding = frame.phase === 'present' ? 'web-return' : frame.phase === 'error' || frame.phase === 'cancelled' ? 'web-settle' : null;
  const clipName: ClipName = greeting && !reducedMotion && frame.phase === 'idle' && manifest?.phases.greet ? 'greet' : effectiveActivity.operation === 'discover' && webEnding && manifest?.phases[webEnding] ? webEnding : frame.phase;

  // Keep the current clip, the idle, and the next likely one decoded; drop the rest so decoded pixels stay bounded.
  useEffect(() => {
    if (!manifest) return;
    const next: ClipName = frame.phase === 'walk' ? 'documents' : frame.phase === 'dispatch' ? 'web' : frame.phase === 'documents' ? 'return' : frame.phase === 'web' ? 'web-return' : 'idle';
    const wanted = new Set<ClipName>(['idle', clipName, next]);
    const sources = new Set([...wanted].map(name => manifest.phases[name]?.src));
    for (const [source, image] of images.current) { if (!sources.has(source)) { image.onload = null; image.onerror = null; images.current.delete(source); } }
    for (const name of wanted) {
      const clip = manifest.phases[name]; if (!clip || images.current.has(clip.src)) continue;
      const image = new Image(); images.current.set(clip.src, image);
      image.onload = () => { setLoaded(v => v + 1); setFailed(false); };
      image.onerror = () => { images.current.delete(clip.src); if (name === clipName) setFailed(true); };
      image.src = clip.src;
    }
  }, [manifest, frame.phase, clipName]);

  useEffect(() => {
    const el = canvas.current; if (!el || !manifest) return;
    const clip = manifest.phases[clipName]; const image = clip && images.current.get(clip.src);
    const ctx = el.getContext('2d'); if (!ctx) return;
    if (!image || !image.complete || !image.naturalWidth) return;
    let index: number;
    if (clipName === 'greet') {
      if (greetStart.current === null) greetStart.current = performance.now();
      const t = (performance.now() - greetStart.current) / clip.durationMs;
      index = Math.min(clip.frames - 1, Math.floor(t * clip.frames));
      if (t >= 1.15) setGreeting(false);
    } else {
      const t = frame.time * 1000 / clip.durationMs;
      index = clip.loop ? Math.floor((t % 1) * clip.frames) : Math.min(clip.frames - 1, Math.floor(t * clip.frames));
    }
    const { frameWidth: w, frameHeight: h } = manifest;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(image, (index % clip.columns) * w, Math.floor(index / clip.columns) * h, w, h, 0, 0, w, h);
  }, [manifest, clipName, frame.time, loaded, greeting]);

  const box = manifest?.box ?? [0.2, 0.1, 0.8, 0.9];
  return <div data-keeper-atlas data-phase={frame.phase} data-clip={clipName} role="img" aria-label={`The Keeper, across his counter. ${CLERK_PHASE_LABELS[frame.phase]}`}
    style={{ position: 'absolute', left: `${box[0] * 100}%`, top: `${box[1] * 100}%`, width: `${(box[2] - box[0]) * 100}%`, height: `${(box[3] - box[1]) * 100}%` }}>
    {/* The poster holds his place until the first atlas has decoded. */}
    {manifest && loaded === 0 && <img src={manifest.poster} alt="" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />}
    <canvas ref={canvas} width={manifest?.frameWidth ?? 1} height={manifest?.frameHeight ?? 1} aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }} />
    {failed && <span style={{ position: 'absolute', bottom: 0, left: 0, padding: 6, background: '#efe9da', fontSize: 12 }}>The Keeper’s animation could not load. Requests still run.</span>}
  </div>;
}
