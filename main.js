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
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xafd4f0, 30, 85);
// Gradient sky dome
{
  const skyTex = (() => { const c=document.createElement('canvas'); c.width=4; c.height=256; const g=c.getContext('2d'); const gr=g.createLinearGradient(0,0,0,256); gr.addColorStop(0,'#2e6fc2'); gr.addColorStop(0.45,'#7ab8e8'); gr.addColorStop(0.75,'#cfe8f7'); gr.addColorStop(1,'#fde8c0'); g.fillStyle=gr; g.fillRect(0,0,4,256); const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t; })();
  const sky = new THREE.Mesh(new THREE.SphereGeometry(90, 24, 12), new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false }));
  scene.add(sky);
  scene.background = skyTex;
}

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(5, 3, 11);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.maxPolarAngle = Math.PI * 0.495;
controls.maxDistance = 40;
let followCam = true;

// ============ LIGHTS: warm afternoon sun + hemisphere + ambient bounce ============
scene.add(new THREE.HemisphereLight(0xbfd9ff, 0x8a6a42, 0.85));
scene.add(new THREE.AmbientLight(0xffe8c0, 0.35));
const bounce = new THREE.DirectionalLight(0xffd9a0, 0.35); bounce.position.set(-8, 6, -10); scene.add(bounce);

