// البط الآلي: نماذج إجرائية من Primitives، تحريك (مشية/رفرفة/رأس)،
// ذكاء (تجسيد → ملاحقة مع تنافر → تمهيد → هجوم)، إصابة وفرقعة كرتونية بلا دماء.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { clamp, damp, rand, turnToward, collideCircle } from './utils.js';

export const DUCK_TYPES = {
  normal: {
    name: 'بطة آلية', hp: 50, speed: 2.6, damage: 8, score: 100,
    scale: 1, radius: 0.55, turnRate: 3.0, attackRange: 2.0,
    attackCooldown: 1.1, body: 0xffd23f, antenna: 0x39d0ff,
  },
  fast: {
    name: 'بطة سريعة', hp: 25, speed: 4.6, damage: 6, score: 150,
    scale: 0.72, radius: 0.42, turnRate: 5.2, attackRange: 1.6,
    attackCooldown: 0.9, body: 0xfff3cf, antenna: 0x7bff6b,
  },
  tank: {
    name: 'بطة مدرعة', hp: 150, speed: 1.7, damage: 14, score: 300,
    scale: 1.35, radius: 0.78, turnRate: 2.2, attackRange: 2.4,
    attackCooldown: 1.4, body: 0xe8b73a, antenna: 0xffa83a, helmet: true,
  },
  boss: {
    name: 'الزعيم البطّوط', hp: 1200, speed: 2.2, damage: 22, score: 1500,
    scale: 2.6, radius: 1.45, turnRate: 2.6, attackRange: 4.2,
    attackCooldown: 1.6, body: 0x9b6fd4, antenna: 0xff4d4d,
    crown: true, redEyes: true, ranged: true, eggInterval: 3.2,
  },
};

// هندسات وخامات مشتركة بين كل البط — تُبنى مرة واحدة
let SHARED = null;
function shared() {
  if (SHARED) return SHARED;
  const bodyGeo = new THREE.SphereGeometry(0.5, 18, 14);
  bodyGeo.scale(1, 0.85, 1.25);
  const headGeo = new THREE.SphereGeometry(0.27, 14, 12);
  const beakGeo = new THREE.SphereGeometry(0.13, 10, 8);
  beakGeo.scale(1.1, 0.42, 1.7);
  const wingGeo = new THREE.SphereGeometry(0.5, 10, 8);
  wingGeo.scale(0.16, 0.5, 0.85);
  const footGeo = new THREE.ConeGeometry(0.15, 0.34, 3);
  footGeo.rotateX(Math.PI / 2); // مثلث منبسط يشير للأمام (قدم مكفوفة)
  footGeo.scale(1, 0.25, 1);
  const tailGeo = new THREE.ConeGeometry(0.16, 0.34, 6);

  SHARED = {
    bodyGeo, headGeo, beakGeo, wingGeo, footGeo, tailGeo,
    eyeGeo: new THREE.SphereGeometry(0.06, 8, 8),
    glintGeo: new THREE.SphereGeometry(0.022, 6, 6),
    antennaGeo: new THREE.CylinderGeometry(0.018, 0.018, 0.34, 5),
    bobbleGeo: new THREE.SphereGeometry(0.06, 8, 6),
    helmetGeo: new THREE.SphereGeometry(0.33, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2.1),
    crownBaseGeo: new THREE.CylinderGeometry(0.2, 0.24, 0.12, 8),
    crownSpikeGeo: new THREE.ConeGeometry(0.05, 0.16, 4),
    beakMat: new THREE.MeshLambertMaterial({ color: 0xff8c1a }),
    footMat: new THREE.MeshLambertMaterial({ color: 0xff8c1a }),
    eyeMat: new THREE.MeshLambertMaterial({ color: 0x252220 }),
    redEyeMat: new THREE.MeshLambertMaterial({
      color: 0x4d1310, emissive: 0xff2a1a, emissiveIntensity: 0.9,
    }),
    glintMat: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    antennaMat: new THREE.MeshLambertMaterial({ color: 0x6b7c8a }),
    helmetMat: new THREE.MeshStandardMaterial({ color: 0x8d99a6, metalness: 0.55, roughness: 0.45 }),
    crownMat: new THREE.MeshStandardMaterial({
      color: 0xffc93a, metalness: 0.65, roughness: 0.3,
      emissive: 0x553f00, emissiveIntensity: 0.25,
    }),
  };
  return SHARED;
}

