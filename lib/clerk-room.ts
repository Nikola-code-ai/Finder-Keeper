import type { KeeperActivity } from './keeper-choreography';

export type ClerkStyle = 'illustrated' | 'blender' | 'pixel';
export const CLERK_STYLES = [
  { id: 'illustrated', label: 'Ghibli', subtitle: 'Ink, paper & a little wonder', medium: 'Ink & graphite illustration', number: '01' },
  { id: 'blender', label: '3D / Blender', subtitle: 'A little world, built in miniature', medium: 'A rendered Blender diorama', number: '02' },
  { id: 'pixel', label: 'Pixel art', subtitle: 'Big ideas in little pixels', medium: 'High-definition pixel art', number: '03' },
] as const;

export function isClerkStyle(value: unknown): value is ClerkStyle {
  return CLERK_STYLES.some(style => style.id === value);
}

/** Request state is authoritative. Terminal events never wait for an animation. */
export function clerkPresentation(activity: KeeperActivity) {
  if (activity.active) {
    if (activity.operation === 'discover') return { pose: 'web', label: 'The spider is following your thread.', detail: 'Searching public sources for available full text.' } as const;
    if (activity.operation === 'ask') return { pose: 'reading', label: 'Keeper is reading at his desk.', detail: 'Gathering passages for an answer with sources.' } as const;
    return { pose: 'documents', label: activity.operation === 'import' ? 'Keeper is making room for your document.' : 'Keeper is checking the document desks.', detail: activity.operation === 'import' ? 'Your document is being processed.' : 'Looking through saved passages by words and meaning.' } as const;
  }
  const terminal = {
    success: ['Your findings are ready.', 'Open a result to read it in context.'],
    empty: ['No good match this time.', 'Try another question or add a document.'],
    error: ['That request needs another try.', 'Your library is still here.'],
    cancelled: ['The search has stopped.', 'Ready whenever you are.'],
  } as const;
  const copy = activity.outcome ? terminal[activity.outcome] : ['Keeper is at his desk.', 'Choose an object in the room, or start below.'];
  return { pose: 'idle', label: copy[0], detail: copy[1] } as const;
}

// Visitor-facing scene landmarks. Positions share the scene’s 3:2 coordinate space.
export const ROOM_ANCHORS = {
  illustrated: { documents: [9, 63], collection: [13, 34], book: [54, 71], spider: [87, 29], clerk: [54, 39] },
  pixel: { documents: [12, 67], collection: [15, 37], book: [62, 77], spider: [86, 48], clerk: [61, 43] },
  blender: { documents: [15, 58], collection: [15, 35], book: [50, 64], spider: [87, 37], clerk: [50, 43] },
} satisfies Record<ClerkStyle, Record<string, number[]>>;
