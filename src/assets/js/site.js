// Shared behaviour for every page: content protection, top bar, screenshot viewer.
(function () {
  "use strict";

  // ---------- content protection ----------
  // Blocks the usual shortcuts for developer tools, view-source and save-page,
  // plus right-click and image dragging.
  function blocked(e) {
    var k = (e.key || "").toLowerCase();
    var mod = e.ctrlKey || e.metaKey;
    if (k === "f12") return true;
    if (mod && e.shiftKey && (k === "i" || k === "j" || k === "c" || k === "k" || k === "e" || k === "m")) return true;
    if (e.metaKey && e.altKey && (k === "i" || k === "j" || k === "c" || k === "u")) return true;
    if (mod && !e.shiftKey && (k === "u" || k === "s")) return true;
    return false;
  }
  window.addEventListener("keydown", function (e) {
    if (blocked(e)) { e.preventDefault(); e.stopPropagation(); }
  }, true);
  document.addEventListener("contextmenu", function (e) { e.preventDefault(); });
  document.addEventListener("dragstart", function (e) {
    if (e.target && e.target.tagName === "IMG") e.preventDefault();
  });

  try {
    console.log("%cStop.", "font-size:42px;font-weight:900;color:#e8642a");
    console.log("%cThis site and everything in Echo are protected by copyright. Copying or reusing its code, art or assets without permission is not allowed.", "font-size:14px;color:#f6ebe6");
  } catch (e) { /* no console */ }

  // ---------- top bar ----------
  var bar = document.getElementById("bar");
  function onScroll() {
    if (!bar) return;
    bar.classList.toggle("bar--solid", window.scrollY > 40 || !document.getElementById("launch"));
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // ---------- skip intro ----------
  var skip = document.getElementById("skip-intro");
  var launch = document.getElementById("launch");
  if (skip && launch) {
    skip.addEventListener("click", function (e) {
      e.preventDefault();
      var main = document.getElementById("main");
      var top = launch.offsetTop + launch.offsetHeight;
      window.scrollTo({ top: top, behavior: "auto" });
      if (main) main.focus({ preventScroll: true });
    });
  }

  // ---------- screenshot viewer ----------
  var box = document.getElementById("lightbox");
  if (box && typeof box.showModal === "function") {
    var img = document.getElementById("lightbox-img");
    var cap = document.getElementById("lightbox-cap");
    var lastBtn = null;
    document.querySelectorAll(".viewport[data-full]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        lastBtn = btn;
        var thumb = btn.querySelector("img");
        img.src = btn.getAttribute("data-full");
        img.alt = thumb ? thumb.alt : "";
        cap.textContent = btn.getAttribute("data-caption") || "";
        box.showModal();
      });
    });
    document.getElementById("lightbox-close").addEventListener("click", function () { box.close(); });
    box.addEventListener("click", function (e) { if (e.target === box) box.close(); });
    box.addEventListener("close", function () { if (lastBtn) lastBtn.focus(); });
  }
})();
