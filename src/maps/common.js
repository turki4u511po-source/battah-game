// أدوات بناء المابات المشتركة: heightfield (تضاريس/أسطح/منحدرات) +
// صناديق AABB صادّة + سماء وإضاءة لكل وقت + شبكة waypoints.

import * as THREE from 'three';
import { rand } from '../engine/utils.js';
import { losClear } from '../engine/physics.js';

export class MapBase {
  constructor(scene, size) {
    this.scene = scene;
    this.size = size;
    this.half = size / 2;
    this.bounds = {
      minX: -this.half + 0.6, maxX: this.half - 0.6,
      minZ: -this.half + 0.6, maxZ: this.half - 0.6,
    };
    this.group = new THREE.Group();
    scene.add(this.group);

    this.solids = [];          // AABB صادّة + حاجبة للرصاص
    this.features = [];        // ميزات heightfield
    this.waypoints = [];       // {x, z, y, links[], cover, hot}
    this.spawns = { blue: [], red: [] };
    this.domPoints = [];       // [{id:'A', x, z}]
    this.lamps = [];           // أضواء نقطية ليلية (يحدّها مستوى الجودة)
    this.surfaceRegions = [];  // [{minX,maxX,minZ,maxZ, type}]
    this.echo = 0.12;          // صدى الماب (أعلى في العوازم)
  }

  // ---------- heightfield ----------
  groundHeight(x, z) {
    let h = 0;
    for (const f of this.features) {
      let fh = -Infinity;
      if (f.type === 'rect') {
        if (x >= f.minX && x <= f.maxX && z >= f.minZ && z <= f.maxZ) fh = f.h;
      } else if (f.type === 'ramp') {
        if (x >= f.minX && x <= f.maxX && z >= f.minZ && z <= f.maxZ) {
          const t = f.axis === 'x'
            ? (x - f.minX) / (f.maxX - f.minX)
            : (z - f.minZ) / (f.maxZ - f.minZ);
          fh = f.h0 + (f.h1 - f.h0) * (f.dir < 0 ? 1 - t : t);
        }
      } else if (f.type === 'hill') {
        const d = Math.hypot(x - f.cx, z - f.cz);
        if (d < f.r) {
          const t = d / f.r;
          fh = f.h * (0.5 + 0.5 * Math.cos(t * Math.PI));
        }
      }
      if (fh > h) h = fh;
    }
    return h;
  }

  plateau(minX, minZ, maxX, maxZ, h) {
    this.features.push({ type: 'rect', minX, minZ, maxX, maxZ, h });
  }

  ramp(minX, minZ, maxX, maxZ, h0, h1, axis, dir = 1) {
    this.features.push({ type: 'ramp', minX, minZ, maxX, maxZ, h0, h1, axis, dir });
  }

  hill(cx, cz, r, h) {
    this.features.push({ type: 'hill', cx, cz, r, h });
  }

  // ---------- الأجسام ----------
  addSolid(minX, minY, minZ, maxX, maxY, maxZ) {
    this.solids.push({
      min: { x: minX, y: minY, z: minZ },
      max: { x: maxX, y: maxY, z: maxZ },
    });
  }

  /** صندوق مرئي + مسجل كـ AABB صاد (إن طلب) */
  box(w, h, d, mat, x, y, z, { solid = true, shadow = true, ry = 0 } = {}) {
    const mesh = new THREE.Mesh(boxGeo(), mat);
    mesh.scale.set(w, h, d);
    mesh.position.set(x, y + h / 2, z);
    mesh.rotation.y = ry;
    if (shadow) { mesh.castShadow = true; mesh.receiveShadow = true; }
    this.group.add(mesh);
    if (solid) {
      // ملاحظة: الدوران يُسمح به للديكور فقط — AABB يبقى محاذيًا للمحاور
      const hw = w / 2 + Math.abs(Math.sin(ry)) * d * 0.3;
      const hd = d / 2 + Math.abs(Math.sin(ry)) * w * 0.3;
      this.addSolid(x - hw, y, z - hd, x + hw, y + h, z + hd);
    }
    return mesh;
  }

