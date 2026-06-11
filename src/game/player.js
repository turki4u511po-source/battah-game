// المقاتل (مشترك بين اللاعب والبوتات): كبسولة حركة COD-ستايل
// (مشي/سبرنت/قرفصاء/انبطاح/قفز/ADS)، صحة ريجن، حماية سباون، نموذج جندي.
// + صنف اللاعب: كاميرا FPS/TPS قابلة للتبديل وبناء النوايا من الإدخال.

import * as THREE from 'three';
import { GRAVITY, stepMove, resolveSolids, raycastWorld } from '../engine/physics.js';
import { clamp, damp, lerp } from '../engine/utils.js';
import { buildSoldier, makeNameSprite } from './soldier-model.js';
import { STR } from '../data/strings-ar.js';

export const SPEEDS = { walk: 4.4, sprint: 6.3, crouch: 2.2, prone: 1.0, ads: 2.8 };
export const HEIGHTS = { stand: 1.7, crouch: 1.2, prone: 0.6 };
export const EYES = { stand: 1.62, crouch: 1.1, prone: 0.45 };
export const CAPSULE_RADIUS = 0.4;
export const JUMP_V = Math.sqrt(2 * GRAVITY * 1.1); // ارتفاع ~1.1م

const REGEN_DELAY = 4;
const REGEN_RATE = 35;
const SPAWN_PROT = 2;
const SPRINT_FIRE_DELAY = 0.25;

let NEXT_ID = 1;

export class Combatant {
  constructor(match, { team, name, isPlayer = false }) {
    this.id = NEXT_ID++;
    this.match = match;
    this.game = match.game;
    this.team = team;
    this.name = name;
    this.isPlayer = isPlayer;

    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.swayP = 0; // ترنّح سكوب السنايبر — يؤثر على التصويب فعليًا
    this.swayY = 0;
    this.onGround = true;
    this.stance = 'stand';
    this.curHeight = HEIGHTS.stand;
    this.curEye = EYES.stand;

    this.health = 100;
    this.alive = true;
    this.lastDamageT = -99;
    this.protT = 0;
    this.respawnT = 0;
    this.deathT = -1;

    this.sprinting = false;
    this.lastSprintEnd = -99;
    this.ads = false;
    this.adsT = 0; // 0..1 ناعم

    this.kills = 0;
    this.deaths = 0;
    this.score = 0;
    this.captures = 0;

    this.walkPhase = 0;
    this.rig = null; // WeaponRig — يُركَّب في مرحلة الأسلحة

    // النموذج
    this.model = buildSoldier(team);
    this.model.root.visible = false;
    match.scene.add(this.model.root);

    // اسم فوق الرأس للحلفاء فقط (من منظور اللاعب)
    if (!isPlayer && team === 'blue') {
      this.nameTag = makeNameSprite(name);
      this.nameTag.position.y = HEIGHTS.stand + 0.35;
      this.model.root.add(this.nameTag);
    }
  }

  get eyeY() {
    return this.pos.y + this.curEye;
  }

  /** اتجاه النظر/الإطلاق (شامل ترنّح السكوب) */
  aimDir(out) {
    const yaw = this.yaw + this.swayY;
    const pitch = this.pitch + this.swayP;
    const cp = Math.cos(pitch);
    return out.set(Math.sin(yaw) * cp, Math.sin(pitch), Math.cos(yaw) * cp);
  }

  forward2D() {
    return { x: Math.sin(this.yaw), z: Math.cos(this.yaw) };
  }

  spawnAt(x, z, yaw) {
    this.pos.set(x, this.match.map.groundHeight(x, z), z);
    this.vel.set(0, 0, 0);
    this.yaw = yaw;
    this.pitch = 0;
    this.stance = 'stand';
    this.health = 100;
    this.alive = true;
    this.protT = SPAWN_PROT;
    this.deathT = -1;
    this.lastDamageT = -99;
    this.ads = false;
    this.sprinting = false;
    this.onGround = true;
    this.rig?.refill();
    this.model.root.visible = !this.isPlayer || this.viewModelHidden !== true;
    this.model.setOpacity(1);
    this.model.root.rotation.set(0, 0, 0);
  }