const sun = new THREE.DirectionalLight(0xffdf9e, 2.2);
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
  // multi-layer: base + patches + noise speckles + worn dirt
  g.fillStyle = '#5d8f4e'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 22; i++) { g.fillStyle = `rgba(${90+Math.random()*50|0},${130+Math.random()*40|0},60,0.25)`; g.beginPath(); g.ellipse(Math.random()*w, Math.random()*h, 20+Math.random()*50, 14+Math.random()*30, Math.random()*3, 0, 7); g.fill(); }
  for (let i = 0; i < 2400; i++) {
    g.fillStyle = `rgba(${40 + Math.random() * 60 | 0},${110 + Math.random() * 60 | 0},${40 + Math.random() * 40 | 0},0.5)`;
    g.fillRect(Math.random() * w, Math.random() * h, 2, 2 + Math.random() * 5);
  }
  for (let i = 0; i < 900; i++) { g.fillStyle = Math.random()<0.5?'rgba(255,255,200,0.12)':'rgba(30,60,20,0.18)'; g.fillRect(Math.random()*w, Math.random()*h, 1.5, 1.5); }
  for (let i = 0; i < 16; i++) { g.fillStyle = 'rgba(122,90,60,0.4)'; g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, 12 + Math.random() * 30, 8 + Math.random() * 20, Math.random() * 3, 0, 7); g.fill(); }
});
// wood-grain + grease drip textures for pole
const woodTex = canvasTex(256, 512, (g,w,h)=>{ g.fillStyle='#8a6a45'; g.fillRect(0,0,w,h); for(let i=0;i<70;i++){ const x=Math.random()*w; g.strokeStyle=`rgba(${60+Math.random()*40|0},${40+Math.random()*30|0},20,${0.25+Math.random()*0.4})`; g.lineWidth=1+Math.random()*3; g.beginPath(); g.moveTo(x,0); g.bezierCurveTo(x+6,h*0.33,x-6,h*0.66,x+3,h); g.stroke(); } for(let i=0;i<12;i++){ g.fillStyle='rgba(50,32,14,0.5)'; g.beginPath(); g.ellipse(Math.random()*w,Math.random()*h,3,6,0,0,7); g.fill(); } });
woodTex.wrapS=woodTex.wrapT=THREE.RepeatWrapping; woodTex.repeat.set(2,3);
const greaseTex = canvasTex(256,256,(g,w,h)=>{ g.clearRect(0,0,w,h); g.fillStyle='rgba(230,205,90,0.55)'; g.fillRect(0,0,w,h); for(let i=0;i<40;i++){ const x=Math.random()*w; const len=30+Math.random()*120; const gr=g.createLinearGradient(0,0,0,len); gr.addColorStop(0,'rgba(255,240,150,0.9)'); gr.addColorStop(1,'rgba(255,240,150,0)'); g.fillStyle=gr; g.fillRect(x,0,2+Math.random()*4,len);} });
greaseTex.wrapS=greaseTex.wrapT=THREE.RepeatWrapping;
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
    new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.95, metalness: 0, roughnessMap: groundTex })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
}
// Scattered props + clouds + distant silhouettes (shared geo/mat, instanced tufts)
const clouds = [];
{
  const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.92 });
  const puffGeo = new THREE.SphereGeometry(1, 7, 5);
  for (let i = 0; i < 10; i++) {
    const cl = new THREE.Group();
    for (let j = 0; j < 4; j++) { const p = new THREE.Mesh(puffGeo, cloudMat); p.position.set(j*1.4-2+Math.random(), Math.random()*0.4, Math.random()); p.scale.set(1.6+Math.random(), 0.7, 1.1); cl.add(p); }
    cl.position.set(-40+Math.random()*80, 18+Math.random()*8, -30+Math.random()*25);
    cl.userData.speed = 0.2+Math.random()*0.35; scene.add(cl); clouds.push(cl);
  }
  // distant silhouette trees/houses/tents
  const silMat = new THREE.MeshBasicMaterial({ color: 0x3a6b4f });
  const houseMat = new THREE.MeshBasicMaterial({ color: 0x7a5a4a });
  const tentMat = new THREE.MeshBasicMaterial({ color: 0xc23b4a });
  for (let i = 0; i < 16; i++) {
    const a = (i/16)*Math.PI*2, r = 38+Math.random()*6, x = Math.cos(a)*r, z = Math.sin(a)*r;
    const grp = new THREE.Group();
    if (i%3===0) { const tr=new THREE.Mesh(new THREE.CylinderGeometry(0.3,0.4,2,5), silMat); tr.position.y=1; grp.add(tr); const cr=new THREE.Mesh(new THREE.ConeGeometry(2,3.5,6), silMat); cr.position.y=3.5; grp.add(cr); }
    else if (i%3===1) { const b=new THREE.Mesh(new THREE.BoxGeometry(3,1.8,2.4), houseMat); b.position.y=0.9; grp.add(b); const rf=new THREE.Mesh(new THREE.ConeGeometry(2.4,1.2,4), houseMat); rf.position.y=2.3; rf.rotation.y=Math.PI/4; grp.add(rf); }
    else { const t=new THREE.Mesh(new THREE.ConeGeometry(2,1.8,4), tentMat); t.position.y=0.9; grp.add(t); }
    grp.position.set(x,0,z); scene.add(grp);
  }
  // grass tufts (InstancedMesh) + stones + extra puddles
  const bladeGeo = new THREE.ConeGeometry(0.06, 0.45, 4);
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0x4a8a3a, roughness: 0.9 });
  const tufts = new THREE.InstancedMesh(bladeGeo, bladeMat, 220);
  const dummy = new THREE.Object3D(); const _v = new THREE.Vector3();
  for (let i=0;i<220;i++){ const a=Math.random()*Math.PI*2, r=3+Math.random()*22; dummy.position.set(Math.cos(a)*r, 0.22, Math.sin(a)*r); dummy.rotation.set((Math.random()-0.5)*0.4, Math.random()*3, (Math.random()-0.5)*0.4); dummy.scale.setScalar(0.7+Math.random()*0.9); dummy.updateMatrix(); tufts.setMatrixAt(i, dummy.matrix); }
  tufts.instanceMatrix.needsUpdate = true; scene.add(tufts);
  const stoneGeo = new THREE.DodecahedronGeometry(0.18, 0); const stoneMat = new THREE.MeshStandardMaterial({ color: 0x8a8a82, roughness: 0.95 });
  for (let i=0;i<18;i++){ const s=new THREE.Mesh(stoneGeo, stoneMat); const a=Math.random()*Math.PI*2, r=2.5+Math.random()*20; s.position.set(Math.cos(a)*r, 0.08, Math.sin(a)*r); s.scale.setScalar(0.5+Math.random()); s.rotation.set(Math.random()*3,Math.random()*3,0); s.castShadow=true; scene.add(s); }
}
const mudMat = new THREE.MeshPhysicalMaterial({ color: 0x4a2f1a, roughness: 0.12, metalness: 0.05, clearcoat: 0.8, clearcoatRoughness: 0.2 });
const puddleMat = new THREE.MeshStandardMaterial({ color: 0x7a5a36, roughness: 0.15, metalness: 0.35 });
const rippleRings = [];
for (const px of [-5.5, 0, 5.5]) {
  // ripples on landing/splash
  for (let k=0;k<2;k++){ const ring=new THREE.Mesh(new THREE.RingGeometry(0.3,0.42,24), new THREE.MeshBasicMaterial({ color:0xd8b88a, transparent:true, opacity:0, side:THREE.DoubleSide })); ring.rotation.x=-Math.PI/2; ring.position.set(px,0.03+k*0.002,0); ring.userData={t:99, lane:px}; scene.add(ring); rippleRings.push(ring); }
  const mud = new THREE.Mesh(new THREE.CircleGeometry(1.7, 28), mudMat);
  mud.rotation.x = -Math.PI / 2; mud.position.set(px, 0.01, 0);
  mud.receiveShadow = true; scene.add(mud);
  const pud = new THREE.Mesh(new THREE.CircleGeometry(0.9, 24), puddleMat);
  pud.rotation.x = -Math.PI / 2; pud.position.set(px, 0.02, 0);
  pud.receiveShadow = true; scene.add(pud);
}

