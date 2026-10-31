'use client';

import { useEffect, useId, useRef, useState, type PointerEvent, type KeyboardEvent } from 'react';
import { clampToViewport, gait, stepGravity, supportBelow, type Platform, type Point } from '@/lib/keeper-navigation';
import { createWorld, DRAWING_FPS, idleBeat, keepFloorInView, keeperRequestNote, planArrival, planPending, planRequestPending, planRequestSettled, placeDrawing, requestDestination, sampleJourney, type KeeperActivity, type KeeperBeat, type KeeperPose, type WorldRect } from '@/lib/keeper-choreography';
import { KeeperGlass, type GlassSurface } from './keeper-glass';
import { KeeperLadder } from './keeper-ladder';
import { KeeperPages, type PageDrawing } from './keeper-pages';
import { KeeperLaptop, type LaptopDrawing } from './keeper-laptop';
import {playbackSeconds, resumeAfterDrop, updateKeeperRun, type KeeperRun} from '@/lib/keeper-playback';
import styles from './keeper-world.module.css';

interface DrawingState {
  frames: string[];
  fps: number;
  anchors?: Partial<Record<'feet' | 'hand' | 'seat', [number, number]>>;
  frameAnchors?: Partial<Record<'feet' | 'hand' | 'seat', [number, number]>>[];
}
interface DrawingManifest { width: number; height: number; states: Record<KeeperPose, DrawingState> }
interface RenderFrame { pages?: PageDrawing; laptop?: LaptopDrawing; attention?: { id: string; rect: WorldRect; active: boolean }; feet: Point; beat: KeeperBeat; src: string; left: number; top: number; width: number; height: number; glass: GlassSurface[]; opaque: WorldRect[]; overlays: WorldRect[]; note: string; viewport: [number, number] }
interface Manipulation { mode: 'held' | 'fall' | 'landing'; pointerId: number | null; at: Point; offset: Point; velocity: Point; started: number; lastTick: number; supportId?: string; facing: 1 | -1 }
const REST: KeeperActivity = { id: 0, operation: 'search', active: false };
const FALLBACK_ANCHORS = { feet: [.5, .95], hand: [.72, .53], seat: [.48, .62] } as const;

function visibleRect(node: HTMLElement): WorldRect | null {
  const raw = node.getBoundingClientRect();
  let left = Math.max(0, raw.left), right = Math.min(window.innerWidth, raw.right);
  let top = Math.max(0, raw.top), bottom = Math.min(window.innerHeight, raw.bottom);
  // A horizontally scrolled folder or a clipped result is not an invisible platform.
  for (let parent = node.parentElement; parent; parent = parent.parentElement) {
    const style = getComputedStyle(parent);
    const rect = parent.getBoundingClientRect();
    if (/hidden|auto|scroll|clip/.test(style.overflowX)) { left = Math.max(left, rect.left); right = Math.min(right, rect.right); }
    if (/hidden|auto|scroll|clip/.test(style.overflowY)) { top = Math.max(top, rect.top); bottom = Math.min(bottom, rect.bottom); }
  }
  return right - left > 8 && bottom - top > 8 ? { left, top, width: right - left, height: bottom - top } : null;
}

