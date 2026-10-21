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
        return post(form.getAttribute("data-endpoint"), Object.assign({
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