  // ---------- الأسطح (لصوت الخطوات) ----------
  surface(minX, minZ, maxX, maxZ, type) {
    this.surfaceRegions.push({ minX, minZ, maxX, maxZ, type });
  }

  surfaceAt(x, z) {
    if (this.groundHeight(x, z) > 2) return 'roof';
    for (const r of this.surfaceRegions) {
      if (x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ) return r.type;
    }
    return this.defaultSurface || 'dirt';
  }

  // ---------- waypoints ----------
  wp(x, z, opts = {}) {
    this.waypoints.push({
      x, z, y: 0,
      links: [],
      cover: !!opts.cover,
      hot: !!opts.hot,
    });
  }

  /** ربط تلقائي: مسافة قريبة + خط نظر + فرق ارتفاع سالك */
  bakeWaypoints(maxLink = 14) {
    for (const w of this.waypoints) w.y = this.groundHeight(w.x, w.z);
    for (let i = 0; i < this.waypoints.length; i++) {
      for (let j = i + 1; j < this.waypoints.length; j++) {
        const a = this.waypoints[i];
        const b = this.waypoints[j];
        const d = Math.hypot(a.x - b.x, a.z - b.z);
        if (d > maxLink) continue;
        // فحص قابلية المشي: عيّنات على الخط لا تقفز ارتفاعًا فجائيًا
        let walkable = true;
        const steps = Math.ceil(d / 1.2);
        let prevH = a.y;
        for (let s = 1; s <= steps; s++) {
          const t = s / steps;
          const h = this.groundHeight(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t);
          if (Math.abs(h - prevH) > 0.6) { walkable = false; break; }
          prevH = h;
        }
        if (!walkable) continue;
        if (!losClear(this, a.x, a.y + 1.1, a.z, b.x, b.y + 1.1, b.z)) continue;
        a.links.push(j);
        b.links.push(i);
      }
    }
  }

  nearestWaypoint(x, z) {
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < this.waypoints.length; i++) {
      const w = this.waypoints[i];
      const d = (w.x - x) ** 2 + (w.z - z) ** 2 + Math.abs(w.y - this.groundHeight(x, z)) * 30;
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((o) => {
      if (o.geometry && o.geometry !== boxGeo()) o.geometry.dispose();
      if (o.material && !o.material._shared) {
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
        else o.material.dispose();
      }
    });
  }
}

// هندسة صندوق وحدة مشتركة
let BOX_GEO = null;
export function boxGeo() {
  if (!BOX_GEO) BOX_GEO = new THREE.BoxGeometry(1, 1, 1);
  return BOX_GEO;
}

export function flatMat(color, opts = {}) {
  const m = new THREE.MeshLambertMaterial({ color, ...opts });
  m._shared = true;
  return m;
}

// ---------- السماء والإضاءة ----------

export function skyDome(scene, stops, { stars = 0, moon = null } = {}) {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 512;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 512);
  for (const [t, color] of stops) grad.addColorStop(t, color);
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 512);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(450, 24, 12),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false }),
  );
  scene.add(dome);

  if (stars > 0) {
    const pos = new Float32Array(stars * 3);
    for (let i = 0; i < stars; i++) {
      const a = rand(0, Math.PI * 2);
      const e = rand(0.08, Math.PI / 2);
      const r = 420;
      pos[i * 3] = Math.cos(a) * Math.cos(e) * r;
      pos[i * 3 + 1] = Math.sin(e) * r;
      pos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false,
    });
    scene.add(new THREE.Points(geo, mat));
  }

  if (moon) {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(12, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xf4f0e0, fog: false }),
    );
    m.position.set(moon.x, moon.y, moon.z);
    scene.add(m);
  }
  return dome;
}

/**
 * إضاءة قياسية: نصف كروية + شمس/قمر اتجاهي واحد بظلال
 * (shadow map واحد حسب متطلب الأداء).
 */
