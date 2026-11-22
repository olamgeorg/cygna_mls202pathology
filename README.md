# cygna_mls202pathology
**Cygna MLS202 Pathology Quiz** - MLS 202 - Pathology
© cygna.co - cygna.consult

A mobile-first quiz PWA with **280 MCQs (7 topics x 40)** built ONLY from the MLS 202 lecturer notes
(*The Roles of the Histopathologist in the Hospital* and *Inflammation*), with Supabase login,
saved scores and an admin dashboard. Pure HTML + CSS + Vanilla JS. **No npm, no Node, no build step.**

## Files
```
cygna_mls202pathology/
  index.html            quiz app (login, home, quiz, result, scores, settings)
  style.css             themes, backgrounds, font sizes, layout
  app.js                app logic (auth, quiz engine, scores, settings, PWA)
  questions.js          all 280 questions
  supabase-config.js    Supabase URL + publishable key (hardcoded)
  admin.html / admin.js admin dashboard (only olamgeorg9@gmail.com)
  manifest.json         PWA manifest (inline SVG icons 192 + 512)
  sw.js                 service worker (offline)
  schema.sql            Supabase tables, policies, admin check (run once)
  README.md             this file
```

## The 7 topics (40 questions each)
1. Tissue Diagnosis and Biopsy
2. Tissue Processing and Biopsy Evaluation
3. Cytopathology (FNAC and Pap Smear)
4. Autopsy Pathology
5. Overview of Inflammation
6. Acute Inflammation
7. Chronic Inflammation

## About the Supabase key (hardcoded)
`supabase-config.js` contains the project URL and the **publishable** key
(`sb_publishable_...`). That key is designed to live in browser code. Your data is protected by the
Row Level Security policies in `schema.sql`, not by hiding the key.
**NEVER put a `secret` / `service_role` key anywhere in this project.**
Because the key is hardcoded, you do **not** need to add any Vercel environment variables.
(If you ever rotate the key, edit `supabase-config.js` and redeploy.)

Only the admin name and email are hardcoded (`ADMIN_NAME`, `ADMIN_EMAIL` in `app.js` and `admin.js`,
and the same email inside `schema.sql`).

## Setup, step by step

### 1. Supabase
1. Open your Supabase project (the same one used for App 6).
2. Go to **SQL Editor > New query**, paste all of `schema.sql`, click **RUN**.
   It is safe on a project where `profiles` and `results` already exist: it only adds missing columns,
   and uses `DROP POLICY IF EXISTS` before every `CREATE POLICY`.
3. Go to **Authentication > URL Configuration**:
   - **Site URL** = your Vercel URL (e.g. `https://cygna-mls202pathology.vercel.app`)
   - **Redirect URLs** = add the same URL (used for email confirmation and password reset).
4. Go to **Authentication > Providers > Email**. Keep **Confirm email** ON if you want verified emails
   (recommended: the admin check uses the verified email in the login token).

### 2. GitHub
1. Create a new repository, e.g. `cygna_mls202pathology`.
2. Upload ALL the files above to the repo root (drag and drop on github.com > Add file > Upload files).

### 3. Vercel
1. vercel.com > **Add New > Project** > import the GitHub repo.
2. Framework Preset: **Other**. Build command: *(leave empty)*. Output directory: *(leave empty)*.
3. Click **Deploy**. Your app is live.

### 4. Create your admin account (do this FIRST)
1. Open your live app > **Sign Up**.
2. Full Name: **Olamide George**, Email: **olamgeorg9@gmail.com**, choose your own password.
   (Do this before students so nobody else can register your admin email.)
3. Confirm the email if asked, then **Login**.
4. You will see an **Admin** button next to Logout. It opens `admin.html`.
   Anyone whose email is not `olamgeorg9@gmail.com` is redirected back to `index.html`.

### 5. Students
Students sign up with Name, Email and Password, then pick topics and start.
Accounts created in another app on the same Supabase project are blocked with
*"This account is not for MLS202 Pathology"* (the admin is exempt).

## Using the app
- **Home**: select 1, several or all topics (counts shown, Select All / Clear All), choose 10, 20, 30, 40, 50, 100 or All, pick a mode, Start.
- **Practice Mode**: answer + explanation straight away, no timer.
- **Exam Mode**: no answers until the end, timer counts up, full review at the end.
- **Timed Mode**: 60 seconds per question, auto-next, pause button, auto-submit at the end.
- Questions and options are shuffled every time.
- **Result**: score ring, %, grade (A 70+, B 60-69, C 50-59, D 45-49, F below 45), Pass/Fail (pass = 50%), correct / wrong / skipped, full review with explanations, Retake / New Quiz / Go Home.
- **My Scores**: quizzes taken, average, best, last, progress bar per topic, strong vs weak topics (strong = 60%+), history, Clear History (clears on that device only).
- **Settings** (gear icon): 8 themes (Light, Dark, Green, Blue, Purple, Pink, Orange, Black/AMOLED), 3 backgrounds, 3 font sizes. Saved on the device and applied instantly.

## Admin dashboard (`admin.html`)
Total students, total quizzes, average score, pass rate; student list (name, email, date joined);
all scores (name, email, topics, mode, score, %, grade, date, time used); search by name/email;
filter by topic, mode and date range; weak vs strong topics for all students and per student;
delete a student or a score; export CSV (respects the filters).
Every query is filtered with `.eq("app_name", "cygna_mls202pathology")`, and every insert stores that `app_name`.

Note: deleting a student removes their profile and scores. Their login remains under
**Authentication > Users** in Supabase until you delete it there.

## Offline / install
After the first load the app works offline (service worker). Scores taken offline are kept on the
device and sync to Supabase when you are back online. Use the **Install App** button (or the browser's
install option) to add it to the home screen.

## Troubleshooting
- *"Could not load data" in admin*: you have not run `schema.sql`, or you are not logged in as the admin email.
- *Delete says nothing was deleted*: run `schema.sql` again (it creates the admin delete policies).
- *No confirmation email*: check spam, or turn off **Confirm email** in Supabase Auth settings.
- *Update not showing*: hard refresh once; the service worker refreshes its cache on the next load.

## Source of questions
Every question, answer and explanation is traceable to a slide in the two lecture decks;
each question carries a `source` field (deck + slide number). Slides that are blank in the notes
("???" for vasodilatation, vasoconstriction and examples of ulcers) were not used.

---
© cygna.co - cygna.consult
