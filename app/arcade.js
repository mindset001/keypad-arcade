'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { initArcade } from '../lib/arcade';
import './touch.css'; // the touch app's styles load with the game, not with the landing page

/* Static markup only. The engine in lib/arcade.js owns every node below once
   mounted (toggling hidden/classes/text), so nothing here is driven by React state. */
export default function Arcade() {
  useEffect(() => initArcade(), []);

  return (
    <>
      <header className="masthead">
        <p className="brand">Keypad Arcade</p>
        <p className="byline">A Demlinks game</p>
        <div className="ctl-switch" role="group" aria-label="Controls">
          <span>Controls</span>
          <button type="button" data-controls="keypad" aria-pressed="true">Keypad</button>
          <button type="button" data-controls="touch" aria-pressed="false">Touch</button>
        </div>
      </header>

      <div className="phone" id="phone">
        <div className="earpiece" aria-hidden="true"></div>
        <div className="bezel">
          <div className="lcd" id="lcd">
            <div className="bar">
              <span className="sig" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
              <span id="barL">Welcome</span>
              <span id="barMute" hidden>MUTE</span>
              <span id="barR"></span>
            </div>

            <section className="screen" data-screen="login" hidden>
              <form className="login" id="loginForm" noValidate autoComplete="on">
                <p className="msg" id="loginMsg" role="status">Log in, or make a new player.</p>
                <input id="user" name="username" autoComplete="username" placeholder="Player name" aria-label="Player name" maxLength={12} spellCheck={false} autoCapitalize="off" />
                <div className="pw">
                  <input id="pass" name="password" type="password" autoComplete="current-password" placeholder="Password" aria-label="Password" maxLength={72} />
                  <button type="button" id="btnShow" className="pwtoggle" aria-pressed="false" aria-label="Show password" title="Show password">
                    <svg className="eye-open" viewBox="0 0 15 9" shapeRendering="crispEdges" aria-hidden="true"><path d="M5 0h5v1H5zM3 1h2v1H3zM10 1h2v1H10zM2 2h1v1H2zM12 2h1v1H12zM1 3h1v1H1zM6 3h3v1H6zM13 3h1v1H13zM0 4h1v1H0zM6 4h3v1H6zM14 4h1v1H14zM1 5h1v1H1zM6 5h3v1H6zM13 5h1v1H13zM2 6h1v1H2zM12 6h1v1H12zM3 7h2v1H3zM10 7h2v1H10zM5 8h5v1H5z" /></svg>
                    <svg className="eye-shut" viewBox="0 0 15 9" shapeRendering="crispEdges" aria-hidden="true"><path d="M5 0h5v1H5zM13 0h2v1H13zM3 1h2v1H3zM11 1h2v1H11zM2 2h1v1H2zM9 2h2v1H9zM12 2h1v1H12zM1 3h1v1H1zM6 3h1v1H6zM8 3h2v1H8zM13 3h1v1H13zM0 4h1v1H0zM6 4h2v1H6zM14 4h1v1H14zM1 5h1v1H1zM4 5h2v1H4zM7 5h2v1H7zM13 5h1v1H13zM3 6h2v1H3zM12 6h1v1H12zM1 7h2v1H1zM4 7h1v1H4zM10 7h2v1H10zM0 8h1v1H0zM5 8h5v1H5z" /></svg>
                  </button>
                </div>
                <div className="row">
                  <button type="submit" id="btnLogin">Log in</button>
                  <button type="button" id="btnNew">New player</button>
                </div>
                <button type="button" className="link" id="btnGuest">Play as guest</button>
              </form>
            </section>

            <section className="screen" data-screen="menu" hidden><ul className="list" id="menuList"></ul></section>
            <section className="screen" data-screen="opts" hidden><ul className="list" id="optsList"></ul></section>

            <section className="screen" data-screen="scores" hidden>
              <div className="scores-wrap">
                <div className="sc-tab" id="scTab"></div>
                <ol className="sc-list" id="scList"></ol>
                <p className="sc-mine" id="scMine"></p>
              </div>
            </section>

            <section className="screen" data-screen="league" hidden>
              <div className="scores-wrap">
                <div className="sc-tab" id="lgTab"></div>
                <ol className="sc-list" id="lgList"></ol>
                <p className="sc-mine" id="lgNext"></p>
              </div>
            </section>

            <section className="screen" data-screen="help" hidden>
              <div className="scores-wrap">
                <div className="sc-tab" id="hlpTab"></div>
                <ul className="hlp" id="hlpText"></ul>
              </div>
            </section>

            <section className="screen" data-screen="game" hidden>
              <canvas id="cv" width={128} height={88} aria-label="Game screen"></canvas>
              <div className="ov" id="ov" hidden><div className="ov-box"><h2 id="ovTitle">Paused</h2><p id="ovText"></p></div></div>
            </section>

            <div className="soft">
              <span id="skL" role="button" tabIndex={-1}></span>
              <span id="skC" role="button" tabIndex={-1}></span>
              <span id="skR" role="button" tabIndex={-1}></span>
            </div>
          </div>
        </div>

        <div className="controls">
          <button className="key soft-key" data-k="sel" tabIndex={-1} aria-label="Select">Select</button>
          <div className="dpad" role="group" aria-label="Navigation">
            <button className="key" data-k="up" tabIndex={-1} aria-label="Up">▲</button>
            <button className="key" data-k="left" tabIndex={-1} aria-label="Left">◀</button>
            <span className="dpad-hub" aria-hidden="true"></span>
            <button className="key" data-k="right" tabIndex={-1} aria-label="Right">▶</button>
            <button className="key" data-k="down" tabIndex={-1} aria-label="Down">▼</button>
          </div>
          <button className="key c-key" data-k="c" tabIndex={-1} aria-label="Back">C</button>
        </div>

        <div className="numpad">
          <button className="key" data-k="1" tabIndex={-1}>1<small>&nbsp;</small></button>
          <button className="key" data-k="2" tabIndex={-1}>2<small>abc ▲</small></button>
          <button className="key" data-k="3" tabIndex={-1}>3<small>def</small></button>
          <button className="key" data-k="4" tabIndex={-1}>4<small>◀ ghi</small></button>
          <button className="key" data-k="5" tabIndex={-1}>5<small>jkl ●</small></button>
          <button className="key" data-k="6" tabIndex={-1}>6<small>mno ▶</small></button>
          <button className="key" data-k="7" tabIndex={-1}>7<small>pqrs</small></button>
          <button className="key" data-k="8" tabIndex={-1}>8<small>tuv ▼</small></button>
          <button className="key" data-k="9" tabIndex={-1}>9<small>wxyz</small></button>
          <button className="key" data-k="*" tabIndex={-1}>*<small>pause</small></button>
          <button className="key" data-k="0" tabIndex={-1}>0<small>share</small></button>
          <button className="key" data-k="#" tabIndex={-1}>#<small>sound</small></button>
        </div>

        {/* ---- Touch mode (CSS shows these only when Controls = Touch) ---- */}
        <header className="ts-bar" id="tsBar">
          <button type="button" className="ts-ib ts-press" id="tsBack" aria-label="Back" data-icon="back" hidden></button>
          <div className="ts-title"><span className="ts-logo" id="tsLogo" aria-hidden="true" data-art="snake"></span><span id="tsTitleText">Keypad Arcade</span></div>
          <div className="ts-actions">
            <button type="button" className="ts-ib ts-press" id="tsPause" aria-label="Pause" data-icon="pause" hidden></button>
            <button type="button" className="ts-ib ts-press" id="tsSound" aria-label="Sound"></button>
            <button type="button" className="ts-ib ts-press" id="tsSettings" aria-label="Settings" data-icon="tune"></button>
          </div>
        </header>
        <main className="ts-main" id="tsMain"></main>
        <div className="ts-host" id="tsHost"></div>

        {/* Game controls (touch mode): same actions as the keypad; the engine binds these buttons too. */}
        <div className="td td-left">
          <div className="g g-dpad" role="group" aria-label="Directions">
            <button className="td-btn tdb-up" data-k="up" data-icon="chevU" tabIndex={-1} aria-label="Up"></button>
            <button className="td-btn tdb-left" data-k="left" data-icon="chevL" tabIndex={-1} aria-label="Left"></button>
            <span className="td-hub" aria-hidden="true"></span>
            <button className="td-btn tdb-right" data-k="right" data-icon="chevR" tabIndex={-1} aria-label="Right"></button>
            <button className="td-btn tdb-down" data-k="down" data-icon="chevD" tabIndex={-1} aria-label="Down"></button>
          </div>
          <div className="g g-tt-u"><button className="td-btn td-big" data-k="up" data-icon="chevU" tabIndex={-1} aria-label="Up"></button></div>
          <div className="g g-roll-l"><button className="td-btn td-big" data-k="left" data-icon="chevL" tabIndex={-1} aria-label="Left"></button></div>
          <div className="g g-lr" role="group" aria-label="Move">
            <button className="td-btn" data-k="left" data-icon="chevL" tabIndex={-1} aria-label="Left"></button>
            <button className="td-btn" data-k="right" data-icon="chevR" tabIndex={-1} aria-label="Right"></button>
          </div>
          <div className="g g-stick" id="stick" role="application" aria-label="Move stick"><span className="td-knob" id="stickKnob"></span></div>
        </div>
        <div className="td td-right">
          <div className="g g-tt-d"><button className="td-btn td-big" data-k="down" data-icon="chevD" tabIndex={-1} aria-label="Down"></button></div>
          <div className="g g-roll-r"><button className="td-btn td-big" data-k="right" data-icon="chevR" tabIndex={-1} aria-label="Right"></button></div>
          <div className="g g-hint" aria-hidden="true"><span data-icon="swipe"></span><p>Swipe anywhere on the screen to turn, or use the pad</p></div>
          <div className="g g-bounce">
            <button className="td-btn td-jump" data-k="up" tabIndex={-1} aria-label="High bounce"><span data-icon="jumpHi"></span><span><b>High</b><small>bounce</small></span></button>
            <button className="td-btn td-jump" data-k="down" tabIndex={-1} aria-label="Low bounce"><span data-icon="jumpLo"></span><span><b>Low</b><small>bounce</small></span></button>
          </div>
          <div className="g g-soccer">
            <button className="td-btn td-act" data-k="sel" tabIndex={-1} aria-label="Kick: tap to pass or tackle, hold to shoot"><span>KICK</span><small>tap pass · hold shoot</small></button>
          </div>
        </div>
      </div>

      <p className="hint">Move with <kbd>←</kbd><kbd>↑</kbd><kbd>→</kbd><kbd>↓</kbd> or <kbd>2</kbd><kbd>4</kbd><kbd>6</kbd><kbd>8</kbd>. <kbd>Enter</kbd> or <kbd>5</kbd> selects, <kbd>Esc</kbd> goes back, <kbd>P</kbd> pauses, <kbd>M</kbd> mutes, <kbd>H</kbd> shares your score after a game. On a phone, use Controls in the menu to switch between this keypad and full-screen touch.</p>

      {/* First visit: choose how to play. Shown by the engine until a choice is saved. */}
      <div className="chooser" id="chooser" role="dialog" aria-modal="true" aria-labelledby="chooserTitle" hidden>
        <div className="chooser-card">
          <h2 id="chooserTitle">How do you want to play?</h2>
          <p>Pick one now. You can switch any time with the Keypad / Touch switch, or from the menu under Controls.</p>
          <div className="chooser-opts">
            <button type="button" className="chooser-opt" data-choose="keypad">
              <svg className="chooser-art" viewBox="0 0 60 80" aria-hidden="true"><rect x="6" y="2" width="48" height="76" rx="11" fill="#3a4080"/><rect x="12" y="9" width="36" height="24" rx="2" fill="#a9c07f"/><circle cx="30" cy="42" r="4" fill="#7cf2c1"/><g fill="#6b74c0"><rect x="14" y="51" width="9" height="5" rx="2.5"/><rect x="25.5" y="51" width="9" height="5" rx="2.5"/><rect x="37" y="51" width="9" height="5" rx="2.5"/><rect x="14" y="59" width="9" height="5" rx="2.5"/><rect x="25.5" y="59" width="9" height="5" rx="2.5"/><rect x="37" y="59" width="9" height="5" rx="2.5"/><rect x="14" y="67" width="9" height="5" rx="2.5"/><rect x="25.5" y="67" width="9" height="5" rx="2.5"/><rect x="37" y="67" width="9" height="5" rx="2.5"/></g></svg>
              <span className="chooser-txt"><b>Classic keypad</b><small>The Nokia handset with a D-pad and number keys. Great with a keyboard.</small><em className="chooser-rec" hidden>Recommended for your device</em></span>
            </button>
            <button type="button" className="chooser-opt" data-choose="touch">
              <svg className="chooser-art" viewBox="0 0 60 80" aria-hidden="true"><rect x="2" y="2" width="56" height="76" rx="9" fill="#12142b" stroke="#5560a8" strokeWidth="1.5"/><rect x="5" y="5" width="50" height="32" rx="2" fill="#a9c07f"/><path d="M15 45h6v6h6v6h-6v6h-6v-6H9v-6h6z" fill="#5560a8"/><circle cx="45" cy="52" r="7.5" fill="#4fd6a4"/><circle cx="38" cy="67" r="5" fill="#ff8fa0"/></svg>
              <span className="chooser-txt"><b>Touch screen</b><small>Full screen with Android-style on-screen buttons. Great on phones and tablets.</small><em className="chooser-rec" hidden>Recommended for your device</em></span>
            </button>
          </div>
        </div>
      </div>

      <footer className="credit">Made by Demlinks · © {new Date().getFullYear()} · <Link href="/">About</Link></footer>
    </>
  );
}
