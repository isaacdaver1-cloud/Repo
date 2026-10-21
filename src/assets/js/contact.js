// Contact form: checks the fields, then sends the message to the team's inbox through
// FormSubmit (formsubmit.co), so visitors don't need their own email app or account.
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
    var okEmail = email.value.trim() !== "" && email.validity.valid;
    err(email, !okEmail); if (!okEmail) first = first || email;
    var okMsg = msg.value.trim().length >= 15;
    err(msg, !okMsg); if (!okMsg) first = first || msg;
    if (first) first.focus();
    return !first;
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    status.textContent = "";
    if (!validate()) return;
    if (honey.value) { finish(); return; } // a bot filled the trap: pretend it worked

    var reason = chosen().value;
    var payload = {
      _subject: "[Echo] " + reason + (name.value.trim() ? " from " + name.value.trim() : ""),
      _template: "table",
      _captcha: "false",
      _replyto: email.value.trim(),
      Reason: reason,
      Email: email.value.trim(),
      "In-game name": name.value.trim() || "(not given)",
      Description: msg.value.trim(),
      Page: location.href,
    };

    send.disabled = true;
    send.textContent = "Sending...";
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 20000);

    fetch(form.getAttribute("data-endpoint"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
      signal: ctrl ? ctrl.signal : undefined,
    })
      .then(function (res) { return res.json().catch(function () { return {}; }).then(function (data) { return { ok: res.ok, data: data }; }); })
      .then(function (r) {
        clearTimeout(timer);
        if (r.ok && String(r.data.success) === "true") finish();
        else fail(r.data && r.data.message);
      })
      .catch(function () { clearTimeout(timer); fail(); });
  });

  function finish() {
    if (window.echoSound) window.echoSound.play("charge");
    form.hidden = true;
    done.hidden = false;
    done.focus();
  }
  function fail(detail) {
    send.disabled = false;
    send.textContent = "Send message";
    status.textContent = "Your message didn't send. Check your internet connection and try again." + (detail ? " (" + detail + ")" : "");
  }

  document.getElementById("c-again").addEventListener("click", function () {
    form.reset();
    updateCount(); showHint();
    send.disabled = false; send.textContent = "Send message";
    done.hidden = true; form.hidden = false;
    email.focus();
  });
})();
