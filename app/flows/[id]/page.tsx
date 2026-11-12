import type { Metadata } from 'next';
import PublicFlow from '@/components/public-flow';

export const metadata: Metadata = { title: 'A reading flow — Finder Keeper', description: 'A path through a library, with forks, laid out by the Keeper and walked by its readers.' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PublicFlow id={id} />;
}