  toggleCrouch() {
    if (!this.alive) return;
    this.stance = this.stance === 'crouch' ? 'stand' : 'crouch';
  }

  toggleProne() {
    if (!this.alive) return;
    this.stance = this.stance === 'prone' ? 'stand' : 'prone';
  }

  /**
   * intent: {moveX, moveY, sprint, jump, adsHeld}
   * النوايا يبنيها تحكم اللاعب أو ذكاء البوت — والفيزياء واحدة للجميع.
   */
  update(dt, intent) {
    const map = this.match.map;
    const now = this.match.time;

    if (!this.alive) {
      this.updateDeath(dt);
      return;
    }

    this.protT = Math.max(0, this.protT - dt);

    // ---- ADS والسبرنت ----
    const wasSprinting = this.sprinting;
    this.ads = !!intent.adsHeld && this.canAds();
    this.sprinting =
      !!intent.sprint && this.stance === 'stand' && !this.ads && intent.moveY > 0.3 && this.onGround !== false;
    if (wasSprinting && !this.sprinting) this.lastSprintEnd = now;
    this.adsT = damp(this.adsT, this.ads ? 1 : 0, 14, dt);

    // ---- السرعة المستهدفة ----
    let speed;
    if (this.stance === 'prone') speed = SPEEDS.prone;
    else if (this.stance === 'crouch') speed = SPEEDS.crouch;
    else if (this.ads) speed = SPEEDS.ads;
    else if (this.sprinting) speed = SPEEDS.sprint;
    else speed = SPEEDS.walk;
    if (this.rig) speed *= this.rig.moveMult();

    // ---- اتجاه الرغبة ----
    let mx = intent.moveX;
    let my = intent.moveY;
    const ml = Math.hypot(mx, my);
    if (ml > 1) { mx /= ml; my /= ml; }
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    const wishX = sin * my + cos * mx;
    const wishZ = cos * my - sin * mx;

    // أرضًا: تخميد قوي؛ هواءً: تحكم خفيف
    const lambda = this.onGround ? 12 : 1.8;
    this.vel.x = damp(this.vel.x, wishX * speed, lambda, dt);
    this.vel.z = damp(this.vel.z, wishZ * speed, lambda, dt);

    // ---- القفز والجاذبية ----
    if (intent.jump && this.onGround && this.stance !== 'prone') {
      if (this.stance === 'crouch') this.stance = 'stand';
      this.vel.y = JUMP_V;
      this.onGround = false;
    }
    this.vel.y -= GRAVITY * dt;

    // ---- التكامل والتصادم ----
    const fromX = this.pos.x;
    const fromZ = this.pos.z;
    let nx = fromX + this.vel.x * dt;
    let nz = fromZ + this.vel.z * dt;
    let ny = this.pos.y + this.vel.y * dt;

    const stepped = stepMove(map, fromX, fromZ, nx, nz, this.pos.y);
    const solved = resolveSolids(map, stepped.x, stepped.z, this.pos.y, this.curHeight, CAPSULE_RADIUS);
    nx = solved.x;
    nz = solved.z;

    const g = map.groundHeight(nx, nz);
    if (ny <= g) {
      ny = g;
      this.vel.y = 0;
      this.onGround = true;
    } else if (this.onGround && this.vel.y <= 0 && ny - g < 0.45) {
      // التصاق بالمنحدرات والدرج نزولًا
      ny = g;
      this.vel.y = 0;
    } else {
      this.onGround = false;
    }
    this.pos.set(nx, ny, nz);

    // ---- ارتفاع الوضعية ----
    const targetH = HEIGHTS[this.stance];
    const targetE = EYES[this.stance];
    this.curHeight = damp(this.curHeight, targetH, 12, dt);
    this.curEye = damp(this.curEye, targetE, 12, dt);

    // ---- الريجن ----
    if (this.health < 100 && now - this.lastDamageT > REGEN_DELAY) {
      this.health = Math.min(100, this.health + REGEN_RATE * dt);
      if (this.isPlayer) this.match.hud?.healthChanged(this.health);
    }

    this.rig?.update(dt);
    this.updatePose(dt);
  }

  canAds() {
    return this.alive && this.stance !== null;
  }

