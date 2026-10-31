'use client';

import { useEffect, useRef } from 'react';
import type { ClerkAnimationPhase } from '@/lib/clerk-animation';
import type { KeeperOperation } from '@/lib/keeper-choreography';
import styles from './clerk-pixel-scene.module.css';

type Point = readonly [number, number];
type SceneProps = { phase: ClerkAnimationPhase; time: number; paused: boolean; reducedMotion: boolean; operation?: KeeperOperation };
type Ink = CanvasRenderingContext2D;

// Pixel contours are rasterized explicitly. Nothing is blurred or downsampled from 3D.
const P = { ink: '#282828', dark: '#424242', shadow: '#666666', mid: '#8e8e8e', gray: '#adadad', light: '#cdcdcd', paper: '#e4e4e4', white: '#f5f5f5' };
const q = (n: number) => Math.round(n / 2) * 2;
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const smooth = (n: number) => { const x = clamp(n); return x * x * (3 - 2 * x); };
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
function rect(c: Ink, x: number, y: number, w: number, h: number, color: string) {
  c.fillStyle = color; c.fillRect(q(x), q(y), Math.max(2, q(w)), Math.max(2, q(h)));
}
function poly(c: Ink, points: readonly Point[], color: string) {
  const low = Math.floor(Math.min(...points.map(p => p[1])) / 2) * 2;
  const high = Math.max(...points.map(p => p[1]));
  for (let y = low; y < high; y += 2) {
    const cuts: number[] = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i], b = points[(i + 1) % points.length];
      if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) cuts.push(a[0] + (y - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
    }
    cuts.sort((a, b) => a - b);
    for (let i = 0; i + 1 < cuts.length; i += 2) rect(c, cuts[i], y, cuts[i + 1] - cuts[i], 2, color);
  }
}
function line(c: Ink, a: Point, b: Point, width: number, color: string) {
  const length = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
  for (let step = 0; step <= length; step += 1) {
    const t = length ? step / length : 0;
    rect(c, mix(a[0], b[0], t) - width / 2, mix(a[1], b[1], t) - width / 2, width, width, color);
  }
}
function oval(c: Ink, x: number, y: number, rx: number, ry: number, color: string) {
  for (let row = -ry; row <= ry; row += 2) {
    const span = Math.sqrt(Math.max(0, 1 - row * row / (ry * ry))) * rx;
    rect(c, x - span, y + row, span * 2, 2, color);
  }
}
function outline(c: Ink, points: readonly Point[], color = P.ink, width = 2) {
  points.forEach((point, i) => line(c, point, points[(i + 1) % points.length], width, color));
}
function label(c: Ink, text: string, x: number, y: number, size = 8, color = P.light) {
  c.fillStyle = color; c.font = `${size}px monospace`; c.textAlign = 'center'; c.fillText(text, q(x), q(y));
}
function noise(i: number) { return ((i * 15485863 + 91) % 997) / 997; }

