import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { LAYER_IDS, SIM_SECONDS, SITES, SIZE, VERT_M, WORLD_M } from '../data/sites';
import type { LayerId, Layers, RouteStats, Site, SiteId } from '../data/sites';

export interface MarsSceneProps {
  siteId: SiteId;
  layers: Layers;
  playing: boolean;
  progress: number;
  follow: boolean;
  camKey: number;
  onProgress?: (p: number) => void;
  onStats?: (s: RouteStats) => void;
  onFinish?: () => void;
  onReady?: () => void;
}

/* ---------- math + noise (100% procedural, no assets) ---------- */
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const sm = (a: number, b: number, t: number) => {
  const k = clamp((t - a) / (b - a), 0, 1);
  return k * k * (3 - 2 * k);
};

function hash(ix: number, iz: number) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function noise(x: number, z: number) {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const xf = x - xi;
  const zf = z - zi;
  const u = xf * xf * (3 - 2 * xf);
  const v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi);
  const b = hash(xi + 1, zi);
  const c = hash(xi, zi + 1);
  const d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x: number, z: number, oct: number) {
  let s = 0;
  let a = 0.5;
  let f = 1;
  let n = 0;
  for (let i = 0; i < oct; i++) {
    s += a * noise(x * f + i * 17.3, z * f + i * 9.1);
    n += a;
    a *= 0.5;
    f *= 2.03;
  }
  return s / n;
}

/* 3D boxwork: thin raised mineral walls forming polygonal boxes */
function boxwork(x: number, z: number) {
  const w = (fbm(x * 0.04, z * 0.04, 2) - 0.5) * 16;
  const xr = x * 0.94 + z * 0.34;
  const zr = -x * 0.34 + z * 0.94;
  const u = Math.abs(Math.sin((xr + w) * 0.27));
  const v = Math.abs(Math.sin((zr - w) * 0.27));
  const wall = 1 - sm(0.04, 0.26, Math.min(u, v));
  return wall * (0.55 + 0.9 * fbm(x * 0.1, z * 0.1, 2));
}
const boxMask = (x: number, z: number) => sm(75, 28, Math.hypot(x - 5, z + 5));

function heightAt(x: number, z: number, site: Site) {
  let h = (fbm(x * 0.015, z * 0.015, 4) - 0.5) * 10 + (fbm(x * 0.07 + 9, z * 0.07, 3) - 0.5) * 2.2;
  if (site.terrain === 'sharp') {
    const m = Math.exp(-(x * x * 0.8 + (z + 85) * (z + 85)) / (2 * 50 * 50));
    const t = (42 * m) / 5;
    const fr = t - Math.floor(t);
    const terraced = (Math.floor(t) + sm(0.55, 1, fr)) * 5;
    h += 0.7 * terraced + 0.3 * 42 * m;
    h += boxwork(x, z) * boxMask(x, z) * 2.6;
  } else {
    const d = Math.hypot(x, z - 70);
    h += 24 * Math.exp(-Math.pow((d - 172) / 11, 2)) + sm(165, 195, d) * 12;
    const fx = x + 25;
    const fz = z + 55;
    const fan = Math.exp(-(fx * fx * 0.7 + fz * fz) / (2 * 38 * 38));
    const rd = 1 - Math.abs(fbm(x * 0.05, z * 0.05, 3) * 2 - 1);
    h += fan * (8 + 5 * rd);
  }
  for (const c of site.craters) {
    const d = Math.hypot(x - c.x, z - c.z);
    if (d < c.r * 2.4) {
      const t = d / c.r;
      if (t < 1) h -= c.d * (1 - t * t);
      h += c.d * 0.35 * Math.exp(-Math.pow((t - 1) / 0.28, 2));
    }
  }
  return h;
}

