 # Edit history and decisions

Newest first. Add an entry for every change: date, what, why, who asked. "Jay" = the owner. Entries before 2026-11-11 summarize work done in Claude artifacts and come from the project docs, so they are less detailed.

## 2026-11-13 — 서현덕 corrected from the 대치 2611 진도표 (Jay)

Why: after the entry below, Jay said "actually refer to" `2611 대치 주간진도표.xlsx`. Built by Claude Code.

- The 진도표 lists 서현덕 as **B in all four 2-day classes**: 1-E1-5B 목6, 1-E2-10B 목3, 1-E2-7B 수3, 2-E1-2B 금3. The days were already right; 초1-E2-10 and 초2-E1-2 now also carry `role:"B"`, `sub:true` and log codes `초1-E2-10B`, `초2-E1-2B`.
- **Weekly plans (진도표) added** for all 10 classes, weeks of 11/2, 11/9, 11/16, 11/23 (`planWeeks`): B classes take the B row of their group (초1 E1: 필즈초급(상) 6–9호; 초1 E2: 필즈초급(상) 2–5호; 초2 E1: 6대수 3–6호); G/H classes take the group's 작성자 row, which he writes (초1-G 1-9R/1-10R, 초1-H 1-9P, 초2-G 2G3R).
- The workbook was read with a small stdlib XML reader (no openpyxl on this Mac); it was not copied into the repo.
- Tests: e2e 22, seat_att 51, sync 34 pass.

## 2026-11-13 — 서현덕 added (Jay)

Why: Jay pasted 서현덕's student list (반명 / 학생명 / 학교 / 담당, 103 rows) and asked to add him, push and update the Vercel deployment. Built by Claude Code.

- **서현덕 (`shd`)** in `js/teachers.js`: 10 classes, 103 roster entries (school names left out). 월 초2-G15 · 초2-G13, 화 초1-H3 · 초1-H4, 수 초1-E2-7 · 초1-G11, 목 초1-E2-10 · 초1-E1-5, 금 초2-E1-2 · 초2-G14. Slot 3 = 15:00, 6 = 18:00, all 3시간.
- **His day of each 2-day class** was worked out, not given: 이재현's entry (from the 진도표) has 초1-E1-5 on 화 and 초1-E2-7 on 금, both as A, so 서현덕 is **B on 목 and 수** (`sub:true`, log codes `초1-E1-5B`, `초1-E2-7B`). His list names him first for E2-7; the 진도표 was followed. 초1-E2-10(화목3) → 목, because 화3 is his 초1-H3; 초2-E1-2(수금3) → 금, because 수3 is his 초1-E2-7. **Jay confirmed** these days and roles (2026-11-13): B in E1-5 and E2-7; 초1-E2-10 (with 이상화) and 초2-E1-2 (with 배재인) stay without a role tag or A/B in the log code.
- **이재현's 초1-E2-7 roster** was empty ("명단 준비 중"); filled with the same 11 students. His 초1-E1-5 roster already matched the list.
- `docs/APP.md` teacher list updated. No plan, no history, no 골든벨 samples.
- Tests: e2e 22, seat_att 51, sync 34 pass; the app shows 서현덕 in the picker with his 10 classes on the right days and no page errors.

## 2026-11-13 — Firebase connected: shared storage is on (Jay)

Why: Jay asked "is firebase setup for this website?" (it was not: the adapter existed but `js/remote-config.js` was `null`), then "Yes, set it up". Built by Claude Code with the Firebase CLI; Jay signed in and did the console steps Google requires of the account owner.

