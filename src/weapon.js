// «قاذف الفلّين»: سلاح Hitscan بمجسم إجرائي معلّق بالكاميرا،
// مع ذخيرة وإعادة تعبئة وارتداد وأثر طلقة ووميض فوهة.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { clamp, damp, rand } from './utils.js';

const W = CONFIG.weapon;
const TRACER_COUNT = 10;

export class Weapon {
  constructor(game) {
    this.game = game;

    this.ammo = W.magSize;
    this.reloading = false;
    this.reloadT = 0;
    this.cooldown = 0;
    this.modelKick = 0;

    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = W.range;

    this._origin = new THREE.Vector3();
    this._dir = new THREE.Vector3();
    this._muzzleWorld = new THREE.Vector3();
    this._end = new THREE.Vector3();

    this.buildModel();
    this.buildEffects();
  }

  buildModel() {
    const g = new THREE.Group();
    const metal = new THREE.MeshLambertMaterial({ color: 0x46525e });
    const metalDark = new THREE.MeshLambertMaterial({ color: 0x303a44 });
    const orange = new THREE.MeshLambertMaterial({ color: 0xff8c1a });
    const wood = new THREE.MeshLambertMaterial({ color: 0x9a6b3a });
    const teal = new THREE.MeshLambertMaterial({ color: 0x2fb3a8 });
    const cork = new THREE.MeshLambertMaterial({ color: 0xd9a45f });

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.15, 0.4), metal);
    g.add(body);

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.34, 10), metalDark);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.02, -0.34);
    g.add(barrel);

    // فوهة برتقالية — علامة "لعبة" واضحة
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.06, 10), orange);
    tip.rotation.x = Math.PI / 2;
    tip.position.set(0, 0.02, -0.5);
    g.add(tip);

    this.corkMesh = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), cork);
    this.corkMesh.position.set(0, 0.02, -0.53);
    g.add(this.corkMesh);

    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.2, 0.11), wood);
    grip.position.set(0, -0.15, 0.12);
    grip.rotation.x = 0.35;
    g.add(grip);

    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.2, 8), teal);
    tank.rotation.x = Math.PI / 2;
    tank.position.set(0, -0.07, -0.2);
    g.add(tank);

    const sight = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.05, 0.02), orange);
    sight.position.set(0, 0.1, -0.16);
    g.add(sight);

    // نقطة الفوهة لمصدر الأثر والوميض
    this.muzzle = new THREE.Object3D();
    this.muzzle.position.set(0, 0.02, -0.56);
    g.add(this.muzzle);

    g.position.set(0.26, -0.22, -0.42);
    g.rotation.y = 0.06;
    g.visible = false;
    this.model = g;
    this.baseZ = g.position.z;
    this.game.camera.add(g);
  }

  buildEffects() {
    // وميض الفوهة: مستويان متصالبان + ضوء نقطي قصير
    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xffd27a, blending: THREE.AdditiveBlending,
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
    });
    const flashGeo = new THREE.PlaneGeometry(0.34, 0.34);
    this.flash = new THREE.Group();
    const f1 = new THREE.Mesh(flashGeo, flashMat);
    const f2 = new THREE.Mesh(flashGeo, flashMat);
    f2.rotation.z = Math.PI / 4;
    this.flash.add(f1, f2);
    this.flash.visible = false;
    this.muzzle.add(this.flash);

    this.flashLight = new THREE.PointLight(0xffc36b, 0, 7);
    this.muzzle.add(this.flashLight);
    this.flashT = 0;

    // مخزن آثار الطلقات
    const tracerGeo = new THREE.BoxGeometry(0.016, 0.016, 1);
    tracerGeo.translate(0, 0, 0.5);
    const tracerMat = new THREE.MeshBasicMaterial({
      color: 0xffe9a0, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
    });
    this.tracers = [];
    for (let i = 0; i < TRACER_COUNT; i++) {
      const m = new THREE.Mesh(tracerGeo, tracerMat);
      m.visible = false;
      this.game.scene.add(m);
      this.tracers.push({ mesh: m, life: 0 });
    }
    this.tracerIdx = 0;
  }

  reset() {
    this.ammo = W.magSize;
    this.reloading = false;
    this.reloadT = 0;
    this.cooldown = 0;
    this.modelKick = 0;
    this.corkMesh.visible = true;
    this.game.ui.setAmmo(this.ammo);
    this.game.ui.setReload(null);
    this.game.ui.setReloadHint(false);
  }

  startReload() {
    if (this.reloading || this.ammo === W.magSize) return;
    this.reloading = true;
    this.reloadT = 0;
    this.game.ui.setReloadHint(false);
    this.game.audio?.reload();
  }

  tryFire() {
    if (this.cooldown > 0 || this.reloading) return;
    if (this.ammo <= 0) {
      this.startReload();
      return;
    }
    const game = this.game;
    this.ammo--;
    this.cooldown = W.fireInterval;
    game.ui.setAmmo(this.ammo);

    // الإطلاق من مركز الشاشة
    game.camera.getWorldPosition(this._origin);
    game.camera.getWorldDirection(this._dir);

    // أقرب عائق يحجب الطلقة
    this.raycaster.set(this._origin, this._dir);
    const hits = this.raycaster.intersectObjects(game.arena.collidables, false);
    const blockDist = hits.length ? hits[0].distance : Infinity;

    // أقرب بطة قبل العائق
    const duckHit = game.ducks
      ? game.ducks.raycast(this._origin, this._dir, Math.min(blockDist, W.range))
      : null;

    if (duckHit) {
      const dmg = W.damage * (duckHit.isHead ? W.headshotMult : 1);
      duckHit.duck.takeDamage(dmg, duckHit.isHead, duckHit.point);
      game.ui.hitmarker(duckHit.isHead);
      game.audio?.hitTick(duckHit.isHead);
      this._end.copy(duckHit.point);
    } else if (blockDist < W.range) {
      this._end.copy(this._dir).multiplyScalar(blockDist).add(this._origin);
      game.particles.sparkBurst(this._end, 5, 0.8);
      game.particles.puff(this._end, 1, 0.6);
    } else {
      this._end.copy(this._dir).multiplyScalar(W.range).add(this._origin);
    }

    // الأثر والوميض والارتداد
    this.muzzle.getWorldPosition(this._muzzleWorld);
    this.spawnTracer(this._muzzleWorld, this._end);
    this.flashT = 0.055;
    this.flash.rotation.z = rand(0, Math.PI);
    this.flash.visible = true;
    this.flashLight.intensity = 2.6;
    this.modelKick = 1;
    game.player.recoil = clamp(game.player.recoil + W.kickPitch, 0, 0.09);
    game.player.addShake(0.04);
    game.audio?.shot();

    this.corkMesh.visible = this.ammo > 0;
    if (this.ammo === 0) this.startReload();
  }

  spawnTracer(from, to) {
    const t = this.tracers[this.tracerIdx];
    this.tracerIdx = (this.tracerIdx + 1) % TRACER_COUNT;
    const dist = from.distanceTo(to);
    t.mesh.position.copy(from);
    t.mesh.lookAt(to);
    t.mesh.scale.set(1, 1, dist);
    t.mesh.visible = true;
    t.life = 0.07;
  }

  update(dt) {
    const game = this.game;
    this.cooldown -= dt;

    if (this.reloading) {
      this.reloadT += dt;
      const p = clamp(this.reloadT / W.reloadTime, 0, 1);
      game.ui.setReload(p);
      if (p >= 1) {
        this.reloading = false;
        this.ammo = W.magSize;
        this.corkMesh.visible = true;
        game.ui.setAmmo(this.ammo);
        game.ui.setReload(null);
        game.audio?.reloadDone();
      }
    }

    if (game.input.trigger && game.state === 'playing') this.tryFire();

    // حركة المجسم: ارتداد + تمايل مشي + غطسة إعادة التعبئة
    this.modelKick = damp(this.modelKick, 0, 16, dt);
    const speed = Math.hypot(game.player.vel.x, game.player.vel.z);
    const sway = Math.min(speed / CONFIG.player.sprintSpeed, 1);
    const t = game.time;
    const dip = this.reloading
      ? Math.sin(clamp(this.reloadT / W.reloadTime, 0, 1) * Math.PI) * 0.45
      : 0;
    this.model.position.z = this.baseZ + this.modelKick * 0.07;
    this.model.position.y = -0.22 + Math.sin(t * 9) * 0.006 * sway - dip * 0.12;
    this.model.position.x = 0.26 + Math.cos(t * 4.5) * 0.005 * sway;
    this.model.rotation.x = this.modelKick * 0.16 - dip;

    // وميض الفوهة
    if (this.flashT > 0) {
      this.flashT -= dt;
      if (this.flashT <= 0) this.flash.visible = false;
    }
    this.flashLight.intensity = damp(this.flashLight.intensity, 0, 28, dt);

    // آثار الطلقات
    for (const tr of this.tracers) {
      if (!tr.mesh.visible) continue;
      tr.life -= dt;
      if (tr.life <= 0) tr.mesh.visible = false;
    }

    game.ui.setReloadHint(!this.reloading && this.ammo === 0);
  }
}
