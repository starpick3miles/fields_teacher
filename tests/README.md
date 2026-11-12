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

Downloads land in `tests/out/` (git-ignored). The test picks 정혜진 and the lesson on 2026-11-09, so it depends on that teacher's config in `js/teachers.js`.