function spine(c: Ink, x: number, y: number, w: number, h: number, seed: number) {
  const colors = [P.dark, P.shadow, P.mid, P.gray, P.light];
  const color = colors[seed % colors.length];
  rect(c, x, y - h, w, h, P.ink); rect(c, x + 2, y - h + 2, w - 4, h - 4, color);
  rect(c, x + 2, y - h + 5, w - 4, 2, seed % 2 ? P.paper : P.dark);
  rect(c, x + 2, y - 8, w - 4, 2, seed % 2 ? P.paper : P.dark);
  if (w > 10) rect(c, x + 5, y - h + 14, w - 8, Math.min(12, h - 22), seed % 2 ? P.gray : P.shadow);
}
function shelf(c: Ink, x: number, y: number, w: number, rows: number, seed: number) {
  rect(c, x + 4, y + 5, w, rows * 48 + 17, P.dark);
  rect(c, x, y, w, rows * 48 + 15, P.ink);
  rect(c, x + 6, y + 6, w - 12, rows * 48, P.shadow);
  for (let row = 0; row < rows; row++) {
    const shelfY = y + 48 * (row + 1);
    rect(c, x + 8, shelfY - 40, w - 16, 40, P.dark);
    let left = x + 10;
    let n = 0;
    while (left < x + w - 20) {
      const bookSeed = seed + row * 37 + n++;
      const width = 7 + Math.floor(noise(bookSeed) * 11);
      const height = 22 + Math.floor(noise(bookSeed + 11) * 16);
      spine(c, left, shelfY - 2, width, height, bookSeed);
      left += width + 2;
    }
    rect(c, x + 4, shelfY, w - 8, 5, P.gray); rect(c, x + 4, shelfY + 5, w - 8, 4, P.ink);
  }
  rect(c, x, y - 5, w, 7, P.gray); rect(c, x + 4, y - 3, w - 8, 2, P.paper);
  rect(c, x + 3, y + 4, 4, rows * 48 + 10, P.mid);
  rect(c, x + w - 7, y + 4, 4, rows * 48 + 10, P.mid);
}
function stack(c: Ink, x: number, y: number, w: number, h: number, count = 4) {
  for (let i = 0; i < count; i++) {
    const yy = y - i * 6;
    poly(c, [[x, yy], [x + w, yy], [x + w + 8, yy + h], [x - 7, yy + h]], P.ink);
    poly(c, [[x + 2, yy + 2], [x + w - 2, yy + 2], [x + w + 4, yy + h - 2], [x - 3, yy + h - 2]], i % 2 ? P.paper : P.light);
    line(c, [x + 10, yy + 5], [x + w - 9, yy + 5], 2, P.mid);
  }
}
function flatBook(c: Ink, x: number, y: number, w: number, h: number, color = P.shadow) {
  rect(c, x + 2, y + 4, w, h, P.ink); rect(c, x, y, w, h, color);
  rect(c, x + 3, y + h - 5, w - 4, 5, P.paper); rect(c, x, y + h, w + 2, 3, P.ink);
  rect(c, x + 5, y + 4, w - 10, 2, P.gray); rect(c, x + 3, y, 3, h, P.ink);
}
function desk(c: Ink, x: number, y: number, w: number, depth: number, height: number) {
  oval(c, x + w / 2, y + height + depth, w / 2 + 15, 14, P.mid);
  rect(c, x + 11, y + depth, 17, height, P.ink); rect(c, x + 15, y + depth, 5, height - 5, P.shadow);
  rect(c, x + w - 28, y + depth, 17, height, P.ink); rect(c, x + w - 24, y + depth, 5, height - 5, P.shadow);
  rect(c, x - 6, y + depth, w + 12, 24, P.ink); rect(c, x - 3, y + depth + 3, w + 6, 16, P.shadow);
  poly(c, [[x + 8, y], [x + w - 8, y], [x + w + 9, y + depth], [x - 9, y + depth]], P.ink);
  poly(c, [[x + 12, y + 3], [x + w - 12, y + 3], [x + w + 3, y + depth - 3], [x - 3, y + depth - 3]], P.gray);
  for (let i = 1; i < 4; i++) line(c, [x + 8, y + depth * i / 4], [x + w - 7, y + depth * i / 4], 2, P.mid);
  for (let i = 0; i < 11; i++) {
    const left = x + 12 + noise(i + 101) * (w - 70); const yy = y + 8 + noise(i + 16) * (depth - 12);
    line(c, [left, yy], [left + 12 + noise(i + 21) * 30, yy], 2, i % 2 ? P.light : P.mid);
  }
  const drawers = w > 300 ? 3 : 2;
  for (let i = 0; i < drawers; i++) {
    const dx = x + 12 + i * (w - 24) / drawers;
    rect(c, dx, y + depth + 4, (w - 34) / drawers, 14, P.mid);
    rect(c, dx + (w - 34) / drawers / 2 - 8, y + depth + 8, 16, 4, P.ink);
    rect(c, dx + (w - 34) / drawers / 2 - 5, y + depth + 8, 10, 2, P.light);
  }
}
function plant(c: Ink, x: number, y: number, scale = 1) {
  poly(c, [[x - 14 * scale, y - 20 * scale], [x + 14 * scale, y - 20 * scale], [x + 10 * scale, y], [x - 10 * scale, y]], P.dark);
  rect(c, x - 16 * scale, y - 24 * scale, 32 * scale, 6 * scale, P.gray);
  for (let i = 0; i < 8; i++) {
    const angle = i * 2.4; const tx = x + Math.sin(angle) * 27 * scale, ty = y - (28 + i * 6) * scale;
    line(c, [x, y - 20 * scale], [tx, ty], 2, P.shadow);
    oval(c, tx, ty, (7 + i % 3) * scale, 4 * scale, i % 2 ? P.shadow : P.gray);
    rect(c, tx - 3 * scale, ty, 6 * scale, 2, P.light);
  }
}

