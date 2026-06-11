// الصوت (القسم 11): كل المؤثرات والموسيقى procedural عبر Web Audio API.
// حافلتا صوت منفصلتان (مؤثرات/موسيقى)، أصوات 3D موضعية (بعد + اتجاه)،
// شبكة صدى تتلون بكل ماب — طقّة الشدقن تدوّي في العوازم.

import { clamp, rand, choose } from './utils.js';

const HIJAZ = [146.83, 155.56, 185.0, 196.0, 220.0, 233.08, 261.63, 293.66]; // مقام حجاز على ري

export class AudioSys {
  constructor(game) {
    this.game = game;
    this.ctx = null;
    this.echoLevel = 0.15;
    this.musicOn = false;
    this.musicTimer = null;
    this.heartT = 0;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    const ctx = new AC();
    this.ctx = ctx;

    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    this.sfx = ctx.createGain();
    this.music = ctx.createGain();
    this.sfx.connect(this.master);
    this.music.connect(this.master);
    this.master.connect(ctx.destination);

    // شبكة الصدى: تأخير بتغذية راجعة
    this.echoIn = ctx.createGain();
    const d1 = ctx.createDelay(0.6);
    d1.delayTime.value = 0.17;
    const fb = ctx.createGain();
    fb.gain.value = 0.42;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1400;
    this.echoOut = ctx.createGain();
    this.echoOut.gain.value = 0.5;
    this.echoIn.connect(d1);
    d1.connect(lp);
    lp.connect(fb);
    fb.connect(d1);
    lp.connect(this.echoOut);
    this.echoOut.connect(this.sfx);

    // ضجيج أبيض مخزّن
    const len = ctx.sampleRate;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    this.applyVolume();
    return true;
  }

  applyVolume() {
    if (!this.ctx) return;
    const s = this.game.settings;
    this.sfx.gain.value = s.sfxVolume;
    this.music.gain.value = s.musicVolume * 0.6;
  }

