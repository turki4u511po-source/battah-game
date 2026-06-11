// قلوب العلاج: يسقطها البط أحيانًا عند الفرقعة، تنجذب للاعب وتعالج +25.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { rand } from './utils.js';

const POOL = 6;
const HEAL_AMOUNT = 25;
const LIFETIME = 14;
const MAGNET_DIST = 3.2;
const PICKUP_DIST = 1.15;

function makeHeartGeometry() {
  // شكل قلب عبر منحنيات بيزييه ثم بثق
  const s = new THREE.Shape();
  const k = 0.32;
  s.moveTo(0, -k * 0.9);
  s.bezierCurveTo(k * 1.6, k * 0.2, k * 0.9, k * 1.35, 0, k * 0.55);
  s.bezierCurveTo(-k * 0.9, k * 1.35, -k * 1.6, k * 0.2, 0, -k * 0.9);
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: 0.14, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2,
  });
  geo.center();
  return geo;
}

export class Pickups {
  constructor(game) {
    this.game = game;
    const geo = makeHeartGeometry();
    const mat = new THREE.MeshLambertMaterial({
      color: 0xe23b51, emissive: 0xa3122c, emissiveIntensity: 0.5,
    });
    this.hearts = [];
    for (let i = 0; i < POOL; i++) {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      mesh.visible = false;
      game.scene.add(mesh);
      this.hearts.push({ mesh, active: false, life: 0, phase: rand(0, 6) });
    }
  }

  maybeDropHeart(pos) {
    const lowHp = this.game.player.health < 40;
    const chance = lowHp
      ? CONFIG.ducks.heartDropChanceLowHp
      : CONFIG.ducks.heartDropChance;
    if (Math.random() > chance) return;
    const heart = this.hearts.find((h) => !h.active);
    if (!heart) return;
    heart.active = true;
    heart.life = LIFETIME;
    heart.mesh.visible = true;
    heart.mesh.position.set(pos.x, 0.6, pos.z);
  }

  update(dt) {
    const game = this.game;
    const pp = game.player.root.position;
    const t = game.time;
    for (const h of this.hearts) {
      if (!h.active) continue;
      h.life -= dt;
      if (h.life <= 0) {
        h.active = false;
        h.mesh.visible = false;
        continue;
      }
      // وميض قبل الاختفاء
      h.mesh.visible = h.life > 3 || Math.sin(h.life * 14) > -0.2;

      h.mesh.rotation.y += 2.2 * dt;
      h.mesh.position.y = 0.6 + Math.sin(t * 3 + h.phase) * 0.12;

      const dx = pp.x - h.mesh.position.x;
      const dz = pp.z - h.mesh.position.z;
      const d = Math.hypot(dx, dz);
      if (d < MAGNET_DIST && d > 0.01) {
        const pull = 4.5 * dt / d;
        h.mesh.position.x += dx * pull;
        h.mesh.position.z += dz * pull;
      }
      if (d < PICKUP_DIST) {
        h.active = false;
        h.mesh.visible = false;
        game.player.heal(HEAL_AMOUNT);
        game.audio?.heal();
        game.ui.popupAtWorld?.(h.mesh.position, `‎+${HEAL_AMOUNT}‎ ♥`, 'pop-heal');
      }
    }
  }

  clear() {
    for (const h of this.hearts) {
      h.active = false;
      h.mesh.visible = false;
    }
  }
}
