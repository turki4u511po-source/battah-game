// الصوت: كله procedural عبر Web Audio API (القسم 11).
// هذا الملف يُبنى هيكله هنا (حافلات + دورة حياة) وتُملأ المؤثرات في مرحلة الصوت.

export class AudioSys {
  constructor(game) {
    this.game = game;
    this.ctx = null;
    this.started = false;
  }

  /** يُستدعى عند أول إيماءة مستخدم */
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.sfx = this.ctx.createGain();
    this.music = this.ctx.createGain();
    this.sfx.connect(this.master);
    this.music.connect(this.master);
    this.master.connect(this.ctx.destination);
    this.applyVolume();
    return true;
  }

  applyVolume() {
    if (!this.ctx) return;
    const s = this.game.settings;
    this.sfx.gain.value = s.sfxVolume;
    this.music.gain.value = s.musicVolume;
  }

  // ====== تُنفَّذ بالكامل في مرحلة الصوت والتلميع ======
  /* eslint-disable no-unused-vars */
  shot(weaponId, dist = 0, pan = 0) {}
  dryFire() {}
  reload(weaponId) {}
  swap() {}
  hitmarker(kill = false) {}
  killConfirm() {}
  footstep(surface, runFactor) {}
  heartbeat() {}
  captureTick() {}
  captureDone(won) {}
  countdown() {}
  winLose(won) {}
  slipperSwing() {}
  slipperHit(backstab) {}
  menuMusic(on) {}
  matchAmbience(mapId) {}
  /* eslint-enable no-unused-vars */
}
