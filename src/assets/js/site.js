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

  // ---------- floating space dust in the background ----------
  var dust = document.getElementById("fx-dust");
  if (dust && dust.getContext) {
    var ctx = dust.getContext("2d");
    var still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    var W = 0, H = 0, motes = [];
    var tints = ["255,240,225", "255,240,225", "255,240,225", "134,227,234", "240,161,58", "176,92,242"];
    function size() {
      W = window.innerWidth; H = window.innerHeight;
      dust.width = Math.round(W * ratio); dust.height = Math.round(H * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      var want = Math.round(Math.min(110, (W * H) / 16000));
      while (motes.length < want) motes.push(newMote(true));
      motes.length = want;
    }
    function newMote(anywhere) {
      var depth = Math.random();
      return {
        x: Math.random() * W, y: anywhere ? Math.random() * H : H + 10,
        r: 0.4 + depth * 1.5, depth: depth,
        vy: -(4 + depth * 14), sway: Math.random() * 6.28, swaySpeed: 0.2 + Math.random() * 0.5,
        tw: Math.random() * 6.28, twSpeed: 0.6 + Math.random() * 1.6,
        tint: tints[Math.floor(Math.random() * tints.length)],
      };
    }
    var last = performance.now(), lastScroll = window.scrollY;
    function draw(now) {
      var dt = Math.min(0.05, (now - last) / 1000); last = now;
      var ds = window.scrollY - lastScroll; lastScroll = window.scrollY;
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < motes.length; i++) {
        var m = motes[i];
        if (!still) {
          m.y += m.vy * dt - ds * (0.05 + m.depth * 0.25);
          m.sway += m.swaySpeed * dt; m.tw += m.twSpeed * dt;
          if (m.y < -10 || m.y > H + 20) { motes[i] = newMote(m.y < -10 ? false : true); if (m.y < -10) motes[i].y = H + 10; else motes[i].y = -5; continue; }
        }
        var x = m.x + Math.sin(m.sway) * (4 + m.depth * 8);
        var a = (0.15 + m.depth * 0.45) * (0.55 + 0.45 * Math.sin(m.tw));
        ctx.fillStyle = "rgba(" + m.tint + "," + a.toFixed(3) + ")";
        ctx.beginPath(); ctx.arc(x, m.y, m.r, 0, 6.283); ctx.fill();
        if (m.r > 1.4) {
          ctx.fillStyle = "rgba(" + m.tint + "," + (a * 0.18).toFixed(3) + ")";
          ctx.beginPath(); ctx.arc(x, m.y, m.r * 3.2, 0, 6.283); ctx.fill();
        }
      }
      if (!still) requestAnimationFrame(draw);
    }
    window.addEventListener("resize", size);
    size();
    requestAnimationFrame(draw);
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
