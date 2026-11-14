/**
 * 3D-сцена приветственного лендинга: процедурная планета, корабли, выходящие из варпа, звёзды и туманность.
 * Чистый three.js без текстур-файлов — всё генерируется шейдерами, поэтому чанк лёгкий и работает офлайн.
 *
 * Время сцены T (секунды):
 *   0–5   камера подлетает, звёзды проявляются, свет «восходит» из-за планеты
 *   3–6   корабли по очереди выходят из варпа и ложатся на орбиты
 *   ≥7.2  финальный кадр: планета смещается, освобождая место под текст
 */
import * as THREE from "three";

export type Phase = "caption1" | "caption2" | "final";

export interface SceneOptions {
  reducedMotion: boolean;
  /** Начать с указанной секунды (отладка: /?t=8). */
  startAt?: number;
  onPhase: (phase: Phase) => void;
}

export interface LandingScene {
  skip: () => void;
  dispose: () => void;
}

/** Широкая раскладка: текст слева, планета справа. Иначе — планета сверху, текст снизу. */
export const isWideLayout = (w: number, h: number) => w >= 1024 && w / h > 1.2;

const PHASES: [number, Phase][] = [[1.4, "caption1"], [4.4, "caption2"], [7.2, "final"]];
const FINAL_T = 7.2;
const PLANET_R = 2.6;

// ---------- GLSL: 3D simplex noise (Ashima Arts / Stefan Gustavson, MIT) + fbm ----------
const NOISE = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);
  const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.0-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(
      i.z+vec4(0.0,i1.z,i2.z,1.0))
    + i.y+vec4(0.0,i1.y,i2.y,1.0))
    + i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);
  vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;
  vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);
  vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;
  vec4 s1=floor(b1)*2.0+1.0;
  vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);
  vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z);
  vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
  m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
