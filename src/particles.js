// نظام جسيمات مُجمَّع (Pooled): ريش، شرر، نفث، شظايا بيض، أعمدة تجسيد.
// كل الأشكال Primitives وكل التلاشي بالانكماش — لا خامات لكل جسيم ولا إنشاء في حلقة اللعب.

import * as THREE from 'three';
import { rand, choose, lerp } from './utils.js';

const COUNTS = { feather: 150, spark: 90, puff: 40, shard: 30, beam: 8 };

const FEATHER_COLORS = [0xffd23f, 0xf4b81e, 0xfff3c4, 0xffffff, 0xffe9a0];

export class Particles {
  constructor(scene) {
    this.scene = scene;
    this.active = [];
    this.pools = {};

    const geos = {
      feather: new THREE.PlaneGeometry(0.13, 0.26),
      spark: new THREE.BoxGeometry(0.05, 0.05, 0.2),
      puff: new THREE.SphereGeometry(0.13, 6, 5),
      shard: new THREE.TetrahedronGeometry(0.09),
      beam: new THREE.CylinderGeometry(0.5, 0.5, 4, 10, 1, true),
    };

    this.mats = {
      feathers: FEATHER_COLORS.map(
        (c) => new THREE.MeshLambertMaterial({ color: c, side: THREE.DoubleSide }),
      ),
      spark: new THREE.MeshBasicMaterial({
        color: 0xffd76b, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
      }),
      puff: new THREE.MeshBasicMaterial({
        color: 0xf6e7c8, transparent: true, opacity: 0.5, depthWrite: false,
      }),
      shard: new THREE.MeshLambertMaterial({ color: 0xfff6e0, side: THREE.DoubleSide }),
      beam: new THREE.MeshBasicMaterial({
        color: 0x7fe7ff, blending: THREE.AdditiveBlending, transparent: true,
        opacity: 0.65, depthWrite: false, side: THREE.DoubleSide,
      }),
    };

    for (const kind of Object.keys(COUNTS)) {
      this.pools[kind] = [];
      for (let i = 0; i < COUNTS[kind]; i++) {
        const mat = kind === 'feather' ? choose(this.mats.feathers) : this.mats[kind];
        const mesh = new THREE.Mesh(geos[kind], mat);
        mesh.visible = false;
        scene.add(mesh);
        this.pools[kind].push({
          kind, mesh,
          vel: new THREE.Vector3(),
          spin: new THREE.Vector3(),
          life: 0, maxLife: 1,
          grav: 0, drag: 0,
          scaleFrom: 1, scaleTo: 1,
          seed: rand(0, 10),
          flutter: 0,
        });
      }
    }
  }

  _take(kind) {
    const pool = this.pools[kind];
    if (pool.length) return pool.pop();
    // السرقة من الأقدم عند النفاد
    for (let i = 0; i < this.active.length; i++) {
      if (this.active[i].kind === kind) {
        const item = this.active.splice(i, 1)[0];
        return item;
      }
    }
    return null;
  }

  _spawn(kind, x, y, z, opts) {
    const it = this._take(kind);
    if (!it) return null;
    it.mesh.position.set(x, y, z);
    it.mesh.rotation.set(rand(0, 6.28), rand(0, 6.28), rand(0, 6.28));
    it.vel.set(opts.vx || 0, opts.vy || 0, opts.vz || 0);
    it.spin.set(rand(-6, 6), rand(-6, 6), rand(-6, 6));
    it.maxLife = it.life = opts.life;
    it.grav = opts.grav ?? 0;
    it.drag = opts.drag ?? 0;
    it.scaleFrom = opts.scaleFrom ?? 1;
    it.scaleTo = opts.scaleTo ?? 0.01;
    it.flutter = opts.flutter ?? 0;
    it.mesh.scale.setScalar(it.scaleFrom);
    it.mesh.visible = true;
    this.active.push(it);
    return it;
  }

