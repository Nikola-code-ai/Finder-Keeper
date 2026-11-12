import type { Metadata } from 'next';
import OpenShelf from '@/components/open-shelf';

export const metadata: Metadata = { title: 'An open shelf — Finder Keeper', description: 'A collection opened to the commons: its catalogue, and the works whose licences let them be read here.' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OpenShelf id={id} />;
}
