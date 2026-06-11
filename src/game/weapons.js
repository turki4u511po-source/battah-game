// الأسلحة: حامل السلاح (WeaponRig) المشترك بين اللاعب والبوتات،
// حلّ الإصابات hitscan (انتشار/falloff/مضاعفات رأس وصدر)، النعال
// بكشف الضربة الخلفية (قوس 120°)، ونموذج اليد FPS بكل حركاته.

import * as THREE from 'three';
import { WEAPONS, fireInterval, damageFalloff } from '../data/weapons-data.js';
import { clamp, damp, lerp, rand, deg2rad } from '../engine/utils.js';
import { raycastWorld, rayCapsule, raySphere } from '../engine/physics.js';
import { buildWeaponModel, buildHeldModel } from './weapon-models.js';
import { CAPSULE_RADIUS } from './player.js';

const SWAP_TIME = 0.32;
const MAX_RANGE = 220;

const _origin = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _u = new THREE.Vector3();
const _v = new THREE.Vector3();
const _pdir = new THREE.Vector3();
const _end = new THREE.Vector3();
const _muzzle = new THREE.Vector3();

export class WeaponRig {
  constructor(combatant, primaryId) {
    this.c = combatant;
    this.match = combatant.match;
    this.states = {};
    this.makeState('nial');
    this.primaryId = primaryId;
    this.makeState(primaryId);
    this.held = 'primary';
    this.cooldown = 0;
    this.swapT = 0;
    this.quickSwingT = 0;
    this.quickHit = false;
    this.attachHeldModel();
    this.hudSync();
  }

  makeState(id) {
    const w = WEAPONS[id];
    this.states[id] = { ammo: w.mag, reserve: w.reserve, reloading: false, reloadT: 0 };
  }

  setPrimary(id) {
    this.primaryId = id;
    this.makeState(id);
    if (this.held === 'primary') this.attachHeldModel();
    this.hudSync();
  }

  get currentId() {
    return this.held === 'primary' ? this.primaryId : 'nial';
  }

  get current() {
    return WEAPONS[this.currentId];
  }

  get curState() {
    return this.states[this.currentId];
  }

  moveMult() {
    return this.current.moveMult ?? 1;
  }

  refill() {
    this.makeState('nial');
    this.makeState(this.primaryId);
    this.cooldown = 0;
    this.swapT = 0;
    this.quickSwingT = 0;
    this.hudSync();
  }

  selectSlot(slot) {
    if (slot === this.held || !this.c.alive) return;
    const st = this.curState;
    st.reloading = false;
    st.reloadT = 0;
    this.held = slot;
    this.swapT = SWAP_TIME;
    this.attachHeldModel();
    this.match.game.audio?.swap();
    this.hudSync();
  }

  toggleSlot() {
    this.selectSlot(this.held === 'primary' ? 'nial' : 'primary');
  }

  /** انتشار اللحظة بالدرجات: يتسع مع الحركة/الهواء ويضيق مع ADS/القرفصاء */
  spreadDeg() {
    const w = this.current;
    const c = this.c;
    const sp = w.spread;
    let deg = lerp(sp.base, sp.ads, c.adsT);
    const hSpeed = Math.hypot(c.vel.x, c.vel.z);
    deg += sp.move * clamp(hSpeed / 6.3, 0, 1) * (1 - c.adsT * 0.6);
    if (!c.onGround) deg += 1.4;
    if (c.stance === 'crouch') deg *= sp.crouch;
    else if (c.stance === 'prone') deg *= sp.crouch * 0.8;
    return deg;
  }

