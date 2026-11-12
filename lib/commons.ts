// Small helpers shared by the commons: bylines, initials, relative time, the reader's own links.
import type { FlowDocument, FlowStep, ReaderProfile } from './types';

export function authorsLine(doc?: FlowDocument | { authors?: string[] | null; is_starter?: boolean | null } | null, fallback = 'Unknown author') {
  const authors = doc?.authors || [];
  if (authors.length) return authors.slice(0, 2).join(', ') + (authors.length > 2 ? ' et al.' : '');
  return doc?.is_starter ? 'Starter note' : fallback;
}

export const initial = (profile?: ReaderProfile | null) => (profile?.display_name || profile?.handle || 'R').trim().slice(0, 1).toUpperCase();
export const readerHref = (profile?: ReaderProfile | null) => profile?.handle ? `/u/${profile.handle}` : null;

export function ago(iso?: string | null) {
  if (!iso) return '';
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60); if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60); if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24); if (days < 30) return days === 1 ? 'yesterday' : `${days} days ago`;
  const months = Math.floor(days / 30); if (months < 12) return `${months} mo ago`;
  return `${Math.floor(months / 12)} y ago`;
}

export const KIND_LABEL: Record<FlowStep['kind'], string> = { start: 'Begin', read: 'Read', choice: 'Fork', synthesize: 'Synthesize', note: 'Note' };

/** Where to send someone who wants the book a step points at but does not keep it: the library's Find Online, prefilled. */
export const findHref = (title: string) => `/?view=library&mode=discover&q=${encodeURIComponent(title)}`;
export const askHref = (query: string) => `/?view=synthesize&mode=ask&q=${encodeURIComponent(query)}`;
