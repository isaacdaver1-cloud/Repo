// Record player: built-in synthwave tracks generated live in the browser (no audio files),
// plus any of your own tracks listed in site.config.json -> "musicTracks".
// Bars above the record react to the music's volume and beat.
(function () {
  "use strict";

  var root = document.getElementById("player");
  if (!root) return;
  var canvas = document.getElementById("player-bars");
  var titleEl = document.getElementById("player-title");
  var playBtn = document.getElementById("player-play");
  var prevBtn = document.getElementById("player-prev");
  var nextBtn = document.getElementById("player-next");
  var muteBtn = document.getElementById("player-mute");
  var volEl = document.getElementById("player-vol");

  // ---------- state ----------
  var store = {
    get: function (k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* ignore */ } },
    sget: function (k) { try { return window.sessionStorage.getItem(k); } catch (e) { return null; } },
    sset: function (k, v) { try { window.sessionStorage.setItem(k, v); } catch (e) { /* ignore */ } },
  };
  var volume = Number(store.get("echo-music-vol"));
  if (!(volume >= 0 && volume <= 100) || store.get("echo-music-vol") === null) volume = 70;
  var muted = store.get("echo-music-muted") === "1";
  volEl.value = String(volume);

  var A = null;            // { ctx, out, noise } from sound.js
  var musicGain = null, analyser = null;
  var playing = false, index = Number(store.sget("echo-music-track")) || 0;
  var current = null;      // the running track (synth or file)

  // ---------- music theory helpers ----------
  var hz = function (midi) { return 440 * Math.pow(2, (midi - 69) / 12); };

  // ---------- instruments (scheduled at exact times) ----------
  function voice(dest, type, freq, t, dur, peak, attack, cutoff, q) {
    var ctx = A.ctx;
    var o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    f.type = "lowpass"; f.frequency.setValueAtTime(cutoff || 2000, t); f.Q.value = q || 0.7;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + (attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f); f.connect(g); g.connect(dest);
    o.start(t); o.stop(t + dur + 0.05);
    return { osc: o, filter: f };
  }
  function kick(dest, t, peak) {
    var ctx = A.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(peak, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.45);
  }
  function noiseHit(dest, t, type, freq, q, dur, peak) {
    var ctx = A.ctx, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = A.noise; f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(peak, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest);
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.02);
  }
  function snare(dest, t, peak) {
    noiseHit(dest, t, "bandpass", 1900, 0.8, 0.18, peak);
    voice(dest, "triangle", 190, t, 0.1, peak * 0.5, 0.002, 1200);
  }
  function hat(dest, t, peak, open) { noiseHit(dest, t, "highpass", 7500, 0.7, open ? 0.22 : 0.05, peak); }
  function pad(dest, notes, t, dur, peak, cutoff) {
    notes.forEach(function (n) {
      [-7, 7].forEach(function (cents) {
        var v = voice(dest, "sawtooth", hz(n), t, dur, peak, dur * 0.35, cutoff, 0.5);
        v.osc.detune.value = cents;
      });
    });
  }

  // ---------- built-in tracks ----------
  // chords are MIDI notes, one chord per bar; patterns are 16 steps per bar
  var builtIn = [
    {
      title: "Nebula Drift", bpm: 92, swing: 0,
      chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]],          // Am F C G
      kick: [0, 8], snare: [], hat: [2, 6, 10, 14], openHat: [],
      bass: [0, 3, 8, 11], arp: true, arpOct: 24, arpEvery: 2, padCut: 1400, lofi: false,
    },
    {
      title: "Arena Pulse", bpm: 118, swing: 0,
      chords: [[52, 55, 59], [48, 52, 55], [55, 59, 62], [50, 54, 57]],          // Em C G D
      kick: [0, 4, 8, 12], snare: [4, 12], hat: [2, 6, 10, 14], openHat: [14],
      bass: [0, 2, 4, 6, 8, 10, 12, 14], bassOct: true, arp: true, arpOct: 24, arpEvery: 1, padCut: 1800, lofi: false,
    },
    {
      title: "Station Night", bpm: 78, swing: 0.18,
      chords: [[50, 53, 57, 60], [46, 50, 53, 57], [43, 46, 50, 53], [45, 49, 52, 55]], // Dm7 Bbmaj7 Gm7 A7
      kick: [0, 7, 10], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14], openHat: [],
      bass: [0, 7, 10], arp: false, padCut: 900, lofi: true,
    },
  ];

  function synthTrack(def) {
    var ctx = A.ctx;
    var bus = ctx.createGain(); bus.gain.value = 0; bus.connect(musicGain);
    bus.gain.setTargetAtTime(1, ctx.currentTime, 0.05);
    // space echo for the arpeggio
    var delay = ctx.createDelay(1); delay.delayTime.value = (60 / def.bpm) * 0.75;
    var fb = ctx.createGain(); fb.gain.value = 0.35;
    var wet = ctx.createGain(); wet.gain.value = 0.35;
    delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(bus);
    // vinyl crackle for the lo-fi track
    var crackle = null;
    if (def.lofi) {
      crackle = ctx.createBufferSource(); crackle.buffer = A.noise; crackle.loop = true;
      var cf = ctx.createBiquadFilter(); cf.type = "highpass"; cf.frequency.value = 3000;
      var cg = ctx.createGain(); cg.gain.value = 0.025;
      crackle.connect(cf); cf.connect(cg); cg.connect(bus); crackle.start();
    }
    var step = 0, nextTime = ctx.currentTime + 0.06, timer = null;
    var sixteenth = 60 / def.bpm / 4;

    function schedule(s, t) {
      var bar = Math.floor(s / 16) % def.chords.length, i = s % 16;
      var chord = def.chords[bar];
      if (i === 0) pad(bus, chord, t, sixteenth * 16 * 1.05, 0.035, def.padCut);
      if (def.kick.indexOf(i) >= 0) kick(bus, t, 0.9);
      if (def.snare.indexOf(i) >= 0) snare(bus, t, 0.32);
      if (def.hat.indexOf(i) >= 0) hat(bus, t, def.lofi ? 0.07 : 0.1, false);
      if (def.openHat.indexOf(i) >= 0) hat(bus, t, 0.08, true);
      if (def.bass.indexOf(i) >= 0) {
        var root = chord[0] - 24 + (def.bassOct && i % 4 === 2 ? 12 : 0);
        voice(bus, "sawtooth", hz(root), t, sixteenth * (def.lofi ? 3 : 1.8), 0.2, 0.005, def.lofi ? 420 : 700, 4);
      }
      if (def.arp && i % def.arpEvery === 0) {
        var n = chord[(i / def.arpEvery) % chord.length] + def.arpOct + (i >= 8 && def.arpEvery === 1 ? 12 : 0);
        var v = voice(bus, "square", hz(n), t, sixteenth * 1.6, 0.045, 0.004, 2600);
        v.filter.connect(delay);
      }
    }
    function tick() {
      var ahead = document.hidden ? 1.6 : 0.15; // background tabs run timers slowly
      while (nextTime < ctx.currentTime + ahead) {
        var swingOffset = step % 2 === 1 ? def.swing * sixteenth : 0;
        schedule(step, nextTime + swingOffset);
        nextTime += sixteenth;
        step++;
      }
    }
    tick();
    timer = setInterval(tick, 25);
    return {
      title: def.title,
      stop: function () {
        clearInterval(timer);
        var t = ctx.currentTime;
        bus.gain.cancelScheduledValues(t);
        bus.gain.setTargetAtTime(0, t, 0.06);
        setTimeout(function () { try { if (crackle) crackle.stop(); bus.disconnect(); } catch (e) { /* done */ } }, 600);
      },
    };
  }

  // tracks you add yourself: [{ "title": "My song", "file": "/assets/music/my-song.mp3" }]
  var extra = [];
  try { extra = JSON.parse(root.getAttribute("data-tracks") || "[]") || []; } catch (e) { extra = []; }
  extra = extra.filter(function (t) { return t && t.file; });

  function fileTrack(def) {
    var ctx = A.ctx;
    var audio = new Audio();
    audio.src = def.file; audio.preload = "auto";
    var src = ctx.createMediaElementSource(audio);
    var bus = ctx.createGain(); src.connect(bus); bus.connect(musicGain);
    audio.addEventListener("ended", function () { go(1); });
    audio.play().catch(function () { /* waits for a click */ });
    return {
      title: def.title || "Untitled",
      stop: function () { audio.pause(); setTimeout(function () { try { bus.disconnect(); } catch (e) { /* done */ } }, 50); },
    };
  }

  var tracks = extra.map(function (t) { return { kind: "file", def: t }; })
    .concat(builtIn.map(function (t) { return { kind: "synth", def: t }; }));
  index = ((index % tracks.length) + tracks.length) % tracks.length;

  // ---------- audio graph ----------
  function setup() {
    if (A) return true;
    A = window.echoSound && window.echoSound.music();
    if (!A) return false;
    musicGain = A.ctx.createGain();
    analyser = A.ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.72;
    musicGain.connect(analyser);
    analyser.connect(A.out);
    applyVolume();
    return true;
  }
  function applyVolume() {
    if (!musicGain) return;
    var v = muted ? 0 : Math.pow(volume / 100, 1.6) * 0.9;
    musicGain.gain.setTargetAtTime(v, A.ctx.currentTime, 0.03);
  }

  // ---------- controls ----------
  function showTitle() { titleEl.textContent = tracks[index].def.title || "Untitled"; }
  function start() {
    if (!setup()) return;
    if (A.ctx.state === "suspended") A.ctx.resume();
    if (current) current.stop();
    var t = tracks[index];
    current = t.kind === "file" ? fileTrack(t.def) : synthTrack(t.def);
    playing = true;
    root.classList.add("is-playing");
    playBtn.setAttribute("aria-label", "Stop music");
    window.echoSound.setMusicActive(true);
    store.sset("echo-music-playing", "1");
    loop();
  }
  function stop() {
    if (current) current.stop();
    current = null; playing = false;
    root.classList.remove("is-playing");
    playBtn.setAttribute("aria-label", "Play music");
    if (window.echoSound) window.echoSound.setMusicActive(false);
    store.sset("echo-music-playing", "0");
  }
  function go(dir) {
    index = (index + dir + tracks.length) % tracks.length;
    store.sset("echo-music-track", String(index));
    showTitle();
    if (playing) start();
  }

  playBtn.addEventListener("click", function () { if (playing) stop(); else start(); });
  prevBtn.addEventListener("click", function () { go(-1); });
  nextBtn.addEventListener("click", function () { go(1); });
  muteBtn.setAttribute("aria-pressed", muted ? "true" : "false");
  muteBtn.addEventListener("click", function () {
    muted = !muted;
    muteBtn.setAttribute("aria-pressed", muted ? "true" : "false");
    muteBtn.setAttribute("aria-label", muted ? "Unmute music" : "Mute music");
    store.set("echo-music-muted", muted ? "1" : "0");
    applyVolume();
  });
  volEl.addEventListener("input", function () {
    volume = Number(volEl.value);
    store.set("echo-music-vol", String(volume));
    if (muted && volume > 0) { muted = false; muteBtn.setAttribute("aria-pressed", "false"); store.set("echo-music-muted", "0"); }
    applyVolume();
  });
  showTitle();

  // keep playing after moving to another page: browsers need one click first, so
  // if it was playing, start again on the visitor's first interaction
  if (store.sget("echo-music-playing") === "1") {
    var resume = function (e) {
      if (e.target && e.target.closest && e.target.closest("#player")) return;
      window.removeEventListener("pointerdown", resume, true);
      window.removeEventListener("keydown", resume, true);
      if (!playing) start();
    };
    window.addEventListener("pointerdown", resume, true);
    window.addEventListener("keydown", resume, true);
  }

  // ---------- visualiser bars ----------
  var g2 = canvas.getContext("2d");
  var BARS = 28;
  var levels = new Float32Array(BARS), peaks = new Float32Array(BARS);
  var bins = null, bassAvg = 0, beatGlow = 0, running = false;
  var ratio = Math.min(window.devicePixelRatio || 1, 2);
  function sizeCanvas() {
    var w = canvas.clientWidth, h = canvas.clientHeight;
    canvas.width = Math.round(w * ratio); canvas.height = Math.round(h * ratio);
    g2.setTransform(ratio, 0, 0, ratio, 0, 0);
  }
  window.addEventListener("resize", function () { sizeCanvas(); loop(); });
  sizeCanvas();

  function loop() { if (!running) { running = true; requestAnimationFrame(frame); } }
  loop(); // draw the resting bars
  function frame() {
    var w = canvas.clientWidth, h = canvas.clientHeight;
    var active = playing && analyser;
    if (active) {
      if (!bins) bins = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(bins);
      // beat: bass energy jumping above its running average
      var bass = (bins[1] + bins[2] + bins[3] + bins[4]) / 4 / 255;
      if (bass > bassAvg * 1.25 && bass > 0.45 && beatGlow < 0.3) { beatGlow = 1; root.classList.add("beat"); }
      bassAvg = bassAvg * 0.92 + bass * 0.08;
    }
    beatGlow *= 0.88;
    if (beatGlow < 0.3) root.classList.remove("beat");

    g2.clearRect(0, 0, w, h);
    var gap = 2, bw = (w - gap * (BARS - 1)) / BARS, still = true;
    for (var i = 0; i < BARS; i++) {
      var target = 0.04;
      if (active) {
        // spread bars across the spectrum on a curve so the bass gets fewer, wider bands
        var a = Math.floor(Math.pow(i / BARS, 1.6) * 90) + 1, b = Math.floor(Math.pow((i + 1) / BARS, 1.6) * 90) + 2, sum = 0;
        for (var k = a; k < b; k++) sum += bins[k];
        target = Math.max(0.04, Math.min(1, Math.pow(sum / (b - a) / 255, 1.7) * 0.92 * (1 + beatGlow * 0.2)));
      }
      levels[i] += (target - levels[i]) * (target > levels[i] ? 0.55 : 0.18);
      peaks[i] = Math.max(peaks[i] - 0.012, levels[i]);
      if (levels[i] > 0.05 || peaks[i] > 0.05) still = false;
      var bh = Math.max(2, levels[i] * h), x = i * (bw + gap);
      var grad = g2.createLinearGradient(0, h, 0, h - bh);
      grad.addColorStop(0, "rgba(232,100,42,0.95)");
      grad.addColorStop(1, "rgba(242,227,74," + (0.75 + beatGlow * 0.25).toFixed(2) + ")");
      g2.fillStyle = grad;
      g2.shadowColor = "rgba(242,227,74,0.6)";
      g2.shadowBlur = 6 + beatGlow * 10;
      g2.fillRect(x, h - bh, bw, bh);
      g2.shadowBlur = 0;
      if (peaks[i] > levels[i] + 0.02) {
        g2.fillStyle = "rgba(134,227,234,0.9)";
        g2.fillRect(x, h - peaks[i] * h - 3, bw, 2);
      }
    }
    if (playing || !still) requestAnimationFrame(frame);
    else running = false; // leave the resting bars drawn
  }
})();
