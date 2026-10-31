'use client';

import { useEffect, useRef, useState } from 'react';
import type { ClerkAnimationPhase, ClerkSceneProps } from '@/lib/clerk-animation';

interface Clip { src: string; frames: number; columns: number; rows: number; durationMs: number; loop: boolean }
type ClipName = ClerkAnimationPhase | 'web-return' | 'web-settle';
interface Manifest { width: number; height: number; fps: number; phases: Record<ClipName, Clip> }
const ROOT = '/clerk-room/front-blender/';

export default function ClerkBlenderScene({ phase, time, operation }: ClerkSceneProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const images = useRef(new Map<string, HTMLImageElement>());
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [loaded, setLoaded] = useState(0);
  const [failed, setFailed] = useState(false);
  const webEnding = phase === 'present' ? 'web-return' : phase === 'error' || phase === 'cancelled' ? 'web-settle' : null;
  const clipName: ClipName = operation === 'discover' && webEnding && manifest?.phases[webEnding] ? webEnding : phase;
  const mounted = useRef(true);
  const currentClip = useRef(clipName);
  useEffect(() => { currentClip.current = clipName; }, [clipName]);

  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    fetch(`${ROOT}manifest.json`, { signal: controller.signal }).then(response => {
      if (!response.ok) throw new Error('Room unavailable');
      return response.json();
    }).then(setManifest).catch(error => { if (error.name !== 'AbortError') setFailed(true); });
    return () => { mounted.current = false; controller.abort(); };
  }, []);

  useEffect(() => {
    if (!manifest) return;
    // Keep the current action and the welcoming frame ready; warm the next
    // physical location without downloading all ten animation atlases at once.
    const next: ClipName = phase === 'walk' ? 'documents' : phase === 'dispatch' ? 'web' : phase === 'documents' ? 'return' : phase === 'web' ? 'web-return' : phase === 'idle' ? 'idle' : 'present';
    const wanted = new Set<ClipName>(['idle', clipName, next]);
    const wantedSources = new Set([...wanted].map(action => manifest.phases[action]?.src));
    // A compressed atlas is small, but its decoded pixels are not. Keep at most
    // three clips, rather than retaining every routine for the whole visit.
    for (const [source, image] of images.current) {
      if (wantedSources.has(source)) continue;
      image.onload = null; image.onerror = null;
      images.current.delete(source);
    }
    for (const action of wanted) {
      const clip = manifest.phases[action];
      if (!clip || images.current.has(clip.src)) continue;
      const image = new Image();
      images.current.set(clip.src, image);
      image.onload = () => { if (mounted.current) { setLoaded(value => value + 1); setFailed(false); } };
      image.onerror = () => { images.current.delete(clip.src); if (mounted.current && action === currentClip.current) setFailed(true); };
      image.src = clip.src.startsWith('/') ? clip.src : `${ROOT}${clip.src}`;
    }
  }, [manifest, phase, clipName]);

  useEffect(() => {
    if (!manifest) return;
    const context = canvas.current?.getContext('2d');
    if (!context) return;
    const requested = manifest.phases[clipName];
    const clip = images.current.get(requested.src)?.complete ? requested : manifest.phases.idle;
    const image = images.current.get(clip.src);
    if (!image?.complete || !image.naturalWidth) return;
    const rawFrame = Math.floor(time * manifest.fps);
    const frame = clip === requested ? (clip.loop ? rawFrame % clip.frames : Math.min(rawFrame, clip.frames - 1)) : 0;
    context.clearRect(0, 0, manifest.width, manifest.height);
    context.drawImage(image, (frame % clip.columns) * manifest.width, Math.floor(frame / clip.columns) * manifest.height, manifest.width, manifest.height, 0, 0, manifest.width, manifest.height);
  }, [manifest, clipName, time, loaded]);

  return <div style={{ position: 'absolute', inset: 0, background: '#eee' }}>
    {/* A native Blender render remains visible while the first atlas decodes. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={`${ROOT}preview.png`} alt="" aria-hidden="true" style={{ position: 'absolute', width: '100%', height: '100%', objectFit: 'contain' }} />
    <canvas ref={canvas} width={manifest?.width ?? 768} height={manifest?.height ?? 512} aria-hidden="true" style={{ position: 'absolute', width: '100%', height: '100%', display: 'block' }} />
    {failed && <span style={{ position: 'absolute', bottom: 50, left: 20, padding: 8, background: '#fffe', fontSize: 11 }}>The animation couldn’t load. Your searches still work.</span>}
  </div>;
}
