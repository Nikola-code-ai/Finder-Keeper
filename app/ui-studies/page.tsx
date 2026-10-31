import type { Metadata } from 'next';
import UIStudies from '@/components/ui-studies/gallery';

export const metadata: Metadata = { title: 'Five little worlds — Finder Keeper', description: 'Five playable ink-and-paper directions for Finder Keeper, with new character concepts.' };
export default function Page() { return <UIStudies />; }
