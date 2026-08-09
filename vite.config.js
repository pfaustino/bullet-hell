import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // Read VITE_* vars from .env / shell (VITE_LEADERBOARD_API, VITE_LEADERBOARD_WRITE_KEY).
  const env = loadEnv(mode, process.cwd(), '');
  const apiBase = (env.VITE_LEADERBOARD_API || '').replace(/\/$/, '');
  const writeKey = env.VITE_LEADERBOARD_WRITE_KEY || '';

  return {
    root: '.',
    publicDir: 'public',
    server: { port: 5177, strictPort: true },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },
    plugins: [
      {
        name: 'inject-leaderboard-env',
        // Replace the `__LEADERBOARD_*__` placeholders inside index.html's
        // inline script (game_v3.js is a plain script, so `import.meta.env`
        // isn't available there). Empty string = not configured -> the
        // leaderboard runs read-only/offline.
        transformIndexHtml(html) {
          return html
            .replaceAll('__LEADERBOARD_API__', JSON.stringify(apiBase))
            .replaceAll('__LEADERBOARD_WRITE_KEY__', JSON.stringify(writeKey));
        },
      },
    ],
  };
});