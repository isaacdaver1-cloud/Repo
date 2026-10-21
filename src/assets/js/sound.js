// Sci-fi interface sounds and the rocket engine, all synthesised with the Web Audio API.
// Browsers only allow sound after the visitor clicks, taps or presses a key, so audio
// starts on the first interaction (unless they turned it off) or from the sound button.
(function () {
  "use strict";

  var KEY = "echo-sound";
  var pref = null;
  try { pref = window.localStorage.getItem(KEY); } catch (e) { /* storage blocked */ }
  var wanted = pref !== "off";       // visitor hasn't muted
  var ctx = null, master = null, noise = null, enabled = false;
  var engine = null, lastThrust = 0;
  var button = null, label = null;

  function save(v) { try { window.localStorage.setItem(KEY, v); } catch (e) { /* ignore */ } }

  function build() {
    if (ctx) return true;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 4;
    master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(comp); comp.connect(ctx.destination);
    // 2 seconds of white noise to reuse everywhere
    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    var d = noise.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }

  function setUI() {
    if (!button) return;
    button.setAttribute("aria-pressed", enabled ? "true" : "false");
    label.textContent = enabled ? "Sound on" : "Sound off";
  }

  function enable() {
    if (!build()) return;
    if (ctx.state === "suspended") ctx.resume();
    enabled = true; setUI();
  }
  function disable() {
    enabled = false; setUI();
    if (ctx) ctx.suspend();
  }

  // ---------- building blocks ----------
  function env(g, t, a, peak, dcy) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dcy);
  }
  function tone(type, f0, f1, dur, peak, when, dest) {
    var t = ctx.currentTime + (when || 0);
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    env(g, t, 0.005, peak, dur);
    o.connect(g); g.connect(dest || master);
    o.start(t); o.stop(t + dur + 0.05);
  }
  function hiss(type, f0, f1, q, dur, peak, when) {
    var t = ctx.currentTime + (when || 0);
    var s = ctx.createBufferSource(); s.buffer = noise;
    var f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    var g = ctx.createGain();
    env(g, t, Math.min(0.03, dur / 3), peak, dur);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }

  // ---------- interface sounds ----------
  var sounds = {
    // short holographic blip
    blip: function () {
      tone("triangle", 1400, 700, 0.08, 0.22);
      tone("sine", 2800, 2200, 0.05, 0.06, 0.01);
    },
    // rising charge-up for the glowing outline button
    charge: function () {
      tone("sawtooth", 220, 1400, 0.28, 0.08);
      tone("sine", 440, 1760, 0.3, 0.16);
      tone("sine", 1760, 2640, 0.22, 0.12, 0.26);
      hiss("bandpass", 800, 5000, 4, 0.3, 0.06);
    },
    // electric zap with crackle for the navbar lightning
    zap: function () {
      tone("sawtooth", 2200, 90, 0.22, 0.12);
      tone("square", 900, 60, 0.12, 0.05, 0.02);
      for (var i = 0; i < 5; i++) hiss("highpass", 3000 + Math.random() * 3000, 2000, 1, 0.03, 0.18, i * 0.045 + Math.random() * 0.02);
      tone("sine", 660, 990, 0.12, 0.1, 0.5);
    },
    // shimmer and whoosh as a photo opens
    open: function () {
      hiss("bandpass", 400, 4000, 1.2, 0.45, 0.22);
      [880, 1320, 1760, 2640].forEach(function (f, i) { tone("sine", f, f * 1.01, 0.6, 0.05, 0.08 + i * 0.04); });
      tone("sine", 120, 60, 0.3, 0.2);
    },
    close: function () {
      tone("triangle", 900, 300, 0.12, 0.18);
      hiss("bandpass", 3000, 600, 1.5, 0.18, 0.08);
    },
    tick: function () {
      tone("square", 1800, 1500, 0.03, 0.06);
      tone("sine", 900, 1200, 0.07, 0.1, 0.02);
    },
    // rocket ignition thump
    ignite: function () {
      tone("sine", 90, 28, 0.9, 0.7);
      hiss("lowpass", 3000, 200, 0.7, 1.2, 0.5);
    },
  };

  function play(name) {
    if (!enabled || !ctx || !sounds[name]) return;
    try { sounds[name](); } catch (e) { /* never break the page over a sound */ }
  }

  // ---------- rocket engine (continuous, driven by the launch scroll) ----------
  function loopNoise() { var s = ctx.createBufferSource(); s.buffer = noise; s.loop = true; s.start(0, Math.random() * 2); return s; }
  function makeEngine() {
    var out = ctx.createGain(); out.gain.value = 0; out.connect(master);
    // deep roar: noise -> lowpass (opens with thrust)
    var roarF = ctx.createBiquadFilter(); roarF.type = "lowpass"; roarF.frequency.value = 200; roarF.Q.value = 0.8;
    var roarG = ctx.createGain(); roarG.gain.value = 0;
    loopNoise().connect(roarF); roarF.connect(roarG); roarG.connect(out);
    // sub rumble
    var rumble = ctx.createOscillator(); rumble.type = "sawtooth"; rumble.frequency.value = 42;
    var rumbleF = ctx.createBiquadFilter(); rumbleF.type = "lowpass"; rumbleF.frequency.value = 110;
    var rumbleG = ctx.createGain(); rumbleG.gain.value = 0;
    rumble.connect(rumbleF); rumbleF.connect(rumbleG); rumbleG.connect(out); rumble.start();
    // crackle on top
    var crackF = ctx.createBiquadFilter(); crackF.type = "highpass"; crackF.frequency.value = 1800;
    var crackG = ctx.createGain(); crackG.gain.value = 0;
    loopNoise().connect(crackF); crackF.connect(crackG); crackG.connect(out);
    // cold venting hiss before ignition
    var ventF = ctx.createBiquadFilter(); ventF.type = "bandpass"; ventF.frequency.value = 5200; ventF.Q.value = 0.9;
    var ventG = ctx.createGain(); ventG.gain.value = 0;
    loopNoise().connect(ventF); ventF.connect(ventG); ventG.connect(out);
    // wind as the clouds roll in
    var windF = ctx.createBiquadFilter(); windF.type = "bandpass"; windF.frequency.value = 500; windF.Q.value = 0.6;
    var windG = ctx.createGain(); windG.gain.value = 0;
    loopNoise().connect(windF); windF.connect(windG); windG.connect(out);
    return { out: out, roarF: roarF, roarG: roarG, rumble: rumble, rumbleG: rumbleG, crackG: crackG, ventG: ventG, windF: windF, windG: windG };
  }

  // state: { thrust 0..1, height (rocket y), bank 0..1 (clouds), visible bool }
  function updateEngine(s) {
    if (!enabled || !ctx) return;
    if (!engine) engine = makeEngine();
    var t = ctx.currentTime, k = 0.08;
    if (s.thrust > 0.06 && lastThrust <= 0.06) play("ignite");
    lastThrust = s.thrust;
    var near = Math.max(0.12, 1 - Math.max(0, s.height - 0.2) / 26); // fades as the rocket climbs away
    var on = s.visible ? 1 : 0;
    engine.out.gain.setTargetAtTime(on, t, 0.15);
    engine.roarG.gain.setTargetAtTime(s.thrust * near * 0.9, t, k);
    engine.roarF.frequency.setTargetAtTime(180 + 2200 * s.thrust * near, t, k);
    engine.rumbleG.gain.setTargetAtTime(s.thrust * near * 0.5, t, k);
    engine.rumble.frequency.setTargetAtTime(38 + 10 * s.thrust - 8 * (1 - near), t, 0.3); // slight drop in pitch as it leaves
    engine.crackG.gain.setTargetAtTime(s.thrust * near * (0.04 + Math.random() * 0.12), t, 0.02);
    engine.ventG.gain.setTargetAtTime(s.thrust < 0.05 ? 0.08 : 0, t, 0.2);
    engine.windG.gain.setTargetAtTime(s.bank * 0.35, t, 0.2);
    engine.windF.frequency.setTargetAtTime(350 + 500 * s.bank, t, 0.3);
  }

  // ---------- wiring ----------
  function unlockOnce(e) {
    if (e && e.target && e.target.closest && e.target.closest("#sound-toggle")) return; // the button handles itself
    if (wanted && !enabled) enable();
    window.removeEventListener("pointerdown", unlockOnce, true);
    window.removeEventListener("keydown", unlockOnce, true);
  }
  window.addEventListener("pointerdown", unlockOnce, true);
  window.addEventListener("keydown", unlockOnce, true);

  document.addEventListener("visibilitychange", function () {
    if (!ctx) return;
    if (document.hidden) ctx.suspend(); else if (enabled) ctx.resume();
  });

  document.addEventListener("DOMContentLoaded", function () {
    button = document.getElementById("sound-toggle");
    label = button && button.querySelector(".sound__label");
    if (button) {
      setUI();
      button.addEventListener("click", function (e) {
        e.stopPropagation();
        if (enabled) { disable(); wanted = false; save("off"); }
        else { wanted = true; save("on"); enable(); play("blip"); }
      });
    }

    // pick a sound for whatever was clicked
    document.addEventListener("click", function (e) {
      var el = e.target.closest && e.target.closest("a, button, summary");
      if (!el || el === button) return;
      if (el.matches(".bar__links a, .bar__brand")) play("zap");
      else if (el.matches("[data-pulse]")) play("charge");
      else if (el.matches(".viewport")) play("open");
      else if (el.matches(".lightbox__close")) play("close");
      else if (el.matches("summary")) play("tick");
      else if (el.matches(".btn, button")) play("blip");
      else play("tick");
    }, true);

    var box = document.getElementById("lightbox");
    if (box) box.addEventListener("cancel", function () { play("close"); });
  });

  window.echoSound = { play: play, engine: updateEngine };
})();
