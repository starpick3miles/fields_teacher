/* ============================================================
   Shared storage — which backend the records sync to.

   null  → no backend: records stay in this browser only (the old behavior).

   Firebase (Jay's choice, 2026-11-13). Paste the web app config from the
   Firebase console (Project settings → Your apps → SDK setup → Config):

     window.FIELDS_REMOTE = { kind: "firestore", config: {
       apiKey: "…", authDomain: "…", projectId: "…", appId: "…"
     } };

   Setup steps and the security rules are in README.md → Shared storage.
   The config is not a secret (it only names the project); access is
   controlled by the Firestore rules.

   Tests set window.FIELDS_REMOTE before this file loads, so it must not
   overwrite a value that is already there.
   ============================================================ */
window.FIELDS_REMOTE = window.FIELDS_REMOTE || null;