  /** pressed = ضغطة جديدة هذا الإطار (للأسلحة غير الآلية) */
  tryFire(pressed) {
    const w = this.current;
    const c = this.c;
    if (!c.alive || this.swapT > 0 || this.cooldown > 0 || this.quickSwingT > 0) return;
    if (!w.auto && !pressed) return;
    if (c.sprintFireBlocked()) return;

    if (w.melee) {
      this.cooldown = w.fireInterval;
      c.protT = 0;
      meleeAttack(this.match, c);
      this.c.viewModel?.swing();
      return;
    }

    const st = this.curState;
    if (st.reloading) {
      if (w.shellByShell && st.ammo > 0) {
        st.reloading = false; // إطلاق الشوزن يقطع التعبئة
        st.reloadT = 0;
      } else return;
    }
    if (st.ammo <= 0) {
      if (pressed) {
        this.match.game.audio?.dryFire();
        this.startReload();
      }
      return;
    }

    st.ammo--;
    this.cooldown = fireInterval(w);
    c.protT = 0; // الإطلاق يكسر حماية السباون

    fireHitscan(this.match, c, w, deg2rad(this.spreadDeg()));

    if (c.isPlayer) {
      const adsFactor = 1 - c.adsT * 0.35;
      c.recoilPitch += w.recoil.v * adsFactor;
      c.recoilYaw += rand(-w.recoil.h, w.recoil.h) * adsFactor;
      c.viewModel?.kick();
    }
    if (st.ammo === 0) this.startReload();
    this.hudSync();
  }

  startReload() {
    const w = this.current;
    const st = this.curState;
    if (w.melee || st.reloading || st.ammo >= w.mag || st.reserve <= 0 || !this.c.alive) return;
    st.reloading = true;
    st.reloadT = 0;
    this.match.game.audio?.reload(w.id);
  }

  /** ضربة نعال سريعة (V) دون تبديل السلاح */
  quickSlipper() {
    if (!this.c.alive) return;
    if (this.currentId === 'nial') {
      this.tryFire(true);
      return;
    }
    if (this.quickSwingT > 0 || this.swapT > 0) return;
    this.quickSwingT = 0.46;
    this.quickHit = false;
    this.c.viewModel?.swing(true);
  }

  update(dt) {
    this.cooldown -= dt;
    this.swapT -= dt;
    const w = this.current;
    const st = this.curState;

    if (st.reloading) {
      st.reloadT += dt;
      if (w.shellByShell) {
        if (st.reloadT >= w.reloadTime) {
          st.reloadT = 0;
          st.ammo++;
          st.reserve--;
          this.match.game.audio?.reload(w.id);
          if (st.ammo >= w.mag || st.reserve <= 0) st.reloading = false;
          this.hudSync();
        }
      } else if (st.reloadT >= w.reloadTime) {
        const take = Math.min(w.mag - st.ammo, st.reserve);
        st.ammo += take;
        st.reserve -= take;
        st.reloading = false;
        this.hudSync();
      }
    }

    if (this.quickSwingT > 0) {
      this.quickSwingT -= dt;
      if (!this.quickHit && this.quickSwingT < 0.3) {
        this.quickHit = true;
        this.c.protT = 0;
        meleeAttack(this.match, this.c);
      }
    }
  }

  /** نموذج السلاح بيد نموذج الجسد (TPS/البوتات) */
  attachHeldModel() {
    const anchor = this.c.model.weaponAnchor;
    while (anchor.children.length) anchor.remove(anchor.children[0]);
    anchor.add(buildHeldModel(this.currentId));
  }

  hudSync() {
    if (!this.c.isPlayer) return;
    const hud = this.match.hud;
    const w = this.current;
    const st = this.curState;
    hud.setWeaponName(w.melee ? `${w.name} 🥿` : w.name);
    hud.setAmmo(st.ammo, st.reserve, !w.melee && st.ammo <= Math.ceil(w.mag * 0.2));
  }
}

// ====================================================================
//                     حلّ الإصابات والنعال
// ====================================================================

/** عيّنة اتجاه داخل مخروط الانتشار */
function perturb(base, spreadRad, out) {
  if (spreadRad <= 0.0001) return out.copy(base);
  // أساس متعامد حول الاتجاه
  _u.set(base.z, 0, -base.x);
  if (_u.lengthSq() < 1e-6) _u.set(1, 0, 0);
  _u.normalize();
  _v.crossVectors(base, _u);
  const ang = rand(0, Math.PI * 2);
  const r = Math.sqrt(Math.random()) * spreadRad;
  out.copy(base).multiplyScalar(Math.cos(r));
  out.addScaledVector(_u, Math.sin(r) * Math.cos(ang));
  out.addScaledVector(_v, Math.sin(r) * Math.sin(ang));
  return out.normalize();
}

