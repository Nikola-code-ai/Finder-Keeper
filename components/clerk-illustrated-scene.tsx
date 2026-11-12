'use client';

import { useId } from 'react';
import type { ClerkAnimationPhase } from '@/lib/clerk-animation';
import type { KeeperOperation } from '@/lib/keeper-choreography';
import styles from './clerk-illustrated-scene.module.css';

type Props = { phase: ClerkAnimationPhase; time: number; paused: boolean; reducedMotion: boolean; operation?: KeeperOperation; room?: boolean };
type Point = [number, number];
const ART = '/clerk-room/front-illustrated';
const clamp = (n: number) => Math.max(0, Math.min(1, n));
// Round geometry at the serialization boundary so Node and browser trig agree during hydration.
const q = (n: number) => Number(n.toFixed(3));
const ease = (n: number) => { const p = clamp(n); return p * p * (3 - 2 * p); };
const mix = (a: number, b: number, p: number) => a + (b - a) * p;

/** A layered paper puppet: each hand, sleeve, leg, page and spider limb has its own pose. */
function Arm({ shoulder, elbow, wrist, id, handAngle = 0 }: { shoulder: Point; elbow: Point; wrist: Point; id: string; handAngle?: number }) {
  const angle = q(Math.atan2(elbow[1] - shoulder[1], elbow[0] - shoulder[0]) * 180 / Math.PI);
  const length = q(Math.hypot(elbow[0] - shoulder[0], elbow[1] - shoulder[1]));
  const sleeve = `M 0 -20 Q ${length * .45} -24 ${length} -15 L ${length + 4} 15 Q ${length * .4} 24 0 20 Q -12 0 0 -20`;
  return <g>
    <path d={`M ${elbow} L ${wrist}`} fill="none" stroke="#48463f" strokeWidth="24" strokeLinecap="round" />
    <path d={`M ${elbow} L ${wrist}`} fill="none" stroke={`url(#${id}-skin)`} strokeWidth="20" strokeLinecap="round" />
    <path d={`M ${elbow} L ${wrist}`} fill="none" stroke={`url(#${id}-hatch)`} strokeWidth="20" strokeLinecap="round" />
    <path d={`M ${elbow[0] + 5} ${elbow[1]} L ${wrist[0] + 4} ${wrist[1] - 1}`} fill="none" stroke="#aaa69b" strokeWidth="2" opacity=".65" />
    <g transform={`translate(${shoulder}) rotate(${angle})`}>
      <path d={sleeve} fill={`url(#${id}-shirt)`} stroke="#666259" strokeWidth="1.6" />
      <path d={sleeve} fill={`url(#${id}-hatch)`} />
      <path d={`M 3 -17 Q ${length * .45} -12 ${length - 9} -15 M 4 16 Q ${length * .6} 8 ${length - 9} 14 M 17 -17 L 25 -5 M 21 14 L 31 4 M ${length - 20} -15 L ${length - 28} -6`} fill="none" stroke="#969388" strokeWidth="1.5" />
      <path d={`M ${length - 7} -17 L ${length + 5} -16 L ${length + 7} 16 L ${length - 6} 18 Z`} fill="#e7e5db" stroke="#6e6a61" strokeWidth="1.5" />
      <path d={`M ${length - 1} -14 L ${length + 1} 14`} stroke="#aaa69a" />
      <path d={`M 7 -18 Q 18 -13 31 -16 M 11 -15 Q 20 -7 29 -4 M 16 15 Q 28 7 43 10 M 15 17 Q 29 12 40 14 M ${length - 14} -13 Q ${length - 20} -6 ${length - 32} -4 M ${length - 12} 13 Q ${length - 23} 5 ${length - 34} 6`} fill="none" stroke="#868074" strokeWidth=".8" opacity=".8" />
    </g>
    <g transform={`translate(${wrist}) rotate(${handAngle})`}>
      <path d="M -9 -3 Q -11 -12 -5 -14 Q 4 -17 11 -8 L 19 -2 Q 24 1 21 4 L 14 3 Q 18 11 14 14 Q 9 19 3 15 L -5 10 Z" fill={`url(#${id}-skin)`} stroke="#615c54" strokeWidth="1.4" />
      <path d="M 6 1 L 14 6 M 3 6 L 11 11 M 0 10 L 5 14 M -6 -5 Q 1 -10 6 -6" fill="none" stroke="#a29a8e" strokeWidth="1" />
    </g>
  </g>;
}

