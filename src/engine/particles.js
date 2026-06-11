// جسيمات مُجمَّعة: شرر إصابة، نفث غبار، شظايا، وآثار رصاص (tracers).
// بدون دماء — كل تأثيرات الإصابة وميض/شرر (القسم 0).

import * as THREE from 'three';
import { rand, lerp } from './utils.js';

export class Particles {
  constructor(scene, qualityFactor = 1) {
    this.scene = scene;
    this.q = qualityFactor;
    this.active = [];
    this.pools = {};

    const geos = {
      spark: new THREE.BoxGeometry(0.04, 0.04, 0.16),
      puff: new THREE.SphereGeometry(0.1, 6, 5),
      chip: new THREE.BoxGeometry(0.07, 0.07, 0.07),
    };
    const mats = {
      spark: new THREE.MeshBasicMaterial({
        color: 0xffd87a, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
      }),
      puff: new THREE.MeshBasicMaterial({
        color: 0xcfc6b8, transparent: true, opacity: 0.45, depthWrite: false,
      }),
      chip: new THREE.MeshLambertMaterial({ color: 0x8d8478 }),
    };
    const counts = {
      spark: Math.round(70 * qualityFactor),
      puff: Math.round(36 * qualityFactor),
      chip: Math.round(28 * qualityFactor),
    };
    for (const kind of Object.keys(counts)) {
      this.pools[kind] = [];
      for (let i = 0; i < counts[kind]; i++) {
        const mesh = new THREE.Mesh(geos[kind], mats[kind]);
        mesh.visible = false;
        scene.add(mesh);
        this.pools[kind].push({
          kind, mesh,
          vel: new THREE.Vector3(),
          spin: new THREE.Vector3(),
          life: 0, maxLife: 1, grav: 0,
          scaleFrom: 1, scaleTo: 0.05,
        });
      }
    }

    // آثار الرصاص
    const trGeo = new THREE.BoxGeometry(0.012, 0.012, 1);
    trGeo.translate(0, 0, 0.5);
    const trMat = new THREE.MeshBasicMaterial({
      color: 0xffeebb, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
    });
    this.tracers = [];
    for (let i = 0; i < 24; i++) {
      const mesh = new THREE.Mesh(trGeo, trMat);
      mesh.visible = false;
      scene.add(mesh);
      this.tracers.push({ mesh, life: 0 });
    }
    this.trIdx = 0;
  }

  _spawn(kind, x, y, z, o) {
    const pool = this.pools[kind];
    let it = pool.pop();
    if (!it) {
      const idx = this.active.findIndex((a) => a.kind === kind);
      if (idx === -1) return;
      it = this.active.splice(idx, 1)[0];
    }
    it.mesh.position.set(x, y, z);
    it.mesh.rotation.set(rand(0, 6.3), rand(0, 6.3), rand(0, 6.3));
    it.vel.set(o.vx || 0, o.vy || 0, o.vz || 0);
    it.spin.set(rand(-7, 7), rand(-7, 7), rand(-7, 7));
    it.life = it.maxLife = o.life;
    it.grav = o.grav ?? 0;
    it.scaleFrom = o.scaleFrom ?? 1;
    it.scaleTo = o.scaleTo ?? 0.05;
    it.mesh.scale.setScalar(it.scaleFrom);
    it.mesh.visible = true;
    this.active.push(it);
  }

  /** شرر إصابة (جسد أو جدار) — تأثير بلا دماء */
  impactSparks(p, n = 5, power = 1) {
    n = Math.round(n * this.q) || 1;
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      this._spawn('spark', p.x, p.y, p.z, {
        vx: Math.cos(a) * rand(1, 4.5) * power,
        vy: rand(0.5, 3.5) * power,
        vz: Math.sin(a) * rand(1, 4.5) * power,
        life: rand(0.15, 0.34),
        grav: 10,
        scaleFrom: rand(0.7, 1.2),
      });
    }
  }

  /** نفث غبار عند ارتطام الرصاص بالأرض/الجدران */
  dustPuff(p, n = 2, scale = 1) {
    n = Math.round(n * this.q) || 1;
    for (let i = 0; i < n; i++) {
      this._spawn('puff', p.x + rand(-0.08, 0.08), p.y, p.z + rand(-0.08, 0.08), {
        vx: rand(-0.4, 0.4), vy: rand(0.3, 1), vz: rand(-0.4, 0.4),
        life: rand(0.3, 0.55),
        grav: -0.5,
        scaleFrom: 0.7 * scale,
        scaleTo: 2.2 * scale,
      });
    }
  }

  /** شظايا جدار صغيرة */
  wallChips(p, n = 3) {
    n = Math.round(n * this.q) || 1;
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      this._spawn('chip', p.x, p.y, p.z, {
        vx: Math.cos(a) * rand(0.5, 2.5),
        vy: rand(1, 3),
        vz: Math.sin(a) * rand(0.5, 2.5),
        life: rand(0.3, 0.6),
        grav: 11,
        scaleFrom: rand(0.6, 1.1),
        scaleTo: 0.2,
      });
    }
  }

  /** أثر رصاصة من الفوهة لنقطة الإصابة */
  tracer(from, to) {
    const t = this.tracers[this.trIdx];
    this.trIdx = (this.trIdx + 1) % this.tracers.length;
    const dist = from.distanceTo(to);
    if (dist < 0.5) return;
    t.mesh.position.copy(from);
    t.mesh.lookAt(to);
    t.mesh.scale.set(1, 1, dist);
    t.mesh.visible = true;
    t.life = 0.06;
  }

  update(dt) {
    const act = this.active;
    for (let i = act.length - 1; i >= 0; i--) {
      const it = act[i];
      it.life -= dt;
      if (it.life <= 0) {
        it.mesh.visible = false;
        act.splice(i, 1);
        this.pools[it.kind].push(it);
        continue;
      }
      const m = it.mesh;
      it.vel.y -= it.grav * dt;
      m.position.addScaledVector(it.vel, dt);
      m.rotation.x += it.spin.x * dt;
      m.rotation.y += it.spin.y * dt;
      const t = 1 - it.life / it.maxLife;
      m.scale.setScalar(lerp(it.scaleFrom, it.scaleTo, t * t));
    }
    for (const tr of this.tracers) {
      if (!tr.mesh.visible) continue;
      tr.life -= dt;
      if (tr.life <= 0) tr.mesh.visible = false;
    }
  }
}
