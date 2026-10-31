import type { CSSProperties, ReactNode } from 'react';
import styles from './bookseller-room.module.css';

/** A still illustration with the seated hip resting on the counter edge. */
export function Bookseller({ height = 290 }: { height?: number }) {
  return <span className={styles.bookseller} data-bookseller-pose="idle" aria-hidden="true" style={{ '--actor-height': `${height}px` } as CSSProperties}>
    {/* Native images preserve the calibrated transparent canvas. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src="/characters/ui-studies/bookseller-idle.webp" alt="" draggable={false} width={384} height={480} />
  </span>;
}

/** Drawer state follows the user's click directly. */
export function LibraryDrawer({ id, open, children }: { id: string; open: boolean; children: ReactNode }) {
  return <div className={styles.folderSlot} data-library-drawer={id} data-open={open}>
    {children}
  </div>;
}
