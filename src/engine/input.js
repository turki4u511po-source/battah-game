// الإدخال: دسكتوب (Pointer Lock + كيبورد/ماوس حسب جدول القسم 2)
// وجوال (جويستيك + سحب نظر + أزرار لمس) مع كشف تلقائي.

import { STR } from '../data/strings-ar.js';
import { clamp } from './utils.js';

export class Input {
  constructor(game) {
    this.game = game;
    this.canvas = game.canvas;
    this.nolock = game.params.has('nolock');
    this.isTouch =
      game.params.has('touch') ||
      (window.matchMedia('(pointer: coarse)').matches && navigator.maxTouchPoints > 0);

    this.keys = new Set();
    this.lookDX = 0;
    this.lookDY = 0;
    this.fire = false;
    this.ads = false;
    this.sprintKey = false;
    this.jumpHeld = false;
    this.scoreboardHeld = false;
    this.moveX = 0; // جويستيك الجوال
    this.moveY = 0;
    this.autoSprint = false;

    this.handlers = {};

    this.bindDesktop();
    if (this.isTouch) this.buildTouchUI();
  }

  on(action, fn) {
    (this.handlers[action] ||= []).push(fn);
  }

  emit(action, arg) {
    if (this.game.state !== 'playing') return;
    for (const fn of this.handlers[action] || []) fn(arg);
  }