  /** هل الإطلاق محجوب بعد السبرنت؟ (250ms) */
  sprintFireBlocked() {
    return this.sprinting || this.match.time - this.lastSprintEnd < SPRINT_FIRE_DELAY;
  }

  // ---------- الضرر والموت ----------
  takeDamage(amount, attacker, info = {}) {
    if (!this.alive || this.protT > 0) return false;
    this.health -= amount;
    this.lastDamageT = this.match.time;
    this.onDamaged?.(attacker, amount, info);
    if (this.health <= 0) {
      this.health = 0;
      this.killedBy(attacker, info);
      return true;
    }
    return false;
  }

  killedBy(attacker, info) {
    this.alive = false;
    this.deaths++;
    this.deathT = 0;
    this.respawnT = 3;
    this.lastKiller = attacker;
    this.lastKillerWeapon = info.weaponId;
    if (attacker && attacker !== this) {
      attacker.kills++;
      attacker.score += 100;
    }
    this.match.onKill(attacker, this, info);
  }

  updateDeath(dt) {
    if (this.deathT < 0) return;
    this.deathT += dt;
    // سقوط + تلاشٍ خلال ثانيتين — بدون دماء
    const t = Math.min(this.deathT / 0.4, 1);
    this.model.root.rotation.x = (-Math.PI / 2) * t * 0.96;
    this.model.hips.position.y = 0.86 - 0.5 * t;
    if (this.deathT > 0.6) {
      const fade = clamp(1 - (this.deathT - 0.6) / 1.4, 0, 1);
      this.model.setOpacity(fade);
      if (fade <= 0) {
        this.model.root.visible = false;
        this.deathT = -1;
      }
    }
  }

  /** صوت خطوة حسب السطح — موضعي للآخرين (القسم 11) */
  emitFootstep(hSpeed) {
    const audio = this.game.audio;
    if (!audio) return;
    const surface = this.match.map.surfaceAt(this.pos.x, this.pos.z);
    const run = clamp(hSpeed / SPEEDS.sprint, 0.4, 1) * (this.stance === 'stand' ? 1 : 0.55);
    if (this.isPlayer) {
      audio.footstep(surface, run, 0, 0);
      return;
    }
    const lp = this.match.player;
    const dx = this.pos.x - lp.pos.x;
    const dz = this.pos.z - lp.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 16) return;
    const f = lp.forward2D();
    const pan = clamp((dx * f.z - dz * f.x) / Math.max(dist, 1), -1, 1);
    audio.footstep(surface, run, dist, pan);
  }

  // ---------- تحريك النموذج ----------
  updatePose(dt) {
    const m = this.model;
    m.root.position.copy(this.pos);
    m.root.rotation.y = this.yaw;

    const hSpeed = Math.hypot(this.vel.x, this.vel.z);
    const moving = hSpeed > 0.5 && this.onGround;
    if (moving) {
      this.walkPhase += dt * (4 + hSpeed * 1.45);
      // خطوة عند كل عبور نصف دورة
      const s = Math.sin(this.walkPhase);
      if (this._stepSin !== undefined && Math.sign(s) !== Math.sign(this._stepSin)) {
        this.emitFootstep(hSpeed);
      }
      this._stepSin = s;
    }
    const swing = moving ? Math.sin(this.walkPhase) * clamp(hSpeed / SPEEDS.sprint, 0.3, 1) : 0;

    if (this.stance === 'prone') {
      // انبساط على البطن: الرأس للأمام والساقان خلفًا والذراعان بوضعية زحف
      m.hips.position.y = damp(m.hips.position.y, 0.3, 14, dt);
      m.hips.rotation.x = damp(m.hips.rotation.x, Math.PI / 2 - 0.12, 14, dt);
      m.legL.hip.rotation.x = damp(m.legL.hip.rotation.x, 0.06 + swing * 0.2, 14, dt);
      m.legR.hip.rotation.x = damp(m.legR.hip.rotation.x, 0.06 - swing * 0.2, 14, dt);
      m.legL.knee.rotation.x = 0.1;
      m.legR.knee.rotation.x = 0.1;
      m.headG.rotation.x = damp(m.headG.rotation.x, -1.05, 14, dt); // يرفع نظره للأمام
      m.torso.rotation.x = 0;
      m.armR.shoulder.rotation.x = Math.PI - 0.55;
      m.armR.elbow.rotation.x = -0.9;
      m.armL.shoulder.rotation.x = Math.PI - 0.55;
      m.armL.shoulder.rotation.z = 0.25;
      m.armL.elbow.rotation.x = -0.9;
    } else {
      const crouch = this.stance === 'crouch';
      m.hips.position.y = damp(m.hips.position.y, crouch ? 0.55 : 0.86, 14, dt);
      m.hips.rotation.x = damp(m.hips.rotation.x, 0, 14, dt);
      m.headG.rotation.x = damp(m.headG.rotation.x, 0, 14, dt);
      const bend = crouch ? 0.85 : 0;
      m.legL.hip.rotation.x = -swing * 0.8 - bend * 0.7;
      m.legR.hip.rotation.x = swing * 0.8 - bend * 0.7;
      m.legL.knee.rotation.x = Math.max(0, swing) * 0.9 + bend;
      m.legR.knee.rotation.x = Math.max(0, -swing) * 0.9 + bend;

      // ميل الجذع مع التصويب + وضعية حمل سلاح أمامية
      m.torso.rotation.x = -this.pitch * 0.45;
      m.armR.shoulder.rotation.x = -1.15 - this.pitch * 0.4;
      m.armR.elbow.rotation.x = -0.55;
      m.armL.shoulder.rotation.x = -1.0 - this.pitch * 0.4;
      m.armL.shoulder.rotation.z = 0.5;
      m.armL.elbow.rotation.x = -0.9;
    }

    // وميض حماية السباون
    if (this.protT > 0) {
      const blink = 0.55 + Math.sin(this.match.time * 18) * 0.25;
      this.model.setOpacity(blink);
    } else if (this.alive && this.deathT < 0) {
      this.model.setOpacity(1);
    }
  }
}

