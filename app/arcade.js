'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { initArcade } from '../lib/arcade';

/* Static markup only. The engine in lib/arcade.js owns every node below once
   mounted (toggling hidden/classes/text), so nothing here is driven by React state. */
export default function Arcade() {
  useEffect(() => initArcade(), []);

  return (
    <>
      <header className="masthead">
        <p className="brand">Keypad Arcade</p>
        <p className="byline">A Demlinks game</p>
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

        {/* Touch mode only (shown by CSS when Controls = Touch). Same actions as the keypad: the engine binds these buttons too. */}
        <div className="td td-left">
          <div className="g g-dpad" role="group" aria-label="Directions">
            <button className="td-btn tdb-up" data-k="up" tabIndex={-1} aria-label="Up">▲</button>
            <button className="td-btn tdb-left" data-k="left" tabIndex={-1} aria-label="Left">◀</button>
            <span className="td-hub" aria-hidden="true"></span>
            <button className="td-btn tdb-right" data-k="right" tabIndex={-1} aria-label="Right">▶</button>
            <button className="td-btn tdb-down" data-k="down" tabIndex={-1} aria-label="Down">▼</button>
          </div>
          <div className="g g-lr" role="group" aria-label="Move">
            <button className="td-btn" data-k="left" tabIndex={-1} aria-label="Left">◀</button>
            <button className="td-btn" data-k="right" tabIndex={-1} aria-label="Right">▶</button>
          </div>
          <div className="g g-stick" id="stick" role="application" aria-label="Move stick"><span className="td-knob" id="stickKnob"></span></div>
        </div>
        <div className="td td-right">
          <div className="g g-ok">
            <button className="td-btn td-ok" data-k="sel" tabIndex={-1}>OK</button>
            <button className="td-btn td-back" data-k="c" tabIndex={-1}>Back</button>
          </div>
          <div className="g g-pause">
            <button className="td-btn td-pause" data-k="*" tabIndex={-1} aria-label="Pause"><span>❚❚</span><small>Pause</small></button>
          </div>
          <div className="g g-bounce">
            <button className="td-btn td-jump" data-k="up" tabIndex={-1} aria-label="High bounce"><span>▲</span><small>High</small></button>
            <button className="td-btn td-jump" data-k="down" tabIndex={-1} aria-label="Low bounce"><span>▼</span><small>Low</small></button>
            <button className="td-btn td-mini" data-k="*" tabIndex={-1} aria-label="Pause">❚❚ Pause</button>
          </div>
          <div className="g g-soccer">
            <button className="td-btn td-act" data-k="sel" tabIndex={-1} aria-label="Kick: tap to pass or tackle, hold to shoot"><span>KICK</span><small>tap pass · hold shoot</small></button>
            <button className="td-btn td-mini" data-k="*" tabIndex={-1} aria-label="Pause">❚❚ Pause</button>
          </div>
          <div className="g g-paused">
            <button className="td-btn td-wide td-ok" data-k="sel" tabIndex={-1}>Resume</button>
            <button className="td-btn td-wide td-back" data-k="c" tabIndex={-1}>Quit</button>
          </div>
          <div className="g g-over">
            <button className="td-btn td-wide td-ok" data-k="sel" tabIndex={-1}>Again</button>
            <button className="td-btn td-wide td-share" data-k="0" tabIndex={-1}>Share</button>
            <button className="td-btn td-wide td-back" data-k="c" tabIndex={-1}>Menu</button>
          </div>
        </div>
      </div>

      <p className="hint">Move with <kbd>←</kbd><kbd>↑</kbd><kbd>→</kbd><kbd>↓</kbd> or <kbd>2</kbd><kbd>4</kbd><kbd>6</kbd><kbd>8</kbd>. <kbd>Enter</kbd> or <kbd>5</kbd> selects, <kbd>Esc</kbd> goes back, <kbd>P</kbd> pauses, <kbd>M</kbd> mutes, <kbd>H</kbd> shares your score after a game. On a phone, use Controls in the menu to switch between this keypad and full-screen touch.</p>

      <footer className="credit">Made by Demlinks · © {new Date().getFullYear()} · <Link href="/">About</Link></footer>
    </>
  );
}