  // ---------------- دسكتوب ----------------
  bindDesktop() {
    const game = this.game;

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Tab') e.preventDefault();
      if (e.repeat) return;
      this.keys.add(e.code);
      switch (e.code) {
        case 'KeyC': this.emit('crouch'); break;
        case 'KeyZ': this.emit('prone'); break;
        case 'KeyR': this.emit('reload'); break;
        case 'KeyV': this.emit('slipper'); break;
        case 'Digit1': this.emit('slot', 1); break;
        case 'Digit3': this.emit('slot', 3); break;
        case 'KeyX': this.emit('persp'); break;
        case 'KeyP': this.emit('pause'); break;
        case 'Escape': if (this.nolock) this.emit('pause'); break;
        case 'Space': this.jumpHeld = true; this.emit('jump'); break;
        case 'Tab': this.scoreboardHeld = true; this.emit('scoreboard', true); break;
        case 'ShiftLeft':
        case 'ShiftRight': this.sprintKey = true; break;
      }
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      if (e.code === 'Space') this.jumpHeld = false;
      if (e.code === 'Tab') { this.scoreboardHeld = false; this.emit('scoreboard', false); }
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.sprintKey = false;
    });

    document.addEventListener('mousemove', (e) => {
      if (game.state !== 'playing' || !this.isLooking()) return;
      this.lookDX += e.movementX;
      this.lookDY += e.movementY;
    });

    document.addEventListener('mousedown', (e) => {
      if (game.state !== 'playing') return;
      if (!this.isLooking()) {
        if (!this.nolock && !this.isTouch) this.requestLock();
        return;
      }
      if (e.button === 0) this.fire = true;
      else if (e.button === 2) this.ads = true;
    });
    document.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.fire = false;
      else if (e.button === 2) this.ads = false;
    });
    document.addEventListener('contextmenu', (e) => {
      if (game.state === 'playing') e.preventDefault();
    });

    window.addEventListener('wheel', (e) => {
      if (game.state === 'playing' && this.isLooking()) {
        this.emit('wheel', Math.sign(e.deltaY));
      }
    }, { passive: true });

    document.addEventListener('pointerlockchange', () => {
      if (!this.locked && game.state === 'playing' && !this.nolock && !this.isTouch) {
        this.emit('pause');
      }
    });
    document.addEventListener('pointerlockerror', () => {});
  }

  get locked() {
    return document.pointerLockElement === this.canvas;
  }

  isLooking() {
    return this.locked || this.nolock || this.isTouch;
  }

  requestLock() {
    if (this.nolock || this.isTouch || this.locked) return;
    const p = this.canvas.requestPointerLock();
    if (p && p.catch) p.catch(() => {});
  }

  releaseLock() {
    if (this.locked) document.exitPointerLock();
  }

  consumeLook() {
    const d = { dx: this.lookDX, dy: this.lookDY };
    this.lookDX = 0;
    this.lookDY = 0;
    return d;
  }

  /** متجه الحركة الموحد (كيبورد أو جويستيك) */
  moveAxis() {
    if (this.isTouch) return { x: this.moveX, y: this.moveY };
    const k = this.keys;
    const y = (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0);
    const x = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0);
    return { x, y };
  }

  get sprinting() {
    return this.sprintKey || this.autoSprint;
  }

  clear() {
    this.keys.clear();
    this.fire = false;
    this.ads = false;
    this.sprintKey = false;
    this.autoSprint = false;
    this.jumpHeld = false;
    this.scoreboardHeld = false;
    this.lookDX = 0;
    this.lookDY = 0;
    this.moveX = 0;
    this.moveY = 0;
  }

  // ---------------- الجوال ----------------
  buildTouchUI() {
    const root = document.createElement('div');
    root.id = 'touch-ui';
    root.className = 'hidden';
    root.innerHTML = `
      <div id="joy-zone"><div id="joy-base"><div id="joy-knob"></div></div></div>
      <div id="look-zone"></div>
      <button class="tbtn tbtn-fire" data-act="fire">${STR.fire}</button>
      <button class="tbtn tbtn-ads" data-act="ads">${STR.adsBtn}</button>
      <button class="tbtn tbtn-jump" data-act="jump">${STR.jumpBtn}</button>
      <button class="tbtn tbtn-crouch" data-act="crouch">${STR.crouchBtn}</button>
      <button class="tbtn tbtn-reload" data-act="reload">${STR.reloadBtn}</button>
      <button class="tbtn tbtn-slipper" data-act="slipper">${STR.slipperBtn}</button>
      <button class="tbtn tbtn-persp" data-act="persp">${STR.switchViewBtn}</button>
    `;
    document.getElementById('app').appendChild(root);
    this.touchRoot = root;

    const joyZone = root.querySelector('#joy-zone');
    const joyBase = root.querySelector('#joy-base');
    const joyKnob = root.querySelector('#joy-knob');
    const lookZone = root.querySelector('#look-zone');

    let joyId = null;
    let joyCX = 0;
    let joyCY = 0;
    const JOY_R = 56;

    joyZone.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0];
      joyId = t.identifier;
      joyCX = t.clientX;
      joyCY = t.clientY;
      joyBase.style.left = `${joyCX}px`;
      joyBase.style.top = `${joyCY}px`;
      joyBase.classList.add('active');
      e.preventDefault();
    }, { passive: false });

    const joyMove = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== joyId) continue;
        let dx = t.clientX - joyCX;
        let dy = t.clientY - joyCY;
        const len = Math.hypot(dx, dy);
        if (len > JOY_R) { dx = (dx / len) * JOY_R; dy = (dy / len) * JOY_R; }
        joyKnob.style.transform = `translate(${dx}px, ${dy}px)`;
        this.moveX = clamp(dx / JOY_R, -1, 1);
        this.moveY = clamp(-dy / JOY_R, -1, 1);
        // سبرنت تلقائي عند الدفع الكامل للأمام
        this.autoSprint = this.moveY > 0.92;
        e.preventDefault();
      }
    };
    joyZone.addEventListener('touchmove', joyMove, { passive: false });
    const joyEnd = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== joyId) continue;
        joyId = null;
        this.moveX = 0;
        this.moveY = 0;
        this.autoSprint = false;
        joyKnob.style.transform = '';
        joyBase.classList.remove('active');
      }
    };
    joyZone.addEventListener('touchend', joyEnd);
    joyZone.addEventListener('touchcancel', joyEnd);

    // سحب النظر يمين الشاشة
    let lookId = null;
    let lastX = 0;
    let lastY = 0;
    lookZone.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0];
      lookId = t.identifier;
      lastX = t.clientX;
      lastY = t.clientY;
    }, { passive: true });
    lookZone.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== lookId) continue;
        const s = this.game.settings.touchSens * 2.2;
        this.lookDX += (t.clientX - lastX) * s;
        this.lookDY += (t.clientY - lastY) * s;
        lastX = t.clientX;
        lastY = t.clientY;
        e.preventDefault();
      }
    }, { passive: false });
    const lookEnd = (e) => {
      for (const t of e.changedTouches) if (t.identifier === lookId) lookId = null;
    };
    lookZone.addEventListener('touchend', lookEnd);
    lookZone.addEventListener('touchcancel', lookEnd);

    // الأزرار
    let crouchTimer = null;
    for (const btn of root.querySelectorAll('.tbtn')) {
      const act = btn.dataset.act;
      btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        btn.classList.add('pressed');
        if (act === 'fire') this.fire = true;
        else if (act === 'ads') { this.ads = !this.ads; btn.classList.toggle('latched', this.ads); }
        else if (act === 'jump') this.emit('jump');
        else if (act === 'crouch') {
          // نقرة = قرفصاء، مطوّلة = انبطاح
          crouchTimer = setTimeout(() => { crouchTimer = null; this.emit('prone'); }, 420);
        } else if (act === 'reload') this.emit('reload');
        else if (act === 'slipper') this.emit('slipper');
        else if (act === 'persp') this.emit('persp');
      }, { passive: false });
      btn.addEventListener('touchend', (e) => {
        e.preventDefault();
        btn.classList.remove('pressed');
        if (act === 'fire') this.fire = false;
        else if (act === 'crouch' && crouchTimer) {
          clearTimeout(crouchTimer);
          crouchTimer = null;
          this.emit('crouch');
        }
      }, { passive: false });
    }
  }

  setTouchVisible(v) {
    if (this.touchRoot) this.touchRoot.classList.toggle('hidden', !v);
  }
}
