// بناة شاشات DOM — كل النصوص من strings-ar (القسم 9).

import { STR, MAP_INFO } from '../data/strings-ar.js';
import { WEAPONS, PRIMARY_IDS } from '../data/weapons-data.js';

export function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

export function buildMainMenu() {
  const s = el('div', 'screen overlay menu-overlay hidden');
  s.id = 'screen-main';
  s.innerHTML = `
    <div class="menu-wrap">
      <h1 class="wordmark">${STR.gameTitle}</h1>
      <p class="wordmark-sub">${STR.gameSubtitle}</p>
      <nav class="main-buttons">
        <button class="btn primary" data-nav="play">${STR.play}</button>
        <button class="btn" data-nav="weapons">${STR.weapons}</button>
        <button class="btn" data-nav="maps">${STR.maps}</button>
        <button class="btn" data-nav="record">${STR.record}</button>
        <button class="btn" data-nav="settings">${STR.settings}</button>
      </nav>
    </div>`;
  return s;
}

/** تدفق «العب»: النمط → الماب → الصعوبة → السلاح → ابدأ */
export function buildPlayFlow() {
  const s = el('div', 'screen overlay hidden');
  s.id = 'screen-play';
  const mapCards = ['ishbiliya', 'awazem', 'dawadmi'].map((id) => `
    <button class="card-btn map-card" data-map="${id}">
      <img class="map-prev" data-prev="${id}" alt="">
      <span class="card-title">${MAP_INFO[id].name}</span>
      <span class="card-sub">${MAP_INFO[id].time}</span>
    </button>`).join('');
  const weaponCards = PRIMARY_IDS.map((id) => `
    <button class="card-btn weapon-card" data-weapon="${id}">
      <span class="card-title">${WEAPONS[id].name}</span>
      <span class="card-sub">${WEAPONS[id].kind}</span>
    </button>`).join('');
  s.innerHTML = `
    <div class="card play-card">
      <h2 id="play-step-title">${STR.chooseMode}</h2>
      <div class="play-step" data-step="mode">
        <div class="cards-row">
          <button class="card-btn mode-card" data-mode="tdm">
            <span class="card-title">${STR.modeTdm}</span>
            <span class="card-sub">${STR.modeTdmDesc}</span>
          </button>
          <button class="card-btn mode-card" data-mode="dom">
            <span class="card-title">${STR.modeDom}</span>
            <span class="card-sub">${STR.modeDomDesc}</span>
          </button>
        </div>
      </div>
      <div class="play-step hidden" data-step="map">
        <div class="cards-row">${mapCards}
          <button class="card-btn map-card random" data-map="random">
            <span class="card-title">${STR.randomMap}</span>
          </button>
        </div>
      </div>
      <div class="play-step hidden" data-step="diff">
        <div class="cards-row">
          <button class="card-btn diff-card" data-diff="easy">
            <span class="card-title">${STR.diffEasy}</span><span class="card-sub">${STR.diffEasyDesc}</span>
          </button>
          <button class="card-btn diff-card" data-diff="mid">
            <span class="card-title">${STR.diffMid}</span><span class="card-sub">${STR.diffMidDesc}</span>
          </button>
          <button class="card-btn diff-card" data-diff="hard">
            <span class="card-title">${STR.diffHard}</span><span class="card-sub">${STR.diffHardDesc}</span>
          </button>
        </div>
      </div>
      <div class="play-step hidden" data-step="weapon">
        <div class="cards-row weapons-grid">${weaponCards}</div>
        <button class="btn primary big-start hidden" id="btn-start-match">${STR.startMatch}</button>
      </div>
      <button class="btn btn-back" data-back>${STR.back}</button>
    </div>`;
  return s;
}