float fbm(vec3 p){
  float f=0.0,a=0.5;
  for(int i=0;i<5;i++){f+=a*snoise(p);p*=2.03;a*=0.5;}
  return f;
}
`;

const SPHERE_VERT = /* glsl */ `
varying vec3 vObj;
varying vec3 vNormalW;
varying vec3 vViewDir;
void main(){
  vObj = position;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vViewDir = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const PLANET_FRAG = /* glsl */ `
uniform vec3 uSun;
uniform float uLight;
varying vec3 vObj;
varying vec3 vNormalW;
varying vec3 vViewDir;
${NOISE}
void main(){
  vec3 p = normalize(vObj);
  float h = fbm(p*1.6 + vec3(1.7,0.0,4.2)) + 0.18*fbm(p*5.0);
  float lat = abs(p.y);

  float land = smoothstep(0.03, 0.06, h);
  vec3 ocean = mix(vec3(0.015,0.06,0.17), vec3(0.04,0.24,0.46), smoothstep(-0.3, 0.05, h));
  vec3 ground = mix(vec3(0.62,0.56,0.40), vec3(0.15,0.34,0.13), smoothstep(0.045, 0.085, h));
  ground = mix(ground, vec3(0.46,0.36,0.22), smoothstep(0.18, 0.32, h) * (1.0 - lat));
  ground = mix(ground, vec3(0.36,0.32,0.30), smoothstep(0.32, 0.46, h));
  vec3 col = mix(ocean, ground, land);

  float ice = smoothstep(0.78, 0.86, lat + 0.08*fbm(p*4.0));
  col = mix(col, vec3(0.9,0.94,1.0), ice);

  vec3 n = normalize(vNormalW);
  float ndl = dot(n, uSun);
  float diff = max(ndl, 0.0);
  float day = smoothstep(-0.12, 0.25, ndl);
  vec3 lit = col * (0.025 + diff * 1.15 * uLight);

  // блик солнца на океане
  vec3 hv = normalize(uSun + vViewDir);
  float spec = pow(max(dot(n, hv), 0.0), 60.0) * (1.0 - land) * (1.0 - ice) * uLight;
  lit += vec3(1.0, 0.92, 0.8) * spec * 0.55;

  // огни городов на ночной стороне
  float cluster = smoothstep(0.0, 0.35, fbm(p*3.0 + 9.0));
  float city = smoothstep(0.62, 0.9, snoise(p*42.0)*0.5 + 0.5) * cluster * land * (1.0 - ice);
  lit += vec3(1.0, 0.68, 0.32) * city * (1.0 - day) * 0.95;

  // атмосферный ободок
  float fres = pow(1.0 - max(dot(n, vViewDir), 0.0), 3.0);
  lit += vec3(0.3, 0.6, 1.0) * fres * (0.08 + 0.92*day) * uLight * 0.9;

  gl_FragColor = vec4(lit, 1.0);
}
`;

const CLOUD_FRAG = /* glsl */ `
uniform vec3 uSun;
uniform float uLight;
varying vec3 vObj;
varying vec3 vNormalW;
varying vec3 vViewDir;
${NOISE}
void main(){
  vec3 p = normalize(vObj);
  float c = fbm(p*2.6 + vec3(0.0, 3.0, 0.0)) + 0.3*fbm(p*9.0);
  float a = smoothstep(0.08, 0.5, c) * 0.8;
  float diff = max(dot(normalize(vNormalW), uSun), 0.0);
  vec3 col = vec3(1.0) * (0.03 + diff * 1.1 * uLight);
  gl_FragColor = vec4(col, a);
}
`;

const ATMO_VERT = /* glsl */ `
varying vec3 vNormalV;
varying vec3 vNormalW;
void main(){
  vNormalV = normalize(normalMatrix * normal);
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const ATMO_FRAG = /* glsl */ `
uniform vec3 uSun;
uniform float uLight;
varying vec3 vNormalV;
varying vec3 vNormalW;
void main(){
  float x = clamp(-vNormalV.z, 0.0, 1.0);
  float a = pow(smoothstep(0.0, 0.6, x), 2.2);
  float f = 0.2 + 0.8 * smoothstep(-0.4, 0.6, dot(normalize(vNormalW), uSun));
  gl_FragColor = vec4(vec3(0.3, 0.6, 1.0) * a * f * uLight * 1.3, 1.0);
}
`;

const STAR_VERT = /* glsl */ `
attribute float aSize;
attribute float aPhase;
attribute vec3 aColor;
uniform float uTime;
uniform float uPR;
uniform float uFade;
varying vec3 vColor;
varying float vAlpha;
void main(){
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  float tw = 0.7 + 0.3 * sin(uTime * (0.6 + aPhase * 1.8) + aPhase * 20.0);
  vColor = aColor;
  vAlpha = tw * uFade;
  gl_PointSize = aSize * uPR * (0.85 + 0.15 * tw);
}
`;

const STAR_FRAG = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main(){
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d);
  gl_FragColor = vec4(vColor, a * a * vAlpha);
}
`;

const NEBULA_VERT = /* glsl */ `
varying vec3 vDir;
void main(){
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const NEBULA_FRAG = /* glsl */ `
uniform float uFade;
varying vec3 vDir;
${NOISE}
void main(){
  vec3 d = normalize(vDir);
  float n1 = fbm(d*2.2);
  float n2 = fbm(d*4.0 + vec3(5.0));
  vec3 c = vec3(0.012, 0.016, 0.026);
  c += vec3(0.20, 0.07, 0.34) * smoothstep(0.0, 0.8, n1) * 0.5;
  c += vec3(0.02, 0.16, 0.28) * smoothstep(0.1, 0.9, n2) * 0.45;
  float band = exp(-pow(dot(d, normalize(vec3(0.35, 1.0, 0.25))) * 3.2, 2.0));
  c += vec3(0.11, 0.11, 0.19) * band * (0.35 + 0.65 * smoothstep(-0.2, 0.6, n2));
  gl_FragColor = vec4(c * uFade, 1.0);
}
`;

// ---------- helpers ----------
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function makeGlowTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.18, "rgba(255,255,255,0.75)");
  grad.addColorStop(0.45, "rgba(255,255,255,0.18)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeStars(count: number): THREE.Points {
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const phase = new Float32Array(count);
  const palette = [new THREE.Color("#ffffff"), new THREE.Color("#cfe0ff"), new THREE.Color("#ffe6c4"), new THREE.Color("#a9c8ff")];
  const v = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    v.randomDirection().multiplyScalar(220 + Math.random() * 160);
    pos.set([v.x, v.y, v.z], i * 3);
    const c = palette[Math.floor(Math.random() * palette.length)];
    col.set([c.r, c.g, c.b], i * 3);
    size[i] = 0.8 + Math.pow(Math.random(), 7) * 3.8;
    phase[i] = Math.random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
  geo.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
  geo.setAttribute("aPhase", new THREE.BufferAttribute(phase, 1));
  const mat = new THREE.ShaderMaterial({
    vertexShader: STAR_VERT,
    fragmentShader: STAR_FRAG,
    uniforms: { uTime: { value: 0 }, uPR: { value: 1 }, uFade: { value: 0 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  return new THREE.Points(geo, mat);
}

// ---------- корабли ----------
interface ShipSpec {
  radius: number;
  tilt: [number, number, number];
  omega: number;        // угловая скорость по орбите, рад/с (знак = направление)
  arriveAngle: number;  // где на орбите корабль «встаёт» после варпа
  start: number;        // момент выхода из варпа, с
  color: string;
  from: [number, number, number]; // откуда прилетает (направление из глубины кадра)
}

const SHIPS: ShipSpec[] = [
  { radius: 4.3, tilt: [0.28, 0, 0.12], omega: 0.3, arriveAngle: 1.9, start: 3.0, color: "#60a5fa", from: [-1.0, 0.35, -1.0] },
  { radius: 5.3, tilt: [-0.32, 0, -0.22], omega: -0.22, arriveAngle: 1.2, start: 3.55, color: "#fbbf24", from: [1.0, 0.5, -0.9] },
  { radius: 4.8, tilt: [0.62, 0, 0.3], omega: 0.26, arriveAngle: 2.3, start: 4.1, color: "#4ade80", from: [-0.6, -0.6, -1.0] },
  { radius: 6.1, tilt: [0.12, 0, -0.45], omega: -0.17, arriveAngle: 0.9, start: 4.65, color: "#e879f9", from: [0.8, -0.3, -1.0] },
  { radius: 5.7, tilt: [-0.18, 0, 0.55], omega: 0.2, arriveAngle: 1.6, start: 5.2, color: "#22d3ee", from: [0.1, 0.9, -1.0] },
];
const WARP_DUR = 2.3;
const WARP_DIST = 70;
const TRAIL_N = 56;

interface Ship {
  spec: ShipSpec;
  group: THREE.Group;
  hull: THREE.Group;
  trail: THREE.Line;
  trailPos: Float32Array;
  flash: THREE.Sprite;
  plane: THREE.Quaternion;
  offset: THREE.Vector3; // смещение точки выхода из варпа относительно орбиты
  prev: THREE.Vector3;
  born: boolean;
}

function buildShipMesh(accent: THREE.Color, glowTex: THREE.Texture): { group: THREE.Group; hull: THREE.Group } {
  const hullMat = new THREE.MeshStandardMaterial({ color: 0xcfd7e3, metalness: 0.65, roughness: 0.32 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x2a3140, metalness: 0.5, roughness: 0.5 });
  const accentMat = new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.7, metalness: 0.3, roughness: 0.4 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x9fd4ff, emissive: 0x3b82f6, emissiveIntensity: 0.6, metalness: 0.2, roughness: 0.1 });

  const hull = new THREE.Group();

  // корпус: тело вращения, нос смотрит в +Z
  const profile = [[0, 0.58], [0.045, 0.48], [0.095, 0.28], [0.12, 0.02], [0.115, -0.28], [0.085, -0.4], [0, -0.4]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  const bodyGeo = new THREE.LatheGeometry(profile, 18);
  bodyGeo.rotateX(Math.PI / 2);
  hull.add(new THREE.Mesh(bodyGeo, hullMat));

  // стреловидные крылья
  for (const side of [1, -1]) {
    const s = new THREE.Shape();
    s.moveTo(0, 0.12);
    s.lineTo(0.58 * side, -0.24);
    s.lineTo(0.56 * side, -0.36);
    s.lineTo(0, -0.3);
    s.closePath();
    const wingGeo = new THREE.ExtrudeGeometry(s, { depth: 0.022, bevelEnabled: false });
    wingGeo.rotateX(Math.PI / 2);
    wingGeo.translate(0, 0.011, 0);
    const wing = new THREE.Mesh(wingGeo, hullMat);
    wing.material = hullMat;
    hull.add(wing);
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, 0.2), accentMat);
    tip.position.set(0.57 * side, 0, -0.27);
    hull.add(tip);
  }
  // полоса цвета корабля по корпусу
  const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.118, 0.012, 6, 24), accentMat);
  stripe.position.z = 0.05;
  hull.add(stripe);

  const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), glassMat);
  cockpit.scale.set(1, 0.75, 2.1);
  cockpit.position.set(0, 0.075, 0.24);
  hull.add(cockpit);

  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.095, 0.1, 16, 1, true), darkMat);
  nozzle.rotation.x = Math.PI / 2;
  nozzle.position.z = -0.44;
  hull.add(nozzle);

  const group = new THREE.Group();
  group.add(hull);

  // свечение двигателя — вне hull, чтобы не растягивалось вместе с корпусом при варпе
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color: accent.clone().lerp(new THREE.Color("#ffffff"), 0.35),
    blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
  }));
  glow.position.z = -0.52;
  glow.scale.setScalar(0.55);
  group.add(glow);

  group.scale.setScalar(0.62);
  return { group, hull };
}

// ---------- сцена ----------
export function createLandingScene(host: HTMLElement, opts: SceneOptions): LandingScene {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setClearColor(0x05070b, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.style.display = "block";
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 2000);
  const glowTex = makeGlowTexture();

  // фон
  const nebulaMat = new THREE.ShaderMaterial({
    vertexShader: NEBULA_VERT, fragmentShader: NEBULA_FRAG,
    uniforms: { uFade: { value: 0 } }, side: THREE.BackSide, depthWrite: false,
  });
  const nebula = new THREE.Mesh(new THREE.SphereGeometry(500, 48, 32), nebulaMat);
  nebula.renderOrder = -2;
  scene.add(nebula);

  const stars = makeStars(window.innerWidth < 700 ? 2600 : 5000);
  stars.renderOrder = -1;
  scene.add(stars);
  const starMat = stars.material as THREE.ShaderMaterial;

  // планета
  const sun = new THREE.Vector3();
  const sunFrom = new THREE.Vector3(-0.15, 0.3, -1).normalize(); // свет из-за планеты
  const sunTo = new THREE.Vector3(-0.85, 0.35, 0.5).normalize();
  const planetUniforms = { uSun: { value: sun }, uLight: { value: 0 } };

  const tiltGroup = new THREE.Group();
  tiltGroup.rotation.z = 0.41; // наклон оси, как у Земли (~23.4°)
  scene.add(tiltGroup);

  const planet = new THREE.Mesh(
    new THREE.SphereGeometry(PLANET_R, 128, 96),
    new THREE.ShaderMaterial({ vertexShader: SPHERE_VERT, fragmentShader: PLANET_FRAG, uniforms: planetUniforms }),
  );
  tiltGroup.add(planet);

  const clouds = new THREE.Mesh(
    new THREE.SphereGeometry(PLANET_R * 1.012, 96, 64),
    new THREE.ShaderMaterial({
      vertexShader: SPHERE_VERT, fragmentShader: CLOUD_FRAG, uniforms: planetUniforms,
      transparent: true, depthWrite: false,
    }),
  );
  tiltGroup.add(clouds);

  const atmo = new THREE.Mesh(
    new THREE.SphereGeometry(PLANET_R * 1.17, 96, 64),
    new THREE.ShaderMaterial({
      vertexShader: ATMO_VERT, fragmentShader: ATMO_FRAG, uniforms: planetUniforms,
      side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }),
  );
  scene.add(atmo);

  // свет для кораблей
  const ambient = new THREE.AmbientLight(0x8fa6d6, 0.25);
  const sunLight = new THREE.DirectionalLight(0xfff3e0, 0);
  scene.add(ambient, sunLight);

  // корабли
  const tmp = new THREE.Vector3();
  const orbitPos = (s: Ship, t: number, out: THREE.Vector3) => {
    const a = s.spec.arriveAngle + s.spec.omega * (t - s.spec.start - WARP_DUR);
    return out.set(Math.cos(a) * s.spec.radius, 0, Math.sin(a) * s.spec.radius).applyQuaternion(s.plane);
  };

  const ships: Ship[] = SHIPS.map((spec) => {
    const accent = new THREE.Color(spec.color);
    const { group, hull } = buildShipMesh(accent, glowTex);
    group.visible = false;
    scene.add(group);

    const trailPos = new Float32Array(TRAIL_N * 3);
    const trailCol = new Float32Array(TRAIL_N * 3);
    for (let i = 0; i < TRAIL_N; i++) {
      const k = Math.pow(1 - i / (TRAIL_N - 1), 1.6);
      trailCol.set([accent.r * k, accent.g * k, accent.b * k], i * 3);
    }
    const trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute("position", new THREE.BufferAttribute(trailPos, 3));
    trailGeo.setAttribute("color", new THREE.BufferAttribute(trailCol, 3));
    const trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    trail.frustumCulled = false;
    trail.visible = false;
    scene.add(trail);

    const flash = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: accent.clone().lerp(new THREE.Color("#ffffff"), 0.6),
      blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0,
    }));
    flash.visible = false;
    scene.add(flash);

    const plane = new THREE.Quaternion().setFromEuler(new THREE.Euler(...spec.tilt));
    const ship: Ship = {
      spec, group, hull, trail, trailPos, flash, plane,
      offset: new THREE.Vector3(), prev: new THREE.Vector3(), born: false,
    };
    // точка выхода из варпа: далеко в глубине кадра, «позади» по ходу орбиты
    const arrive = orbitPos(ship, spec.start + WARP_DUR, new THREE.Vector3());
    const tangent = orbitPos(ship, spec.start + WARP_DUR + 0.05, new THREE.Vector3()).sub(arrive).normalize();
    ship.offset.copy(new THREE.Vector3(...spec.from).normalize()).addScaledVector(tangent, -0.7).normalize().multiplyScalar(WARP_DIST);
    flash.position.copy(arrive).add(ship.offset);
    return ship;
  });

  const shipPos = (s: Ship, t: number, out: THREE.Vector3) => {
    const u = clamp01((t - s.spec.start) / WARP_DUR);
    const f = Math.pow(1 - u, 4); // резкое торможение после выхода из варпа
    return orbitPos(s, t, out).addScaledVector(s.offset, f);
  };

  const resetTrail = (s: Ship, p: THREE.Vector3) => {
    for (let i = 0; i < TRAIL_N; i++) s.trailPos.set([p.x, p.y, p.z], i * 3);
    (s.trail.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  };

  // камера
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  const onPointer = (e: PointerEvent) => {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
  };
  if (!opts.reducedMotion) window.addEventListener("pointermove", onPointer, { passive: true });

  const camTarget = new THREE.Vector3();
  const camFinalTarget = new THREE.Vector3();
  let aspect = 1;
  let wide = true;
  const resize = () => {
    const w = host.clientWidth || window.innerWidth;
    const h = host.clientHeight || window.innerHeight;
    aspect = w / h;
    renderer.setSize(w, h, false);
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    starMat.uniforms.uPR.value = renderer.getPixelRatio();
    // в финале планета уходит вправо (широкий экран) или вверх (узкий), освобождая место под текст
    wide = isWideLayout(w, h);
    if (wide) camFinalTarget.set(-3.4, 0, 0);
    else camFinalTarget.set(0, -4.6, 0);
  };
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();

  // время
  let T = opts.reducedMotion ? 10 : (opts.startAt ?? 0);
  const timeScale = opts.reducedMotion ? 0.25 : 1;
  const fired = new Set<Phase>();
  let last = performance.now();

  const firePhases = () => {
    for (const [at, p] of PHASES) {
      if (T >= at && !fired.has(p)) {
        fired.add(p);
        opts.onPhase(p);
      }
    }
  };

  const frame = () => {
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.05) * timeScale;
    last = now;
    T += dt;
    firePhases();

    const fade = smooth(0, 1.6, T);
    starMat.uniforms.uTime.value = T;
    starMat.uniforms.uFade.value = fade;
    nebulaMat.uniforms.uFade.value = fade;

    // «восход»: свет выходит из-за планеты
    const k = easeInOutCubic(clamp01((T - 0.3) / 4.5));
    sun.copy(sunFrom).lerp(sunTo, k).normalize();
    const light = 0.12 + 0.88 * smooth(0.2, 3.8, T);
    planetUniforms.uLight.value = light;
    sunLight.position.copy(sun).multiplyScalar(10);
    sunLight.intensity = 2.6 * light;

    planet.rotation.y = 0.9 + T * 0.06;
    clouds.rotation.y = 0.9 + T * 0.075;

    // камера: подлёт, затем смещение под финальный текст, плюс лёгкий параллакс
    const fly = easeInOutCubic(clamp01(T / 5));
    const fin = easeInOutCubic(smooth(5.8, 9.0, T));
    // на узких экранах камера отъезжает дальше, чтобы планета влезла по ширине и над текстом
    const dist = wide ? 16.5 : THREE.MathUtils.lerp(aspect < 1 ? 21 : 17, aspect < 1 ? 25 : 21, fin);
    pointer.sx += (pointer.x - pointer.sx) * 0.04;
    pointer.sy += (pointer.y - pointer.sy) * 0.04;
    camTarget.copy(camFinalTarget).multiplyScalar(fin);
    camera.position.set(
      camTarget.x * 0.55 + pointer.sx * 0.7,
      THREE.MathUtils.lerp(7, 1.1, fly) + camTarget.y * 0.35 - pointer.sy * 0.45,
      THREE.MathUtils.lerp(46, dist, fly),
    );
    camera.lookAt(camTarget);

    // корабли
    for (const s of ships) {
      const age = T - s.spec.start;
      if (age < 0) continue;
      const p = shipPos(s, T, tmp);
      if (!s.born) {
        s.born = true;
        s.group.visible = true;
        s.trail.visible = true;
        s.prev.copy(shipPos(s, T - 0.016, new THREE.Vector3()));
        resetTrail(s, s.prev);
      }
      // вспышка выхода из варпа
      const fu = age / 0.8;
      s.flash.visible = fu < 1;
      if (s.flash.visible) {
        s.flash.scale.setScalar(2 + 14 * fu);
        (s.flash.material as THREE.SpriteMaterial).opacity = Math.pow(1 - fu, 2);
      }

      const vel = shipPos(s, T + 0.02, new THREE.Vector3()).sub(p);
      const speed = vel.length() / 0.02;
      s.group.position.copy(p);
      s.group.lookAt(tmp.copy(p).add(vel));
      // растяжение корпуса на высокой скорости — эффект варпа
      const stretch = 1 + Math.min(speed * 0.05, 9);
      s.hull.scale.set(1 / Math.sqrt(stretch), 1 / Math.sqrt(stretch), stretch);

      // шлейф: сдвигаем историю и пишем текущую позицию двигателя
      s.trailPos.copyWithin(3, 0, (TRAIL_N - 1) * 3);
      const back = vel.normalize().multiplyScalar(-0.3);
      s.trailPos.set([s.group.position.x + back.x, s.group.position.y + back.y, s.group.position.z + back.z], 0);
      (s.trail.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }

    renderer.render(scene, camera);
  };

  renderer.setAnimationLoop(frame);

  const skip = () => {
    if (T >= FINAL_T) return;
    T = FINAL_T + 0.6;
    for (const s of ships) {
      s.born = true;
      s.group.visible = true;
      s.trail.visible = true;
      s.flash.visible = false;
      resetTrail(s, shipPos(s, T, new THREE.Vector3()));
    }
  };

  const dispose = () => {
    renderer.setAnimationLoop(null);
    ro.disconnect();
    window.removeEventListener("pointermove", onPointer);
    const mats = new Set<THREE.Material>();
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => mats.add(x));
      else if (mat) mats.add(mat);
    });
    mats.forEach((m) => m.dispose());
    glowTex.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  };

  return { skip, dispose };
}
