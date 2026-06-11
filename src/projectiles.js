// بيض الزعيم البطّوط: قذائف مقوسة بالجاذبية تنفجر قشورًا (بدون دماء).

import * as THREE from 'three';
import { clamp, rand } from './utils.js';

const GRAVITY = 14;
const POOL = 8;
const DIRECT_DAMAGE = 16;
const SPLASH_RADIUS = 2.4;

export class Projectiles {
  constructor(game) {
    this.game = game;
    const geo = new THREE.SphereGeometry(0.17, 10, 8);
    geo.scale(1, 1.3, 1);
    const mat = new THREE.MeshLambertMaterial({ color: 0xf6efe2 });
    this.eggs = [];
    for (let i = 0; i < POOL; i++) {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      mesh.visible = false;
      game.scene.add(mesh);
      this.eggs.push({
        mesh, active: false,
        vel: new THREE.Vector3(),
        spin: rand(2, 6),
        trailT: 0,
      });
    }
  }

  spawnEgg(from, targetPos) {
    let egg = this.eggs.find((e) => !e.active);
    if (!egg) egg = this.eggs[0];
    egg.active = true;
    egg.mesh.visible = true;
    egg.mesh.position.copy(from);
    // حساب سرعة قوسية تهبط قرب اللاعب (مع تشتيت بسيط ليكون التفادي ممكنًا)
    const tx = targetPos.x + rand(-1.2, 1.2);
    const tz = targetPos.z + rand(-1.2, 1.2);
    const dx = tx - from.x;
    const dz = tz - from.z;
    const dist = Math.hypot(dx, dz);
    const T = clamp(dist * 0.075, 0.8, 1.7);
    egg.vel.set(dx / T, (0 - from.y + 0.5 * GRAVITY * T * T) / T, dz / T);
    egg.trailT = 0;
  }

  explode(egg) {
    const game = this.game;
    const pos = egg.mesh.position;
    game.particles.eggBurst(pos, 10);
    game.particles.puff(pos, 3, 1.2);
    game.audio?.eggCrack();
    // ضرر منطقة صغير
    const pp = game.player.root.position;
    const d = Math.hypot(pp.x - pos.x, pp.z - pos.z);
    if (d < SPLASH_RADIUS && pos.y < 1.6) {
      const dmg = Math.round(DIRECT_DAMAGE * (1 - (d / SPLASH_RADIUS) * 0.6));
      game.player.takeDamage(dmg);
    }
    egg.active = false;
    egg.mesh.visible = false;
  }

  update(dt) {
    const game = this.game;
    const pp = game.player.root.position;
    for (const egg of this.eggs) {
      if (!egg.active) continue;
      egg.vel.y -= GRAVITY * dt;
      egg.mesh.position.addScaledVector(egg.vel, dt);
      egg.mesh.rotation.x += egg.spin * dt;
      egg.mesh.rotation.z += egg.spin * 0.7 * dt;

      // أثر نفث خفيف
      egg.trailT -= dt;
      if (egg.trailT <= 0) {
        egg.trailT = 0.09;
        game.particles.puff(egg.mesh.position, 1, 0.5);
      }

      // إصابة مباشرة للاعب
      const ex = egg.mesh.position.x - pp.x;
      const ez = egg.mesh.position.z - pp.z;
      const ey = egg.mesh.position.y;
      if (ex * ex + ez * ez < 0.7 * 0.7 && ey > 0 && ey < 2.1) {
        this.explode(egg);
        continue;
      }
      // ارتطام بالأرض
      if (ey <= 0.14) this.explode(egg);
    }
  }

  clear() {
    for (const egg of this.eggs) {
      egg.active = false;
      egg.mesh.visible = false;
    }
  }
}