export function fireHitscan(match, shooter, w, spreadRad) {
  const game = match.game;
  _origin.set(shooter.pos.x, shooter.eyeY, shooter.pos.z);
  shooter.aimDir(_dir);

  // نقطة خروج الأثر
  if (shooter.viewModel?.muzzleWorld) {
    shooter.viewModel.muzzleWorld(_muzzle);
  } else {
    _muzzle.copy(_origin).addScaledVector(_dir, 0.55);
    _muzzle.y -= 0.12;
  }

  let hitAny = false;
  let killedAny = false;
  const pellets = w.pellets ?? 1;

  for (let p = 0; p < pellets; p++) {
    perturb(_dir, spreadRad, _pdir);

    const worldT = raycastWorld(match.map, _origin, _pdir, MAX_RANGE) ?? MAX_RANGE;

    let bestT = worldT;
    let victim = null;
    let zone = 'body';
    for (const e of match.combatants) {
      if (!e.alive || e.team === shooter.team || e === shooter) continue;
      const headY = e.pos.y + e.curHeight - 0.12;
      const headT = raySphere(_origin, _pdir, e.pos.x, headY, e.pos.z, 0.19);
      if (headT !== null && headT < bestT) {
        bestT = headT;
        victim = e;
        zone = 'head';
        continue;
      }
      const bodyT = rayCapsule(_origin, _pdir, e.pos.x, e.pos.y, e.pos.z, e.curHeight, CAPSULE_RADIUS + 0.03);
      if (bodyT !== null && bodyT < bestT) {
        bestT = bodyT;
        victim = e;
        const hitY = _origin.y + _pdir.y * bodyT;
        zone = hitY > e.pos.y + e.curHeight * 0.58 ? 'chest' : 'body';
      }
    }

    _end.copy(_origin).addScaledVector(_pdir, bestT);

    if (victim) {
      let mult = 1;
      if (zone === 'head') mult = w.headMult;
      else if (zone === 'chest' && w.chestMult) mult = w.chestMult;
      const dmg = Math.max(1, Math.round(w.damage * damageFalloff(w, bestT) * mult));
      const protectedHit = victim.protT > 0;
      const died = victim.takeDamage(dmg, shooter, { weaponId: w.id, headshot: zone === 'head' });
      killedAny ||= died;
      hitAny = true;
      // وميض/شرر عند الإصابة — بدون دماء
      match.particles.impactSparks(_end, 4, 0.8);
      if (shooter.isPlayer && !protectedHit) {
        match.hud.damageNumber(_end, dmg, zone === 'head');
      }
    } else if (bestT < MAX_RANGE) {
      match.particles.impactSparks(_end, 3, 0.7);
      match.particles.dustPuff(_end, 1, 0.8);
      match.particles.wallChips(_end, 2);
    }

    match.particles.tracer(_muzzle, _end);
  }

  if (shooter.isPlayer && hitAny) {
    match.hud.hitmarker(killedAny);
    game.audio?.hitmarker(killedAny);
  }

  match.notifyShot?.(shooter);

  // صوت موضعي بالنسبة للمستمع (اللاعب)
  const lp = match.player;
  if (shooter === lp) {
    game.audio?.shot(w.id, 0, 0);
  } else {
    const dx = shooter.pos.x - lp.pos.x;
    const dz = shooter.pos.z - lp.pos.z;
    const dist = Math.hypot(dx, dz);
    const f = lp.forward2D();
    const pan = clamp((dx * f.z - dz * f.x) / Math.max(dist, 1), -1, 1);
    game.audio?.shot(w.id, dist, -pan);
  }
}

