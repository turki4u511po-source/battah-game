// أدوات بناء المابات المشتركة: heightfield (تضاريس/أسطح/منحدرات) +
// صناديق AABB صادّة + سماء وإضاءة لكل وقت + شبكة waypoints.

import * as THREE from 'three';
import { rand, choose } from '../engine/utils.js';
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
  _featureHeight(f, x, z) {
    if (f.type === 'rect') {
      if (x >= f.minX && x <= f.maxX && z >= f.minZ && z <= f.maxZ) return f.h;
    } else if (f.type === 'ramp') {
      if (x >= f.minX && x <= f.maxX && z >= f.minZ && z <= f.maxZ) {
        const t = f.axis === 'x'
          ? (x - f.minX) / (f.maxX - f.minX)
          : (z - f.minZ) / (f.maxZ - f.minZ);
        return f.h0 + (f.h1 - f.h0) * (f.dir < 0 ? 1 - t : t);
      }
    } else if (f.type === 'hill') {
      const d = Math.hypot(x - f.cx, z - f.cz);
      if (d < f.r) {
        const t = d / f.r;
        return f.h * (0.5 + 0.5 * Math.cos(t * Math.PI));
      }
    }
    return -Infinity;
  }

  groundHeight(x, z) {
    let h = 0;
    for (const f of this.features) {
      const fh = this._featureHeight(f, x, z);
      if (fh > h) h = fh;
    }
    return h;
  }

  /** ارتفاع التضاريس فقط (بدون كتل المباني) — لبناء المجسم المرئي */
  terrainHeight(x, z) {
    let h = 0;
    for (const f of this.features) {
      if (f.structure) continue;
      const fh = this._featureHeight(f, x, z);
      if (fh > h) h = fh;
    }
    return h;
  }

  plateau(minX, minZ, maxX, maxZ, h, opts = {}) {
    this.features.push({ type: 'rect', minX, minZ, maxX, maxZ, h, structure: !!opts.structure });
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
    // الأحدث إضافةً يفوز (الأسطح فوق المناطق العامة)
    for (let i = this.surfaceRegions.length - 1; i >= 0; i--) {
      const r = this.surfaceRegions[i];
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

// ====================================================================
//                 عدّة بناء المعالم السعودية (القسم 8)
// ====================================================================

/** لوحة محل بنص عربي مرسومة عبر Canvas */
export function signTexture(text, { bg = '#1c4f7a', fg = '#ffffff', rust = false } = {}) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, 256, 64);
  g.strokeStyle = 'rgba(255,255,255,0.5)';
  g.lineWidth = 3;
  g.strokeRect(3, 3, 250, 58);
  g.font = '700 34px "IBM Plex Sans Arabic", Tahoma, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = fg;
  g.fillText(text, 128, 34);
  if (rust) {
    for (let i = 0; i < 90; i++) {
      g.fillStyle = `rgba(90,55,25,${rand(0.08, 0.3)})`;
      g.fillRect(rand(0, 256), rand(0, 64), rand(2, 9), rand(1, 4));
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** باب رول معدني مموّج (قوام Canvas) */
export function rollupTexture(color = '#8d96a0') {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = color;
  g.fillRect(0, 0, 64, 128);
  for (let y = 0; y < 128; y += 8) {
    g.fillStyle = 'rgba(0,0,0,0.22)';
    g.fillRect(0, y + 5, 64, 2.4);
    g.fillStyle = 'rgba(255,255,255,0.10)';
    g.fillRect(0, y, 64, 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const KIT = {};
export function kitMats() {
  if (KIT.ready) return KIT;
  Object.assign(KIT, {
    ready: true,
    asphalt: flatMat(0x4a4d52),
    sidewalk: flatMat(0x9b948a),
    shopWall: flatMat(0xcbb89a),
    shopWallOld: flatMat(0xb09a78),
    villa: flatMat(0xe3d3b3),
    villaWall: flatMat(0xd8c49d),
    mud: flatMat(0xb98e63),
    mudDark: flatMat(0xa37b52),
    stone: flatMat(0x8d8478),
    woodOld: flatMat(0x7a5230),
    metal: flatMat(0x6a737d),
    metalDark: flatMat(0x434c55),
    granite: flatMat(0x4f463e),
    graniteDark: flatMat(0x3a332c),
    dirt: flatMat(0xc4a574),
    grass: flatMat(0x6da34f),
    trunk: flatMat(0x8a5a33),
    leaf: flatMat(0x3e8f3e),
    leafDry: flatMat(0x5d8a3a),
    white: flatMat(0xf2ede2),
    awning1: flatMat(0xb8543e),
    awning2: flatMat(0x3e7a8a),
    awning3: flatMat(0xc9952a),
    doorTeal: flatMat(0x2fb3a8),
    doorRed: flatMat(0xc04c38),
    doorYellow: flatMat(0xd8a832),
    doorBlue: flatMat(0x3a6fb8),
    window: new THREE.MeshLambertMaterial({ color: 0x4a3a1a, emissive: 0xffc36b, emissiveIntensity: 0.9 }),
    windowOff: flatMat(0x2a3138),
    lampHead: new THREE.MeshLambertMaterial({ color: 0xfff0c0, emissive: 0xffd27a, emissiveIntensity: 1.2 }),
    carBody1: flatMat(0xd9d4c8),
    carBody2: flatMat(0x8a3a30),
    carBody3: flatMat(0x3a5a7a),
    carGlass: flatMat(0x223038),
    tire: flatMat(0x1d2125),
    dumpster: flatMat(0x3e6b4f),
    fabric: flatMat(0xd8cdb4),
  });
  KIT.window._shared = true;
  KIT.lampHead._shared = true;
  return KIT;
}

/** محل بواجهة مفتوحة أو باب رول — مع لوحة عربية */
export function makeShop(map, x, z, ry, {
  name = 'بقالة', w = 6, d = 5, h = 3.4,
  open = false, rollup = false, rollupHalf = false, old = false,
  signBg = '#1c4f7a',
} = {}) {
  const m = kitMats();
  const wallMat = old ? m.shopWallOld : m.shopWall;
  // المحاور: الواجهة نحو +Z محليًا ثم ry (0, π/2, π, -π/2 فقط للحفاظ على AABB)
  const cos = Math.round(Math.cos(ry));
  const sin = Math.round(Math.sin(ry));
  const fx = sin; // اتجاه الواجهة عالميًا
  const fz = cos;
  const rx = cos; // اتجاه اليمين عالميًا
  const rz = -sin;

  const place = (lx, ly, lz, ww, hh, dd, mat, solid = true) => {
    // تحويل محلي→عالمي (دوران 90° فقط)
    const wx = x + rx * lx + fx * lz;
    const wz = z + rz * lx + fz * lz;
    const gw = Math.abs(rx * ww + fx * dd) || ww;
    const gd = Math.abs(rz * ww + fz * dd) || dd;
    return map.box(gw, hh, gd, mat, wx, ly, wz, { solid });
  };

  const t = 0.25;
  place(0, 0, -d / 2 + t / 2, w, h, t, wallMat);          // خلفي
  place(-w / 2 + t / 2, 0, 0, t, h, d, wallMat);           // جانب
  place(w / 2 - t / 2, 0, 0, t, h, d, wallMat);            // جانب
  // سقف (حاجب رصاص، غير قابل للوقوف)
  place(0, h, 0, w, 0.22, d, wallMat);
  // عتبة علوية فوق الواجهة
  place(0, h - 0.5, d / 2 - t / 2, w, 0.5, t, wallMat);

  if (!open) {
    if (rollup) {
      const doorH = rollupHalf ? h * 0.45 : h - 0.6;
      const yTop = h - 0.6;
      // الرول ينزل من الأعلى — نصف مفتوح يترك فتحة دخول
      const tex = rollupTexture(old ? '#8d7f6a' : '#9aa3ad');
      const doorMat = new THREE.MeshLambertMaterial({ map: tex });
      const mesh = place(0, yTop - doorH, d / 2 - t / 2, w - 0.8, doorH, 0.12, doorMat, true);
      mesh.material = doorMat;
    } else {
      place(0, 0, d / 2 - t / 2, w - 0.8, h - 0.6, t, wallMat);
    }
  }

  // اللوحة
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(w * 0.8, 0.8),
    new THREE.MeshBasicMaterial({ map: signTexture(name, { bg: signBg, rust: old }) }),
  );
  sign.position.set(x + fx * (d / 2 + 0.06), h - 0.15, z + fz * (d / 2 + 0.06));
  sign.rotation.y = ry;
  map.group.add(sign);

  return { x, z };
}

/** مظلة قماش مائلة أمام محل */
export function makeAwning(map, x, z, ry, w = 4, mat = null) {
  const m = kitMats();
  const a = new THREE.Mesh(new THREE.PlaneGeometry(w, 2.2), mat || m.awning1);
  a.position.set(x, 2.9, z);
  a.rotation.order = 'YXZ';
  a.rotation.y = ry;
  a.rotation.x = -0.5;
  a.material.side = THREE.DoubleSide;
  map.group.add(a);
}

/** فيلا بسور خارجي وبوابة — كتلة صلبة غير قابلة للتسلق */
export function makeVilla(map, x, z, { w = 10, d = 9, h = 6.5 } = {}) {
  const m = kitMats();
  const house = map.box(w, h, d, m.villa, x, 0, z);
  // سترة سطح
  map.box(w + 0.3, 0.5, d + 0.3, m.villaWall, x, h, z, { solid: false });
  // خزان مياه
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 1, 10), m.white);
  tank.position.set(x + w * 0.25, h + 1, z - d * 0.2);
  map.group.add(tank);
  // نوافذ مضيئة (غروب/ليل)
  for (const sx of [-1, 1]) {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.5), map.nightWindows ? m.window : m.windowOff);
    win.position.set(x + sx * w * 0.28, h * 0.55, z + d / 2 + 0.03);
    map.group.add(win);
  }
  return house;
}

/** سور مجمع فلل بفجوة بوابة */
export function compoundWall(map, x1, z1, x2, z2, { h = 2.5, gate = null } = {}) {
  const m = kitMats();
  const horizontal = Math.abs(x2 - x1) > Math.abs(z2 - z1);
  const len = horizontal ? Math.abs(x2 - x1) : Math.abs(z2 - z1);
  const cx = (x1 + x2) / 2;
  const cz = (z1 + z2) / 2;
  if (gate === null) {
    map.box(horizontal ? len : 0.35, h, horizontal ? 0.35 : len, m.villaWall, cx, 0, cz);
    return;
  }
  // جزءان حول فجوة بوابة بعرض 2.4
  const g = 2.4;
  const seg = (len - g) / 2;
  if (seg <= 0.4) return;
  if (horizontal) {
    map.box(seg, h, 0.35, m.villaWall, x1 + seg / 2 * Math.sign(x2 - x1), 0, cz);
    map.box(seg, h, 0.35, m.villaWall, x2 - seg / 2 * Math.sign(x2 - x1), 0, cz);
  } else {
    map.box(0.35, h, seg, m.villaWall, cx, 0, z1 + seg / 2 * Math.sign(z2 - z1));
    map.box(0.35, h, seg, m.villaWall, cx, 0, z2 - seg / 2 * Math.sign(z2 - z1));
  }
  // عارضة بوابة حديد
  const bar = new THREE.Mesh(new THREE.BoxGeometry(horizontal ? g : 0.15, 0.18, horizontal ? 0.15 : g), kitMats().metalDark);
  bar.position.set(cx, h - 0.1, cz);
  map.group.add(bar);
}

/**
 * بيت شعبي طيني بسطح قابل للمشي (heightfield) — مع درج خارجي
 * اختياري وسترة سطح قصيرة (~40سم) على الجهات المختارة.
 */
export function makeMudHouse(map, x, z, {
  w = 5, d = 5, h = 3, base = 0,
  stairs = null,        // 'n'|'s'|'e'|'w' — جهة الدرج الخارجي
  parapet = ['n', 's', 'e', 'w'], // الجهات المسوّرة (اتركي فجوات جهات القفز)
  doorMat = null, window = false, dark = false,
} = {}) {
  const m = kitMats();
  const mat = dark ? m.mudDark : m.mud;
  const roofY = base + h;

  // الكتلة عبر heightfield (سطح قابل للوقوف) + مرئي — كتلة بناء لا تضاريس
  map.plateau(x - w / 2, z - d / 2, x + w / 2, z + d / 2, roofY, { structure: true });
  map.surface(x - w / 2, z - d / 2, x + w / 2, z + d / 2, 'roof');
  const mesh = new THREE.Mesh(boxGeo(), mat);
  mesh.scale.set(w, h, d);
  mesh.position.set(x, base + h / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  map.group.add(mesh);

  // باب حديد ملوّن
  const door = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 1.8, 0.08),
    doorMat || choose([m.doorTeal, m.doorRed, m.doorYellow, m.doorBlue]),
  );
  door.position.set(x, base + 0.9, z + d / 2 + 0.05);
  map.group.add(door);

  if (window) {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), map.nightWindows ? m.window : m.windowOff);
    win.position.set(x + w * 0.25, base + h * 0.62, z + d / 2 + 0.03);
    map.group.add(win);
  }

  // سترة السطح (غطاء عند القرفصاء) — solids قصيرة على حواف السطح
  const pt = 0.18;
  const ph = 0.42;
  for (const side of parapet) {
    let bx = x;
    let bz = z;
    let bw = w;
    let bd = pt;
    if (side === 'n') bz = z - d / 2 + pt / 2;
    else if (side === 's') bz = z + d / 2 - pt / 2;
    else {
      bw = pt;
      bd = d;
      bx = side === 'e' ? x + w / 2 - pt / 2 : x - w / 2 + pt / 2;
    }
    map.box(bw, ph, bd, mat, bx, roofY, bz, { shadow: false });
  }

  // درج خارجي: منحدر heightfield + درجات مرئية
  if (stairs) {
    const sw = 1.4; // عرض الدرج
    const sl = Math.min(3.4, h * 1.2); // طوله
    let rx1; let rz1; let rx2; let rz2; let axis; let dir;
    if (stairs === 'e' || stairs === 'w') {
      axis = 'z';
      const sx = stairs === 'e' ? x + w / 2 + sw / 2 : x - w / 2 - sw / 2;
      rx1 = sx - sw / 2; rx2 = sx + sw / 2;
      rz1 = z - sl / 2; rz2 = z + sl / 2;
      dir = 1; // يصعد نحو +Z... يحدد لاحقًا
    } else {
      axis = 'x';
      const sz = stairs === 's' ? z + d / 2 + sw / 2 : z - d / 2 - sw / 2;
      rz1 = sz - sw / 2; rz2 = sz + sw / 2;
      rx1 = x - sl / 2; rx2 = x + sl / 2;
      dir = 1;
    }
    map.ramp(rx1, rz1, rx2, rz2, base, roofY, axis, dir);
    // درجات مرئية
    const steps = 7;
    for (let i = 0; i < steps; i++) {
      const t = (i + 0.5) / steps;
      const sh = base + t * h;
      const stepMesh = new THREE.Mesh(boxGeo(), m.stone);
      if (axis === 'z') {
        stepMesh.scale.set(sw, 0.16, sl / steps + 0.05);
        stepMesh.position.set((rx1 + rx2) / 2, sh, rz1 + t * (rz2 - rz1));
      } else {
        stepMesh.scale.set(sl / steps + 0.05, 0.16, sw);
        stepMesh.position.set(rx1 + t * (rx2 - rx1), sh, (rz1 + rz2) / 2);
      }
      map.group.add(stepMesh);
    }
  }
  return { roofY };
}

