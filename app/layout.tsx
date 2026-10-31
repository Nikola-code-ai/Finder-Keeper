import type { Metadata } from 'next';
import './globals.css';
import { DM_Sans, Bangers, Comic_Neue, Architects_Daughter, Special_Elite } from 'next/font/google';
const sans = DM_Sans({ subsets: ['latin'], variable: '--font-sans' });
const manga = Bangers({ weight: '400', subsets: ['latin'], variable: '--font-manga', display: 'swap' });
const lettering = Comic_Neue({ weight: ['400', '700'], subsets: ['latin'], variable: '--font-lettering', display: 'swap' });
// The shop's two hands: pencil lettering for what is written by hand, a typewriter for what the Keeper types on his cards.
const hand = Architects_Daughter({ weight: '400', subsets: ['latin'], variable: '--font-hand', display: 'swap' });
const type = Special_Elite({ weight: '400', subsets: ['latin'], variable: '--font-type', display: 'swap' });
export const metadata: Metadata = {
  title: 'Finder Keeper — A home for curious minds',
  description: 'Find a good read. Keep a good idea. Your personal document library, with a little help from the Keeper.',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" className={`${sans.variable} ${manga.variable} ${lettering.variable} ${hand.variable} ${type.variable}`}><body>{children}</body></html>;
}