/* ---------- canvas texture painter ---------- */
function paint(N: number, fn: (i: number, j: number, d: Uint8ClampedArray, p: number) => void) {
  const c = document.createElement('canvas');
  c.width = N;
  c.height = N;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(N, N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) fn(i, j, img.data, (j * N + i) * 4);
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

const RAMP = [
  [40, 80, 255],
  [40, 230, 230],
  [255, 230, 60],
  [255, 60, 40],
];
function ramp(v: number) {
  const k = clamp(v, 0, 1) * 3;
  const i = Math.min(2, Math.floor(k));
  const f = k - i;
  const a = RAMP[i];
  const b = RAMP[i + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}
const MINERALS = [
  [90, 240, 255], // hydrated sulfate
  [255, 90, 220], // phyllosilicate clay
  [255, 196, 60], // hematite
];

function buildTerrain(site: Site) {
  const group = new THREE.Group();
  const SEG = 200;
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(pos.getX(i), pos.getZ(i), site));
  geo.computeVertexNormals();

  const N = 384;
  const cell = SIZE / N;
  const g = new Float32Array(N * N);
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) g[j * N + i] = heightAt(((i + 0.5) / N - 0.5) * SIZE, ((j + 0.5) / N - 0.5) * SIZE, site);

  const sl = (i: number, j: number) => {
    const i0 = Math.max(i - 1, 0);
    const i1 = Math.min(i + 1, N - 1);
    const j0 = Math.max(j - 1, 0);
    const j1 = Math.min(j + 1, N - 1);
    const gx = (g[j * N + i1] - g[j * N + i0]) / ((i1 - i0) * cell);
    const gz = (g[j1 * N + i] - g[j0 * N + i]) / ((j1 - j0) * cell);
    return { gx, gz, deg: Math.atan(Math.hypot(gx, gz)) * 57.2958 };
  };
  const px = (i: number) => ((i + 0.5) / N - 0.5) * SIZE;

  const tOpt = paint(N, (i, j, d, p) => {
    const x = px(i);
    const z = px(j);
    const h = g[j * N + i];
    const s = sl(i, j).deg;
    const n1 = fbm(x * 0.22, z * 0.22, 3);
    const n2 = noise(x * 1.6, z * 1.6);
    const t = clamp(0.3 + n1 * 0.6 + h * 0.008, 0, 1);
    const dark = [96, 54, 36];
    const mid = [170, 100, 60];
    const light = [216, 162, 110];
    const a = t < 0.5 ? dark : mid;
    const b = t < 0.5 ? mid : light;
    const k = t < 0.5 ? t * 2 : (t - 0.5) * 2;
    let r = lerp(a[0], b[0], k);
    let gg = lerp(a[1], b[1], k);
    let bb = lerp(a[2], b[2], k);
    if (s < 5) {
      const m = 0.35 * (1 - s / 5) * (0.5 + n1);
      r = lerp(r, 214, m);
      gg = lerp(gg, 162, m);
      bb = lerp(bb, 114, m);
    }
    const rock = sm(18, 34, s) * 0.8;
    r = lerp(r, 88, rock);
    gg = lerp(gg, 58, rock);
    bb = lerp(bb, 46, rock);
    if (site.terrain === 'sharp') {
      const bw = clamp(boxwork(x, z) * boxMask(x, z), 0, 1) * 0.8;
      r = lerp(r, 232, bw);
      gg = lerp(gg, 205, bw);
      bb = lerp(bb, 170, bw);
    }
    const grain = 0.9 + 0.2 * n2;
    d[p] = clamp(r * grain, 0, 255);
    d[p + 1] = clamp(gg * grain, 0, 255);
    d[p + 2] = clamp(bb * grain, 0, 255);
    d[p + 3] = 255;
  });

  const tSlope = paint(N, (i, j, d, p) => {
    const s = sl(i, j).deg;
    let c = [60, 220, 120];
    let a = 170;
    if (s >= 18) {
      c = [240, 64, 56];
      a = 225;
    } else if (s >= 10) {
      c = [245, 184, 40];
      a = 210;
    }
    d[p] = c[0];
    d[p + 1] = c[1];
    d[p + 2] = c[2];
    d[p + 3] = a;
  });

  const L = new THREE.Vector3(-90, 70, 50).normalize();
  const tRad = paint(N, (i, j, d, p) => {
    const x = px(i);
    const z = px(j);
    const { gx, gz } = sl(i, j);
    const n = new THREE.Vector3(-gx, 1, -gz).normalize();
    const shade = Math.max(0, n.dot(L));
    const elev = clamp(g[j * N + i] / 45 + 0.35, 0, 1);
    const v = 0.35 * elev + 0.45 * shade + 0.2 * fbm(x * 0.03, z * 0.03, 3);
    const c = ramp((v - 0.25) * 1.7);
    d[p] = c[0];
    d[p + 1] = c[1];
    d[p + 2] = c[2];
    d[p + 3] = 205;
  });

  const tSpec = paint(N, (i, j, d, p) => {
    const x = px(i);
    const z = px(j);
    const w = [
      (fbm(x * 0.045 + 30, z * 0.045 + 7, 3) - 0.58) / 0.07,
      (fbm(x * 0.06 - 12, z * 0.06 + 40, 3) - 0.6) / 0.07,
      (fbm(x * 0.05 + 80, z * 0.05 - 60, 3) - 0.62) / 0.07,
    ];
    let k = 0;
    if (w[1] > w[k]) k = 1;
    if (w[2] > w[k]) k = 2;
    if (w[k] > 0) {
      const c = MINERALS[k];
      d[p] = c[0];
      d[p + 1] = c[1];
      d[p + 2] = c[2];
      d[p + 3] = clamp(w[k], 0, 1) * 235;
    }
  });

  const baseMat = new THREE.MeshStandardMaterial({ color: 0x5a463c, roughness: 1 });
  const base = new THREE.Mesh(geo, baseMat);
  base.receiveShadow = true;

  const optMat = new THREE.MeshStandardMaterial({
    map: tOpt,
    roughness: 1,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const optical = new THREE.Mesh(geo, optMat);
  optical.receiveShadow = true;
  optical.renderOrder = 1;

  const overlay = (tex: THREE.Texture, f: number) => {
    const m = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -f,
        polygonOffsetUnits: -f,
      }),
    );
    m.renderOrder = f;
    return m;
  };
  const slope = overlay(tSlope, 2);
  const radiation = overlay(tRad, 3);
  const spectral = overlay(tSpec, 4);

  group.add(base, optical, slope, radiation, spectral);

  /* scattered 3D boulders */
  const COUNT = 260;
  const boulders = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(1, 1),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true }),
    COUNT,
  );
  boulders.castShadow = true;
  boulders.receiveShadow = true;
  let seed = site.terrain === 'sharp' ? 1337 : 4242;
  const rnd = () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const dummy = new THREE.Object3D();
  const col = new THREE.Color();
  for (let i = 0; i < COUNT; i++) {
    const x = (rnd() - 0.5) * SIZE * 0.9;
    const z = (rnd() - 0.5) * SIZE * 0.9;
    const s = 0.35 + Math.pow(rnd(), 3) * 2.4;
    dummy.position.set(x, heightAt(x, z, site) + s * 0.25, z);
    dummy.scale.set(s * (0.8 + rnd() * 0.6), s * (0.6 + rnd() * 0.5), s * (0.8 + rnd() * 0.6));
    dummy.rotation.set(rnd() * 3, rnd() * 6, rnd() * 3);
    dummy.updateMatrix();
    boulders.setMatrixAt(i, dummy.matrix);
    col.setHSL(0.05 + rnd() * 0.03, 0.35, 0.18 + rnd() * 0.12);
    boulders.setColorAt(i, col);
  }
  group.add(boulders);

  const meshes: Record<LayerId, THREE.Mesh> = { optical, slope, radiation, spectral };
  return { group, meshes };
}

