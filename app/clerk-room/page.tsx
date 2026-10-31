import type { Metadata } from 'next';
import LibraryApp from '@/components/library-app';

export const metadata: Metadata = {
  title: 'The shop — Finder Keeper',
  description: 'An old bookshop wider than your window. Send the spider, check the desks, or ask the book.',
};

export default function Page() { return <LibraryApp view="counter" />; }