class Duck {
  constructor(typeKey, game) {
    this.typeKey = typeKey;
    this.game = game;
    this.conf = DUCK_TYPES[typeKey];
    this.alive = false;
    this.buildModel();

    this.state = 'spawn';
    this.stateT = 0;
    this.yaw = 0;
    this.hp = 0;
    this.maxHp = 1;
    this.s = 1;
    this.speedScale = 1;
    this.animT = rand(0, 10);
    this.attackCd = 0;
    this.quackT = rand(CONFIG.ducks.quackIntervalMin, CONFIG.ducks.quackIntervalMax);
    this.eggT = 2;
    this.flashT = 0;
    this.squash = 0;
    this._v = new THREE.Vector3();
  }

  buildModel() {
    const S = shared();
    const conf = this.conf;

    // خامتان مستنسختان لكل بطة (وميض الإصابة)؛ الباقي مشترك عالميًّا
    this.bodyMat = new THREE.MeshLambertMaterial({ color: conf.body });
    this.wingMat = new THREE.MeshLambertMaterial({
      color: new THREE.Color(conf.body).multiplyScalar(0.84),
    });

    const root = new THREE.Group();

    const bodyGroup = new THREE.Group();
    bodyGroup.position.y = 0.55;
    root.add(bodyGroup);

    const body = new THREE.Mesh(S.bodyGeo, this.bodyMat);
    body.castShadow = true;
    bodyGroup.add(body);

    const wingL = new THREE.Mesh(S.wingGeo, this.wingMat);
    wingL.position.set(-0.46, 0.05, 0.02);
    wingL.rotation.z = 0.15;
    bodyGroup.add(wingL);
    const wingR = new THREE.Mesh(S.wingGeo, this.wingMat);
    wingR.position.set(0.46, 0.05, 0.02);
    wingR.rotation.z = -0.15;
    bodyGroup.add(wingR);

    const tail = new THREE.Mesh(S.tailGeo, this.wingMat);
    tail.position.set(0, 0.18, -0.58);
    tail.rotation.x = -1.1;
    bodyGroup.add(tail);

    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.42, 0.38);
    bodyGroup.add(headGroup);

    const head = new THREE.Mesh(S.headGeo, this.bodyMat);
    head.castShadow = true;
    headGroup.add(head);

    const beak = new THREE.Mesh(S.beakGeo, S.beakMat);
    beak.position.set(0, -0.04, 0.28);
    headGroup.add(beak);

