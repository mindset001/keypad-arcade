# Keypad Arcade

Five classic phone games on one Nokia-style handset, in the browser: **Snake Xenzia**, **Rapid Roll**, **Bounce**, **Soccer League** and **Table Tennis** (quick match or a six-club league). Play as a guest, or make a player to keep your scores, league season and handset colour on any device. A Demlinks game.

- `/` is the 3D landing page. `/play` is the game.
- Next.js (App Router) · MongoDB + Mongoose · no UI framework: the games are plain canvas code.

## Run it

```bash
npm install
cp .env.example .env.local      # then fill in the two values below
npm run dev                     # http://localhost:3000 (or the next free port)
```

| Variable | What it is |
| --- | --- |
| `MONGODB_URI` | MongoDB connection string. Local: `mongodb://127.0.0.1:27017/keypad-arcade`. Atlas: `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/keypad-arcade?retryWrites=true&w=majority` |
| `AUTH_SECRET` | 16+ random characters that sign the login cookie. `openssl rand -base64 32` |

**Keep real values in `.env.local` only.** It is git-ignored. `.env.example` is committed, so it must only ever hold placeholders.

| `RATE_LIMIT` | Optional. `off` disables login/sign-up limiting. For local testing only; leave it unset in production. |

Without the two required variables the site still builds and runs: the API answers `503 Server unavailable` and the game works in guest mode. If the live site says "Server unavailable", open `/api/health`: it names the exact problem (missing variable, malformed string, wrong password, Atlas blocking the connection) without revealing any secret.