/** قائمة الأسلحة: نموذج 3D يدور + إحصائيات + اعتماد */
export function buildWeaponsScreen() {
  const s = el('div', 'screen overlay hidden');
  s.id = 'screen-weapons';
  const tabs = [...PRIMARY_IDS, 'nial'].map((id) =>
    `<button class="wtab" data-wid="${id}">${WEAPONS[id].name}</button>`).join('');
  s.innerHTML = `
    <div class="card weapons-card">
      <h2>${STR.weapons}</h2>
      <div class="wtabs">${tabs}</div>
      <div class="weapon-view">
        <canvas id="weapon-canvas" width="380" height="240"></canvas>
        <div class="weapon-info">
          <h3 id="w-name"></h3>
          <p id="w-kind" class="dim"></p>
          <p id="w-desc" class="w-desc"></p>
          <div class="stat-row"><span>${STR.statDamage}</span><div class="stat-bar"><div id="ws-dmg"></div></div></div>
          <div class="stat-row"><span>${STR.statRate}</span><div class="stat-bar"><div id="ws-rate"></div></div></div>
          <div class="stat-row"><span>${STR.statRange}</span><div class="stat-bar"><div id="ws-range"></div></div></div>
          <div class="stat-row"><span>${STR.statReload}</span><div class="stat-bar"><div id="ws-reload"></div></div></div>
          <button class="btn primary" id="btn-adopt">${STR.adopt}</button>
        </div>
      </div>
      <button class="btn btn-back" data-back>${STR.back}</button>
    </div>`;
  return s;
}

/** قائمة المابات: بطاقات بمعاينة مرندرة من المشهد */
export function buildMapsScreen() {
  const s = el('div', 'screen overlay hidden');
  s.id = 'screen-maps';
  const cards = ['ishbiliya', 'awazem', 'dawadmi'].map((id) => {
    const info = MAP_INFO[id];
    return `
      <div class="map-info-card">
        <img class="map-prev-lg" data-prev="${id}" alt="${info.name}">
        <h3>${info.name} <span class="dim">${info.time}</span></h3>
        <p>${info.desc}</p>
        <p class="best-weapons">${STR.bestHere} <b>${info.best}</b></p>
      </div>`;
  }).join('');
  s.innerHTML = `
    <div class="card maps-card">
      <h2>${STR.maps}</h2>
      <div class="cards-row maps-row">${cards}</div>
      <button class="btn btn-back" data-back>${STR.back}</button>
    </div>`;
  return s;
}

/** الريكورد */
export function buildRecordScreen() {
  const s = el('div', 'screen overlay hidden');
  s.id = 'screen-record';
  s.innerHTML = `
    <div class="card record-card">
      <h2>${STR.recordTitle}</h2>
      <div class="rec-grid">
        <div class="rec-box"><span class="rec-label">${STR.totalKills}</span><span class="rec-num" id="rec-kills">0</span></div>
        <div class="rec-box"><span class="rec-label">${STR.totalDeaths}</span><span class="rec-num" id="rec-deaths">0</span></div>
        <div class="rec-box"><span class="rec-label">${STR.kd}</span><span class="rec-num" id="rec-kd">0</span></div>
        <div class="rec-box"><span class="rec-label">${STR.matchesPlayed}</span><span class="rec-num" id="rec-matches">0</span></div>
        <div class="rec-box wide"><span class="rec-label">${STR.modeTdm} — ${STR.winsLosses}</span><span class="rec-num" id="rec-tdm">0 / 0</span></div>
        <div class="rec-box wide"><span class="rec-label">${STR.modeDom} — ${STR.winsLosses}</span><span class="rec-num" id="rec-dom">0 / 0</span></div>
      </div>
      <div class="row-buttons">
        <button class="btn danger" id="btn-reset-record">${STR.resetRecord}</button>
      </div>
      <div id="reset-confirm" class="hidden">
        <p>${STR.resetConfirm}</p>
        <div class="row-buttons">
          <button class="btn danger" id="btn-reset-yes">${STR.resetYes}</button>
          <button class="btn" id="btn-reset-no">${STR.resetNo}</button>
        </div>
      </div>
      <button class="btn btn-back" data-back>${STR.back}</button>
    </div>`;
  return s;
}