  /** فرقعة ريش كرتونية عند موت بطة (بدون أي دماء) */
  featherBurst(pos, count = 18, power = 1, scale = 1) {
    for (let i = 0; i < count; i++) {
      const a = rand(0, Math.PI * 2);
      const up = rand(1.5, 4.5) * power;
      this._spawn('feather', pos.x, pos.y + rand(0, 0.5 * scale), pos.z, {
        vx: Math.cos(a) * rand(0.5, 3) * power,
        vy: up,
        vz: Math.sin(a) * rand(0.5, 3) * power,
        life: rand(0.7, 1.4),
        grav: 3.2, drag: 1.6,
        scaleFrom: rand(0.7, 1.3) * scale,
        scaleTo: 0.05,
        flutter: rand(1, 2.4),
      });
    }
  }

  /** شرر إصابة (طلقة بجدار/صندوق أو ضربة روبوت) */
  sparkBurst(pos, count = 6, power = 1) {
    for (let i = 0; i < count; i++) {
      const a = rand(0, Math.PI * 2);
      this._spawn('spark', pos.x, pos.y, pos.z, {
        vx: Math.cos(a) * rand(1, 5) * power,
        vy: rand(0.5, 4) * power,
        vz: Math.sin(a) * rand(1, 5) * power,
        life: rand(0.18, 0.4),
        grav: 9, drag: 2.5,
        scaleFrom: rand(0.7, 1.2),
        scaleTo: 0.05,
      });
    }
  }

  /** نفث غبار/دخان صغير */
  puff(pos, count = 3, scale = 1) {
    for (let i = 0; i < count; i++) {
      this._spawn('puff', pos.x + rand(-0.1, 0.1), pos.y, pos.z + rand(-0.1, 0.1), {
        vx: rand(-0.5, 0.5), vy: rand(0.4, 1.2), vz: rand(-0.5, 0.5),
        life: rand(0.35, 0.6),
        grav: -0.6, drag: 1.5,
        scaleFrom: 0.8 * scale,
        scaleTo: 2.4 * scale,
      });
    }
  }

  /** شظايا قشر بيض الزعيم */
  eggBurst(pos, count = 10) {
    for (let i = 0; i < count; i++) {
      const a = rand(0, Math.PI * 2);
      this._spawn('shard', pos.x, pos.y + 0.1, pos.z, {
        vx: Math.cos(a) * rand(1, 4),
        vy: rand(2, 5),
        vz: Math.sin(a) * rand(1, 4),
        life: rand(0.4, 0.8),
        grav: 11, drag: 0.5,
        scaleFrom: rand(0.8, 1.4),
        scaleTo: 0.1,
      });
    }
  }

  /** عمود ضوء تجسيد البط الآلي */
  beam(pos, scale = 1) {
    const it = this._spawn('beam', pos.x, pos.y + 2 * scale, pos.z, {
      life: 0.45,
      scaleFrom: scale,
      scaleTo: 0.01,
    });
    if (it) {
      it.mesh.rotation.set(0, 0, 0);
      it.spin.set(0, rand(2, 5), 0);
    }
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
      if (it.drag) {
        const f = Math.max(0, 1 - it.drag * dt);
        it.vel.multiplyScalar(f);
      }
      if (it.flutter) {
        m.position.x += Math.sin(it.life * 9 + it.seed) * it.flutter * dt;
        m.position.z += Math.cos(it.life * 7 + it.seed) * it.flutter * dt * 0.7;
      }
      m.position.addScaledVector(it.vel, dt);
      m.rotation.x += it.spin.x * dt;
      m.rotation.y += it.spin.y * dt;
      m.rotation.z += it.spin.z * dt;
      const t = 1 - it.life / it.maxLife;
      const s = lerp(it.scaleFrom, it.scaleTo, t * t);
      if (it.kind === 'beam') {
        m.scale.set(s, it.scaleFrom, s); // العمود ينكمش عرضًا فقط
      } else {
        m.scale.setScalar(s);
      }
    }
  }

  clear() {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const it = this.active[i];
      it.mesh.visible = false;
      this.pools[it.kind].push(it);
    }
    this.active.length = 0;
  }
}