```bash
npm run build && npm start      # production
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm test` | Unit tests (Node's built-in runner, no extra packages, about a second) |
| `npm run admin -- <name>` | Makes a registered player an admin (`--remove` to undo, `--list` to see admins). See *Admin page* below |
| `npm run smoke` | Calls every API endpoint on a running server. `BASE=http://localhost:3001 npm run smoke` if it is not on port 3000. Never deletes data; refuses non-local hosts unless `I_KNOW=1` |

## How it fits together

```
app/
  page.js, landing/        3D landing page (CSS 3D, no libraries)
  play/                    the game route; arcade.js holds the handset markup
  admin/                   the admin players page (/admin)
  api/                     route handlers: auth/*, scores, league, prefs, admin/users, health
  globals.css              handset, LCD, keypad and the four colour themes
  touch.css                the Android-style touch app (touch mode only)
lib/
  arcade/                  the game engine (runs in the browser)
    index.js                 screens, input, game loop, auth wiring
    games/{snake,roll,bounce,soccer,tennis}.js   one file per game
    league.js                Soccer League season logic (pure)
    ui/                      the touch app: touch-ui.js (screens), icons.js, art.js, dom.js
    touch.js                 touch logic + the pre-paint script (pure, tested)
    share.js, data.js, draw.js, storage.js, sound.js, api.js
  api.js, auth.js, db.js   server helpers (route wrapper, sessions, Mongo connection)
  admin.js, admin-guard.js admin list helpers (pure) and the admin check
  limits.js, ratelimit.js  login / sign-up limiting
models/                    Mongoose: User, Score, League
tests/                     unit tests
scripts/smoke-api.sh       API smoke test
scripts/make-admin.mjs     grants/removes the admin role (database access required)
```

**Accounts.** Name + password. Passwords are bcrypt-hashed; the session is a signed, `httpOnly`, `SameSite=Lax` cookie valid for 30 days (marked `Secure` whenever the connection is https). Names are case-insensitive and unique; 2-12 letters, numbers or `_`; a few names (`guest`, `admin`, `root`, `system`, `demlinks`) are reserved. Passwords are 6+ characters and at most 72 **bytes**, because bcrypt ignores everything after that. The rules live in one file, `lib/arcade/validate.js`, used by both the game and the server. The password field has an eye button to show or hide what you type.

**Limits.** After 8 failed logins for one player name, or 30 from one address, in 15 minutes, logins answer `429` (with `Retry-After`) until the window passes, even with the right password. Only failures count. At most 10 sign-ups per address per hour. Counters live in MongoDB (`ratelimits`, expired automatically), so they hold across serverless instances.

**Saves are never silent.** A score that cannot reach the server (offline, server down, or your login expired) is kept on the device, the game-over screen says so ("Offline. Will retry" / "Log in again to save"), and it is sent automatically at the next login or successful save. A handset colour changed offline is pushed at the next login. If the session ends, the next trip to the menu sends you to log in.

**Scores.** Logged-in players post to a shared leaderboard (top 10 per game, plus "mine"). Each player keeps their best 50 per game. Guests keep scores in their own browser only. Scores are reported by the browser and only range-checked, so the leaderboard is friendly, not tamper-proof.

**League.** Six clubs, five rounds, 3 points for a win. The player's season is saved locally and, when logged in, on the server (the more advanced copy wins when you switch devices).

**Handset colour.** Menu → Handset cycles violet / blue / red / black. Guests keep it in the browser; logged-in players save it on their account.

**Share.** After a game with a score, press `H`, the `0` key or the **Share** soft key. Phones open the native share sheet; computers copy the text and link.

### Controls: keypad or touch

Players **choose** between two layouts, and can change their mind at any time:

- **First visit:** a "How do you want to play?" prompt offers *Classic keypad* or *Touch screen* and marks the one that suits the device (touch for phones and tablets, keypad for computers). Esc picks the recommended one.
- **Always on screen:** a **Keypad | Touch** switch above the handset, and in touch mode a **Switch to keypad** button under the screen (hidden mid-game so a stray tap can't switch; it is there on the menu, pause and game-over screens).
- **Menu → Controls** does the same.
- **Links:** `/play?controls=keypad` and `/play?controls=touch` choose before the game loads (the landing page uses them for "Classic keypad / Touch screen" and "Play with the keypad / touch").

The choice is saved **on that device** (not on the account), so you can use touch on a phone and the keypad on a laptop. A small script in `<head>` (`EARLY_SCRIPT` in `lib/arcade/touch.js`) applies the saved choice and handset colour to `<html>` before the first paint, so there is no flash of the wrong layout.

- **Keypad:** the Nokia handset with D-pad, Select, C and number keys (and the keyboard).
- **Touch:** an Android-style app instead of the handset. The pixel LCD is only used for the game itself; everything else is real touch UI:
  - **Home:** a card for each game (pixel art + your best score), shortcuts to High scores and How to play, a Controls switch, and a greeting (guest or signed in).
  - **Game options:** a bottom sheet with a level stepper, maze chips (Snake), quick/league mode (Soccer) and a big Play button.
  - **Scores, How to play, League, Login:** proper screens (ranked list with medals and a "just me" filter; the league table with your club highlighted; a form with floating labels and a show/hide eye).
  - **Settings** (gear): Controls (Keypad | Touch), handset colour swatches, sound, and sign in / log out.
  - **In a game:** the screen sits in a glowing frame with a glass control sheet below. Snake: swipe anywhere, or the round pad. Rapid Roll: a big button under each thumb. Bounce: left/right, plus HIGH and LOW. Soccer: an eight-way joystick and a KICK button (tap to pass or tackle, hold to shoot). Table Tennis: drag a finger up and down on the screen and the paddle follows (it glides, it cannot teleport), or use the big ▲ under one thumb and ▼ under the other. On a computer the mouse over the screen also moves the paddle, and held keys speed up the longer you hold them. Pause is in the app bar; **Paused** and **Game over** are real dialogs (Resume / Quit; Again / Share / Menu). Back (the arrow, or Esc) pauses mid-game, and dismisses the Paused dialog like Android's back button.
  - **Landscape:** on short screens the game screen is sized by the height and centred, with the controls on its left and right; home, sheets and login rearrange so everything fits without scrolling. Larger screens keep the controls below.
  - Every button is 44px or bigger, holds are tracked per finger (a thumb that slides off a held button doesn't drop it), phones give a tiny vibration while sound is on, and presses have a soft ripple.

The keyboard works in both modes. The logic (joystick angles, swipe detection, which controls to show, the default choice) is in `lib/arcade/touch.js` and unit-tested. The touch screens are `lib/arcade/ui/touch-ui.js` (views), `ui/icons.js`, `ui/art.js` and `ui/dom.js`; they reuse the engine's own scores, league, sign-in and preferences (nothing is duplicated). All touch styling is in `app/touch.css`, scoped to `:root[data-controls=touch]` so the keypad layout is untouched.

### Admin page

`/admin` lists every registered player: name, join date, last login, handset colour, how many scores they have posted and their best. It has totals, name search, sorting, paging and a **Download CSV** button. It is read-only: it cannot change or delete anyone. No emails or passwords are stored, so none can be shown.

**Making someone an admin.** They register like anyone else, then you run:

```bash
npm run admin -- ada            # make "ada" an admin (not case-sensitive)
npm run admin -- ada --remove   # take it away
npm run admin -- --list         # who is an admin now
```

The command uses the database in `.env.local` and prints its name first, so check it is the one your live site uses. **The role can only be granted this way, by someone with database access.** No page or API can grant it, and signing up with a name like "admin" is blocked. The role is checked against the database on every request, so removing it works immediately, even for someone still logged in.

Everyone who is not an admin (logged out or an ordinary player) gets the normal 404 for `/admin` and for `/api/admin/users`, with no admin UI, title or data. The page's bundle names can still appear in that 404's page data, so the protection is the server-side check, not secrecy of the URL.

### Adding a game

1. Write `lib/arcade/games/<name>.js` exporting `create<Name>(env)` that returns a class with `update(dt)`, `draw()`, `key(a)`, `keyUp(a)`, `hud()` and calls `this.onOver(score)`.
2. Add it to `GAMES` and `HELP` in `lib/arcade/data.js`. That one list also drives the leaderboard validation on the server.
3. Create it in `lib/arcade/index.js` next to the others and add it to the `newGame` lookup.
4. Add tests in `tests/games.test.mjs`.

## Tests

`npm test` covers the parts that are pure logic: league fixtures and standings, all five games run headlessly (level data, physics, scoring rules, whole matches with a bot, difficulty ordering), and the share helper. Soccer's difficulty test plays seeded matches, so it is deterministic.

`npm run smoke` covers the API (validation, sessions, cookies, scores, league, colours, health). It needs a running server and a database. `SMOKE_RATELIMIT=1 npm run smoke` also checks the lockout (it deliberately locks one throwaway player for 15 minutes).

Not covered by automation: the visuals and touch feel. Check those by hand on a real phone: sign up, play each game, share a score, switch handset colour, and reload.

## Deploying (Vercel)

1. Push the repo and import it in Vercel (`vercel.json` pins the framework to Next.js).
2. Add `MONGODB_URI` and `AUTH_SECRET` under Project Settings → Environment Variables, then redeploy.
3. In MongoDB Atlas → Network Access, allow Vercel to connect (usually `0.0.0.0/0`, since Vercel's addresses change).

## Security notes

- **Never commit secrets.** If a connection string or password is ever committed, treat it as leaked: rotate the password first, then clean the history if you want to.
- There is no rate limiting on login or sign-up yet. Add one (Upstash, or Vercel's firewall) before a public launch.
- Scores and league results are computed in the browser; do not use them for anything with real prizes.
