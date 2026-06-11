// تدفق القوائم (القسم 9): الرئيسية، تدفق «العب» الرباعي، معرض
// الأسلحة بنموذج دوّار، بطاقات المابات بمعاينات مرندرة من المشهد،
// الريكورد، الإعدادات الحية، الإيقاف، شاشة النهاية — كله RTL.

import * as THREE from 'three';
import {
  buildMainMenu, buildPlayFlow, buildWeaponsScreen, buildMapsScreen,
  buildRecordScreen, buildSettingsScreen, buildPause, buildMatchEnd,
  buildRotateNote, buildLoading,
} from './screens.js';
import { STR } from '../data/strings-ar.js';
import { WEAPONS, PRIMARY_IDS, fireInterval } from '../data/weapons-data.js';
import { buildWeaponModel } from '../game/weapon-models.js';
import { buildMapScene, MAP_IDS } from '../game/modes.js';
import { choose, clamp } from '../engine/utils.js';

const LOADOUT_KEY = 'battah.loadout';

export class Menus {
  constructor(game) {
    this.game = game;
    this.root = document.getElementById('ui-root');

    this.screens = {
      loading: buildLoading(),
      main: buildMainMenu(),
      play: buildPlayFlow(),
      weapons: buildWeaponsScreen(),
      maps: buildMapsScreen(),
      record: buildRecordScreen(),
      settings: buildSettingsScreen(),
      pause: buildPause(),
      end: buildMatchEnd(),
      rotate: buildRotateNote(),
    };
    for (const s of Object.values(this.screens)) this.root.appendChild(s);

    this.settingsReturnTo = 'main';
    this.playCfg = {
      mode: 'tdm',
      mapId: 'ishbiliya',
      difficulty: 'mid',
      weapon: this.loadLoadout(),
    };
    this.previews = null;
    this.weaponView = null;

    this.buildMenuBg();
    this.bind();
    this.show('loading');

    // إلزام الشاشة العرضية على الجوال
    if (game.input.isTouch) {
      const check = () => {
        const portrait = window.matchMedia('(orientation: portrait)').matches;
        this.screens.rotate.classList.toggle('hidden', !portrait);
      };
      window.addEventListener('resize', check);
      check();
    }
  }

  loadLoadout() {
    try {
      const w = localStorage.getItem(LOADOUT_KEY);
      return PRIMARY_IDS.includes(w) ? w : 'alnimr';
    } catch {
      return 'alnimr';
    }
  }

  saveLoadout(id) {
    try { localStorage.setItem(LOADOUT_KEY, id); } catch { /* خصوصية */ }
  }

  // ---------------- خلفية القائمة: مشهد ماب حي بكاميرا بانورامية ----------------
  buildMenuBg() {
    const id = choose(MAP_IDS);
    const built = buildMapScene(id);
    this.menuBg = built;
    this.game.menuScene = built.scene;
    this.menuCamAngle = Math.random() * Math.PI * 2;
  }

  /** يُستدعى من حلقة اللعبة كل إطار */
  update(dt) {
    const game = this.game;
    if (game.state === 'menu') {
      // كاميرا بانورامية بطيئة
      this.menuCamAngle += dt * 0.045;
      const cam = game.renderer.camera;
      const r = this.menuBg.map.size * 0.46;
      cam.position.set(
        Math.cos(this.menuCamAngle) * r,
        16 + Math.sin(this.menuCamAngle * 0.7) * 4,
        Math.sin(this.menuCamAngle) * r,
      );
      cam.lookAt(0, 2, 0);
    }
    // نموذج السلاح الدوّار
    if (this.weaponView && !this.screens.weapons.classList.contains('hidden')) {
      this.weaponView.group.rotation.y += dt * 0.9;
      this.weaponView.renderer.render(this.weaponView.scene, this.weaponView.camera);
    }
  }

  show(name) {
    for (const [k, s] of Object.entries(this.screens)) {
      if (k === 'rotate') continue;
      s.classList.toggle('hidden', k !== name);
    }
    this.game.audio?.menuMusic(
      ['main', 'play', 'weapons', 'maps', 'record', 'settings'].includes(name),
    );
  }

