// إدارة الواجهات العربية RTL: الشاشات وHUD.

import { CONFIG } from './config.js';
import { fmt, clamp } from './utils.js';

const SCREEN_IDS = ['menu', 'howto', 'settings', 'pause', 'gameover', 'loading'];

export class UI {
  constructor(game) {
    this.game = game;
    this.els = {};
    const ids = [
      'hud', 'menu', 'howto', 'settings', 'pause', 'gameover', 'loading',
      'hud-score', 'hud-wave', 'hud-left', 'hud-best',
      'combo-badge', 'combo-mult',
      'boss-bar-wrap', 'boss-bar-fill',
      'wave-banner', 'hitmarker',
      'health-fill', 'health-num', 'ammo-num',
      'reload-bar', 'reload-fill', 'reload-hint',
      'damage-vignette', 'heal-flash', 'popups',
      'menu-best-num', 'pointer-note',
      'go-score', 'go-wave', 'go-kills', 'go-best', 'go-record',
      'btn-start', 'btn-howto', 'btn-settings',
      'btn-resume', 'btn-restart', 'btn-pause-settings', 'btn-quit',
      'btn-again', 'btn-go-menu',
      'set-sens', 'set-sens-val', 'set-vol', 'set-vol-val', 'set-mute',
    ];
    for (const id of ids) this.els[id] = document.getElementById(id);

    this.settingsReturnTo = 'menu';
    this.bannerTimer = null;

    // تنقل الشاشات الثابتة
    this.els['btn-howto'].addEventListener('click', () => this.showScreen('howto'));
    this.els['btn-settings'].addEventListener('click', () => {
      this.settingsReturnTo = 'menu';
      this.showScreen('settings');
    });
    for (const btn of document.querySelectorAll('[data-back]')) {
      btn.addEventListener('click', () => {
        const from = btn.closest('.screen').id;
        this.showScreen(from === 'settings' ? this.settingsReturnTo : 'menu');
      });
    }

    // تنبيه الأجهزة بدون فأرة
    if (window.matchMedia('(pointer: coarse)').matches) {
      this.els['pointer-note'].classList.remove('hidden');
    }
  }

  /** إظهار شاشة غطائية واحدة (أو لا شيء أثناء اللعب) */
  showScreen(name) {
    for (const id of SCREEN_IDS) {
      this.els[id].classList.toggle('hidden', id !== name);
    }
  }

  setHudVisible(v) {
    this.els.hud.classList.toggle('hidden', !v);
    this.els.hud.setAttribute('aria-hidden', String(!v));
  }

  setBestEverywhere(best) {
    this.els['menu-best-num'].textContent = fmt(best);
    this.els['hud-best'].textContent = fmt(best);
  }

  // ---------- HUD ----------
  setScore(score) {
    this.els['hud-score'].textContent = fmt(score);
  }

  setWave(n) {
    this.els['hud-wave'].textContent = n > 0 ? fmt(n) : '—';
  }

  setLeft(n) {
    this.els['hud-left'].textContent = n >= 0 ? fmt(n) : '—';
  }

  setHealth(hp, max) {
    const frac = clamp(hp / max, 0, 1);
    this.els['health-fill'].style.width = `${frac * 100}%`;
    this.els['health-fill'].classList.toggle('hp-low', frac < 0.35);
    this.els['health-num'].textContent = fmt(Math.ceil(hp));
  }

  setAmmo(cur) {
    this.els['ammo-num'].textContent = fmt(cur);
  }

  setReload(progress) {
    // progress: null = لا إعادة تعبئة، 0..1 = شريط التقدم
    const active = progress !== null;
    this.els['reload-bar'].classList.toggle('hidden', !active);
    if (active) this.els['reload-fill'].style.width = `${progress * 100}%`;
  }

  setReloadHint(show) {
    this.els['reload-hint'].classList.toggle('hidden', !show);
  }

  setCombo(mult) {
    const show = mult >= 1.5;
    this.els['combo-badge'].classList.toggle('hidden', !show);
    if (show) this.els['combo-mult'].textContent = `×${mult.toFixed(2).replace(/\.?0+$/, '')}`;
  }

  setBoss(frac) {
    const show = frac !== null;
    this.els['boss-bar-wrap'].classList.toggle('hidden', !show);
    if (show) this.els['boss-bar-fill'].style.width = `${clamp(frac, 0, 1) * 100}%`;
  }

  banner(text, seconds = 2) {
    const el = this.els['wave-banner'];
    el.textContent = text;
    el.classList.remove('hidden');
    // إعادة تشغيل حركة الدخول
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
    clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => el.classList.add('hidden'), seconds * 1000);
  }

  hitmarker(isHead) {
    const el = this.els.hitmarker;
    el.classList.remove('hm-show', 'hm-head');
    void el.offsetWidth;
    if (isHead) el.classList.add('hm-head');
    el.classList.add('hm-show');
  }

  damageFlash(strength = 1) {
    const el = this.els['damage-vignette'];
    el.style.opacity = String(clamp(0.45 + strength * 0.5, 0, 1));
    clearTimeout(this.dmgTimer);
    this.dmgTimer = setTimeout(() => { el.style.opacity = '0'; }, 220);
  }

  setLowHealthVignette(frac) {
    // توهج إنذار دائم عندما تكون الصحة منخفضة
    if (frac < 0.3) {
      this.els['damage-vignette'].style.opacity = String(0.25 + (0.3 - frac) * 1.2);
    }
  }

  healFlash() {
    const el = this.els['heal-flash'];
    el.style.opacity = '1';
    clearTimeout(this.healTimer);
    this.healTimer = setTimeout(() => { el.style.opacity = '0'; }, 280);
  }
}