    const eyeMat = conf.redEyes ? S.redEyeMat : S.eyeMat;
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(S.eyeGeo, eyeMat);
      eye.position.set(sx * 0.13, 0.07, 0.21);
      headGroup.add(eye);
      if (!conf.redEyes) {
        const glint = new THREE.Mesh(S.glintGeo, S.glintMat);
        glint.position.set(sx * 0.15, 0.1, 0.25);
        headGroup.add(glint);
      }
    }

    // هوائي الروبوت بقمة متوهجة
    const antenna = new THREE.Mesh(S.antennaGeo, S.antennaMat);
    antenna.position.set(0, 0.4, 0);
    headGroup.add(antenna);
    const bobble = new THREE.Mesh(
      S.bobbleGeo,
      new THREE.MeshLambertMaterial({
        color: conf.antenna, emissive: conf.antenna, emissiveIntensity: 0.8,
      }),
    );
    bobble.position.set(0, 0.58, 0);
    headGroup.add(bobble);

    if (conf.helmet) {
      const helmet = new THREE.Mesh(S.helmetGeo, S.helmetMat);
      helmet.position.y = 0.02;
      helmet.scale.setScalar(1.02);
      headGroup.add(helmet);
    }
    if (conf.crown) {
      const crown = new THREE.Group();
      crown.position.y = 0.3;
      const base = new THREE.Mesh(S.crownBaseGeo, S.crownMat);
      crown.add(base);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const spike = new THREE.Mesh(S.crownSpikeGeo, S.crownMat);
        spike.position.set(Math.cos(a) * 0.17, 0.12, Math.sin(a) * 0.17);
        crown.add(spike);
      }
      headGroup.add(crown);
    }

    const footL = new THREE.Mesh(S.footGeo, S.footMat);
    footL.position.set(-0.2, 0.07, 0.1);
    root.add(footL);
    const footR = new THREE.Mesh(S.footGeo, S.footMat);
    footR.position.set(0.2, 0.07, 0.1);
    root.add(footR);

    root.visible = false;
    this.root = root;
    this.bodyGroup = bodyGroup;
    this.headGroup = headGroup;
    this.wingL = wingL;
    this.wingR = wingR;
    this.footL = footL;
    this.footR = footR;
  }

  spawn(game, pos, hpScale, speedScale) {
    const conf = this.conf;
    this.alive = true;
    this.state = 'spawn';
    this.stateT = 0;
    this.s = conf.scale * rand(0.94, 1.06);
    this.maxHp = this.hp = Math.round(conf.hp * hpScale);
    this.speedScale = speedScale;
    this.attackCd = 0;
    this.eggT = rand(1.5, 2.5);
    this.flashT = 0;
    this.squash = 0;
    this.bodyMat.emissiveIntensity = 0;
    this.bodyMat.emissive.setHex(0xffffff);

    this.root.position.set(pos.x, 0, pos.z);
    this.yaw = Math.atan2(
      game.player.root.position.x - pos.x,
      game.player.root.position.z - pos.z,
    );
    this.root.rotation.y = this.yaw;
    this.root.scale.setScalar(0.01);
    this.root.visible = true;

    game.particles.beam(this.root.position, this.s);
    game.particles.puff(this.root.position, 2, this.s);
    game.audio?.spawnBeep(this.s);
  }

  /** كرتا الإصابة: الجسم والرأس في فضاء العالم */
  getHitSpheres(out) {
    const p = this.root.position;
    out.body.center.set(p.x, p.y + 0.55 * this.s, p.z);
    out.body.r = 0.56 * this.s;
    this.headGroup.getWorldPosition(out.head.center);
    out.head.r = 0.34 * this.s;
    return out;
  }

  update(dt, game, aliveDucks) {
    const conf = this.conf;
    this.animT += dt;
    this.stateT += dt;

    // وميض الإصابة والانكماش المرن
    if (this.flashT > 0) {
      this.flashT -= dt;
      this.bodyMat.emissiveIntensity = Math.max(0, this.flashT * 6);
    }
    this.squash = damp(this.squash, 0, 9, dt);
    const sq = 1 + this.squash;
    this.bodyGroup.scale.set(sq, 1 / sq, sq);

    const playerPos = game.player.root.position;
    const pos = this.root.position;
    const dx = playerPos.x - pos.x;
    const dz = playerPos.z - pos.z;
    const dist = Math.hypot(dx, dz);

    if (this.state === 'spawn') {
      const t = Math.min(this.stateT / 0.45, 1);
      // ظهور بقفزة مرنة
      const e = t < 1 ? 1 - Math.pow(1 - t, 3) * Math.cos(t * 7) : 1;
      this.root.scale.setScalar(Math.max(0.01, this.s * e));
      if (t >= 1) {
        this.root.scale.setScalar(this.s);
        this.state = 'chase';
      }
      return;
    }

    const speed = conf.speed * this.speedScale;

    if (this.state === 'chase') {
      // اتجاه مرغوب = نحو اللاعب + تنافر عن بقية البط
      let dirX = dx / (dist || 1);
      let dirZ = dz / (dist || 1);
      const sepR = CONFIG.ducks.separationRadius * this.s;
      for (const other of aliveDucks) {
        if (other === this || !other.alive) continue;
        const ox = pos.x - other.root.position.x;
        const oz = pos.z - other.root.position.z;
        const od = Math.hypot(ox, oz);
        const minD = sepR + other.conf.radius * other.s;
        if (od > 0.001 && od < minD) {
          const f = (minD - od) / minD;
          dirX += (ox / od) * f * 1.4;
          dirZ += (oz / od) * f * 1.4;
        }
      }
      const dl = Math.hypot(dirX, dirZ) || 1;
      const targetYaw = Math.atan2(dirX / dl, dirZ / dl);
      this.yaw = turnToward(this.yaw, targetYaw, conf.turnRate * dt);

      pos.x += Math.sin(this.yaw) * speed * dt;
      pos.z += Math.cos(this.yaw) * speed * dt;

      // الزعيم يقذف البيض من بعيد
      if (conf.ranged && game.projectiles) {
        this.eggT -= dt;
        if (this.eggT <= 0 && dist > 6 && dist < 34) {
          this.eggT = conf.eggInterval;
          this.headGroup.getWorldPosition(this._v);
          game.projectiles.spawnEgg(this._v, playerPos);
          game.audio?.quack(0.5, 1.4); // كواك عميق
        }
      }

      if (dist < conf.attackRange && this.attackCd <= 0) {
        this.state = 'windup';
        this.stateT = 0;
      }
    } else if (this.state === 'windup') {
      // تمهيد النقرة: الرأس يرجع للخلف
      this.headGroup.rotation.x = -clamp(this.stateT / 0.3, 0, 1) * 0.55;
      if (this.stateT >= 0.3) {
        this.state = 'attack';
        this.stateT = 0;
      }
    } else if (this.state === 'attack') {
      this.headGroup.rotation.x = -0.55 + clamp(this.stateT / 0.14, 0, 1) * 1.1;
      if (!this.hasHit && this.stateT >= 0.1) {
        this.hasHit = true;
        if (dist < conf.attackRange + 0.6) {
          game.player.takeDamage(conf.damage);
          game.audio?.peck();
        }
      }
      if (this.stateT >= 0.22) {
        this.state = 'recover';
        this.stateT = 0;
        this.hasHit = false;
        this.attackCd = conf.attackCooldown;
      }
    } else if (this.state === 'recover') {
      this.headGroup.rotation.x = damp(this.headGroup.rotation.x, 0, 10, dt);
      if (this.stateT >= 0.45) {
        this.state = 'chase';
        this.stateT = 0;
      }
    }

    this.attackCd -= dt;

    // تصادم مع العوائق وحدود الساحة
    const c = collideCircle(
      pos.x, pos.z, conf.radius * this.s, game.arena.obstacles, game.arena.half - 0.3,
    );
    pos.x = c.x;
    pos.z = c.z;
    this.root.rotation.y = this.yaw;

    // ---- التحريك ----
    const moving = this.state === 'chase';
    const wf = this.animT * (5 + speed * 2.2);
    const amp = moving ? 1 : 0.25;
    // مشية متهادية
    this.bodyGroup.rotation.z = Math.sin(wf) * 0.12 * amp;
    this.bodyGroup.position.y = 0.55 + Math.abs(Math.sin(wf)) * 0.06 * amp;
    this.footL.rotation.x = Math.sin(wf) * 0.7 * amp;
    this.footR.rotation.x = -Math.sin(wf) * 0.7 * amp;
    // رفرفة الأجنحة (أقوى للسريعة وعند الهجوم)
    const flap = this.typeKey === 'fast' || this.state !== 'chase' ? 1 : 0.25;
    this.wingL.rotation.z = 0.15 + Math.abs(Math.sin(wf * 1.6)) * 0.9 * flap;
    this.wingR.rotation.z = -0.15 - Math.abs(Math.sin(wf * 1.6)) * 0.9 * flap;
    // الرأس ينظر نحو اللاعب
    if (this.state === 'chase') {
      const lookYaw = Math.atan2(dx, dz);
      let diff = lookYaw - this.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.headGroup.rotation.y = clamp(diff, -0.7, 0.7) * 0.8;
      this.headGroup.rotation.x = damp(this.headGroup.rotation.x, 0, 8, dt);
    }

    // كواك عشوائي
    this.quackT -= dt;
    if (this.quackT <= 0) {
      this.quackT = rand(CONFIG.ducks.quackIntervalMin, CONFIG.ducks.quackIntervalMax);
      game.audio?.quack(this.s);
    }
  }

  takeDamage(dmg, isHead, point) {
    if (!this.alive) return;
    const game = this.game;
    this.hp -= dmg;
    this.flashT = 0.18;
    this.squash = Math.min(0.35, this.squash + 0.22);
    if (point) game.particles.featherBurst(point, 3, 0.5, this.s * 0.8);
    if (this.hp <= 0) {
      this.die(isHead);
    } else if (Math.random() < 0.3) {
      game.audio?.quack(this.s, rand(1.15, 1.3)); // صرخة احتجاج
    }
  }

  die(isHead) {
    const game = this.game;
    this.alive = false;
    this.root.visible = false;
    const center = this._v.set(
      this.root.position.x,
      this.root.position.y + 0.55 * this.s,
      this.root.position.z,
    );
    // فرقعة كرتونية: ريش وشرر — بدون أي دماء
    game.particles.featherBurst(center, Math.round(12 + 8 * this.s), 1 + this.s * 0.2, this.s);
    game.particles.sparkBurst(center, 6, this.s);
    game.particles.puff(center, 2, this.s);
    game.audio?.pop(this.s);
    game.audio?.quack(this.s, 0.8);
    game.pickups?.maybeDropHeart(this.root.position);
    game.onDuckKilled?.(this, isHead, center);
  }
}