/** سيارة low-poly: وانيت أو سيدان — AABB محاذٍ للمحاور */
export function makeCar(map, x, z, ry, kind = 'pickup') {
  const m = kitMats();
  const body = choose([m.carBody1, m.carBody2, m.carBody3]);
  const g = new THREE.Group();
  if (kind === 'pickup') {
    const bed = new THREE.Mesh(boxGeo(), body);
    bed.scale.set(1.8, 0.55, 4.4);
    bed.position.y = 0.75;
    g.add(bed);
    const cab = new THREE.Mesh(boxGeo(), body);
    cab.scale.set(1.7, 0.62, 1.5);
    cab.position.set(0, 1.3, 1.0);
    g.add(cab);
    const glass = new THREE.Mesh(boxGeo(), m.carGlass);
    glass.scale.set(1.55, 0.45, 1.0);
    glass.position.set(0, 1.35, 0.95);
    g.add(glass);
    // جوانب الحوض
    const side1 = new THREE.Mesh(boxGeo(), body);
    side1.scale.set(1.8, 0.4, 0.1);
    side1.position.set(0, 1.2, -2.15);
    g.add(side1);
  } else {
    const bodyM = new THREE.Mesh(boxGeo(), body);
    bodyM.scale.set(1.8, 0.55, 4.2);
    bodyM.position.y = 0.75;
    g.add(bodyM);
    const cabin = new THREE.Mesh(boxGeo(), m.carGlass);
    cabin.scale.set(1.6, 0.5, 2.0);
    cabin.position.set(0, 1.27, -0.2);
    g.add(cabin);
  }
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  for (const [wx, wz] of [[-0.85, 1.4], [0.85, 1.4], [-0.85, -1.5], [0.85, -1.5]]) {
    const wheel = new THREE.Mesh(wheelGeo, m.tire);
    wheel.position.set(wx, 0.36, wz);
    g.add(wheel);
  }
  g.position.set(x, 0, z);
  g.rotation.y = ry;
  g.traverse((o) => { o.castShadow = true; });
  map.group.add(g);
  // AABB حسب الدوران (90° فقط)
  const along = Math.abs(Math.sin(ry)) > 0.5;
  const hw = along ? 2.3 : 1.0;
  const hd = along ? 1.0 : 2.3;
  map.addSolid(x - hw, 0, z - hd, x + hw, 1.6, z + hd);
}