function background(c: Ink) {
  rect(c, 0, 0, 768, 512, P.paper);
  rect(c, 28, 22, 712, 464, P.ink);
  rect(c, 34, 28, 700, 450, P.light);
  poly(c, [[34, 28], [130, 70], [130, 301], [34, 376]], P.gray);
  poly(c, [[734, 28], [638, 70], [638, 301], [734, 376]], P.gray);
  rect(c, 130, 70, 508, 233, P.light);
  // Quiet wallpaper is built from individual pixel pairs.
  for (let y = 79; y < 297; y += 18) for (let x = 135; x < 637; x += 18) {
    rect(c, x, y, 2, 2, P.gray); rect(c, x + 4, y + 4, 2, 2, P.paper);
  }
  poly(c, [[34, 376], [130, 301], [638, 301], [734, 376], [734, 478], [34, 478]], P.gray);
  for (let y = 310; y < 478; y += 20) {
    const p = (y - 301) / 177; const left = mix(130, 34, Math.min(p * 2.3, 1));
    const right = 768 - left;
    line(c, [left, y], [right, y], 2, P.mid);
    for (let x = left + ((Math.round(y / 20) % 2) * 45); x < right; x += 98) {
      line(c, [x, y], [Math.max(34, x - 8), Math.min(477, y + 19)], 2, P.mid);
      if (x + 14 < right && y + 7 < 478) line(c, [x + 14, y + 7], [Math.min(right, x + 62), y + 7], 2, P.light);
      if (x + 32 < right && y + 13 < 478) line(c, [x + 32, y + 13], [Math.min(right, x + 76), y + 13], 2, P.mid);
    }
  }
  rect(c, 125, 295, 518, 10, P.shadow); rect(c, 125, 295, 518, 3, P.paper);
  line(c, [35, 366], [130, 295], 8, P.shadow); line(c, [638, 295], [733, 366], 8, P.shadow);
  // Heavy ceiling timbers frame a room at the visitor's eye level.
  rect(c, 30, 26, 708, 14, P.dark); rect(c, 35, 29, 698, 3, P.mid);
  line(c, [35, 42], [133, 80], 10, P.dark); line(c, [637, 80], [733, 42], 10, P.dark);
  rect(c, 125, 70, 518, 13, P.shadow); rect(c, 133, 72, 502, 3, P.paper);
  shelf(c, 137, 94, 144, 4, 83); shelf(c, 293, 116, 112, 3, 27);
  shelf(c, 418, 112, 128, 3, 171);
  // Cabinet under the central shelves.
  rect(c, 290, 266, 260, 32, P.dark);
  for (let i = 0; i < 4; i++) { rect(c, 298 + i * 62, 271, 55, 23, P.shadow); rect(c, 320 + i * 62, 281, 12, 3, P.light); }
  // Left wall pigeonholes and an actual second document desk.
  poly(c, [[45, 115], [116, 140], [116, 280], [45, 315]], P.dark);
  for (let row = 0; row < 5; row++) for (let col = 0; col < 2; col++) {
    const x = 51 + col * 32, y = 126 + row * 31 + col * 7;
    rect(c, x, y, 25, 22, P.ink); rect(c, x + 3, y + 5, 19, 3, P.light);
    rect(c, x + 3, y + 11, 17, 2, P.gray); rect(c, x + 3, y + 16, 21, 3, P.paper);
  }
  // The round-topped window faces the outgoing spider.
  oval(c, 656, 130, 57, 61, P.ink); rect(c, 599, 127, 114, 127, P.ink);
  oval(c, 656, 130, 49, 53, P.paper); rect(c, 607, 127, 98, 117, P.paper);
  poly(c, [[608, 220], [627, 185], [645, 210], [670, 170], [705, 207], [705, 245], [608, 245]], P.light);
  poly(c, [[608, 237], [644, 210], [671, 232], [690, 203], [705, 217], [705, 245], [608, 245]], P.gray);
  rect(c, 651, 79, 8, 167, P.shadow); rect(c, 606, 148, 100, 7, P.shadow); rect(c, 606, 202, 100, 6, P.shadow);
  rect(c, 654, 83, 2, 160, P.white); rect(c, 608, 150, 96, 2, P.white);
  rect(c, 594, 246, 126, 10, P.ink); rect(c, 592, 244, 130, 5, P.paper);
  // Soft curtain folds remain pixel art rather than screen-space effects.
  poly(c, [[587, 89], [610, 79], [603, 139], [588, 212], [578, 208]], P.paper);
  line(c, [596, 94], [583, 206], 2, P.mid); line(c, [603, 92], [589, 198], 2, P.gray);
  poly(c, [[707, 82], [725, 91], [732, 209], [716, 211], [710, 151]], P.paper);
  line(c, [719, 94], [726, 206], 2, P.mid); rect(c, 577, 206, 15, 5, P.dark); rect(c, 714, 206, 18, 5, P.dark);
  // Small clock, framed keepsakes and hand-lettered shop plate.
  oval(c, 354, 84, 19, 19, P.ink); oval(c, 354, 84, 15, 15, P.paper);
  line(c, [354, 84], [354, 73], 2, P.dark); line(c, [354, 84], [363, 88], 2, P.dark);
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; rect(c, 353 + Math.cos(a) * 11, 83 + Math.sin(a) * 11, 2, 2, P.dark); }
  rect(c, 425, 86, 112, 18, P.dark); rect(c, 428, 89, 106, 12, P.paper); label(c, 'THE READING ROOM', 481, 98, 7, P.shadow);
  rect(c, 298, 98, 27, 14, P.dark); rect(c, 301, 101, 21, 8, P.gray);
  plant(c, 571, 300, 1.2);
  // Patterned rug and the keeper's chair establish the visitor-side perspective.
  poly(c, [[280, 337], [621, 337], [698, 457], [224, 457]], P.shadow);
  poly(c, [[289, 343], [612, 343], [685, 449], [237, 449]], P.light);
  poly(c, [[299, 349], [603, 349], [670, 441], [250, 441]], P.gray);
  for (let i = 0; i < 13; i++) {
    const x = 258 + i * 31; poly(c, [[x, 432], [x + 7, 426], [x + 14, 432], [x + 7, 438]], P.shadow);
  }
  for (let i = 0; i < 25; i++) { line(c, [234 + i * 18, 455], [232 + i * 18, 461], 2, P.paper); }
  oval(c, 470, 266, 47, 51, P.ink); oval(c, 470, 266, 41, 45, P.shadow);
  rect(c, 424, 263, 92, 89, P.ink); rect(c, 431, 266, 78, 71, P.shadow);
  for (let i = 0; i < 5; i++) rect(c, 439 + i * 14, 266, 3, 65, P.mid);
  rect(c, 425, 349, 10, 44, P.dark); rect(c, 506, 349, 10, 44, P.dark);
}

