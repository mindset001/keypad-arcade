import { Press_Start_2P, VT323 } from 'next/font/google';
import './globals.css';

const pixel = Press_Start_2P({ weight: '400', subsets: ['latin'], variable: '--font-pixel', display: 'swap' });
const lcd = VT323({ weight: '400', subsets: ['latin'], variable: '--font-lcd', display: 'swap' });

export const metadata = {
  title: 'Keypad Arcade — a Demlinks game',
  description: 'Snake Xenzia, Rapid Roll and Bounce in a Nokia-style handset. Made by Demlinks.',
  authors: [{ name: 'Demlinks' }],
  creator: 'Demlinks',
  publisher: 'Demlinks',
};

export const viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${pixel.variable} ${lcd.variable}`}>
      <body>{children}</body>
    </html>
  );
}
