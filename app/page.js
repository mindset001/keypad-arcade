import Link from 'next/link';
import Hero from './landing/Hero';
import Reveal from './landing/Reveal';
import Tilt from './landing/Tilt';
import './landing/landing.css';

export const metadata = {
  title: 'Keypad Arcade — four classic phone games, one handset',
  description: 'Snake Xenzia, Rapid Roll, Bounce and Soccer League on a Nokia-style handset. Play free in your browser, climb the leaderboards and win the league. A Demlinks game.',
};

const px = { shapeRendering: 'crispEdges' };

const GAMES = [
  {
    id: 'snake', name: 'Snake Xenzia', tag: 'Eat. Grow. Do not crash.',
    text: 'The one everybody remembers. Guide the snake, grab food, and catch the bug that appears every fifth bite for a big bonus. Pick a speed from 1 to 9 and one of five mazes.',
    tips: ['Turn with the arrow keys or 2 4 6 8', 'No maze: the edges wrap around', 'Higher levels score more'],
    art: (
      <svg viewBox="0 0 48 32" {...px}><path fill="currentColor" d="M4 20h24v4H4zM24 8h4v16h-4zM24 8h16v4H24zM36 8h4v4h-4z"/><path fill="var(--coral)" d="M42 20h4v4h-4z"/><path fill="var(--lcd-lit)" d="M37 9h1v1h-1z"/></svg>
    ),
  },
  {
    id: 'roll', name: 'Rapid Roll', tag: 'Keep falling, keep living.',
    text: 'The platforms keep scrolling up and the ceiling is covered in spikes. Steer your ball from ledge to ledge, dodge the spiked platforms and land on hearts to win lives back.',
    tips: ['Left and right steer the ball', 'Spiked platforms cost a life', 'Hearts give a life back'],
    art: (
      <svg viewBox="0 0 48 32" {...px}><path fill="currentColor" d="M0 0h48v3H0z"/><path fill="currentColor" d="M3 14h16v2H3zM28 22h16v2H28zM10 28h14v2H10z"/><path fill="var(--accent-2)" d="M20 5h6v1h2v4h-2v1h-6v-1h-2V6h2z"/></svg>
    ),
  },
  {
    id: 'bounce', name: 'Bounce', tag: 'The red ball that never stops.',
    text: 'Six levels of rings, spikes, patrolling bugs and checkpoints. Collect every ring to open the gate. Pump the ball up to smash blocks, let the air out to squeeze through tunnels.',
    tips: ['Hold up for a high bounce, down for a low one', 'On a phone, just tap up or down', 'Pump P and deflator D change your size'],
    art: (
      <svg viewBox="0 0 48 32" {...px}><path fill="currentColor" d="M0 26h48v6H0zM30 18h3v1h2v2h-2v1h-3v-1h-2v-2h2z"/><path fill="currentColor" d="M8 21h2v1h2v4H6v-4h2zM14 23h2v3h-2z"/><path fill="var(--coral)" d="M18 6h8v2h2v2h2v6h-2v2h-2v2h-8v-2h-2v-2h-2v-6h2V8h2z"/><path fill="#ffd0d7" d="M19 9h3v3h-3z"/></svg>
    ),
  },
  {
    id: 'soccer', name: 'Soccer League', tag: 'Five a side. Walls stay in.',
    text: 'A fast top-down football game. Run, pass, tackle and shoot. Play a quick match at any difficulty, or take on the league: six clubs, five rounds, three points for a win.',
    tips: ['Tap Select to pass, hold it to shoot', 'Select without the ball is a slide tackle', 'League seasons are saved to your account'],
    art: (
      <svg viewBox="0 0 48 32" {...px}><path fill="currentColor" d="M2 2h44v1H2zM2 29h44v1H2zM2 2h1v28H2zM45 2h1v28h-1zM23 2h2v28h-2zM2 11h8v1H2zM2 20h8v1H2zM9 11h1v10H9zM38 11h8v1h-8zM38 20h8v1h-8zM38 11h1v10h-1z"/><path fill="currentColor" d="M12 13h3v3h-3zM12 20h3v3h-3zM18 16h3v3h-3zM30 10h3v3h-3zM33 20h3v3h-3z"/><path fill="var(--accent)" d="M26 15h1v3h-1zM25 16h3v1h-3z"/></svg>
    ),
  },
];

const FEATURES = [
  { t: 'Play as a guest', d: 'No sign-up needed. Press start and you are in. Guest scores stay on your device.',
    i: <svg viewBox="0 0 16 16" {...px}><path fill="currentColor" d="M6 2h4v1h1v3h-1v1H6V6H5V3h1zM3 10h10v1h1v3H2v-3h1z"/></svg> },
  { t: 'Your own player', d: 'Make a player with a name and password. Your scores and league season follow you to any device.',
    i: <svg viewBox="0 0 16 16" {...px}><path fill="currentColor" d="M5 2h6v1h1v4h-1v1H5V7H4V3h1zM2 11h12v1h1v2H1v-2h1z"/><path fill="var(--bg-hole)" d="M7 4h2v2H7z"/></svg> },
  { t: 'Shared leaderboards', d: 'A top ten for every game, shared by all players. Switch to your own scores any time.',
    i: <svg viewBox="0 0 16 16" {...px}><path fill="currentColor" d="M2 8h4v6H2zM6 3h4v11H6zM10 6h4v8h-4z"/></svg> },
  { t: 'Win the league', d: 'Soccer League runs a five-round season against five clubs of rising skill. Finish top to be champion.',
    i: <svg viewBox="0 0 16 16" {...px}><path fill="currentColor" d="M3 2h10v1h2v3h-1v1h-2v1h-1v2H9v2h2v2H5v-2h2v-2H6V8H5V7H3V6H2V3h1zM4 4v2h1V4zM11 4v2h1V4z"/></svg> },
];

