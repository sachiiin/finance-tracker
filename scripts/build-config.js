// Writes assets/js/config.js from environment variables.
// Runs on Vercel as the build command, so the Supabase values live in
// Vercel → Project → Settings → Environment Variables, not in git.
const fs = require('fs');
const path = require('path');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variable.');
  process.exit(1);
}

const out = path.join(__dirname, '..', 'assets', 'js', 'config.js');
fs.writeFileSync(out,
  '// Generated at build time from environment variables. Do not commit.\n' +
  `window.APP_CONFIG = ${JSON.stringify({ SUPABASE_URL: url, SUPABASE_ANON_KEY: key }, null, 2)};\n`);
console.log('Wrote assets/js/config.js');
