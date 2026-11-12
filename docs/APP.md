# App behavior and design

The current state of the app, condensed from the prototype spec and the later decisions. When this file and the code disagree, the code is what teachers are using; fix the file.

## Screens

```
[pick teacher] → [S1 class list] → [S2 class: 출석 + 숙제 확인] → [S2b 자리배치] (optional, per-teacher setting)
                                          └→ [S3 골든벨] → [S4 결과]
S1 also has 엑셀 내보내기 and ⚙ 설정 (settings, backup, switch teacher, reset).
```

`state.view` is one of `pick`, `home`, `class`, `seat`, `gb`, `results`. Bottom sheets and confirms live in `state.sheet` and `state.confirm`.

### Teacher picker and settings
- First open: "선생님을 골라 주세요". The choice is remembered per device (`fields-teacher`).
- Switching later needs the 6-digit PIN (hash only, checked in the browser).
- Per-teacher settings in `db.settings[teacherId]`, defaults in `TEACHERS[].defaults`: 자리배치 on/off; 숙제 확인 방식 "한 번에 확인" (`one`) or "연습 · 리뷰 따로" (`two`). Changing them never deletes records.
- "이 선생님 기록 초기화" wipes only the current teacher's records and re-seeds her.

### S1 class list
- Date navigator (today by default). Shows only the current teacher's classes scheduled that day, by start time, each with an attendance badge (시작 전 / n명 남음 / 출석 완료).
- No classes that day → "이 날은 수업이 없어요" and a button to the next class day.

### S2 attendance
- Tap cycles 미체크 → 온라인 → 지각 → 결석 → 미체크 (from 등원, a tap goes to 지각). Double tap (within ~320 ms) sets 등원. Long-press (~450 ms) opens a sheet with all states and a note.
- The date arrows step between this class's lessons (own days and partner days), not calendar days.
- **Partner teacher's day** is view only, with a banner; its records are stored apart (`db.partnerAtt`).
- **Expected attendance** (`TEACHERS[].expected`): attendance received before class is shown as the default until the teacher changes or confirms it. It is never written on its own; a teacher record always wins.
- Past dates are editable with a banner; future dates show a banner.
- Class with an empty roster shows "명단 준비 중".

### 숙제 확인
- Only students in the room (등원 or 지각) get a card. Others are left out of the list, the counts, "모두 했어요" and the exports; their stored records are kept and return if the status changes back.
- One-check mode stores `{h}`; two-box mode stores `{p, r}` (연습, 리뷰; done = both). Records read sensibly in either mode. Each record can carry a note; there are quick-entry phrases.

### S2b 자리배치
- 12 seats, layout 4×3 or 3×4, drawn from the teacher's view (front row at the bottom). Switching layout clears seats after a confirm.
- Only 등원 and 지각 students get seats. A new date prefills from the class's most recent seating.
- Tap a student, then a seat; tapping a taken seat swaps. The 선생님 desk sits far left or far right (`teacher: "L"|"R"`).
- "보는 위치" (per device, `fields-seat-view`): 선생님 (앞) or 보조교사 (뒤). The 보조교사 view only changes the drawing (order reversed, left/right swapped); seat indices and saved data are the same.

### S3 골든벨
- One per class per day. Players = 등원 + 온라인 + 지각 at start. Not available for 레벨업 특강 (`noGb(c)`).
- Each tap cycles 미표시 → ◎ → O → △ → X → 미표시. No hint step and no double tap. Long-press edits the mark and a comment (also on closed questions; sets `overridden`).
- "문제 종료" closes the question and opens the next. Unmarked students stay 미표시.
- "골든벨 종료" drops an empty current question, otherwise confirms first.
- "참가자 추가" adds a late student: attendance becomes 지각, optional seat, earlier questions show "–".
- "골든벨 리셋" deletes that class's 골든벨 for that date and starts again at Q1.
- With seating on, tiles are laid out by the seat snapshot taken at session start.
- Under the grid: "이번 문제" ranking and "현재 순위 (Qn까지)".

### S4 results
- "최종 순위" list, then a students × questions matrix with 점수 and 순위 columns. Tap a cell for detail; tap a name to list that student's comments. Footer: correct before hint, (◎ + O) / players.

## 골든벨 scoring

- `GB_PTS = {◎:5, O:4, △:3, X:2}`; 미표시 and 미참가 (–) = 1. Session score = sum over questions; max = 5 × questions.
- A question counts once it is closed or the session has ended. On the open question only students already marked count.
- Ranking is standard competition ranking (ties share: 1, 1, 3); ties list in 가나다 order.
- Nothing is stored. Scores are computed from `gbMarks` each time, so editing a mark re-scores the session.

## Data model

One object `db`, saved as one JSON string under `fields-attendance-v1`:

```
classes[]      {id:"<teacherId>-<rawId>", rawId, teacherId, name, days[], partnerDays[], partner, time, levelup, sub, role, start, end, log, plan, rosterPending}
students[]     {id:"s-<roster name>", name}
enrollments[]  {id, studentId, classId, start, end}        active on d when start <= d < end (or no end)
attendance     {"date_classId_studentId": {status: present|online|late|absent|none, note, at}}
partnerAtt     {"date_classId_studentId": status}          the co-teacher's day, view only
homework       {"date_classId_studentId": {h} or {p, r}, plus note, at}
seating        {"date_classId": {seats:{"0".."11": studentId}, layout:"4x3"|"3x4", teacher:"L"|"R", at}}
gbSessions     {id: {id, classId, date, status: active|ended, playerIds[], joinedAt{sid:q}, seats, layout, teacher, questionCount, currentQ, startedAt, endedAt}}
gbQuestions    {"sessionId_q": {phase: first|closed}}
gbMarks        {"sessionId_q_studentId": {mark: ◎|O|△|X|null, phase, comment, overridden}}
settings       {teacherId: {seating, hw}}
seeded         {"<tid>|<kind>|<classId>|<date>": true}      history seeded once
```

