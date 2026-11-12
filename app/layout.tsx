import type { Metadata } from 'next';
import './globals.css';
import { DM_Sans, Bangers, Comic_Neue, EB_Garamond, Newsreader, Inter, JetBrains_Mono } from 'next/font/google';
const sans = DM_Sans({ subsets: ['latin'], variable: '--font-sans' });
const manga = Bangers({ weight: '400', subsets: ['latin'], variable: '--font-manga', display: 'swap' });
const lettering = Comic_Neue({ weight: ['400', '700'], subsets: ['latin'], variable: '--font-lettering', display: 'swap' });
// The shop's one academic face, in three voices: roman for reading, italic for titles and your own writing, small caps for labels.
const academic = EB_Garamond({ weight: ['400', '500', '600'], style: ['normal', 'italic'], subsets: ['latin'], variable: '--font-academic', display: 'swap' });
// The reading room's three voices (from the Stitch design): Newsreader for titles and quotes, Inter for controls, JetBrains Mono for catalogue marks.
const newsreader = Newsreader({ subsets: ['latin'], style: ['normal', 'italic'], variable: '--font-newsreader', display: 'swap' });
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });
export const metadata: Metadata = {
  title: 'Finder Keeper — A home for curious minds',
  description: 'Find a good read. Keep a good idea. Your personal document library, with a little help from the Keeper.',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" className={`${sans.variable} ${manga.variable} ${lettering.variable} ${academic.variable} ${newsreader.variable} ${inter.variable} ${mono.variable}`}><body>{children}</body></html>;
}