/** عمود إنارة — رأس مضيء، وضوء نقطي اختياري (يحدّه الماب) */
export function lamppost(map, x, z, { lit = false, lightColor = 0xffc36b } = {}) {
  const m = kitMats();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 4.6, 8), m.metalDark);
  pole.position.set(x, 2.3, z);
  pole.castShadow = true;
  map.group.add(pole);
  const arm = new THREE.Mesh(boxGeo(), m.metalDark);
  arm.scale.set(0.08, 0.08, 1.1);
  arm.position.set(x, 4.55, z + 0.5);
  map.group.add(arm);
  const head = new THREE.Mesh(boxGeo(), m.lampHead);
  head.scale.set(0.2, 0.12, 0.45);
  head.position.set(x, 4.45, z + 1);
  map.group.add(head);
  map.obstaclesLight ??= 0;
  if (lit) {
    map.lamps.push({ x, y: 4.3, z: z + 1, color: lightColor });
  }
  map.addSolid(x - 0.12, 0, z - 0.12, x + 0.12, 4.4, z + 0.12);
}

/** حاوية نفايات */
export function makeDumpster(map, x, z, ry = 0) {
  const m = kitMats();
  const body = new THREE.Mesh(boxGeo(), m.dumpster);
  body.scale.set(2.2, 1.25, 1.2);
  body.position.set(x, 0.7, z);
  body.rotation.y = ry;
  body.castShadow = true;
  map.group.add(body);
  const lid = new THREE.Mesh(boxGeo(), m.metalDark);
  lid.scale.set(2.25, 0.12, 1.25);
  lid.position.set(x, 1.38, z);
  lid.rotation.y = ry;
  map.group.add(lid);
  map.addSolid(x - 1.2, 0, z - 0.75, x + 1.2, 1.45, z + 0.75);
}