  // ---------------- الربط ----------------
  bind() {
    const game = this.game;

    this.screens.main.addEventListener('click', (e) => {
      const nav = e.target.closest('[data-nav]')?.dataset.nav;
      if (!nav) return;
      game.audio?.ensure();
      if (nav === 'play') this.openPlayFlow();
      else if (nav === 'weapons') this.openWeapons();
      else if (nav === 'maps') this.openMaps();
      else if (nav === 'record') this.openRecord();
      else if (nav === 'settings') this.openSettings('main');
    });

    // أزرار الرجوع العامة
    for (const s of Object.values(this.screens)) {
      s.addEventListener('click', (e) => {
        if (!e.target.matches('[data-back]')) return;
        if (s === this.screens.settings) {
          this.show(this.settingsReturnTo);
          if (this.settingsReturnTo === 'pause') return;
        } else if (s === this.screens.play && this.playStep !== 'mode') {
          this.gotoPlayStep(this.prevPlayStep());
          return;
        } else {
          this.show('main');
        }
      });
    }

    this.bindPlayFlow();
    this.bindWeapons();
    this.bindRecord();
    this.bindSettings();

    this.screens.pause.addEventListener('click', (e) => {
      const act = e.target.dataset?.act;
      if (!act) return;
      if (act === 'resume') game.resumeMatch();
      else if (act === 'end') game.endMatch(true);
      else if (act === 'settings') this.openSettings('pause');
    });

    this.screens.end.addEventListener('click', (e) => {
      const act = e.target.dataset?.act;
      if (!act) return;
      if (act === 'replay') game.startMatch(game.match.opts);
      else if (act === 'menu') game.endMatch(true);
      else if (act === 'change-weapon') {
        // فتح خطوة السلاح ثم البدء بنفس إعدادات الماتش
        this.playCfg = { ...game.match.opts };
        this.openPlayFlow('weapon');
      }
    });
  }

  // ---------------- تدفق «العب» ----------------
  openPlayFlow(step = 'mode') {
    this.gotoPlayStep(step);
    this.show('play');
    if (!this.previews) this.ensurePreviews();
  }

  prevPlayStep() {
    return { map: 'mode', diff: 'map', weapon: 'diff' }[this.playStep] || 'mode';
  }

  gotoPlayStep(step) {
    this.playStep = step;
    const titles = {
      mode: STR.chooseMode, map: STR.chooseMap,
      diff: STR.chooseDifficulty, weapon: STR.chooseWeapon,
    };
    const screen = this.screens.play;
    screen.querySelector('#play-step-title').textContent = titles[step];
    for (const div of screen.querySelectorAll('.play-step')) {
      div.classList.toggle('hidden', div.dataset.step !== step);
    }
    if (step === 'weapon') {
      // إبراز السلاح المعتمد وإظهار زر البدء
      for (const b of screen.querySelectorAll('[data-weapon]')) {
        b.classList.toggle('selected', b.dataset.weapon === this.playCfg.weapon);
      }
      screen.querySelector('#btn-start-match').classList.remove('hidden');
    }
  }

