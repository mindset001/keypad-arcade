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
                <input id="pass" name="password" type="password" autoComplete="current-password" placeholder="Password" aria-label="Password" maxLength={72} />
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
      </div>

      <p className="hint">Move with <kbd>←</kbd><kbd>↑</kbd><kbd>→</kbd><kbd>↓</kbd> or <kbd>2</kbd><kbd>4</kbd><kbd>6</kbd><kbd>8</kbd>. <kbd>Enter</kbd> or <kbd>5</kbd> selects, <kbd>Esc</kbd> goes back, <kbd>P</kbd> pauses, <kbd>M</kbd> mutes, <kbd>H</kbd> shares your score after a game. On a phone, tap the keypad.</p>

      <footer className="credit">Made by Demlinks · © {new Date().getFullYear()} · <Link href="/">About</Link></footer>
    </>
  );
}