/** نخلة */
export function palmTree(map, x, z, h = null) {
  const m = kitMats();
  h ??= rand(4, 5.6);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.3, h, 7), m.trunk);
  trunk.position.set(x, h / 2, z);
  trunk.rotation.z = rand(-0.05, 0.05);
  trunk.castShadow = true;
  map.group.add(trunk);
  const frondGeo = getFrondGeo();
  const fronds = 8;
  for (let f = 0; f < fronds; f++) {
    const frond = new THREE.Mesh(frondGeo, m.leaf);
    frond.position.set(x, h, z);
    frond.rotation.order = 'YXZ';
    frond.rotation.y = (f / fronds) * Math.PI * 2 + rand(-0.2, 0.2);
    frond.rotation.x = rand(0.5, 0.8);
    frond.castShadow = true;
    map.group.add(frond);
  }
  map.addSolid(x - 0.28, 0, z - 0.28, x + 0.28, h * 0.8, z + 0.28);
}

let FROND_GEO = null;
function getFrondGeo() {
  if (FROND_GEO) return FROND_GEO;
  FROND_GEO = new THREE.PlaneGeometry(0.5, 2.4, 1, 5);
  FROND_GEO.translate(0, 1.2, 0);
  const p = FROND_GEO.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = p.getY(i) / 2.4;
    p.setZ(i, p.getZ(i) + t * t * 1.05);
    p.setX(i, p.getX(i) * (1 - t * 0.6));
  }
  FROND_GEO.computeVertexNormals();
  return FROND_GEO;
}