/* ---------- actors ---------- */
function makeRover() {
  const g = new THREE.Group();
  const wheels: THREE.Mesh[] = [];
  const white = new THREE.MeshStandardMaterial({ color: 0xeeeae4, roughness: 0.6 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1d2330, roughness: 0.5, metalness: 0.4 });
  const orange = new THREE.MeshStandardMaterial({ color: 0xff7a2f, roughness: 0.6 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.8, 3.2), white);
  body.position.y = 1.0;
  const panel = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.08, 1.4), dark);
  panel.position.set(0, 1.45, 0.7);
  const cargo = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.7, 1.1), orange);
  cargo.position.set(0, 1.8, -0.8);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.2, 8), dark);
  mast.position.set(0.6, 2.0, 1.1);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.3), white);
  head.position.set(0.6, 2.7, 1.1);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8), new THREE.MeshBasicMaterial({ color: 0x7cf7d8 }));
  lamp.position.set(0.6, 2.95, 1.1);
  g.add(body, panel, cargo, mast, head, lamp);
  const wGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.4, 16);
  wGeo.rotateZ(Math.PI / 2);
  for (const z of [-1.2, 0, 1.2])
    for (const x of [-1.25, 1.25]) {
      const w = new THREE.Mesh(wGeo, dark);
      w.position.set(x, 0.5, z);
      wheels.push(w);
      g.add(w);
    }
  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = true;
  });
  g.scale.setScalar(1.3);
  return { group: g, wheels };
}