export class DuckManager {
  constructor(game) {
    this.game = game;
    this.pools = { normal: [], fast: [], tank: [], boss: [] };
    this.ducks = []; // كل النسخ المنشأة (حيّة وغير حيّة)
    this.boss = null;
    this._spheres = {
      body: { center: new THREE.Vector3(), r: 0 },
      head: { center: new THREE.Vector3(), r: 0 },
    };
  }

  _get(typeKey) {
    const pool = this.pools[typeKey];
    if (pool.length) return pool.pop();
    const d = new Duck(typeKey, this.game);
    this.game.scene.add(d.root);
    this.ducks.push(d);
    return d;
  }

  spawn(typeKey, pos, hpScale = 1, speedScale = 1) {
    const d = this._get(typeKey);
    d.spawn(this.game, pos, hpScale, speedScale);
    if (typeKey === 'boss') this.boss = d;
    return d;
  }

  aliveCount() {
    let n = 0;
    for (const d of this.ducks) if (d.alive) n++;
    return n;
  }

  update(dt) {
    const alive = this.ducks.filter((d) => d.alive);
    for (const d of alive) {
      d.update(dt, this.game, alive);
      if (!d.alive) this.pools[d.typeKey].push(d);
    }
    // شريط صحة الزعيم
    if (this.boss) {
      if (this.boss.alive) {
        this.game.ui.setBoss(this.boss.hp / this.boss.maxHp);
      } else {
        this.game.ui.setBoss(null);
        this.boss = null;
      }
    }
  }