/** شجرة سدر — جذع وكتل أوراق كروية */
export function sidrTree(map, x, z) {
  const m = kitMats();
  const h = rand(2.6, 3.4);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, h, 7), m.trunk);
  trunk.position.set(x, h / 2, z);
  trunk.castShadow = true;
  map.group.add(trunk);
  for (let i = 0; i < 3; i++) {
    const blob = new THREE.Mesh(new THREE.SphereGeometry(rand(0.9, 1.3), 9, 7), m.leafDry);
    blob.position.set(x + rand(-0.8, 0.8), h + rand(-0.1, 0.7), z + rand(-0.8, 0.8));
    blob.castShadow = true;
    map.group.add(blob);
  }
  map.addSolid(x - 0.25, 0, z - 0.25, x + 0.25, h * 0.8, z + 0.25);
}

export function bush(map, x, z) {
  const m = kitMats();
  const blob = new THREE.Mesh(new THREE.SphereGeometry(rand(0.4, 0.7), 7, 5), m.leafDry);
  blob.position.set(x, map.groundHeight(x, z) + 0.3, z);
  blob.scale.y = 0.7;
  map.group.add(blob);
}

/**
 * مجسم تضاريس مُزاح من terrainHeight بألوان لكل رأس —
 * للمابات ذات التلال/المستويات (يستبدل الأرضية المسطحة).
 */