export function meleeAttack(match, attacker) {
  const w = WEAPONS.nial;
  const game = match.game;
  const f = attacker.forward2D();
  let victim = null;
  let bestD = Infinity;

  for (const e of match.combatants) {
    if (!e.alive || e.team === attacker.team || e === attacker) continue;
    const dx = e.pos.x - attacker.pos.x;
    const dz = e.pos.z - attacker.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > w.range + CAPSULE_RADIUS) continue;
    const dot = (dx * f.x + dz * f.z) / Math.max(d, 0.001);
    if (dot < 0.45) continue; // مخروط أمامي
    if (Math.abs(e.pos.y - attacker.pos.y) > 1.6) continue;
    if (d < bestD) { bestD = d; victim = e; }
  }

  if (!victim) {
    game.audio?.slipperSwing();
    return;
  }

  // الضربة الخلفية: المهاجم داخل قوس 120° خلف الضحية = قتل فوري
  const vf = victim.forward2D();
  const tx = attacker.pos.x - victim.pos.x;
  const tz = attacker.pos.z - victim.pos.z;
  const td = Math.hypot(tx, tz) || 1;
  const facingDot = (tx * vf.x + tz * vf.z) / td;
  const backstab = facingDot <= -0.5; // زاوية ≥ 120°

  const dmg = backstab ? 1000 : w.damage;
  _end.set(victim.pos.x, victim.pos.y + victim.curHeight * 0.6, victim.pos.z);
  match.particles.impactSparks(_end, 6, 1);
  const died = victim.takeDamage(dmg, attacker, { weaponId: 'nial', backstab });
  game.audio?.slipperHit(backstab);
  if (attacker.isPlayer) {
    match.hud.hitmarker(died);
    game.audio?.hitmarker(died);
  }
}

// ====================================================================
//                  نموذج اليد FPS (السلاح واليدان)
// ====================================================================

const VM_POSE = {
  // [hipX, hipY, hipZ, adsY]
  alnimr: [0.24, -0.2, -0.42, -0.072],
  theeb: [0.25, -0.21, -0.44, -0.087],
  saqr: [0.24, -0.2, -0.5, -0.087],
  umhasa: [0.24, -0.21, -0.44, -0.027],
  zarzoor: [0.22, -0.19, -0.36, -0.012],
  shadgan: [0.24, -0.2, -0.5, -0.072],
  nial: [0.26, -0.24, -0.38, -0.18],
};

