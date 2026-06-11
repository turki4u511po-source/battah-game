// الإدخال: لوحة المفاتيح، الفأرة، وقفل المؤشر.
// معامل ?nolock يتيح الفحص الآلي بدون Pointer Lock.

export class Input {
  constructor(game) {
    this.game = game;
    this.canvas = game.canvas;
    this.nolock = game.params.has('nolock');

    this.keys = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.trigger = false;

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === 'KeyR' && game.state === 'playing') game.weapon?.startReload();
      if (e.code === 'Escape' && this.nolock && game.state === 'playing') game.pause();
      // منع تمرير الصفحة بالمسافة/الأسهم
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));

    document.addEventListener('mousemove', (e) => {
      if (game.state !== 'playing' || !this.isLooking()) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
    });

    document.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      if (game.state === 'playing') {
        if (this.isLooking()) this.trigger = true;
        else if (!this.nolock) this.requestLock(); // استعادة القفل بعد فقدانه
      }
    });
    document.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.trigger = false;
    });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    document.addEventListener('pointerlockchange', () => {
      if (!this.locked && game.state === 'playing' && !this.nolock) {
        game.pause();
      }
    });
    document.addEventListener('pointerlockerror', () => {
      console.warn('تعذّر قفل المؤشر');
    });
  }

  get locked() {
    return document.pointerLockElement === this.canvas;
  }

  /** هل نملك تحكم النظر؟ (قفل حقيقي أو وضع الفحص) */
  isLooking() {
    return this.locked || this.nolock;
  }

  requestLock() {
    if (this.nolock || this.locked) return;
    const p = this.canvas.requestPointerLock();
    // بعض المتصفحات تعيد Promise وقد ترفضه (مهلة أمان بعد الخروج)
    if (p && p.catch) p.catch(() => {});
  }

  releaseLock() {
    if (this.locked) document.exitPointerLock();
  }

  /** سحب حركة الفأرة المتراكمة منذ آخر إطار */
  consumeMouse() {
    const d = { dx: this.mouseDX, dy: this.mouseDY };
    this.mouseDX = 0;
    this.mouseDY = 0;
    return d;
  }

  axis() {
    const k = this.keys;
    const f = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    const r = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    return { f, r };
  }

  get sprinting() {
    return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
  }

  get jumping() {
    return this.keys.has('Space');
  }

  clear() {
    this.keys.clear();
    this.trigger = false;
    this.mouseDX = 0;
    this.mouseDY = 0;
  }
}