  /** أقرب إصابة بطة على الشعاع (الرأس له أولوية عند التقارب) */
  raycast(origin, dir, maxDist) {
    let best = null;
    for (const d of this.ducks) {
      if (!d.alive || d.state === 'spawn') continue;
      d.root.updateWorldMatrix(true, true);
      const sp = d.getHitSpheres(this._spheres);
      const headT = raySphere(origin, dir, sp.head.center, sp.head.r);
      const bodyT = raySphere(origin, dir, sp.body.center, sp.body.r);
      let t = null;
      let isHead = false;
      if (headT !== null && (bodyT === null || headT <= bodyT + 0.12)) {
        t = headT;
        isHead = true;
      } else if (bodyT !== null) {
        t = bodyT;
      }
      if (t !== null && t < maxDist && (!best || t < best.dist)) {
        best = { duck: d, dist: t, isHead };
      }
    }
    if (best) {
      best.point = new THREE.Vector3().copy(dir).multiplyScalar(best.dist).add(origin);
    }
    return best;
  }

  clear() {
    for (const d of this.ducks) {
      if (d.alive) {
        d.alive = false;
        d.root.visible = false;
        this.pools[d.typeKey].push(d);
      }
    }
    this.boss = null;
    this.game.ui.setBoss(null);
  }
}

/** تقاطع شعاع/كرة — يعيد المسافة أو null */
function raySphere(origin, dir, center, r) {
  const ox = center.x - origin.x;
  const oy = center.y - origin.y;
  const oz = center.z - origin.z;
  const tca = ox * dir.x + oy * dir.y + oz * dir.z;
  if (tca < 0) return null;
  const d2 = ox * ox + oy * oy + oz * oz - tca * tca;
  const r2 = r * r;
  if (d2 > r2) return null;
  return Math.max(0, tca - Math.sqrt(r2 - d2));
}
