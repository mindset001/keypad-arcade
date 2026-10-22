import { Press_Start_2P, VT323 } from 'next/font/google';
import './globals.css';
import { EARLY_SCRIPT } from '../lib/arcade/touch.js';

const pixel = Press_Start_2P({ weight: '400', subsets: ['latin'], variable: '--font-pixel', display: 'swap' });
const lcd = VT323({ weight: '400', subsets: ['latin'], variable: '--font-lcd', display: 'swap' });

export const metadata = {
  title: 'Keypad Arcade — a Demlinks game',
  description: 'Five classic phone games on one Nokia-style handset: Snake Xenzia, Rapid Roll, Bounce, Soccer League and Table Tennis. Play free in your browser. Made by Demlinks.',
  authors: [{ name: 'Demlinks' }],
  creator: 'Demlinks',
  publisher: 'Demlinks',
};

export const viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }) {
  return (
    /* suppressHydrationWarning: the inline script in <head> sets data-controls / data-theme on <html> before React hydrates */
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning className={`${pixel.variable} ${lcd.variable}`}>
      <head><script dangerouslySetInnerHTML={{ __html: EARLY_SCRIPT }} /></head>
      <body>{children}</body>
    </html>
  );
}