- **Project:** Firebase project **FieldsTeacher**, id `fieldsteacher-9b4e9`, owned by Jay's Google account (the one signed in to the Firebase CLI on this Mac). Jay created it in the console; Firestore `(default)` in `asia-northeast3` (Seoul); Firestore and Identity Toolkit APIs enabled; web app "Fields Attendance web" registered; Anonymous sign-in on; authorized domains `localhost`, `fields-attendance.vercel.app` (plus the two Firebase defaults). Free Spark plan, no billing.
- **Leftover:** an empty Google Cloud project `fields-attendance` ("Fields Attendance") from the first attempt (Firebase could not be added to it before Jay accepted the Firebase terms). Unused; Jay can delete it (Google Cloud console → IAM & Admin → Settings → Shut down).
- **`js/remote-config.js`** now holds the project's web config (not a secret). It keeps a value set before it loads, now including `null`, so a test can force local-only.
- **`firestore.rules`** (+ `firebase.json`, `.firebaserc`), deployed: signed-in visitors may read `records/*`; writes must have exactly the record shape `js/sync.js` sends (`id`, `v` text < 200 KB, `d`, `t`, `u` = server time); deleting documents is not allowed (the app marks deletions with `d`). Not uploaded to Vercel (`.vercelignore`). Publish changes with `firebase deploy --only firestore:rules`.
- **Fix in `js/sync.js`, found by the live check:** the first phone uploads the ~2,550 seeded records "only if absent", one read per record inside transactions; all transactions ran at once and the browser refused the requests (`ERR_INSUFFICIENT_RESOURCES`). The upload still finished, but the second phone then missed a live change. Those groups now run one after another, 50 records each (`ABSENT_CHUNK`), each with its own timeout.
- **Tests:** `tests/e2e.py` and `tests/seat_att.py` set `window.FIELDS_REMOTE = null`, so they never write to the real project. e2e 22, seat_att 51, sync 34 pass. A live check against the real project (two fresh browsers on localhost) passed: the first upload drained, a tap on one browser showed on the other within seconds and back again, no console errors. It used only the date 2099-01-05 and left both marks at 미체크; the project now holds the seeded history and two cleared 2099 records.
- **Exposure, as decided before:** anyone with the site link signs in anonymously and can read and write the records. Real per-teacher access needs a real sign-in (open item).
- **Not done:** pushing to `main` (Vercel deploys from it) waits for Jay's OK. After the deploy, each teacher's phone uploads what it holds on first open; records from the artifact or the GitHub Pages address still need 백업 저장 → 백업 불러오기 → 합치기.

## 2026-11-13 — 정고은 added; published tap cycle and 전부 등원 ported; test server fixed (Jay)

Why: Jay asked to work through the to-do list (close the gap with the published app v15). Built by Claude Code.

- **정고은 (`jge`)** added to `js/teachers.js`: 10 classes, 71 roster entries from the student list Jay pasted (school names left out). Days and times were read off the published app's screens: 월 초4-②E2-2 · 초3-②E1-8, 화 초2-②E2-5 · 초1-②H5, 수 초4-②G2 · 초1-②G15, 목 유7-②H7 · 초2-②E1-7, 금 초4-②G5 · 유7-②G11.
  - Roles: 초4-②E2-2 = B and 초3-②E1-8 = A, taken from 엄지은's and 서지완's entries. 초2-②E2-5 (with 신혜정) and 초2-②E1-7 (with 오혜진) have no role tag and no A/B in the log code: **Jay to confirm who is 담임**.
  - No 진도표 plan and no attendance history (the published app has some for her). **Class ids (`jge-m3` …) follow the day+slot convention but could not be checked against the published app**, whose source is not readable from here. If its ids differ, records imported from a published-app backup will not attach to these classes; check with a real 백업 저장 file before relying on 합치기 for her.