// ====================================================================
//                            اللاعب
// ====================================================================

export class Player extends Combatant {
  constructor(match) {
    super(match, { team: 'blue', name: STR.you, isPlayer: true });

    const game = this.game;
    this.perspective = game.settings.defaultView; // 'fps' | 'tps'

    // كاميرا: جذر (yaw) → ميل (pitch) → كاميرا
    this.camRoot = new THREE.Group();
    this.camPitch = new THREE.Group();
    this.camRoot.add(this.camPitch);
    match.scene.add(this.camRoot);
    this.camPitch.add(game.renderer.camera);

    this.tpsDist = 2.5;
    this.curTpsDist = 2.5;
    this.jumpQueued = false;
    this.bobT = 0;
    this.recoilPitch = 0; // يضيفه السلاح
    this.recoilYaw = 0;
    this.shake = 0;
    this.prevFire = false;
    this.viewModel = null; // يُركَّب مع اللودآوت

    this._dir = new THREE.Vector3();

    const input = game.input;
    input.on('crouch', () => this.toggleCrouch());
    input.on('prone', () => this.toggleProne());
    input.on('jump', () => { this.jumpQueued = true; });
    input.on('persp', () => this.togglePerspective());
    input.on('reload', () => this.rig?.startReload());
    input.on('slipper', () => this.rig?.quickSlipper());
    input.on('slot', (n) => this.rig?.selectSlot(n === 3 ? 'nial' : 'primary'));
    input.on('wheel', () => this.rig?.toggleSlot());
    input.on('pause', () => game.pauseMatch());
    input.on('scoreboard', (held) => this.match.hud?.showScoreboard(held));
  }

  togglePerspective() {
    this.perspective = this.perspective === 'fps' ? 'tps' : 'fps';
    this.game.audio?.swap();
  }

  /** تركيب اللودآوت: حامل السلاح + نموذج اليد (يُستدعى من الماتش) */
  initLoadout(primaryId, WeaponRigClass, ViewModelClass) {
    this.rig = new WeaponRigClass(this, primaryId);
    this.viewModel = new ViewModelClass(this);
  }

