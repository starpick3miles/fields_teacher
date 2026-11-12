/* ============================================================
   Backup file validation (pure: no DOM, no storage).

   FieldsBackup.parse(text, appId) checks a picked JSON file before anything
   on the device is touched, and returns either
     { ok:true, kind:"full",   db, savedAt, counts }   this app's own backup
     { ok:true, kind:"legacy", db, legacy,  counts }   an old per-teacher app
     { ok:false, reason }                               anything else
   The caller still asks the teacher to confirm before replacing records.
   ============================================================ */
(function () {
  "use strict";

  var MAX_BYTES = 25 * 1024 * 1024;
  var DATE = /^\d{4}-\d{2}-\d{2}$/;
  var STATUSES = { present: 1, online: 1, late: 1, absent: 1, none: 1 };
  var OBJECTS = ["attendance", "partnerAtt", "homework", "gbSessions", "gbQuestions", "gbMarks", "seating", "settings", "seeded"];
  var ARRAYS = ["classes", "students", "enrollments"];

  function isObj(x) { return x !== null && typeof x === "object" && !Array.isArray(x); }

  function checkDb(db) {
    if (!isObj(db)) return "no db";
    if (!isObj(db.gbSessions)) return "gbSessions missing";
    var i, k, keys;
    for (i = 0; i < OBJECTS.length; i++) if (OBJECTS[i] in db && !isObj(db[OBJECTS[i]])) return OBJECTS[i] + " is not an object";
    for (i = 0; i < ARRAYS.length; i++) if (ARRAYS[i] in db && !Array.isArray(db[ARRAYS[i]])) return ARRAYS[i] + " is not a list";

    keys = Object.keys(db.attendance || {});
    for (i = 0; i < keys.length; i++) {
      k = keys[i];
      var a = db.attendance[k];
      if (!DATE.test(k.split("_")[0])) return "attendance key " + k;
      if (!isObj(a) || !STATUSES[a.status]) return "attendance value " + k;
    }
    keys = Object.keys(db.partnerAtt || {});
    for (i = 0; i < keys.length; i++) if (!STATUSES[db.partnerAtt[keys[i]]]) return "partnerAtt value " + keys[i];
    keys = Object.keys(db.homework || {});
    for (i = 0; i < keys.length; i++) if (!isObj(db.homework[keys[i]])) return "homework value " + keys[i];
    keys = Object.keys(db.gbSessions);
    for (i = 0; i < keys.length; i++) {
      var s = db.gbSessions[keys[i]];
      if (!isObj(s) || typeof s.classId !== "string" || !DATE.test(s.date) || !Array.isArray(s.playerIds)) return "gbSession " + keys[i];
    }
    keys = Object.keys(db.gbMarks || {});
    for (i = 0; i < keys.length; i++) if (!isObj(db.gbMarks[keys[i]])) return "gbMark " + keys[i];
    return null;
  }

  function counts(db) {
    var n = function (o) { return o ? Object.keys(o).length : 0; };
    return { attendance: n(db.attendance), homework: n(db.homework), gb: n(db.gbSessions) };
  }

  function parse(text, appId) {
    if (typeof text !== "string" || !text.length) return { ok: false, reason: "empty file" };
    if (text.length > MAX_BYTES) return { ok: false, reason: "file too large" };
    var x;
    try { x = JSON.parse(text); } catch (e) { return { ok: false, reason: "not JSON" }; }
    if (!isObj(x)) return { ok: false, reason: "not an object" };

    var why;
    if (x.app === appId) {
      if (typeof x.version === "number" && x.version > 1) return { ok: false, reason: "made by a newer version of the app" };
      why = checkDb(x.db);
      if (why) return { ok: false, reason: why };
      var when = typeof x.savedAt === "string" && !isNaN(Date.parse(x.savedAt)) ? x.savedAt : "";
      return { ok: true, kind: "full", db: x.db, savedAt: when, counts: counts(x.db) };
    }
    if (typeof x.legacy === "string") {
      why = checkDb(x.db);
      if (why) return { ok: false, reason: why };
      return { ok: true, kind: "legacy", db: x.db, legacy: x.legacy, counts: counts(x.db) };
    }
    return { ok: false, reason: "not a 필즈 출석부 backup" };
  }

  window.FieldsBackup = { parse: parse };
})();
