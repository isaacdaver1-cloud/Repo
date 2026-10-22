// Contact form: checks the fields, then sends the message to the team's inbox through
// FormSubmit (formsubmit.co), so visitors don't need their own email app or account.
// Copy the team's email address to the clipboard
(function () {
  var b = document.getElementById("copy-email");
  if (!b) return;
  b.addEventListener("click", function () {
    var email = b.getAttribute("data-email");
    var done = function () { b.textContent = "Copied"; setTimeout(function () { b.textContent = "Copy email address"; }, 2000); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(email).then(done, function () { b.textContent = email; });
    else b.textContent = email;
  });
})();

// "Out of order" sign: the words drawn small, then shaded with an ordered (Bayer) dither and
// scaled up with hard pixels, with the odd neon flicker.
(function () {
  "use strict";
  var c = document.getElementById("ooo-sign");
  if (!c || !c.getContext) return;
  var W = 300, H = 64;
  c.width = W; c.height = H;
  var g = c.getContext("2d");
  var bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  var mask = document.createElement("canvas"); mask.width = W; mask.height = H;
  var m = mask.getContext("2d", { willReadFrequently: true });
  var src = null;
  function drawMask() {
    m.clearRect(0, 0, W, H);
    m.fillStyle = "#fff";
    m.textAlign = "center"; m.textBaseline = "middle";
    m.font = "900 50px 'Big Shoulders', Impact, sans-serif";
    m.fillText("OUT OF ORDER", W / 2, H / 2 + 2, W - 8);
    src = m.getImageData(0, 0, W, H).data; // the letters never change, so read them once
  }
  var still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function render(t) {
    var out = g.createImageData(W, H), d = out.data;
    var flick = still ? 1 : (Math.random() < 0.04 ? 0.35 : 1);
    for (var y = 0; y < H; y++) {
      for (var x = 0; x < W; x++) {
        var i = (y * W + x) * 4;
        var cover = src[i + 3] / 255;
        if (cover < 0.5) continue;
        // brightness: brighter in the middle rows, with a slow moving band like a failing tube
        var v = 1 - Math.abs(y - H / 2) / (H / 2) * 0.75;
        v *= 0.75 + 0.25 * Math.sin(x * 0.04 + t * 0.002);
        v *= flick;
        var threshold = (bayer[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
        if (v > threshold) { d[i] = 242; d[i + 1] = 200; d[i + 2] = 31; }
        else { d[i] = 150; d[i + 1] = 40; d[i + 2] = 20; }
        d[i + 3] = 255;
      }
    }
    g.putImageData(out, 0, 0);
  }
  function loop(t) { render(t); if (!still) setTimeout(function () { requestAnimationFrame(loop); }, 90); }
  var start = function () { drawMask(); requestAnimationFrame(loop); };
  if (document.fonts && document.fonts.ready) document.fonts.load("900 50px 'Big Shoulders'").then(start, start);
  else start();
})();

(function () {
  "use strict";
  var form = document.getElementById("contact-form");
  if (!form) return;
  var done = document.getElementById("contact-done");
  var status = document.getElementById("c-status");
  var send = document.getElementById("c-send");
  var email = document.getElementById("c-email");
  var name = document.getElementById("c-name");
  var msg = document.getElementById("c-message");
  var count = document.getElementById("c-message-count");
  var honey = document.getElementById("c-honey");
  var hint = document.getElementById("reason-hint");
  var reasons = form.querySelectorAll('input[name="reason"]');

  var hints = {
    report: "Include the player's in-game name, roughly when it happened, which room you were in, and what happened.",
    bug: "Include your headset model, what you were doing, what you expected and what happened instead.",
    appeal: "Include your in-game name and why you think the decision was wrong.",
    deletion: "Include your in-game name and Meta username so we can find your account. Parents can ask for their child.",
    account: "Include your in-game name, the item or purchase, and roughly when you bought it.",
    copyright: "Include the work you own, links to where it is copied, and a statement that you own it or act for the owner.",
  };

  function chosen() { for (var i = 0; i < reasons.length; i++) if (reasons[i].checked) return reasons[i]; return null; }
  function showHint() {
    var r = chosen(), text = r && hints[r.getAttribute("data-key")];
    hint.hidden = !text;
    hint.textContent = text || "";
    document.getElementById("reason-error").hidden = true;
  }
  reasons.forEach(function (r) { r.addEventListener("change", showHint); });

  // pre-select a reason from the link that brought them here, e.g. contact.html?reason=report
  var want = new URLSearchParams(location.search).get("reason");
  if (want) reasons.forEach(function (r) { if (r.getAttribute("data-key") === want) r.checked = true; });
  showHint();

  function updateCount() { count.textContent = msg.value.length + " / 3000"; }
  msg.addEventListener("input", function () { updateCount(); if (msg.value.trim().length >= 15) err(msg, false); });
  email.addEventListener("input", function () { if (email.validity.valid) err(email, false); });
  updateCount();

  function err(input, on) {
    var box = document.getElementById(input.id + "-error");
    if (box) box.hidden = !on;
    if (on) input.setAttribute("aria-invalid", "true"); else input.removeAttribute("aria-invalid");
  }

  function validate() {
    var first = null;
    if (!chosen()) { document.getElementById("reason-error").hidden = false; first = first || reasons[0]; }
    var okEmail = email.value.trim() === "" || email.validity.valid; // optional, but must look right if given
    err(email, !okEmail); if (!okEmail) first = first || email;
    var okMsg = msg.value.trim().length >= 15;
    err(msg, !okMsg); if (!okMsg) first = first || msg;
    if (first) first.focus();
    return !first;
  }

  function post(url, body) {
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 20000);
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      signal: ctrl ? ctrl.signal : undefined,
    })
      .then(function (res) {
        clearTimeout(timer);
        return res.json().catch(function () { return {}; }).then(function (data) {
          var ok = res.ok && (data.success === true || String(data.success) === "true");
          if (!ok) throw new Error((data && data.message) || "HTTP " + res.status);
          return data;
        });
      }, function (e) { clearTimeout(timer); throw e; });
  }

  // FormSubmit delivers the email but its reply can be blocked by the browser, which made
  // working sends look like failures. Send it as a plain form post that doesn't need to read
  // the reply: if the request leaves the browser, the message is on its way.
  function sendFormSubmit(url, body) {
    var params = new URLSearchParams();
    Object.keys(body).forEach(function (k) { params.append(k, body[k]); });
    return fetch(url, { method: "POST", mode: "no-cors", body: params });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    status.textContent = "";
    if (!validate()) return;
    if (honey.value) { finish(); return; } // a bot filled the trap: pretend it worked

    var reason = chosen().value;
    var who = name.value.trim();
    var mail = email.value.trim();
    var subject = "[Echo] " + reason + (who ? " from " + who : "");
    var details = {
      reason: reason,
      in_game_name: who || "(not given)",
      email: mail || "(not given)",
      message: msg.value.trim(),
      page: location.href,
    };

    send.disabled = true;
    send.textContent = "Sending...";

    // 1st choice: Web3Forms (when a key is set in site.config.json), 2nd: FormSubmit
    var key = form.getAttribute("data-key");
    var first = key
      ? post("https://api.web3forms.com/submit", Object.assign({
          access_key: key,
          subject: subject,
          from_name: "Echo website",
        }, mail ? { replyto: mail } : {}, details))
      : Promise.reject(new Error("no key"));

    first
      .catch(function () {
        return sendFormSubmit(form.getAttribute("data-endpoint"), Object.assign({
          _subject: subject,
          _captcha: "false",
        }, mail ? { _replyto: mail } : {}, details));
      })
      .then(finish)
      .catch(function (err) { fail(err && err.message); });
  });

  // came back from the fallback route
  if (new URLSearchParams(location.search).get("sent") === "1") {
    form.hidden = true; done.hidden = false;
  }

  function finish() {
    if (window.echoSound) window.echoSound.play("charge");
    form.hidden = true;
    done.hidden = false;
    done.focus();
  }
  function fail(detail) {
    send.disabled = false;
    send.textContent = "Send message";
    status.textContent = "Your message didn't send. Try again in a minute, or join our Discord and open a ticket." + (detail ? " (" + detail + ")" : "");
  }

  document.getElementById("c-again").addEventListener("click", function () {
    form.reset();
    updateCount(); showHint();
    send.disabled = false; send.textContent = "Send message";
    done.hidden = true; form.hidden = false;
    email.focus();
  });
})();