function paper(c: Ink, x: number, y: number, w: number, h: number, lift = 0) {
  const points: Point[] = [[x - w / 2, y - h + lift], [x + w / 2, y - h], [x + w / 2 + 3, y], [x - w / 2 - 3, y + lift]];
  poly(c, points, P.white); outline(c, points, P.shadow);
  for (let i = 0; i < 4; i++) line(c, [x - w / 2 + 6, y - h + 8 + i * 7 + lift / 2], [x + w / 2 - 7 - (i % 2) * 7, y - h + 8 + i * 7], 2, P.gray);
}
function arm(c: Ink, shoulder: Point, elbow: Point, wrist: Point) {
  line(c, shoulder, elbow, 25, P.ink); line(c, shoulder, elbow, 20, P.paper);
  line(c, [shoulder[0] - 3, shoulder[1] + 1], [elbow[0] - 3, elbow[1] - 2], 4, P.light);
  oval(c, elbow[0], elbow[1], 12, 9, P.ink); oval(c, elbow[0], elbow[1], 9, 6, P.light);
  line(c, elbow, wrist, 15, P.ink); line(c, elbow, wrist, 11, P.paper);
  oval(c, wrist[0], wrist[1], 9, 7, P.ink); oval(c, wrist[0], wrist[1], 7, 5, P.light);
  for (let i = 0; i < 3; i++) rect(c, wrist[0] - 4 + i * 3, wrist[1] + 2, 2, 3, P.mid);
}
function face(c: Ink, x: number, y: number, t: number, look: Point, worried: boolean, reading: boolean) {
  // Bald dome, white side curls, round spectacles, moustache and a soft smile.
  oval(c, x, y, 33, 38, P.ink); oval(c, x, y - 1, 30, 35, P.paper);
  oval(c, x - 31, y + 4, 7, 11, P.ink); oval(c, x + 31, y + 4, 7, 11, P.ink);
  oval(c, x - 31, y + 4, 4, 7, P.light); oval(c, x + 31, y + 4, 4, 7, P.light);
  oval(c, x - 26, y - 10, 9, 20, P.white); oval(c, x + 26, y - 10, 9, 20, P.white);
  for (let i = 0; i < 5; i++) {
    rect(c, x - 34 + i % 2 * 2, y - 20 + i * 6, 5, 2, P.gray);
    rect(c, x + 29 - i % 2 * 2, y - 20 + i * 6, 5, 2, P.gray);
  }
  line(c, [x - 13, y - 28], [x + 9, y - 28], 2, P.light);
  line(c, [x - 8, y - 23], [x + 13, y - 23], 2, P.gray);
  const eyeY = y - 2 + (reading ? 4 : 0);
  oval(c, x - 14, eyeY, 12, 10, P.ink); oval(c, x + 14, eyeY, 12, 10, P.ink);
  oval(c, x - 14, eyeY, 9, 7, P.white); oval(c, x + 14, eyeY, 9, 7, P.white);
  line(c, [x - 2, eyeY - 2], [x + 2, eyeY - 2], 2, P.ink);
  line(c, [x - 27, eyeY - 3], [x - 32, y - 6], 2, P.ink); line(c, [x + 27, eyeY - 3], [x + 32, y - 6], 2, P.ink);
  const blink = t % 5.7 > 5.45;
  for (const side of [-1, 1]) {
    const ex = x + side * 14 + look[0], ey = eyeY + look[1];
    if (blink) line(c, [ex - 4, ey], [ex + 4, ey], 2, P.dark);
    else { rect(c, ex - 2, ey - 3, 4, 6, P.ink); rect(c, ex - 1, ey - 3, 2, 2, P.paper); }
  }
  line(c, [x - 23, eyeY - 12], [x - 7, eyeY - 14 + (worried ? 5 : 0)], 3, P.gray);
  line(c, [x + 7, eyeY - 14 + (worried ? 5 : 0)], [x + 23, eyeY - 12], 3, P.gray);
  oval(c, x + look[0] / 2, y + 11, 7, 7, P.gray); oval(c, x - 1 + look[0] / 2, y + 9, 6, 6, P.paper);
  poly(c, [[x - 26, y + 12], [x - 21, y + 32], [x - 10, y + 42], [x + 9, y + 42], [x + 23, y + 31], [x + 27, y + 12], [x + 14, y + 19], [x - 12, y + 19]], P.ink);
  poly(c, [[x - 23, y + 14], [x - 18, y + 31], [x - 8, y + 38], [x + 8, y + 38], [x + 20, y + 29], [x + 24, y + 14], [x + 12, y + 21], [x - 12, y + 21]], P.white);
  oval(c, x - 8, y + 19, 9, 4, P.light); oval(c, x + 8, y + 19, 9, 4, P.light);
  line(c, [x - 8, y + 26], [x - 3, y + 29 - (worried ? 5 : 0)], 2, P.shadow);
  line(c, [x - 3, y + 29 - (worried ? 5 : 0)], [x + 6, y + 27], 2, P.shadow);
  for (let i = 0; i < 5; i++) rect(c, x - 15 + i * 7, y + 30 + (i % 2) * 3, 2, 4, P.light);
}