- **Tap cycle** on the name cards is now the published one: 미체크 → 등원 → 온라인 → 지각 → 결석 → 미체크. The double-tap shortcut for 등원 is removed (Claude's call: with 등원 as the first tap it would swallow every second tap of a fast cycle).
- **전부 등원** button under the name cards while anyone is 미체크: sets only 미체크 students to 등원; 온라인 / 지각 / 결석 / 예정 stay. Not shown in 자리배치 출석 mode (brief's open decision 4 is still Jay's).
- **Tests:** `tests/serve.py` replaces `python3 -m http.server` in all three suites. The old server keeps a listen queue of 5 and sometimes reset one of the page's twelve parallel script requests; that script never ran and the test saw a blank page (about 1 load in 10). `tests/e2e.py` has three new checks (22 in all).
- **Still missing against v15:** 고연경 (her roster is needed; switching teachers in the published app needs the PIN), 수업 메모, 숙제 항목 (연산교재 / 교과병행) with tags, and the hidden tag for same-name children. These need the published app's source or a backup file so the stored shapes match.
- **Noticed, not fixed:** if one script fails to load on a bad connection the app stays blank with no message. Worth a small "다시 불러오기" fallback before the pilot.
- Git: the uncommitted work from 11-12 and 11-13 was committed on branch `seat-att-sync` (not pushed). The GitHub repo is private and Pages is not enabled.

## 2026-11-13 — Deployed on Vercel: https://fields-attendance.vercel.app (Jay)

Why: Jay asked to "integrate vercel and set up web site". Built by Claude Code.

- **`vercel.json`**: static site, no framework, no build or install command, served from the repo root. Every response carries `X-Robots-Tag: noindex, nofollow` (GitHub Pages could only do this with the meta tag and `robots.txt`), plus `nosniff` and `Referrer-Policy: no-referrer`. Vercel's default for static files is already "revalidate on every load", so a push shows up without the 10-minute Pages cache.
- **`.vercelignore`**: `tests/`, `docs/`, `*.md`, `.claude/`, backups and `.xlsx` are not uploaded. Only `index.html`, `css/`, `js/`, `robots.txt` are served.
- **`.gitignore`**: `.vercel` (the local project link).
- No app code changed. `tests/e2e.py` passes (run with `/usr/local/bin/python3`, the Python that has Playwright).
- **Deployed** with the Vercel CLI (`vercel deploy --prod`) from the working tree of branch `seat-att-sync`: project `fields-attendance`, team `fields7`, account `starpick3miles-9776` (Jay signed in himself). Production URL **https://fields-attendance.vercel.app**. Checked live: the teacher picker loads at 375 px with no console errors; `/docs`, `/tests`, `*.md` and `vercel.json` return 404; the `noindex` header is sent.
- **Updating the site:** `export PATH=/usr/local/bin:$PATH && npx vercel deploy --prod` from the repo root. It uploads the files on disk, committed or not. `.vercel/` (the project link) is git-ignored.
- **GitHub connected** (`npx vercel git connect`, after Jay added GitHub as a login connection in Vercel): `starpick3miles/fields_teacher` is linked to the project. From now on a push to `main` deploys production and a push to any other branch makes a preview deployment. Jay then asked to merge and push: `seat-att-sync` was merged into `main` on top of GitHub's two commits ("Create CNAME", "Delete CNAME", no net change) and `main` was pushed, so GitHub's `main` and the live site now hold the same code.
- **Open:** Vercel asked the account owner to turn on two-factor authentication. GitHub Pages was not touched.
- **Node on this Mac:** Homebrew's Node 25.6.1 (`/opt/homebrew/bin/node`, first on the PATH) does not start (`libllhttp.9.3.dylib` missing after llhttp went to 9.4.3). `brew upgrade node` was tried with Jay's OK and stopped: on macOS 14 it compiles the dependencies from source (hours). Homebrew's Node is unchanged and still broken. Use the working Node 22.16 in `/usr/local/bin`: `export PATH=/usr/local/bin:$PATH` before `node --check` or `npx vercel`. `node --check` passes on every `js/*.js` with it.
- **To keep in mind:**
  - A `*.vercel.app` address is a new origin. Records saved at the GitHub Pages address or in the artifact stay there; move them with 백업 저장 → 백업 불러오기 → 합치기 (same as the artifact finding above), or by turning on shared storage.
  - For Firebase, add the Vercel domain under Authentication → Settings → Authorized domains.
  - The site is as public as the Pages one: `js/teachers.js` (children's names) is served to anyone with the link. Vercel's password protection is a paid feature.

## 2026-11-13 — Shared storage: records sync per record; Firebase adapter (Jay, handoff brief Task 2)

Why: on 2026-11-12 a day of records seemed to vanish. They were in another page's browser storage (the app keeps records only where they were entered). Jay chose Firebase as the backend and "same as today" for who sees what (one academy store). Built by Claude Code.

- **`js/sync.js`** wraps the local adapter when `window.FIELDS_REMOTE` is set (`js/remote-config.js`; `null` = local only, exactly as before). localStorage stays the instant cache. After each save the store is compared with the previous one and each changed record (`attendance/<key>`, `homework/<key>`, `seating/<key>`, `settings/<teacher>`, 골든벨 sessions / questions / marks, and any other map collection) goes to an outbox and is pushed as its own document. No whole-lesson or whole-store blob is uploaded.
  - Same record on two phones: the later change wins (by change time). Different students never overwrite each other.
  - Deletes are tombstones. Offline: the outbox is kept in localStorage and retried every 5 s and when the network returns.
  - Seeded history (attendance without `at`, partner days, sample 골든벨, `seeded` flags) is pushed "only if absent", so it is stored once and never overwrites a teacher's record. A record a teacher cleared stays cleared on every device.
  - One-time import: the first run in a browser that already holds records queues all of them with their own times after a full pull; newer shared records win. The teacher sees "이 기기에 있던 기록 n건을 공유 저장소로 옮겼어요". The local copy is the cache and is never removed.
  - Not synced: `classes`, `students`, `enrollments` (rebuilt from `TEACHERS` on every load) and the per-device keys (teacher choice, language, 보는 위치, last backup).
- **Backends** in `js/sync.js`: `FirestoreRemote` (compat SDK 10.12.2 from gstatic, Anonymous sign-in, collection `records`) and `HttpRemote` (used by the tests). **The Firestore adapter has not been run against a real project yet**: Jay needs to create one and paste its config (README → Shared storage).
- **App changes:** "⚠ 저장 안 됨 · n건 대기" / "저장 중… n건" badge at the top while changes are waiting. A change from another phone reloads the records at once; an open sheet is not redrawn, so a memo being typed is kept. Wording in the home footer, 설정, restore and 초기화 now says shared storage when a backend is on. 초기화 still clears one teacher (now on every device).
- **백업 불러오기 has a new 합치기 button** (`mergeBackup` in `js/data.js`): copies only records that are missing here or newer in the file. 바꾸기 still replaces everything, and with shared storage that means on every device (the confirm says so).
- **Finding for Jay — the artifact's records cannot be imported automatically.** The published app runs on a claude.ai artifact address; this app runs on GitHub Pages. Browser storage is per address, so the automatic import only sees records made at the GitHub Pages address. For the artifact phones the path is: artifact → 백업 저장, then here → 백업 불러오기 → 합치기. Firebase cannot be used from inside the artifact page (it only allows scripts from a few CDNs).
- **Published-app data this branch has no screen for** is kept and synced, not dropped: `hwx` (연산교재 / 교과병행 homework), `lessonMemo`, homework `tags`, extra settings keys, and records of classes this branch does not have (고연경, 정고은). They are invisible here until those features and teachers are ported; the exports do not include them.
- **Tests:** new `tests/sync.py` + `tests/sync_server.py` (34 checks). The import fixture was written from the published app's source (its store shape), not exported from the published app; Jay should repeat that check with a real 백업 저장 file.
- **Known limits:** change times come from each phone's clock, so a phone with a wrong clock can win or lose a same-student conflict wrongly. Two phones can each start a 골든벨 for the same lesson (the app shows the first). A fresh phone downloads all seeded history once (several thousand documents with 정혜진's sample 골든벨).
- **Open (brief's decision 6):** this branch lacks teachers 고연경 and 정고은; shipping it in place of the published app would hide their classes.

## 2026-11-13 — 자리배치 출석: attendance taken on the seat screen (Jay, handoff brief Task 1)

Spec: Jay's handoff brief and design canvas "자리배치 출석 — 3 options", option B. Built by Claude Code.

- **Setting.** 자리배치 is now 끄기 / 켜기 / 자리배치 출석 (`seatMode()`). Stored value: `false` / `true` as before and `"att"` for the new mode, so no migration is needed and an older build reads `"att"` as on. Default stays 켜기. `seatingOn()` is true for both 켜기 and 자리배치 출석.
- **Seat screen** (`seatAttHtml` in `js/views.js`, actions `sa*` in `js/app.js`): on the teacher's own lesson days it replaces the name cards on the class page; 숙제 확인 and 골든벨 stay below and the 🪑 자리배치 button is hidden. Everyone starts unseated; seats are not prefilled from the last lesson (`seatingFor` returns an empty map in this mode), the last seat is only a dashed "지난 자리" hint.
  - chip → empty seat: seated, attendance and seating saved together. Seated tap: 등원 → 지각 → 미체크 (seat freed). Action row for an unseated student: 온라인 / 결석 / 미체크 / 취소. 마감: unseated 미체크 → 결석, everything else kept.
  - 4×3 / 3×4, 선생님 side and 보조교사 view work as in 🪑 자리배치.
- **등원 / 지각 rule** (`seatAutoStatus`, `seoulNow` in `js/model.js`): "today" is the date in Asia/Seoul whatever the phone's time zone. Today, a student seated from class start + `SEAT_LATE_GRACE_MIN` (5) is 지각, earlier 등원; past or future lessons always 등원. The status line refreshes every 15 s.
- **Decisions by Jay (2026-11-12):** moving a seated student = long-press → "자리 옮기기" in the memo sheet → tap the new seat (a taken seat swaps); status and memo are kept. Task 1 before Task 2. Shared data visibility: same as today (one academy store).
- **Claude's calls, for Jay to confirm:** a student who already has a 등원 / 지각 record but no seat (after a layout change, or added to 골든벨 without a seat) keeps that status when seated instead of being re-timed; 예정 students are timed by the clock. Students added during 골든벨 are still marked 지각 in this mode (brief's open decision 3).
- **Long-press** (all tiles): now cancelled when the finger moves more than 10 px or the page scrolls, and it only swallows its own click, so the next tap always registers. Before, a tap within 0.7 s of a long-press could be lost.
- **Fix found on the way:** 기록 요약 wrote `NaN` (a file openpyxl cannot open) for a 골든벨 that had started but had no scored question. That cell now shows "–".
- **Tests:** new `tests/seat_att.py` (51 checks: the brief's timing table with the device in America/New_York and a frozen clock, flow, 숙제 / 골든벨 / both exports, partner day, 끄기 / 켜기 unchanged, stored settings, every teacher × weekday, 360 px, English strings). `tests/e2e.py` passes unchanged. Both exports were opened with openpyxl.
- **Not done — gaps against the published app (v15), listed, not ported:** 전부 등원 button (so the brief's open decision 4 does not apply yet), 수업 메모, 숙제 항목 (연산교재 / 교과병행, `hwx`) and homework tags, teachers 고연경 and 정고은, the hidden `|` tag for same-name children, and the published tap cycle that starts at 등원 (this branch: 온라인 → 지각 → 결석 → 미체크, double tap = 등원). `load()` keeps collections it does not know (`hwx`, `lessonMemo`) when it saves.
- **Task 2 (shared storage) not started:** waiting for Jay to choose the backend (Firebase or the Claude artifact database).

## 2026-11-13 — Repo moved out of iCloud to `~/code/fields-attendance` (Jay)

- **All agents (Claude Code, Codex, Antigravity/Gemini): work in `~/code/fields-attendance` from now on. Do not edit the copy in `~/Desktop/Desktop - Jay’s MacBook Pro/fields-attendance`.** Changes made there will not reach the working copy.
- Why: the Desktop folder is synced by iCloud, which replaced every file with an online-only placeholder mid-session on 2026-11-12. Files read back empty and git reported "your current branch appears to be broken". An agent that writes to a file in that state overwrites the real content.
- What was done (Claude Code): all files were downloaded again, then copied with `rsync -a` and compared with `diff -rq`. The copy is identical, including the 7 uncommitted files, except `.git/logs/refs/remotes/origin/main` (a reflog iCloud would not release; git does not need it). No app code changed.
- The old path `~/Desktop/Desktop - Jay’s MacBook Pro/fields-attendance` is now a symlink to `~/code/fields-attendance` (Jay approved), so workspaces saved with the old path land in the working copy. The original files sit next to it as `fields-attendance (old iCloud copy, do not edit)`: a frozen snapshot Jay can delete.
- Before starting work anywhere, check `find . -flags +dataless -type f | wc -l` prints 0.

## 2026-11-12 — Mandatory HISTORY.md reading & logging rule codified (Jay)

- Explicit workflow requirement added to all agent instructions (`AGENT.md`, `AGENTS.md`, `GEMINI.md`, `CLAUDE.md`):
  1. Always read `docs/HISTORY.md` first at the start of every task to check the latest state and decisions.
  2. Always record an entry in `docs/HISTORY.md` immediately following any code changes.

## 2026-11-12 — 골든벨 ties broken by who was marked first (Jay)

- Jay: with 조우진 and 하연호 both ◎ on Q1, 하연호 should be 2nd because 조우진 got ◎ first. Before, equal points shared a rank.
- Each mark now stores `at` (first time the student was marked on that question; kept through cycling and edits, cleared with 미표시). No migration: the field is optional and old backups load as before.
- One question (`gbQRank`): equal points → earlier `at` ranks higher. Applies to every mark, not only ◎. No times or 미표시 → shared rank.
- Session total (`gbScores`): equal totals → more 1st places on single questions ranks higher, then more 2nd places, and so on; equal throughout → shared rank.
- Jay chose the session rule from four options. Claude's first version (count of same-points classmates marked earlier, summed) was accepted and then withdrawn by Jay the same day.
- Old records and seeded sample 골든벨 have no times, so their per-question rankings are unchanged. Their session rankings can change: two students with equal totals used to share a rank, and now the one with more question wins is ahead. The Excel rank columns follow the same functions.
- `tests/e2e.py` gained a tie-break check.

## 2026-11-12 — `js/app.js` split into seven files (Jay)

- Why: one 161K-character file made every small edit expensive for an AI agent to search and read. Jay asked for the split after a label change.
- `js/app.js` became `i18n.js`, `model.js`, `teachers.js`, `data.js`, `views.js`, `excel.js` and a small `app.js`, loaded by `index.html` in that order. No code was rewritten: the lines are the same, only moved (checked line for line against the old file).
- The IIFE wrapper is gone, so the app's functions and variables (`db`, `state`, `T`, `render` …) are now globals shared between the files. Rule: code that runs at load time may only use earlier files.
- Deploy note: a browser holding an old cached `index.html` with the new `js/app.js` shows a blank page until it reloads. Nothing is deployed yet, so no device is affected; keep it in mind for later file renames.
- `tests/e2e.py` passes unchanged.

## 2026-11-12 — Multi-agent support: AGENT.md, AGENTS.md, GEMINI.md added (Jay)

- Added `AGENT.md` (universal instructions for AI coding agents).
- Added `AGENTS.md` (standard instruction file for OpenAI Codex, ChatGPT, and GPT-based agents).
- Added `GEMINI.md` (standard instruction file for Google Gemini and Antigravity agents).
- Updated `README.md` to document multi-agent workflow support alongside `CLAUDE.md`.

## 2026-11-12 — Export renamed 공식 출석부; 자리배치 on by default (Jay)

- The Excel export type "수업일지" is now labelled "공식 출석부" in the export sheet (en: "Official attendance sheet"), and the file is named `…_공식출석부.xlsx`. The sheet layout and the code names (`buildLogbook`, `fmtLog`) are unchanged; docs still call the layout 수업일지.
- `defaults.seating` is `true` for every teacher (it was on only for 엄지은). A device where the teacher already chose a setting keeps it; a device that never touched the switch now shows 자리배치.

## 2026-11-12 — Repo rebuilt from the `fields_app` artifact; Claude Code handoff

- Source: artifact "fields_app" (version `1794403328-5c17`, updated 2026-11-11 22:22 KST), which supersedes "필즈 출석부" (`1794376564-ba5e`). The artifact was one HTML file (1,960 lines); it was split into `index.html`, `css/style.css` and `js/app.js`, and the GitHub Pages changes from 2026-11-11 were re-applied on top.
- New since the 2026-11-11 repo, all from the artifact:
  - 골든벨 점수 시스템 and rankings (see the 2026-11-11 scoring entry).
  - 부담임 (B) days now run 골든벨.
  - Teacher 이동근 (ldg) added: 10 classes, 2관.
  - 기록 요약 workbook rewritten; 수업일지 gained 점수 and 순위 columns.
- Added `CLAUDE.md`, `docs/`, `tests/e2e.py`, `.gitignore`.
- From now on **this repo is the source of truth**. The artifacts are frozen copies; do not edit them and expect the change here.
- Verified with `tests/e2e.py` in headless Chrome: all checks pass (save, reload, both exports, backup, rejected files, restore confirm, cross-tab reload). Both exported workbooks were opened with openpyxl. Not yet tested on a real phone or deployed.

## 2026-11-11 — Moved out of Claude artifacts to a static site (Jay)

**Problem.** In the published artifact the Excel export did nothing and data was lost on refresh.

**Findings.**
- The app already used localStorage (not `window.storage`) and already had JSON backup and restore.
- Export and backup went through Claude's `downloads` capability whenever `window.claude` existed, and that was unavailable on the published page.
- The storage wrapper swallowed errors, so a blocked or isolated localStorage in the viewer failed silently. This is the likely cause of the lost data; it was not reproduced.

**Decision (Jay).** Host on GitHub Pages as a static site, data in localStorage, one teacher on one device, no backend or Firebase for now. Keep the code structured so Firebase can be added.

**Changes.**
- `js/storage.js`: adapter with `get/set/del/onRemoteChange/ready`; `set` reports failure; requests persistent storage; `ok` flag when storage is blocked.
- `persist()` shows "저장하지 못했어요…" when a save fails; a startup warning when storage is blocked.
- `js/files.js`: plain `<a download>` for Excel and backups. All `window.claude` code removed.
- ExcelJS pinned to 4.4.0 with an SRI hash.
- `js/backup.js`: validation before restore. The restore confirm now shows date and counts and offers "지금 기록 먼저 백업". Legacy backups also ask first (they used to merge without asking).
- "마지막 백업" line in settings; the file input can pick the same file twice; another tab's changes reload the page's data.
- `robots.txt`, `noindex`, `.nojekyll`, README with deploy steps.

**Decision: keep ExcelJS, not SheetJS.** Jay first asked for SheetJS. The free SheetJS build cannot write fills, borders, dropdowns or conditional formatting, which the 수업일지 layout uses, so ExcelJS stayed (Jay agreed to go with the recommendation and review).

## 2026-11-11 — 골든벨 점수 시스템 (Jay), developed in the `fields_app` copy

- Points per question: ◎ 5, O 4, △ 3, X 2, − 1. Rankings per question and at the end. Every class except 레벨업 특강.
- "−" is read as both 미표시 and 미참가, 1 point each (to confirm with Jay).
- Scores are computed from marks, never stored. Ties share a rank.
- UI: "이번 문제" and "현재 순위" on the 골든벨 screen; "최종 순위" plus 점수 and 순위 columns on the results screen.
- Excel: 수업일지 gets 점수 and 순위; 기록 요약 rewritten (요약 sheet, per-class blocks, 코멘트 sheet, 맑은 고딕, A4 fit).
- Provisional cumulative rule in the export: 득점률 = points ÷ max over sessions played; absence is not a 0.

## 2026-11-11 — 부담임 days have 골든벨 (Jay)

The earlier "no 골든벨 on B days" rule was a mistake. `noGb(c)` is true only for 레벨업 특강; `sub:true` only drives the 부담임 tag. Both teachers' 골든벨 are needed for the S반 score.

## 2026-11-11 — 이동근 added; scaling reviewed

- 이동근 부원장 (ldg) from his student list and the 진도표. No attendance history yet.
- Scaling to about 20 teachers was measured (see `docs/APP.md` → Known limits). Recommendation given to Jay: rosters in config are fine for a pilot; stop embedding attendance history; seed only the selected teacher per device; drop sample 골든벨; move to Firebase before a full rollout. Not done yet.

## 2026-11-10 — One app for all teachers ("필즈 출석부")

- The per-teacher apps (정혜진, 엄지은) were merged into one config-driven app: teacher picker, one store `fields-attendance-v1`, class ids `<teacherId>-<id>`, students shared by roster name (`s-<name>`), per-teacher settings.
- Scope decision (Jay): data stays per device; Firebase later. The artifact's built-in shared database needs a claude.ai sign-in, which teachers do not have.
- Teachers added from 출결조회 exports and the 진도표: 서지원, 이재현 (rosters mostly pending), 서지완.
- History seeding once per (teacher, kind, class, date), with a migration for devices that ran v1.
- 6-digit PIN to switch teachers; 선생님 desk side in 자리배치; 골든벨 리셋.
- 숙제 확인 limited to students in the room, 등원 and 지각 (Jay). 연습 and 리뷰 combined into one check by default (원장 feedback); two-box mode kept as a setting.
- 보조교사 view in 자리배치 and 골든벨.
- Backup save and load, including import from the old per-teacher apps.
- 유7 classes = 2시간 in the 수업일지.

## 2026-10-23 to 2026-10-30 — Prototype (spec v1.0)

- 10-23: spec locked. Attendance and 골든벨 for one teacher, two classes a day. Locked decisions include Firebase as the eventual backend, no login, names only, seeded rosters, autosave.
- 10-26: tap and double-tap scheme; 온라인 status.
- 10-27: one 골든벨 per class per day; 문제 종료 keeps 미표시; seating layouts 4×3 and 3×4; late joiners marked 지각; 자리배치 step added.
- 10-28: 문제 종료 opens the next question.
- 10-29: Excel export; 골든벨 became a single-tap cycle ◎ → O → △ → X → 미표시 with no hint step.
- 10-30: Excel workbook redesigned; Korean-only output; 1-year cap; no future dates; class-page arrows step by lesson; partner day view only.

## Open questions and next steps

For Jay to decide:
1. **Privacy:** are public rosters acceptable for the pilot? If not, move rosters out of `js/teachers.js`.
2. **Scoring:** confirm "−" = 1 point for both 미표시 and 미참가; confirm the cumulative rule (absences, minimum participation); decide how app points map to the S반 50-point 골든벨 score.
3. **Firebase:** when shared data is needed (원장 view, 담임 + 부담임 average, more teachers). Frontend stack for a real app is still undecided in the spec (Flutter web or Next.js).
4. 초1-G6 time (반명 says 화3, 진도표 says 화4); 박라엘's start date (assumed 11/10); 이재현's missing rosters. 정고은: 담임 or 부담임 in 초2-②E2-5 and 초2-②E1-7; 고연경's roster.
5. Confirm that the same roster name always means the same child.

Engineering backlog:
- Deploy to GitHub Pages and test on the teacher's actual phone (downloads on iOS Safari and as a Home Screen app in particular).
- Reduce store size: seed only the selected teacher, drop sample 골든벨, stop embedding history.
- Cumulative score view inside the app.
- Roster update from a 출결조회 export; a per-student timeline across classes.
- Offline use: the app needs the network for the first load, the font and ExcelJS; a service worker would fix that.
