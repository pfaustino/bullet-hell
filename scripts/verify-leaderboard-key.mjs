#!/usr/bin/env node
// verify-leaderboard-key.mjs
// Round-trip check for the bullet-hell leaderboard write key.
//
//   node scripts\verify-leaderboard-key.mjs
//
// Reads .env (dotenv-style, no dependency) for VITE_LEADERBOARD_API and
// VITE_LEADERBOARD_WRITE_KEY, then:
//   1. GET  /api/leaderboard?game=bullet-hell  (must be 200 + rows array)
//   2. POST /api/score with the write key + a test run (must be 201/200)
//   3. GET  /api/leaderboard again and confirm the test score appears
//   4. Delete the test row via the direct Turso route (below) or inform.
//
// Exit code 0 on success, 1 on failure. Prints a clear PASS/FAIL summary.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Minimal dotenv: parse KEY=VALUE lines from a file into process.env. */
function loadEnvFile(path) {
  try {
    const text = readFileSync(path, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {
    /* .env optional */
  }
}

loadEnvFile(join(root, '.env'));

const apiBase = process.env.VITE_LEADERBOARD_API || 'https://leaderboards-opal.vercel.app';
const writeKey = process.env.VITE_LEADERBOARD_WRITE_KEY || '';
const GAME = 'bullet-hell';
const TEST_PLAYER = 'key-verify-test';

function fail(msg) {
  console.error(`\nFAIL: ${msg}`);
  process.exitCode = 1;
}

async function main() {
  if (!writeKey) {
    return fail('VITE_LEADERBOARD_WRITE_KEY is empty. Run scripts/setup-leaderboard-key.ps1 first.');
  }

  // 1) Read current state
  const before = await fetch(`${apiBase}/api/leaderboard?game=${GAME}&limit=20`).then((r) => r.json());
  if (!Array.isArray(before.rows)) return fail(`leaderboard GET did not return rows: ${JSON.stringify(before)}`);

  // Build a unique test score (wave 1, time 1s, kills 1) that won't collide with real data.
  const value = 1 * 1_000_000_000 + 1 * 10_000 + 1; // wave*1e9 + time*1e4 + kills
  const body = {
    game: GAME,
    player: TEST_PLAYER,
    value,
    meta: { wave: 1, time: 1, kills: 1, difficulty: 'verify', coins: 0 },
  };

  // 2) Submit
  const post = await fetch(`${apiBase}/api/score`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Game-Key': writeKey },
    body: JSON.stringify(body),
  });
  const postText = await post.text();
  if (post.status !== 201 && post.status !== 200) {
    return fail(`POST /api/score -> ${post.status}: ${postText}`);
  }

  // 3) Confirm it appears
  const after = await fetch(`${apiBase}/api/leaderboard?game=${GAME}&limit=20`).then((r) => r.json());
  const mine = (after.rows || []).find((r) => r.player === TEST_PLAYER);
  if (!mine) return fail('test score was accepted but does not appear in leaderboard');

  console.log('leaderboard round-trip OK');
  console.log(`  before: ${before.rows.length} rows, after: ${after.rows.length} rows`);
  console.log(`  test entry: ${JSON.stringify(mine)}`);
  console.log('\nPASS: write key works. The test row remains on the live board.');
  console.log('You may delete it from the Turso database if you do not want it.');
}

main().catch((e) => fail(e.message));