function Leg({ x, angle, id }: { x: number; angle: number; id: string }) {
  return <g transform={`translate(${x} 565) rotate(${angle})`}>
    <path d="M -24 -8 L 22 -8 L 21 114 L 12 132 L -18 130 L -28 89 Z" fill={`url(#${id}-trouser)`} stroke="#363530" strokeWidth="2" />
    <path d="M 3 2 L 0 116 M -17 15 L -12 73 M 14 41 L 10 91" stroke="#85837b" strokeWidth="1.5" fill="none" />
    <path d="M -20 123 L 15 125 L 28 141 Q 33 155 17 158 L -29 156 Q -34 150 -25 141 Z" fill="#46443e" stroke="#302f2c" strokeWidth="2" />
    <path d="M -23 148 Q 0 153 25 148 M -5 136 L 11 140 M -8 141 L 10 145" fill="none" stroke="#9e9a8d" strokeWidth="1.4" />
  </g>;
}

function Book({ flip, id }: { flip: number; id: string }) {
  const theta = flip * Math.PI;
  const tipX = q(650 + Math.cos(theta) * 77);
  const lift = q(Math.sin(theta) * 48);
  return <g>
    <ellipse cx="650" cy="531" rx="96" ry="19" fill="#25231c" opacity=".22" />
    <path d="M 555 502 Q 603 486 650 510 Q 696 486 745 502 L 744 535 Q 697 520 650 541 Q 603 520 557 535 Z" fill="#4d4a41" stroke="#292720" strokeWidth="2" />
    <path d="M 561 497 Q 603 484 650 505 Q 693 484 739 497 L 738 528 Q 693 516 650 535 Q 605 517 563 530 Z" fill={`url(#${id}-page)`} stroke="#726b5e" strokeWidth="1.4" />
    <path d="M 650 507 L 650 535" stroke="#827a6b" strokeWidth="2" />
    {Array.from({ length: 5 }, (_, i) => <g key={i} stroke="#8b8374" strokeWidth="1" opacity=".7"><path d={`M 572 ${502 + i * 5} Q 604 ${496 + i * 5} 638 ${511 + i * 4}`} fill="none" /><path d={`M 661 ${511 + i * 4} Q 692 ${497 + i * 5} 728 ${502 + i * 5}`} fill="none" /></g>)}
    {flip > .01 && flip < .99 && <g><path d={`M 650 506 Q ${mix(650, tipX, .45)} ${488 - lift} ${tipX} ${498 - lift} L ${tipX} ${527 - lift} Q ${mix(650, tipX, .45)} ${518 - lift * .5} 650 535 Z`} fill="#f2f0e5" stroke="#898170" strokeWidth="1.2" /><path d={`M 651 512 Q ${mix(650, tipX, .6)} ${505 - lift} ${tipX - Math.cos(theta) * 9} ${508 - lift}`} fill="none" stroke="#b0a897" /></g>}
  </g>;
}

function Spider({ x, y, gait, scale = 1 }: { x: number; y: number; gait: number; scale?: number }) {
  return <g transform={`translate(${x} ${y}) scale(${scale})`}>
    {[-1, 1].flatMap(side => Array.from({ length: 4 }, (_, i) => {
      const step = q(Math.sin(gait + i * 1.7 + side) * 5);
      return <path key={`${side}-${i}`} d={`M ${side * 7} ${i * 4 - 8} L ${side * (19 + i)} ${i * 7 - 15 + step} L ${side * (29 - i)} ${i * 8 - 8 - step}`} fill="none" stroke="#302f2b" strokeWidth="2.5" strokeLinecap="round" />;
    }))}
    <ellipse cy="-2" rx="10" ry="13" fill="#403d36" stroke="#24231f" strokeWidth="2" /><circle cy="11" r="8" fill="#5c584e" stroke="#24231f" strokeWidth="1.8" /><circle cx="-3" cy="12" r="2" fill="#f2f0e9" /><circle cx="3" cy="12" r="2" fill="#f2f0e9" />
  </g>;
}

