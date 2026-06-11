// الـ HUD أثناء اللعب (القسم 10) — يُبنى بالكامل من strings-ar.
// كروس هير ديناميكي، vignette وقوس اتجاه الضرر، أرقام ضرر طافية،
// كيل فيد بأيقونات الأسلحة (🥿 للنعال)، سكوب، عداد ذخيرة.

import * as THREE from 'three';
import { STR } from '../data/strings-ar.js';
import { WEAPONS } from '../data/weapons-data.js';
import { clamp } from '../engine/utils.js';

const DMG_POOL = 14;
const KILLFEED_MAX = 5;

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

    // مخزن أرقام الضرر
    this.dmgPool = [];
    this.dmgIdx = 0;
    this._projV = new THREE.Vector3();
    for (let i = 0; i < DMG_POOL; i++) {
      const div = document.createElement('div');
      div.className = 'dmg-num';
      this.els['dmg-numbers'].appendChild(div);
      this.dmgPool.push(div);
    }
  }

  /** رقم ضرر يطفو فوق نقطة الإصابة ويتلاشى */
  damageNumber(worldPos, amount, head = false) {
    this._projV.copy(worldPos).project(this.game.renderer.camera);
    if (this._projV.z > 1) return;
    const x = (this._projV.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-this._projV.y * 0.5 + 0.5) * window.innerHeight;
    const div = this.dmgPool[this.dmgIdx];
    this.dmgIdx = (this.dmgIdx + 1) % DMG_POOL;
    div.className = `dmg-num${head ? ' head' : ''}`;
    div.textContent = Math.round(amount);
    div.style.left = `${x + (Math.random() * 26 - 13)}px`;
    div.style.top = `${y - 8}px`;
    void div.offsetWidth;
    div.classList.add('show');
  }

  /** كيل فيد: «القاتل [أيقونة السلاح] الضحية» — النعال بأيقونة 🥿 */
  killfeed(killer, victim, info = {}) {
    const feed = this.els.killfeed;
    const row = document.createElement('div');
    const me = killer?.isPlayer || victim.isPlayer;
    row.className = `kf-row${me ? ' me' : ''}`;
    const icon = info.weaponId === 'nial'
      ? '🥿'
      : (WEAPONS[info.weaponId]?.icon ?? '•');
    const head = info.headshot ? ' ☠' : '';
    const kName = killer ? killer.name : '—';
    const kTeam = killer ? killer.team : 'red';
    row.innerHTML =
      `<span class="kf-name ${kTeam}">${kName}</span>` +
      `<span class="kf-icon">[${icon}]${head}</span>` +
      `<span class="kf-name ${victim.team}">${victim.name}</span>`;
    feed.prepend(row);
    while (feed.children.length > KILLFEED_MAX) feed.lastChild.remove();
    setTimeout(() => row.classList.add('fade'), 4200);
    setTimeout(() => row.remove(), 5000);
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

  /** عدّاد الريسباون مع اسم القاتل وسلاحه */
  setRespawn(seconds, killerName, weaponName) {
    const box = this.els['respawn-box'];
    if (seconds === null) {
      box.classList.add('hidden');
      return;
    }
    box.classList.remove('hidden');
    this.els['respawn-count'].textContent = Math.ceil(seconds);
    this.els['respawn-killer'].innerHTML = killerName
      ? `${STR.killedBy} <b>${killerName}</b>${weaponName ? ` (${weaponName})` : ''}`
      : '';
  }

  // ---------- السكور والتايمر ----------
  setTopbar(blue, red, timer) {
    if (this._tbB !== blue) { this.els['score-blue'].textContent = blue; this._tbB = blue; }
    if (this._tbR !== red) { this.els['score-red'].textContent = red; this._tbR = red; }
    if (this._tbT !== timer) { this.els['match-timer'].textContent = timer; this._tbT = timer; }
  }

  // ---------- نقاط الاستحواذ ----------
  setDomVisible(v) {
    this.els['dom-points'].classList.toggle('hidden', !v);
    if (v && !this.domEls) {
      this.domEls = [];
      this.domWorldEls = [];
      for (const id of ['A', 'B', 'C']) {
        const el = document.createElement('div');
        el.className = 'dom-pt';
        el.innerHTML = `<div class="fill"></div><span>${id}</span>`;
        this.els['dom-points'].appendChild(el);
        this.domEls.push(el);

        const w = document.createElement('div');
        w.className = 'dom-world hidden';
        w.innerHTML = `<b>${id}</b><i></i>`;
        this.root.appendChild(w);
        this.domWorldEls.push(w);
      }
    }
    if (!v && this.domWorldEls) {
      for (const w of this.domWorldEls) w.classList.add('hidden');
    }
  }

  updateDom(points, player, camera) {
    if (!this.domEls) return;
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const el = this.domEls[i];
      el.className = `dom-pt${p.owner ? ` own-${p.owner}` : ''}${p.contested ? ' contested' : ''}`;
      const fill = el.firstElementChild;
      fill.className = `fill${p.capTeam ? ` f-${p.capTeam}` : ''}`;
      fill.style.transform = `scaleY(${p.capTeam ? p.progress : 0})`;

      // علامة عالمية فوق النقطة مع المسافة
      const w = this.domWorldEls[i];
      this._projV.set(p.x, p.y + 5.2, p.z).project(camera);
      if (this._projV.z > 1) {
        w.classList.add('hidden');
        continue;
      }
      w.classList.remove('hidden');
      const x = (this._projV.x * 0.5 + 0.5) * window.innerWidth;
      const y = (-this._projV.y * 0.5 + 0.5) * window.innerHeight;
      w.style.left = `${clamp(x, 30, window.innerWidth - 30)}px`;
      w.style.top = `${clamp(y, 40, window.innerHeight - 60)}px`;
      w.className = `dom-world ${p.owner ? `own-${p.owner}` : ''}`;
      const dist = Math.hypot(p.x - player.pos.x, p.z - player.pos.z);
      w.lastElementChild.textContent = `${Math.round(dist)}${STR.meters}`;
    }
  }

  // ---------- السكوربورد ----------
  showScoreboard(held) {
    this.sbVisible = held;
    this.els.scoreboard.classList.toggle('hidden', !held);
    if (held) this.renderScoreboard();
  }

  renderScoreboard() {
    const match = this.game.match;
    if (!match) return;
    const rows = [];
    for (const team of ['blue', 'red']) {
      const list = match.combatants
        .filter((c) => c.team === team)
        .sort((a, b) => b.score - a.score || b.kills - a.kills);
      rows.push(`<tr class="sb-team-head ${team}"><td colspan="4">${team === 'blue' ? STR.teamBlue : STR.teamRed} — ${match.teamScores[team]}</td></tr>`);
      for (const c of list) {
        rows.push(
          `<tr class="sb-row ${team}${c.isPlayer ? ' me' : ''}">` +
          `<td>${c.name}</td><td class="num">${c.kills}</td>` +
          `<td class="num">${c.deaths}</td><td class="num">${c.score}</td></tr>`,
        );
      }
    }
    this.els.scoreboard.innerHTML =
      `<table class="sb-table"><thead><tr><th></th><th class="num">${STR.kills}</th>` +
      `<th class="num">${STR.deaths}</th><th class="num">${STR.points}</th></tr></thead>` +
      `<tbody>${rows.join('')}</tbody></table>`;
  }

  update(dt) {
    const match = this.game.match;
    if (!match) return;
    if (this.sbVisible) {
      this._sbT = (this._sbT || 0) - dt;
      if (this._sbT <= 0) {
        this._sbT = 0.5;
        this.renderScoreboard();
      }
    }
    if (match.mode?.id === 'dom') {
      this.updateDom(match.mode.points, match.player, this.game.renderer.camera);
    }
  }
}
