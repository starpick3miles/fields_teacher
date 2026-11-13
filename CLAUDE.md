# CLAUDE.md — 필즈 출석부 (fields_app)

Mobile web app for teachers at Fields (필즈더클래식), a Korean elementary math academy. A teacher uses it on her phone in class for 출석 (attendance), 숙제 확인 (homework check), 자리배치 (seating), 골든벨 (in-class quiz with scoring and ranking) and Excel export. Owner: Jay.

> [!IMPORTANT]
> **MANDATORY WORKFLOW RULE:**
> 1. **Always read `docs/HISTORY.md` first** before doing anything to see what is up-to-date and understand recent decisions.
> 2. **Always record in `docs/HISTORY.md`** immediately after making any change in code (date, what changed, why, who asked).

Read `docs/CONTEXT.md` (academy domain), `docs/APP.md` (how the app behaves and why) and `docs/HISTORY.md` (edit history, decisions, open questions) before changing behavior.

## Stack and layout

Static site, no build step, no framework, no package.json. GitHub Pages serves the files as they are.

```
index.html        shell; loads css/style.css, then the scripts below in this order
css/style.css     all styles (design tokens in :root, light + dark)
js/storage.js     window.FieldsStorage — the only code that touches persistence (localStorage adapter)
js/files.js       window.FieldsFiles — saveBlob (download), readText
js/backup.js      window.FieldsBackup — parse/validate a backup file (pure, no DOM)
js/i18n.js        CONFIG, storage keys, I18N strings (ko/en), t()
js/model.js       dates, data-model helpers (keys, attStatus, hwGet/hwWrite, seating), 골든벨 점수
js/teachers.js    TEACHERS config: classes, rosters, plans, history (children's names live here)
js/data.js        teacher PIN, settings, mergeTeacher, load / persist / save, backup
js/views.js       UI state, toast, viewPick/Home/Class/Seat/Gb/Results, render()
js/excel.js       Excel export: buildLogbook (공식 출석부, 수업일지 layout), buildWorkbook (기록 요약), runExport
js/app.js         actions, the delegated click/change handlers, startup; loaded last
tests/e2e.py      Playwright end-to-end check
firestore.rules   Firestore security rules (firebase.json, .firebaserc); deploy: firebase deploy --only firestore:rules
docs/             context and history
```

The app files are plain scripts with no IIFE: they share the global scope, in the load order above. Code that runs at load time may only use names from earlier files; functions may call anything. Where things are (search for the section comments):

| File | Section | What |
|---|---|---|
| `i18n.js` | `CONFIG`, `I18N`, `t()` | settings, ko/en strings |
| `model.js` | `data model` | key helpers (`akey`, `qkey`, `mkey`), `attStatus`, `hwGet/hwWrite`, seating helpers |
| `model.js` | `골든벨 점수` | `GB_PTS`, `gbQPts`, `gbScores`, `gbQRank` — computed from marks, never stored |
| `teachers.js`, `data.js` | `TEACHERS` | one entry per teacher: classes, rosters, plans, history. `mergeTeacher` seeds it into `db` |
| `data.js` | `load` / `persist` / `save` | whole store = one JSON string under `fields-attendance-v1` |
| `data.js` | `backup` | `importLegacy`, `backupSave`, `backupLoad` |
| `views.js` | `viewPick/Home/Class/Seat/Gb/Results`, `render()` | each view returns an HTML string; `render()` sets `app.innerHTML` |
| `excel.js` | `buildLogbook`, `buildWorkbook`, `runExport` | Excel (ExcelJS): 수업일지 and 기록 요약 |
| `app.js` | `app.addEventListener("click")` | one delegated handler; a `switch` on `data-act` |

## Commands

```bash
python3 -m http.server 8000        # run locally → http://localhost:8000 (file:// also works, but use a server)
for f in js/*.js; do node --check "$f"; done   # syntax check (there is no bundler or linter)
python3 tests/e2e.py               # end-to-end test; setup in tests/README.md
```

Deploy = push to `main`; GitHub Pages redeploys (see README.md).

## Rules for this codebase

- **No build step.** Keep plain scripts loaded by `index.html`. Do not add npm dependencies, bundlers or frameworks unless Jay asks.
- **Persistence only through `window.FieldsStorage`.** Never call `localStorage` from the app files. This is the seam for Firebase later (`docs/APP.md` → Storage).
- **`persist()` can fail.** It returns false and shows a toast; do not assume a save succeeded.
- **Every UI string goes through `t(key)`** with both `ko` and `en` entries in `I18N`. Korean is the default and the tone is polite 해요체.
- **Escape data with `esc()`** before putting it in HTML strings (student names, notes, comments).
- **No native `alert`/`confirm`/`prompt`.** Confirmations are in-page (`state.confirm`), feedback is `toast()`.
- **Autosave every interaction.** No save buttons for records.
- **State is never shown by color alone**; always a label or symbol.
- **Touch targets ≥ 44px**, portrait phone, 360–430px wide; the page body never scrolls sideways.
- **Excel output is always Korean**, whatever the UI language. ExcelJS is pinned (`EXCELJS_URL` + `EXCELJS_SRI`); change both together (README → Updating ExcelJS). Do not swap to SheetJS: the free build cannot write fills, borders, dropdowns or conditional formats, which the 수업일지 layout needs.
- **Stored data must stay readable.** Devices hold real records under `fields-attendance-v1`. Never rename keys or change record shapes without a migration in `load()`/`mergeTeacher`, and keep old backups loadable (`js/backup.js`).
- **Record keys use `_` as the separator** (`date_classId_studentId`). Teacher ids and class ids must not contain `_`.
- **Scores are derived, not stored.** Keep `gbScores` a pure function of `gbMarks`.
- **Roster or schedule changes** are edits to `TEACHERS`. `mergeTeacher` runs on every load, so config edits reach devices that already have data; history is seeded once per (teacher, kind, class, date) and a record the teacher cleared is never brought back.
- **Dates** are `"YYYY-MM-DD"` strings in the device's local time (the academy is in Asia/Seoul).

## Privacy (read before pushing)

- `js/teachers.js` contains children's names (rosters) and seeded attendance history. The GitHub Pages site and a public repo expose them to anyone with the link. `robots.txt` and the `noindex` meta only keep search engines away. Jay knows; moving rosters out of the code is an open item.
- Never commit real backups or exports. `.gitignore` covers `*백업*.json` and `*.xlsx`; keep it that way.
- Do not add phone numbers, birthdates, addresses or photos to the data.
- The teacher-switch PIN is only a hash in the page and is checked in the browser. It stops casual switching and is not security. Do not write the PIN in the repo.

## Before you finish a change

1. `for f in js/*.js; do node --check "$f"; done`
2. `python3 tests/e2e.py` passes (update the test when behavior changes on purpose).
3. For Excel changes, open both exported files (수업일지, 기록 요약) and look at them.
4. Add an entry to `docs/HISTORY.md` (date, what changed, why, who asked).