/** الإعدادات الكاملة (القسم 9) */
export function buildSettingsScreen() {
  const s = el('div', 'screen overlay hidden');
  s.id = 'screen-settings';
  s.innerHTML = `
    <div class="card settings-card">
      <h2>${STR.settings}</h2>
      <div class="set-row"><label>${STR.mouseSens}</label>
        <input type="range" id="set-msens" min="0.3" max="2.5" step="0.1"><span class="set-val" id="set-msens-v"></span></div>
      <div class="set-row"><label>${STR.touchSens}</label>
        <input type="range" id="set-tsens" min="0.3" max="2.5" step="0.1"><span class="set-val" id="set-tsens-v"></span></div>
      <div class="set-row"><label>${STR.fov}</label>
        <input type="range" id="set-fov" min="70" max="110" step="1"><span class="set-val" id="set-fov-v"></span></div>
      <div class="set-row"><label>${STR.sfxVolume}</label>
        <input type="range" id="set-sfx" min="0" max="1" step="0.05"><span class="set-val" id="set-sfx-v"></span></div>
      <div class="set-row"><label>${STR.musicVolume}</label>
        <input type="range" id="set-music" min="0" max="1" step="0.05"><span class="set-val" id="set-music-v"></span></div>
      <div class="set-row"><label>${STR.graphics}</label>
        <div class="seg" id="set-gfx">
          <button data-v="low">${STR.gfxLow}</button>
          <button data-v="mid">${STR.gfxMid}</button>
          <button data-v="high">${STR.gfxHigh}</button>
        </div></div>
      <div class="set-row"><label>${STR.defaultView}</label>
        <div class="seg" id="set-view">
          <button data-v="fps">${STR.viewFps}</button>
          <button data-v="tps">${STR.viewTps}</button>
        </div></div>
      <div class="row-buttons">
        <button class="btn" id="btn-defaults">${STR.restoreDefaults}</button>
      </div>
      <button class="btn btn-back" data-back>${STR.back}</button>
    </div>`;
  return s;
}

export function buildPause() {
  const s = el('div', 'screen overlay hidden');
  s.id = 'screen-pause';
  s.innerHTML = `
    <div class="card">
      <h2>${STR.pause}</h2>
      <div class="col-buttons">
        <button class="btn primary" data-act="resume">${STR.resume}</button>
        <button class="btn" data-act="settings">${STR.settings}</button>
        <button class="btn" data-act="end">${STR.endMatch}</button>
      </div>
    </div>`;
  return s;
}

export function buildMatchEnd() {
  const s = el('div', 'screen overlay hidden');
  s.id = 'screen-end';
  s.innerHTML = `
    <div class="card end-card">
      <h1 id="end-title" class="end-title"></h1>
      <div id="end-team-score" class="end-team-score"></div>
      <div id="end-scoreboard"></div>
      <div class="row-buttons">
        <button class="btn primary" data-act="replay">${STR.replay}</button>
        <button class="btn" data-act="change-weapon">${STR.changeWeapon}</button>
        <button class="btn" data-act="menu">${STR.mainMenu}</button>
      </div>
    </div>`;
  return s;
}

export function buildRotateNote() {
  const s = el('div', 'screen overlay hidden');
  s.id = 'screen-rotate';
  s.innerHTML = `<div class="card"><h2>📱↻</h2><p>${STR.rotateDevice}</p></div>`;
  return s;
}

export function buildLoading() {
  const s = el('div', 'screen overlay');
  s.id = 'screen-loading';
  s.innerHTML = `<div class="card"><p class="pulse">${STR.loading}</p></div>`;
  return s;
}

/** لوحة تغيير السلاح أثناء انتظار الريسباون */
export function buildRespawnWeapons() {
  const s = el('div', 'respawn-weapons hidden');
  s.id = 'respawn-weapons';
  s.innerHTML = PRIMARY_IDS.map((id) =>
    `<button class="btn small" data-weapon="${id}">${WEAPONS[id].name}</button>`).join('');
  return s;
}
