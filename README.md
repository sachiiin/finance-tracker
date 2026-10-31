# Finance Tracker

Personal finance portal built on the Volt Bootstrap 5 dashboard theme.
Plain HTML/CSS/JS hosted on **Vercel**, data in **Supabase**, installable on a phone as an app (PWA).

| Tab | What it tracks |
|---|---|
| Dashboard | Totals (tap a card to open its page), monthly in-vs-out chart, income by source, recent transactions, income by job |
| Accounts | Chequing, savings, credit cards and cash with payment methods; balances you update → cash on hand, cards owed, net; money in / spent this month |
| Jobs *(comes in)* | Your jobs with start – end dates; tap a job to see its pay stubs (pay period, pay date, hours, net pay, deposited to) |
| CRA / Other Income *(comes in)* | Description, date received, amount, deposited to |
| 10th-20th Bhaag *(goes out)* | Worked out per month from net pay + CRA/Other (10%, 20% or any % per row); donations given and the balance left |
| India Payment *(goes out)* | Date, CAD, account, rate (= INR ÷ CAD), INR, comments; optional loan tracker |
| Expenses *(goes out)* | Everyday spending by account, method and category; credit card payments kept separate (not counted as spending) |
| Money Lent | Who owes you, due dates, status, partial repayments |

Every table supports add, edit and delete. The year selector at the top filters the tabs by year.

---

## New setup (about 15 minutes)

You need free accounts on **GitHub**, **Supabase** and **Vercel**.

### 1. Get the code into your own GitHub repo

Upload or push this folder to a **new private repository** on GitHub, for example:

```bash
git init -b main
git add .
git commit -m "Finance tracker"
git remote add origin https://github.com/<your-username>/finance-tracker.git
git push -u origin main
```

(GitHub Desktop works too: File → Add local repository → choose this folder → Publish repository, and keep *Keep this code private* ticked.)

### 2. Create the database in Supabase

1. Create a project at <https://supabase.com>.
2. Open **SQL Editor → New query**, paste the whole of **`supabase/schema.sql`** and click **Run**.
   It creates all 11 tables with Row Level Security. The last result lists the tables; every row should show `rls_on = true`.
3. **Authentication → Users → Add user → Create new user**: enter your email and a strong password, and tick **Auto Confirm User**.
4. **Authentication → Sign In / Providers**: turn **off** *Allow new users to sign up*, so nobody else can create an account.
5. **Project Settings → API**: copy the **Project URL** and the **anon / publishable** key for the next step.

### 3. Put it online with Vercel

The Supabase URL and key never go into GitHub: `assets/js/config.js` is git-ignored, and Vercel creates it during each deploy.

1. On <https://vercel.com>: **Add New → Project → Import** your repo. Framework preset: **Other**. Leave Build Command and Output Directory empty (`vercel.json` sets them).
2. Under **Environment Variables**, add:

   | Name | Value |
   |---|---|
   | `SUPABASE_URL` | your Project URL, e.g. `https://xxxx.supabase.co` |
   | `SUPABASE_ANON_KEY` | your anon / publishable key (`eyJ...` or `sb_publishable_...`) |

3. Click **Deploy**. If either variable is missing, the build stops with a clear message.
4. Back in Supabase → **Authentication → URL Configuration**, set **Site URL** to your Vercel address.

If you change a variable later, redeploy (Deployments → ⋯ → Redeploy) for it to take effect.

### 4. First sign-in

Open your Vercel address and sign in with the user from step 2.3. Everything starts empty:

1. **Accounts → Add Account** for each bank account, credit card and cash (payment methods such as `Interac, UPI` or `Card`).
2. **Jobs → Add Job**, then **Add Pay Stub** under each job.
3. Top-right menu → **Edit name** to show your name instead of your email.

### 5. Install on your phone

- **iPhone (Safari):** Share → *Add to Home Screen*.
- **Android (Chrome):** ⋮ menu → *Install app*.

It opens full-screen like an app. An internet connection is needed to load and save data.

---

## Keys and privacy

- The anon / publishable key is designed to be used in the browser, so anyone who opens the site can see it in `config.js`. Your data is protected by **Row Level Security** (each login only sees its own rows) and by **turning off sign-ups**.
- **Never** put the `service_role` / secret key in this app. It bypasses Row Level Security.

## Running on your computer

```bash
cp assets/js/config.example.js assets/js/config.js   # fill in your URL and key; git ignores this file
python3 -m http.server 8000                          # then open http://localhost:8000
```

Use the server rather than opening `index.html` directly. If sign-in fails locally, add `http://localhost:8000` under Supabase → Authentication → URL Configuration → Redirect URLs.

## Updating an existing setup

Copy in the new files, commit and push; Vercel redeploys. Bump `CACHE` in `sw.js` (e.g. `finance-v12`) so installed phones pick up the new version.

## Files

```
index.html                   app shell (sidebar, top bar, sign-in, form window)
assets/js/app.js             all pages, forms, charts and Supabase calls
assets/js/config.example.js  template for a local config.js (the real one is git-ignored)
assets/css/volt.min.css      Volt theme (compiled from themesberg/volt-bootstrap-5-dashboard, MIT)
assets/css/app.css           small additions
assets/vendor/               Bootstrap 5.0.2 JS, Chart.js 4.4.1
manifest.webmanifest, sw.js, assets/icons/   phone install support
scripts/build.js             Vercel build: copies the site to dist/ and writes config.js from the env vars
supabase/schema.sql          the complete database setup (one file)
vercel.json                  build settings and security headers
```

## How the numbers are worked out

- **Bhaag due** = Σ(net pay × row %) + Σ(CRA/Other amount × row %), grouped by month of pay date / date received and rounded to the cent per month.
- **Bhaag balance** = Bhaag due − donations given (for the selected year).
- **India rate** = INR ÷ CAD, saved with 2 decimals.
- **Account balances** are what you enter from your bank (with an "as of" date); expenses don't change them. Credit card payments are transfers, not spending.
- A job that still has pay stubs, or an account that still has expenses, can't be deleted until those are removed.

Theme: Volt by Themesberg, MIT licence – see `assets/css/VOLT-LICENSE.md`.
