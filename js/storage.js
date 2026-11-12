/* ============================================================
   Storage layer — the only place the app touches persistence.

   app.js talks to window.FieldsStorage and nothing else:
     get(key)               → string | null
     set(key, value)        → true if saved, false if the browser refused
                              (private mode, storage blocked, quota full)
     del(key)
     onRemoteChange(key, cb) → cb() when the value changed somewhere else
     ready()                → Promise, resolved once get() returns current data

   Today: LocalAdapter (one teacher, one device, localStorage).
   Later, for data shared across devices or teachers, add e.g. a
   FirebaseAdapter with the same methods:
     - keep localStorage as the synchronous cache, so get() stays instant
       and the app works offline;
     - set() writes the cache, then pushes to Firestore in the background;
     - a Firestore onSnapshot listener updates the cache and calls the
       onRemoteChange callbacks, so app.js reloads and re-renders;
     - ready() resolves after the first snapshot arrives.
   Then change the last line of this file to pick that adapter. app.js does
   not need to change.
   ============================================================ */
(function () {
  "use strict";

  function LocalAdapter() {
    this.ok = probe();
    // Ask the browser not to evict this site's data under storage pressure.
    // Chrome/Edge/Firefox may grant it; Safari ignores it. A cleared browser
    // history still erases everything, which is why backups exist.
    try {
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
    } catch (e) {}
  }

  function probe() {
    try {
      var k = "__fields_probe__";
      localStorage.setItem(k, "1");
      localStorage.removeItem(k);
      return true;
    } catch (e) {
      return false;
    }
  }

  LocalAdapter.prototype.get = function (k) {
    try { return localStorage.getItem(k); } catch (e) { return null; }
  };
  LocalAdapter.prototype.set = function (k, v) {
    try { localStorage.setItem(k, v); return true; } catch (e) { return false; }
  };
  LocalAdapter.prototype.del = function (k) {
    try { localStorage.removeItem(k); } catch (e) {}
  };
  // Locally the only "somewhere else" is another tab of the same site:
  // the storage event fires there, never in the tab that wrote.
  LocalAdapter.prototype.onRemoteChange = function (k, cb) {
    window.addEventListener("storage", function (ev) {
      if (ev.key === k || ev.key === null) cb();
    });
  };
  LocalAdapter.prototype.ready = function () { return Promise.resolve(); };

  window.FieldsStorage = new LocalAdapter();
})();
