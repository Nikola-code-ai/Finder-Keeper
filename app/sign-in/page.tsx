import type { Metadata } from 'next';
import SignIn from '@/components/sign-in';

export const metadata: Metadata = { title: 'Come in — Finder Keeper', description: 'Sign in to open your library: find, keep, and ask, with the Keeper and his spider.' };

export default function Page() { return <SignIn />; }