export function buildTerrainMesh(map, colorFn, res = 100) {
  const size = map.size + 6;
  const geo = new THREE.PlaneGeometry(size, size, res, res);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = map.terrainHeight(x, z);
    pos.setY(i, h);
    colorFn(c, x, z, h);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  mesh.receiveShadow = true;
  map.group.add(mesh);
  return mesh;
}

/** صخرة جرانيت */
export function makeRock(map, x, z, r, { dark = false, solid = true } = {}) {
  const m = kitMats();
  const geo = new THREE.IcosahedronGeometry(r, 0);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    p.setXYZ(
      i,
      p.getX(i) + rand(-0.18, 0.18) * r,
      p.getY(i) + rand(-0.18, 0.18) * r,
      p.getZ(i) + rand(-0.18, 0.18) * r,
    );
  }
  geo.computeVertexNormals();
  const mat = dark ? kitMats().graniteDark : m.granite;
  const rock = new THREE.Mesh(geo, mat);
  const y = map.groundHeight(x, z);
  rock.position.set(x, y + r * 0.4, z);
  rock.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
  rock.castShadow = true;
  rock.receiveShadow = true;
  map.group.add(rock);
  if (solid) map.addSolid(x - r * 0.8, y, z - r * 0.8, x + r * 0.8, y + r, z + r * 0.8);
}

