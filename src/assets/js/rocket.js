// Scroll-driven 3D rocket launch for the top of the home page.
import * as THREE from "../vendor/three.module.min.js";

const html = document.documentElement;
if (!html.classList.contains("no-launch")) {
  try { start(); } catch (err) { fallback(); }
}

function fallback() {
  html.classList.remove("launching");
  html.classList.add("no-launch");
}

function start() {
  const section = document.getElementById("launch");
  const canvas = document.getElementById("rocket");
  const cloudBank = document.getElementById("launch-clouds");
  const hint = document.getElementById("launch-hint");
  const title = document.getElementById("launch-title");
  const skip = document.getElementById("skip-intro");
  if (!section || !canvas) return;

  const small = Math.min(window.innerWidth, window.innerHeight) < 700;

  // ---------- renderer ----------
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !small, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.5 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x12060a);

  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 500);

  // ---------- nebula backdrop ----------
  const nebula = new THREE.Mesh(
    new THREE.PlaneGeometry(320, 200),
    new THREE.ShaderMaterial({
      depthWrite: false,
      uniforms: { uTime: { value: 0 } },
      vertexShader: `
        varying vec2 vUv;
        void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        varying vec2 vUv;
        uniform float uTime;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
        float noise(vec2 p){
          vec2 i = floor(p), f = fract(p);
          vec2 u = f*f*(3.0-2.0*f);
          return mix(mix(hash(i), hash(i+vec2(1,0)), u.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y);
        }
        float fbm(vec2 p){ float v=0.0, a=0.5; for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.03; a*=0.5; } return v; }
        void main(){
          vec2 p = vUv * vec2(4.2, 2.6) + vec2(uTime*0.004, 0.0);
          float n = fbm(p);
          float n2 = fbm(p*1.7 + n*2.2 + 3.1);
          vec3 deep  = vec3(0.07, 0.024, 0.04);
          vec3 rust  = vec3(0.36, 0.10, 0.06);
          vec3 ember = vec3(0.91, 0.39, 0.16);
          vec3 amber = vec3(0.98, 0.70, 0.30);
          vec3 violet= vec3(0.30, 0.10, 0.42);
          vec3 c = mix(deep, rust, smoothstep(0.35, 0.75, n));
          c = mix(c, ember, smoothstep(0.52, 0.86, n2) * 0.75);
          c += amber * pow(smoothstep(0.66, 0.95, n2), 2.0) * 0.55;
          c = mix(c, violet, (1.0 - vUv.x) * smoothstep(0.45, 0.75, n) * 0.45);
          c *= mix(0.55, 1.0, smoothstep(0.0, 0.55, vUv.y));
          gl_FragColor = vec4(c, 1.0);
        }`,
    })
  );
  nebula.position.set(0, 30, -90);
  scene.add(nebula);

  // ---------- stars ----------
  {
    const count = small ? 700 : 1400;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 220;
      pos[i * 3 + 1] = -20 + Math.random() * 140;
      pos[i * 3 + 2] = -40 - Math.random() * 40;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const stars = new THREE.Points(g, new THREE.PointsMaterial({
      color: 0xfff2dc, size: 0.32, sizeAttenuation: true, transparent: true, opacity: 0.85, depthWrite: false,
    }));
    scene.add(stars);
  }

  // ---------- lights ----------
  scene.add(new THREE.HemisphereLight(0xffb37a, 0x2a0a10, 0.7));
  const key = new THREE.DirectionalLight(0xffd6a8, 2.4);
  key.position.set(6, 9, 7);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xb05cf2, 3.0);
  rim.position.set(-7, 5, -6);
  scene.add(rim);
  const engineLight = new THREE.PointLight(0xff8a3a, 0, 22, 1.6);
  scene.add(engineLight);

  // ---------- launch pad ----------
  const pad = new THREE.Group();
  {
    const stripeTex = (() => {
      const c = document.createElement("canvas");
      c.width = 512; c.height = 32;
      const x = c.getContext("2d");
      x.fillStyle = "#1a0a0a"; x.fillRect(0, 0, 512, 32);
      x.fillStyle = "#e6b52c";
      for (let i = -32; i < 512 + 32; i += 32) {
        x.beginPath(); x.moveTo(i, 32); x.lineTo(i + 16, 32); x.lineTo(i + 32, 0); x.lineTo(i + 16, 0); x.closePath(); x.fill();
      }
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = THREE.RepeatWrapping;
      t.repeat.set(4, 1);
      return t;
    })();
    const metal = new THREE.MeshStandardMaterial({ color: 0x3a1f1d, metalness: 0.6, roughness: 0.55 });
    const deck = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.75, 0.35, 48), metal);
    deck.position.y = -0.18;
    pad.add(deck);
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(2.77, 2.77, 0.16, 48, 1, true),
      new THREE.MeshStandardMaterial({ map: stripeTex, roughness: 0.6, metalness: 0.2 })
    );
    band.position.y = -0.2;
    pad.add(band);
    const tube = new THREE.Mesh(
      new THREE.TorusGeometry(2.25, 0.045, 10, 96),
      new THREE.MeshBasicMaterial({ color: 0xf2e34a })
    );
    tube.rotation.x = Math.PI / 2;
    tube.position.y = 0.01;
    pad.add(tube);
    const column = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 2.4, 9, 32), metal);
    column.position.y = -4.85;
    pad.add(column);
    // clamp arms
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + Math.PI / 6;
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.28, 0.5), new THREE.MeshStandardMaterial({ color: 0x7a2414, roughness: 0.6, metalness: 0.4 }));
      arm.position.set(Math.sin(a) * 1.15, 0.14, Math.cos(a) * 1.15);
      arm.rotation.y = a;
      pad.add(arm);
    }
  }
  scene.add(pad);

  // ---------- rocket ----------
  const rocket = new THREE.Group();
  const hullMat = new THREE.MeshStandardMaterial({ color: 0xfffaf4, roughness: 0.38, metalness: 0.08 });
  const redMat = new THREE.MeshStandardMaterial({ color: 0xb8321b, roughness: 0.5, metalness: 0.1 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x2b2426, roughness: 0.32, metalness: 0.85, side: THREE.DoubleSide });

  const lathe = (pts, mat, seg = 48) =>
    new THREE.Mesh(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg), mat);

  const smoothProfile = (pts, steps = 40) => {
    const curve = new THREE.SplineCurve(pts.map(([r, y]) => new THREE.Vector2(r, y)));
    return curve.getPoints(steps).map((v) => [Math.max(0, v.x), v.y]);
  };

  rocket.add(lathe(smoothProfile([[0.6, 0.42], [0.72, 0.6], [0.78, 1.1], [0.79, 1.9], [0.77, 2.55]]), hullMat));
  rocket.add(lathe(smoothProfile([[0.77, 2.55], [0.68, 3.05], [0.5, 3.5], [0.26, 3.9], [0.0001, 4.15]]), redMat));
  rocket.add(lathe([[0.0001, 0.42], [0.6, 0.42]], darkMat));
  // nozzle bell
  rocket.add(lathe(smoothProfile([[0.34, 0.44], [0.36, 0.3], [0.44, 0.12], [0.54, -0.02]], 16), darkMat, 32));
  // stripe band
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.795, 0.795, 0.14, 48, 1, true), redMat);
  stripe.position.y = 1.55;
  rocket.add(stripe);
  // porthole
  const port = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.05, 12, 32), darkMat);
  const glass = new THREE.Mesh(
    new THREE.CircleGeometry(0.2, 32),
    new THREE.MeshStandardMaterial({ color: 0x0b2b30, emissive: 0x86e3ea, emissiveIntensity: 1.3, roughness: 0.15 })
  );
  glass.position.z = 0.01;
  port.add(ring, glass);
  port.position.set(0, 2.15, 0.775);
  rocket.add(port);
  // fins
  {
    const s = new THREE.Shape();
    s.moveTo(0, 1.35);
    s.quadraticCurveTo(0.55, 0.9, 0.82, 0.12);
    s.lineTo(0.86, -0.18);
    s.lineTo(0.58, -0.12);
    s.quadraticCurveTo(0.3, 0.25, 0, 0.42);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.08, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2, curveSegments: 12 });
    g.translate(0, 0, -0.04);
    for (let i = 0; i < 3; i++) {
      const fin = new THREE.Mesh(g, redMat);
      const holder = new THREE.Group();
      fin.position.x = 0.6;
      fin.rotation.y = 0;
      holder.add(fin);
      holder.rotation.y = (i / 3) * Math.PI * 2 + Math.PI / 2;
      rocket.add(holder);
    }
  }
  rocket.position.y = 0.2;
  scene.add(rocket);

  // ---------- flame ----------
  // A camera-facing flame shape (rotates around the rocket's axis) plus a soft glow.
  const flameMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uThrust: { value: 0 } },
    vertexShader: `
      varying vec2 vUv;
      void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uTime; uniform float uThrust;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float noise(vec2 p){
        vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
        return mix(mix(hash(i), hash(i+vec2(1,0)), u.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y);
      }
      void main(){
        float t = 1.0 - vUv.y;               // 0 at the nozzle, 1 at the tip
        float x = (vUv.x - 0.5) * 2.0;
        float n = noise(vec2(x * 3.0, t * 7.0 - uTime * 14.0)) * 0.6 + noise(vec2(x * 7.0, t * 15.0 - uTime * 23.0)) * 0.4;
        float w = mix(0.5, 0.04, pow(t, 0.75)) * (0.8 + 0.4 * n);
        float body = 1.0 - smoothstep(w * 0.35, w, abs(x));
        float core = (1.0 - smoothstep(0.0, w * 0.5, abs(x))) * (1.0 - smoothstep(0.0, 0.5, t));
        float fade = 1.0 - smoothstep(0.45, 1.0, t);
        vec3 outer = mix(vec3(1.0, 0.5, 0.14), vec3(0.85, 0.2, 0.08), smoothstep(0.2, 0.9, t));
        vec3 c = mix(outer, vec3(1.0, 0.93, 0.7), core);
        float a = (body * 0.9 + core * 0.7) * fade * uThrust;
        gl_FragColor = vec4(c * 1.4, a);
      }`,
  });
  const flameGeo = new THREE.PlaneGeometry(1, 1);
  flameGeo.translate(0, -0.5, 0); // top edge at the nozzle
  const flame = new THREE.Mesh(flameGeo, flameMat);
  scene.add(flame);

  const glowTex = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const x = c.getContext("2d");
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(255,220,160,1)");
    g.addColorStop(0.25, "rgba(255,140,60,0.55)");
    g.addColorStop(1, "rgba(255,90,30,0)");
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0,
  }));
  scene.add(glow);

  // ---------- smoke ----------
  const MAX = small ? 420 : 820;
  const puffTex = (() => {
    const size = 128;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const x = c.getContext("2d");
    for (let i = 0; i < 14; i++) {
      const r = size * (0.16 + Math.random() * 0.18);
      const a = Math.random() * Math.PI * 2;
      const d = Math.random() * size * 0.2;
      const cx = size / 2 + Math.cos(a) * d, cy = size / 2 + Math.sin(a) * d;
      const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, "rgba(255,255,255,0.55)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      x.fillStyle = g;
      x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.NoColorSpace;
    return t;
  })();

  const base = new THREE.PlaneGeometry(1, 1);
  const smokeGeo = new THREE.InstancedBufferGeometry();
  smokeGeo.index = base.index;
  smokeGeo.setAttribute("position", base.getAttribute("position"));
  smokeGeo.setAttribute("uv", base.getAttribute("uv"));
  const aPos = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3);
  const aSize = new THREE.InstancedBufferAttribute(new Float32Array(MAX), 1);
  const aAlpha = new THREE.InstancedBufferAttribute(new Float32Array(MAX), 1);
  const aRot = new THREE.InstancedBufferAttribute(new Float32Array(MAX), 1);
  const aHeat = new THREE.InstancedBufferAttribute(new Float32Array(MAX), 1);
  for (const a of [aPos, aSize, aAlpha, aRot, aHeat]) a.setUsage(THREE.DynamicDrawUsage);
  smokeGeo.setAttribute("iPos", aPos);
  smokeGeo.setAttribute("iSize", aSize);
  smokeGeo.setAttribute("iAlpha", aAlpha);
  smokeGeo.setAttribute("iRot", aRot);
  smokeGeo.setAttribute("iHeat", aHeat);
  smokeGeo.instanceCount = 0;

  const smoke = new THREE.Mesh(smokeGeo, new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uTex: { value: puffTex } },
    vertexShader: `
      attribute vec3 iPos; attribute float iSize; attribute float iAlpha; attribute float iRot; attribute float iHeat;
      varying vec2 vUv; varying float vAlpha; varying float vHeat; varying float vShade;
      void main(){
        vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
        vec3 up    = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
        float c = cos(iRot), s = sin(iRot);
        vec2 q = vec2(c*position.x - s*position.y, s*position.x + c*position.y) * iSize;
        vec3 world = iPos + right*q.x + up*q.y;
        vUv = uv; vAlpha = iAlpha; vHeat = iHeat;
        vShade = position.y + 0.5;
        gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
      }`,
    fragmentShader: `
      uniform sampler2D uTex;
      varying vec2 vUv; varying float vAlpha; varying float vHeat; varying float vShade;
      void main(){
        float m = texture2D(uTex, vUv).a;
        vec3 shadow = vec3(0.49, 0.41, 0.44);
        vec3 light  = vec3(0.86, 0.80, 0.81);
        vec3 col = mix(shadow, light, smoothstep(0.0, 1.0, vShade * 0.8 + m * 0.4));
        col += vec3(1.0, 0.42, 0.14) * vHeat * (0.75 - vShade * 0.45);
        float a = clamp(m * 1.25, 0.0, 1.0) * vAlpha;
        if (a < 0.004) discard;
        gl_FragColor = vec4(col, a);
      }`,
  }));
  smoke.frustumCulled = false;
  scene.add(smoke);

  // particle pool (struct of arrays)
  const P = {
    x: new Float32Array(MAX), y: new Float32Array(MAX), z: new Float32Array(MAX),
    vx: new Float32Array(MAX), vy: new Float32Array(MAX), vz: new Float32Array(MAX),
    age: new Float32Array(MAX), life: new Float32Array(MAX),
    s0: new Float32Array(MAX), s1: new Float32Array(MAX),
    rot: new Float32Array(MAX), vr: new Float32Array(MAX),
    a: new Float32Array(MAX), heat: new Float32Array(MAX), drag: new Float32Array(MAX),
  };
  const free = [];
  for (let i = MAX - 1; i >= 0; i--) { P.life[i] = 0; free.push(i); }
  const alive = new Set();

  function emit(o) {
    if (!free.length) return;
    const i = free.pop();
    P.x[i] = o.x; P.y[i] = o.y; P.z[i] = o.z;
    P.vx[i] = o.vx; P.vy[i] = o.vy; P.vz[i] = o.vz;
    P.age[i] = 0; P.life[i] = o.life;
    P.s0[i] = o.s0; P.s1[i] = o.s1;
    P.rot[i] = Math.random() * Math.PI * 2; P.vr[i] = (Math.random() - 0.5) * 0.6;
    P.a[i] = o.a; P.heat[i] = o.heat || 0; P.drag[i] = o.drag ?? 1.2;
    alive.add(i);
  }

  const rand = (a, b) => a + Math.random() * (b - a);
  const accum = { vent: 0, ground: 0, trail: 0, bank: 0 };

  function emitters(dt, s) {
    const nozzleY = s.rocketY + 0.0;
    // cold venting before ignition
    accum.vent += dt * (s.thrust < 0.05 ? 7 : 0);
    while (accum.vent >= 1) {
      accum.vent -= 1;
      const side = Math.random() < 0.5 ? -1 : 1;
      emit({ x: side * rand(0.5, 0.9), y: rand(0.6, 1.4), z: rand(-0.3, 0.5), vx: side * rand(0.2, 0.5), vy: rand(0.1, 0.4), vz: rand(-0.1, 0.1),
        life: rand(2.2, 3.4), s0: 0.35, s1: rand(1.3, 2.0), a: 0.28, drag: 0.6 });
    }
    // ground billow while the rocket is close to the pad
    const nearGround = Math.max(0, 1 - s.rocketY / 6);
    accum.ground += dt * 150 * s.thrust * nearGround;
    while (accum.ground >= 1) {
      accum.ground -= 1;
      const ang = Math.random() * Math.PI * 2;
      const sp = rand(3, 8);
      emit({ x: Math.cos(ang) * 0.4, y: rand(-0.2, 0.3), z: Math.sin(ang) * 0.4,
        vx: Math.cos(ang) * sp, vy: rand(0.2, 1.4), vz: Math.sin(ang) * sp * 0.75,
        life: rand(3.2, 5.2), s0: rand(0.9, 1.4), s1: rand(3.6, 5.6), a: 0.82, heat: 0.8, drag: 1.5 });
    }
    // exhaust trail once airborne
    accum.trail += (dt * 70 + Math.abs(nozzleY - s.prevY) * 6) * s.thrust * (s.rocketY > 0.8 ? 1 : 0) * (s.rocketY < 40 ? 1 : 0);
    while (accum.trail >= 1) {
      accum.trail -= 1;
      // spread puffs along the path the rocket covered this frame, so the trail stays continuous
      const along = s.prevY + (nozzleY - s.prevY) * Math.random();
      emit({ x: rand(-0.25, 0.25), y: along - rand(1.2, 3.2), z: rand(-0.25, 0.25),
        vx: rand(-0.8, 0.8), vy: rand(-2.2, -0.6), vz: rand(-0.8, 0.8),
        life: rand(2.2, 3.4), s0: rand(0.6, 0.9), s1: rand(2.2, 3.4), a: 0.5, heat: 0.35, drag: 0.9 });
    }
    // rising cloud bank at the end
    accum.bank += dt * 70 * s.bank;
    while (accum.bank >= 1) {
      accum.bank -= 1;
      emit({ x: rand(-16, 16), y: s.lookY - rand(7, 10), z: rand(-6, 6),
        vx: rand(-0.4, 0.4), vy: rand(2.2, 4.2), vz: rand(-0.2, 0.6),
        life: rand(4, 6), s0: rand(5, 7), s1: rand(10, 14), a: 0.95, heat: 0, drag: 0.15 });
    }
  }

  function updateParticles(dt) {
    let n = 0;
    const pa = aPos.array, ps = aSize.array, pal = aAlpha.array, pr = aRot.array, ph = aHeat.array;
    for (const i of alive) {
      P.age[i] += dt;
      const t = P.age[i] / P.life[i];
      if (t >= 1) { alive.delete(i); free.push(i); continue; }
      const k = Math.exp(-P.drag[i] * dt);
      P.vx[i] *= k; P.vz[i] *= k; P.vy[i] = P.vy[i] * k + 0.35 * dt;
      P.x[i] += P.vx[i] * dt; P.y[i] += P.vy[i] * dt; P.z[i] += P.vz[i] * dt;
      P.rot[i] += P.vr[i] * dt;
      const grow = 1 - Math.pow(1 - t, 2.2);
      pa[n * 3] = P.x[i]; pa[n * 3 + 1] = P.y[i]; pa[n * 3 + 2] = P.z[i];
      ps[n] = P.s0[i] + (P.s1[i] - P.s0[i]) * grow;
      pal[n] = P.a[i] * Math.min(1, t * 8) * (1 - Math.pow(t, 1.8));
      pr[n] = P.rot[i];
      ph[n] = P.heat[i] * Math.max(0, 1 - t * 2.4);
      n++;
    }
    smokeGeo.instanceCount = n;
    for (const a of [aPos, aSize, aAlpha, aRot, aHeat]) a.needsUpdate = true;
  }

  // ---------- scroll + layout ----------
  let target = 0, prog = 0;
  let pointerX = 0, pointerY = 0, px = 0, py = 0;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  function readScroll() {
    const rect = section.getBoundingClientRect();
    const total = section.offsetHeight - window.innerHeight;
    target = clamp(-rect.top / Math.max(1, total), 0, 1);
    return rect;
  }

  let viewW = 0, viewH = 0;
  function resize() {
    viewW = canvas.clientWidth; viewH = canvas.clientHeight;
    renderer.setSize(viewW, viewH, false);
    camera.aspect = viewW / Math.max(1, viewH);
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);
  window.addEventListener("scroll", readScroll, { passive: true });
  window.addEventListener("pointermove", (e) => {
    pointerX = (e.clientX / window.innerWidth) * 2 - 1;
    pointerY = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });
  resize();
  readScroll();
  prog = target;

  // ---------- loop ----------
  const clock = new THREE.Clock();
  let time = 0;
  let launched = null;
  let prevRocketY = 0.2;

  function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 1 / 20);
    time += dt;
    const rect = section.getBoundingClientRect();
    const onScreen = rect.bottom > 0;

    prog += (target - prog) * Math.min(1, dt * 7);
    const p = prog;

    // overlays (cheap, always)
    const intro = 1 - smooth(0.015, 0.09, p);
    if (hint) hint.style.opacity = intro.toFixed(3);
    if (title) title.style.opacity = intro.toFixed(3);
    if (skip) skip.style.opacity = (1 - smooth(0.85, 0.95, p)).toFixed(3);
    const q = smooth(0.56, 0.95, p);
    if (cloudBank) cloudBank.style.transform = `translate3d(0, ${(100 - q * 145).toFixed(2)}vh, 0)`;
    const isLaunched = target > 0.985;
    if (isLaunched !== launched) { html.classList.toggle("launching", !isLaunched); launched = isLaunched; }

    if (!onScreen) return;

    // state from progress
    const thrust = smooth(0.09, 0.2, p);
    const lift = clamp((p - 0.22) / 0.5, 0, 1);
    const rocketY = 0.2 + 30 * Math.pow(lift, 2.4);
    const bank = smooth(0.5, 0.7, p) * (1 - smooth(0.97, 1, p));

    // rocket
    rocket.position.y = rocketY;
    rocket.rotation.y += dt * 0.25;
    rocket.rotation.z = Math.sin(time * 1.3) * 0.015 * (1 + lift * 2);
    const shake = 0.035 * thrust * (1 - smooth(0.0, 0.35, lift));
    rocket.position.x = (Math.random() - 0.5) * shake;

    const len = (0.5 + 3.4 * thrust) * (0.94 + Math.random() * 0.12);
    flame.scale.set(1.1 + 0.4 * thrust, len, 1);
    flame.position.set(rocket.position.x, rocketY + 0.05, 0);
    flame.rotation.y = Math.atan2(camera.position.x - flame.position.x, camera.position.z);
    flameMat.uniforms.uThrust.value = thrust;
    flameMat.uniforms.uTime.value = time;
    glow.position.set(rocket.position.x, rocketY - 0.35, 0.2);
    const gs = 3.2 * thrust * (0.95 + Math.random() * 0.1);
    glow.scale.set(gs, gs, 1);
    glow.material.opacity = 0.85 * thrust;
    engineLight.position.set(0, rocketY - 0.8, 0.6);
    engineLight.intensity = thrust * (38 + Math.random() * 10);

    // camera
    const aspect = camera.aspect;
    const dist = Math.max(14, 8.6 / Math.min(aspect, 1.2));
    px += (pointerX - px) * dt * 2; py += (pointerY - py) * dt * 2;
    const follow = Math.min(rocketY, 7) * 0.55;
    const camShake = 0.05 * thrust * (1 - smooth(0.0, 0.5, lift));
    camera.position.set(px * 0.9 + (Math.random() - 0.5) * camShake, 1.6 + follow * 0.5 - py * 0.4 + (Math.random() - 0.5) * camShake, dist);
    camera.lookAt(0, 2.3 + follow, 0);

    nebula.material.uniforms.uTime.value = time;

    emitters(dt, { thrust, rocketY, bank, prevY: prevRocketY, lookY: 2.3 + follow });
    prevRocketY = rocketY;
    updateParticles(dt);

    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
}
