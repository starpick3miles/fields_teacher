/* ============================================================
   Shared storage (Task 2, Jay 2026-11-12/13) — wraps the local adapter from
   storage.js so the same records show on every phone, browser and link.

   Nothing here runs unless window.FIELDS_REMOTE is set (js/remote-config.js).

   How it works
   - localStorage stays the synchronous cache: get()/set() are instant and the
     app works offline. The app still saves its whole store as one JSON string.
   - After each save the store is compared with the previous one, record by
     record. A record is one entry of a map collection, e.g.
     "attendance/2026-11-16_jhj-m3_s-김규원" or "settings/jhj". Changed records
     go into an outbox (kept in localStorage) and are pushed to the backend.
     The store is never uploaded as one blob, so two phones on one lesson only
     ever overwrite each other on the same student's record.
   - Same record changed on two phones: the later change wins (by the time of
     the change, `t`). A queued offline change that is older than what the
     backend already has is dropped.
   - Changes from other devices are pulled, written into the cache, and the
     onRemoteChange callbacks fire so the app reloads and redraws.
   - Deleting a record leaves a tombstone ({d:true}) so other devices delete it.
   - Seeded history (rosters' attendance copied from the sheets, sample 골든벨,
     partner days, the `seeded` flags) is pushed "only if absent" with t = 0:
     it never overwrites what a teacher entered.
   - One-time import: the first time a browser that already holds records runs
     this, every local record is queued with its own time (`at`). The first
     pull is a full one, so anything newer in shared storage wins. The local
     copy is the cache and is never removed.

   Backend interface (FirestoreRemote, HttpRemote):
     pull(cursor) → Promise<{changes:[{id,v,d,t}], cursor}>   changes after cursor
     push(list)   → Promise     list of {id, v (JSON text | null), d, t, ifAbsent}
     watch(cb)    → calls cb() when something may have changed remotely
   ============================================================ */
