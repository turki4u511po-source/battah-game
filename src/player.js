// اللاعب: حركة FPS بفيزياء ناعمة، تصادم، اهتزاز خطو، صحة وتجدد.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { clamp, damp, collideCircle } from './utils.js';

const P = CONFIG.player;

export class Player {
  constructor(game) {
    this.game = game;

    // root: الموضع (عند القدمين) + الالتفاف الأفقي. head: الميل الرأسي + الكاميرا.
    this.root = new THREE.Group();
    this.head = new THREE.Group();
    this.head.position.y = P.eyeHeight;
    this.root.add(this.head);
    game.scene.add(this.root);

    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.onGround = true;
    this.health = P.maxHealth;
    this.alive = true;
    this.lastDamageTime = -100;
    this.bobTime = 0;
    this.bobAmount = 0;
    this.shake = 0;
    this.recoil = 0; // يضيفه السلاح، يتعافى هنا

    this._wish = new THREE.Vector3();
  }

  reset() {
    this.root.position.set(0, 0, 12);
    this.vel.set(0, 0, 0);
    // الكاميرا تنظر نحو -Z المحلي؛ مع yaw=0 يواجه اللاعب مركز الواحة
    this.yaw = 0;
    this.pitch = 0;
    this.onGround = true;
    this.health = P.maxHealth;
    this.alive = true;
    this.lastDamageTime = -100;
    this.shake = 0;
    this.recoil = 0;
    this.game.ui.setHealth(this.health, P.maxHealth);
  }

  /** موضع العين في فضاء العالم (للتصويب ومصدر الطلقات) */
  eyePosition(target) {
    return this.head.getWorldPosition(target);
  }

  update(dt) {
    const game = this.game;
    const input = game.input;

    // ---- النظر ----
    const { dx, dy } = input.consumeMouse();
    const sens = 0.0023 * game.settings.sensitivity;
    this.yaw -= dx * sens;
    this.pitch = clamp(this.pitch - dy * sens, -1.45, 1.45);

    // ---- الحركة الأفقية ----
    const { f, r } = input.axis();
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    // أمام اللاعب هو -Z المحلي
    this._wish.set(-sin * f + cos * r, 0, -cos * f - sin * r);
    if (this._wish.lengthSq() > 1) this._wish.normalize();

    const speed = input.sprinting && f > 0 ? P.sprintSpeed : P.walkSpeed;
    this.vel.x = damp(this.vel.x, this._wish.x * speed, P.damping, dt);
    this.vel.z = damp(this.vel.z, this._wish.z * speed, P.damping, dt);

    // ---- الجاذبية والقفز ----
    this.vel.y -= P.gravity * dt;
    if (input.jumping && this.onGround) {
      this.vel.y = P.jumpSpeed;
      this.onGround = false;
    }

    const pos = this.root.position;
    pos.x += this.vel.x * dt;
    pos.y += this.vel.y * dt;
    pos.z += this.vel.z * dt;

    if (pos.y <= 0) {
      pos.y = 0;
      this.vel.y = 0;
      this.onGround = true;
    }

    // ---- التصادم (يتجاهل العوائق التي قفز فوقها) ----
    const feetY = pos.y;
    let obs = game.arena.obstacles;
    if (feetY > 0.01) obs = obs.filter((o) => feetY < o.top - 0.05);
    const c = collideCircle(pos.x, pos.z, P.radius, obs, game.arena.half);
    pos.x = c.x;
    pos.z = c.z;

    // ---- اهتزاز الخطو ----
    const hSpeed = Math.hypot(this.vel.x, this.vel.z);
    const moving = this.onGround && hSpeed > 0.8;
    this.bobAmount = damp(this.bobAmount, moving ? 1 : 0, 8, dt);
    if (moving) this.bobTime += dt * (4.5 + hSpeed * 0.55);
    const bobY = Math.sin(this.bobTime * 2) * 0.028 * this.bobAmount;

    // ---- الارتداد والاهتزاز ----
    this.recoil = damp(this.recoil, 0, 14, dt);
    this.shake = damp(this.shake, 0, 6, dt);
    const t = game.time;
    const shakeX = Math.sin(t * 51.3) * this.shake * 0.04;
    const shakeY = Math.cos(t * 47.1) * this.shake * 0.04;

    // ---- تطبيق التوجيه ----
    this.root.rotation.y = this.yaw;
    this.head.rotation.x = this.pitch + this.recoil + shakeX;
    this.head.rotation.z = shakeY * 0.6;
    this.head.position.y = P.eyeHeight + bobY;

    // ---- التجدد ----
    if (this.alive && this.health < P.maxHealth && t - this.lastDamageTime > P.regenDelay) {
      this.health = Math.min(P.maxHealth, this.health + P.regenRate * dt);
      game.ui.setHealth(this.health, P.maxHealth);
    }
    game.ui.setLowHealthVignette(this.health / P.maxHealth);
  }

  takeDamage(amount) {
    if (!this.alive || this.game.state !== 'playing') return;
    this.health -= amount;
    this.lastDamageTime = this.game.time;
    this.addShake(0.45 + amount * 0.012);
    this.game.ui.damageFlash(amount / 25);
    this.game.ui.setHealth(this.health, P.maxHealth);
    this.game.audio?.hurt();
    if (this.health <= 0) {
      this.health = 0;
      this.alive = false;
      this.game.gameOver();
    }
  }

  heal(amount) {
    if (!this.alive) return;
    this.health = Math.min(P.maxHealth, this.health + amount);
    this.game.ui.setHealth(this.health, P.maxHealth);
    this.game.ui.healFlash();
  }

  addShake(a) {
    this.shake = Math.min(1.2, this.shake + a);
  }
}
