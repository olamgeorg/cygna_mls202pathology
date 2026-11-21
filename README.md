# cygna_mls202pathology
Cygna MLS202 Pathology Quiz. Static site (HTML, CSS, vanilla JS). No npm, no build step. (c) cygna.co - cygna.consult

## 1. Supabase
1. supabase.com > New project. Wait until it is ready.
2. SQL Editor > New query > paste all of `schema.sql` > Run.
3. Project Settings > API: copy **Project URL** and **anon public key**.
4. Authentication > URL Configuration: set Site URL to your Vercel link (needed for Forgot Password).
5. Optional: Authentication > Providers > Email > turn off "Confirm email" for instant sign-up.

## 2. GitHub
1. github.com > New repository `cygna_mls202pathology` > Create.
2. Add file > Upload files > drag in ALL files and the `api` folder (index.html, style.css, app.js, questions.js, questions_ext1.js, supabase-config.js, admin.html, admin.js, manifest.json, sw.js, schema.sql, README.md, api/config.js) > Commit.

## 3. Vercel
1. vercel.com > Add New > Project > import the repo > Deploy (Framework: Other, no build command).
2. Settings > Environment Variables: add `SUPABASE_URL` and `SUPABASE_ANON_KEY` (values from step 1.3), for all environments.
3. Deployments > Redeploy. Your app is live. The keys are served by `/api/config`, so they never sit in GitHub.

## 4. Admin login
Sign up in the app with Name: Olamide George and Email: olamgeorg9@gmail.com, then log in. An **Admin** button appears on the home screen (admin.html). Admin name and email are hardcoded in app.js and admin.js; non-admins are redirected to index.html. The Supabase policies in schema.sql also restrict admin data to that email.

## Notes
- Adding questions: add rows in `questions.js` or an `questions_ext*.js` file (add its script tag after questions.js in index.html, admin.html and sw.js) (first option in each row is the correct one; the app shuffles).
- Install: open the live link in Chrome and tap Install App.