export class ViewModel {
  constructor(player) {
    this.player = player;
    this.cam = player.game.renderer.camera;
    this.root = new THREE.Group();
    this.cam.add(this.root);

    this.models = {};
    this.currentId = null;

    // ذراعان بسيطتان
    const sleeve = new THREE.MeshLambertMaterial({ color: 0x6d6248 });
    const skin = new THREE.MeshLambertMaterial({ color: 0xd8a47f });
    this.armR = new THREE.Group();
    const upperR = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.2), sleeve);
    upperR.position.set(0.015, -0.03, 0.13);
    upperR.rotation.x = 0.5;
    const handR = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.05, 0.08), skin);
    handR.position.set(0, -0.045, 0.1);
    this.armR.add(upperR, handR);
    this.armL = new THREE.Group();
    const upperL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.22), sleeve);
    upperL.position.set(-0.1, -0.06, -0.1);
    upperL.rotation.set(0.35, -0.5, 0);
    const handL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.045, 0.07), skin);
    handL.position.set(-0.035, -0.035, -0.22);
    this.armL.add(upperL, handL);
    this.root.add(this.armR, this.armL);

    // وميض الفوهة
    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xffd27a, blending: THREE.AdditiveBlending,
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
    });
    const fg = new THREE.PlaneGeometry(0.22, 0.22);
    this.flash = new THREE.Group();
    const f1 = new THREE.Mesh(fg, flashMat);
    const f2 = new THREE.Mesh(fg, flashMat);
    f2.rotation.z = Math.PI / 4;
    this.flash.add(f1, f2);
    this.flash.visible = false;
    this.flashLight = new THREE.PointLight(0xffc36b, 0, 8);
    this.flashT = 0;

    this.kickT = 0;
    this.swingT = 0;
    this.swingQuick = false;
    this.bobT = 0;
    this.scoped = false;
    this._v = new THREE.Vector3();
  }

  getModel(id) {
    if (!this.models[id]) {
      const built = buildWeaponModel(id);
      built.group.visible = false;
      built.muzzle.add(this.flashClone ?? this.flash);
      this.root.add(built.group);
      this.models[id] = built;
    }
    return this.models[id];
  }

  setWeapon(id) {
    if (this.currentId === id) return;
    if (this.currentId) this.models[this.currentId].group.visible = false;
    const m = this.getModel(id);
    m.group.visible = true;
    m.muzzle.add(this.flash);
    m.muzzle.add(this.flashLight);
    this.currentId = id;
  }

  kick() {
    this.kickT = 1;
    this.flashT = 0.05;
    this.flash.visible = true;
    this.flash.rotation.z = rand(0, Math.PI);
    this.flashLight.intensity = 2.2;
  }

  /** حركة ضربة النعال */
  swing(quick = false) {
    this.swingT = 0.42;
    this.swingQuick = quick;
    this.player.game.audio?.slipperSwing();
  }

  muzzleWorld(out) {
    const m = this.models[this.currentId];
    if (!m || this.scoped) {
      out.set(this.player.pos.x, this.player.eyeY - 0.1, this.player.pos.z);
      const d = this.player.aimDir(this._v);
      return out.addScaledVector(d, 0.5);
    }
    return m.muzzle.getWorldPosition(out);
  }

  update(dt) {
    const p = this.player;
    const rig = p.rig;
    if (!rig) return;
    const w = rig.current;
    const showId = this.swingT > 0 && this.swingQuick ? 'nial' : rig.currentId;
    this.setWeapon(showId);

    const fps = p.perspective === 'fps';
    this.root.visible = fps && p.alive;
    if (!this.root.visible) {
      this.flash.visible = false;
      return;
    }

    const adsT = p.adsT;
    const pose = VM_POSE[showId] || VM_POSE.alnimr;
    const st = rig.curState;

    // الاهتزاز والمشي
    const hSpeed = Math.hypot(p.vel.x, p.vel.z);
    const moving = p.onGround && hSpeed > 0.6;
    if (moving) this.bobT += dt * (5 + hSpeed * 1.15);
    const bobK = moving ? clamp(hSpeed / 6.3, 0, 1) * (1 - adsT * 0.85) : 0;
    const bobX = Math.cos(this.bobT) * 0.011 * bobK;
    const bobY = Math.abs(Math.sin(this.bobT)) * 0.012 * bobK;

    // غطسة التلقيم/التبديل
    const reloadDip = st.reloading && !w.shellByShell
      ? Math.sin(clamp(st.reloadT / w.reloadTime, 0, 1) * Math.PI) * 0.16
      : (st.reloading ? 0.07 : 0);
    const swapDip = rig.swapT > 0 ? Math.sin((rig.swapT / 0.32) * Math.PI) * 0.2 : 0;

    // الارتداد
    this.kickT = damp(this.kickT, 0, 16, dt);

    const x = lerp(pose[0], 0, adsT) + bobX;
    const y = lerp(pose[1], pose[3], adsT) + bobY - reloadDip - swapDip;
    const z = lerp(pose[2], pose[2] + 0.06, adsT) + this.kickT * 0.05;
    this.root.position.set(x, y, z);
    this.root.rotation.set(
      this.kickT * 0.1 + reloadDip * 1.1,
      lerp(0.05, 0, adsT),
      0,
    );

    // حركة ضربة النعال
    if (this.swingT > 0) {
      this.swingT -= dt;
      const t = 1 - clamp(this.swingT / 0.42, 0, 1);
      const arc = Math.sin(t * Math.PI);
      this.root.position.x -= arc * 0.18;
      this.root.position.z -= arc * 0.22;
      this.root.rotation.z = arc * 1.1;
      this.root.rotation.x -= arc * 0.5;
    }

    // سكوب السنايبر: إخفاء النموذج وعرض شاشة السكوب + sway حقيقي
    const wantScope = !!w.scope && adsT > 0.9;
    if (wantScope !== this.scoped) {
      this.scoped = wantScope;
      this.player.match.hud.setScope(wantScope);
    }
    if (this.scoped) {
      this.root.visible = false;
      const t = this.player.match.time;
      const stanceK = p.stance === 'prone' ? 0.25 : p.stance === 'crouch' ? 0.55 : 1;
      p.swayP = Math.sin(t * 1.25) * w.swayAmp * stanceK;
      p.swayY = Math.cos(t * 0.85) * w.swayAmp * 1.3 * stanceK;
    } else {
      p.swayP = 0;
      p.swayY = 0;
    }

    // وميض الفوهة
    if (this.flashT > 0) {
      this.flashT -= dt;
      if (this.flashT <= 0) this.flash.visible = false;
    }
    this.flashLight.intensity = damp(this.flashLight.intensity, 0, 26, dt);
  }
}
