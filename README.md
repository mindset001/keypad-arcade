# Keypad Arcade

Four classic phone games on one Nokia-style handset, in the browser: **Snake Xenzia**, **Rapid Roll**, **Bounce** and **Soccer League** (quick match or a six-club league). Play as a guest, or make a player to keep your scores, league season and handset colour on any device. A Demlinks game.

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

Without these variables the site still builds and runs: the API answers `503 Server unavailable` and the game works in guest mode.

```bash
npm run build && npm start      # production
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm test` | Unit tests (Node's built-in runner, no extra packages, about a second) |
| `npm run smoke` | Calls every API endpoint on a running server. `BASE=http://localhost:3001 npm run smoke` if it is not on port 3000. Never deletes data; refuses non-local hosts unless `I_KNOW=1` |

## How it fits together

```
app/
  page.js, landing/        3D landing page (CSS 3D, no libraries)
  play/                    the game route; arcade.js holds the handset markup
  api/                     route handlers: auth/*, scores, league, prefs
  globals.css              handset, LCD, keypad and the four colour themes
lib/
  arcade/                  the game engine (runs in the browser)
    index.js                 screens, input, game loop, auth wiring
    games/{snake,roll,bounce,soccer}.js   one file per game
    league.js                Soccer League season logic (pure)
    share.js, data.js, draw.js, storage.js, sound.js, api.js
  api.js, auth.js, db.js   server helpers (route wrapper, sessions, Mongo connection)
models/                    Mongoose: User, Score, League
tests/                     unit tests
scripts/smoke-api.sh       API smoke test
```

**Accounts.** Name + password. Passwords are bcrypt-hashed; the session is a signed, `httpOnly`, `SameSite=Lax` cookie valid for 30 days. Names are case-insensitive and unique.

**Scores.** Logged-in players post to a shared leaderboard (top 10 per game, plus "mine"). Each player keeps their best 50 per game. Guests keep scores in their own browser only. Scores are reported by the browser and only range-checked, so the leaderboard is friendly, not tamper-proof.

**League.** Six clubs, five rounds, 3 points for a win. The player's season is saved locally and, when logged in, on the server (the more advanced copy wins when you switch devices).

**Handset colour.** Menu → Handset cycles violet / blue / red / black. Guests keep it in the browser; logged-in players save it on their account.

**Share.** After a game with a score, press `H`, the `0` key or the **Share** soft key. Phones open the native share sheet; computers copy the text and link.

### Adding a game

1. Write `lib/arcade/games/<name>.js` exporting `create<Name>(env)` that returns a class with `update(dt)`, `draw()`, `key(a)`, `keyUp(a)`, `hud()` and calls `this.onOver(score)`.
2. Add it to `GAMES` and `HELP` in `lib/arcade/data.js`. That one list also drives the leaderboard validation on the server.
3. Create it in `lib/arcade/index.js` next to the others and add it to the `newGame` lookup.
4. Add tests in `tests/games.test.mjs`.

## Tests

`npm test` covers the parts that are pure logic: league fixtures and standings, all four games run headlessly (level data, physics, scoring rules, whole matches with a bot, difficulty ordering), and the share helper. Soccer's difficulty test plays seeded matches, so it is deterministic.

`npm run smoke` covers the API (validation, sessions, scores, league, colours). It needs a running server and a database.

Not covered by automation: the visuals and touch feel. Check those by hand on a real phone: sign up, play each game, share a score, switch handset colour, and reload.

## Deploying (Vercel)

1. Push the repo and import it in Vercel (`vercel.json` pins the framework to Next.js).
2. Add `MONGODB_URI` and `AUTH_SECRET` under Project Settings → Environment Variables, then redeploy.
3. In MongoDB Atlas → Network Access, allow Vercel to connect (usually `0.0.0.0/0`, since Vercel's addresses change).

## Security notes

- **Never commit secrets.** If a connection string or password is ever committed, treat it as leaked: rotate the password first, then clean the history if you want to.
- There is no rate limiting on login or sign-up yet. Add one (Upstash, or Vercel's firewall) before a public launch.
- Scores and league results are computed in the browser; do not use them for anything with real prizes.
