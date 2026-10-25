# Finance Tracker

Personal finance portal built on the Volt Bootstrap 5 dashboard theme.
Static site (no build step) → **Vercel**, data → **Supabase**, installable on phone as an app (PWA).

| Tab | What it tracks |
|---|---|
| Dashboard | Stat cards, monthly in-vs-out bar chart, income-by-source pie, recent transactions, income by job |
| Jobs *(comes in)* | Your 10 jobs (pre-loaded on first login) with Start – End dates; tap a job to see its pay stubs. New stubs can only be added to active (not completed) jobs: Sr., Pay Period, Pay Date, Hours, Net Pay |
| CRA / Other Income *(comes in)* | Sr., Description, Date Received, Amount |
| 10th-20th Bhaag *(goes out)* | Auto-calculated per month from net pay + CRA/Other. % is adjustable per row (10, 20, anything). Donations you give are recorded here and the balance is shown |
| India Payment *(goes out)* | Sr., Date, CAD, CA Account, Rate (auto = INR ÷ CAD, 2 decimals), INR, Comments. Loan tracker: Total loan − Total received (INR) = Remaining loan |
| Money Lent | Sr., Name, Description, Amount, Due Date + status (Pending / Partial / Returned / Overdue) and partial repayments |

Every table supports Add, Edit and Delete. A year selector at the top filters every tab except Money Lent (which always shows everything outstanding).

---

## 1. Supabase (database + login)

1. Create a project at <https://supabase.com>.
2. **SQL Editor → New query** → paste all of `supabase/schema.sql` → **Run**.
   It creates 7 tables with Row Level Security, so only your signed-in account can read or write your rows. Safe to run again.
3. **Authentication → Users → Add user → Create new user**: your email + a strong password, tick *Auto Confirm User*.
4. **Authentication → Sign In / Providers**: turn **off** "Allow new users to sign up" so nobody else can create an account.
5. **Project Settings → API**: copy the **Project URL** and the **anon / publishable** key.

## 2. GitHub + Vercel (keys stay out of git)

The Supabase URL and key are **not** in the repo. `assets/js/config.js` is in `.gitignore`; Vercel creates it at deploy time from environment variables.

```bash
git remote add origin https://github.com/<you>/finance-tracker.git
git push -u origin main
```

On <https://vercel.com>: **Add New → Project → Import** the repo.

1. Framework preset: **Other**. Leave Build Command and Output Directory empty (`vercel.json` sets them: `node scripts/build.js` → `dist`).
2. Open **Environment Variables** and add:

   | Name | Value |
   |---|---|
   | `SUPABASE_URL` | `https://xxxx.supabase.co` |
   | `SUPABASE_ANON_KEY` | your anon / publishable key (`eyJ...` or `sb_publishable_...`) |

3. Deploy. If either variable is missing, the build fails with a clear message instead of deploying a broken site.

If you change a variable later, redeploy (Deployments → ⋯ → Redeploy) for it to take effect.

Then in Supabase → **Authentication → URL Configuration**, set *Site URL* to your Vercel URL.

### What "confidential" means here

- The key is kept out of GitHub, so it isn't in your repo or its history.
- A browser app still needs the key to talk to Supabase, so the deployed `config.js` is downloadable by anyone who opens your site. That is expected for the **anon / publishable** key. What protects your data is Row Level Security (only your login can read or write rows) and turning off sign-ups (step 1.4).
- **Never** use the `service_role` / secret key in this app. It bypasses RLS and must stay server-side only.

### Running locally

```bash
cp assets/js/config.example.js assets/js/config.js   # fill in your values; git ignores this file
python3 -m http.server 8000                          # open http://localhost:8000
```

## 3. Supabase redirect (optional)

Add `http://localhost:8000` under Supabase → Authentication → URL Configuration → Redirect URLs if you test locally.

## 4. Install on your phone

Open the Vercel URL on your phone and sign in.

- **iPhone (Safari):** Share → *Add to Home Screen*.
- **Android (Chrome):** ⋮ menu → *Install app* (or *Add to Home screen*).

It opens full-screen like a native app. An internet connection is needed to load and save data.

## Database changes after first setup

If you already ran `schema.sql`, run the files in `supabase/migrations/` that you haven't run yet (SQL Editor → paste → Run). Each one is safe to run more than once. Re-running the full `schema.sql` also works.

- `001_job_dates.sql` adds Start / End dates to jobs.
- `002_settings.sql` adds the settings table used by the India loan tracker (total loan amount).
- `003_display_name.sql` adds your display name (shown in the top bar instead of your email).

## Updating the app

After changing any file, bump `CACHE` in `sw.js` (e.g. `finance-v2`) so installed phones fetch the new version, then push — Vercel redeploys automatically.

## Files

```
index.html               app shell (sidebar, top bar, login, form modal)
assets/js/app.js         all pages, forms, charts, Supabase calls
assets/js/config.example.js  template for local config.js (real config.js is git-ignored)
scripts/build.js         Vercel build step: copies the site to dist/ and writes config.js from env vars
assets/css/volt.min.css  Volt theme (compiled from themesberg/volt-bootstrap-5-dashboard, MIT)
assets/css/app.css       small additions
assets/vendor/           Bootstrap 5.0.2 JS, Chart.js 4.4.1
manifest.webmanifest, sw.js, assets/icons/   PWA install support
supabase/schema.sql      database tables + security (full, for a new project)
supabase/migrations/     changes to run on an existing database
vercel.json              build command + headers
```

## Notes on the calculations

- **Bhaag due** = Σ(net pay × row %) + Σ(CRA/Other amount × row %). The month is taken from the pay date / date received.
- Changing the % on a Bhaag row updates every income entry in that month+source. You can also set the % per entry in the Jobs / CRA forms.
- **Balance** = Bhaag due − donations given (for the selected year).
- A job that still has pay stubs can't be deleted; delete or move its stubs first.

Theme: Volt by Themesberg, MIT licence — see `assets/css/VOLT-LICENSE.md`.
