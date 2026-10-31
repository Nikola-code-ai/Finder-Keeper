import type { Metadata } from 'next';
import SharedShelf from '@/components/shared-shelf';

export const metadata: Metadata = { title: 'A lent shelf — Finder Keeper', description: 'A collection someone opened to you, read-only.' };

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <SharedShelf token={token} />;
}