  bindPlayFlow() {
    const screen = this.screens.play;
    const game = this.game;
    screen.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      if (btn.dataset.mode) {
        this.playCfg.mode = btn.dataset.mode;
        this.gotoPlayStep('map');
      } else if (btn.dataset.map) {
        this.playCfg.mapId = btn.dataset.map === 'random' ? choose(MAP_IDS) : btn.dataset.map;
        this.gotoPlayStep('diff');
      } else if (btn.dataset.diff) {
        this.playCfg.difficulty = btn.dataset.diff;
        this.gotoPlayStep('weapon');
      } else if (btn.dataset.weapon) {
        this.playCfg.weapon = btn.dataset.weapon;
        this.saveLoadout(btn.dataset.weapon);
        for (const b of screen.querySelectorAll('[data-weapon]')) {
          b.classList.toggle('selected', b === btn);
        }
      } else if (btn.id === 'btn-start-match') {
        game.startMatch({ ...this.playCfg });
      }
    });
  }

  // ---------------- معاينات المابات (مرندرة من المشهد) ----------------
  async ensurePreviews() {
    if (this.previews) return;
    this.previews = {};
    for (const id of MAP_IDS) {
      this.previews[id] = this.renderMapPreview(id);
      // توزيع العمل على إطارات
      await new Promise((r) => setTimeout(r, 30));
      for (const img of document.querySelectorAll(`img[data-prev="${id}"]`)) {
        img.src = this.previews[id];
      }
    }
  }

  renderMapPreview(id) {
    const gl = this.game.renderer.gl;
    let built;
    let dispose = false;
    if (this.menuBg.map.id === id) {
      built = this.menuBg;
    } else {
      built = buildMapScene(id);
      dispose = true;
    }
    const W = 320;
    const H = 180;
    const cam = new THREE.PerspectiveCamera(58, W / H, 0.5, 600);
    const r = built.map.size * 0.5;
    cam.position.set(r * 0.75, r * 0.5, r * 0.8);
    cam.lookAt(0, 0, 0);
    const target = new THREE.WebGLRenderTarget(W, H);
    gl.setRenderTarget(target);
    gl.render(built.scene, cam);
    const pixels = new Uint8Array(W * H * 4);
    gl.readRenderTargetPixels(target, 0, 0, W, H, pixels);
    gl.setRenderTarget(null);
    target.dispose();
    // قلب رأسي إلى Canvas ثم dataURL
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const ctx = c.getContext('2d');
    const imgData = ctx.createImageData(W, H);
    for (let y = 0; y < H; y++) {
      const src = (H - 1 - y) * W * 4;
      imgData.data.set(pixels.subarray(src, src + W * 4), y * W * 4);
    }
    ctx.putImageData(imgData, 0, 0);
    if (dispose) {
      built.map.dispose();
      built.scene.clear();
    }
    return c.toDataURL('image/jpeg', 0.82);
  }

  openMaps() {
    this.show('maps');
    this.ensurePreviews();
  }

  // ---------------- معرض الأسلحة ----------------
  openWeapons() {
    this.show('weapons');
    if (!this.weaponView) this.initWeaponView();
    this.selectWeapon(this.playCfg.weapon);
  }

  initWeaponView() {
    const canvas = this.screens.weapons.querySelector('#weapon-canvas');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 380 / 240, 0.01, 10);
    camera.position.set(0, 0.12, 1.1);
    camera.lookAt(0, 0, 0);
    scene.add(new THREE.HemisphereLight(0xcfe0f0, 0x40362a, 1.1));
    const key = new THREE.DirectionalLight(0xffeecc, 1.6);
    key.position.set(2, 3, 2);
    scene.add(key);
    const group = new THREE.Group();
    scene.add(group);
    this.weaponView = { renderer, scene, camera, group, models: {} };
  }

  selectWeapon(id) {
    const view = this.weaponView;
    const screen = this.screens.weapons;
    this.viewedWeapon = id;
    while (view.group.children.length) view.group.remove(view.group.children[0]);
    if (!view.models[id]) {
      const { group } = buildWeaponModel(id);
      group.scale.setScalar(id === 'nial' ? 2.2 : 1.35);
      view.models[id] = group;
    }
    view.group.add(view.models[id]);

    const w = WEAPONS[id];
    screen.querySelector('#w-name').textContent = w.melee ? `${w.name} 🥿` : w.name;
    screen.querySelector('#w-kind').textContent = w.kind;
    screen.querySelector('#w-desc').textContent = w.desc;
    const dmg = (w.damage * (w.pellets || 1)) / 100;
    const rate = w.melee ? 0.25 : Math.min((60 / fireInterval(w)) / 1000, 1);
    const range = w.melee ? 0.06 : Math.min((w.rangeMax === 999 ? 90 : w.rangeMax) / 90, 1);
    const reload = w.melee ? 1 : clamp(1 - w.reloadTime / 3.6, 0.05, 1);
    screen.querySelector('#ws-dmg').style.width = `${clamp(dmg, 0.05, 1) * 100}%`;
    screen.querySelector('#ws-rate').style.width = `${clamp(rate, 0.05, 1) * 100}%`;
    screen.querySelector('#ws-range').style.width = `${range * 100}%`;
    screen.querySelector('#ws-reload').style.width = `${reload * 100}%`;
    for (const t of screen.querySelectorAll('.wtab')) {
      t.classList.toggle('selected', t.dataset.wid === id);
    }
    const adoptBtn = screen.querySelector('#btn-adopt');
    const isPrimary = PRIMARY_IDS.includes(id);
    adoptBtn.classList.toggle('hidden', !isPrimary);
    adoptBtn.textContent = this.playCfg.weapon === id ? STR.adopted : STR.adopt;
  }

  bindWeapons() {
    this.screens.weapons.addEventListener('click', (e) => {
      const tab = e.target.closest('.wtab');
      if (tab) {
        this.selectWeapon(tab.dataset.wid);
        return;
      }
      if (e.target.id === 'btn-adopt' && PRIMARY_IDS.includes(this.viewedWeapon)) {
        this.playCfg.weapon = this.viewedWeapon;
        this.saveLoadout(this.viewedWeapon);
        e.target.textContent = STR.adopted;
        this.game.audio?.swap();
      }
    });
  }

  // ---------------- الريكورد ----------------
  openRecord() {
    const r = this.game.record;
    const s = this.screens.record;
    s.querySelector('#rec-kills').textContent = r.kills;
    s.querySelector('#rec-deaths').textContent = r.deaths;
    s.querySelector('#rec-kd').textContent = (r.kills / Math.max(1, r.deaths)).toFixed(2);
    s.querySelector('#rec-matches').textContent = r.matches;
    s.querySelector('#rec-tdm').textContent = `${r.tdm.w} / ${r.tdm.l}`;
    s.querySelector('#rec-dom').textContent = `${r.dom.w} / ${r.dom.l}`;
    s.querySelector('#reset-confirm').classList.add('hidden');
    this.show('record');
  }

  bindRecord() {
    const s = this.screens.record;
    s.querySelector('#btn-reset-record').addEventListener('click', () => {
      s.querySelector('#reset-confirm').classList.remove('hidden');
    });
    s.querySelector('#btn-reset-no').addEventListener('click', () => {
      s.querySelector('#reset-confirm').classList.add('hidden');
    });
    s.querySelector('#btn-reset-yes').addEventListener('click', () => {
      this.game.resetRecord();
      this.openRecord();
    });
  }

  // ---------------- الإعدادات ----------------
  openSettings(returnTo) {
    this.settingsReturnTo = returnTo;
    this.reflectSettings();
    this.show('settings');
  }

  reflectSettings() {
    const s = this.screens.settings;
    const set = this.game.settings;
    s.querySelector('#set-msens').value = set.mouseSens;
    s.querySelector('#set-tsens').value = set.touchSens;
    s.querySelector('#set-fov').value = set.fov;
    s.querySelector('#set-sfx').value = set.sfxVolume;
    s.querySelector('#set-music').value = set.musicVolume;
    s.querySelector('#set-msens-v').textContent = `×${set.mouseSens.toFixed(1)}`;
    s.querySelector('#set-tsens-v').textContent = `×${set.touchSens.toFixed(1)}`;
    s.querySelector('#set-fov-v').textContent = set.fov;
    s.querySelector('#set-sfx-v').textContent = `${Math.round(set.sfxVolume * 100)}%`;
    s.querySelector('#set-music-v').textContent = `${Math.round(set.musicVolume * 100)}%`;
    for (const b of s.querySelectorAll('#set-gfx button')) {
      b.classList.toggle('selected', b.dataset.v === set.graphics);
    }
    for (const b of s.querySelectorAll('#set-view button')) {
      b.classList.toggle('selected', b.dataset.v === set.defaultView);
    }
  }

  bindSettings() {
    const s = this.screens.settings;
    const game = this.game;
    const onRange = (id, fn) => {
      s.querySelector(id).addEventListener('input', (e) => {
        fn(Number(e.target.value));
        this.reflectSettings();
        game.saveSettings();
      });
    };
    onRange('#set-msens', (v) => { game.settings.mouseSens = v; });
    onRange('#set-tsens', (v) => { game.settings.touchSens = v; });
    onRange('#set-fov', (v) => {
      game.settings.fov = v;
      game.renderer.setBaseFov(v);
    });
    onRange('#set-sfx', (v) => {
      game.settings.sfxVolume = v;
      game.audio?.applyVolume();
    });
    onRange('#set-music', (v) => {
      game.settings.musicVolume = v;
      game.audio?.applyVolume();
    });
    s.querySelector('#set-gfx').addEventListener('click', (e) => {
      const v = e.target.dataset?.v;
      if (!v) return;
      game.settings.graphics = v;
      game.renderer.applyQuality();
      game.saveSettings();
      this.reflectSettings();
    });
    s.querySelector('#set-view').addEventListener('click', (e) => {
      const v = e.target.dataset?.v;
      if (!v) return;
      game.settings.defaultView = v;
      game.saveSettings();
      this.reflectSettings();
    });
    s.querySelector('#btn-defaults').addEventListener('click', () => {
      game.restoreDefaultSettings();
      this.reflectSettings();
    });
  }

  /** شاشة نهاية الماتش: فزت/خسرت + سكوربورد كامل */
  showEnd(winnerTeam) {
    const game = this.game;
    const match = game.match;
    const won = winnerTeam === 'blue';
    const title = this.screens.end.querySelector('#end-title');
    title.textContent = winnerTeam === null ? STR.draw : won ? STR.win : STR.lose;
    title.className = `end-title ${won ? 'win' : 'lose'}`;
    this.screens.end.querySelector('#end-team-score').innerHTML =
      `<b class="blue">${STR.teamBlue} ${match.teamScores.blue}</b> ${STR.vs} ` +
      `<b class="red">${match.teamScores.red} ${STR.teamRed}</b>`;
    game.hud.renderScoreboard();
    this.screens.end.querySelector('#end-scoreboard').innerHTML = game.hud.els.scoreboard.innerHTML;
    this.show('end');
  }
}