(function () {
  "use strict";
  var local = window.FieldsStorage, cfg = window.FIELDS_REMOTE || null;
  if (!cfg || !cfg.kind) return;   // no backend configured → local only

  var KEY = "fields-attendance-v1";
  var OUT_KEY = "fields-sync-outbox", CUR_KEY = "fields-sync-cursor", IMP_KEY = "fields-sync-imported",
      DIRTY_KEY = "fields-sync-dirty", LAST_KEY = "fields-sync-last";
  var SKIP = { classes: 1, students: 1, enrollments: 1 };   // rebuilt from TEACHERS on every load
  var DEBOUNCE_MS = 150, RETRY_MS = 5000, CHUNK = 400, ABSENT_CHUNK = 50, PUSH_TIMEOUT_MS = 15000;

  function parse(s) { try { return s ? JSON.parse(s) : null; } catch (e) { return null; } }
  function isObj(x) { return x !== null && typeof x === "object" && !Array.isArray(x); }

  /* ---------- records: the store as a flat map  id → JSON text ---------- */
  function flatten(o) {
    var out = {};
    if (!isObj(o)) return out;
    Object.keys(o).forEach(function (col) {
      var m = o[col];
      if (SKIP[col] || !isObj(m)) return;
      if (col === "hwx") {   // per-book homework from the published app: hwx[type][key]
        Object.keys(m).forEach(function (ty) { if (isObj(m[ty])) Object.keys(m[ty]).forEach(function (k) { out["hwx:" + ty + "/" + k] = JSON.stringify(m[ty][k]); }); });
        return;
      }
      Object.keys(m).forEach(function (k) { out[col + "/" + k] = JSON.stringify(m[k]); });
    });
    return out;
  }
  function where(o, id, make) {   // → [map, key] for a record id
    var i = id.indexOf("/"), col = id.slice(0, i), key = id.slice(i + 1), m;
    if (col.indexOf("hwx:") === 0) {
      var ty = col.slice(4);
      if (!isObj(o.hwx)) { if (!make) return null; o.hwx = {}; }
      if (!isObj(o.hwx[ty])) { if (!make) return null; o.hwx[ty] = {}; }
      m = o.hwx[ty];
    } else {
      if (!isObj(o[col])) { if (!make) return null; o[col] = {}; }
      m = o[col];
    }
    return [m, key];
  }
  // Seeded history: shipped in the page (TEACHERS), written by mergeTeacher. Teacher-entered attendance always has `at`.
  function isSeed(id, v, o) {
    var i = id.indexOf("/"), col = id.slice(0, i), key = id.slice(i + 1);
    if (col === "seeded" || col === "partnerAtt") return true;
    if (col === "attendance") return !(v && v.at);
    if (col === "gbSessions") return !!(v && v.sample);
    if (col === "gbQuestions" || col === "gbMarks") { var s = o && o.gbSessions && o.gbSessions[key.split("_")[0]]; return !!(s && s.sample); }
    return false;
  }
  function ownTime(v) { var n = function (x) { return typeof x === "number" && x > 1 ? x : 0; }; return isObj(v) ? (n(v.at) || n(v.endedAt) || n(v.startedAt)) : 0; }

  /* ---------- state ---------- */
  var prev = flatten(parse(local.get(KEY)));        // the store as of the last diff
  var outbox = parse(local.get(OUT_KEY)) || {};     // id → {v | d, t, imp}
  var cursor = parse(local.get(CUR_KEY));           // backend position of the last pull
  var remoteT = {};                                 // id → t of the newest remote version seen this session
  var listeners = {}, statusCbs = [], importCbs = [];
  var busy = false, again = false, failed = false, timer = null, diffTimer = null, impCount = 0, firstPull = null, firstDone = null;
  var readyP = new Promise(function (res) { firstDone = res; });

  function saveOutbox() { local.set(OUT_KEY, JSON.stringify(outbox)); }
  function pending() { return Object.keys(outbox).length; }
  function status() { var n = pending(); return { shared: true, pending: n, state: !n ? "ok" : (failed || navigator.onLine === false) ? "failed" : "saving" }; }
  function emit() { var s = status(); statusCbs.forEach(function (cb) { try { cb(s); } catch (e) {} }); }

  /* ---------- local changes → outbox ---------- */
  function diffNow() {
    clearTimeout(diffTimer); diffTimer = null;
    var obj = parse(local.get(KEY)); if (!obj) return;
    var flat = flatten(obj), now = Date.now(), n = 0;
    Object.keys(flat).forEach(function (id) {
      if (prev[id] === flat[id]) return;
      var added = !(id in prev);
      // a seeded record that appears (first load, new history in the config) is offered "only if absent"; any other change is the teacher's
      outbox[id] = { v: flat[id], t: (added && isSeed(id, parse(flat[id]), obj)) ? 0 : now }; n++;
    });
    Object.keys(prev).forEach(function (id) { if (!(id in flat)) { outbox[id] = { d: 1, t: now }; n++; } });
    prev = flat; local.del(DIRTY_KEY);
    if (n) { saveOutbox(); emit(); kick(0); }
  }
  // Queue local records as they stand. all = the one-time import; otherwise only records newer than `since` (recovery after
  // a page that closed before its last change was compared).
  function enqueueLocal(all, since) {
    var obj = parse(local.get(KEY)); if (!obj) return;
    var flat = flatten(obj), n = 0;
    Object.keys(flat).forEach(function (id) {
      if (outbox[id]) return;
      var v = parse(flat[id]), seed = isSeed(id, v, obj), t = seed ? 0 : ownTime(v);
      if (!all && !(t > since)) return;
      outbox[id] = { v: flat[id], t: t, imp: (all && !seed) ? 1 : 0 }; n++;
    });
    if (n) saveOutbox();
  }

  /* ---------- remote changes → cache ---------- */
  function applyRemote(changes) {
    if (diffTimer) diffNow();   // compare the app's latest save first, so `prev` is the cache
    var sets = [], touched = false;
    changes.forEach(function (c) {
      var t = c.t || 0, pend = outbox[c.id];
      if (!(remoteT[c.id] > t)) remoteT[c.id] = t;
      if (pend) { if (pend.t > t) return; delete outbox[c.id]; touched = true; }   // ours is newer → it will be pushed; else theirs wins
      if (c.d) { if (c.id in prev) sets.push(c); } else if (prev[c.id] !== c.v) sets.push(c);
    });
    if (touched) saveOutbox();
    if (!sets.length) return;
    var obj = parse(local.get(KEY)) || {};
    if (!isObj(obj.gbSessions)) obj.gbSessions = {};   // load() only accepts a store that has gbSessions
    sets.forEach(function (c) {
      var w = where(obj, c.id, !c.d);
      if (c.d) { if (w) delete w[0][w[1]]; delete prev[c.id]; }
      else { w[0][w[1]] = parse(c.v); prev[c.id] = c.v; }
    });
    local.set(KEY, JSON.stringify(obj));
    (listeners[KEY] || []).forEach(function (cb) { try { cb(); } catch (e) {} });
  }

  /* ---------- pull, then push ---------- */
  function flush() {
    var list = [];
    Object.keys(outbox).forEach(function (id) {
      var it = outbox[id];
      if (it.t === 0 && remoteT[id] !== undefined) { delete outbox[id]; return; }   // seeded, and shared storage already has this record
      if (remoteT[id] > it.t) { delete outbox[id]; return; }                        // a later change is already there
      list.push({ id: id, v: it.d ? null : it.v, d: !!it.d, t: it.t, ifAbsent: it.t === 0 });
    });
    if (!list.length) { saveOutbox(); importDone(); return Promise.resolve(); }
    return remote.push(list).then(function () {
      list.forEach(function (x) {
        var it = outbox[x.id];
        if (it && it.t === x.t && (it.d ? null : it.v) === x.v) { if (it.imp) impCount++; delete outbox[x.id]; }   // unchanged since it was sent
        if (!(remoteT[x.id] > x.t)) remoteT[x.id] = x.t;
      });
      saveOutbox(); local.set(LAST_KEY, String(Date.now())); importDone();
    });
  }
  function importDone() {
    if (local.get(IMP_KEY)) return;
    if (Object.keys(outbox).some(function (id) { return outbox[id].imp !== undefined; })) return;   // import items still waiting
    local.set(IMP_KEY, String(Date.now()));
    if (impCount) importCbs.forEach(function (cb) { try { cb(impCount); } catch (e) {} });
  }
  function kick(ms) { clearTimeout(timer); timer = setTimeout(sync, ms == null ? 0 : ms); }
  function sync() {
    if (busy) { again = true; return; }
    if (navigator.onLine === false) { failed = true; emit(); firstDone(); kick(RETRY_MS); return; }
    busy = true; emit();
    remote.pull(cursor).then(function (res) {
      applyRemote(res.changes || []);
      if (res.cursor != null && JSON.stringify(res.cursor) !== JSON.stringify(cursor)) { cursor = res.cursor; local.set(CUR_KEY, JSON.stringify(cursor)); }
      return flush();
    }).then(function () {
      busy = false; failed = false; emit(); firstDone();
      if (again || pending()) { again = false; kick(pending() ? 300 : 0); }
    }, function (e) {
      busy = false; failed = true; again = false; emit(); firstDone(); kick(RETRY_MS);
      if (window.console) console.warn("shared storage: sync failed, will retry", e && (e.message || e));
    });
  }

  /* ---------- backends ---------- */
  function withTimeout(p, ms) { return new Promise(function (res, rej) { var t = setTimeout(function () { rej(new Error("timeout")); }, ms); p.then(function (x) { clearTimeout(t); res(x); }, function (e) { clearTimeout(t); rej(e); }); }); }

  // Plain HTTP backend: used by tests/sync.py (tests/sync_server.py) and usable for a backend of the academy's own.
  function HttpRemote(c) {
    this.pull = function (cur) { return fetch(c.url + "/changes?since=" + (cur || 0), { cache: "no-store" }).then(function (r) { if (!r.ok) throw new Error("pull " + r.status); return r.json(); }); };
    this.push = function (list) { return fetch(c.url + "/push", { method: "POST", headers: { "content-type": "text/plain" }, body: JSON.stringify(list) }).then(function (r) { if (!r.ok) throw new Error("push " + r.status); }); };
    this.watch = function (cb) { setInterval(cb, c.pollMs || 4000); };
  }

  // Firestore: one document per record in collection `records`:
  //   {id, v: JSON text ("" when deleted), d: deleted, t: client time of the change, u: server time}
  // The SDK is loaded from Google's CDN only when this backend is configured. Needs Anonymous sign-in to be enabled and rules
  // that require request.auth (README → Shared storage).
  var FB_VER = "10.12.2", FB_BASE = "https://www.gstatic.com/firebasejs/" + FB_VER + "/";
  function loadScript(src) { return new Promise(function (res, rej) { var s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = function () { rej(new Error("load " + src)); }; document.head.appendChild(s); }); }
  function FirestoreRemote(c) {
    var col = null, fs = null, OVERLAP_MS = 10000;
    var init = null;
    function start() {
      if (!init) init = loadScript(FB_BASE + "firebase-app-compat.js")
        .then(function () { return Promise.all([loadScript(FB_BASE + "firebase-auth-compat.js"), loadScript(FB_BASE + "firebase-firestore-compat.js")]); })
        .then(function () { var app = window.firebase.initializeApp(c.config); fs = window.firebase.firestore; return app.auth().signInAnonymously().then(function () { col = app.firestore().collection(c.collection || "records"); }); });
      init.catch(function () { init = null; });   // a failed load (offline at startup) is retried on the next sync
      return init;
    }
    function ref(id) { return col.doc(encodeURIComponent(id)); }
    function doc(x) { return { id: x.id, v: x.d ? "" : x.v, d: !!x.d, t: x.t, u: fs.FieldValue.serverTimestamp() }; }
    this.pull = function (cur) {
      return start().then(function () {
        var q = col.orderBy("u");
        // overlap: a write committed a moment before the cursor may become visible after it; re-reading is harmless
        if (cur) q = q.where("u", ">", fs.Timestamp.fromMillis(Math.max(0, cur.ms - OVERLAP_MS)));
        return q.get({ source: "server" });
      }).then(function (snap) {
        var out = [], max = cur ? cur.ms : 0;
        snap.forEach(function (d) { var x = d.data(); out.push({ id: x.id, v: x.v, d: !!x.d, t: x.t || 0 }); if (x.u && x.u.toMillis() > max) max = x.u.toMillis(); });
        return { changes: out, cursor: max ? { ms: max } : cur };
      });
    };
    this.push = function (list) {
      return start().then(function () {
        var plain = list.filter(function (x) { return !x.ifAbsent; }), absent = list.filter(function (x) { return x.ifAbsent; }), jobs = [], i;
        for (i = 0; i < plain.length; i += CHUNK) (function (part) {
          var b = col.firestore.batch(); part.forEach(function (x) { b.set(ref(x.id), doc(x)); }); jobs.push(b.commit());
        })(plain.slice(i, i + CHUNK));
        // offline, the SDK would wait forever; the outbox retries instead
        return withTimeout(Promise.all(jobs), PUSH_TIMEOUT_MS).then(function () {
          // Create only where no document exists yet. A transaction reads each document with its own request, so the groups go
          // one after another: the first phone uploads ~2,500 seeded records, and all at once the browser refused them
          // (ERR_INSUFFICIENT_RESOURCES, live check 2026-11-13). Records of a finished group stay uploaded if a later one fails.
          var chain = Promise.resolve();
          for (i = 0; i < absent.length; i += ABSENT_CHUNK) (function (part) {
            chain = chain.then(function () {
              return withTimeout(col.firestore.runTransaction(function (tx) {
                return Promise.all(part.map(function (x) { return tx.get(ref(x.id)); })).then(function (snaps) { snaps.forEach(function (s, k) { if (!s.exists) tx.set(ref(part[k].id), doc(part[k])); }); });
              }), PUSH_TIMEOUT_MS);
            });
          })(absent.slice(i, i + ABSENT_CHUNK));
          return chain;
        });
      });
    };
    this.watch = function (cb) {
      start().then(function () {
        col.where("u", ">", fs.Timestamp.now()).onSnapshot(function (snap) { if (!snap.metadata.hasPendingWrites && snap.docChanges().length) cb(); }, function () {});
      }, function () {});
    };
  }
  var remote = cfg.kind === "firestore" ? new FirestoreRemote(cfg) : cfg.kind === "http" ? new HttpRemote(cfg) : null;
  if (!remote) { if (window.console) console.warn("shared storage: unknown backend", cfg.kind); return; }

  /* ---------- the adapter the app sees (same methods as LocalAdapter) ---------- */
  window.FieldsStorage = {
    ok: local.ok, shared: true,
    get: function (k) { return local.get(k); },
    set: function (k, v) {
      var ok = local.set(k, v);
      if (ok && k === KEY) { local.set(DIRTY_KEY, "1"); clearTimeout(diffTimer); diffTimer = setTimeout(diffNow, DEBOUNCE_MS); }
      return ok;
    },
    del: function (k) { local.del(k); },
    onRemoteChange: function (k, cb) { (listeners[k] = listeners[k] || []).push(cb); local.onRemoteChange(k, function () { prev = flatten(parse(local.get(KEY))); outbox = parse(local.get(OUT_KEY)) || {}; cb(); emit(); }); },
    ready: function () { return readyP; },
    status: status,
    onStatus: function (cb) { statusCbs.push(cb); },
    onImported: function (cb) { importCbs.push(cb); },
    syncNow: function () { if (diffTimer) diffNow(); kick(0); }
  };

  /* ---------- start ---------- */
  if (!local.get(IMP_KEY)) { cursor = null; enqueueLocal(true); }                              // one-time import: full pull, then upload what is newer
  else if (local.get(DIRTY_KEY)) enqueueLocal(false, (+local.get(LAST_KEY) || 0) - 60000);    // the last page closed before comparing its final save
  local.del(DIRTY_KEY);
  window.addEventListener("online", function () { kick(0); });
  window.addEventListener("offline", function () { emit(); });
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden") { if (diffTimer) diffNow(); } else kick(0); });
  window.addEventListener("pagehide", function () { if (diffTimer) diffNow(); });
  remote.watch(function () { kick(0); });
  kick(0);
})();