Other keys: `fields-teacher`, `academy-locale`, `fields-seat-view`, `fields-last-backup`.

The shape mirrors the Firestore model in the prototype spec (flat collections, deterministic ids), so a move to Firebase is a mapping, not a redesign.

## TEACHERS config

One entry per teacher in `js/teachers.js`. Adding a teacher is adding an entry; no other code changes.

- `id` (short, no `_`), `name`, `legacyKey` (optional), `defaults {seating, hw}`, `sampleGb`.
- `classes[]`: `id`, `name`, `days` (0 = Sunday), `time`, `roster[]`, and optionally `partnerDays`, `partner`, `role` ("A" 담임 / "B" 부담임, a tag only), `sub` (her B day; only drives the 부담임 tag), `levelup`, `start`, `end`, `log {code, slot, hours}` (수업일지 header), `plan[]` (weekly 진도표 text, matched to `planWeeks`).
- `extraEnroll[]`: a student who joins later or moves.
- `realAtt` / `partnerAtt`: history as one letter per student in roster order: P 등원, L 지각, A 결석, E 조퇴 (등원 with the note "조퇴"), `-` none.
- `expected`: `{date: {classId: {name: status, "*": rest}}}`.
- Every 유7 class is 2시간 in the 수업일지.

Current teachers: 정혜진 (jhj), 엄지은 (eje), 서지원 (sjw), 이재현 (ljh; most rosters still empty), 서지완 (sjn), 이동근 (ldg).

## Excel export

Built in the browser with ExcelJS 4.4.0, loaded from jsDelivr only when 내보내기 is pressed, verified with a Subresource Integrity hash. The file is always Korean. Range limit 366 days; future lessons are never included.

- **수업일지** (`buildLogbook`): one sheet per lesson in the academy's own layout. Header (날짜, 시각, 반명, 시수, 목표 진도, 과제, 안내 사항), then 연번 · 이름 · 상담기록 1–4주차 · 출석 · 과제 · 질문 · 특이사항 · 골든벨 Q columns · 점수 · 순위. Filled from the app; the week's plan comes from the 진도표 text (`logPlan`). Dropdowns and conditional colors are kept so the teacher can continue in Excel. Below: 수업 기록 (when each part was recorded) and the seating grid.
- **기록 요약** (`buildWorkbook`): a 요약 sheet (one row per class), one sheet per class (출석 → 숙제 → 골든벨 점수 → 회차별 순위 → 표시 → 자리배치, sharing date columns), and a 코멘트 sheet.
  - Provisional cumulative rule: 득점률 = points ÷ max over the sessions the student played; an absence is not a 0. Jay has not confirmed it.
- Downloads go through `FieldsFiles.saveBlob` (a plain `<a download>`).

## Storage, backup and restore

- `js/storage.js` exposes `get`, `set` (returns false on failure), `del`, `onRemoteChange`, `ready`, and `ok` (false when the browser blocks storage). It also asks for persistent storage.
- `js/app.js` reloads `db` and re-renders when `onRemoteChange` fires. Today that is another tab; a Firebase adapter would call it from a snapshot listener.
- ⚙ 설정 → 백업 저장 downloads `{app:"fields-attendance", version:1, savedAt, db}` and records the time; the sheet shows "마지막 백업" or "아직 백업을 저장한 적이 없어요".
- 백업 불러오기: `FieldsBackup.parse` validates the file (JSON, app id, version, collection shapes, attendance statuses, session fields, size). Then an in-page confirm shows the backup's date and counts, with "지금 기록 먼저 백업". Nothing changes before the teacher confirms.
- Backups from the old single-teacher apps (`{legacy:"<storage key>", db}`) are merged into the matching teacher after the same confirm; the old app's records win for the same lesson.

### Firebase later
Write an adapter in `js/storage.js` with the same methods: keep localStorage as the synchronous cache, push writes to Firestore in the background, and call the `onRemoteChange` callbacks from `onSnapshot`. The one-JSON-string store will not scale to shared data; plan to split it into the collections above (per-record documents with deterministic ids), which is what the spec's data model already describes. Needs Anonymous Auth or better and rules that deny unauthenticated access, because the data is minors' names.

## Known limits and risks

- **Privacy:** rosters and seeded history are in the page source (see CLAUDE.md).
- **No shared data:** each device holds its own records; there is no 원장 view; the 담임 + 부담임 average for the S반 score is impossible per device.
- **Store size:** the whole store is re-serialized on every tap. About 268K characters with 6 teachers (122K of it 정혜진's sample 골든벨), growing roughly 70K a week for 10 classes; localStorage allows about 5M. Expect trouble within about a year, sooner on slow phones.
- **Data loss:** clearing site data, private browsing, or switching browser or device loses the records. Safari can evict a site's storage after 7 days without a visit unless the app is on the Home Screen. Backups are the only protection.
- **Shared origin:** all `<username>.github.io` project sites share localStorage.
