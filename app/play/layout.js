import { EARLY_SCRIPT } from '../../lib/arcade/touch.js';

export const metadata = {
  title: 'Play — Keypad Arcade',
  description: 'Snake Xenzia, Rapid Roll, Bounce and Soccer League on a Nokia-style handset, with keypad or touch controls.',
};

/* suppressHydrationWarning: the inline script sets data-controls / data-theme on this element before React hydrates */
export default function PlayLayout({ children }) {
  return (
    <div className="desk" suppressHydrationWarning>
      <script dangerouslySetInnerHTML={{ __html: EARLY_SCRIPT }} />
      {children}
    </div>
  );
}
