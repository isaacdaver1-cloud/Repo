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

  // ---------- navbar: lightning, racing glow and liquid underline ----------
  (function () {
    var inner = document.querySelector(".bar__inner");
    var ink = document.getElementById("bar-ink");
    var spark = document.getElementById("bar-spark");
    var bolt = document.getElementById("bar-bolt");
    var brand = document.querySelector(".bar__brand");
    if (!inner || !ink) return;
    var links = Array.prototype.slice.call(document.querySelectorAll(".bar__links a[data-nav]"));
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var current = null;
    var busy = false;

    function visible(a) { return a && a.offsetParent !== null; }
    function rect(a) {
      var r = a.getBoundingClientRect(), o = inner.getBoundingClientRect();
      return { l: r.left - o.left, w: r.width, cx: r.left - o.left + r.width / 2, cy: r.top - o.top + r.height / 2, b: r.bottom - o.top };
    }
    function place(a) {
      if (!visible(a)) { ink.classList.remove("on"); return; }
      var r = rect(a);
      ink.style.left = r.l + "px"; ink.style.width = r.w + "px"; ink.style.top = (r.b - 2) + "px"; ink.style.height = "3px";
      ink.classList.add("on");
    }
    function setCurrent(a) {
      links.forEach(function (l) { if (l === a) l.setAttribute("aria-current", "page"); else l.removeAttribute("aria-current"); });
      current = a;
    }

    // underline flows like liquid: front edge rushes ahead, back edge catches up, then it snaps into place
    function flow(from, to, done) {
      var b = rect(to);
      var top = (b.b - 2) + "px";
      ink.style.top = top;
      if (reduce || !ink.animate) { place(to); if (done) done(); return; }
      var frames;
      if (!from || !visible(from) || !ink.classList.contains("on")) {
        ink.classList.add("on");
        frames = [
          { left: b.cx + "px", width: "0px", height: "3px" },
          { left: (b.l - 8) + "px", width: (b.w + 16) + "px", height: "5px", offset: 0.55 },
          { left: (b.l + 3) + "px", width: (b.w - 6) + "px", height: "2px", offset: 0.8 },
          { left: b.l + "px", width: b.w + "px", height: "3px" },
        ];
      } else {
        var a = rect(from), right = b.l > a.l;
        var spanL = Math.min(a.l, b.l), spanR = Math.max(a.l + a.w, b.l + b.w);
        frames = [
          { left: a.l + "px", width: a.w + "px", height: "3px" },
          right
            ? { left: (a.l + a.w * 0.3) + "px", width: (spanR - a.l - a.w * 0.3) + "px", height: "1.5px", offset: 0.38 }
            : { left: spanL + "px", width: (a.l + a.w * 0.7 - spanL) + "px", height: "1.5px", offset: 0.38 },
          { left: (b.l + (right ? -10 : 2)) + "px", width: (b.w + 8) + "px", height: "6px", offset: 0.68 },
          { left: (b.l + (right ? 3 : -3)) + "px", width: (b.w - 4) + "px", height: "2px", offset: 0.85 },
          { left: b.l + "px", width: b.w + "px", height: "3px" },
        ];
      }
      var anim = ink.animate(frames, { duration: 680, easing: "cubic-bezier(0.5, 0, 0.2, 1)" });
      anim.onfinish = function () { place(to); if (done) done(); };
    }

    function jagged(x0, x1, y) {
      var d = "M" + x0.toFixed(1) + " " + y.toFixed(1);
      var dir = x1 > x0 ? 1 : -1, x = x0, len = Math.abs(x1 - x0);
      var steps = Math.max(4, Math.round(len / 16));
      for (var i = 1; i <= steps; i++) {
        x = x0 + dir * (len * i) / steps;
        var jy = i === steps ? 0 : (Math.random() - 0.5) * 12;
        d += " L" + x.toFixed(1) + " " + (y + jy).toFixed(1);
      }
      // a couple of short side branches
      for (var k = 0; k < 2; k++) {
        var bx = x0 + dir * len * (0.25 + Math.random() * 0.5), by = y + (Math.random() - 0.5) * 6;
        d += " M" + bx.toFixed(1) + " " + by.toFixed(1) + " l" + (dir * (8 + Math.random() * 14)).toFixed(1) + " " + ((Math.random() < 0.5 ? -1 : 1) * (8 + Math.random() * 10)).toFixed(1);
      }
      return d;
    }

    function strike(fromEl, to) {
      if (reduce || !bolt || !spark || !spark.animate) return;
      var b = rect(to), a = fromEl && visible(fromEl) ? rect(fromEl) : rect(brand);
      var y = b.cy - 17; // just above the link text
      var paths = bolt.querySelectorAll("path");
      function crackle() { var d = jagged(a.cx, b.cx, y); paths[0].setAttribute("d", d); paths[1].setAttribute("d", d); }
      crackle();
      setTimeout(crackle, 90);
      setTimeout(crackle, 190);
      bolt.animate([
        { opacity: 0 }, { opacity: 1, offset: 0.08 }, { opacity: 0.2, offset: 0.22 }, { opacity: 1, offset: 0.34 },
        { opacity: 0.5, offset: 0.5 }, { opacity: 0.9, offset: 0.6 }, { opacity: 0 },
      ], { duration: 420, easing: "linear" });
      var barEl = document.getElementById("bar");
      if (barEl) { barEl.classList.remove("flash"); void barEl.offsetWidth; barEl.classList.add("flash"); }
      spark.animate([
        { transform: "translate(" + a.cx + "px," + (b.b - 1) + "px) scale(0.6)", opacity: 0 },
        { transform: "translate(" + a.cx + "px," + (b.b - 1) + "px) scale(1.2)", opacity: 1, offset: 0.12 },
        { transform: "translate(" + b.cx + "px," + (b.b - 1) + "px) scale(1)", opacity: 1, offset: 0.7 },
        { transform: "translate(" + b.cx + "px," + (b.b - 1) + "px) scale(2.2)", opacity: 0 },
      ], { duration: 560, easing: "cubic-bezier(0.6, 0, 0.2, 1)" });
    }

    // which link is current: the page itself, or the section in view on the home page
    var path = location.pathname.replace(/\/index\.html$/, "/");
    var pageLink = links.filter(function (l) { return l.pathname === path && !l.hash; })[0] || null;
    if (pageLink) { setCurrent(pageLink); place(pageLink); }

    var onHome = !!document.getElementById("decks");
    if (onHome && "IntersectionObserver" in window) {
      var sections = links.filter(function (l) { return l.hash && document.getElementById(l.hash.slice(1)); });
      var io = new IntersectionObserver(function () {
        if (busy) return;
        var mid = window.innerHeight * 0.4, best = null;
        sections.forEach(function (l) {
          var s = document.getElementById(l.hash.slice(1)).getBoundingClientRect();
          if (s.top <= mid && s.bottom > mid) best = l;
        });
        if (best !== current) {
          var prev = current;
          setCurrent(best);
          if (best) flow(prev, best); else ink.classList.remove("on");
        }
      }, { threshold: [0, 0.25, 0.5, 0.75, 1], rootMargin: "-30% 0px -50% 0px" });
      sections.forEach(function (l) { io.observe(document.getElementById(l.hash.slice(1))); });
    }

    window.addEventListener("resize", function () { if (current) place(current); });

    links.forEach(function (link) {
      link.addEventListener("click", function (e) {
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        var from = current;
        busy = true;
        strike(from, link);
        setTimeout(function () { flow(from, link); setCurrent(link); }, reduce ? 0 : 120);
        var samePage = link.pathname === location.pathname && link.hash;
        setTimeout(function () {
          if (samePage) {
            var target = document.getElementById(link.hash.slice(1));
            if (target) {
              var y = target.getBoundingClientRect().top + window.scrollY - 70;
              window.scrollTo({ top: y, behavior: reduce ? "auto" : "smooth" });
              history.replaceState(null, "", link.hash);
            }
            setTimeout(function () { busy = false; }, 900);
          } else {
            document.documentElement.classList.add("leaving");
            setTimeout(function () { location.href = link.href; }, 200);
          }
        }, reduce ? 0 : 640);
      });
    });
  })();

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

  // ---------- press-and-pulse links: squeeze, glow, then go ----------
  document.querySelectorAll("a[data-pulse]").forEach(function (link) {
    link.addEventListener("click", function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduce) return;
      e.preventDefault();
      var href = link.href;
      link.classList.remove("is-pressing");
      void link.offsetWidth; // restart the animation if clicked twice
      link.classList.add("is-pressing");
      setTimeout(function () { document.documentElement.classList.add("leaving"); }, 380);
      setTimeout(function () { window.location.href = href; }, 600);
    });
  });
  // coming back with the browser's back button: undo the fade-out
  window.addEventListener("pageshow", function () { document.documentElement.classList.remove("leaving"); });

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
