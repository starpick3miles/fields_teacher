# 필즈 출석부 (fields_app)

A static single-page app. No build step, no server: GitHub Pages serves the files as they are.

```
index.html        page shell; loads the CSS and the four scripts in order
css/style.css     all styles
js/storage.js     persistence adapter (localStorage today; the only file to change for Firebase)
js/files.js       file download (Excel, backup) and file reading
js/backup.js      backup-file validation (pure functions)
js/app.js         the app: data model, teachers/classes config, UI, 골든벨 scoring, Excel builders
tests/            Playwright end-to-end test (tests/README.md)
docs/             CONTEXT.md (the academy), APP.md (behavior and data model), HISTORY.md (edit history, open questions)
AGENT.md          universal instructions for AI coding agents
AGENTS.md         instructions for OpenAI Codex / GPT agents
GEMINI.md         instructions for Gemini & Antigravity agents
CLAUDE.md         instructions for Claude Code
robots.txt        asks search engines not to index the site
.nojekyll         tells GitHub Pages to serve files as-is (skip Jekyll processing)
```

Working with AI agents: open this folder and start your agent tool. Claude Code reads `CLAUDE.md`, Gemini / Antigravity reads `GEMINI.md`, and OpenAI Codex / GPT agents read `AGENTS.md` (or `AGENT.md`). Run locally with `python3 -m http.server 8000`.

## Deploy on GitHub Pages

1. **Create the repository.** On github.com: New repository → name it e.g. `fields-attendance` → Public → Create.
   Free GitHub Pages only publishes from public repos (Pro/Team can publish from private repos, but the site itself is still public).

2. **Push the files.** From this folder:
   ```bash
   git init
   git add .
   git commit -m "필즈 출석부 static site"
   git branch -M main
   git remote add origin https://github.com/<your-username>/fields-attendance.git
   git push -u origin main
   ```
   Or, without the command line: on the empty repo page click "uploading an existing file" and drag in the *contents* of this folder (keep the `css/`, `js/`, `docs/` and `tests/` folders). `.nojekyll` and `.gitignore` are hidden files; `.nojekyll` must be uploaded, so drag it in explicitly or create it on GitHub (Add file → Create new file → name `.nojekyll`, leave it empty).

3. **Turn on Pages.** Repository → Settings → Pages → Build and deployment → Source: **Deploy from a branch** → Branch: **main**, folder **/(root)** → Save.
   Why root: `index.html` sits at the top of the repo, and Pages serves `index.html` from the folder you pick.

4. **Wait for the deploy** (about 1 minute; the Actions tab shows a "pages build and deployment" run). The URL appears at the top of Settings → Pages:
   `https://<your-username>.github.io/fields-attendance/`

5. **Set it up on the teacher's device.** Open the URL in the browser she will always use (same browser, same profile: localStorage belongs to one origin in one browser).
   - iPad/iPhone Safari: Share → Add to Home Screen. Android Chrome: ⋮ → Add to Home screen.
   - Pick the teacher, take one attendance, then ⚙ 설정 → 💾 백업 저장 once to confirm downloads work.

6. **Updating later.** Edit, commit, push. Pages redeploys automatically. Records are not affected: they live in the browser, not in the repo. If the page looks stale after a push, reload once (Pages caches files for up to 10 minutes).

## Deploy on Vercel

Live at **https://fields-attendance.vercel.app** (project `fields-attendance`, team `fields7`). `vercel.json` serves the repo root as a static site with no build; `.vercelignore` keeps `tests/`, `docs/` and `*.md` out.

```bash
export PATH=/usr/local/bin:$PATH   # this Mac: Homebrew's Node is broken, use Node 22 here
npx vercel deploy --prod           # uploads the files on disk (committed or not)
```

The GitHub repo `starpick3miles/fields_teacher` is connected: a push to `main` deploys production, a push to another branch makes a preview. The command above is only needed to deploy without pushing. The Vercel address is a different origin from GitHub Pages: records saved at one are not visible at the other (move them with 백업 저장 → 백업 불러오기 → 합치기).

## Where the data lives and how not to lose it

Records are stored in the browser's localStorage for this site's origin (`<username>.github.io`). They are erased if the teacher clears browsing data/site data, uses private browsing, or switches browser or device. Safari may also delete data for a site that has not been opened for 7 days when it is used as a normal tab (a Home Screen web app is exempt).

