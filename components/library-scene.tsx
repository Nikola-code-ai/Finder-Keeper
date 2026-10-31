'use client';

import { ArrowUpRight, Check, CircleHelp, Globe2, Search, X } from 'lucide-react';
import Image from 'next/image';
import type { KeeperActivity } from '@/lib/keeper-choreography';
import styles from './reading-room.module.css';
import activityStyles from './bookseller-room.module.css';

/** Pip the cat peeks through the window; his pose follows the actual online request. */
export function ScoutWindow({ active, paused, onExplore }: { active: boolean; paused: boolean; onExplore: () => void }) {
  return <button type="button" className={styles.scoutWindow} data-keeper-anchor="portal" data-working={active} data-paused={paused} onClick={onExplore} aria-label="Visit Pip’s window and find sources online">
    <span className={styles.windowSky} aria-hidden="true"><i /><b /><em /></span>
    <span className={styles.scout} aria-hidden="true">
      <span className={styles.scoutBody}>
        <Image src="/characters/pip-cat-idle.png" alt="" fill sizes="120px" loading="eager" draggable={false} className={`${styles.scoutFrame} ${styles.scoutIdle}`} />
        <Image src="/characters/pip-cat-search.png" alt="" fill sizes="120px" loading="eager" draggable={false} className={`${styles.scoutFrame} ${styles.scoutSearching}`} />
      </span>
    </span>
    <span className={styles.windowLabel}><strong>Pip’s lookout <ArrowUpRight size={12} /></strong><small>{active ? 'Looking for open sources…' : 'Find sources online'}</small></span>
  </button>;
}

const places = { discover: 'Finding online sources', search: 'Searching your collection', ask: 'Reading for your answer', import: 'Adding to your collection' };
const waiting = { discover: 'Checking public sources for readable full text.', search: 'Matching your question to saved passages.', ask: 'Finding evidence and preparing a sourced response.', import: 'Preparing your document for the library.' };

export function RequestActivity({ activity, query, paused }: { activity: KeeperActivity; query: string; paused: boolean }) {
  const outcome = activity.outcome;
  const title = activity.active ? places[activity.operation] : outcome === 'success' ? 'Your request is ready' : outcome === 'empty' ? 'No matching evidence yet' : outcome === 'error' ? 'This request needs another try' : outcome === 'cancelled' ? 'Request cancelled' : 'Meet your research companions';
  const detail = activity.active ? activity.status || waiting[activity.operation] : outcome ? activity.status || (outcome === 'success' ? 'Open a result below to follow the source.' : outcome === 'empty' ? 'Try another description or add a document about this topic.' : outcome === 'cancelled' ? 'Keeper has stopped. Your library is unchanged.' : 'See the error message for details.') : 'The bookseller keeps your documents in the drawers below. The spider follows threads beyond the shop. Open a drawer, or start with a question.';
  return <div className={activityStyles.requestActivity} data-active={activity.active} data-outcome={outcome}>
    <span className={activityStyles.activitySymbol} aria-hidden="true">{activity.active ? activity.operation === 'discover' ? <Globe2 size={19} /> : <Search size={19} /> : outcome === 'success' ? <Check size={19} /> : outcome === 'error' || outcome === 'empty' ? <CircleHelp size={19} /> : outcome === 'cancelled' ? <X size={19} /> : <span>✳</span>}</span>
    <div role="status" aria-live="polite" aria-atomic="true"><strong>{title}</strong><p>{detail}</p>{activity.id > 0 && query && activity.operation !== 'import' && <small className={activityStyles.requestQuery}>“{query}”</small>}</div>
    {paused && <span className={activityStyles.pauseNote}>Motion paused · requests still run</span>}
  </div>;
}
