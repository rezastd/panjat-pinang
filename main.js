import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ============ CONFIG ============
const POLE_H = 13;                 // pole height (m)
const POLE_R = 0.30;
const TIME_LIMIT = 120;            // seconds
const GREASE_ZONES = [[4, 6], [9, 11]]; // extra-slippery height bands
const TEAM_NAMES = ['Kamu (Tim Merah)', 'Tim Putih', 'Tim Garuda'];
const $ = (id) => document.getElementById(id);

// ============ AUDIO (WebAudio oscillator, no assets) ============
let AC = null;
function audio() {
  try {
    if (!AC) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      AC = new Ctx();
    }
    if (AC && AC.state === 'suspended') AC.resume();
  } catch { /* audio unavailable — game must still start */ }
  return AC;
}
function tone(freq, dur = 0.12, type = 'square', vol = 0.08, when = 0, slideTo = null) {
  try {
    const ac = audio();
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, ac.currentTime + when);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ac.currentTime + when + dur);
    g.gain.setValueAtTime(vol, ac.currentTime + when);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + when + dur);
    o.connect(g).connect(ac.destination);
    o.start(ac.currentTime + when);
    o.stop(ac.currentTime + when + dur + 0.02);
  } catch (e) { /* audio unavailable */ }
}
const sfx = {
  stroke() { tone(300 + Math.random() * 200, 0.09, 'square', 0.05, 0, 700); },
  slip() { tone(600, 0.35, 'sawtooth', 0.07, 0, 120); },
  warn() { tone(880, 0.1, 'square', 0.05); },
  click() { tone(520, 0.06, 'sine', 0.06); },
  fanfare() {
    [523, 523, 659, 784, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.1, i * 0.16));
  },
  sad() { [400, 350, 300, 220].forEach((f, i) => tone(f, 0.25, 'sawtooth', 0.06, i * 0.2)); },
};

