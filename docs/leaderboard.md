# Leaderboard integration (Bullet Hell)

This game uses the shared leaderboards API (`pfaustino/leaderboards`, deployed at
`https://leaderboards-opal.vercel.app`).

> **For the full "add a leaderboard to a NEW game" runbook** (server registration,
> autonomous WRITE_KEYS update via Vercel CLI/API, verification probes, client
> wiring), see the canonical doc in the leaderboards repo:
> **`leaderboards/docs/adding-a-game.md`**.
>
> The flow for Bullet Hell was completed **fully autonomously** — the agent
> registered the game, generated the write key, PATCHed `WRITE_KEYS` via the
> Vercel REST API, redeployed, and verified live. No dashboard paste was needed.

---

## How it works in this game

- **Zero-build vanilla JS** (`game_v3.js` loads as a plain script — no module
  transform, so no `import.meta.env`). Env is injected as a bootstrap:
  `window.__LEADERBOARD_ENV__ = { apiBase, writeKey }` in `index.html`, filled by
  a Vite plugin from `VITE_LEADERBOARD_API` + `VITE_LEADERBOARD_WRITE_KEY`.
- **Composite score** (server ranks one `value`, desc): `value = wave * 1e9 +
  timeSeconds * 1e4 + kills` → ranks by **Wave → Time → Kills**. Implemented in
  `LEADERBOARD.computeScore()` / `decodeScore()`.
- **Submission** (`LEADERBOARD.postScore`): `POST /api/score` with header
  `X-Game-Key` + `meta {wave,time,kills,coins,difficulty}`. Server keeps the
  **best score per player name** (`uniquePlayer: true`).
- **When it submits:**
  - Death (game over) → run is recorded locally + shown; player submits with the
    game-over name box.
  - **Quit mid-run** (pause → QUIT TO MENU) → run is recorded locally; if a name
    is saved it **auto-submits**, otherwise a **name prompt** is shown
    ("SAVE YOUR RUN?").
- **Local / Global tabs** in the modal (GigaZonk-style):
  - **Local** = every run on this device (`localStorage "bulletHellRuns"`, cap 200)
    with best-wave/time/kills stats + PR badge.
  - **Global** = top 10 from the API.
- **No key / offline** → read-only fallback: modal shows your saved best.

## Env (never commit `.env`)

```
VITE_LEADERBOARD_API=https://leaderboards-opal.vercel.app
VITE_LEADERBOARD_WRITE_KEY=<bullet-hell key from WRITE_KEYS>
```

- Local dev: copy `.env.example` → `.env`.
- Auto-setup helper: `scripts/setup-leaderboard-key.ps1` (generates a key,
  prints the Vercel JSON to merge, writes `.env`). **Idempotent** — re-running
  reuses the existing `.env` key.
- Verify a working key end-to-end: `npm run verify:leaderboard`.

## Gotchas that bit us

- **Duplicate DOM ids silently break rendering** — the game-over panel and the
  modal both had `id="lb-list"`; `getElementById` returned the hidden game-over
  one, so the modal stayed on "Loading leaderboard…". Keep ids unique per
  container (`lb-list` vs `lb-modal-list`).
- The leaderboard modal must render into the **active** container — `show()`
  picks `#lb-modal-list` when the modal is open, else `#lb-list` (game-over).
- Live-board test rows can't be deleted via the API (no delete endpoint; Turso
  creds masked) — label verification writes clearly (`key-verify-test`) for
  manual Turso-dashboard cleanup.