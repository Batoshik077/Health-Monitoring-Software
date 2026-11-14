/**
 * 3D-сцена приветственного лендинга: реалистичная Земля, МКС и корабли «Союз».
 *
 * Ассеты (frontend/public/landing/):
 *   earth_day / earth_night / earth_bump_roughness_clouds — текстуры Земли © Solar System Scope, CC BY 4.0
 *     (взяты из примеров three.js; каналы третьей: R — рельеф, G — суша/океан, B — облака)
 *   iss.glb — модель МКС из NASA 3D Resources (свободное использование)
 * «Союз» строится процедурно по фотографиям — без внешних файлов.
 *
 * Время сцены T (секунды, идёт после загрузки ассетов):
 *   0–5   камера подлетает, свет «восходит» из-за Земли
 *   2.6–7 МКС и «Союзы» прилетают и тормозят на орбитах
 *   ≥7.2  финальный кадр: Земля смещается, освобождая место под текст
 */
import * as THREE from "three";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export type Phase = "ready" | "caption1" | "caption2" | "final";

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
const EARTH_R = 2.6;
const ASSETS = `${import.meta.env.BASE_URL}landing/`;

// ---------- шейдеры Земли ----------
const EARTH_VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vPosW;
void main(){
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vPosW = wp.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const EARTH_FRAG = /* glsl */ `
uniform sampler2D uDay;
uniform sampler2D uNight;
uniform sampler2D uBRC;
uniform vec3 uSun;
uniform float uLight;
varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vPosW;

// bump-мэппинг по производным экрана (как perturbNormalArb в three.js)
vec3 perturb(vec3 p, vec3 n, vec2 dH){
  vec3 sx = dFdx(p), sy = dFdy(p);
  vec3 r1 = cross(sy, n), r2 = cross(n, sx);
  float det = dot(sx, r1);
  vec3 g = sign(det) * (dH.x * r1 + dH.y * r2);
  return normalize(abs(det) * n - g);
}

void main(){
  vec3 v = normalize(cameraPosition - vPosW);
  vec3 n0 = normalize(vNormalW);
  vec3 brc = texture2D(uBRC, vUv).rgb;
  float h = brc.r;
  vec3 n = perturb(vPosW, n0, vec2(dFdx(h), dFdy(h)) * 0.011);

  vec3 day = texture2D(uDay, vUv).rgb;
  vec3 night = texture2D(uNight, vUv).rgb;
  float land = brc.g;

  float ndl = dot(n, uSun);
  float ndl0 = dot(n0, uSun);
  float diff = max(ndl, 0.0);
  float dayMix = smoothstep(-0.18, 0.3, ndl0);

  vec3 col = day * diff * 2.4 * uLight;

  // блик Солнца на океане
  vec3 hv = normalize(uSun + v);
  float spec = pow(max(dot(n0, hv), 0.0), 160.0) * (1.0 - land) * step(0.0, ndl0);
  col += vec3(1.0, 0.86, 0.68) * spec * 0.8 * uLight;

  // огни городов на ночной стороне
  col += night * vec3(1.0, 0.82, 0.55) * (1.0 - dayMix) * 2.2;

  // атмосфера: голубая дымка к краю диска и тёплая полоса на терминаторе
  float fres = pow(1.0 - max(dot(n0, v), 0.0), 2.4);
  vec3 atmo = vec3(0.28, 0.55, 1.0);
  col = mix(col, atmo * (0.15 + 1.6 * max(ndl0, 0.0)) * uLight, fres * smoothstep(-0.25, 0.5, ndl0) * 0.9);
  float term = 1.0 - smoothstep(0.0, 0.12, abs(ndl0 + 0.03));
  col += vec3(0.9, 0.35, 0.12) * term * fres * 0.1 * uLight;

  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

const CLOUD_FRAG = /* glsl */ `
uniform sampler2D uBRC;
uniform vec3 uSun;
uniform float uLight;
varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vPosW;
void main(){
  vec3 n = normalize(vNormalW);
  float c = smoothstep(0.18, 0.95, texture2D(uBRC, vUv).b);
  float ndl = dot(n, uSun);
  float lit = smoothstep(-0.15, 0.45, ndl);
  vec3 col = vec3(1.0) * (max(ndl, 0.0) * 2.3 + 0.015) * uLight;
  gl_FragColor = vec4(col, c * mix(0.25, 0.95, lit));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
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
  float a = pow(smoothstep(0.0, 0.62, x), 2.6);
  float f = 0.08 + 0.92 * smoothstep(-0.35, 0.55, dot(normalize(vNormalW), uSun));
  gl_FragColor = vec4(vec3(0.32, 0.6, 1.0) * a * f * uLight * 1.1, 1.0);
}
`;

// ---------- звёзды и фон ----------
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
  float tw = 0.75 + 0.25 * sin(uTime * (0.5 + aPhase * 1.5) + aPhase * 20.0);
  vColor = aColor;
  vAlpha = tw * uFade;
  gl_PointSize = aSize * uPR;
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

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main(){
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// Едва заметная полоса Млечного Пути — без «мультяшной» туманности
const SKY_FRAG = /* glsl */ `
uniform float uFade;
varying vec3 vDir;
float hash(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
float vnoise(vec3 p){
  vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(hash(i), hash(i+vec3(1,0,0)), f.x), mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x), mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y), f.z);
}
void main(){
  vec3 d = normalize(vDir);
  float band = exp(-pow(dot(d, normalize(vec3(0.35, 1.0, 0.25))) * 3.6, 2.0));
  float n = vnoise(d * 6.0) * 0.6 + vnoise(d * 14.0) * 0.4;
  vec3 c = vec3(0.07, 0.075, 0.1) * band * (0.35 + 0.65 * n);
  gl_FragColor = vec4(c * uFade, 1.0);
}
`;

// Окружение для отражений на металле: Земля снизу, чёрный космос, яркое Солнце
const ENV_FRAG = /* glsl */ `
uniform vec3 uSun;
varying vec3 vDir;
void main(){
  vec3 d = normalize(vDir);
  float earth = smoothstep(0.02, 0.3, -d.y);
  vec3 c = mix(vec3(0.0), vec3(0.05, 0.12, 0.26), earth);
  c += vec3(0.3, 0.5, 0.9) * exp(-pow((d.y + 0.04) * 14.0, 2.0)) * 0.5;
  c += vec3(1.0, 0.96, 0.9) * pow(max(dot(d, uSun), 0.0), 600.0) * 60.0;
  gl_FragColor = vec4(c, 1.0);
}
`;

// ---------- helpers ----------
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, srgb = true) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

function makeGlowTexture() {
  return canvasTexture(128, 128, (g) => {
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.2, "rgba(255,255,255,0.6)");
    grad.addColorStop(0.5, "rgba(255,255,255,0.12)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
  });
}

/** Ячейки солнечной батареи: тёмно-синие элементы с серебристыми шинами. */
function makeSolarTexture() {
  return canvasTexture(256, 256, (g) => {
    g.fillStyle = "#b9bec6";
    g.fillRect(0, 0, 256, 256);
    const n = 8, s = 256 / n;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const grad = g.createLinearGradient(x * s, y * s, (x + 1) * s, (y + 1) * s);
        const k = 0.85 + Math.random() * 0.3;
        grad.addColorStop(0, `rgb(${18 * k},${34 * k},${78 * k})`);
        grad.addColorStop(1, `rgb(${10 * k},${22 * k},${56 * k})`);
        g.fillStyle = grad;
        g.fillRect(x * s + 1.5, y * s + 1.5, s - 3, s - 3);
        g.fillStyle = "rgba(190,200,215,0.18)";
        g.fillRect(x * s + 1.5, y * s + s / 2, s - 3, 1);
      }
    }
  });
}

/** Карта нормалей «мятой» термоизоляционной плёнки (ЭВТИ). */
function makeFoilNormal() {
  const W = 256;
  const c = document.createElement("canvas");
  c.width = c.height = W;
  const g = c.getContext("2d")!;
  g.fillStyle = "#808080";
  g.fillRect(0, 0, W, W);
  for (let i = 0; i < 900; i++) {
    const v = Math.floor(80 + Math.random() * 100);
    g.fillStyle = `rgba(${v},${v},${v},0.35)`;
    g.beginPath();
    const x = Math.random() * W, y = Math.random() * W, r = 6 + Math.random() * 26;
    for (let k = 0; k < 3; k++) {
      const a = Math.random() * Math.PI * 2;
      const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      if (k === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.closePath();
    g.fill();
  }
  const src = g.getImageData(0, 0, W, W).data;
  const out = g.createImageData(W, W);
  const H = (x: number, y: number) => src[(((y + W) % W) * W + ((x + W) % W)) * 4] / 255;
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * 3;
      const dy = (H(x, y + 1) - H(x, y - 1)) * 3;
      const l = Math.hypot(dx, dy, 1);
      out.data.set([((-dx / l) * 0.5 + 0.5) * 255, ((-dy / l) * 0.5 + 0.5) * 255, (1 / l * 0.5 + 0.5) * 255, 255], (y * W + x) * 4);
    }
  }
  g.putImageData(out, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Полосы радиаторов приборного отсека «Союза». */
function makeRadiatorTexture() {
  return canvasTexture(256, 64, (g) => {
    g.fillStyle = "#dcdcd6";
    g.fillRect(0, 0, 256, 64);
    for (let x = 0; x < 256; x += 16) {
      g.fillStyle = "#9da1a3";
      g.fillRect(x, 0, 2, 64);
    }
    g.fillStyle = "rgba(0,0,0,0.08)";
    g.fillRect(0, 28, 256, 3);
  });
}

function makeStars(count: number): THREE.Points {
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const phase = new Float32Array(count);
  const palette = [new THREE.Color("#ffffff"), new THREE.Color("#dfe8ff"), new THREE.Color("#fff1dc"), new THREE.Color("#c4d6ff")];
  const v = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    v.randomDirection().multiplyScalar(220 + Math.random() * 160);
    pos.set([v.x, v.y, v.z], i * 3);
    const c = palette[Math.floor(Math.random() * palette.length)];
    const b = 0.35 + Math.pow(Math.random(), 3) * 0.65;
    col.set([c.r * b, c.g * b, c.b * b], i * 3);
    size[i] = 0.9 + Math.pow(Math.random(), 8) * 3.2;
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

// ---------- «Союз» (размеры в метрах, нос — бытовой отсек — смотрит в +Z) ----------
interface CraftTextures { solar: THREE.Texture; foil: THREE.Texture; radiator: THREE.Texture; glow: THREE.Texture }

function lathe(profile: number[][], mat: THREE.Material, segments = 48) {
  const geo = new THREE.LatheGeometry(profile.map(([r, z]) => new THREE.Vector2(r, z)), segments);
  geo.rotateX(Math.PI / 2); // ось вращения Y → Z
  return new THREE.Mesh(geo, mat);
}

function buildSoyuz(tex: CraftTextures): { group: THREE.Group; engine: THREE.Sprite } {
  const foilNormal = tex.foil.clone();
  foilNormal.repeat.set(5, 3);
  foilNormal.needsUpdate = true;
  const foil = new THREE.MeshStandardMaterial({
    color: 0xd6cfbd, metalness: 0.9, roughness: 0.36, normalMap: foilNormal, normalScale: new THREE.Vector2(0.7, 0.7),
  });
  const foilLight = foil.clone();
  foilLight.color.set(0xe3e1da);
  const radiatorMap = tex.radiator.clone();
  radiatorMap.repeat.set(6, 1);
  radiatorMap.needsUpdate = true;
  const paint = new THREE.MeshStandardMaterial({ color: 0xffffff, map: radiatorMap, metalness: 0.2, roughness: 0.5 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2f3236, metalness: 0.7, roughness: 0.45 });
  const metal = new THREE.MeshStandardMaterial({ color: 0xb8bcc2, metalness: 0.9, roughness: 0.3 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x0b0f16, metalness: 0.2, roughness: 0.05 });
  const solar = new THREE.MeshStandardMaterial({ map: tex.solar, metalness: 0.55, roughness: 0.28 });
  const panelBack = new THREE.MeshStandardMaterial({ color: 0x8f8a7c, metalness: 0.4, roughness: 0.6 });

  const g = new THREE.Group();

  // приборно-агрегатный отсек с расширяющейся «юбкой»
  g.add(lathe([[0, -3.85], [0.95, -3.85], [1.36, -3.7], [1.36, -3.15], [1.1, -2.6], [1.1, -1.05], [0.98, -0.92], [0, -0.92]], paint));
  // спускаемый аппарат — «фара»
  g.add(lathe([[0, -0.95], [0.9, -0.93], [1.08, -0.78], [1.1, -0.55], [1.04, 0.0], [0.9, 0.6], [0.72, 1.08], [0.5, 1.3], [0, 1.32]], foil));
  // переходной шлюз и бытовой отсек
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.55, 0.3, 32), dark);
  neck.rotation.x = Math.PI / 2;
  neck.position.z = 1.38;
  g.add(neck);
  const orbital = new THREE.Mesh(new THREE.SphereGeometry(1.12, 48, 32), foilLight);
  orbital.scale.set(1, 1, 1.12);
  orbital.position.z = 2.62;
  g.add(orbital);
  // стыковочный агрегат «штырь»
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 0.25, 32), metal);
  ring.rotation.x = Math.PI / 2;
  ring.position.z = 3.85;
  g.add(ring);
  const probe = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.6, 12), metal);
  probe.rotation.x = Math.PI / 2;
  probe.position.z = 4.25;
  g.add(probe);
  // иллюминаторы
  for (const [z, a] of [[2.5, 0.6], [0.1, -0.4]] as const) {
    const w = new THREE.Mesh(new THREE.CircleGeometry(0.11, 20), glass);
    const r = z > 1 ? 1.12 : 1.05;
    w.position.set(Math.sin(a) * (r + 0.005), Math.cos(a) * (r + 0.005), z);
    w.lookAt(w.position.clone().multiplyScalar(2).setZ(z));
    g.add(w);
  }
  // двигатель
  g.add(lathe([[0.18, -3.85], [0.32, -4.15], [0.42, -4.35], [0.38, -4.35], [0.14, -3.88]], dark, 24));
  // антенны «Курс» и штыревые
  const rod = (len: number, x: number, y: number, z: number, rx = 0, rz = 0) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, len, 6), metal);
    m.position.set(x, y, z);
    m.rotation.set(rx, 0, rz);
    g.add(m);
  };
  rod(1.4, 0.55, 1.1, 3.1, 0.4, -0.45);
  rod(1.2, -0.7, -0.9, 2.2, -0.3, 0.6);
  rod(1.8, 0, 1.6, -2.9, 0.15, 0);
  const dish = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 8, 0, Math.PI * 2, 0, Math.PI / 3), metal);
  dish.position.set(0.95, 0.9, 3.35);
  dish.rotation.set(0.6, 0, -0.8);
  g.add(dish);

  // солнечные батареи: два крыла по 4 секции
  for (const side of [1, -1]) {
    const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.75, 8), metal);
    boom.rotation.z = Math.PI / 2;
    boom.position.set(side * 1.45, 0, -2.25);
    g.add(boom);
    for (let i = 0; i < 4; i++) {
      const seg = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.03, 1.3), [panelBack, panelBack, solar, panelBack, panelBack, panelBack]);
      seg.position.set(side * (1.85 + i * 1.03 + 0.49), 0, -2.25);
      g.add(seg);
    }
  }

  // свечение двигателя при торможении
  const engine = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex.glow, color: 0xbfd8ff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0,
  }));
  engine.position.z = -4.6;
  engine.scale.setScalar(2.4);
  g.add(engine);

  g.scale.setScalar(0.1);
  return { group: g, engine };
}

/** Перекрашивает модель МКС из NASA 3D Resources: у неё нет текстур, только безымянные материалы. */
function dressISS(root: THREE.Object3D, tex: CraftTextures) {
  const solarMap = tex.solar.clone();
  solarMap.needsUpdate = true;
  const solar = new THREE.MeshStandardMaterial({ map: solarMap, metalness: 0.55, roughness: 0.3, side: THREE.DoubleSide });
  const truss = new THREE.MeshStandardMaterial({ color: 0xa3a7ad, metalness: 0.85, roughness: 0.38 });
  const module = new THREE.MeshStandardMaterial({ color: 0xe4e2db, metalness: 0.12, roughness: 0.55 });
  const moduleShade = new THREE.MeshStandardMaterial({ color: 0xc9c7c0, metalness: 0.3, roughness: 0.45 });
  const radiator = new THREE.MeshStandardMaterial({ color: 0xf2f3f4, metalness: 0.05, roughness: 0.42, side: THREE.DoubleSide });
  const gold = new THREE.MeshStandardMaterial({ color: 0xc9a253, metalness: 0.9, roughness: 0.35 });

  // в модели лежат 7 отдельных колец (bendedtru*, pCylinder*) в стороне от станции — убираем
  const stray: THREE.Object3D[] = [];
  root.traverse((o) => /^(bendedtru|pCylinder)/.test(o.name) && stray.push(o));
  stray.forEach((o) => o.removeFromParent());

  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const name = (m.material as THREE.Material).name ?? "";
    if (name.startsWith("lambert7")) {
      // солнечные крылья: у геометрии нет UV — строим их из координат плоскости панели
      const p = m.geometry.attributes.position;
      const uv = new Float32Array(p.count * 2);
      for (let i = 0; i < p.count; i++) {
        uv[i * 2] = p.getZ(i) / 1.1;
        uv[i * 2 + 1] = p.getY(i) / 1.1;
      }
      m.geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
      m.material = solar;
    } else if (/^(anisotropic1|apollohorns|bendedtruss)/.test(name)) m.material = truss;
    else if (/^(soyuz_blinn4|lambert3)/.test(name)) m.material = radiator;
    else if (/^(lambert4|blinn4)/.test(name)) m.material = gold;
    else if (/^(blinn3|lambert6|initialShading)/.test(name)) m.material = moduleShade;
    else m.material = module;
  });
}

// ---------- корабли на орбитах ----------
interface CraftSpec {
  kind: "iss" | "soyuz";
  /** Точка, где корабль заканчивает торможение (подобрана под финальный кадр широкой раскладки). */
  arrive: [number, number, number];
  /** Другая точка прибытия для узкой раскладки (телефоны), если стандартная мешает тексту. */
  arriveNarrow?: [number, number, number];
  /** Направление движения по орбите в этой точке; плоскость орбиты = (arrive, dir). */
  dir: [number, number, number];
  omega: number; // рад/с
  start: number;
  dur: number;
  from: [number, number, number]; // откуда прилетает (траектория не должна пересекать Землю)
  dist: number;
}

const CRAFTS: CraftSpec[] = [
  // МКС: ферма поперёк кадра, панели развёрнуты к зрителю — ракурс как на фото станции над Землёй
  { kind: "iss", arrive: [-2.29, -1.31, 3.94], dir: [0.35, 1, 0], omega: 0.03, start: 2.6, dur: 3.8, from: [-1, 0.2, -0.6], dist: 30 },
  // «Союз» рядом со станцией
  { kind: "soyuz", arrive: [-0.56, -0.25, 3.23], dir: [0.35, 1, 0], omega: 0.04, start: 3.6, dur: 3.4, from: [1, -0.2, 0.3], dist: 40 },
  // второй «Союз» — ближе к камере: крупный план
  { kind: "soyuz", arrive: [-3.07, 1.91, 7.11], arriveNarrow: [1.48, 0.74, 8.11], dir: [1, 0.15, 0.2], omega: 0.02, start: 4.4, dur: 3.6, from: [1, 0.5, -0.4], dist: 40 },
];

interface Craft {
  spec: CraftSpec;
  group: THREE.Group;
  engine?: THREE.Sprite;
  arrive: THREE.Vector3;
  axis: THREE.Vector3; // нормаль плоскости орбиты
  offset: THREE.Vector3;
}

// ---------- сцена ----------
export function createLandingScene(host: HTMLElement, opts: SceneOptions): LandingScene {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setClearColor(0x020306, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.domElement.style.display = "block";
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 2000);
  const disposables: { dispose: () => void }[] = [];

  // фон: звёзды и слабый Млечный Путь
  const skyMat = new THREE.ShaderMaterial({
    vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, uniforms: { uFade: { value: 0 } },
    side: THREE.BackSide, depthWrite: false, toneMapped: false,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), skyMat);
  sky.renderOrder = -2;
  scene.add(sky);
  const stars = makeStars(window.innerWidth < 700 ? 3000 : 6000);
  stars.renderOrder = -1;
  scene.add(stars);
  const starMat = stars.material as THREE.ShaderMaterial;

  // солнце
  const sun = new THREE.Vector3();
  const sunFrom = new THREE.Vector3(-0.1, 0.25, -1).normalize(); // из-за планеты
  const sunTo = new THREE.Vector3(-0.85, 0.32, 0.45).normalize();
  sun.copy(sunTo);

  // карта окружения для отражений на металле
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  const envMat = new THREE.ShaderMaterial({
    vertexShader: SKY_VERT, fragmentShader: ENV_FRAG, uniforms: { uSun: { value: sunTo.clone() } }, side: THREE.BackSide,
  });
  envScene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 64, 32), envMat));
  const envRT = pmrem.fromScene(envScene, 0.02);
  scene.environment = envRT.texture;
  envScene.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
  envMat.dispose();
  pmrem.dispose();
  disposables.push(envRT);

  // Земля
  const blank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
  blank.needsUpdate = true;
  const earthUniforms = {
    uDay: { value: blank as THREE.Texture },
    uNight: { value: blank as THREE.Texture },
    uBRC: { value: blank as THREE.Texture },
    uSun: { value: sun },
    uLight: { value: 0 },
  };
  const tiltGroup = new THREE.Group();
  tiltGroup.rotation.z = 0.41; // наклон оси ≈ 23.4°
  scene.add(tiltGroup);
  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(EARTH_R, 160, 120),
    new THREE.ShaderMaterial({ vertexShader: EARTH_VERT, fragmentShader: EARTH_FRAG, uniforms: earthUniforms }),
  );
  tiltGroup.add(earth);
  const clouds = new THREE.Mesh(
    new THREE.SphereGeometry(EARTH_R * 1.008, 128, 96),
    new THREE.ShaderMaterial({
      vertexShader: EARTH_VERT, fragmentShader: CLOUD_FRAG, uniforms: earthUniforms, transparent: true, depthWrite: false,
    }),
  );
  tiltGroup.add(clouds);
  const atmo = new THREE.Mesh(
    new THREE.SphereGeometry(EARTH_R * 1.06, 96, 64),
    new THREE.ShaderMaterial({
      vertexShader: ATMO_VERT, fragmentShader: ATMO_FRAG, uniforms: earthUniforms,
      side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    }),
  );
  scene.add(atmo);

  // свет: Солнце + отражённый от Земли голубоватый свет
  const sunLight = new THREE.DirectionalLight(0xfff4e6, 0);
  const earthShine = new THREE.PointLight(0x6f9bdc, 0, 0, 0);
  const ambient = new THREE.AmbientLight(0x9fb4d9, 0.04);
  scene.add(sunLight, earthShine, ambient);

  // корабли
  const tex: CraftTextures = { solar: makeSolarTexture(), foil: makeFoilNormal(), radiator: makeRadiatorTexture(), glow: makeGlowTexture() };
  disposables.push(...Object.values(tex));

  const orbitPos = (c: Craft, t: number, out: THREE.Vector3) =>
    out.copy(c.arrive).applyAxisAngle(c.axis, c.spec.omega * (t - c.spec.start - c.spec.dur));
  const craftPos = (c: Craft, t: number, out: THREE.Vector3) => {
    const u = clamp01((t - c.spec.start) / c.spec.dur);
    return orbitPos(c, t, out).addScaledVector(c.offset, Math.pow(1 - u, 3));
  };

  const crafts: Craft[] = [];
  let wide = isWideLayout(host.clientWidth || window.innerWidth, host.clientHeight || window.innerHeight);
  const setOrbit = (c: Craft) => {
    c.arrive.set(...(!wide && c.spec.arriveNarrow ? c.spec.arriveNarrow : c.spec.arrive));
    c.axis.crossVectors(c.arrive, new THREE.Vector3(...c.spec.dir)).normalize();
  };
  const addCraft =(spec: CraftSpec, group: THREE.Group, engine?: THREE.Sprite) => {
    const c: Craft = { spec, group, engine, arrive: new THREE.Vector3(), axis: new THREE.Vector3(), offset: new THREE.Vector3() };
    setOrbit(c);
    c.offset.set(...spec.from).normalize().multiplyScalar(spec.dist);
    group.visible = false;
    scene.add(group);
    crafts.push(c);
  };
  for (const spec of CRAFTS) {
    if (spec.kind === "soyuz") {
      const { group, engine } = buildSoyuz(tex);
      addCraft(spec, group, engine);
    }
  }

  // загрузка ассетов: время сцены не идёт, пока не загрузятся текстуры Земли и МКС
  let ready = false;
  let disposed = false;
  const texLoader = new THREE.TextureLoader();
  const loadTex = (file: string, srgb: boolean) =>
    texLoader.loadAsync(ASSETS + file).then((t) => {
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      disposables.push(t);
      return t;
    });
  const issSpec = CRAFTS.find((c) => c.kind === "iss")!;
  // модель NASA сжата Draco — декодер лежит в public/landing/draco (скопирован из three/examples)
  const draco = new DRACOLoader().setDecoderPath(ASSETS + "draco/").setDecoderConfig({ type: "wasm" });
  const loadISS = new GLTFLoader().setDRACOLoader(draco).loadAsync(ASSETS + "iss.glb").finally(() => draco.dispose()).then((gltf) => {
    const model = gltf.scene;
    dressISS(model, tex);
    // центрируем и масштабируем: ферма ≈ 2.5 единицы сцены
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    model.position.sub(box.getCenter(new THREE.Vector3()));
    const g = new THREE.Group();
    g.add(model);
    g.scale.setScalar(2.5 / Math.max(size.x, size.y, size.z));
    return g;
  });
  const timeout = new Promise<void>((r) => setTimeout(r, 12000));
  Promise.race([
    Promise.allSettled([
      loadTex("earth_day_4096.jpg", true).then((t) => (earthUniforms.uDay.value = t)),
      loadTex("earth_night_4096.jpg", true).then((t) => (earthUniforms.uNight.value = t)),
      loadTex("earth_bump_roughness_clouds_4096.jpg", false).then((t) => (earthUniforms.uBRC.value = t)),
      loadISS.then((g) => { if (!disposed) addCraft(issSpec, g); }),
    ]).then((rs) => rs.forEach((r) => r.status === "rejected" && console.warn("landing: ассет не загрузился", r.reason))),
    timeout,
  ]).then(() => {
    if (disposed) return;
    ready = true;
    opts.onPhase("ready");
  });

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
  const resize = () => {
    const w = host.clientWidth || window.innerWidth;
    const h = host.clientHeight || window.innerHeight;
    aspect = w / h;
    renderer.setSize(w, h, false);
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    starMat.uniforms.uPR.value = renderer.getPixelRatio();
    // в финале Земля уходит вправо (широкий экран) или вверх (узкий), освобождая место под текст
    const wasWide = wide;
    wide = isWideLayout(w, h);
    if (wide !== wasWide) crafts.forEach(setOrbit);
    if (wide) camFinalTarget.set(-3.4, 0, 0);
    else camFinalTarget.set(0, -4.6, 0);
  };
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();

  // время
  let T = opts.reducedMotion ? 12 : (opts.startAt ?? 0);
  const timeScale = opts.reducedMotion ? 0.25 : 1;
  const fired = new Set<Phase>();
  let last = performance.now();
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const basis = new THREE.Matrix4();
  const radial = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const normal = new THREE.Vector3();

  const frame = () => {
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.1) * timeScale;
    last = now;
    if (ready) {
      T += dt;
      for (const [at, p] of PHASES) {
        if (T >= at && !fired.has(p)) {
          fired.add(p);
          opts.onPhase(p);
        }
      }
    }

    const fade = ready ? smooth(0, 2, T) : 0;
    starMat.uniforms.uTime.value = T;
    starMat.uniforms.uFade.value = fade;
    skyMat.uniforms.uFade.value = fade;

    // «восход»: свет выходит из-за Земли
    const k = easeInOutCubic(clamp01((T - 0.2) / 4.8));
    sun.copy(sunFrom).lerp(sunTo, k).normalize();
    const light = ready ? 0.1 + 0.9 * smooth(0.1, 4.2, T) : 0;
    earthUniforms.uLight.value = light;
    sunLight.position.copy(sun).multiplyScalar(20);
    sunLight.intensity = 3.2 * light;
    earthShine.intensity = 0.9 * light;

    // вращение Земли: запад → восток; к финалу к камере повёрнуты Америки
    earth.rotation.y = -0.95 + T * 0.03;
    clouds.rotation.y = -0.95 + T * 0.034;

    // камера: подлёт, смещение под финальный текст, лёгкий параллакс
    const fly = easeInOutCubic(clamp01(T / 5.5));
    const fin = easeInOutCubic(smooth(5.8, 9.0, T));
    const dist = wide ? 16.5 : THREE.MathUtils.lerp(aspect < 1 ? 21 : 17, aspect < 1 ? 25 : 21, fin);
    pointer.sx += (pointer.x - pointer.sx) * 0.04;
    pointer.sy += (pointer.y - pointer.sy) * 0.04;
    camTarget.copy(camFinalTarget).multiplyScalar(fin);
    camera.position.set(
      camTarget.x * 0.55 + pointer.sx * 0.7,
      THREE.MathUtils.lerp(6, 1.1, fly) + camTarget.y * 0.35 - pointer.sy * 0.45,
      THREE.MathUtils.lerp(44, dist, fly),
    );
    camera.lookAt(camTarget);

    // корабли
    for (const c of crafts) {
      const age = T - c.spec.start;
      c.group.visible = ready && age >= 0;
      if (!c.group.visible) continue;
      const p = craftPos(c, T, tmp);
      c.group.position.copy(p);
      const u = clamp01(age / c.spec.dur);
      if (c.spec.kind === "iss") {
        // МКС: модули вдоль скорости, ферма поперёк орбиты, «низ» к Земле
        orbitPos(c, T, radial).normalize().negate(); // ось X модели — к Земле
        orbitPos(c, T + 0.1, tangent).sub(orbitPos(c, T, tmp2)).normalize();
        normal.crossVectors(radial, tangent).normalize(); // правая тройка, без зеркалирования
        basis.makeBasis(radial, tangent, normal);
        c.group.quaternion.setFromRotationMatrix(basis);
      } else {
        // «Союз»: нос по направлению движения, солнечные батареи параллельно горизонту
        const vel = craftPos(c, T + 0.05, tmp2).sub(p);
        c.group.up.copy(p).normalize();
        c.group.lookAt(vel.add(p));
        if (c.engine) {
          // тормозной импульс: двигатель светится, пока корабль замедляется
          (c.engine.material as THREE.SpriteMaterial).opacity = Math.pow(1 - u, 1.5) * 0.9;
        }
      }
    }

    renderer.render(scene, camera);
  };
  renderer.setAnimationLoop(frame);

  const skip = () => {
    if (T < FINAL_T) T = FINAL_T + 0.6;
  };

  const dispose = () => {
    disposed = true;
    renderer.setAnimationLoop(null);
    ro.disconnect();
    window.removeEventListener("pointermove", onPointer);
    const mats = new Set<THREE.Material>();
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => mats.add(x));
      else if (mat) mats.add(mat);
    });
    mats.forEach((m) => {
      const map = (m as THREE.MeshStandardMaterial).map;
      const nm = (m as THREE.MeshStandardMaterial).normalMap;
      map?.dispose();
      nm?.dispose();
      m.dispose();
    });
    disposables.forEach((d) => d.dispose());
    blank.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  };

  return { skip, dispose };
}
