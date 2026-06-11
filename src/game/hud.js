// الـ HUD أثناء اللعب (القسم 10) — يُبنى بالكامل من strings-ar.
// المرحلة 1: كروس هير ديناميكي + vignette ضرر + هيكل عام.
// يكتمل (كيل فيد/سكور/نقاط/سكوربورد/ريسباون) في مراحل لاحقة.

import { STR } from '../data/strings-ar.js';
import { clamp } from '../engine/utils.js';

export class HUD {
  constructor(game) {
    this.game = game;
    this.root = document.createElement('div');
    this.root.id = 'hud';
    this.root.className = 'hidden';
    this.root.innerHTML = `
      <div id="crosshair">
        <span class="chl t"></span><span class="chl b"></span>
        <span class="chl r"></span><span class="chl l"></span>
        <i></i>
      </div>
      <div id="hitmarker"></div>
      <div id="scope-overlay" class="hidden"><div class="scope-ring"></div><div class="scope-h"></div><div class="scope-v"></div></div>
      <div id="dmg-vignette"></div>
      <div id="dmg-arc"></div>
      <div id="topbar">
        <div class="score blue"><span id="score-blue">0</span></div>
        <div id="match-timer">10:00</div>
        <div class="score red"><span id="score-red">0</span></div>
      </div>
      <div id="dom-points" class="hidden"></div>
      <div id="killfeed"></div>
      <div id="ammo-box">
        <div id="weapon-name"></div>
        <div id="ammo-line"><span id="ammo-mag">—</span><span id="ammo-res"> / —</span></div>
      </div>
      <div id="center-msg" class="hidden"></div>
      <div id="respawn-box" class="hidden">
        <div id="respawn-killer"></div>
        <div id="respawn-count"></div>
        <button id="respawn-weapon-btn" class="btn small">${STR.changeWeapon}</button>
      </div>
      <div id="dmg-numbers"></div>
      <div id="scoreboard" class="hidden"></div>
      <div id="prot-note" class="hidden">${STR.spawnProtected}</div>
    `;
    document.getElementById('app').appendChild(this.root);

    this.els = {};
    for (const el of this.root.querySelectorAll('[id]')) this.els[el.id] = el;
    this.spread = 8;
  }

  setVisible(v) {
    this.root.classList.toggle('hidden', !v);
  }

  /** اتساع الكروس هير بالبكسل حسب الانتشار الحالي */
  setSpread(px, hidden = false) {
    this.spread = px;
    const ch = this.els.crosshair;
    ch.style.setProperty('--gap', `${clamp(px, 4, 60)}px`);
    ch.classList.toggle('hidden', hidden);
  }

  setScope(on) {
    this.els['scope-overlay'].classList.toggle('hidden', !on);
  }

  setAmmo(mag, res, low = false) {
    this.els['ammo-mag'].textContent = mag === Infinity ? '∞' : mag;
    this.els['ammo-res'].textContent = res === Infinity ? '' : ` / ${res}`;
    this.els['ammo-box'].classList.toggle('low', low);
  }

  setWeaponName(name) {
    this.els['weapon-name'].textContent = name;
  }

  healthChanged(hp) {
    // لا شريط صحة — vignette فقط (القسم 10)
    const v = clamp(1 - hp / 100, 0, 1);
    this.els['dmg-vignette'].style.opacity = String(v * 0.85);
  }

  playerDamaged(attacker, amount, hp) {
    this.healthChanged(hp);
    // مؤشر قوس اتجاه مصدر الضرر
    if (attacker) {
      const p = this.game.match.player;
      const dx = attacker.pos.x - p.pos.x;
      const dz = attacker.pos.z - p.pos.z;
      const worldAng = Math.atan2(dx, dz);
      const rel = worldAng - p.yaw;
      this.els['dmg-arc'].style.setProperty('--ang', `${(-rel * 180) / Math.PI}deg`);
      this.els['dmg-arc'].classList.add('show');
      clearTimeout(this._arcT);
      this._arcT = setTimeout(() => this.els['dmg-arc'].classList.remove('show'), 650);
    }
  }

  hitmarker(kill = false) {
    const el = this.els.hitmarker;
    el.classList.remove('show', 'kill');
    void el.offsetWidth;
    if (kill) el.classList.add('kill');
    el.classList.add('show');
  }

  centerMsg(text, seconds = 2) {
    const el = this.els['center-msg'];
    el.textContent = text;
    el.classList.remove('hidden');
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
    clearTimeout(this._msgT);
    this._msgT = setTimeout(() => el.classList.add('hidden'), seconds * 1000);
  }

  setProtected(on) {
    this.els['prot-note'].classList.toggle('hidden', !on);
  }

  // ====== تُستكمل في مراحل لاحقة ======
  onKill() {}
  showScoreboard() {}
  update() {}
}
