 # Edit history and decisions

Newest first. Add an entry for every change: date, what, why, who asked. "Jay" = the owner. Entries before 2026-11-11 summarize work done in Claude artifacts and come from the project docs, so they are less detailed.

## 2026-11-12 — Mandatory HISTORY.md reading & logging rule codified (Jay)

- Explicit workflow requirement added to all agent instructions (`AGENT.md`, `AGENTS.md`, `GEMINI.md`, `CLAUDE.md`):
  1. Always read `docs/HISTORY.md` first at the start of every task to check the latest state and decisions.
  2. Always record an entry in `docs/HISTORY.md` immediately following any code changes.

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
4. 초1-G6 time (반명 says 화3, 진도표 says 화4); 박라엘's start date (assumed 11/10); 이재현's missing rosters.
5. Confirm that the same roster name always means the same child.

Engineering backlog:
- Deploy to GitHub Pages and test on the teacher's actual phone (downloads on iOS Safari and as a Home Screen app in particular).
- Reduce store size: seed only the selected teacher, drop sample 골든벨, stop embedding history.
- Cumulative score view inside the app.
- Roster update from a 출결조회 export; a per-student timeline across classes.
- Offline use: the app needs the network for the first load, the font and ExcelJS; a service worker would fix that.