// ============ RENDERER / SCENE / CAMERA ============
const canvas = $('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87b5e0);
scene.fog = new THREE.Fog(0x87b5e0, 28, 75);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(5, 3, 11);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.maxPolarAngle = Math.PI * 0.495;
controls.maxDistance = 40;
let followCam = true;

// ============ LIGHTS: hemisphere + day sun + night lamp ============
scene.add(new THREE.HemisphereLight(0xbfd9ff, 0x6b5a3e, 0.75));

const sun = new THREE.DirectionalLight(0xfff2d9, 1.6);
sun.position.set(14, 22, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -20; sun.shadow.camera.right = 20;
sun.shadow.camera.top = 24; sun.shadow.camera.bottom = -6;
sun.shadow.camera.far = 60;
sun.shadow.bias = -0.0004;
scene.add(sun);

const lampLight = new THREE.PointLight(0xffd27a, 25, 22, 1.8);
lampLight.position.set(-7.5, 6.4, -6);
lampLight.castShadow = false;
scene.add(lampLight);

// ============ CANVAS TEXTURE HELPERS ============
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const groundTex = canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = '#5d8f4e'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(${40 + Math.random() * 60 | 0},${110 + Math.random() * 60 | 0},${40 + Math.random() * 40 | 0},0.5)`;
    g.fillRect(Math.random() * w, Math.random() * h, 3, 3 + Math.random() * 5);
  }
  for (let i = 0; i < 14; i++) { // dirt patches
    g.fillStyle = 'rgba(122,90,60,0.35)';
    g.beginPath();
    g.ellipse(Math.random() * w, Math.random() * h, 12 + Math.random() * 30, 8 + Math.random() * 20, Math.random() * 3, 0, 7);
    g.fill();
  }
});
groundTex.wrapS = groundTex.wrapT = THREE.RepeatWrapping;
groundTex.repeat.set(8, 8);

function labelTex(text, bg, fg = '#fff') {
  return canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.strokeStyle = fg; g.lineWidth = 8; g.strokeRect(4, 4, w - 8, h - 8);
    g.fillStyle = fg; g.font = 'bold 44px sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2);
  });
}

// ============ GROUND + MUD PITS ============
{
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(45, 48),
    new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.95, metalness: 0 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
}
const mudMat = new THREE.MeshStandardMaterial({ color: 0x5a3d24, roughness: 0.55, metalness: 0.05 });
const puddleMat = new THREE.MeshStandardMaterial({ color: 0x7a5a36, roughness: 0.15, metalness: 0.35 });
for (const px of [-5.5, 0, 5.5]) {
  const mud = new THREE.Mesh(new THREE.CircleGeometry(1.7, 28), mudMat);
  mud.rotation.x = -Math.PI / 2; mud.position.set(px, 0.01, 0);
  mud.receiveShadow = true; scene.add(mud);
  const pud = new THREE.Mesh(new THREE.CircleGeometry(0.9, 24), puddleMat);
  pud.rotation.x = -Math.PI / 2; pud.position.set(px, 0.02, 0);
  pud.receiveShadow = true; scene.add(pud);
}

// ============ POLES (greased pinang trunks) + PRIZE TREES ============
const barkMat = new THREE.MeshPhysicalMaterial({
  color: 0x8a6a45, roughness: 0.32, metalness: 0.05,
  clearcoat: 1.0, clearcoatRoughness: 0.25, // grease sheen
});
const greaseMat = new THREE.MeshStandardMaterial({
  color: 0xd8c25a, roughness: 0.1, metalness: 0.4,
  transparent: true, opacity: 0.55, emissive: 0x554411, emissiveIntensity: 0.3,
});
function buildPrizeTree(x) {
  const g = new THREE.Group();
  // pole
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.24, POLE_R, POLE_H, 18), barkMat);
  pole.position.y = POLE_H / 2;
  pole.castShadow = pole.receiveShadow = true;
  g.add(pole);
  // grease bands
  for (const [a, b] of GREASE_ZONES) {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.33, b - a, 18, 1, true), greaseMat);
    band.position.y = (a + b) / 2;
    g.add(band);
  }
  // platform wheel at top
  const wheel = new THREE.Mesh(
    new THREE.CylinderGeometry(1.5, 1.5, 0.12, 20),
    new THREE.MeshStandardMaterial({ color: 0x6e4f2c, roughness: 0.8 })
  );
  wheel.position.y = POLE_H + 0.1; wheel.castShadow = true;
  g.add(wheel);
  // prize boxes around the wheel
  const prizes = [
    { t: 'TV', bg: '#1d4ed8', a: 0 }, { t: 'KULKAS', bg: '#0e7490', a: 1.1 },
    { t: 'BERAS', bg: '#15803d', a: 2.1 }, { t: 'SEPEDA', bg: '#b45309', a: 3.2 },
    { t: 'HP', bg: '#7c3aed', a: 4.2 }, { t: 'KIPAS', bg: '#be123c', a: 5.2 },
  ];
  for (const p of prizes) {
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.55, 0.55),
      new THREE.MeshStandardMaterial({ map: labelTex(p.t, p.bg), roughness: 0.6 })
    );
    box.position.set(Math.cos(p.a) * 1.15, POLE_H + 0.55, Math.sin(p.a) * 1.15);
    box.rotation.y = -p.a;
    box.castShadow = true;
    g.add(box);
  }
  // simple bike frame: 2 wheels + frame tubes
  const bikeMat = new THREE.MeshStandardMaterial({ color: 0xe11d2e, roughness: 0.4, metalness: 0.6 });
  const tyreMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
  for (const s of [-0.45, 0.45]) {
    const wheelM = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.06, 10, 22), tyreMat);
    wheelM.position.set(s, POLE_H + 1.35, 0); wheelM.castShadow = true;
    g.add(wheelM);
  }
  const frame = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.0, 8), bikeMat);
  frame.rotation.z = Math.PI / 2; frame.position.set(0, POLE_H + 1.35, 0);
  g.add(frame);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.1, 8), bikeMat);
  post.position.set(0, POLE_H + 1.15, 0); post.rotation.x = 0.2;
  g.add(post);
  // mini red-white flags on top
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.0, 6),
      new THREE.MeshStandardMaterial({ color: 0xdddddd }));
    stick.position.set(Math.cos(a) * 1.45, POLE_H + 1.0, Math.sin(a) * 1.45);
    g.add(stick);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.28),
      new THREE.MeshStandardMaterial({ map: flagTex(), side: THREE.DoubleSide, roughness: 0.7 }));
    flag.position.set(Math.cos(a) * 1.45 + 0.22, POLE_H + 1.32, Math.sin(a) * 1.45);
    flag.rotation.y = -a + Math.PI / 2;
    g.add(flag);
  }
  g.position.x = x;
  scene.add(g);
  return g;
}
function flagTex() {
  return canvasTex(64, 42, (g, w, h) => {
    g.fillStyle = '#e11d2e'; g.fillRect(0, 0, w, h / 2);
    g.fillStyle = '#ffffff'; g.fillRect(0, h / 2, w, h / 2);
  });
}
const poleGroups = [buildPrizeTree(-5.5), buildPrizeTree(0), buildPrizeTree(5.5)];

// ============ 17-AGUSTUS DECOR: gate, bunting, big flags, lamp ============
{
  const bamboo = new THREE.MeshStandardMaterial({ color: 0x9a7b4f, roughness: 0.8 });
  // entrance gate behind the arena
  for (const gx of [-4.2, 4.2]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 5.2, 10), bamboo);
    post.position.set(gx, 2.6, -9); post.castShadow = true;
    scene.add(post);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.3, 0.3), bamboo);
  beam.position.set(0, 5.1, -9); beam.castShadow = true;
  scene.add(beam);
  const banner = new THREE.Mesh(new THREE.PlaneGeometry(8.2, 1.2),
    new THREE.MeshStandardMaterial({
      map: canvasTex(1024, 150, (g, w, h) => {
        g.fillStyle = '#e11d2e'; g.fillRect(0, 0, w, h);
        g.fillStyle = '#fff'; g.fillRect(0, h / 2 - 14, w, 28);
        g.fillStyle = '#fff'; g.font = 'bold 64px sans-serif';
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillStyle = '#e11d2e';
        g.fillText('★ MERDEKA! 17 AGUSTUS ★', w / 2, h / 2);
      }), side: THREE.DoubleSide, roughness: 0.7,
    }));
  banner.position.set(0, 4.2, -9);
  scene.add(banner);
  // 4 tall bamboo masts for bunting
  const mastTops = [];
  for (const [mx, mz] of [[-10, 6], [10, 6], [-10, -7], [10, -7]]) {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 8, 8), bamboo);
    mast.position.set(mx, 4, mz); mast.castShadow = true;
    scene.add(mast);
    mastTops.push(new THREE.Vector3(mx, 7.9, mz));
  }
  // bunting strings: catenary rows of red-white triangles
  const triGeo = new THREE.BufferGeometry();
  triGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    -0.16, 0, 0, 0.16, 0, 0, 0, -0.34, 0,
  ]), 3));
  triGeo.computeVertexNormals();
  const redMat = new THREE.MeshStandardMaterial({ color: 0xe11d2e, side: THREE.DoubleSide, roughness: 0.7 });
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, roughness: 0.7 });
  const lineMat = new THREE.LineBasicMaterial({ color: 0x333333 });
  const pairs = [[mastTops[0], mastTops[1]], [mastTops[2], mastTops[3]], [mastTops[0], mastTops[2]], [mastTops[1], mastTops[3]]];
  pairs.forEach(([a, b], pi) => {
    const pts = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      const p = a.clone().lerp(b, t);
      p.y -= Math.sin(t * Math.PI) * 1.1;
      pts.push(p);
    }
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat));
    for (let i = 1; i < 24; i += 2) {
      const tri = new THREE.Mesh(triGeo, ((i + pi) % 2 === 0) ? redMat : whiteMat);
      tri.position.copy(pts[i]);
      scene.add(tri);
    }
  });
  // 2 big Indonesian flags on poles
  for (const fx of [-12, 12]) {
    const fp = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 9, 8),
      new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.5, metalness: 0.4 }));
    fp.position.set(fx, 4.5, -4); fp.castShadow = true;
    scene.add(fp);
    const big = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.6, 8, 1),
      new THREE.MeshStandardMaterial({ map: flagTex(), side: THREE.DoubleSide, roughness: 0.8 }));
    big.position.set(fx + 1.25, 7.8, -4);
    big.userData.isBigFlag = true;
    scene.add(big);
  }
  // night lamp post (decorative + real point light already placed above)
  const lampPost = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 6.4, 8),
    new THREE.MeshStandardMaterial({ color: 0x222831, roughness: 0.5, metalness: 0.6 }));
  lampPost.position.set(-7.5, 3.2, -6); lampPost.castShadow = true;
  scene.add(lampPost);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10),
    new THREE.MeshBasicMaterial({ color: 0xffe6a3 }));
  bulb.position.set(-7.5, 6.5, -6);
  scene.add(bulb);
}

// ============ LOW-POLY HUMANS ============
const skinMats = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524].map((c) =>
  new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 }));
function shirtMat(color) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
}
const pantsMat = new THREE.MeshStandardMaterial({ color: 0x2b3440, roughness: 0.9 });

// A climber hugging the pole: torso + head + 2 arms + 2 legs (pivot groups for animation)
function makeClimber(shirtColor) {
  const g = new THREE.Group();
  const shirt = shirtMat(shirtColor);
  const skin = skinMats[Math.floor(Math.random() * skinMats.length)];
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.6, 0.3), shirt);
  torso.castShadow = true;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), skin);
  head.position.y = 0.48; head.castShadow = true;
  g.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.1, 10),
    shirtMat(0xe11d2e));
  cap.position.y = 0.6;
  g.add(cap);
  const limbs = {};
  for (const side of ['L', 'R']) {
    const s = side === 'L' ? -1 : 1;
    const armP = new THREE.Group();
    armP.position.set(s * 0.28, 0.22, 0);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.55, 0.13), skin);
    arm.position.y = -0.24; arm.castShadow = true;
    armP.add(arm); armP.rotation.z = s * 1.15; armP.rotation.x = -0.5;
    g.add(armP); limbs['arm' + side] = armP;
    const legP = new THREE.Group();
    legP.position.set(s * 0.14, -0.3, 0);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.55, 0.15), pantsMat);
    leg.position.y = -0.24; leg.castShadow = true;
    legP.add(leg); legP.rotation.z = s * 0.5;
    g.add(legP); limbs['leg' + side] = legP;
  }
  g.userData.limbs = limbs;
  return g;
}
function animateClimber(g, t, energy, phase) {
  const { armL, armR, legL, legR } = g.userData.limbs;
  const w = Math.sin(t * (4 + energy * 6) + phase);
  const w2 = Math.sin(t * (4 + energy * 6) + phase + Math.PI);
  armL.rotation.x = -0.5 + w * (0.25 + energy * 0.55);
  armR.rotation.x = -0.5 + w2 * (0.25 + energy * 0.55);
  legL.rotation.x = w2 * (0.2 + energy * 0.4);
  legR.rotation.x = w * (0.2 + energy * 0.4);
}

// ============ TEAMS (player + 2 AI), 3 climbers stacked each ============
const teams = [];
const LANE_X = [-5.5, 0, 5.5];
const SHIRTS = [0xe11d2e, 0xf5f5f5, 0x166534];
function makeTeam(idx, isPlayer, aiSpeed) {
  const climbers = [];
  for (let i = 0; i < 3; i++) {
    const c = makeClimber(SHIRTS[idx]);
    scene.add(c);
    climbers.push(c);
  }
  const team = {
    idx, isPlayer, x: LANE_X[idx], height: 0,
    stamina: 100, grip: 100, balance: 0,
    finished: false, finishTime: 0, finalHeight: 0,
    aiSpeed, aiSlipT: 6 + Math.random() * 8,
    climbers, phase: Math.random() * 10, energy: 0.2,
    lastStroke: -9,
  };
  teams.push(team);
  return team;
}
makeTeam(0, false, 0.30); // Tim Putih — steady (lane x=-5.5, name index mapping below)
makeTeam(1, true, 0);     // player (center lane x=0)
makeTeam(2, false, 0.38); // Tim Garuda — fast but slips more
teams[0].name = TEAM_NAMES[1];
teams[1].name = TEAM_NAMES[0];
teams[2].name = TEAM_NAMES[2];
const player = teams[1];

function placeTeamClimbers(team, t) {
  // stack of 3: top climber leads at `height`, others hang below
  for (let i = 0; i < 3; i++) {
    const c = team.climbers[i];
    const y = Math.max(0.55, team.height - i * 0.95);
    const ang = t * 0.25 + team.phase + i * 0.7;
    c.position.set(
      team.x + Math.cos(ang) * (POLE_R + 0.28),
      y,
      Math.sin(ang) * (POLE_R + 0.28)
    );
    c.rotation.y = -ang + Math.PI / 2;
    c.rotation.z = THREE.MathUtils.clamp(-team.balance * 0.35, -0.4, 0.4);
    animateClimber(c, t, team.energy, team.phase + i * 1.3);
  }
}

// ============ CHEERING CROWD RING ============
const crowd = [];
{
  const shirtColors = [0xe11d2e, 0xffffff, 0xe11d2e, 0xf5f5f5, 0xb3122a, 0xdddddd];
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * Math.PI * 2 + (Math.random() - 0.5) * 0.15;
    const r = 9.5 + Math.random() * 3.5;
    const g = new THREE.Group();
    const shirt = shirtMat(shirtColors[i % shirtColors.length]);
    const skin = skinMats[i % skinMats.length];
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.8, 8), shirt);
    body.position.y = 0.75; body.castShadow = true;
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), skin);
    head.position.y = 1.32; head.castShadow = true;
    g.add(head);
    const armMat = skin;
    for (const s of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.6, 0.1), armMat);
      arm.position.set(s * 0.32, 1.0, 0);
      arm.rotation.z = s * 2.6; // arms raised cheering
      g.add(arm);
    }
    g.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    g.lookAt(0, 0, 0);
    g.userData = { phase: Math.random() * 10, baseY: 0, excite: 0.5 + Math.random() * 0.5 };
    scene.add(g);
    crowd.push(g);
  }
}

// ============ CONFETTI (win) + DUST (slip) PARTICLES ============
const CONFETTI_N = 500;
const confettiGeo = new THREE.BufferGeometry();
const confettiPos = new Float32Array(CONFETTI_N * 3);
const confettiVel = new Float32Array(CONFETTI_N * 3);
const confettiCol = new Float32Array(CONFETTI_N * 3);
const confettiPalette = [new THREE.Color(0xe11d2e), new THREE.Color(0xffffff), new THREE.Color(0xfbbf24)];
for (let i = 0; i < CONFETTI_N; i++) {
  confettiPos[i * 3 + 1] = -100; // parked underground until win
  const c = confettiPalette[i % 3];
  confettiCol[i * 3] = c.r; confettiCol[i * 3 + 1] = c.g; confettiCol[i * 3 + 2] = c.b;
}
confettiGeo.setAttribute('position', new THREE.BufferAttribute(confettiPos, 3));
confettiGeo.setAttribute('color', new THREE.BufferAttribute(confettiCol, 3));
const confetti = new THREE.Points(confettiGeo, new THREE.PointsMaterial({
  size: 0.16, vertexColors: true, transparent: true, opacity: 0.95,
}));
confetti.frustumCulled = false;
scene.add(confetti);
let confettiOn = false;
function launchConfetti(x) {
  for (let i = 0; i < CONFETTI_N; i++) {
    confettiPos[i * 3] = x + (Math.random() - 0.5) * 4;
    confettiPos[i * 3 + 1] = POLE_H + Math.random() * 3;
    confettiPos[i * 3 + 2] = (Math.random() - 0.5) * 4;
    confettiVel[i * 3] = (Math.random() - 0.5) * 3;
    confettiVel[i * 3 + 1] = -0.5 - Math.random() * 1.5;
    confettiVel[i * 3 + 2] = (Math.random() - 0.5) * 3;
  }
  confettiGeo.attributes.position.needsUpdate = true;
  confettiOn = true;
}
// dust puff shown briefly at player's pole base on slip
const DUST_N = 60;
const dustGeo = new THREE.BufferGeometry();
const dustPos = new Float32Array(DUST_N * 3);
dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
  color: 0x9a7b4f, size: 0.22, transparent: true, opacity: 0.0,
}));
dust.frustumCulled = false;
scene.add(dust);
let dustT = 99;
function puffDust(x) {
  for (let i = 0; i < DUST_N; i++) {
    dustPos[i * 3] = x + (Math.random() - 0.5) * 1.4;
    dustPos[i * 3 + 1] = 0.2 + Math.random() * 1.0;
    dustPos[i * 3 + 2] = (Math.random() - 0.5) * 1.4;
  }
  dustGeo.attributes.position.needsUpdate = true;
  dust.material.opacity = 0.85;
  dustT = 0;
}

// ============ GAME STATE ============
let state = 'menu'; // menu | playing | over
let time = 0;
let elapsed = 0;
const keys = { left: false, right: false };

function inGrease(h) {
  return GREASE_ZONES.some(([a, b]) => h >= a && h <= b);
}
function resetGame() {
  time = 0;
  for (const tm of teams) {
    tm.height = 0; tm.stamina = 100; tm.grip = 100; tm.balance = 0;
    tm.finished = false; tm.finishTime = 0; tm.finalHeight = 0;
    tm.energy = 0.2; tm.aiSlipT = 6 + Math.random() * 8;
    tm.lastStroke = -9;
  }
  confettiOn = false;
  for (let i = 0; i < CONFETTI_N; i++) confettiPos[i * 3 + 1] = -100;
  confettiGeo.attributes.position.needsUpdate = true;
  updateHUD();
}

// ---- player actions ----
function stroke() {
  if (state !== 'playing' || player.finished) return;
  audio();
  if (player.stamina <= 4) { tone(160, 0.15, 'sawtooth', 0.06); return; } // exhausted
  const eff = (0.6 + 0.4 * (player.stamina / 100)) * (player.grip > 20 ? 1 : 0.45);
  player.height = Math.min(POLE_H, player.height + 0.30 * eff);
  player.stamina = Math.max(0, player.stamina - 3.4);
  player.grip = Math.max(0, player.grip - 1.1);
  player.energy = 1;
  player.lastStroke = time;
  sfx.stroke();
}
function slip(team, big) {
  team.height = Math.max(0, team.height - (big ? 1.4 : 0.7));
  team.grip = Math.max(0, team.grip - (big ? 14 : 7));
  team.balance = 0;
  team.energy = 0.9;
  if (team.isPlayer) { sfx.slip(); puffDust(team.x); }
}

// ---- input: keyboard + touch ----
window.addEventListener('keydown', (e) => {
  if (['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
  if (e.repeat && e.code === 'Space') return; // mash = real presses, ignore key repeat
  if (e.code === 'Space') {
    if (state === 'menu') startGame();
    else stroke();
  }
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = true;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = true;
  if (e.code === 'ArrowUp' || e.code === 'KeyW') {
    if (state === 'menu') startGame(); else stroke();
  }
  if (e.code === 'Enter' && state === 'over') restart();
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
  if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
});
function bindHold(el, on, off) {
  el.addEventListener('touchstart', (e) => { e.preventDefault(); on(); }, { passive: false });
  el.addEventListener('touchend', (e) => { e.preventDefault(); off && off(); }, { passive: false });
  el.addEventListener('mousedown', (e) => { e.preventDefault(); on(); });
  el.addEventListener('mouseup', () => off && off());
  el.addEventListener('mouseleave', () => off && off());
}
bindHold($('t-left'), () => { keys.left = true; }, () => { keys.left = false; });
bindHold($('t-right'), () => { keys.right = true; }, () => { keys.right = false; });
bindHold($('t-climb'), () => stroke());
$('btn-cam').addEventListener('click', () => {
  followCam = !followCam;
  $('btn-cam').textContent = followCam ? '🎥 Ikuti' : '🎥 Bebas';
  sfx.click();
});

// ============ HUD + OVERLAYS ============
function fmtTime(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}
function updateHUD() {
  $('hud-timer').textContent = `⏱ ${fmtTime(TIME_LIMIT - time)}`;
  const pct = Math.round((player.height / POLE_H) * 100);
  $('hud-progress').textContent = `${pct}%`;
  const rank = [...teams].sort((a, b) => b.height - a.height).indexOf(player) + 1;
  $('hud-pos').textContent = `P${rank}`;
  $('stamina-num').textContent = Math.round(player.stamina);
  $('stamina-fill').style.width = `${player.stamina}%`;
  $('grip-num').textContent = Math.round(player.grip);
  $('grip-fill').style.width = `${player.grip}%`;
  $('bal-marker').style.left = `${(player.balance * 0.5 + 0.5) * 100}%`;
  $('hud-height').textContent = `${player.height.toFixed(1)} m`;
  $('grease-warn').classList.toggle('hidden', !(state === 'playing' && inGrease(player.height)));
}
function startGame() {
  try { audio(); } catch {}
  try { sfx.click(); } catch {}
  resetGame();
  state = 'playing';
  $('overlay-start').classList.add('hidden');
  $('overlay-result').classList.add('hidden');
  $('hud').classList.remove('hidden');
  $('touch').classList.remove('hidden');
}
function restart() {
  sfx.click();
  resetGame();
  state = 'playing';
  $('overlay-result').classList.add('hidden');
  $('hud').classList.remove('hidden');
}
$('btn-start').addEventListener('click', startGame);
$('btn-restart').addEventListener('click', restart);
window.__booted = true;

function endGame(playerWon, reason) {
  state = 'over';
  for (const tm of teams) tm.finalHeight = tm.height;
  const order = [...teams].sort((a, b) => {
    if (a.finished && b.finished) return a.finishTime - b.finishTime;
    if (a.finished) return -1;
    if (b.finished) return 1;
    return b.height - a.height;
  });
  $('result-flags').textContent = playerWon ? '🏆🇮🇩🏆' : '😅🇮🇩💪';
  $('result-title').textContent = playerWon ? 'MENANG! / YOU WIN!' : 'KALAH / YOU LOSE';
  $('result-sub').textContent = reason;
  $('result-table').innerHTML = order.map((tm) => {
    const res = tm.finished ? fmtTime(tm.finishTime) : `${tm.finalHeight.toFixed(1)} m`;
    return `<tr class="${tm.isPlayer ? 'me' : ''}"><td>${tm.isPlayer ? '⭐ ' : ''}${tm.name}</td><td>${res}</td></tr>`;
  }).join('');
  $('overlay-result').classList.remove('hidden');
  if (playerWon) { sfx.fanfare(); launchConfetti(player.x); }
  else sfx.sad();
}

// ============ PER-FRAME UPDATE ============
function updatePlayer(dt) {
  const grease = inGrease(player.height) ? 2.2 : 1.0;
  // balance drift (grease pushes you around)
  player.balance += (Math.sin(time * 2.1) * 0.25 + (Math.random() - 0.5) * 0.6) * grease * dt;
  if (keys.left) player.balance -= 1.9 * dt;
  if (keys.right) player.balance += 1.9 * dt;
  if (Math.abs(player.balance) > 0.75 && Math.abs(player.balance) < 1) {
    player.grip = Math.max(0, player.grip - 12 * dt);
    if (Math.random() < dt * 4) sfx.warn();
  }
  if (Math.abs(player.balance) >= 1) slip(player, true); // lost balance
  // regen while resting, slow grip recovery when balanced
  if (time - player.lastStroke > 0.8) player.stamina = Math.min(100, player.stamina + 7 * dt);
  if (Math.abs(player.balance) < 0.3) player.grip = Math.min(100, player.grip + 4 * dt);
  if (inGrease(player.height)) player.grip = Math.max(0, player.grip - 2.5 * dt);
  if (player.grip <= 0) player.height = Math.max(0, player.height - 1.4 * dt); // slide!
  player.energy = Math.max(0.15, player.energy - dt * 1.5);
  if (player.height >= POLE_H && !player.finished) {
    player.finished = true; player.finishTime = time;
  }
}
function updateAI(tm, dt) {
  if (tm.finished) return;
  const greaseSlow = inGrease(tm.height) ? 0.55 : 1.0;
  tm.height += tm.aiSpeed * greaseSlow * (0.85 + 0.3 * Math.sin(time * 0.7 + tm.phase)) * dt;
  tm.energy = 0.4 + 0.3 * Math.sin(time * 3 + tm.phase);
  tm.balance = Math.sin(time * 1.3 + tm.phase) * 0.4;
  // occasional dramatic slip for the fast team
  tm.aiSlipT -= dt;
  if (tm.aiSlipT <= 0) {
    slip(tm, tm.idx === 2);
    tm.aiSlipT = 7 + Math.random() * 9;
  }
  if (tm.height >= POLE_H) { tm.height = POLE_H; tm.finished = true; tm.finishTime = time; }
}

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  time += state === 'playing' ? dt : 0;
  elapsed += dt;

  if (state === 'playing') {
    updatePlayer(dt);
    for (const tm of teams) if (!tm.isPlayer) updateAI(tm, dt);
    // win/lose: first finisher ends the race, or timeout
    const finisher = teams.find((t) => t.finished);
    if (finisher) {
      endGame(finisher.isPlayer, finisher.isPlayer
        ? 'Kamu meraih hadiah di puncak! / You grabbed the prizes at the top!'
        : `${finisher.name} mencapai puncak duluan. Coba lagi! / ${finisher.name} reached the top first. Try again!`);
    } else if (time >= TIME_LIMIT) {
      endGame(false, 'Waktu habis! / Time is up!');
    }
    updateHUD();
  }
  // ambient animation always runs (menu background alive)
  for (const tm of teams) placeTeamClimbers(tm, elapsed);
  const exciteAll = state === 'over' ? 1.6 : 1.0;
  for (const c of crowd) {
    c.position.y = Math.abs(Math.sin(elapsed * 5 * c.userData.excite * exciteAll + c.userData.phase)) * 0.28;
    c.rotation.y += Math.sin(elapsed + c.userData.phase) * 0.002;
  }
  // wave the big flags
  for (const o of scene.children) {
    if (o.userData && o.userData.isBigFlag) {
      const p = o.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i);
        p.setZ(i, Math.sin(elapsed * 3 + x * 3) * 0.08 * (x + 1.2));
      }
      p.needsUpdate = true;
    }
  }
  if (confettiOn) {
    for (let i = 0; i < CONFETTI_N; i++) {
      confettiPos[i * 3] += confettiVel[i * 3] * dt;
      confettiPos[i * 3 + 1] += confettiVel[i * 3 + 1] * dt;
      confettiPos[i * 3 + 2] += confettiVel[i * 3 + 2] * dt;
      confettiVel[i * 3 + 1] -= 1.2 * dt;
      if (confettiPos[i * 3 + 1] < 0) { // recycle to the top
        confettiPos[i * 3 + 1] = POLE_H + 2 + Math.random() * 2;
        confettiPos[i * 3] = player.x + (Math.random() - 0.5) * 6;
      }
    }
    confettiGeo.attributes.position.needsUpdate = true;
  }
  if (dustT < 1) {
    dustT += dt;
    dust.material.opacity = Math.max(0, 0.85 * (1 - dustT));
  }
  // camera
  if (followCam && state !== 'menu') {
    const targetY = Math.max(2.2, player.height + 1.6);
    const desired = new THREE.Vector3(player.x + 4.2, targetY + 1.2, 8.5);
    camera.position.lerp(desired, 1 - Math.pow(0.001, dt));
    controls.target.lerp(new THREE.Vector3(player.x, targetY, 0), 1 - Math.pow(0.0001, dt));
  } else if (state === 'menu') {
    const a = elapsed * 0.15;
    camera.position.set(Math.sin(a) * 14, 5, Math.cos(a) * 14);
    controls.target.set(0, 5, 0);
  }
  controls.update();
  renderer.render(scene, camera);
}
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
resetGame();
animate();
