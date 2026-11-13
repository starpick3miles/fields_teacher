/* ============================================================
   Shared storage — which backend the records sync to.

   null  → no backend: records stay in this browser only (the old behavior).

   Firebase (Jay's choice, 2026-11-13): project fieldsteacher-9b4e9, owned by Jay's
   Google account, Firestore in asia-northeast3 (Seoul). To change it, paste the web app config from the
   Firebase console (Project settings → Your apps → SDK setup → Config):

     window.FIELDS_REMOTE = { kind: "firestore", config: {
       apiKey: "…", authDomain: "…", projectId: "…", appId: "…"
     } };

   Setup steps and the security rules are in README.md → Shared storage.
   The config is not a secret (it only names the project); access is
   controlled by the Firestore rules.

   Tests set window.FIELDS_REMOTE before this file loads (null = local only,
   so a test never writes to the real project), so it must not overwrite a
   value that is already there.
   ============================================================ */
window.FIELDS_REMOTE = window.FIELDS_REMOTE !== undefined ? window.FIELDS_REMOTE : { kind: "firestore", config: {
  apiKey: "AIzaSyAwDRa9NnddaUTi_X40lAVPP3nwUcV0kb4",
  authDomain: "fieldsteacher-9b4e9.firebaseapp.com",
  projectId: "fieldsteacher-9b4e9",
  appId: "1:676559374570:web:fcfe27c82109b263fd2f93"
} };