// ============ POLES (greased pinang trunks) + PRIZE TREES ============
const barkMat = new THREE.MeshPhysicalMaterial({
  map: woodTex, roughness: 0.38, metalness: 0.05,
  clearcoat: 1.0, clearcoatRoughness: 0.18, // grease sheen
});
const greaseMat = new THREE.MeshPhysicalMaterial({
  map: greaseTex, roughness: 0.08, metalness: 0.1,
  transparent: true, opacity: 0.75, clearcoat: 1.0, clearcoatRoughness: 0.05,
  emissive: 0x554411, emissiveIntensity: 0.2,
});
const wavingFlags = []; // {mesh, phase} vertex-wave flags/bunting
const prizeSway = [];   // hanging prizes {group, phase}
let poleWobble = 0, camShake = 0;
function triggerRipple(x){ for(const r of rippleRings) if(Math.abs(r.userData.lane-x)<0.1 && r.userData.t>=1){ r.userData.t=0; break; } }
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
  // areca leaf crown: bent frond planes
  {
    const frondMat = new THREE.MeshStandardMaterial({ color: 0x2e7d32, side: THREE.DoubleSide, roughness: 0.8 });
    const frondGeo = new THREE.PlaneGeometry(0.5, 2.2, 1, 6);
    { const p = frondGeo.attributes.position; for (let i=0;i<p.count;i++){ const y=p.getY(i); p.setZ(i, -Math.pow((y+1.1)/2.2,2)*0.9); } frondGeo.computeVertexNormals(); }
    for (let i=0;i<8;i++){ const a=(i/8)*Math.PI*2; const f=new THREE.Mesh(frondGeo, frondMat); f.position.set(Math.cos(a)*0.3, POLE_H+0.3, Math.sin(a)*0.3); f.rotation.set(0.9, -a+Math.PI/2, 0, 'YXZ'); f.castShadow=true; g.add(f); }
  }
  // detailed hanging prizes: TV box, fan, kettle (sway/rotate)
  {
    const hang = (obj, a, r=1.15) => { const hg=new THREE.Group(); hg.position.set(Math.cos(a)*r, POLE_H+0.15, Math.sin(a)*r); const rope=new THREE.Mesh(new THREE.CylinderGeometry(0.015,0.015,0.5,5), new THREE.MeshStandardMaterial({color:0xdddddd})); rope.position.y=-0.25; hg.add(rope); obj.position.y=-0.65; hg.add(obj); hg.userData.phase=Math.random()*6; g.add(hg); prizeSway.push(hg); return hg; };
    const tv = new THREE.Group(); const tvB=new THREE.Mesh(new THREE.BoxGeometry(0.6,0.45,0.12), new THREE.MeshStandardMaterial({color:0x111827, roughness:0.4})); tv.add(tvB); const scr=new THREE.Mesh(new THREE.PlaneGeometry(0.5,0.35), new THREE.MeshBasicMaterial({color:0x7dd3fc})); scr.position.z=0.07; tv.add(scr); hang(tv, 0.6);
    const fan = new THREE.Group(); const fanB=new THREE.Mesh(new THREE.CylinderGeometry(0.28,0.28,0.1,16), new THREE.MeshStandardMaterial({color:0xe5e7eb, roughness:0.4, metalness:0.3})); fanB.rotation.x=Math.PI/2; fan.add(fanB); for(let b=0;b<3;b++){ const bl=new THREE.Mesh(new THREE.CircleGeometry(0.12,8), new THREE.MeshStandardMaterial({color:0x93c5fd, side:THREE.DoubleSide})); bl.position.set(Math.cos(b*2.1)*0.12, Math.sin(b*2.1)*0.12, 0.07); fan.add(bl); } hang(fan, 2.4);
    const kettle = new THREE.Group(); const kb=new THREE.Mesh(new THREE.CylinderGeometry(0.14,0.18,0.3,12), new THREE.MeshStandardMaterial({color:0xc0c0c0, roughness:0.25, metalness:0.8})); kettle.add(kb); const sp=new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.05,0.18,6), kb.material); sp.position.set(0.18,0.05,0); sp.rotation.z=-0.8; kettle.add(sp); hang(kettle, 4.2);
  }
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
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.28, 6, 1),
      new THREE.MeshStandardMaterial({ map: flagTex(), side: THREE.DoubleSide, roughness: 0.7 }));
    flag.position.set(Math.cos(a) * 1.45 + 0.22, POLE_H + 1.32, Math.sin(a) * 1.45);
    flag.rotation.y = -a + Math.PI / 2;
    wavingFlags.push({ mesh: flag, phase: a * 2 });
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
    const big = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.6, 10, 2),
      new THREE.MeshStandardMaterial({ map: flagTex(), side: THREE.DoubleSide, roughness: 0.8 }));
    big.position.set(fx + 1.25, 7.8, -4);
    big.userData.isBigFlag = true;
    wavingFlags.push({ mesh: big, phase: fx });
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