So: save a backup regularly (⚙ 설정 → 💾 백업 저장). The settings sheet shows when the last backup was saved. Restoring (📂 백업 불러오기) validates the file first and then asks for confirmation, showing the backup's date and record counts, with a "지금 기록 먼저 백업" button to save the current state before replacing it.

Note: every page on `<username>.github.io` shares one origin, so another Pages project under the same account could read this app's localStorage. Keep other experiments on a different account or give this app its own custom domain if that matters.

## Privacy

The class rosters (student names) are in `js/app.js`, so a public repo and the public site expose them. `robots.txt` and the `noindex` meta tag keep search engines away, but anyone with the URL or repo link can see them. Before deploying, decide whether that is acceptable for the academy; if not, move the rosters out of the code (e.g. load them from a backup-style JSON file kept on the device, or put them behind Firebase Auth once Firebase is added).

## Updating ExcelJS

The Excel export loads `exceljs@4.4.0` from jsDelivr only when the teacher taps 내보내기, with a Subresource Integrity hash so the browser rejects any file that differs from the pinned one. To change versions, update `EXCELJS_URL` in `js/app.js` and recompute the hash:

```bash
curl -sL https://cdn.jsdelivr.net/npm/exceljs@<version>/dist/exceljs.min.js | openssl dgst -sha384 -binary | openssl base64 -A
```

Put the result in `EXCELJS_SRI` as `sha384-<hash>`. If the hash is wrong, the export shows "엑셀 도구를 불러오지 못했어요".

## Shared storage (Firebase)

Without a backend the app keeps records in the browser only. To share them across phones, browsers and links, connect a Firebase project. The app loads the Firebase SDK from Google's CDN only when a backend is configured; there is still no build step.

**Connected (2026-11-13):** project **FieldsTeacher** (`fieldsteacher-9b4e9`) on Jay's Google account, Firestore in `asia-northeast3` (Seoul), Anonymous sign-in on, authorized domains `localhost` and `fields-attendance.vercel.app`. The config is in `js/remote-config.js`. Console: https://console.firebase.google.com/project/fieldsteacher-9b4e9

- The rules live in `firestore.rules` (with `firebase.json`, `.firebaserc`; none of them is deployed to the website). Change the file, then publish it: `firebase deploy --only firestore:rules` (Firebase CLI, signed in as the project owner).
- The tests set `window.FIELDS_REMOTE = null`, so they never write to the real project. `tests/sync.py` uses its stand-in backend.
- A new domain (another Vercel address, GitHub Pages) must be added under Authentication → Settings → Authorized domains, or sign-in fails there.

The steps below are for setting up a project from scratch.

1. [Firebase console](https://console.firebase.google.com) → **Add project** (Analytics is not needed).
2. **Build → Firestore Database → Create database**. Location `asia-northeast3` (Seoul). Start in production mode.
3. **Build → Authentication → Sign-in method → Anonymous → Enable**. Under **Settings → Authorized domains** add the site's domain (`fields-attendance.vercel.app`, or `<username>.github.io`).
4. **Firestore → Rules**, publish `firestore.rules` from this repo (`firebase deploy --only firestore:rules`). The minimum is:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /records/{id} { allow read, write: if request.auth != null; }
     }
   }
   ```

5. **Project settings → Your apps → Web app (`</>`)** → copy the config object into `js/remote-config.js`:

   ```js
   window.FIELDS_REMOTE = { kind: "firestore", config: { apiKey: "…", authDomain: "…", projectId: "…", appId: "…" } };
   ```

6. Push to `main`. On each phone, the first open uploads the records that browser already holds (a one-line message says how many).

What to know:
- **Who can read it.** Anonymous sign-in means anyone who has the site link can read and write the records, the same exposure the rosters in `js/teachers.js` have today. Real per-teacher access needs a real sign-in.
- **Records made in the Claude artifact** live in that page's own browser storage, which this site cannot read. Bring them over once per phone: in the artifact, 설정 → 백업 저장; here, 설정 → 백업 불러오기 → **합치기**.
- **Usage.** One Firestore document per record (`records/<collection>/<key>`). A phone that opens the app for the first time reads every document once, including the seeded history; later opens read only what changed. The free tier (50,000 reads and 20,000 writes a day) is enough for a pilot.
- **Offline.** Taps are saved on the phone at once and queued; "⚠ 저장 안 됨 · n건 대기" shows until they reach Firebase. The page itself still needs the network to open (no service worker yet).
- How it works: the header of `js/sync.js`. Test: `python3 tests/sync.py` (uses a stand-in backend, not Firebase).
