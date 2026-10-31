'use client';

import { createPortal } from 'react-dom';
import type { WorldRect } from '@/lib/keeper-choreography';
import {KeeperPages, type PageDrawing} from './keeper-pages';
import styles from './keeper-world.module.css';

export interface GlassSurface { id: string; node: HTMLElement; rect: WorldRect; portalRect?: WorldRect }
export interface GlassDrawing { src: string; left: number; top: number; width: number; height: number; facing: 1 | -1; pages?: PageDrawing }

/** The same drawing seen through each real folder, below its live text and controls. */
export function KeeperGlass({ surfaces, drawing, prefix }: { surfaces: GlassSurface[]; drawing: GlassDrawing; prefix: string }) {
  return surfaces.map((surface, index) => {
    const rect = surface.portalRect || surface.rect;
    const x = drawing.left - rect.left, y = drawing.top - rect.top;
    if (x >= rect.width || y >= rect.height || x + drawing.width <= 0 || y + drawing.height <= 0) return null;
    const filter = `${prefix}-glass-${index}`;
    const centerX = x + drawing.width / 2, centerY = y + drawing.height * .5;
    return createPortal(<div className={styles.glassPane} aria-hidden="true" data-keeper-refraction={surface.id}>
      <svg width="100%" height="100%" viewBox={`0 0 ${rect.width} ${rect.height}`} focusable="false">
        <defs><filter id={filter} x="-35%" y="-25%" width="170%" height="150%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.008 0.018" numOctaves="1" seed="7" result="glass-wave" />
          <feDisplacementMap in="SourceGraphic" in2="glass-wave" scale="21" xChannelSelector="R" yChannelSelector="G" />
        </filter></defs>
        <g transform={`translate(${centerX} ${centerY}) scale(1.2 .94) translate(${-centerX} ${-centerY})`} filter={`url(#${filter})`} opacity=".74">
          <image href={drawing.src} x={x} y={y} width={drawing.width} height={drawing.height} transform={drawing.facing === -1 ? `translate(${2 * x + drawing.width} 0) scale(-1 1)` : undefined} />
          {drawing.pages && <KeeperPages {...drawing.pages} x={drawing.pages.x-rect.left} y={drawing.pages.y-rect.top} />}
        </g>
        <path d={`M 20 2 H ${Math.max(20, rect.width - 22)} M 8 ${rect.height - 6} Q ${rect.width / 2} ${rect.height + 3} ${rect.width - 8} ${rect.height - 6}`} fill="none" stroke="white" strokeOpacity=".85" strokeWidth="1.5" />
      </svg>
    </div>, surface.node, surface.id);
  });
}
