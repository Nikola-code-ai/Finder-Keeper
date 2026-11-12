import type { Metadata } from 'next';
import ReaderPage from '@/components/reader-page';

export const metadata: Metadata = { title: 'A reader — Finder Keeper', description: 'A reader in the commons: their open shelves, reading flows and reviews.' };

export default async function Page({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  return <ReaderPage handle={handle} />;
}
