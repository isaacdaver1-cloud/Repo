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

  // split the title into letters so each one can slam in on its own
  if (title && !title.dataset.text) {
    const text = title.textContent.trim();
    title.dataset.text = text;
    title.setAttribute("aria-label", text);
    title.textContent = "";
    let i = 0;
    text.split(" ").forEach((word, w) => {
      const ws = document.createElement("span");
      ws.className = "word"; ws.setAttribute("aria-hidden", "true");
      for (const ch of word) {
        const s = document.createElement("span");
        s.className = "ch"; s.textContent = ch;
        s.style.setProperty("--i", String(i++));
        s.style.setProperty("--r", ((Math.random() - 0.5) * 50).toFixed(1) + "deg");
        ws.appendChild(s);
      }
      title.appendChild(ws);
      if (w < text.split(" ").length - 1) title.appendChild(document.createTextNode(" "));
    });
  }

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

  // ---------- deep space set dressing: planet, the Echo station, asteroids, meteors ----------
  const spaceTex = makeSpaceTextures(renderer.capabilities.getMaxAnisotropy());

  // ringed gas giant
  const planet = new THREE.Group();
  {
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(14, 64, 48),
      new THREE.MeshStandardMaterial({ map: spaceTex.planet, roughness: 0.9, metalness: 0 })
    );
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(18, 30, 128, 1),
      new THREE.MeshBasicMaterial({ map: spaceTex.ring, transparent: true, side: THREE.DoubleSide, depthWrite: false })
    );
    // RingGeometry UVs are planar; remap so the texture runs from inner to outer edge
    const pos = ring.geometry.attributes.position, uv = ring.geometry.attributes.uv, v3 = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) { v3.fromBufferAttribute(pos, i); uv.setXY(i, (v3.length() - 18) / 12, 0.5); }
    ring.rotation.x = -Math.PI / 2.4;
    ring.rotation.y = 0.35;
    const atmo = new THREE.Mesh(
      new THREE.SphereGeometry(14.8, 48, 32),
      new THREE.MeshBasicMaterial({ color: 0xff8a4a, transparent: true, opacity: 0.12, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    planet.add(body, atmo, ring);
    planet.position.set(-38, 26, -78);
    planet.rotation.z = 0.25;
  }
  scene.add(planet);

  // the Echo station, far away: habitat ring, hub, spokes, solar wings, dish, radiators, blinking lights
  const station = new THREE.Group();
  const spinner = new THREE.Group(); // the part that rotates (ring + spokes)
  const stationLights = [];
  {
    const T = spaceTex;
    const hullM = new THREE.MeshStandardMaterial({ map: T.hull, bumpMap: T.hullBump, bumpScale: 1.5, roughness: 0.75, metalness: 0.35 });
    const habM = new THREE.MeshStandardMaterial({
      map: T.hab, bumpMap: T.habBump, bumpScale: 1.5, emissiveMap: T.habGlow, emissive: 0xffffff, emissiveIntensity: 1.4,
      roughness: 0.7, metalness: 0.3,
    });
    const darkM = new THREE.MeshStandardMaterial({ color: 0x3a3436, roughness: 0.6, metalness: 0.7 });
    const solarM = new THREE.MeshStandardMaterial({ map: T.solar, roughness: 0.35, metalness: 0.6, emissive: 0x2a1a60, emissiveIntensity: 0.4, side: THREE.DoubleSide });
    const trussM = new THREE.MeshStandardMaterial({ map: T.truss, alphaTest: 0.5, roughness: 0.7, metalness: 0.5, side: THREE.DoubleSide });

    // habitat ring
    const ring = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.62, 24, 96), habM);
    spinner.add(ring);
    // neon tube on the front face
    const tube = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.07, 8, 128), new THREE.MeshBasicMaterial({ color: 0xf2e34a }));
    tube.position.z = 0.6;
    spinner.add(tube);
    // spokes: truss tubes with a pipe inside
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const arm = new THREE.Group();
      const truss = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 3.1, 6, 1, true), trussM);
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.1, 8), darkM);
      truss.position.y = pipe.position.y = 2.25;
      arm.add(truss, pipe);
      arm.rotation.z = a;
      spinner.add(arm);
    }
    // nav lights around the rim
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), new THREE.MeshBasicMaterial({ color: i % 4 === 0 ? 0xff4a3a : 0x86e3ea }));
      l.position.set(Math.cos(a) * 4.85, Math.sin(a) * 4.85, 0);
      l.userData.phase = i * 0.7;
      spinner.add(l); stationLights.push(l);
    }
    station.add(spinner);

    // central hub with docking collars (does not spin)
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 2.4, 32), hullM);
    hub.rotation.x = Math.PI / 2;
    const capF = new THREE.Mesh(new THREE.SphereGeometry(1.15, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), hullM);
    capF.rotation.x = Math.PI / 2; capF.position.z = 1.2;
    const collar = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.12, 12, 48), darkM);
    collar.position.z = 0.6;
    const collar2 = collar.clone(); collar2.position.z = -0.6;
    const dock = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 0.6, 20), darkM);
    dock.rotation.x = Math.PI / 2; dock.position.z = 2.45;
    const dockGlow = new THREE.Mesh(new THREE.CircleGeometry(0.28, 20), new THREE.MeshBasicMaterial({ color: 0x86e3ea }));
    dockGlow.position.z = 2.76;
    station.add(hub, capF, collar, collar2, dock, dockGlow);

    // central mast running backwards to the power section
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 9, 6, 1, true), trussM);
    mast.rotation.x = Math.PI / 2; mast.position.z = -5.6;
    station.add(mast);
    // solar wings: two big panels each side
    for (const side of [-1, 1]) {
      for (let k = 0; k < 2; k++) {
        const wing = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.05, 1.8), solarM);
        wing.position.set(side * (3.3), 0, -6.2 - k * 2.3);
        const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.1, 6), darkM);
        boom.rotation.z = Math.PI / 2; boom.position.set(side * 0.6, 0, wing.position.z);
        station.add(wing, boom);
      }
    }
    // radiator fins
    for (const side of [-1, 1]) {
      const rad = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.6, 1.4), new THREE.MeshStandardMaterial({ color: 0xd8d0c8, roughness: 0.5, metalness: 0.2 }));
      rad.position.set(0, side * 1.7, -8.6);
      station.add(rad);
    }
    // communications dish
    const dishGeo = new THREE.LatheGeometry([0, 0.3, 0.6, 0.9, 1.1].map((r) => new THREE.Vector2(r, r * r * 0.35)), 32);
    const dish = new THREE.Mesh(dishGeo, new THREE.MeshStandardMaterial({ color: 0xe8e2da, roughness: 0.45, metalness: 0.3, side: THREE.DoubleSide }));
    dish.rotation.x = -Math.PI / 2.6; dish.position.set(0, 1.5, -10.2);
    const dishArm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.4, 6), darkM);
    dishArm.position.set(0, 0.8, -10.2);
    station.add(dish, dishArm);

    station.position.set(30, 20, -62);
    station.rotation.set(0.4, -0.95, 0.12);
  }
  scene.add(station);

  // asteroids: smooth lumpy rocks with real craters dug into the surface
  const asteroids = [];
  {
    const rockMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0.04 });
    const count = small ? 9 : 18;
    const detail = small ? 6 : 9;
    for (let i = 0; i < count; i++) {
      const g = makeAsteroidGeometry(detail);
      const m = new THREE.Mesh(g, rockMat);
      const near = i < (small ? 2 : 4); // a few big ones close to the camera
      const size = near ? 0.9 + Math.random() * 1.1 : 0.5 + Math.random() * 2.6;
      m.scale.setScalar(size);
      const side = Math.random() < 0.5 ? -1 : 1;
      m.position.set(
        near ? side * (7 + Math.random() * 5) : (Math.random() - 0.5) * 70,
        near ? -1 + Math.random() * 9 : -4 + Math.random() * 40,
        near ? 2 + Math.random() * 4 : -12 - Math.random() * 40
      );
      // keep the middle clear so no rock sits behind or in front of the rocket
      if (!near && Math.abs(m.position.x) < 10 && m.position.y < 18) m.position.x = (m.position.x < 0 ? -1 : 1) * (10 + Math.random() * 20);
      m.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      m.userData = {
        spin: new THREE.Vector3((Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.4),
        drift: new THREE.Vector3((Math.random() - 0.5) * (near ? 0.9 : 0.5), (Math.random() - 0.5) * 0.25, 0),
      };
      scene.add(m); asteroids.push(m);
    }
  }

  // shooting stars
  const meteorMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uFade: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `varying vec2 vUv; uniform float uFade;
      void main(){ float head = pow(vUv.x, 3.0); float w = 1.0 - abs(vUv.y - 0.5) * 2.0;
        vec3 c = mix(vec3(1.0,0.5,0.2), vec3(1.0,0.97,0.85), head);
        gl_FragColor = vec4(c, head * w * w * uFade); }`,
  });
  const meteor = new THREE.Mesh(new THREE.PlaneGeometry(14, 0.22), meteorMat);
  meteor.visible = false;
  scene.add(meteor);
  const meteorState = { t: 0, next: 1.5, life: 0.9, from: new THREE.Vector3(), dir: new THREE.Vector3() };

  // shockwave ring across the pad at ignition
  const shock = new THREE.Mesh(
    new THREE.RingGeometry(0.9, 1.2, 64),
    new THREE.MeshBasicMaterial({ color: 0xffc070, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  shock.rotation.x = -Math.PI / 2;
  shock.position.y = 0.05;
  scene.add(shock);
  let shockT = -1, lastThrustForShock = 0;

  // ---------- lights ----------
  scene.add(new THREE.HemisphereLight(0xffb37a, 0x2a0a10, 0.7));
  const key = new THREE.DirectionalLight(0xffd6a8, 2.4);
  key.position.set(6, 9, 7);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xb05cf2, 1.6);
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
  const tex = makeRocketTextures(renderer.capabilities.getMaxAnisotropy());
  const hullMat = new THREE.MeshStandardMaterial({
    map: tex.hull.map, bumpMap: tex.hull.bump, bumpScale: 2.2, roughnessMap: tex.hull.rough, roughness: 1, metalness: 0.05,
  });
  const redMat = new THREE.MeshStandardMaterial({
    map: tex.nose.map, bumpMap: tex.nose.bump, bumpScale: 1.8, roughnessMap: tex.nose.rough, roughness: 1, metalness: 0.08,
  });
  const finMat = new THREE.MeshStandardMaterial({
    map: tex.fin.map, bumpMap: tex.fin.bump, bumpScale: 1.6, roughnessMap: tex.fin.rough, roughness: 1, metalness: 0.08,
  });
  const nozzleMat = new THREE.MeshStandardMaterial({
    map: tex.nozzle.map, bumpMap: tex.nozzle.bump, bumpScale: 1.2, roughness: 0.62, metalness: 0.6, side: THREE.DoubleSide,
  });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x2e2a29, roughness: 0.7, metalness: 0.5, side: THREE.DoubleSide });

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
  rocket.add(lathe(smoothProfile([[0.34, 0.44], [0.36, 0.3], [0.44, 0.12], [0.54, -0.02]], 16), nozzleMat, 32));
  // stripe band
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.795, 0.795, 0.14, 48, 1, true), finMat);
  stripe.position.y = 1.55;
  rocket.add(stripe);
  // porthole: textured bolted frame + domed glass with a custom shader
  const port = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.22, 0.052, 24, 64),
    new THREE.MeshStandardMaterial({
      map: tex.ring.map, bumpMap: tex.ring.bump, bumpScale: 2.5, roughnessMap: tex.ring.rough, roughness: 1, metalness: 0.75,
    })
  );
  const glassMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      varying vec3 vN; varying vec3 vV; varying vec3 vLocal;
      void main(){
        vLocal = position;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vN = normalize(mat3(modelMatrix) * normal);
        vV = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `
      varying vec3 vN; varying vec3 vV; varying vec3 vLocal;
      uniform float uTime;
      void main(){
        vec3 N = normalize(vN), V = normalize(vV);
        float ndv = clamp(dot(N, V), 0.0, 1.0);
        float fres = pow(1.0 - ndv, 3.0);
        // cockpit seen through tinted glass: dark teal with a soft cyan glow in the middle
        float r = length(vLocal.xy) / 0.19;
        vec3 inside = mix(vec3(0.42, 0.85, 0.88), vec3(0.02, 0.10, 0.12), smoothstep(0.0, 1.0, r));
        inside *= 0.85 + 0.15 * sin(uTime * 1.7);
        // fake reflection of the nebula and space around the rocket
        vec3 R = reflect(-V, N);
        vec3 env = mix(vec3(0.05, 0.02, 0.04), vec3(0.95, 0.45, 0.2), smoothstep(-0.2, 0.8, R.y));
        env += vec3(1.0, 0.85, 0.65) * pow(max(dot(R, normalize(vec3(0.5, 0.7, 0.6))), 0.0), 60.0) * 2.0;
        // classic diagonal glass sheen streaks
        float d = vLocal.x * 0.8 + vLocal.y;
        float streak = smoothstep(0.035, 0.0, abs(d - 0.07)) * 0.55 + smoothstep(0.012, 0.0, abs(d - 0.12)) * 0.4;
        streak *= smoothstep(1.0, 0.6, r);
        vec3 col = mix(inside, env, 0.25 + 0.6 * fres) + streak;
        // darker rim where glass meets the frame
        col *= mix(1.0, 0.45, smoothstep(0.8, 1.0, r));
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  // shallow dome: a sphere cap pointing out of the hull
  const domeGeo = new THREE.SphereGeometry(0.2, 40, 16, 0, Math.PI * 2, 0, Math.PI * 0.5);
  domeGeo.rotateX(Math.PI / 2);
  domeGeo.scale(1, 1, 0.3);
  const glass = new THREE.Mesh(domeGeo, glassMat);
  glass.position.z = -0.01;
  port.add(ring, glass);
  port.position.set(0, 2.15, 0.8);
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
      const fin = new THREE.Mesh(g, finMat);
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

    const sound = window.echoSound;
    if (!onScreen) { if (sound) sound.engine({ thrust: 0, height: 0, bank: 0, visible: false }); return; }

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
    glassMat.uniforms.uTime.value = time;
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
    const camShake = (0.09 * thrust + (shockT >= 0 ? 0.35 * (1 - shockT / 1.1) : 0)) * (1 - smooth(0.0, 0.5, lift));
    camera.position.set(px * 0.9 + (Math.random() - 0.5) * camShake, 1.6 + follow * 0.5 - py * 0.4 + (Math.random() - 0.5) * camShake, dist);
    camera.lookAt(0, 2.3 + follow, 0);

    nebula.material.uniforms.uTime.value = time;

    // set dressing
    planet.rotation.y += dt * 0.01;
    spinner.rotation.z += dt * 0.12;
    stationLights.forEach((l) => { l.visible = Math.sin(time * 3 + l.userData.phase) > -0.2; });
    for (const a of asteroids) {
      a.rotation.x += a.userData.spin.x * dt; a.rotation.y += a.userData.spin.y * dt; a.rotation.z += a.userData.spin.z * dt;
      a.position.addScaledVector(a.userData.drift, dt);
      if (a.position.x > 40) a.position.x = -40; else if (a.position.x < -40) a.position.x = 40;
      if (a.position.z < -8 && Math.abs(a.position.x) < 9 && a.position.y < 18) a.userData.drift.x = Math.sign(a.position.x || 1) * Math.abs(a.userData.drift.x || 0.3);
    }
    meteorState.t += dt;
    if (!meteor.visible && meteorState.t > meteorState.next) {
      meteorState.t = 0; meteorState.life = 0.7 + Math.random() * 0.5;
      meteorState.from.set(-30 + Math.random() * 60, 18 + Math.random() * 20, -30 - Math.random() * 15);
      const ang = -0.35 - Math.random() * 0.5;
      meteorState.dir.set(Math.cos(ang) * (Math.random() < 0.5 ? -1 : 1), Math.sin(ang), 0).normalize();
      meteor.rotation.z = Math.atan2(meteorState.dir.y, meteorState.dir.x);
      meteor.visible = true;
    }
    if (meteor.visible) {
      const k = meteorState.t / meteorState.life;
      meteor.position.copy(meteorState.from).addScaledVector(meteorState.dir, k * 45);
      meteorMat.uniforms.uFade.value = Math.sin(Math.min(1, k) * Math.PI);
      if (k >= 1) { meteor.visible = false; meteorState.t = 0; meteorState.next = 1.2 + Math.random() * 3; }
    }
    if (thrust > 0.15 && lastThrustForShock <= 0.15) shockT = 0;
    lastThrustForShock = thrust;
    if (shockT >= 0) {
      shockT += dt;
      const k = shockT / 1.1;
      shock.scale.setScalar(1 + k * 22);
      shock.material.opacity = Math.max(0, 0.9 * (1 - k));
      if (k >= 1) { shockT = -1; shock.material.opacity = 0; }
    }

    emitters(dt, { thrust, rocketY, bank, prevY: prevRocketY, lookY: 2.3 + follow });
    if (sound) sound.engine({ thrust, height: rocketY, bank, visible: true });
    prevRocketY = rocketY;
    updateParticles(dt);

    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
}


// ---------- painted, weathered rocket textures (drawn once on canvases) ----------
function makeRocketTextures(aniso) {
  let seed = 7;
  const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const canvas = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return [c, c.getContext("2d")]; };
  const finish = (c, srgb) => {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = Math.min(8, aniso || 1);
    return t;
  };
  // soft blotches for paint mottling / grime
  const mottle = (x, w, h, n, colours, rMin, rMax, aMax) => {
    for (let i = 0; i < n; i++) {
      const cx = rnd() * w, cy = rnd() * h, r = rMin + rnd() * (rMax - rMin);
      const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
      const c = colours[Math.floor(rnd() * colours.length)];
      g.addColorStop(0, `rgba(${c},${(rnd() * aMax).toFixed(3)})`);
      g.addColorStop(1, `rgba(${c},0)`);
      x.fillStyle = g; x.fillRect(cx - r, cy - r, r * 2, r * 2);
      if (cx < r) x.fillRect(cx - r + w, cy - r, r * 2, r * 2); // wrap horizontally
      if (cx > w - r) x.fillRect(cx - r - w, cy - r, r * 2, r * 2);
    }
  };
  const grain = (x, w, h, amount) => {
    const img = x.getImageData(0, 0, w, h), d = img.data;
    for (let i = 0; i < d.length; i += 4) { const n = (rnd() - 0.5) * amount; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
    x.putImageData(img, 0, 0);
  };
  const streaks = (x, w, h, fromYs, colour, count) => {
    for (let i = 0; i < count; i++) {
      const sx = rnd() * w, sy = fromYs[Math.floor(rnd() * fromYs.length)], len = 30 + rnd() * 160, sw = 1 + rnd() * 4;
      const g = x.createLinearGradient(0, sy, 0, sy + len);
      g.addColorStop(0, `rgba(${colour},${(0.06 + rnd() * 0.14).toFixed(3)})`);
      g.addColorStop(1, `rgba(${colour},0)`);
      x.fillStyle = g; x.fillRect(sx, sy, sw, len);
    }
  };
  const rivetRow = (xs, w, y, step, r) => {
    for (let px = step / 2; px < w; px += step) {
      for (const [x, kind] of xs) {
        if (kind === "colour") {
          x.fillStyle = "rgba(60,50,44,0.55)"; x.beginPath(); x.arc(px, y, r + 0.8, 0, 7); x.fill();
          x.fillStyle = "rgba(255,255,255,0.35)"; x.beginPath(); x.arc(px - r * 0.3, y - r * 0.3, r * 0.45, 0, 7); x.fill();
        } else if (kind === "bump") {
          const g = x.createRadialGradient(px, y, 0, px, y, r + 1);
          g.addColorStop(0, "#fff"); g.addColorStop(1, "rgba(255,255,255,0)");
          x.fillStyle = g; x.beginPath(); x.arc(px, y, r + 1, 0, 7); x.fill();
        }
      }
    }
  };
  const seamH = (x, kind, w, y) => {
    if (kind === "colour") {
      x.fillStyle = "rgba(70,58,50,0.55)"; x.fillRect(0, y - 1, w, 2);
      x.fillStyle = "rgba(255,255,255,0.25)"; x.fillRect(0, y + 1, w, 1);
    } else if (kind === "bump") { x.fillStyle = "#3a3a3a"; x.fillRect(0, y - 1.5, w, 3); }
    else { x.fillStyle = "rgba(255,255,255,0.5)"; x.fillRect(0, y - 2, w, 4); }
  };
  const seamV = (x, kind, px, y0, y1) => {
    if (kind === "colour") {
      x.fillStyle = "rgba(70,58,50,0.5)"; x.fillRect(px - 1, y0, 2, y1 - y0);
      x.fillStyle = "rgba(255,255,255,0.22)"; x.fillRect(px + 1, y0, 1, y1 - y0);
    } else if (kind === "bump") { x.fillStyle = "#3a3a3a"; x.fillRect(px - 1.5, y0, 3, y1 - y0); }
    else { x.fillStyle = "rgba(255,255,255,0.5)"; x.fillRect(px - 2, y0, 4, y1 - y0); }
  };

  // ---- hull: off-white painted panels, rivets, stencils, grime, scorch at the base ----
  const hull = (() => {
    const W = 1024, H = 1024;
    const [cc, c] = canvas(W, H), [bc, b] = canvas(W, H), [rc, r] = canvas(W, H);
    c.fillStyle = "#e6ded1"; c.fillRect(0, 0, W, H);
    mottle(c, W, H, 520, ["255,255,250", "196,184,166", "214,203,186"], 20, 90, 0.35);
    b.fillStyle = "#808080"; b.fillRect(0, 0, W, H);
    r.fillStyle = "rgb(200,200,200)"; r.fillRect(0, 0, W, H); // roughness ~0.78
    mottle(r, W, H, 200, ["235,235,235", "175,175,175"], 30, 120, 0.4);

    const rows = [0.12, 0.32, 0.52, 0.7, 0.86].map((v) => H - v * H); // canvas y (v=0 at bottom)
    for (const y of rows) {
      for (const [x, k] of [[c, "colour"], [b, "bump"], [r, "rough"]]) seamH(x, k, W, y);
      rivetRow([[c, "colour"], [b, "bump"]], W, y - 8, 22, 2.6);
    }
    // vertical seams, staggered per band
    const bands = [H, ...rows, 0];
    bands.slice(0, -1).forEach((yTop, i) => {
      const yBot = bands[i + 1], off = (i % 2) * (W / 12);
      for (let k = 0; k < 6; k++) {
        const px = (off + (k * W) / 6) % W;
        for (const [x, kk] of [[c, "colour"], [b, "bump"], [r, "rough"]]) seamV(x, kk, px, yBot, yTop);
        for (let py = yBot + 14; py < yTop - 8; py += 22) {
          for (const [x, kind] of [[c, "colour"], [b, "bump"]]) {
            if (kind === "colour") { x.fillStyle = "rgba(60,50,44,0.5)"; x.beginPath(); x.arc(px + 8, py, 2.4, 0, 7); x.fill(); }
            else { x.fillStyle = "#e0e0e0"; x.beginPath(); x.arc(px + 8, py, 3, 0, 7); x.fill(); }
          }
        }
      }
    });
    // access hatch
    {
      const hx = W * 0.6, hy = H - 0.62 * H, hw = 120, hh = 150;
      c.strokeStyle = "rgba(70,58,50,0.6)"; c.lineWidth = 3; c.strokeRect(hx, hy, hw, hh);
      b.strokeStyle = "#2c2c2c"; b.lineWidth = 4; b.strokeRect(hx, hy, hw, hh);
      for (const [px, py] of [[hx + 10, hy + 10], [hx + hw - 10, hy + 10], [hx + 10, hy + hh - 10], [hx + hw - 10, hy + hh - 10]]) {
        c.fillStyle = "rgba(60,50,44,0.6)"; c.beginPath(); c.arc(px, py, 4, 0, 7); c.fill();
        b.fillStyle = "#ddd"; b.beginPath(); b.arc(px, py, 4, 0, 7); b.fill();
      }
      c.fillStyle = "rgba(150,40,22,0.85)"; c.font = "bold 20px Arial, sans-serif"; c.fillText("ACCESS", hx + 22, hy + hh / 2 + 7);
    }
    // stencilled name running up the side, and a hazard band near the base
    c.save();
    c.translate(W * 0.25, H - 0.16 * H); c.rotate(-Math.PI / 2);
    c.fillStyle = "rgba(160,42,24,0.9)"; c.font = "900 112px Impact, 'Arial Black', sans-serif"; c.fillText("ECHO", 0, 0);
    c.font = "bold 28px Arial, sans-serif"; c.fillStyle = "rgba(60,45,40,0.75)"; c.fillText("STATION SHUTTLE 01", 6, 36);
    c.restore();
    c.fillStyle = "rgba(60,45,40,0.7)"; c.font = "bold 22px Arial, sans-serif"; c.fillText("NO STEP", W * 0.78, H - 0.2 * H);
    // worn paint chips showing bare metal
    for (let i = 0; i < 90; i++) {
      const px = rnd() * W, py = rnd() * H, s = 2 + rnd() * 7;
      c.fillStyle = `rgba(140,134,126,${(0.4 + rnd() * 0.5).toFixed(2)})`;
      c.beginPath(); c.moveTo(px, py);
      for (let k = 0; k < 5; k++) c.lineTo(px + (rnd() - 0.5) * s * 2, py + (rnd() - 0.5) * s * 2);
      c.fill();
      r.fillStyle = "rgba(120,120,120,0.8)"; r.fillRect(px - s / 2, py - s / 2, s, s);
    }
    streaks(c, W, H, rows.map((y) => y + 6), "70,55,45", 260);
    // scorch from engine heat at the bottom
    const sg = c.createLinearGradient(0, H, 0, H - 0.3 * H);
    sg.addColorStop(0, "rgba(28,18,14,0.92)"); sg.addColorStop(0.35, "rgba(60,38,26,0.5)"); sg.addColorStop(1, "rgba(80,50,30,0)");
    c.fillStyle = sg; c.fillRect(0, H - 0.3 * H, W, 0.3 * H);
    for (let i = 0; i < 140; i++) {
      const px = rnd() * W, py = H - rnd() * 0.22 * H, rr = 10 + rnd() * 40;
      const g = c.createRadialGradient(px, py, 0, px, py, rr);
      g.addColorStop(0, `rgba(30,20,15,${(0.15 + rnd() * 0.3).toFixed(2)})`); g.addColorStop(1, "rgba(30,20,15,0)");
      c.fillStyle = g; c.fillRect(px - rr, py - rr, rr * 2, rr * 2);
    }
    const rg = r.createLinearGradient(0, H, 0, H - 0.25 * H);
    rg.addColorStop(0, "rgba(250,250,250,0.9)"); rg.addColorStop(1, "rgba(250,250,250,0)");
    r.fillStyle = rg; r.fillRect(0, H - 0.25 * H, W, 0.25 * H);
    grain(c, W, H, 14); grain(b, W, H, 18);
    return { map: finish(cc, true), bump: finish(bc), rough: finish(rc) };
  })();

  // ---- red paint (nose cone): sun-faded, chipped, with ring seams ----
  const paint = (W, H, rings, chipCount) => {
    const [cc, c] = canvas(W, H), [bc, b] = canvas(W, H), [rc, r] = canvas(W, H);
    c.fillStyle = "#a8301c"; c.fillRect(0, 0, W, H);
    mottle(c, W, H, 300, ["196,72,48", "120,28,16", "150,40,24"], 14, 70, 0.45);
    const fade = c.createLinearGradient(0, H, 0, 0);
    fade.addColorStop(0, "rgba(255,200,180,0)"); fade.addColorStop(1, "rgba(255,200,180,0.18)");
    c.fillStyle = fade; c.fillRect(0, 0, W, H);
    b.fillStyle = "#808080"; b.fillRect(0, 0, W, H);
    r.fillStyle = "rgb(185,185,185)"; r.fillRect(0, 0, W, H);
    mottle(r, W, H, 120, ["225,225,225", "160,160,160"], 20, 80, 0.4);
    for (const v of rings) {
      const y = H - v * H;
      for (const [x, k] of [[c, "colour"], [b, "bump"], [r, "rough"]]) seamH(x, k, W, y);
      rivetRow([[c, "colour"], [b, "bump"]], W, y + 7, W / 24, 2.2);
    }
    for (let i = 0; i < chipCount; i++) {
      const px = rnd() * W, py = rnd() * H, s = 2 + rnd() * 9;
      c.fillStyle = `rgba(150,144,136,${(0.55 + rnd() * 0.4).toFixed(2)})`;
      b.fillStyle = "#606060"; r.fillStyle = "rgba(110,110,110,0.9)";
      for (const x of [c, b, r]) {
        x.beginPath(); x.moveTo(px, py);
        for (let k = 0; k < 6; k++) x.lineTo(px + (rnd() - 0.5) * s * 2, py + (rnd() - 0.5) * s * 2);
        x.fill();
      }
    }
    streaks(c, W, H, rings.map((v) => H - v * H + 4), "50,20,12", 120);
    grain(c, W, H, 12); grain(b, W, H, 16);
    return { cc, bc, rc };
  };
  const noseP = paint(512, 512, [0.3, 0.62], 70);
  const nose = { map: finish(noseP.cc, true), bump: finish(noseP.bc), rough: finish(noseP.rc) };

  const finP = paint(512, 512, [0.5], 110);
  {
    // scorched trailing edges on the fins
    const c = finP.cc.getContext("2d");
    const g = c.createLinearGradient(0, 512, 0, 300);
    g.addColorStop(0, "rgba(30,18,12,0.75)"); g.addColorStop(1, "rgba(30,18,12,0)");
    c.fillStyle = g; c.fillRect(0, 300, 512, 212);
  }
  const fin = { map: finish(finP.cc, true), bump: finish(finP.bc), rough: finish(finP.rc) };
  for (const t of [fin.map, fin.bump, fin.rough]) t.repeat.set(1.2, 0.7);

  // ---- nozzle: brushed steel with heat-tint bands ----
  const nozzle = (() => {
    const W = 256, H = 256;
    const [cc, c] = canvas(W, H), [bc, b] = canvas(W, H);
    const g = c.createLinearGradient(0, 0, 0, H); // v=0 (top of canvas after flip = exit)... bands blend anyway
    g.addColorStop(0, "#3a3532"); g.addColorStop(0.35, "#5b4a6e"); g.addColorStop(0.55, "#a07a3c");
    g.addColorStop(0.75, "#6a5a4a"); g.addColorStop(1, "#2c2826");
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 400; i++) { c.fillStyle = `rgba(255,255,255,${(rnd() * 0.06).toFixed(3)})`; c.fillRect(rnd() * W, rnd() * H, 1, 6 + rnd() * 20); }
    b.fillStyle = "#808080"; b.fillRect(0, 0, W, H);
    for (let y = 16; y < H; y += 32) { b.fillStyle = "#555"; b.fillRect(0, y, W, 3); c.fillStyle = "rgba(0,0,0,0.35)"; c.fillRect(0, y, W, 2); }
    grain(c, W, H, 18);
    return { map: finish(cc, true), bump: finish(bc) };
  })();

  // ---- window frame: worn gunmetal with bolts ----
  const ring = (() => {
    const W = 512, H = 128;
    const [cc, c] = canvas(W, H), [bc, b] = canvas(W, H), [rc, r] = canvas(W, H);
    c.fillStyle = "#3a3634"; c.fillRect(0, 0, W, H);
    mottle(c, W, H, 160, ["90,84,80", "24,20,20", "70,60,52"], 6, 26, 0.5);
    b.fillStyle = "#808080"; b.fillRect(0, 0, W, H);
    r.fillStyle = "rgb(150,150,150)"; r.fillRect(0, 0, W, H);
    // scratches and worn edges
    for (let i = 0; i < 220; i++) {
      const x0 = rnd() * W, y0 = rnd() * H, len = 4 + rnd() * 24;
      c.strokeStyle = `rgba(190,180,170,${(0.1 + rnd() * 0.3).toFixed(2)})`; c.lineWidth = 0.6 + rnd();
      c.beginPath(); c.moveTo(x0, y0); c.lineTo(x0 + len, y0 + (rnd() - 0.5) * 6); c.stroke();
      r.strokeStyle = "rgba(90,90,90,0.6)"; r.beginPath(); r.moveTo(x0, y0); r.lineTo(x0 + len, y0); r.stroke();
    }
    // inner and outer lips (tube angle v: 0 outer edge, 0.25 front face, 0.5 inner edge)
    for (const v of [0.08, 0.42]) {
      const y = H - v * H;
      c.fillStyle = "rgba(180,170,160,0.35)"; c.fillRect(0, y - 1, W, 2);
      b.fillStyle = "#b0b0b0"; b.fillRect(0, y - 2, W, 4);
    }
    // eight bolts on the front face
    const yb = H - 0.25 * H;
    for (let k = 0; k < 8; k++) {
      const x0 = (k + 0.5) * (W / 8);
      for (const off of [0, W, -W]) {
        const gx = x0 + off;
        const g = c.createRadialGradient(gx - 2, yb - 3, 0, gx, yb, 9);
        g.addColorStop(0, "#c9c2ba"); g.addColorStop(0.5, "#6f6862"); g.addColorStop(1, "#1b1817");
        c.fillStyle = g; c.beginPath(); c.arc(gx, yb, 8, 0, 7); c.fill();
        c.strokeStyle = "rgba(20,16,15,0.9)"; c.lineWidth = 2;
        c.beginPath(); c.moveTo(gx - 5, yb); c.lineTo(gx + 5, yb); c.stroke();
        const bg = b.createRadialGradient(gx, yb, 0, gx, yb, 10);
        bg.addColorStop(0, "#fff"); bg.addColorStop(0.8, "#bbb"); bg.addColorStop(1, "#808080");
        b.fillStyle = bg; b.beginPath(); b.arc(gx, yb, 10, 0, 7); b.fill();
        r.fillStyle = "rgb(90,90,90)"; r.beginPath(); r.arc(gx, yb, 8, 0, 7); r.fill();
      }
    }
    streaks(c, W, H, [H * 0.3, H * 0.6], "15,10,8", 60);
    grain(c, W, H, 16); grain(b, W, H, 10);
    return { map: finish(cc, true), bump: finish(bc), rough: finish(rc) };
  })();

  return { hull, nose, fin, nozzle, ring };
}


// ---------- textures for the planet, its ring and the asteroids ----------
function makeSpaceTextures(aniso) {
  let seed = 99;
  const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const mk = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return [c, c.getContext("2d")]; };
  const fin = (c, srgb) => { const t = new THREE.CanvasTexture(c); t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = Math.min(8, aniso || 1); return t; };

  // planet: swirling ember and violet bands
  const [pc, p] = mk(1024, 512);
  const bands = ["#5a1a12", "#9a3a1c", "#d8662e", "#f0a13a", "#7a2a40", "#3a1430", "#b44a22", "#e8885a"];
  let y = 0;
  while (y < 512) {
    const hgt = 8 + rnd() * 40;
    p.fillStyle = bands[Math.floor(rnd() * bands.length)];
    p.fillRect(0, y, 1024, hgt + 2);
    y += hgt;
  }
  p.filter = "blur(6px)"; p.drawImage(pc, 0, 0); p.filter = "none";
  for (let i = 0; i < 2400; i++) { // turbulence streaks
    const x = rnd() * 1024, yy = rnd() * 512, len = 20 + rnd() * 120;
    p.strokeStyle = `rgba(${rnd() < 0.5 ? "255,200,150" : "60,10,20"},${(rnd() * 0.12).toFixed(3)})`;
    p.lineWidth = 1 + rnd() * 3;
    p.beginPath(); p.moveTo(x, yy); p.quadraticCurveTo(x + len / 2, yy + (rnd() - 0.5) * 14, x + len, yy); p.stroke();
  }
  const sx = 640, sy = 300; // a big storm spot
  const sg = p.createRadialGradient(sx, sy, 0, sx, sy, 60);
  sg.addColorStop(0, "rgba(255,230,180,0.9)"); sg.addColorStop(0.5, "rgba(220,90,40,0.7)"); sg.addColorStop(1, "rgba(220,90,40,0)");
  p.save(); p.translate(sx, sy); p.scale(1.8, 1); p.translate(-sx, -sy); p.fillStyle = sg; p.fillRect(sx - 70, sy - 70, 140, 140); p.restore();

  // ring: thin bands with gaps
  const [rc, r] = mk(512, 4);
  for (let x = 0; x < 512; x++) {
    const a = Math.max(0, 0.25 + 0.6 * Math.sin(x * 0.11) * Math.sin(x * 0.033 + 1) + (rnd() - 0.5) * 0.3) * (x < 20 || x > 490 ? 0.3 : 1);
    const cgap = x > 300 && x < 318 ? 0.05 : 1;
    r.fillStyle = `rgba(${230 - x * 0.1},${170 - x * 0.15},${120},${(a * cgap).toFixed(3)})`;
    r.fillRect(x, 0, 1, 4);
  }

  // rock: grey-brown with craters
  const [kc, k] = mk(512, 512), [bc, b] = mk(512, 512);
  k.fillStyle = "#5e524c"; k.fillRect(0, 0, 512, 512);
  b.fillStyle = "#808080"; b.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 900; i++) {
    const x = rnd() * 512, yy = rnd() * 512, rr = 2 + rnd() * 18;
    const g = k.createRadialGradient(x, yy, 0, x, yy, rr);
    const col = rnd() < 0.5 ? "120,104,92" : "40,32,30";
    g.addColorStop(0, `rgba(${col},0.5)`); g.addColorStop(1, `rgba(${col},0)`);
    k.fillStyle = g; k.fillRect(x - rr, yy - rr, rr * 2, rr * 2);
  }
  for (let i = 0; i < 70; i++) { // craters: dark bowl with a bright rim
    const x = rnd() * 512, yy = rnd() * 512, rr = 4 + rnd() * 22;
    k.fillStyle = "rgba(30,24,22,0.55)"; k.beginPath(); k.arc(x, yy, rr, 0, 7); k.fill();
    k.strokeStyle = "rgba(170,150,135,0.5)"; k.lineWidth = 2; k.beginPath(); k.arc(x - 1, yy - 1, rr, 3.6, 6.0); k.stroke();
    const bg = b.createRadialGradient(x, yy, 0, x, yy, rr * 1.2);
    bg.addColorStop(0, "#303030"); bg.addColorStop(0.8, "#707070"); bg.addColorStop(0.9, "#c0c0c0"); bg.addColorStop(1, "#808080");
    b.fillStyle = bg; b.beginPath(); b.arc(x, yy, rr * 1.2, 0, 7); b.fill();
  }
  // ---- station textures ----
  // hull: warm grey panels with seams and rivets
  const panels = (w, h, base, cols, rows) => {
    const [c, x] = mk(w, h), [bb, y] = mk(w, h);
    x.fillStyle = base; x.fillRect(0, 0, w, h);
    y.fillStyle = "#808080"; y.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      const px = rnd() * w, py = rnd() * h, rr = 6 + rnd() * 30;
      const gg = x.createRadialGradient(px, py, 0, px, py, rr);
      const cl = rnd() < 0.5 ? "255,240,225" : "40,30,30";
      gg.addColorStop(0, `rgba(${cl},0.12)`); gg.addColorStop(1, `rgba(${cl},0)`);
      x.fillStyle = gg; x.fillRect(px - rr, py - rr, rr * 2, rr * 2);
    }
    for (let i = 0; i <= cols; i++) { const px = (i * w) / cols; x.fillStyle = "rgba(30,24,22,0.55)"; x.fillRect(px - 1, 0, 2, h); y.fillStyle = "#404040"; y.fillRect(px - 1.5, 0, 3, h); }
    for (let j = 0; j <= rows; j++) { const py = (j * h) / rows; x.fillStyle = "rgba(30,24,22,0.55)"; x.fillRect(0, py - 1, w, 2); y.fillStyle = "#404040"; y.fillRect(0, py - 1.5, w, 3); }
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      if (rnd() < 0.25) { x.fillStyle = `rgba(${rnd() < 0.5 ? "180,60,30" : "60,50,48"},0.35)`; x.fillRect((i * w) / cols + 2, (j * h) / rows + 2, w / cols - 4, h / rows - 4); }
      for (const [px, py] of [[(i * w) / cols + 5, (j * h) / rows + 5], [((i + 1) * w) / cols - 5, ((j + 1) * h) / rows - 5]]) {
        x.fillStyle = "rgba(20,16,15,0.6)"; x.beginPath(); x.arc(px, py, 1.6, 0, 7); x.fill();
        y.fillStyle = "#d0d0d0"; y.beginPath(); y.arc(px, py, 2, 0, 7); y.fill();
      }
    }
    return [c, bb];
  };
  const [hc, hb] = panels(512, 256, "#8d7a70", 12, 6);

  // habitat ring: panels plus rows of lit windows (u runs round the ring, v round the tube)
  const [ac, ab] = panels(2048, 128, "#9a8478", 64, 4);
  const [gc, gl] = mk(2048, 128);
  gl.fillStyle = "#000"; gl.fillRect(0, 0, 2048, 128);
  const ax = ac.getContext("2d");
  for (const vRow of [0.0, 0.18, 0.32, 0.92]) {        // outer face and front face rows
    const y0 = 128 - vRow * 128 - 4;
    for (let px = 6; px < 2048; px += 14) {
      const lit = rnd() < 0.72;
      const warm = rnd() < 0.7;
      ax.fillStyle = "#1a1416"; ax.fillRect(px, y0, 8, 6);
      if (lit) {
        const colr = warm ? `rgb(255,${190 + Math.floor(rnd() * 50)},120)` : "rgb(150,235,240)";
        gl.fillStyle = colr; gl.fillRect(px + 1, y0 + 1, 6, 4);
        ax.fillStyle = colr; ax.fillRect(px + 1, y0 + 1, 6, 4);
      }
    }
  }
  // solar panels: dark blue-violet cells with a silver grid
  const [sc, s2] = mk(512, 256);
  s2.fillStyle = "#c8c2bc"; s2.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 16; i++) for (let j = 0; j < 8; j++) {
    const gx = i * 32, gy = j * 32;
    const gg = s2.createLinearGradient(gx, gy, gx + 32, gy + 32);
    gg.addColorStop(0, "#1c1f5a"); gg.addColorStop(0.5, "#2a2470"); gg.addColorStop(1, "#141640");
    s2.fillStyle = gg; s2.fillRect(gx + 2, gy + 2, 28, 28);
    s2.strokeStyle = "rgba(160,170,255,0.25)"; s2.lineWidth = 1;
    s2.beginPath(); s2.moveTo(gx + 16, gy + 2); s2.lineTo(gx + 16, gy + 30); s2.stroke();
  }
  // truss: open lattice (alpha cut-out)
  const [tc, t2] = mk(128, 256);
  t2.clearRect(0, 0, 128, 256);
  t2.strokeStyle = "#9a9088"; t2.lineWidth = 7;
  t2.strokeRect(4, -4, 120, 264);
  for (let y = 0; y < 256; y += 64) { t2.beginPath(); t2.moveTo(4, y); t2.lineTo(124, y + 64); t2.moveTo(124, y); t2.lineTo(4, y + 64); t2.stroke(); }
  for (let y = 0; y <= 256; y += 64) { t2.beginPath(); t2.moveTo(0, y); t2.lineTo(128, y); t2.stroke(); }
  const truss = fin(tc, true); truss.repeat.set(3, 2);

  return {
    planet: fin(pc, true), ring: fin(rc, true), rock: fin(kc, true), rockBump: fin(bc, false),
    hull: fin(hc, true), hullBump: fin(hb, false),
    hab: fin(ac, true), habBump: fin(ab, false), habGlow: fin(gc, true),
    solar: fin(sc, true), truss,
  };
}


// ---------- asteroid geometry: a merged (smooth) sphere, squashed, lumpy, with bowl craters and raised rims ----------
function makeAsteroidGeometry(detail) {
  const base = new THREE.IcosahedronGeometry(1, detail);
  // merge duplicate vertices so normals are smooth across faces
  const src = base.attributes.position;
  const map = new Map(), verts = [], index = [];
  for (let i = 0; i < src.count; i++) {
    const x = src.getX(i), y = src.getY(i), z = src.getZ(i);
    const key = Math.round(x * 1e4) + "," + Math.round(y * 1e4) + "," + Math.round(z * 1e4);
    let id = map.get(key);
    if (id === undefined) { id = verts.length / 3; map.set(key, id); verts.push(x, y, z); }
    index.push(id);
  }
  const n = verts.length / 3;
  const pos = new Float32Array(verts);
  const col = new Float32Array(n * 3);

  const ph = Math.random() * 10, f = 1.3 + Math.random() * 1.2;
  const squash = [0.75 + Math.random() * 0.5, 0.6 + Math.random() * 0.45, 0.75 + Math.random() * 0.5];
  const craters = [];
  const cc = 5 + Math.floor(Math.random() * 6);
  for (let k = 0; k < cc; k++) {
    const d = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
    craters.push({ d, r: 0.18 + Math.random() * 0.42, depth: 0.08 + Math.random() * 0.14 });
  }
  const v = new THREE.Vector3();
  const tint = 0.85 + Math.random() * 0.3;
  for (let i = 0; i < n; i++) {
    v.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]).normalize();
    // broad smooth lumps
    let r = 1 + 0.16 * Math.sin(v.x * f + ph) * Math.cos(v.y * f * 1.2 + ph * 0.7) + 0.07 * Math.sin(v.z * f * 2.1 + v.x * 1.7 + ph);
    let shade = 0;
    for (const c of craters) {
      const t = Math.acos(Math.max(-1, Math.min(1, v.dot(c.d)))) / c.r;
      if (t < 1.35) {
        if (t < 1) { r -= c.depth * (1 - t * t); shade -= 0.35 * (1 - t); } // the bowl
        const rim = Math.exp(-Math.pow((t - 1) / 0.18, 2));
        r += c.depth * 0.45 * rim; shade += 0.25 * rim;                     // the raised lip
      }
    }
    pos[i * 3] = v.x * r * squash[0]; pos[i * 3 + 1] = v.y * r * squash[1]; pos[i * 3 + 2] = v.z * r * squash[2];
    // grey-brown rock, darker in the craters, lighter on the rims
    const g = Math.max(0.05, Math.min(1, (0.2 + shade * 0.55) * tint));
    col[i * 3] = g * 1.0; col[i * 3 + 1] = g * 0.9; col[i * 3 + 2] = g * 0.84;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  base.dispose();
  return geo;
}