export function standardLights(scene, {
  hemiSky, hemiGround, hemiInt,
  sunColor, sunInt, sunPos,
  shadowArea = 80, shadowSize = 2048,
}) {
  const hemi = new THREE.HemisphereLight(hemiSky, hemiGround, hemiInt);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(sunColor, sunInt);
  sun.position.set(...sunPos);
  sun.castShadow = true;
  sun.shadow.mapSize.set(shadowSize, shadowSize);
  sun.shadow.camera.left = -shadowArea;
  sun.shadow.camera.right = shadowArea;
  sun.shadow.camera.top = shadowArea;
  sun.shadow.camera.bottom = -shadowArea;
  sun.shadow.camera.near = 5;
  sun.shadow.camera.far = 400;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.04;
  scene.add(sun);
  scene.add(sun.target);
  return { hemi, sun };
}

// ---------- ماب الاختبار المسطح (المرحلة 1) ----------

export function makeTestMap(scene) {
  const map = new MapBase(scene, 60);
  map.id = 'test';
  map.defaultSurface = 'asphalt';

  skyDome(scene, [[0, '#5fa8e8'], [0.7, '#bcdcf5'], [1, '#e8e2cf']]);
  scene.fog = new THREE.Fog(0xc9d8e2, 60, 220);
  standardLights(scene, {
    hemiSky: 0xcfe5ff, hemiGround: 0x8e8474, hemiInt: 0.9,
    sunColor: 0xfff2dd, sunInt: 1.3, sunPos: [40, 70, 25],
    shadowArea: 45,
  });

  // أرضية
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(64, 64),
    flatMat(0x9aa0a6),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  map.group.add(ground);

  const grey = flatMat(0x7d848c);
  const tan = flatMat(0xb7a27a);
  const brick = flatMat(0xa56548);

  // جدران حدود مرئية
  for (const [w, d, x, z] of [
    [60, 1, 0, -30], [60, 1, 0, 30], [1, 60, -30, 0], [1, 60, 30, 0],
  ]) {
    map.box(w, 3, d, grey, x, 0, z);
  }

  // صناديق غطاء متناثرة
  for (const [x, z, s] of [
    [-8, -6, 1.4], [-6.5, -6, 1.4], [-8, -6, 1.4], [6, 4, 1.2], [10, -9, 1.6],
    [-12, 8, 1.3], [3, -14, 1.5], [14, 10, 1.2],
  ]) {
    map.box(s, s, s, tan, x, 0, z);
  }

  // جدار منتصف للاختباء
  map.box(8, 1.4, 0.5, brick, 0, 0, 2);

  // «بيت» منصة: plateau بسطح يصعد له منحدر — لاختبار الدرج والأسطح والقفز
  map.plateau(-20, -20, -12, -12, 3);
  map.box(8, 3, 8, brick, -16, 0, -16, { solid: false }); // الجدران عبر heightfield
  map.ramp(-12, -18, -7, -14, 0, 3, 'x', -1);             // منحدر صاعد غربًا
  const rampMesh = new THREE.Mesh(boxGeo(), tan);
  rampMesh.scale.set(5.4, 0.3, 4);
  rampMesh.position.set(-9.5, 1.4, -16);
  rampMesh.rotation.z = Math.atan2(3, 5);
  rampMesh.castShadow = true;
  map.group.add(rampMesh);

  // منصة ثانية قريبة لاختبار القفز بين الأسطح (فجوة 1.8م)
  map.plateau(-20, -10.2, -14, -4.2, 3);
  map.box(6, 3, 6, brick, -17, 0, -7.2, { solid: false });

  // نقاط الظهور والـ waypoints الأولية
  map.spawns.blue = [{ x: 0, z: 24, yaw: Math.PI }, { x: 4, z: 24, yaw: Math.PI }, { x: -4, z: 24, yaw: Math.PI }];
  map.spawns.red = [{ x: 0, z: -24, yaw: 0 }, { x: 4, z: -24, yaw: 0 }, { x: -4, z: -24, yaw: 0 }];
  for (const [x, z] of [
    [0, 20], [0, 10], [0, 0], [0, -10], [0, -20],
    [-10, 0], [10, 0], [-10, -10], [10, 10], [12, -12], [-16, 12],
  ]) {
    map.wp(x, z, { hot: Math.abs(x) < 4 && Math.abs(z) < 4 });
  }
  map.domPoints = [
    { id: 'A', x: -14, z: 10 },
    { id: 'B', x: 0, z: 0 },
    { id: 'C', x: 14, z: -10 },
  ];
  map.bakeWaypoints();

  return map;
}