function openBook(c: Ink, t: number, reading: boolean) {
  poly(c, [[421, 335], [474, 330], [526, 335], [536, 374], [476, 370], [413, 375]], P.ink);
  poly(c, [[425, 333], [474, 331], [476, 367], [417, 370]], P.paper);
  poly(c, [[476, 331], [523, 335], [531, 369], [476, 367]], P.white);
  line(c, [475, 332], [476, 368], 2, P.gray);
  for (let i = 0; i < 5; i++) {
    line(c, [429 - i, 341 + i * 5], [467, 338 + i * 5], 2, P.gray);
    line(c, [483, 338 + i * 5], [517 + i, 342 + i * 5], 2, P.gray);
  }
  if (reading) {
    const turn = clamp(((t % 4.6) - 2) / 1.25);
    if (turn > 0 && turn < 1) {
      const dx = Math.cos(turn * Math.PI) * 48, lift = Math.sin(turn * Math.PI) * 35;
      const points: Point[] = [[476, 332], [476 + dx, 333 - lift], [479 + dx, 368 - lift * .45], [476, 367]];
      poly(c, points, turn < .5 ? P.paper : P.white); outline(c, points, P.mid);
      for (let i = 0; i < 4; i++) line(c, [478, 340 + i * 5], [476 + dx * .8, 341 + i * 5 - lift * .75], 2, P.gray);
    }
  }
}
function spider(c: Ink, x: number, y: number, t: number) {
  for (let side = -1; side <= 1; side += 2) for (let leg = 0; leg < 4; leg++) {
    const stride = Math.sin(t * 16 + leg * 1.8 + side) * 4;
    const start: Point = [x + side * 4, y - 4 + leg * 3];
    const joint: Point = [x + side * (12 + (leg % 2) * 3), y - 11 + leg * 6 + stride];
    const end: Point = [x + side * (18 + (leg % 2) * 3), y - 6 + leg * 5 - stride];
    line(c, start, joint, 2, P.ink); line(c, joint, end, 2, P.ink);
  }
  oval(c, x, y - 3, 9, 9, P.ink); oval(c, x - 1, y - 5, 5, 5, P.shadow);
  oval(c, x, y + 5, 6, 5, P.ink); rect(c, x - 4, y + 3, 2, 2, P.white); rect(c, x + 2, y + 3, 2, 2, P.white);
}

