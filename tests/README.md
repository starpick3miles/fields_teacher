# Tests

`e2e.py` drives the real page in headless Chromium and checks saving, reload, both Excel exports, backup, restore and the cross-tab reload.

```bash
pip install playwright
playwright install chromium        # or set CHROME_PATH=/path/to/chrome to use an installed Chrome
python3 tests/e2e.py               # from the repo root; exits 1 if a check fails
```

The Excel checks load ExcelJS from jsDelivr. To run offline, save the pinned build as `tests/vendor/exceljs.min.js` (the page's integrity hash still verifies it):

```bash
mkdir -p tests/vendor
curl -sL https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js -o tests/vendor/exceljs.min.js
```

`seat_att.py` is the acceptance test for 자리배치 출석: it freezes the clock, sets the device time zone to America/New_York and checks the 등원 / 지각 rule against Seoul time, then the flow, 숙제, 골든벨, both exports, the partner day and the 360 px layout.

```bash
python3 tests/seat_att.py
```

`sync.py` is the acceptance test for shared storage. It starts `sync_server.py`, a small in-memory stand-in for the backend, and drives several browser contexts (each one is a separate phone with empty storage): two browsers on one lesson, cleared site data, the one-time import of an old store, offline queueing, 초기화, backup and 합치기. It tests the sync layer in `js/sync.js`, not Firestore itself.

```bash
python3 tests/sync.py
```

Downloads land in `tests/out/` (git-ignored). The test picks 정혜진 and the lesson on 2026-11-09, so it depends on that teacher's config in `js/teachers.js`.