/** Measured shelves, gravity and explicit depth paths; no interpolated anchor jumps. */
export default function KeeperWorld({ activity = REST, motionPaused = false, studyTime, studyPhase }: { activity?: KeeperActivity; motionPaused?: boolean; studyTime?: number; studyPhase?: string }) {
  const [manifest, setManifest] = useState<DrawingManifest | null>(null);
  const [frame, setFrame] = useState<RenderFrame | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const prefix = useId().replace(/:/g, '');
  const run = useRef<KeeperRun>({ kind: 'idle', started: 0, activity });
  const latestFrame = useRef<RenderFrame | null>(null);
  const currentActivity = useRef(activity);
  const pauseStarted = useRef<number | null>(null);
  const layout = useRef<{ signature: string; surfaces: Map<string, WorldRect>; scrollX: number; scrollY: number; viewportHeight: number; floorY: number } | null>(null);
  const displaced = useRef<HTMLElement | null>(null);
  const inspected = useRef<HTMLElement | null>(null);
  const attentionNode = useRef<HTMLElement | null>(null);
  const manipulation = useRef<Manipulation | null>(null);
  const refresh = useRef<() => void>(() => {});
  const [held, setHeld] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(query.matches);
    update(); query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/character-sketch/manifest-v4.json').then(response => {
      if (!response.ok) throw new Error('Drawing manifest unavailable');
      return response.json() as Promise<DrawingManifest>;
    }).then(async value => {
      await Promise.all(Object.values(value.states).flatMap(state => state.frames).map(src => {
        const image = new Image(); image.src = src; return image.decode().catch(() => {});
      }));
      if (!cancelled) setManifest(value);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    currentActivity.current = activity;
    const old = run.current;
    const now = performance.now();
    run.current = updateKeeperRun(old, activity, now);
    if (pauseStarted.current !== null && run.current.started !== old.started) pauseStarted.current = now;
    if (old.activity.id !== activity.id && activity.id > 0 && activity.operation !== 'discover' && !['cancelled','error','empty'].includes(activity.outcome || '')) {
      const targetId=activity.destinationId?.startsWith('collection:') ? activity.destinationId : 'collection:all';
      const target=Array.from(document.querySelectorAll<HTMLElement>('[data-keeper-anchor]')).find(node=>node.dataset.keeperAnchor===targetId);
      if (target) {
        const rect=target.getBoundingClientRect();
        if (rect.top<100 || rect.bottom>window.innerHeight-80) target.scrollIntoView({block:'center',behavior:'instant'});
      }
    }
  }, [activity]);

  useEffect(() => {
    if (!manifest) return;
    const release = () => {
      attentionNode.current?.removeAttribute('data-keeper-attention');
      attentionNode.current = null;
      inspected.current?.removeAttribute('data-keeper-searching');
      inspected.current?.style.removeProperty('--keeper-lid-open');
      inspected.current = null;
      if (!displaced.current) return;
      displaced.current.style.removeProperty('--keeper-shift-x');
      displaced.current.style.removeProperty('--keeper-shift-y');
      displaced.current.removeAttribute('data-keeper-contact');
      displaced.current = null;
    };
    const tick = () => {
      const now = performance.now();
      if (motionPaused) {
        if (pauseStarted.current === null) pauseStarted.current = now;
        release();
      } else if (pauseStarted.current !== null) {
        run.current.started += now - pauseStarted.current;
        pauseStarted.current = null;
      }
      release();
      const surfaces: GlassSurface[] = Array.from(document.querySelectorAll<HTMLElement>('[data-keeper-anchor]'))
        .map((node): GlassSurface | null => { const raw = node.getBoundingClientRect(), rect = visibleRect(node); return rect ? { node, id: node.dataset.keeperAnchor || '', rect, portalRect: { left: raw.left, top: raw.top, width: raw.width, height: raw.height } } : null; })
        .filter((surface): surface is GlassSurface => surface !== null);
      const collections = surfaces.filter(surface => surface.id.startsWith('collection:'));
      const home = surfaces.find(surface => surface.id === 'keeper-home') || surfaces.find(surface => surface.id === 'composer') || collections[0] || surfaces.find(surface => surface.id === 'shelf');
      const platforms = surfaces.filter(surface => ['composer', 'keeper-home', 'portal', 'reading-desk'].includes(surface.id) || surface.id.startsWith('collection:'));
      if (!home) { release(); setFrame(null); return; }
      // Opaque controls are obstacles, not destinations the actor can slide through.
      const opaqueNodes = Array.from(document.querySelectorAll<HTMLElement>(' .library-toolbar button, .library-heading h2, .count-pill, .site-header, .discovery-card, .search-result, .document-row, .dropdown-menu, [data-keeper-obstacle]'));
      const opaque = opaqueNodes.map(visibleRect).filter((rect): rect is WorldRect => rect !== null);
      const overlays = Array.from(document.querySelectorAll<HTMLElement>('.dropdown-menu, [role="dialog"]')).map(visibleRect).filter((rect): rect is WorldRect => rect !== null);
      const actorHeight = window.innerWidth <= 360 ? 128 : window.innerWidth <= 760 ? 150 : window.location.pathname.startsWith('/keeper-study') ? 218 : 180;
      const world = createWorld({ width: window.innerWidth, height: window.innerHeight, actorHeight,bodyRadius:window.location.pathname.startsWith('/keeper-study') ? undefined : actorHeight*.22, floorY: window.innerHeight - 18,
        platforms: platforms.map(({id, rect, portalRect}) => ({id, rect: portalRect || rect})),
        obstacles: opaque.map((rect, index) => ({ id: `control:${index}`, rect })) });
      const signature = JSON.stringify([window.innerWidth, window.innerHeight, actorHeight, reducedMotion, studyPhase !== undefined || studyTime !== undefined, ...platforms.map(({id, rect, portalRect}) => [id, ...Object.values(portalRect || rect).map(Math.round), ...Object.values(rect).map(Math.round)]), ...opaque.map(rect => Object.values(rect).map(Math.round))]);
      const state = run.current;
      const isStudy = studyPhase !== undefined || studyTime !== undefined;
      let start = latestFrame.current?.beat;
      const changedLayout = layout.current && layout.current.signature !== signature;
      if (changedLayout && start && !manipulation.current) {
        const supportId = start.supportId?.replace(/^(grip:|ladder:)/, '');
        const oldSupport = supportId ? layout.current!.surfaces.get(supportId) : undefined;
        const supportNode = supportId ? Array.from(document.querySelectorAll<HTMLElement>('[data-keeper-anchor]')).find(node => node.dataset.keeperAnchor === supportId) : undefined;
        const newSupport = supportNode?.getBoundingClientRect();
        const dx = oldSupport && newSupport ? newSupport.left - oldSupport.left : supportId === 'floor' ? 0 : layout.current!.scrollX - window.scrollX;
        const dy = oldSupport && newSupport ? newSupport.top - oldSupport.top
          : supportId === 'floor' ? world.floorY - layout.current!.floorY
          : layout.current!.scrollY - window.scrollY;
        start = { ...start, at: { x: start.at.x + dx, y: start.at.y + dy }, groundY: start.groundY === undefined ? undefined : start.groundY + dy,
          ladder: start.ladder ? { ...start.ladder, x: start.ladder.x + dx, bodyX: start.ladder.bodyX + dx, landingX: start.ladder.landingX + dx, top: start.ladder.top + dy, bottom: start.ladder.bottom + dy, railTop: start.ladder.railTop + dy, exitY: start.ladder.exitY + dy } : undefined };
      }
      if (start && !manipulation.current) {
        const visibleStart = keepFloorInView(world,start);
        if (visibleStart !== start) {
          start = visibleStart;
          state.plan = undefined; state.signature = undefined;
        }
      }
      layout.current = { signature, surfaces: new Map(surfaces.map(surface => [surface.id, surface.portalRect || surface.rect])), scrollX: window.scrollX, scrollY: window.scrollY, viewportHeight: window.innerHeight, floorY: world.floorY };
      if (changedLayout && state.kind === 'idle' && start?.supportId && start.supportId !== 'floor' && !start.ladder && !platforms.some(surface => surface.id === start.supportId)) {
        state.kind = 'arrival'; state.plan = undefined;
      }
      if (!manipulation.current && state.kind !== 'idle' && (!state.plan || state.signature !== signature)) {
        const ladderStudy = studyPhase?.includes('ladder');
        state.plan = ladderStudy
          ? planArrival(world, home.id, planPending(world, home.id, state.activity.operation).final, 'success', state.activity.operation)
          : state.kind === 'arrival'
          ? isStudy ? planArrival(world, home.id, start || idleBeat(home.rect, 0), state.activity.outcome || 'success', state.activity.operation) : planRequestSettled(world, start || { ...idleBeat(home.rect, 0), supportId: home.id }, state.activity)
          : isStudy ? planPending(world, home.id, state.activity.operation) : planRequestPending(world, home.id, state.activity, start);
        state.started = now; state.signature = signature;
        if (pauseStarted.current !== null) pauseStarted.current = now;
      }
      let elapsed = studyTime ?? playbackSeconds(now, state.started);
      if (studyPhase && state.plan) {
        const segment = state.plan.segments.find(part => part.phase === studyPhase);
        if (segment) elapsed = segment.start + segment.duration * .65;
      }
      let beat = start || { ...idleBeat(home.rect, 0), supportId: home.id };
      const manual = manipulation.current;
      if (manual) {
        if (motionPaused) manual.started += Math.max(0, now - manual.lastTick);
        const dropPlatforms: Platform[] = [
          ...world.platforms.map(({id, rect}): Platform => ({id, left:rect.left, right:rect.left + rect.width, y:rect.top, bottom:rect.top + rect.height, kind:id === 'composer' ? 'composer' : 'folder'})),
          {id:'floor', left:0, right:world.width, y:world.height - 18, kind:'floor'},
        ];
        if (manual.mode === 'fall' && !motionPaused) {
          // Drops cross real top edges. A bubble above the feet cannot pull him upward.
          const dt = Math.min(.1, Math.max(0, (now - manual.lastTick) / 1000));
          const flight = reducedMotion ? {position: {x:manual.at.x, y:supportBelow(manual.at, dropPlatforms)?.y ?? world.height - 18}, velocity:{x:0,y:0}, landed:true, supportId:supportBelow(manual.at,dropPlatforms)?.id ?? 'floor'} : stepGravity(manual.at, manual.velocity, dt, dropPlatforms);
          manual.at = flight.position; manual.velocity = flight.velocity;
          if (flight.landed) { manual.mode = 'landing'; manual.started = now; manual.supportId = flight.supportId; }
        }
        manual.lastTick = now;
        const landing = manual.mode === 'landing';
        beat = {pose: manual.mode === 'held' ? 'picked' : landing ? 'landing' : 'picked', at:manual.at, pin:'feet', facing:manual.facing, scale:1, frameTime:(now-manual.started)/1000, phase:manual.mode === 'held' ? 'picked-up' : landing ? 'landing-after-drop' : 'falling-after-drop', depth:0, grounded:landing, groundY:landing ? manual.at.y : supportBelow(manual.at,dropPlatforms)?.y, supportId:manual.supportId, poseProgress:landing ? Math.min(1,(now-manual.started)/450) : undefined};
        if (landing && now - manual.started > (reducedMotion ? 0 : 550) && !motionPaused) {
          // Recover from the landing, even when a request completed during the drag.
          manipulation.current = null;
          run.current = resumeAfterDrop(run.current,currentActivity.current,now);
        }
      } else if (motionPaused && start) beat = start;
      else if (reducedMotion || state.kind === 'idle') beat = { ...beat, frameTime: 0, footfall: false, displacement: undefined };
      else if (state.plan) beat = sampleJourney(state.plan,elapsed);
      if (!manual && !motionPaused && !reducedMotion && state.kind === 'pending' && state.plan && beat.done && state.activity.active) {
        beat = {...beat, frameTime:Math.max(0,elapsed-state.plan.duration), done:false};
      } else if (!manual && !motionPaused && !isStudy && (state.kind === 'arrival' || state.kind === 'presenting') && (beat.done || reducedMotion)) {
        state.presentationDone = state.kind === 'presenting' || state.presentationDone;
        state.kind = 'idle'; state.plan = undefined;
      }
      release();
      // Only a physically reached contact may move a real bubble. No remote shaking.
      const contactSurface = surfaces.find(surface => surface.id === beat.supportId?.replace(/^grip:/, ''));
      if (beat.displacement && contactSurface && !reducedMotion && !motionPaused) {
        contactSurface.node.style.setProperty('--keeper-shift-x', `${beat.displacement.x}px`);
        contactSurface.node.style.setProperty('--keeper-shift-y', `${beat.displacement.y}px`);
        contactSurface.node.dataset.keeperContact = 'true'; displaced.current = contactSurface.node;
      }
      const storage = surfaces.find(surface => surface.id === beat.storageId);
      if (!isStudy && !beat.laptop && ['rummage','search'].includes(beat.pose) && (!storage || !storage.id.startsWith('collection:') || beat.supportId!==storage.id || beat.at.y<storage.rect.top || beat.at.y>storage.rect.top+storage.rect.height+20)) {
        beat={...beat,pose:'stand',phase:'waiting-for-visible-collection',paper:false,storageId:undefined,lidOpen:0,frameTime:1};
      }
      if (storage && ['opening-folder','moving-inside-chest','checking-storage','reading-passages','filing-document','retrieving-source','presenting-source','leaving-chest','closing-folder'].includes(beat.phase)) {
        storage.node.dataset.keeperSearching = beat.phase;
        storage.node.style.setProperty('--keeper-lid-open',String(beat.lidOpen ?? 0));
        inspected.current = storage.node;
      }
      const attentionId = state.kind==='presenting' || state.activity.active && state.activity.operation!=='discover' ? requestDestination(world, state.activity, home.id) : state.activity.outcome === 'success' ? state.activity.targetId : undefined;
      const attentionSurface = state.activity.id > 0 ? surfaces.find(surface => surface.id === attentionId) : undefined;
      if (attentionSurface) {
        attentionSurface.node.dataset.keeperAttention = state.activity.active ? 'working' : 'ready';
        attentionNode.current = attentionSurface.node;
      }
      const drawing = manifest.states[beat.pose] || manifest.states.idle;
      const fps = Math.min(DRAWING_FPS, drawing.fps || DRAWING_FPS);
      const rawIndex = Math.floor(Math.max(0, beat.frameTime) * fps);
      // Sitting is a single held drawing. No breathing translation, cycling or jitter.
      const progressIndex = Math.min(drawing.frames.length - 1, Math.floor(Math.max(0, beat.poseProgress || 0) * drawing.frames.length));
      const stride = beat.pose === 'climb' ? 2 * (beat.ladder?.rungSpacing || 24) : actorHeight * (beat.pose === 'crawl' ? .24 : .46);
      const index = beat.pose === 'idle' ? 0
        : beat.gaitDistance !== undefined && ['walk','away','crawl','climb','carry'].includes(beat.pose) ? gait(beat.gaitDistance, stride, drawing.frames.length).frame
        : beat.poseProgress !== undefined && ['climb', 'clamber', 'stand', 'landing','peek'].includes(beat.pose) ? progressIndex
        : beat.pose === 'reach' && beat.supportId?.startsWith('grip:') ? drawing.frames.length - 1
        : beat.pose === 'stand' ? beat.frameTime >= 1 ? drawing.frames.length - 1 : Math.min(rawIndex, drawing.frames.length - 1) : rawIndex % drawing.frames.length;
      const height = actorHeight * beat.scale, width = height * manifest.width / manifest.height;
      const anchor = drawing.frameAnchors?.[index]?.[beat.pin] || drawing.anchors?.[beat.pin] || FALLBACK_ANCHORS[beat.pin];
      const position = placeDrawing(beat.at, anchor, width, height, beat.facing);
      const note = !isStudy ? beat.phase === 'picked-up' ? 'I’ll stay where you put me.' : state.kind==='presenting' ? ['retrieving-source','presenting-source','leaving-chest','closing-folder','source-presented'].includes(beat.phase) ? currentActivity.current.operation==='import' ? 'Filed here.' : 'Found it here.' : beat.phase.startsWith('waiting-for-') ? 'Your result is ready below.' : 'Your result is ready. This way.' : keeperRequestNote(currentActivity.current) : beat.phase === 'picked-up' ? '...really?' : reducedMotion ? currentActivity.current.active ? 'on it.' : ''
        : beat.phase === 'resting' ? ''
        : beat.phase === 'getting-up' ? '…again?'
        : /deploying-ladder/.test(beat.phase) ? 'fine. the stairs.'
        : /climbing-ladder/.test(beat.phase) ? 'one at a time.'
        : /fall|drop/.test(beat.phase) ? 'oh.'
        : /landing/.test(beat.phase) ? 'right.'
        : beat.phase === 'opening-folder' ? 'in here…'
        : beat.phase === 'checking-storage' ? 'somewhere in these pages.'
        : beat.phase === 'reading-passages' ? 'let me read that.'
        : /behind|glass/.test(beat.phase) ? 'this glass is unkind.'
        : beat.phase === 'empty-handed' ? 'nothing this time.'
        : beat.phase === 'stumped' ? 'a snag. sorry.'
        : beat.phase === 'presenting-find' ? currentActivity.current.operation === 'import' ? 'safely filed.' : 'here. this one.' : '';
      const feetAnchor = drawing.frameAnchors?.[index]?.feet || drawing.anchors?.feet || FALLBACK_ANCHORS.feet;
      const feet = {x:position.x + (beat.facing === 1 ? feetAnchor[0] : 1-feetAnchor[0])*width, y:position.y + feetAnchor[1]*height};
      const handAnchor = drawing.frameAnchors?.[index]?.hand || drawing.anchors?.hand || FALLBACK_ANCHORS.hand;
      const pages: PageDrawing | undefined = ['checking-storage','reading-passages','retrieving-source','presenting-source'].includes(beat.phase) ? {
        x:position.x + (beat.facing === 1 ? handAnchor[0] : 1-handAnchor[0])*width,
        y:position.y + handAnchor[1]*height, scale:height/218, reading:beat.phase === 'reading-passages' || beat.phase==='presenting-source', frame:index, facing:beat.facing,
      } : undefined;
      const laptop: LaptopDrawing | undefined = beat.laptop ? {x:position.x+(beat.facing===1 ? handAnchor[0] : 1-handAnchor[0])*width,y:position.y+handAnchor[1]*height,scale:height/180,facing:beat.facing,frame:index} : undefined;
      const next: RenderFrame = { pages,laptop, attention: attentionSurface ? {id:attentionSurface.id, rect:attentionSurface.rect, active:state.activity.active} : undefined, feet, beat, src: drawing.frames[index], left: position.x, top: position.y, width, height, glass: surfaces.filter(surface => surface.id.startsWith('collection:') || surface.id === 'portal'), opaque, overlays, note, viewport: [window.innerWidth, window.innerHeight] };
      const old = latestFrame.current;
      latestFrame.current = next;
      if (!old || old.src !== next.src || old.left !== next.left || old.top !== next.top || old.width !== next.width || old.beat.phase !== next.beat.phase || old.beat.depth !== next.beat.depth || old.beat.facing !== next.beat.facing || old.beat.hidden !== next.beat.hidden || old.beat.lidOpen!==next.beat.lidOpen || old.beat.ladder?.progress !== next.beat.ladder?.progress || old.note !== next.note || old.attention?.id !== next.attention?.id || old.attention?.active !== next.attention?.active || changedLayout) setFrame(next);
    };
    refresh.current = tick;
    tick();
    const timer = window.setInterval(tick, 1000 / DRAWING_FPS);
    return () => { window.clearInterval(timer); refresh.current = () => {}; release(); };
  }, [manifest, reducedMotion, motionPaused, studyTime, studyPhase]);

  if (!frame) return null;
  const behind = (frame.beat.depth || 0) > .5;
  const mask = `${prefix}-occlusion`;
  const pickUp = (point?: Point, pointerId: number | null = null) => {
    const current = latestFrame.current;
    if (!current) return;
    const now = performance.now();
    const at = { ...current.feet };
    manipulation.current = {mode:'held', pointerId, at, offset:point ? {x:at.x-point.x,y:at.y-point.y} : {x:0,y:0}, velocity:{x:0,y:0}, started:now, lastTick:now, facing:current.beat.facing};
    setHeld(true); refresh.current();
  };
  const moveTo = (at: Point) => {
    const manual = manipulation.current;
    if (!manual || manual.mode !== 'held') return;
    const bounded = clampToViewport(at, {width:window.innerWidth,height:window.innerHeight}, 24);
    manual.at = {...bounded, y: Math.min(window.innerHeight-20, Math.max(70,bounded.y))};
    refresh.current();
  };
  const drop = () => {
    const manual = manipulation.current;
    if (!manual || manual.mode !== 'held') return;
    manual.mode = 'fall'; manual.started = manual.lastTick = performance.now(); manual.velocity = {x:0,y:0};
    setHeld(false); refresh.current();
  };
  const pointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    event.preventDefault(); event.currentTarget.blur();
    event.currentTarget.setPointerCapture(event.pointerId);
    pickUp({x:event.clientX,y:event.clientY},event.pointerId);
  };
  const pointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const manual = manipulation.current;
    if (manual?.mode !== 'held' || manual.pointerId !== event.pointerId) return;
    moveTo({x:event.clientX+manual.offset.x,y:event.clientY+manual.offset.y});
  };
  const pointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    if (manipulation.current?.pointerId !== event.pointerId) return;
    drop();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const keyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); if (manipulation.current?.mode === 'held') drop(); else pickUp(); }
    else if (event.key === 'Escape') { event.preventDefault(); drop(); }
    else if (event.key.startsWith('Arrow') && manipulation.current?.mode === 'held') {
      event.preventDefault(); const step = event.shiftKey ? 40 : 12; const at=manipulation.current.at;
      moveTo({x:at.x+(event.key==='ArrowRight'?step:event.key==='ArrowLeft'?-step:0),y:at.y+(event.key==='ArrowDown'?step:event.key==='ArrowUp'?-step:0)});
    }
  };
  return <>
    {behind && !frame.beat.hidden && <KeeperGlass prefix={prefix} surfaces={frame.glass} drawing={{ ...frame, facing: frame.beat.facing }} />}
    <span id={`${prefix}-drag-help`} className={styles.srOnly}>Drag Keeper to move him. With the keyboard, press Space to pick him up, arrow keys to move, and Space or Escape to let go.</span>
    <div className={styles.world} data-keeper-request-active={run.current.activity.active ? 'true' : 'false'} data-keeper-target={frame.attention?.id} data-keeper-operation={run.current.activity.operation} data-keeper-phase={frame.beat.phase} data-keeper-pose={frame.beat.pose} data-keeper-depth={frame.beat.depth || 0} data-keeper-supported={frame.beat.supportId || 'air'} data-keeper-grounded={frame.beat.grounded ? 'true' : 'false'} data-keeper-x={frame.beat.at.x} data-keeper-y={frame.beat.at.y}>
      {!frame.beat.hidden && <>
        {frame.beat.groundY !== undefined && frame.beat.pin === 'feet' && frame.beat.pose !== 'idle' && <div className={styles.contactShadow} style={{ left: frame.beat.at.x, top: frame.beat.groundY, opacity: Math.max(.07, .2 - Math.abs(frame.beat.groundY - frame.beat.at.y) / 600), transform: `translate(-50%, -50%) scale(${frame.beat.scale})` }} />}
        <svg className={styles.actorCanvas} width={frame.viewport[0]} height={frame.viewport[1]} aria-hidden="true" focusable="false">
          {frame.attention?.active && !held && <g className={styles.requestThread}>
            <path d={`M ${frame.feet.x} ${frame.feet.y - frame.height * .48} Q ${frame.feet.x} ${frame.attention.rect.top + frame.attention.rect.height / 2}, ${frame.attention.rect.left + frame.attention.rect.width / 2} ${frame.attention.rect.top + frame.attention.rect.height / 2}`} />
            <circle cx={frame.attention.rect.left + frame.attention.rect.width / 2} cy={frame.attention.rect.top + frame.attention.rect.height / 2} r="3" />
          </g>}
          <defs><mask id={mask} maskUnits="userSpaceOnUse" x="0" y="0" width={frame.viewport[0]} height={frame.viewport[1]}>
            <rect width="100%" height="100%" fill="white" />
            {behind && frame.glass.map(surface => { const cavity=surface.id===frame.beat.storageId && (frame.beat.lidOpen || 0)>0 ? 26 : 0; return <rect key={surface.id} x={surface.rect.left} y={surface.rect.top+cavity} width={surface.rect.width} height={Math.max(0,surface.rect.height-cavity)} rx="3" fill="black" />; })}
            {behind && frame.opaque.map((rect, index) => <rect key={index} x={rect.left} y={rect.top} width={rect.width} height={rect.height} rx="12" fill="black" />)}
            {frame.overlays.map((rect, index) => <rect key={`overlay-${index}`} x={rect.left} y={rect.top} width={rect.width} height={rect.height} rx="12" fill="black" />)}
          </mask></defs>
          <g mask={`url(#${mask})`}>
            {frame.beat.ladder && <KeeperLadder ladder={frame.beat.ladder} prefix={prefix} />}
            <image data-keeper-drawing href={frame.src} x={frame.left} y={frame.top} width={frame.width} height={frame.height} transform={frame.beat.facing === -1 ? `translate(${frame.left * 2 + frame.width} 0) scale(-1 1)` : undefined} />
            {frame.pages && <KeeperPages {...frame.pages} />}
            {frame.laptop && <KeeperLaptop {...frame.laptop} />}
          </g>
        </svg>
        <div className={styles.actor} style={{ left: frame.left, top: frame.top, width: frame.width, height: frame.height }}>
          {frame.note && <span className={`${styles.thought} ${frame.left + frame.width + 115 > frame.viewport[0] ? styles.thoughtLeft : ''} ${frame.laptop ? styles.laptopThought : ''}`} aria-hidden="true">{frame.note}</span>}
          <button className={styles.dragHandle} style={frame.beat.pose === 'idle' || frame.beat.storageId?.startsWith('collection:') ? {height:Math.max(40,(frame.beat.groundY ?? frame.top+frame.height)-frame.top-frame.height*.08)} : undefined} data-keeper-handle aria-label={held ? 'Drop Keeper' : 'Pick up Keeper'} aria-pressed={held} aria-describedby={`${prefix}-drag-help`} title="Drag Keeper anywhere · Space to pick up, arrow keys to move, Space to drop" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} onLostPointerCapture={drop} onKeyDown={keyDown} />
        </div>
      </>}
    </div>
  </>;
}