export default function Landing() {
  return (
    <div className="lp">
      <header className="lp-nav">
        <Link href="/" className="lp-logo">Keypad Arcade</Link>
        <nav aria-label="Sections">
          <a href="#games">Games</a>
          <a href="#controls">Controls</a>
          <a href="#compete">Compete</a>
        </nav>
        <Link href="/play" className="lp-btn lp-btn-sm">Play</Link>
      </header>

      <main>
        <section className="lp-hero">
          <div className="lp-hero-copy">
            <p className="lp-eyebrow">A Demlinks game</p>
            <h1>Four classic phone games.<br /><span>One handset.</span></h1>
            <p className="lp-lede">
              Remember the monochrome screen, the chunky keypad and the one game you could not put down?
              Keypad Arcade packs Snake, Rapid Roll, Bounce and a brand-new Soccer League into a little
              Nokia-style phone that runs right in your browser. Free to play, no download.
            </p>
            <div className="lp-cta">
              <Link href="/play" className="lp-btn">Play now</Link>
              <a href="#games" className="lp-btn lp-btn-ghost">Meet the games</a>
            </div>
            <ul className="lp-badges" aria-label="Highlights">
              <li>4 games</li><li>Keyboard and touch</li><li>Leaderboards</li><li>Free</li>
            </ul>
          </div>
          <Hero />
          <div className="lp-floor" aria-hidden="true" />
        </section>

        <section id="games" className="lp-sec">
          <Reveal className="lp-head">
            <p className="lp-eyebrow">The line-up</p>
            <h2>Pick a game. Beat your best.</h2>
            <p>Every game has levels or difficulty settings, its own high-score table, and a How to play page right on the handset.</p>
          </Reveal>
          <div className="lp-grid">
            {GAMES.map((g, i) => (
              <Reveal key={g.id} delay={i * 80}>
                <Tilt className="lp-card">
                  <div className="lp-art" aria-hidden="true">{g.art}</div>
                  <h3>{g.name}</h3>
                  <p className="lp-tag">{g.tag}</p>
                  <p>{g.text}</p>
                  <ul>{g.tips.map(t => <li key={t}>{t}</li>)}</ul>
                </Tilt>
              </Reveal>
            ))}
          </div>
        </section>

        <section id="controls" className="lp-sec">
          <Reveal className="lp-head">
            <p className="lp-eyebrow">How it plays</p>
            <h2>Keys, taps, or both.</h2>
            <p>Play on the Nokia keypad, or switch to full-screen touch controls on your phone. On a computer, the keyboard works with both.</p>
          </Reveal>
          <Reveal>
            <div className="lp-controls">
              <div className="lp-ctl-card">
                <h3>On a computer</h3>
                <dl>
                  <div><dt><kbd>←</kbd><kbd>↑</kbd><kbd>→</kbd><kbd>↓</kbd></dt><dd>Move. <kbd>2</kbd><kbd>4</kbd><kbd>6</kbd><kbd>8</kbd> work too</dd></div>
                  <div><dt><kbd>Enter</kbd> <kbd>5</kbd></dt><dd>Select, pass or shoot</dd></div>
                  <div><dt><kbd>Esc</kbd></dt><dd>Back</dd></div>
                  <div><dt><kbd>P</kbd> <kbd>M</kbd></dt><dd>Pause and mute</dd></div>
                </dl>
              </div>
              <div className="lp-ctl-card">
                <h3>On a phone</h3>
                <dl>
                  <div><dt>Touch controls</dt><dd>Full screen with big buttons. Swipe to steer Snake, a joystick and KICK button for Soccer. Phones start here</dd></div>
                  <div><dt>Keypad</dt><dd>Prefer the Nokia feel? Tap the keypad: D-pad, Select and C</dd></div>
                  <div><dt>Switch any time</dt><dd>Menu, then Controls. Your choice is remembered on that device</dd></div>
                </dl>
              </div>
            </div>
          </Reveal>
        </section>

        <section id="compete" className="lp-sec">
          <Reveal className="lp-head">
            <p className="lp-eyebrow">Compete</p>
            <h2>Make a name for yourself.</h2>
            <p>Sign up for a player to keep your scores, or just jump in as a guest.</p>
          </Reveal>
          <div className="lp-feats">
            {FEATURES.map((f, i) => (
              <Reveal key={f.t} delay={i * 70}>
                <div className="lp-feat">
                  <span className="lp-ico" aria-hidden="true">{f.i}</span>
                  <h3>{f.t}</h3>
                  <p>{f.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="lp-final">
          <Reveal>
            <h2>Ready to play?</h2>
            <p>One tap and you are on the handset.</p>
            <Link href="/play" className="lp-btn lp-btn-lg">Press start</Link>
          </Reveal>
        </section>
      </main>

      <footer className="lp-foot">
        <span>Made by Demlinks · © {new Date().getFullYear()}</span>
        <Link href="/play">Play</Link>
      </footer>
    </div>
  );
}