export function paintClerkPixelScene(c: Ink, phase: ClerkAnimationPhase, time: number, still = false, back?: CanvasImageSource, operation?: KeeperOperation) {
  const t = Math.floor((still ? 0 : Math.max(0, time)) * 12) / 12;
  c.imageSmoothingEnabled = false;
  if (back) c.drawImage(back, 0, 0); else background(c);
  const walking = phase === 'walk' || phase === 'return';
  const docs = phase === 'documents'; const reading = phase === 'read';
  const progress = smooth(t / 2); const gait = Math.sin(t * 12);
  const x = docs ? 178 : phase === 'walk' ? mix(470, 178, progress) : phase === 'return' ? mix(178, 470, progress) : 470;
  const stand = walking ? Math.sin(progress * Math.PI) * 17 : 0;
  const y = (docs ? 324 : walking ? mix(340, 324, phase === 'walk' ? progress : 1 - progress) : 340) - stand + (walking ? Math.abs(gait) * -3 : Math.sin(t * 2) * 1.5);
  const shoulderY = y - 76;
  // Shoes, knees and hips move separately, and cross each other as he takes steps.
  for (const side of [-1, 1]) {
    const hip: Point = [x + side * 16, y - 5];
    const knee: Point = [x + side * 18 + (walking ? gait * side * 13 : 0), y + 26 + stand * .8];
    const foot: Point = [x + side * 20 + (walking ? gait * side * 20 : 0), y + 51 + stand * 2.1 - (walking ? Math.max(0, gait * side) * 10 : 0)];
    line(c, hip, knee, 20, P.ink); line(c, hip, knee, 14, P.dark); line(c, knee, foot, 15, P.ink); line(c, knee, foot, 10, P.shadow);
    oval(c, foot[0] + side * 4, foot[1], 17, 8, P.ink); line(c, [foot[0] - 9, foot[1] - 3], [foot[0] + 8, foot[1] - 3], 2, P.mid);
  }
  poly(c, [[x - 30, shoulderY - 4], [x + 30, shoulderY - 4], [x + 42, y - 12], [x + 26, y + 9], [x - 26, y + 9], [x - 42, y - 12]], P.ink);
  poly(c, [[x - 28, shoulderY], [x + 28, shoulderY], [x + 34, y - 9], [x - 34, y - 9]], P.paper);
  // Dark waistcoat, collars and a tied apron match the old bookseller reference.
  poly(c, [[x - 29, shoulderY + 1], [x - 12, shoulderY - 7], [x, shoulderY + 24], [x + 12, shoulderY - 7], [x + 29, shoulderY + 1], [x + 29, y - 6], [x - 29, y - 6]], P.dark);
  poly(c, [[x - 12, shoulderY - 7], [x - 22, shoulderY + 6], [x - 10, shoulderY + 15], [x, shoulderY + 24]], P.white);
  poly(c, [[x + 12, shoulderY - 7], [x + 22, shoulderY + 6], [x + 10, shoulderY + 15], [x, shoulderY + 24]], P.white);
  for (let i = 0; i < 3; i++) rect(c, x, shoulderY + 28 + i * 12, 3, 3, P.paper);
  poly(c, [[x - 31, y - 27], [x + 31, y - 27], [x + 37, y + 16], [x - 39, y + 16]], P.light);
  rect(c, x - 31, y - 27, 62, 5, P.white);
  for (let i = 0; i < 5; i++) line(c, [x - 25 + i * 12, y - 16], [x - 28 + i * 14, y + 12], 2, P.gray);
  rect(c, x - 15, y - 15, 26, 17, P.gray); rect(c, x - 12, y - 15, 20, 14, P.paper);
  const look: Point = docs ? [3, 3] : reading ? [Math.sin(t * 1.6) * 2, 3] : phase === 'web' || phase === 'dispatch' ? [4, -1] : [0, 0];
  const headX = x + (docs ? 6 : reading ? Math.sin(t * 1.6) * 2 : 0);
  const headY = shoulderY - 45 + (reading ? 7 : docs ? 3 : 0);
  face(c, headX, headY, t, look, phase === 'error', reading);
  let left: Point = [x - 34, y - 4], right: Point = [x + 38, y - 4];
  let leftElbow: Point = [x - 47, y - 35], rightElbow: Point = [x + 48, y - 34];
  let lift = 0;
  if (walking) {
    left = [x - 42 + gait * 11, y - 3]; right = [x + 42 - gait * 11, y - 3];
  } else if (docs) {
    lift = Math.max(0, Math.sin(t * 1.8)) * 42;
    left = [x - 17, 338]; right = [x + 34, 337 - lift]; rightElbow = [x + 49, y - 31 - lift * .3];
  } else if (phase === 'dispatch') {
    const reach = Math.sin(clamp(t / 2) * Math.PI);
    right = [x + 47 + reach * 81, y - 7 - reach * 40]; rightElbow = [x + 57 + reach * 15, y - 39];
  } else if (reading) {
    const turn = clamp(((t % 4.6) - 2) / 1.25);
    right = turn > 0 && turn < 1 ? [476 + Math.cos(turn * Math.PI) * 44, 345 - Math.sin(turn * Math.PI) * 30] : [514, 347];
    left = [434, 348];
  } else if (phase === 'present') {
    const offer = smooth(t / .8); left = [x - 31, y + offer * 23]; right = [x + 31, y + offer * 23];
  } else if (phase === 'error') {
    const open = smooth(t / .85);
    left = [x - 34 - open * 24, y - 4 - open * 15]; right = [x + 38 + open * 22, y - 4 - open * 15];
    leftElbow = [x - 46, y - 34]; rightElbow = [x + 47, y - 34];
  } else if (phase === 'cancelled') {
    const settle = smooth(t / 1.3); const reach = Math.sin(settle * Math.PI);
    left = [x - 37, y - 10 + settle * 7]; right = [x + 38 - reach * 16, y - 10 + settle * 7];
  }
  // Arms are behind desk tops while walking; hands are redrawn over props at work.
  if (walking) {
    arm(c, [x - 28, shoulderY + 5], leftElbow, left); arm(c, [x + 28, shoulderY + 5], rightElbow, right);
    if (phase === 'return') paper(c, x - 40, y + 9, 28, 38);
  }
  desk(c, 50, 321, 180, 41, 53);
  stack(c, 63, 334, 44, 14, 5); stack(c, 188, 334, 34, 13, docs ? 4 : 5);
  flatBook(c, 94, 355, 42, 10); rect(c, 142, 331, 49, 4, P.paper);
  label(c, 'DOCUMENTS', 140, 379, 7, P.paper);
  desk(c, 299, 321, 351, 68, 56);
  // A few carefully placed desk objects leave the book and hands legible.
  flatBook(c, 322, 349, 56, 14, P.dark); flatBook(c, 328, 335, 49, 13, P.mid);
  flatBook(c, 552, 348, 55, 13, P.shadow); flatBook(c, 557, 335, 48, 11, P.dark);
  rect(c, 389, 331, 15, 16, P.ink); oval(c, 396, 331, 8, 4, P.shadow);
  line(c, [394, 332], [389, 308], 3, P.dark); line(c, [399, 332], [403, 306], 2, P.dark);
  // Desk lamp and porcelain cup.
  oval(c, 626, 346, 15, 6, P.ink); rect(c, 623, 282, 5, 63, P.dark);
  poly(c, [[608, 274], [640, 274], [649, 295], [600, 295]], P.ink);
  poly(c, [[611, 276], [637, 276], [643, 290], [605, 290]], P.paper); rect(c, 602, 293, 44, 3, P.gray);
  oval(c, 414, 361, 12, 5, P.dark); rect(c, 406, 347, 15, 14, P.paper);
  oval(c, 414, 346, 8, 4, P.ink); oval(c, 414, 345, 6, 2, P.shadow);
  line(c, [423, 348], [427, 348], 2, P.paper); line(c, [427, 348], [427, 356], 2, P.paper); line(c, [427, 356], [421, 356], 2, P.paper);
  openBook(c, t, reading);
  if (!walking) {
    arm(c, [x - 28, shoulderY + 5], leftElbow, left); arm(c, [x + 28, shoulderY + 5], rightElbow, right);
    if (docs) {
      paper(c, x + 16, 335 - lift, 39, 32, Math.sin(t * 1.8) * 4);
      oval(c, right[0] - 2, right[1], 6, 5, P.light);
      const shuffle = Math.sin(t * 3.6) * 5;
      rect(c, x - 47 + shuffle, 337, 33, 3, P.white);
    }
    if (phase === 'present') {
      const offer = smooth(t / .8); paper(c, x, y + 31 * offer, 58 + offer * 6, 37, 0);
      oval(c, left[0], left[1], 8, 5, P.light); oval(c, right[0], right[1], 8, 5, P.light);
    }
    if (phase === 'error') {
      for (const wrist of [left, right]) {
        oval(c, wrist[0], wrist[1] - 2, 11, 5, P.ink); oval(c, wrist[0], wrist[1] - 3, 9, 3, P.paper);
        line(c, [wrist[0] - 5, wrist[1] - 3], [wrist[0] + 5, wrist[1] - 3], 2, P.gray);
      }
    }
  }
  if (phase === 'dispatch') {
    const progress = smooth((t - .35) / 1.65);
    const sx = mix(542, 662, progress), sy = mix(334, 233, progress) - Math.sin(progress * Math.PI) * 22;
    if (progress > .35) line(c, [662, 111], [sx, sy], 2, P.gray);
    spider(c, sx, sy, t);
  } else if (phase === 'web') {
    const sx = 663 + Math.sin(t * .9) * 15, sy = 223 + Math.sin(t * 1.4) * 22;
    line(c, [663, 111], [sx, sy], 2, P.mid); spider(c, sx, sy, t);
  } else if (operation === 'discover' && (phase === 'present' || phase === 'error' || phase === 'cancelled')) {
    const home = smooth(t / 1.25); const sx = mix(663, 542, home), sy = mix(233, 332, home);
    if (home < 1) line(c, [663, 111], [sx, sy], 2, P.gray);
    spider(c, sx, sy, home < 1 ? t : 0);
  } else spider(c, 542, 332, 0);
  // Foreground counter feet and potted greenery frame the visitor's point of view.
  plant(c, 698, 425, 1.15);
  flatBook(c, 59, 447, 61, 17, P.shadow); flatBook(c, 64, 430, 55, 15, P.dark);
  rect(c, 35, 478, 698, 4, P.paper);
}

export default function ClerkPixelScene({ phase, time, paused, reducedMotion, operation }: SceneProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const backdrop = useRef<HTMLCanvasElement | null>(null);
  const lastPaint = useRef('');
  useEffect(() => {
    const frame = `${phase}/${reducedMotion ? 0 : Math.floor(time * 12)}/${operation ?? ''}`;
    if (lastPaint.current === frame) return;
    const context = canvas.current?.getContext('2d', { alpha: false });
    if (!context) return;
    if (!backdrop.current) {
      const cached = document.createElement('canvas'); cached.width = 768; cached.height = 512;
      const cachedContext = cached.getContext('2d', { alpha: false });
      if (cachedContext) background(cachedContext);
      backdrop.current = cached;
    }
    paintClerkPixelScene(context, phase, time, reducedMotion, backdrop.current, operation);
    lastPaint.current = frame;
  }, [phase, time, reducedMotion, operation]);
  return <canvas ref={canvas} width={768} height={512} className={styles.scene} role="img" aria-label="A friendly elderly shopkeeper faces you across his desk in a detailed black and white pixel art bookshop." data-phase={phase} data-paused={paused} />;
}