// Articulated climber: torso group (lean) + head (bob, face) + joint-pivot arms/legs
let climberVariant = 0;
function makeClimber(shirtColor) {
  const g = new THREE.Group();
  const variant = climberVariant++;
  const shirt = shirtMat(shirtColor);
  const shorts = shirtMat([0x1e3a5f, 0x7f1d1d, 0x14532d, 0x111827][variant % 4]);
  const skin = skinMats[variant % skinMats.length];
  const torsoG = new THREE.Group(); g.add(torsoG);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.58, 0.28), shirt); torso.castShadow = true; torsoG.add(torso);
  const hips = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.22, 0.26), shorts); hips.position.y = -0.38; hips.castShadow = true; torsoG.add(hips);
  const headG = new THREE.Group(); headG.position.y = 0.32; torsoG.add(headG);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 12), skin); head.position.y = 0.16; head.castShadow = true; headG.add(head);
  // simple face: eyes
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a });
  const eyeGeo = new THREE.SphereGeometry(0.022, 6, 6);
  for (const s of [-1, 1]) { const e = new THREE.Mesh(eyeGeo, eyeMat); e.position.set(s*0.06, 0.18, 0.155); headG.add(e); }
  // cap or hair variation
  if (variant % 2 === 0) { const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.19, 0.09, 12), shirtMat(variant%4===0?0xe11d2e:0xffffff)); cap.position.y = 0.3; headG.add(cap); const brim = new THREE.Mesh(new THREE.BoxGeometry(0.2,0.03,0.14), cap.material); brim.position.set(0,0.27,0.2); headG.add(brim); }
  else { const hair = new THREE.Mesh(new THREE.SphereGeometry(0.175, 12, 8, 0, Math.PI*2, 0, 1.2), new THREE.MeshStandardMaterial({ color: 0x1a120b, roughness: 0.95 })); hair.position.y = 0.18; headG.add(hair); }
  const limbs = {};
  for (const side of ['L', 'R']) {
    const s = side === 'L' ? -1 : 1;
    const armP = new THREE.Group(); armP.position.set(s * 0.27, 0.24, 0); // shoulder pivot
    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.34, 0.12), shirt); upper.position.y = -0.15; upper.castShadow = true; armP.add(upper);
    const elbow = new THREE.Group(); elbow.position.y = -0.3; armP.add(elbow);
    const fore = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.32, 0.11), skin); fore.position.y = -0.14; fore.castShadow = true; elbow.add(fore);
    // grip arms wrap toward pole (forward)
    armP.rotation.set(-1.1, 0, s * 0.9); elbow.rotation.x = -0.9;
    torsoG.add(armP); limbs['arm' + side] = armP; limbs['elbow' + side] = elbow;
    const legP = new THREE.Group(); legP.position.set(s * 0.13, -0.48, 0); // hip pivot
    const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.34, 0.14), shorts); thigh.position.y = -0.15; thigh.castShadow = true; legP.add(thigh);
    const knee = new THREE.Group(); knee.position.y = -0.32; legP.add(knee);
    const shin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.34, 0.12), skin); shin.position.y = -0.15; shin.castShadow = true; knee.add(shin);
    legP.rotation.set(0.5, 0, s * 0.55); knee.rotation.x = -0.9; // legs clamped around pole
    torsoG.add(legP); limbs['leg' + side] = legP; limbs['knee' + side] = knee;
  }
  g.userData.limbs = limbs; g.userData.torso = torsoG; g.userData.headG = headG;
  return g;
}
function animateClimber(g, t, energy, phase, stamina = 100, velocity = 0) {
  const L = g.userData.limbs;
  const reachSpeed = 0.5 + (stamina / 100) * 0.9; // stamina affects arm reach speed
  const f = (4 + energy * 6) * reachSpeed;
  const w = Math.sin(t * f + phase), w2 = Math.sin(t * f + phase + Math.PI);
  L.armL.rotation.x = -1.1 + w * (0.3 + energy * 0.6);
  L.armR.rotation.x = -1.1 + w2 * (0.3 + energy * 0.6);
  L.elbowL.rotation.x = -0.9 + w2 * 0.35 * energy; L.elbowR.rotation.x = -0.9 + w * 0.35 * energy;
  L.legL.rotation.x = 0.5 + w2 * (0.2 + energy * 0.35); L.legR.rotation.x = 0.5 + w * (0.2 + energy * 0.35);
  L.kneeL.rotation.x = -0.9 + w * 0.3 * energy; L.kneeR.rotation.x = -0.9 + w2 * 0.3 * energy;
  // torso lean tied to velocity/effort + head bob
  g.userData.torso.rotation.x = THREE.MathUtils.clamp(-0.12 - velocity * 0.25 - energy * 0.12, -0.45, 0.1);
  g.userData.torso.rotation.z = Math.sin(t * f * 0.5 + phase) * 0.05 * energy;
  g.userData.headG.position.y = 0.32 + Math.abs(Math.sin(t * f + phase)) * 0.035 * (0.4 + energy);
  g.userData.headG.rotation.x = -g.userData.torso.rotation.x * 0.6;
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
    lastStroke: -9, velocity: 0, prevHeight: 0,
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
    // pyramid roles: 0=top reacher, 1=mid support, 2=base anchor
    c.scale.setScalar(i === 2 ? 1.08 : i === 1 ? 1.0 : 0.94);
    animateClimber(c, t, team.energy * (i === 0 ? 1 : 0.55), team.phase + i * 1.3, team.stamina, team.velocity);
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
// grease splash burst (capped, reused buffers)
const SPLASH_N = 80;
const splashGeo = new THREE.BufferGeometry();
const splashPos = new Float32Array(SPLASH_N * 3);
const splashVel = new Float32Array(SPLASH_N * 3);
splashGeo.setAttribute('position', new THREE.BufferAttribute(splashPos, 3));
const splash = new THREE.Points(splashGeo, new THREE.PointsMaterial({ color: 0xf5d76e, size: 0.14, transparent: true, opacity: 0 }));
splash.frustumCulled = false; scene.add(splash);
let splashT = 99;
function puffGreaseSplash(x, y) {
  for (let i = 0; i < SPLASH_N; i++) { splashPos[i*3]=x+(Math.random()-0.5)*0.5; splashPos[i*3+1]=y; splashPos[i*3+2]=(Math.random()-0.5)*0.5; splashVel[i*3]=(Math.random()-0.5)*2.4; splashVel[i*3+1]=-0.5-Math.random()*1.8; splashVel[i*3+2]=(Math.random()-0.5)*2.4; }
  splashGeo.attributes.position.needsUpdate = true; splash.material.opacity = 0.95; splashT = 0;
  triggerRipple(x); poleWobble = 1; if (Math.abs(x - player.x) < 0.1) camShake = Math.max(camShake, 0.55);
}
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
  puffGreaseSplash(team.x, Math.max(0.6, team.height));
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
const _camDesired = new THREE.Vector3(), _camTarget = new THREE.Vector3(), _shakeV = new THREE.Vector3();
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
  if (dt > 0) for (const tm of teams) { tm.velocity = THREE.MathUtils.clamp((tm.height - tm.prevHeight) / dt, -3, 3); tm.prevHeight = tm.height; }
  for (const tm of teams) placeTeamClimbers(tm, elapsed);
  for (const cl of clouds) { cl.position.x += cl.userData.speed * dt; if (cl.position.x > 55) cl.position.x = -55; }
  for (const hg of prizeSway) { hg.rotation.z = Math.sin(elapsed * 1.4 + hg.userData.phase) * 0.14; hg.rotation.x = Math.cos(elapsed * 1.1 + hg.userData.phase) * 0.1; hg.rotation.y += dt * 0.4; }
  poleWobble = Math.max(0, poleWobble - dt * 1.6);
  { const wob = Math.sin(elapsed * 22) * 0.02 * poleWobble; for (const pg of poleGroups) pg.rotation.z = wob; }
  for (const r of rippleRings) { if (r.userData.t < 1) { r.userData.t += dt * 1.4; const s = 0.5 + r.userData.t * 2.2; r.scale.setScalar(s); r.material.opacity = 0.7 * (1 - r.userData.t); } }
  if (splashT < 1.2) { splashT += dt; for (let i=0;i<SPLASH_N;i++){ splashPos[i*3]+=splashVel[i*3]*dt; splashPos[i*3+1]+=splashVel[i*3+1]*dt; splashPos[i*3+2]+=splashVel[i*3+2]*dt; splashVel[i*3+1]-=3*dt; if(splashPos[i*3+1]<0.05) splashPos[i*3+1]=0.05; } splashGeo.attributes.position.needsUpdate = true; splash.material.opacity = Math.max(0, 0.95 * (1 - splashT / 1.2)); }
  camShake = Math.max(0, camShake - dt * 1.8);
  const exciteAll = state === 'over' ? 1.6 : 1.0;
  for (const c of crowd) {
    c.position.y = Math.abs(Math.sin(elapsed * 5 * c.userData.excite * exciteAll + c.userData.phase)) * 0.28;
    c.rotation.y += Math.sin(elapsed + c.userData.phase) * 0.002;
  }
  // waving flags/bunting: vertex sin wave (reuse position attr, no allocs)
  for (const wf of wavingFlags) {
    const p = wf.mesh.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setZ(i, Math.sin(elapsed * 5 + wf.phase + x * 4) * 0.07 * (Math.abs(x) + 0.3)); }
    p.needsUpdate = true; wf.mesh.geometry.computeVertexNormals();
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
    _camDesired.set(player.x + 4.2, targetY + 1.2, 8.5);
    camera.position.lerp(_camDesired, 1 - Math.pow(0.001, dt));
    _camTarget.set(player.x, targetY, 0);
    controls.target.lerp(_camTarget, 1 - Math.pow(0.0001, dt));
    if (camShake > 0) { _shakeV.set((Math.random()-0.5)*camShake*0.35, (Math.random()-0.5)*camShake*0.3, 0); camera.position.add(_shakeV); }
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