  controlUpdate(dt) {
    const input = this.game.input;

    // النظر (حساسية أقل داخل السكوب)
    const { dx, dy } = input.consumeLook();
    const scoped = this.viewModel?.scoped;
    const sens = 0.0022 * this.game.settings.mouseSens * (scoped ? 0.42 : 1);
    this.yaw -= dx * sens;
    this.pitch = clamp(this.pitch - dy * sens, -1.45, 1.45);

    const axis = input.moveAxis();
    const intent = {
      moveX: axis.x,
      moveY: axis.y,
      sprint: input.sprinting,
      jump: this.jumpQueued,
      adsHeld: input.ads && !this.sprintingBlocksAds(),
    };
    this.jumpQueued = false;

    this.update(dt, intent);

    // الإطلاق: آلي بالاستمرار، وغير الآلي بالضغطة
    if (this.rig && this.alive) {
      const pressed = input.fire && !this.prevFire;
      if (input.fire) this.rig.tryFire(pressed);
      this.prevFire = input.fire;
    }

    this.updateCamera(dt);
    this.viewModel?.update(dt);

    // زوم ADS حسب السلاح
    const w = this.rig?.current;
    const zoom = w ? lerp(1, w.adsZoom, this.adsT) : 1;
    this.game.renderer.setFovMult(zoom);

    // كروس هير: يتسع ويضيق، ويختفي مع السكوب
    if (this.rig) {
      const px = 5 + this.rig.spreadDeg() * 7.5;
      this.match.hud.setSpread(px, !!scoped || w?.melee);
    }
    this.match.hud.setProtected(this.protT > 0 && this.alive);

    // إخفاء جسد اللاعب في FPS
    const fps = this.perspective === 'fps';
    this.viewModelHidden = fps;
    if (this.alive) this.model.root.visible = !fps;
  }

  sprintingBlocksAds() {
    return this.sprinting;
  }

  updateCamera(dt) {
    const cam = this.game.renderer.camera;
    const fps = this.perspective === 'fps';

    // استرجاع الارتداد
    this.recoilPitch = damp(this.recoilPitch, 0, 8, dt);
    this.recoilYaw = damp(this.recoilYaw, 0, 8, dt);
    this.shake = damp(this.shake, 0, 7, dt);
    const t = this.match.time;
    const shX = Math.sin(t * 47) * this.shake * 0.012;
    const shY = Math.cos(t * 41) * this.shake * 0.012;

    this.camRoot.position.set(this.pos.x, this.eyeY, this.pos.z);
    this.camRoot.rotation.y = this.yaw + this.swayY + Math.PI + this.recoilYaw + shY;
    this.camPitch.rotation.x = this.pitch + this.swayP + this.recoilPitch + shX;

    if (fps) {
      // اهتزاز مشي خفيف
      const hSpeed = Math.hypot(this.vel.x, this.vel.z);
      const moving = this.onGround && hSpeed > 0.6;
      if (moving) this.bobT += dt * (5 + hSpeed * 1.1);
      const bobAmp = moving ? clamp(hSpeed / SPEEDS.sprint, 0, 1) * 0.018 : 0;
      cam.position.set(
        Math.cos(this.bobT) * bobAmp * 0.6,
        Math.abs(Math.sin(this.bobT)) * bobAmp,
        0,
      );
    } else {
      // TPS فوق الكتف الأيمن مع تصادم الكاميرا
      const targetDist = 2.5 - this.adsT * 1.25;
      const shoulder = 0.55 - this.adsT * 0.15;
      // اتجاه عالمي لإزاحة الكاميرا الخلفية
      this.camRoot.updateMatrixWorld();
      this._dir.set(shoulder, 0.16, targetDist).normalize();
      this._dir.applyQuaternion(this.camRoot.quaternion);
      const maxLen = Math.hypot(shoulder, 0.16, targetDist);
      const hit = raycastWorld(
        this.match.map,
        { x: this.pos.x, y: this.eyeY, z: this.pos.z },
        this._dir,
        maxLen + 0.3,
      );
      const allowed = hit !== null ? Math.max(0.4, hit - 0.25) : maxLen;
      const k = allowed / maxLen;
      this.curTpsDist = damp(this.curTpsDist, targetDist * k, 18, dt);
      cam.position.set(shoulder * k, 0.16 * k, this.curTpsDist);
    }
  }

  onDamaged(attacker, amount) {
    this.shake = Math.min(1, this.shake + amount * 0.02);
    this.match.hud?.playerDamaged(attacker, amount, this.health);
    this.game.audio?.hurt();
  }
}
