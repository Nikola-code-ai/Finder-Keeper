'use client';

import {useEffect,useRef,useState,type CSSProperties} from 'react';
import type {KeeperActivity,KeeperOperation} from '@/lib/keeper-choreography';
import {advanceStationClock,sampleStation,stationClock,stationGeometry,STATION_DRAWINGS} from '@/lib/keeper-station';
import styles from './keeper-station.module.css';

export interface KeeperStationProps {
  activity: KeeperActivity;
  motionPaused: boolean;
  mode: KeeperOperation;
  collectionName: string;
  documentCount: number;
  onOpenCollection: () => void;
}

export default function KeeperStation({activity,motionPaused,mode,collectionName,documentCount,onOpenCollection}:KeeperStationProps) {
  const stage=useRef<HTMLDivElement>(null);
  const [size,setSize]=useState({width:760,height:320});
  const [clock,setClock]=useState(()=>stationClock(activity,0,motionPaused));
  const [reducedMotion,setReducedMotion]=useState(false);
  const [laptopFailed,setLaptopFailed]=useState(false);

  useEffect(()=>{
    const element=stage.current;
    if(!element) return;
    const measure=()=>{const rect=element.getBoundingClientRect();setSize({width:rect.width,height:rect.height});};
    measure();
    const observer=new ResizeObserver(measure);observer.observe(element);
    const media=window.matchMedia('(prefers-reduced-motion: reduce)');
    const update=()=>setReducedMotion(media.matches);update();media.addEventListener('change',update);
    return ()=>{observer.disconnect();media.removeEventListener('change',update);};
  },[]);

  useEffect(()=>{
    const update=()=>setClock(previous=>advanceStationClock(previous,activity,performance.now(),motionPaused));
    update();
    if(!activity.active) return;
    const timer=window.setInterval(update,40);
    return ()=>window.clearInterval(timer);
  },[activity.id,activity.active,activity.operation,motionPaused]);

  // Activity is authoritative during the render itself, including cancellation
  // while paused. We do not wait for the drawing timer or its effect to run.
  const current=clock.requestId===activity.id && clock.active===activity.active && clock.operation===activity.operation
    ? clock : stationClock(activity,0,motionPaused);
  const pose=sampleStation(current,reducedMotion);
  const drawing=pose.drawing==='laptop' ? 'idle' : pose.drawing;
  const geometry=stationGeometry(size.width,size.height,drawing,pose.drawerOpen);
  const online=pose.drawing==='laptop';
  const working=pose.phase==='reaching' || pose.phase==='working';
  const drawerStyle={left:geometry.drawer.left,top:geometry.drawer.top,width:geometry.drawer.width,height:geometry.drawer.height,'--drawer-slide':`${geometry.drawer.slide}px`} as CSSProperties;
  const caption=activity.active ? activity.operation==='discover' ? 'Looking online.' : activity.operation==='ask' ? 'Reading this collection.' : activity.operation==='import' ? 'Adding to this collection.' : 'Searching this collection.' : activity.outcome==='cancelled' ? 'Stopped.' : activity.outcome==='error' ? 'That request needs another try.' : activity.outcome==='empty' ? 'No matches this time.' : activity.outcome==='success' ? 'Your result is ready.' : mode==='discover' ? 'Online sources, close at hand.' : 'Your collection, close at hand.';

  return <section className={styles.station} aria-label="Keeper’s work station" data-keeper-station data-phase={pose.phase} data-request-active={activity.active} data-frame={pose.drawing} data-contact={working} data-motion-paused={motionPaused}>
    <div className={styles.stage} ref={stage}>
      <div className={styles.floor} aria-hidden="true" />
      <div className={styles.cabinet} style={drawerStyle} aria-hidden="true"><i/><i/></div>
      <div className={`${styles.drawer} ${activity.active && !reducedMotion ? styles.liveDrawer : ''}`} style={drawerStyle}>
        <div className={styles.cavity} aria-hidden="true"><i/><i/><i/></div>
        <button className={styles.drawerFront} onClick={onOpenCollection} aria-label={`Open ${collectionName}, ${documentCount} ${documentCount===1 ? 'document' : 'documents'}`}>
          <span className={styles.drawerLabel}><strong>{collectionName}</strong><small>{documentCount} {documentCount===1 ? 'document' : 'documents'}</small></span><span className={styles.drawerHandle} aria-hidden="true"/><span className={styles.openHint}>Open collection ↗</span>
        </button>
      </div>
      <div className={styles.actor} style={geometry.actor} aria-hidden="true">
        {/* The assets are transparent drawings; native images preserve their exact frame anchors. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={online && !laptopFailed ? styles.laptopDrawing : styles.drawing} src={online && !laptopFailed ? '/characters/keeper-station-laptop.png' : STATION_DRAWINGS[drawing].src} alt="" draggable={false} onError={online ? ()=>setLaptopFailed(true) : undefined}/>
        {online && laptopFailed && <span className={styles.laptopFallback}><i/><b/></span>}
      </div>
      {working && geometry.hand && <span className={styles.paper} aria-hidden="true" style={{left:geometry.hand.x-8,top:geometry.hand.y-15}}/>}
      <p className={styles.caption}>{caption}</p>
    </div>
  </section>;
}
