# Finance Tracker

Personal finance portal built on the Volt Bootstrap 5 dashboard theme.
Static site (no build step) → **Vercel**, data → **Supabase**, installable on phone as an app (PWA).

| Tab | What it tracks |
|---|---|
| Dashboard | Stat cards, monthly in-vs-out bar chart, income-by-source pie, recent transactions, income by job |
| Jobs *(comes in)* | Your 10 jobs (pre-loaded on first login) and their pay stubs: Sr., Pay Period, Pay Date, Hours, Net Pay |
| CRA / Other Income *(comes in)* | Sr., Description, Date Received, Amount |
| 10th-20th Bhaag *(goes out)* | Auto-calculated per month from net pay + CRA/Other. % is adjustable per row (10, 20, anything). Donations you give are recorded here and the balance is shown |
| India Payment *(goes out)* | Sr., Date, CAD, CA Account, Rate, INR (auto = CAD × Rate, editable), Comments |
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

## 2. Configure

Edit `assets/js/config.js`:

```js
window.APP_CONFIG = {
  SUPABASE_URL: 'https://xxxx.supabase.co',
  SUPABASE_ANON_KEY: 'eyJ... or sb_publishable_...'
};
```

The anon/publishable key is designed to be public; RLS protects the data. **Never** put the `service_role` / secret key here.

## 3. GitHub + Vercel

```bash
git remote add origin https://github.com/<you>/finance-tracker.git
git push -u origin main
```

On <https://vercel.com>: **Add New → Project → Import** the repo.
Framework preset: **Other**. Build command: *(empty)*. Output directory: *(empty / root)*. Deploy.

Then in Supabase → **Authentication → URL Configuration**, set *Site URL* to your Vercel URL.

## 4. Install on your phone

Open the Vercel URL on your phone and sign in.

- **iPhone (Safari):** Share → *Add to Home Screen*.
- **Android (Chrome):** ⋮ menu → *Install app* (or *Add to Home screen*).

It opens full-screen like a native app. An internet connection is needed to load and save data.

## Updating the app

After changing any file, bump `CACHE` in `sw.js` (e.g. `finance-v2`) so installed phones fetch the new version, then push — Vercel redeploys automatically.

## Files

```
index.html               app shell (sidebar, top bar, login, form modal)
assets/js/app.js         all pages, forms, charts, Supabase calls
assets/js/config.js      your Supabase URL + key
assets/css/volt.min.css  Volt theme (compiled from themesberg/volt-bootstrap-5-dashboard, MIT)
assets/css/app.css       small additions
assets/vendor/           Bootstrap 5.0.2 JS, Chart.js 4.4.1
manifest.webmanifest, sw.js, assets/icons/   PWA install support
supabase/schema.sql      database tables + security
vercel.json              headers for the service worker
```

## Notes on the calculations

- **Bhaag due** = Σ(net pay × row %) + Σ(CRA/Other amount × row %). The month is taken from the pay date / date received.
- Changing the % on a Bhaag row updates every income entry in that month+source. You can also set the % per entry in the Jobs / CRA forms.
- **Balance** = Bhaag due − donations given (for the selected year).
- A job that still has pay stubs can't be deleted; delete or move its stubs first.

Theme: Volt by Themesberg, MIT licence — see `assets/css/VOLT-LICENSE.md`.