  /** مخرج موضعي: مكاسب بالمسافة + توزيع ستيريو بالاتجاه */
  out(dist = 0, pan = 0, echoSend = 0) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.value = 1 / (1 + dist * 0.05);
    let node = g;
    if (pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = clamp(pan, -1, 1);
      g.connect(p);
      node = p;
    }
    node.connect(this.sfx);
    if (echoSend > 0) {
      const e = ctx.createGain();
      e.gain.value = echoSend * this.echoLevel * (1 / (1 + dist * 0.03));
      g.connect(e);
      e.connect(this.echoIn);
    }
    return g;
  }

  /** نبضة مذبذب بانزلاق تردد */
  osc(dest, { type = 'square', f0 = 150, f1 = 60, t = 0.1, gain = 0.3, when = 0 }) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const t0 = ctx.currentTime + when;
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t0 + t);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + t);
    o.connect(g);
    g.connect(dest);
    o.start(t0);
    o.stop(t0 + t + 0.02);
  }

  /** رشقة ضجيج مفلترة */
  noise(dest, { dur = 0.1, type = 'lowpass', freq = 2000, q = 0.8, gain = 0.3, when = 0, attack = 0.002 }) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    src.playbackRate.value = rand(0.92, 1.08);
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    const t0 = ctx.currentTime + when;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f);
    f.connect(g);
    g.connect(dest);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  /** نغمة بسيطة */
  tone(dest, { f = 440, t = 0.15, type = 'triangle', gain = 0.18, when = 0 }) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const t0 = ctx.currentTime + when;
    o.type = type;
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + t);
    o.connect(g);
    g.connect(dest);
    o.start(t0);
    o.stop(t0 + t + 0.02);
  }

  // ====================================================================
  //                       أصوات الأسلحة المميزة
  // ====================================================================
  shot(weaponId, dist = 0, pan = 0) {
    if (!this.ensure()) return;
    switch (weaponId) {
      case 'alnimr': { // متوسط حاد
        const o = this.out(dist, pan, 0.5);
        this.osc(o, { f0: 170, f1: 65, t: 0.085, gain: 0.34 });
        this.noise(o, { dur: 0.1, freq: 2700, gain: 0.3 });
        break;
      }
      case 'theeb': { // أغلظ
        const o = this.out(dist, pan, 0.65);
        this.osc(o, { f0: 120, f1: 46, t: 0.13, gain: 0.42 });
        this.noise(o, { dur: 0.15, freq: 1700, gain: 0.34 });
        break;
      }
      case 'zarzoor': { // سريع خفيف
        const o = this.out(dist, pan, 0.35);
        this.osc(o, { f0: 210, f1: 95, t: 0.05, gain: 0.26 });
        this.noise(o, { dur: 0.06, freq: 3300, gain: 0.24 });
        break;
      }
      case 'umhasa': { // انفجار مكتوم + مضخة
        const o = this.out(dist, pan, 0.8);
        this.osc(o, { f0: 85, f1: 36, t: 0.2, gain: 0.55, type: 'sawtooth' });
        this.noise(o, { dur: 0.22, freq: 950, gain: 0.5 });
        // شيك-تشاك المضخة
        this.noise(o, { dur: 0.035, type: 'highpass', freq: 1300, gain: 0.2, when: 0.28 });
        this.noise(o, { dur: 0.035, type: 'highpass', freq: 1100, gain: 0.2, when: 0.4 });
        break;
      }
      case 'saqr': { // دويّ عميق
        const o = this.out(dist, pan, 1.2);
        this.osc(o, { f0: 75, f1: 28, t: 0.32, gain: 0.55, type: 'sawtooth' });
        this.noise(o, { dur: 0.35, freq: 1250, gain: 0.42 });
        this.noise(o, { dur: 0.012, type: 'highpass', freq: 2500, gain: 0.4 });
        break;
      }
      case 'shadgan': { // «طقّة» جافة مدوية — أقوى صدى
        const o = this.out(dist, pan, 2.4);
        this.noise(o, { dur: 0.018, type: 'highpass', freq: 1600, gain: 0.6, attack: 0.001 });
        this.osc(o, { f0: 115, f1: 42, t: 0.16, gain: 0.4 });
        this.noise(o, { dur: 0.12, freq: 800, gain: 0.3 });
        break;
      }
      default: break;
    }
  }

  dryFire() {
    if (!this.ensure()) return;
    this.noise(this.out(), { dur: 0.03, type: 'highpass', freq: 2000, gain: 0.12 });
  }

  reload(weaponId) {
    if (!this.ensure()) return;
    const o = this.out();
    if (weaponId === 'umhasa') {
      this.noise(o, { dur: 0.04, type: 'bandpass', freq: 1500, q: 3, gain: 0.2 });
      return;
    }
    this.noise(o, { dur: 0.035, type: 'bandpass', freq: 1300, q: 2.5, gain: 0.18 });
    this.noise(o, { dur: 0.04, type: 'bandpass', freq: 900, q: 2.5, gain: 0.2, when: 0.16 });
    this.noise(o, { dur: 0.05, type: 'bandpass', freq: 1700, q: 2.5, gain: 0.22, when: 0.55 });
  }

  swap() {
    if (!this.ensure()) return;
    const o = this.out();
    this.noise(o, { dur: 0.07, type: 'bandpass', freq: 2200, q: 1.4, gain: 0.12 });
    this.noise(o, { dur: 0.03, type: 'bandpass', freq: 1000, q: 3, gain: 0.14, when: 0.07 });
  }

  // ---------- النعال ----------
  slipperSwing() {
    if (!this.ensure()) return;
    this.noise(this.out(), { dur: 0.12, type: 'bandpass', freq: 700, q: 1.2, gain: 0.16 });
  }

  slipperHit(backstab) {
    if (!this.ensure()) return;
    const o = this.out(0, 0, 0.4);
    // «طاخ» ساخرة
    this.noise(o, { dur: 0.05, type: 'bandpass', freq: 1150, q: 2, gain: 0.5, attack: 0.001 });
    this.osc(o, { f0: 320, f1: 130, t: 0.07, gain: 0.3, type: 'sine' });
    if (backstab) this.tone(o, { f: 660, t: 0.18, gain: 0.16, when: 0.08 });
  }

  // ---------- تغذية راجعة ----------
  hitmarker(kill) {
    if (!this.ensure()) return;
    const o = this.out();
    this.tone(o, { f: kill ? 1450 : 2100, t: 0.045, type: 'square', gain: 0.1 });
  }

  killConfirm() {
    if (!this.ensure()) return;
    const o = this.out();
    this.tone(o, { f: 740, t: 0.07, gain: 0.14 });
    this.tone(o, { f: 1108, t: 0.12, gain: 0.14, when: 0.07 });
  }

  hurt() {
    if (!this.ensure()) return;
    this.osc(this.out(), { f0: 160, f1: 80, t: 0.12, gain: 0.2, type: 'sawtooth' });
  }

  heartbeat() {
    if (!this.ensure()) return;
    const o = this.out();
    this.osc(o, { f0: 62, f1: 40, t: 0.09, gain: 0.4, type: 'sine' });
    this.osc(o, { f0: 55, f1: 36, t: 0.1, gain: 0.32, type: 'sine', when: 0.16 });
  }

  // ---------- الخطوات حسب السطح ----------
  footstep(surface, runFactor = 1, dist = 0, pan = 0) {
    if (!this.ensure() || dist > 16) return;
    const o = this.out(dist, pan);
    const g = 0.1 * runFactor;
    switch (surface) {
      case 'asphalt':
        this.noise(o, { dur: 0.05, freq: 1000, gain: g });
        break;
      case 'dirt':
        this.noise(o, { dur: 0.07, freq: 520, gain: g * 1.1 });
        break;
      case 'roof':
        this.noise(o, { dur: 0.055, type: 'bandpass', freq: 700, q: 1.5, gain: g * 1.2 });
        this.osc(o, { f0: 90, f1: 60, t: 0.05, gain: g * 0.5, type: 'sine' });
        break;
      case 'stone':
      default:
        this.noise(o, { dur: 0.045, type: 'bandpass', freq: 1500, q: 1.2, gain: g });
        break;
    }
  }

  // ---------- أحداث الأنماط ----------
  captureDone(won) {
    if (!this.ensure()) return;
    const o = this.out();
    if (won) {
      this.tone(o, { f: 587, t: 0.1, gain: 0.15 });
      this.tone(o, { f: 880, t: 0.16, gain: 0.15, when: 0.1 });
    } else {
      this.tone(o, { f: 440, t: 0.1, gain: 0.13 });
      this.tone(o, { f: 311, t: 0.16, gain: 0.13, when: 0.1 });
    }
  }

  countdown() {
    if (!this.ensure()) return;
    this.tone(this.out(), { f: 988, t: 0.08, type: 'square', gain: 0.1 });
  }

  winLose(won) {
    if (!this.ensure()) return;
    const o = this.out();
    const seq = won ? [587, 740, 880, 1175] : [440, 415, 311, 294];
    seq.forEach((f, i) => this.tone(o, { f, t: 0.22, gain: 0.16, when: i * 0.16 }));
  }

  /** صدى الماب (يضبط عند بدء الماتش) */
  matchAmbience(mapEcho) {
    this.echoLevel = mapEcho ?? 0.15;
    if (this.ctx) this.echoOut.gain.value = 0.35 + this.echoLevel * 0.8;
  }

  // ---------- موسيقى القوائم: لوب هادئ بمقام الحجاز ----------
  menuMusic(on) {
    if (on === this.musicOn) return;
    this.musicOn = on;
    if (!on) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
      return;
    }
    if (!this.ensure()) {
      this.musicOn = false;
      return;
    }
    let step = 0;
    let nextAt = this.ctx.currentTime + 0.1;
    const pattern = [0, 2, 3, 4, 2, 3, 1, 0, 4, 5, 4, 3, 2, 1, 0, -1];
    const beat = 0.42;
    this.musicTimer = setInterval(() => {
      if (!this.musicOn) return;
      const ahead = this.ctx.currentTime + 0.3;
      while (nextAt < ahead) {
        const idx = pattern[step % pattern.length];
        const when = nextAt - this.ctx.currentTime;
        if (idx >= 0) {
          // عزفة وترية ناعمة
          this.tone(this.music, {
            f: HIJAZ[idx] * 2, t: 0.5, type: 'triangle', gain: 0.1, when,
          });
          if (step % 4 === 0) {
            this.tone(this.music, {
              f: HIJAZ[0] / 2, t: 1.4, type: 'sine', gain: 0.07, when,
            });
          }
          if (step % 8 === 6) {
            this.tone(this.music, {
              f: HIJAZ[(idx + 2) % 7] * 2, t: 0.4, type: 'triangle', gain: 0.06, when: when + beat / 2,
            });
          }
        }
        nextAt += beat;
        step++;
      }
    }, 120);
  }
}
