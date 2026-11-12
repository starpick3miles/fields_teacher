/* File helpers: download a Blob, read a picked file as text. */
(function () {
  "use strict";

  // A normal browser download via <a download>. Works on GitHub Pages
  // (and any real site); it is what the Claude artifact viewer blocked.
  function saveBlob(filename, blob) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Revoke later: Safari starts the download asynchronously.
    setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
    return Promise.resolve();
  }

  function readText(file) {
    return new Promise(function (res, rej) {
      var rd = new FileReader();
      rd.onload = function () { res(String(rd.result)); };
      rd.onerror = function () { rej(rd.error || new Error("read")); };
      rd.readAsText(file);
    });
  }

  window.FieldsFiles = { saveBlob: saveBlob, readText: readText };
})();