export default function ClerkIllustratedScene({ phase, time, paused, reducedMotion, operation, room = true }: Props) {
  const uniqueId = useId().replace(/:/g, '');
  // Time is supplied by the request lifecycle; freezing it pauses every joint together.
  const t = reducedMotion ? 0 : time;
  const p = ease(t / 2);
  const walking = phase === 'walk' || phase === 'return';
  const atDocs = phase === 'documents';
  const dx = phase === 'walk' ? -310 * p : phase === 'return' ? -310 * (1 - p) : atDocs ? -310 : 0;
  const stride = walking && !reducedMotion ? q(Math.sin(t * 10)) : 0;
  const bodyY = q(walking ? -8 + Math.abs(stride) * 3 : atDocs ? -8 : Math.sin(t * 1.2) * 1.1);
  const cycle = (t % 3.8) / 3.8;
  const pageFlip = phase === 'read' ? ease((cycle - .45) / .35) : 0;
  const pageHand = cycle < .8 ? pageFlip : 1 - ease((cycle - .8) / .2);
  const reading = phase === 'read';
  const checking = q(Math.sin(t * 2.9));
  const headTilt = q(reading ? -4 + Math.sin(t * 1.8) * 3 : atDocs ? -8 + checking * 3 : phase === 'dispatch' || phase === 'web' ? 7 : phase === 'error' ? -5 : Math.sin(t * .65) * 1.4);
  const headDip = reading ? 9 : atDocs ? 5 : phase === 'error' ? 8 : 0;
  let leftWrist: Point = [594, 501];
  let rightWrist: Point = [709, 501];
  let leftElbow: Point = [552, 458];
  let rightElbow: Point = [747, 456];
  if (walking) {
    leftWrist = [566 + stride * 20, 539]; rightWrist = [735 - stride * 20, 535];
    leftElbow = [557, 456]; rightElbow = [742, 456];
  } else if (atDocs) {
    leftWrist = [501, 495]; rightWrist = [576 + checking * 6, 460 + checking * 17];
    leftElbow = [521, 429]; rightElbow = [653, 451];
  } else if (reading) {
    leftWrist = [586, 509];
    rightWrist = [mix(720, 584, pageHand), q(505 - Math.sin(pageFlip * Math.PI) * 46)];
    rightElbow = [745 - pageHand * 20, 449];
  } else if (phase === 'dispatch') {
    rightWrist = [mix(709, 817, ease(t / .35)), mix(501, 397, ease((t - .35) / .5))]; rightElbow = [mix(747, 765, ease(t / .8)), mix(456, 433, ease(t / .8))];
  } else if (phase === 'web') {
    rightWrist = [mix(817, 749, ease(t / .6)), q(mix(397, 417, ease(t / .6)) + Math.sin(t * 2) * 2)]; rightElbow = [763, mix(433, 456, ease(t / .6))];
  } else if (phase === 'present') {
    leftWrist = [mix(594, 615, p), 501 + p * 30]; rightWrist = [mix(operation === 'discover' ? 749 : 709, 707, p), mix(operation === 'discover' ? 417 : 501, 530, p)];
  } else if (phase === 'error' || phase === 'cancelled') {
    leftWrist = [578, 486]; rightWrist = [725, 485];
  }
  const shoulderLeft: Point = [580, 387 + bodyY];
  const shoulderRight: Point = [720, 387 + bodyY];
  const spiderReturning = operation === 'discover' && (phase === 'present' || phase === 'error' || phase === 'cancelled');
  const returnProgress = ease(t / 1.6);
  const spiderProgress = phase === 'dispatch' ? ease((t - .85) / 1.15) : phase === 'web' ? 1 : 0;
  const spiderX = q(spiderReturning ? mix(1060, 817, returnProgress) : phase === 'dispatch' ? mix(817, 1060, spiderProgress) : phase === 'web' ? 1060 + Math.sin(t * 1.3) * 17 : 817);
  const spiderY = q(spiderReturning ? mix(238, 495, returnProgress) - Math.sin(returnProgress * Math.PI) * 40 : phase === 'dispatch' ? mix(397, 238, spiderProgress) - Math.sin(spiderProgress * Math.PI) * 44 : phase === 'web' ? 238 + Math.sin(t * 2) * 22 : 495);
  return <div className={styles.scene} data-scene="illustrated" data-room={room} data-animation-phase={phase} data-motion-paused={paused || reducedMotion}>
    {/* The pencil room ships only where the scene owns its background; the herbarium shop paints its own layers around the puppet. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    {room && <img className={styles.room} src={`${ART}/room.png`} alt="" draggable="false" />}
    <svg className={styles.puppet} viewBox="0 0 1200 800" aria-hidden="true">
      <defs>
        <pattern id={`${uniqueId}-hatch`} width="5" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(32)"><path d="M .3 0 L 0 7 M 3 0 L 2.5 3" stroke="#615b50" strokeWidth=".65" opacity=".32" /><path d="M 0 3 L 5 2.2" stroke="#7b756a" strokeWidth=".45" opacity=".25" /></pattern>
        <linearGradient id={`${uniqueId}-shirt`}><stop stopColor="#e6e3d8" /><stop offset=".4" stopColor="#f1efe5" /><stop offset="1" stopColor="#c0bbae" /></linearGradient>
        <linearGradient id={`${uniqueId}-skin`}><stop stopColor="#ccc7b8" /><stop offset=".48" stopColor="#ebe7db" /><stop offset="1" stopColor="#d5cfc0" /></linearGradient>
        <linearGradient id={`${uniqueId}-trouser`}><stop stopColor="#55534c" /><stop offset=".5" stopColor="#77746a" /><stop offset="1" stopColor="#47453e" /></linearGradient>
        <linearGradient id={`${uniqueId}-page`}><stop stopColor="#d5d0bf" /><stop offset=".3" stopColor="#f3f0e3" /><stop offset=".52" stopColor="#ded7c5" /><stop offset=".85" stopColor="#f1eddf" /></linearGradient>
      </defs>
      <g transform={`translate(${dx} ${bodyY})`} data-part="body">
        <ellipse cx="650" cy="721" rx="65" ry="11" fill="#25231d" opacity=".2" />
        <Leg x={621} angle={stride * 15} id={uniqueId} /><Leg x={680} angle={-stride * 15} id={uniqueId} />
        <image href={`${ART}/torso.png`} x="519" y="324" width="262" height="338" />
        <g transform={`translate(650 ${355 + headDip}) rotate(${headTilt})`} data-part="head">
          <image href={`${ART}/head.png`} x="-91" y="-147" width="182" height="182" />
        </g>
      </g>
    </svg>
    {/* Desk occlusion keeps the keeper physically behind the visitor's counter. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    {room && <img className={`${styles.room} ${styles.foreground}`} src={`${ART}/room.png`} alt="" draggable="false" />}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    {room && <img className={`${styles.room} ${styles.leftForeground}`} src={`${ART}/room.png`} alt="" draggable="false" />}
    <svg className={styles.puppet} viewBox="0 0 1200 800" aria-hidden="true">
      <Book flip={pageFlip} id={uniqueId} />
      <g transform={`translate(${dx} 0)`} data-part="arms">
        <Arm shoulder={shoulderLeft} elbow={leftElbow} wrist={leftWrist} id={uniqueId} handAngle={reading ? -26 : 15} />
        <Arm shoulder={shoulderRight} elbow={rightElbow} wrist={rightWrist} id={uniqueId} handAngle={phase === 'dispatch' ? -65 : reading ? 18 - pageFlip * 38 : -25} />
        {(atDocs || phase === 'return') && <g transform={`translate(${rightWrist[0] - 28} ${rightWrist[1] - 34}) rotate(${-8 + (atDocs ? checking * 7 : stride * 4)})`} data-part="document">
          <path d="M -25 -21 L 37 -17 L 33 51 L -27 47 Z" className={styles.paper} />
          {Array.from({ length: 7 }, (_, i) => <path key={i} d={`M -16 ${-8 + i * 7} L ${i % 2 ? 20 : 27} ${-6 + i * 7}`} stroke="#999384" strokeWidth="1.3" />)}
        </g>}
      </g>
      {phase === 'present' && <g transform={`translate(650 ${524 + p * 24})`} data-part="offered-answer"><path d="M -57 -21 Q 0 -28 57 -21 L 61 27 L -60 27 Z" className={styles.paper} /><path d="M -38 -7 L 33 -7 M -38 1 L 40 1 M -38 9 L 20 9" stroke="#8c8576" strokeWidth="1.5" /><path d="M 36 13 L 42 18 L 53 5" fill="none" stroke="#77705e" strokeWidth="2" /></g>}
      {(phase === 'dispatch' && t >= .85 || phase === 'web' || spiderReturning && returnProgress < 1) && <path d={`M 1070 105 Q 1068 173 ${spiderX} ${spiderY}`} fill="none" stroke="#eeeae0" strokeWidth="1.2" />}
      <Spider x={phase === 'dispatch' && t < .85 ? 817 : spiderX} y={phase === 'dispatch' && t < .85 ? mix(495, 397, ease((t - .35) / .5)) : spiderY} gait={t * (phase === 'web' || phase === 'dispatch' || spiderReturning ? 15 : 3)} scale={.65} />
    </svg>
  </div>;
}