/** صناديق بضاعة وبرميل */
export function crateStack(map, x, z, n = 2) {
  const m = kitMats();
  let y = 0;
  const base = map.groundHeight(x, z);
  for (let i = 0; i < n; i++) {
    const s = rand(0.9, 1.2);
    const c = new THREE.Mesh(boxGeo(), m.woodOld);
    c.scale.setScalar(s);
    c.position.set(x + rand(-0.1, 0.1), base + y + s / 2, z + rand(-0.1, 0.1));
    c.rotation.y = rand(-0.2, 0.2);
    c.castShadow = true;
    map.group.add(c);
    y += s;
  }
  map.addSolid(x - 0.65, base, z - 0.65, x + 0.65, base + y, z + 0.65);
}

export function makeBarrel(map, x, z) {
  const m = kitMats();
  const base = map.groundHeight(x, z);
  const b = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.05, 10), kitMats().carBody2);
  b.position.set(x, base + 0.53, z);
  b.castShadow = true;
  map.group.add(b);
  map.addSolid(x - 0.5, base, z - 0.5, x + 0.5, base + 1.1, z + 0.5);
}

/** ملعب أطفال: زحليقة ومراجيح (غطاء حديقة اشبيليا) */
export function playground(map, x, z) {
  const m = kitMats();
  // زحليقة: سلم + منصة + منزلقة
  map.box(1.2, 1.8, 1.2, m.doorRed, x - 2, 0, z);
  const slide = new THREE.Mesh(boxGeo(), m.doorYellow);
  slide.scale.set(0.9, 0.12, 3);
  slide.position.set(x - 0.4, 1.1, z);
  slide.rotation.z = -0.5;
  map.group.add(slide);
  map.addSolid(x - 1.4, 0, z - 0.5, x + 1, 1.2, z + 0.5);
  // مراجيح: إطار + مقعدان
  const frame = kitMats().doorBlue;
  for (const sx of [-1.6, 1.6]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.3, 6), frame);
    post.position.set(x + 3 + sx, 1.15, z);
    map.group.add(post);
  }
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.4, 6), frame);
  bar.rotation.z = Math.PI / 2;
  bar.position.set(x + 3, 2.3, z);
  map.group.add(bar);
  for (const sx of [-0.7, 0.7]) {
    const seat = new THREE.Mesh(boxGeo(), m.woodOld);
    seat.scale.set(0.55, 0.08, 0.25);
    seat.position.set(x + 3 + sx, 0.65, z);
    map.group.add(seat);
    for (const cx of [-0.22, 0.22]) {
      const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.6, 4), m.metal);
      chain.position.set(x + 3 + sx + cx, 1.48, z);
      map.group.add(chain);
    }
  }
  map.addSolid(x + 1.3, 0, z - 0.3, x + 4.7, 2.3, z + 0.3);
}

/** مساحة أرضية ملوّنة (طريق/عشب/تراب) فوق الأرضية الأساسية */
export function groundPatch(map, x, z, w, d, mat, y = 0.02) {
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
  p.rotation.x = -Math.PI / 2;
  p.position.set(x, y, z);
  p.receiveShadow = true;
  map.group.add(p);
}

/** تفعيل أضواء الماب النقطية بحسب الجودة (≤ الحد) */
export function applyLamps(map, scene, maxLights) {
  let n = 0;
  for (const l of map.lamps) {
    if (n >= maxLights) break;
    const pt = new THREE.PointLight(l.color, 14, 13, 1.8);
    pt.position.set(l.x, l.y, l.z);
    scene.add(pt);
    n++;
  }
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
