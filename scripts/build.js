// Vercel build: copies the static site into dist/ and writes dist/assets/js/config.js
// from environment variables, so the Supabase values live in
// Vercel → Project → Settings → Environment Variables, not in git.
const fs = require('fs');
const path = require('path');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variable.');
  process.exit(1);
}

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist);

// The files the site needs (nothing else is published: no SQL, scripts or README)
for (const item of ['index.html', 'manifest.webmanifest', 'sw.js', 'assets']) {
  fs.cpSync(path.join(root, item), path.join(dist, item), { recursive: true });
}

fs.writeFileSync(path.join(dist, 'assets', 'js', 'config.js'),
  '// Generated at build time from environment variables. Do not commit.\n' +
  `window.APP_CONFIG = ${JSON.stringify({ SUPABASE_URL: url, SUPABASE_ANON_KEY: key }, null, 2)};\n`);
console.log('Built dist/ with assets/js/config.js');