function makeAstronaut() {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xf2f2f0, roughness: 0.7 });
  const grey = new THREE.MeshStandardMaterial({ color: 0xd2d2ce, roughness: 0.8 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.8, 0.38), white);
  torso.position.y = 1.25;
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.65, 0.24), grey);
  pack.position.set(0, 1.28, -0.3);
  const helm = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), white);
  helm.position.y = 1.9;
  const visor = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0xe0a030, metalness: 0.9, roughness: 0.2 }),
  );
  visor.position.set(0, 1.9, 0.14);
  visor.scale.set(1, 0.8, 0.7);
  const patch = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.02), new THREE.MeshBasicMaterial({ color: 0xff7a2f }));
  patch.position.set(0, 1.42, 0.2);
  const limb = (x: number, y: number, len: number, w: number) => {
    const piv = new THREE.Group();
    piv.position.set(x, y, 0);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, len, w), white);
    m.position.y = -len / 2;
    piv.add(m);
    return piv;
  };
  const legL = limb(-0.14, 0.85, 0.85, 0.22);
  const legR = limb(0.14, 0.85, 0.85, 0.22);
  const armL = limb(-0.37, 1.6, 0.7, 0.16);
  const armR = limb(0.37, 1.6, 0.7, 0.16);
  g.add(torso, pack, helm, visor, patch, legL, legR, armL, armR);
  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = true;
  });
  g.scale.setScalar(1.35);
  return { group: g, legL, legR, armL, armR };
}

function disposeGroup(g: THREE.Object3D) {
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    if (mat) {
      for (const x of Array.isArray(mat) ? mat : [mat]) {
        const map = (x as THREE.MeshBasicMaterial).map;
        if (map) map.dispose();
        x.dispose();
      }
    }
  });
}

/* 2D tactical fallback for browsers without an available WebGL context. */
function drawFallback(el: HTMLDivElement) {
  const canvas = document.createElement('canvas');
  canvas.className = 'fallback-terrain';
  el.appendChild(canvas);
  const render = () => {
    const w = canvas.width = Math.max(el.clientWidth, 1);
    const h = canvas.height = Math.max(el.clientHeight, 1);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#785b5d'); sky.addColorStop(.42, '#dba87d'); sky.addColorStop(1, '#4f2c25');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
    for (let band = 0; band < 9; band++) {
      const y = h * (.43 + band * .07);
      ctx.beginPath(); ctx.moveTo(0, h);
      for (let x = 0; x <= w + 12; x += 12) {
        const ridge = Math.sin(x * .011 + band * 1.8) * (30 - band * 2) + Math.sin(x * .027 + band) * 11;
        ctx.lineTo(x, y + ridge);
      }
      ctx.lineTo(w, h); ctx.closePath();
      ctx.fillStyle = `hsl(${17 + band}, ${38 + band * 2}%, ${44 - band * 3}%)`; ctx.fill();
    }
    ctx.strokeStyle = '#80f4d5'; ctx.lineWidth = 5; ctx.shadowColor = '#5efed4'; ctx.shadowBlur = 20;
    ctx.beginPath(); ctx.moveTo(w * .36, h * .85); ctx.bezierCurveTo(w * .42, h * .69, w * .62, h * .7, w * .65, h * .48); ctx.stroke(); ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff2d7'; ctx.font = '600 12px system-ui';
    ctx.fillText('TACTICAL SURFACE / SOFTWARE RENDERING', w * .42, h * .44);
  };
  const resize = new ResizeObserver(render); resize.observe(el); render();
  return () => { resize.disconnect(); canvas.remove(); };
}

