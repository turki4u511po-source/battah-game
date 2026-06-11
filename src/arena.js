// الساحة: واحة صحراوية مسوّرة مبنية إجرائيًّا بالكامل — لا أي أصول خارجية.
// كل القوام مرسوم عبر Canvas وكل المجسمات من Primitives.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { rand, randInt, choose } from './utils.js';

const POND = { x: -10, z: -8, r: 6.5 };

function makeSandTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = CONFIG.colors.sand1;
  g.fillRect(0, 0, 256, 256);
  // بقع ناعمة كبيرة
  for (let i = 0; i < 26; i++) {
    const r = rand(18, 50);
    const grad = g.createRadialGradient(rand(0, 256), rand(0, 256), 0, rand(0, 256), rand(0, 256), r);
    grad.addColorStop(0, 'rgba(190,150,90,0.10)');
    grad.addColorStop(1, 'rgba(190,150,90,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
  }
  // حبيبات رمل
  for (let i = 0; i < 1500; i++) {
    const a = rand(0.04, 0.14);
    g.fillStyle = Math.random() < 0.5 ? `rgba(120,90,40,${a})` : `rgba(255,240,200,${a})`;
    g.fillRect(rand(0, 256), rand(0, 256), rand(1, 2.2), rand(1, 2.2));
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(10, 10);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeWoodTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = CONFIG.colors.wood;
  g.fillRect(0, 0, 128, 128);
  // ألواح أفقية
  for (let y = 0; y < 128; y += 32) {
    g.fillStyle = 'rgba(60,35,12,0.55)';
    g.fillRect(0, y, 128, 2.5);
  }
  // عروق الخشب
  for (let i = 0; i < 46; i++) {
    g.strokeStyle = `rgba(70,42,16,${rand(0.1, 0.3)})`;
    g.lineWidth = rand(0.6, 1.6);
    const y = rand(0, 128);
    g.beginPath();
    g.moveTo(0, y);
    g.bezierCurveTo(42, y + rand(-5, 5), 86, y + rand(-5, 5), 128, y + rand(-4, 4));
    g.stroke();
  }
  // إطار حواف
  g.strokeStyle = 'rgba(55,32,10,0.8)';
  g.lineWidth = 7;
  g.strokeRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeSkyTexture() {
  const c = document.createElement('canvas');
  c.width = 16;
  c.height = 512;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0.0, '#4d9be2');
  grad.addColorStop(0.42, '#8fcdf6');
  grad.addColorStop(0.62, '#cfe9fb');
  grad.addColorStop(0.78, '#f6dfae');
  grad.addColorStop(1.0, '#efcf9b');
  g.fillStyle = grad;
  g.fillRect(0, 0, 16, 512);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ضجيج قيمي بسيط وحتمي لتلوين الأرضية
function vnoise(x, z) {
  const s = Math.sin(x * 0.31 + z * 0.17) + Math.sin(x * 0.13 - z * 0.41) + Math.sin((x + z) * 0.07);
  return (s / 3 + 1) / 2; // 0..1
}

export class Arena {
  constructor(scene) {
    this.scene = scene;
    this.collidables = []; // مجسمات تحجب الطلقات
    this.obstacles = [];   // أشكال تصادم الحركة {kind, ..., top}
    this.half = CONFIG.arena.size / 2 - CONFIG.arena.margin;
    this.spawnPoints = [];
    this.flags = [];
    this.clouds = [];
    this.reeds = [];
    this.placements = []; // لمنع التراكب أثناء التوزيع العشوائي
    this.pond = POND;

    this.sandTex = makeSandTexture();
    this.woodTex = makeWoodTexture();

    this.buildSkyAndLights();
    this.buildGround();
    this.buildPond();
    this.buildWalls();
    this.buildTowers();
    this.makeSpawnPoints();
    this.buildPalms();
    this.buildCratesAndBarrels();
    this.buildRocks();
    this.buildClouds();
  }

  // ---------- السماء والإضاءة ----------
  buildSkyAndLights() {
    const skyGeo = new THREE.SphereGeometry(380, 24, 12);
    const skyMat = new THREE.MeshBasicMaterial({
      map: makeSkyTexture(),
      side: THREE.BackSide,
      fog: false,
      depthWrite: false,
    });
    this.scene.add(new THREE.Mesh(skyGeo, skyMat));

    this.scene.fog = new THREE.Fog(CONFIG.colors.fog, 70, 180);

    const hemi = new THREE.HemisphereLight(0xbfdfff, 0xd8b97e, 0.95);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xffe8bb, 1.35);
    sun.position.set(38, 52, 20);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -55;
    sun.shadow.camera.right = 55;
    sun.shadow.camera.top = 55;
    sun.shadow.camera.bottom = -55;
    sun.shadow.camera.near = 5;
    sun.shadow.camera.far = 150;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    this.scene.add(sun);
    this.scene.add(sun.target);
  }

  // ---------- الأرضية ----------
  buildGround() {
    const size = CONFIG.arena.size;
    const geo = new THREE.PlaneGeometry(size + 4, size + 4, 64, 64);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const c1 = new THREE.Color(0xffffff);
    const c2 = new THREE.Color(0xdec7a2);
    const tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const n = vnoise(x, z);
      // نتوءات بصرية خفيفة، مع تسطيح قرب البركة ومنطقة البداية
      let h = (vnoise(x * 2.3 + 9, z * 2.3 - 4) - 0.5) * 0.22;
      const dPond = Math.hypot(x - POND.x, z - POND.z);
      if (dPond < POND.r + 2.5) h *= 0.04;
      if (Math.hypot(x, z - 10) < 6) h *= 0.2;
      pos.setY(i, h);
      tmp.copy(c1).lerp(c2, n);
      colors[i * 3] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    const mat = new THREE.MeshLambertMaterial({ map: this.sandTex, vertexColors: true });
    const ground = new THREE.Mesh(geo, mat);
    ground.receiveShadow = true;
    ground.name = 'ground';
    this.scene.add(ground);
    this.collidables.push(ground);
  }

  // ---------- البركة والقصب ----------
  buildPond() {
    const waterGeo = new THREE.CircleGeometry(POND.r, 36);
    waterGeo.rotateX(-Math.PI / 2);
    this.waterMat = new THREE.MeshLambertMaterial({
      color: CONFIG.colors.water,
      transparent: true,
      opacity: 0.85,
      emissive: 0x1a5f7e,
      emissiveIntensity: 0.25,
    });
    this.water = new THREE.Mesh(waterGeo, this.waterMat);
    this.water.position.set(POND.x, 0.06, POND.z);
    this.scene.add(this.water);

    const rimGeo = new THREE.TorusGeometry(POND.r + 0.2, 0.22, 8, 40);
    rimGeo.rotateX(-Math.PI / 2);
    const rim = new THREE.Mesh(rimGeo, new THREE.MeshLambertMaterial({ color: 0xc7a468 }));
    rim.position.set(POND.x, 0.1, POND.z);
    rim.receiveShadow = true;
    this.scene.add(rim);

    // عناقيد قصب حول البركة
    const stemMat = new THREE.MeshLambertMaterial({ color: 0x4da14d });
    const tipMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2a });
    const stemGeo = new THREE.CylinderGeometry(0.025, 0.035, 1, 5);
    const tipGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.22, 6);
    for (let i = 0; i < 7; i++) {
      const ang = rand(0, Math.PI * 2);
      const rr = POND.r + rand(0.5, 1.3);
      const cluster = new THREE.Group();
      cluster.position.set(POND.x + Math.cos(ang) * rr, 0, POND.z + Math.sin(ang) * rr);
      const n = randInt(3, 5);
      for (let k = 0; k < n; k++) {
        const h = rand(0.8, 1.4);
        const stem = new THREE.Mesh(stemGeo, stemMat);
        stem.scale.y = h;
        stem.position.set(rand(-0.18, 0.18), h / 2, rand(-0.18, 0.18));
        stem.rotation.z = rand(-0.1, 0.1);
        cluster.add(stem);
        const tip = new THREE.Mesh(tipGeo, tipMat);
        tip.position.set(stem.position.x, h + 0.08, stem.position.z);
        cluster.add(tip);
      }
      cluster.userData.phase = rand(0, Math.PI * 2);
      this.scene.add(cluster);
      this.reeds.push(cluster);
    }
  }

  // ---------- السور والشرفات ----------
  buildWalls() {
    const size = CONFIG.arena.size;
    const h = CONFIG.arena.wallHeight;
    const half = size / 2;
    const mat = new THREE.MeshLambertMaterial({ color: CONFIG.colors.wall, map: this.sandTex });

    const mkWall = (w, d, x, z) => {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      wall.position.set(x, h / 2, z);
      wall.castShadow = true;
      wall.receiveShadow = true;
      this.scene.add(wall);
      this.collidables.push(wall);
    };
    mkWall(size + 2.4, 1.2, 0, -half);
    mkWall(size + 2.4, 1.2, 0, half);
    mkWall(1.2, size + 2.4, -half, 0);
    mkWall(1.2, size + 2.4, half, 0);

    // شرفات السور (InstancedMesh واحدة)
    const step = 2.1;
    const count = Math.floor((size - 4) / step) * 4;
    const cren = new THREE.InstancedMesh(new THREE.BoxGeometry(0.95, 0.7, 1.3), mat, count);
    const m = new THREE.Matrix4();
    let idx = 0;
    for (let side = 0; side < 4; side++) {
      for (let i = 0; i < count / 4; i++) {
        const t = -((size - 4) / 2) + i * step;
        let x = t, z = -half;
        if (side === 1) { x = t; z = half; }
        else if (side === 2) { x = -half; z = t; }
        else if (side === 3) { x = half; z = t; }
        m.makeTranslation(x, h + 0.35, z);
        cren.setMatrixAt(idx++, m);
      }
    }
    cren.castShadow = true;
    this.scene.add(cren);
  }

  // ---------- الأبراج والأعلام ----------
  buildTowers() {
    const half = CONFIG.arena.size / 2;
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0xc09a5e, map: this.sandTex });
    const roofMat = new THREE.MeshLambertMaterial({ color: 0xa8502e });
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2a });
    const flagMat = new THREE.MeshLambertMaterial({ color: 0x2fb3a8, side: THREE.DoubleSide });

    const bodyGeo = new THREE.CylinderGeometry(2.1, 2.45, 7, 12);
    const roofGeo = new THREE.ConeGeometry(2.75, 2.4, 12);
    const poleGeo = new THREE.CylinderGeometry(0.05, 0.05, 1.6, 5);
    const flagGeo = new THREE.PlaneGeometry(0.95, 0.5);
    flagGeo.translate(0.475, 0, 0);

    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const x = sx * (half - 1.6);
        const z = sz * (half - 1.6);
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.set(x, 3.5, z);
        body.castShadow = true;
        this.scene.add(body);
        this.collidables.push(body);
        this.obstacles.push({ kind: 'circle', x, z, r: 2.55, top: 7 });

        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.set(x, 8.2, z);
        roof.castShadow = true;
        this.scene.add(roof);

        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(x, 10.2, z);
        this.scene.add(pole);

        const flag = new THREE.Mesh(flagGeo, flagMat);
        flag.position.set(x, 10.75, z);
        flag.userData.phase = rand(0, Math.PI * 2);
        this.scene.add(flag);
        this.flags.push(flag);
      }
    }
  }

  // ---------- نقاط ظهور البط ----------
  makeSpawnPoints() {
    const r = CONFIG.arena.size / 2 - 7;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      this.spawnPoints.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
    }
  }

  /** موضع عشوائي خالٍ من التراكب مع كل ما وُضع سابقًا */
  placeRandom(selfR, tries = 40) {
    const lim = CONFIG.arena.size / 2 - 4;
    for (let t = 0; t < tries; t++) {
      const x = rand(-lim, lim);
      const z = rand(-lim, lim);
      if (Math.hypot(x - POND.x, z - POND.z) < POND.r + selfR + 1) continue;
      if (Math.hypot(x, z - 10) < 5.5 + selfR) continue; // منطقة بداية اللاعب
      let ok = true;
      for (const p of this.placements) {
        if (Math.hypot(x - p.x, z - p.z) < p.r + selfR + 0.8) { ok = false; break; }
      }
      if (!ok) continue;
      for (const sp of this.spawnPoints) {
        if (Math.hypot(x - sp.x, z - sp.z) < selfR + 2.2) { ok = false; break; }
      }
      if (!ok) continue;
      this.placements.push({ x, z, r: selfR });
      return { x, z };
    }
    return null;
  }

  // ---------- النخيل ----------
  buildPalms() {
    const trunkMat = new THREE.MeshLambertMaterial({ color: CONFIG.colors.palmTrunk });
    const leafMat = new THREE.MeshLambertMaterial({ color: CONFIG.colors.palmLeaf, side: THREE.DoubleSide });
    const cocoMat = new THREE.MeshLambertMaterial({ color: 0x5e3d1f });
    const cocoGeo = new THREE.SphereGeometry(0.14, 8, 6);

    // سعفة مقوّسة: مستوى مُدوَّر ومُستدَق
    const frondGeo = new THREE.PlaneGeometry(0.55, 2.6, 1, 6);
    frondGeo.translate(0, 1.3, 0);
    {
      const p = frondGeo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const t = p.getY(i) / 2.6;
        p.setZ(i, p.getZ(i) + t * t * 1.15);
        p.setX(i, p.getX(i) * (1 - t * 0.6));
      }
      frondGeo.computeVertexNormals();
    }

    for (let i = 0; i < 11; i++) {
      const spot = this.placeRandom(0.9);
      if (!spot) continue;
      const h = rand(3.2, 4.6);
      const palm = new THREE.Group();
      palm.position.set(spot.x, 0, spot.z);

      const trunkGeo = new THREE.CylinderGeometry(0.2, 0.34, h, 7);
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = h / 2;
      trunk.rotation.z = rand(-0.06, 0.06);
      trunk.castShadow = true;
      palm.add(trunk);
      this.collidables.push(trunk);

      const top = new THREE.Group();
      top.position.y = h;
      palm.add(top);
      const fronds = randInt(7, 9);
      for (let f = 0; f < fronds; f++) {
        const frond = new THREE.Mesh(frondGeo, leafMat);
        frond.rotation.order = 'YXZ';
        frond.rotation.y = (f / fronds) * Math.PI * 2 + rand(-0.2, 0.2);
        frond.rotation.x = rand(0.45, 0.75);
        frond.castShadow = true;
        top.add(frond);
      }
      for (let k = 0; k < 3; k++) {
        const coco = new THREE.Mesh(cocoGeo, cocoMat);
        coco.position.set(rand(-0.2, 0.2), -0.1, rand(-0.2, 0.2));
        top.add(coco);
      }

      this.scene.add(palm);
      this.obstacles.push({ kind: 'circle', x: spot.x, z: spot.z, r: 0.45, top: h });
    }
  }

  // ---------- الصناديق والبراميل ----------
  buildCratesAndBarrels() {
    const crateGeo = new THREE.BoxGeometry(1, 1, 1);
    const crateMat = new THREE.MeshLambertMaterial({ map: this.woodTex, color: 0xffffff });

    for (let i = 0; i < 12; i++) {
      const s = rand(1.0, 1.6);
      const spot = this.placeRandom(s * 0.85);
      if (!spot) continue;
      const crate = new THREE.Mesh(crateGeo, crateMat);
      crate.scale.setScalar(s);
      crate.position.set(spot.x, s / 2, spot.z);
      crate.castShadow = true;
      crate.receiveShadow = true;
      this.scene.add(crate);
      this.collidables.push(crate);
      let top = s;
      // بعض الصناديق مكدّسة
      if (Math.random() < 0.35) {
        const s2 = s * rand(0.7, 0.9);
        const crate2 = new THREE.Mesh(crateGeo, crateMat);
        crate2.scale.setScalar(s2);
        crate2.position.set(spot.x + rand(-0.1, 0.1), s + s2 / 2, spot.z + rand(-0.1, 0.1));
        crate2.rotation.y = rand(-0.3, 0.3);
        crate2.castShadow = true;
        this.scene.add(crate2);
        this.collidables.push(crate2);
        top += s2;
      }
      const hs = s / 2 + 0.02;
      this.obstacles.push({
        kind: 'box',
        minX: spot.x - hs, maxX: spot.x + hs,
        minZ: spot.z - hs, maxZ: spot.z + hs,
        top,
      });
    }

    const barrelMat = new THREE.MeshLambertMaterial({ color: 0xa3552e });
    const bandMat = new THREE.MeshLambertMaterial({ color: 0x55504a });
    const barrelGeo = new THREE.CylinderGeometry(0.48, 0.52, 1.1, 12);
    const bandGeo = new THREE.CylinderGeometry(0.53, 0.53, 0.07, 12);
    for (let i = 0; i < 4; i++) {
      const spot = this.placeRandom(0.7);
      if (!spot) continue;
      const barrel = new THREE.Mesh(barrelGeo, barrelMat);
      barrel.position.set(spot.x, 0.55, spot.z);
      barrel.castShadow = true;
      this.scene.add(barrel);
      this.collidables.push(barrel);
      for (const by of [0.25, 0.85]) {
        const band = new THREE.Mesh(bandGeo, bandMat);
        band.position.set(spot.x, by, spot.z);
        this.scene.add(band);
      }
      this.obstacles.push({ kind: 'circle', x: spot.x, z: spot.z, r: 0.6, top: 1.1 });
    }
  }

  // ---------- الصخور ----------
  buildRocks() {
    const mat = new THREE.MeshLambertMaterial({ color: CONFIG.colors.rock, flatShading: true });
    for (let i = 0; i < 8; i++) {
      const r = rand(0.55, 1.15);
      const spot = this.placeRandom(r);
      if (!spot) continue;
      const geo = new THREE.IcosahedronGeometry(r, 0);
      const p = geo.attributes.position;
      for (let v = 0; v < p.count; v++) {
        p.setXYZ(
          v,
          p.getX(v) + rand(-0.16, 0.16) * r,
          p.getY(v) + rand(-0.16, 0.16) * r,
          p.getZ(v) + rand(-0.16, 0.16) * r,
        );
      }
      geo.computeVertexNormals();
      const rock = new THREE.Mesh(geo, mat);
      rock.position.set(spot.x, r * 0.45, spot.z);
      rock.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
      rock.castShadow = true;
      rock.receiveShadow = true;
      this.scene.add(rock);
      this.collidables.push(rock);
      this.obstacles.push({ kind: 'circle', x: spot.x, z: spot.z, r: r * 0.85, top: r });
    }
  }

  // ---------- الغيوم ----------
  buildClouds() {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 });
    const geo = new THREE.SphereGeometry(1, 10, 8);
    const lim = CONFIG.arena.size;
    for (let i = 0; i < 6; i++) {
      const cloud = new THREE.Group();
      const blobs = randInt(3, 5);
      for (let b = 0; b < blobs; b++) {
        const blob = new THREE.Mesh(geo, mat);
        const s = rand(1.6, 3.4);
        blob.scale.set(s, s * 0.45, s * 0.8);
        blob.position.set(rand(-3, 3), rand(-0.4, 0.4), rand(-1.4, 1.4));
        cloud.add(blob);
      }
      cloud.position.set(rand(-lim, lim), rand(34, 50), rand(-lim, lim));
      cloud.userData.speed = rand(0.5, 1.3);
      this.scene.add(cloud);
      this.clouds.push(cloud);
    }
  }

  /** نقطة ظهور بعيدة عن موضع معيّن */
  getSpawnPoint(awayFrom, minDist = 16) {
    const candidates = this.spawnPoints.filter(
      (p) => !awayFrom || p.distanceTo(awayFrom) > minDist,
    );
    const base = choose(candidates.length ? candidates : this.spawnPoints);
    return new THREE.Vector3(base.x + rand(-2, 2), 0, base.z + rand(-2, 2));
  }

  update(dt, time) {
    const lim = CONFIG.arena.size;
    for (const cloud of this.clouds) {
      cloud.position.x += cloud.userData.speed * dt;
      if (cloud.position.x > lim + 20) cloud.position.x = -lim - 20;
    }
    for (const flag of this.flags) {
      flag.rotation.y = Math.sin(time * 1.7 + flag.userData.phase) * 0.45;
    }
    for (const reed of this.reeds) {
      reed.rotation.z = Math.sin(time * 1.1 + reed.userData.phase) * 0.05;
    }
    this.waterMat.emissiveIntensity = 0.25 + Math.sin(time * 1.3) * 0.08;
    this.water.scale.setScalar(1 + Math.sin(time * 0.9) * 0.004);
  }
}