/* ---------- component ---------- */
export default function MarsScene(props: MarsSceneProps) {
  const mount = useRef<HTMLDivElement>(null);
  const P = useRef(props);
  P.current = props;
  const tRef = useRef(props.progress);
  const api = useRef<{ load: (id: SiteId) => void; recenter: () => void } | null>(null);

  useEffect(() => {
    const el = mount.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      const disposeFallback = drawFallback(el);
      P.current.onReady?.();
      return disposeFallback;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.appendChild(renderer.domElement);
    let disposeFallback: (() => void) | undefined;
    const contextLost = (event: Event) => {
      event.preventDefault();
      disposeFallback ??= drawFallback(el);
      P.current.onReady?.();
    };
    renderer.domElement.addEventListener('webglcontextlost', contextLost);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xc7946b, 90, 260);
    const camera = new THREE.PerspectiveCamera(50, 1, 0.5, 2000);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2 - 0.04;
    controls.minDistance = 6;
    controls.maxDistance = 220;
    controls.screenSpacePanning = false;

    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(900, 32, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        vertexShader: 'varying vec3 vP; void main(){ vP=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
        fragmentShader:
          'varying vec3 vP; void main(){ float t=smoothstep(-0.02,0.55,vP.y); vec3 hor=vec3(0.78,0.58,0.42); vec3 top=vec3(0.23,0.16,0.20); vec3 c=mix(hor,top,pow(t,0.7)); float s=pow(max(dot(vP,normalize(vec3(-90.,70.,50.))),0.0),400.0); c+=vec3(0.55,0.62,0.75)*s; gl_FragColor=vec4(c,1.0); }',
      }),
    );
    sky.renderOrder = -1;
    scene.add(sky);

    const sun = new THREE.DirectionalLight(0xffe2c0, 1.8);
    sun.position.set(-90, 70, 50);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -130;
    sc.right = 130;
    sc.top = 130;
    sc.bottom = -130;
    sc.near = 1;
    sc.far = 400;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.5;
    scene.add(sun);
    scene.add(new THREE.HemisphereLight(0xffd7b0, 0x5a3a2a, 0.55));

    const resize = () => {
      const w = Math.max(el.clientWidth, 1);
      const h = Math.max(el.clientHeight, 1);
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    let site: Site = SITES[P.current.siteId];
    let disposed = false;
    let loadToken = 0;
    let finished = false;
    let lastEmit = 0;
    let flying = false;
    const goalPos = new THREE.Vector3();
    const goalTarget = new THREE.Vector3();
    controls.addEventListener('start', () => {
      flying = false;
    });
    const roverPos = new THREE.Vector3();
    const roverDir = new THREE.Vector3(0, 0, 1);

    interface Ctx {
      group: THREE.Group;
      meshes: Record<LayerId, THREE.Mesh>;
      update: (t: number, time: number, playing: boolean) => void;
    }
    let ctx: Ctx | null = null;

    const recenter = () => {
      goalPos.set(...site.cam.pos);
      goalTarget.set(...site.cam.target);
      flying = true;
    };

    const build = (id: SiteId) => {
      site = SITES[id];
      if (ctx) {
        scene.remove(ctx.group);
        disposeGroup(ctx.group);
        ctx = null;
      }
      const H = (x: number, z: number) => heightAt(x, z, site);
      const { group, meshes } = buildTerrain(site);

      /* route */
      const raw = site.route.map(([x, z]) => new THREE.Vector3(x, 0, z));
      const spaced = new THREE.CatmullRomCurve3(raw, false, 'centripetal').getSpacedPoints(300);
      const sp = spaced.map((v) => new THREE.Vector3(v.x, H(v.x, v.z) + 0.5, v.z));
      const curve = new THREE.CatmullRomCurve3(sp, false, 'centripetal');
      const glow = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 300, 0.95, 6, false),
        new THREE.MeshBasicMaterial({ color: 0x2fe6c0, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false }),
      );
      const core = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 300, 0.3, 6, false),
        new THREE.MeshBasicMaterial({ color: 0x2fe6c0, transparent: true, opacity: 0.7, depthWrite: false }),
      );
      const doneGeo = new THREE.TubeGeometry(curve, 300, 0.4, 6, false);
      const done = new THREE.Mesh(doneGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthWrite: false }));
      doneGeo.setDrawRange(0, 0);
      glow.renderOrder = 6;
      core.renderOrder = 7;
      done.renderOrder = 8;
      group.add(glow, core, done);

      const at = (u: number) => {
        const f = clamp(u, 0, 1) * 300;
        const i = Math.min(299, Math.floor(f));
        const k = f - i;
        return new THREE.Vector3(lerp(sp[i].x, sp[i + 1].x, k), lerp(sp[i].y, sp[i + 1].y, k), lerp(sp[i].z, sp[i + 1].z, k));
      };

      /* waypoint beacons */
      const beacons = site.route.map(([x, z]) => {
        let best = 0;
        let bd = Infinity;
        sp.forEach((p, i) => {
          const d = Math.hypot(p.x - x, p.z - z);
          if (d < bd) {
            bd = d;
            best = i;
          }
        });
        const y = H(x, z);
        const bg = new THREE.Group();
        bg.position.set(x, y, z);
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 5, 8), new THREE.MeshStandardMaterial({ color: 0xbbbbbb }));
        pole.position.y = 2.5;
        const orbMat = new THREE.MeshBasicMaterial({ color: 0xffb347 });
        const orb = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), orbMat);
        orb.position.y = 5.3;
        const ringMat = new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false });
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.3, 32).rotateX(-Math.PI / 2), ringMat);
        ring.position.y = 0.25;
        const beamMat = new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false });
        const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 14, 12, 1, true), beamMat);
        beam.position.y = 7;
        bg.add(pole, orb, ring, beam);
        group.add(bg);
        return { t: best / 300, orb, orbMat, ringMat, beamMat, ring };
      });

      /* actors */
      const rover = makeRover();
      const astroA = makeAstronaut();
      const astroB = makeAstronaut();
      group.add(rover.group, astroA.group, astroB.group);

      const place = (obj: THREE.Object3D, u: number, lat: number, dirOut?: THREE.Vector3) => {
        const p = at(u);
        const q = at(u + 0.004);
        const r = at(u - 0.004);
        let dx = q.x - r.x;
        let dz = q.z - r.z;
        const l = Math.hypot(dx, dz) || 1;
        dx /= l;
        dz /= l;
        const x = p.x - dz * lat;
        const z = p.z + dx * lat;
        const pitch = Math.atan2(H(x + dx * 1.3, z + dz * 1.3) - H(x - dx * 1.3, z - dz * 1.3), 2.6);
        obj.position.set(x, H(x, z), z);
        obj.rotation.set(-pitch, Math.atan2(dx, dz), 0, 'YXZ');
        if (dirOut) dirOut.set(dx, 0, dz);
      };

      const update = (t: number, time: number, playing: boolean) => {
        place(rover.group, t, 0, roverDir);
        roverPos.copy(rover.group.position);
        place(astroA.group, Math.max(0, t - 0.012), 2.4);
        place(astroB.group, Math.max(0, t - 0.03), -2.4);
        const sw = playing ? Math.sin(time * 7) * 0.7 : 0;
        const sw2 = playing ? Math.sin(time * 7 + 1.3) * 0.7 : 0;
        astroA.legL.rotation.x = sw;
        astroA.legR.rotation.x = -sw;
        astroA.armL.rotation.x = -sw * 0.8;
        astroA.armR.rotation.x = sw * 0.8;
        astroB.legL.rotation.x = sw2;
        astroB.legR.rotation.x = -sw2;
        astroB.armL.rotation.x = -sw2 * 0.8;
        astroB.armR.rotation.x = sw2 * 0.8;
        if (playing) for (const w of rover.wheels) w.rotation.x += 0.18;
        doneGeo.setDrawRange(0, Math.floor(t * 300) * 36);
        for (const b of beacons) {
          const reached = t >= b.t - 0.002;
          const c = reached ? 0x7dff9e : 0xffb347;
          b.orbMat.color.setHex(c);
          b.ringMat.color.setHex(c);
          b.beamMat.color.setHex(c);
          const pulse = 1 + Math.sin(time * 3 + b.t * 10) * 0.18;
          b.orb.scale.setScalar(pulse);
          b.ring.scale.setScalar(1 + ((time * 0.6 + b.t) % 1) * 1.2);
        }
      };

      /* stats */
      let dist = 0;
      let gain = 0;
      let loss = 0;
      let maxS = 0;
      for (let k = 0; k < 300; k++) {
        const a = sp[k];
        const b = sp[k + 1];
        const hz = Math.hypot(b.x - a.x, b.z - a.z);
        const dy = b.y - a.y;
        dist += Math.hypot(hz * WORLD_M, dy * VERT_M);
        if (dy > 0) gain += dy * VERT_M;
        else loss -= dy * VERT_M;
        maxS = Math.max(maxS, Math.atan2(Math.abs(dy), hz) * 57.2958);
      }
      const duration = dist / 1000 / 1.5 + site.route.length * 0.2;

      scene.add(group);
      ctx = { group, meshes, update };
      camera.position.set(...site.cam.pos);
      controls.target.set(...site.cam.target);
      controls.update();
      flying = false;
      P.current.onStats?.({ distance: dist, gain, loss, maxSlope: maxS, duration, o2: Math.min(99, duration * 12.9) });
      P.current.onReady?.();
    };

    const load = (id: SiteId) => {
      const token = ++loadToken;
      requestAnimationFrame(() =>
        setTimeout(() => {
          if (disposed || token !== loadToken) return;
          build(id);
        }, 16),
      );
    };
    api.current = { load, recenter };

    const clock = new THREE.Clock();
    renderer.setAnimationLoop(() => {
      const dt = Math.min(clock.getDelta(), 0.1);
      const time = clock.elapsedTime;
      const p = P.current;
      sky.position.copy(camera.position);

      if (!p.playing) finished = false;
      if (p.playing && ctx && !finished) {
        tRef.current = Math.min(1, tRef.current + dt / SIM_SECONDS);
        if (time - lastEmit > 0.1 || tRef.current >= 1) {
          lastEmit = time;
          p.onProgress?.(tRef.current);
        }
        if (tRef.current >= 1) {
          finished = true;
          p.onFinish?.();
        }
      }

      if (ctx) {
        for (const id of LAYER_IDS) {
          const st = p.layers[id];
          const m = ctx.meshes[id];
          const o = st.on ? st.opacity : 0;
          (m.material as THREE.Material).opacity = o;
          m.visible = o > 0.01;
        }
        ctx.update(tRef.current, time, p.playing && !finished);
      }

      controls.enabled = !p.follow;
      if (p.follow && ctx) {
        const des = roverPos.clone().addScaledVector(roverDir, -18).add(new THREE.Vector3(0, 9, 0));
        camera.position.lerp(des, 0.08);
        controls.target.lerp(roverPos, 0.12);
      } else if (flying) {
        camera.position.lerp(goalPos, 0.06);
        controls.target.lerp(goalTarget, 0.06);
        if (camera.position.distanceTo(goalPos) < 0.3) flying = false;
      }
      controls.update();
      renderer.render(scene, camera);
    });

    return () => {
      disposed = true;
      api.current = null;
      renderer.setAnimationLoop(null);
      ro.disconnect();
      controls.dispose();
      if (ctx) disposeGroup(ctx.group);
      sky.geometry.dispose();
      (sky.material as THREE.Material).dispose();
      renderer.domElement.removeEventListener('webglcontextlost', contextLost);
      disposeFallback?.();
      renderer.dispose();
      if (renderer.domElement.parentElement === el) el.removeChild(renderer.domElement);
    };
  }, []);

  useEffect(() => {
    api.current?.load(props.siteId);
  }, [props.siteId]);

  useEffect(() => {
    api.current?.recenter();
  }, [props.camKey]);

  useEffect(() => {
    if (!props.playing) tRef.current = props.progress;
  }, [props.progress, props.playing]);

  return <div ref={mount} className="mars-scene" />;
}
