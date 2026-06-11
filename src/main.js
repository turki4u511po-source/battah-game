// «بطه» — نقطة الدخول: الإعدادات، الأنظمة، آلة الحالات، حلقة اللعبة.

import * as THREE from 'three';
import { Renderer } from './engine/renderer.js';
import { Input } from './engine/input.js';
import { AudioSys } from './engine/audio.js';
import { HUD } from './game/hud.js';
import { Match } from './game/modes.js';
import { Menus } from './ui/menus.js';

const SETTINGS_KEY = 'battah.settings';
const DEFAULT_SETTINGS = {
  mouseSens: 1,
  touchSens: 1,
  fov: 90,
  sfxVolume: 0.8,
  musicVolume: 0.55,
  graphics: 'mid',
  defaultView: 'fps',
};

class Game {
  constructor() {
    this.params = new URLSearchParams(location.search);
    this.canvas = document.getElementById('game-canvas');
    this.state = 'menu'; // menu | playing | paused | matchend
    this.time = 0;

    this.settings = this.loadSettings();
    this.renderer = new Renderer(this.canvas, this.settings);
    this.input = new Input(this);
    this.audio = new AudioSys(this);
    this.hud = new HUD(this);
    this.menus = new Menus(this);

    this.match = null;

    // مشهد خلفية القوائم (يصبح مشهد ماب حيًّا في مرحلة القوائم)
    this.menuScene = new THREE.Scene();
    this.menuScene.background = new THREE.Color(0x10151c);
    this.menuCam = { angle: 0 };

    this.clock = new THREE.Clock();
    this.renderer.gl.setAnimationLoop(() => this.tick());

    this.menus.show('main');

    // إيقاف تلقائي عند فقدان التركيز
    window.addEventListener('blur', () => this.pauseMatch());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.pauseMatch();
    });

    if (this.params.has('autostart')) {
      this.startMatch({
        mode: this.params.get('mode') || 'tdm',
        mapId: this.params.get('map') || 'test',
        difficulty: this.params.get('diff') || 'mid',
        weapon: this.params.get('weapon') || 'alnimr',
      });
    }
  }

  loadSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
      return { ...DEFAULT_SETTINGS, ...saved };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  saveSettings() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
    } catch { /* وضع خصوصية */ }
  }

  // ---------- دورة الماتش ----------
  startMatch(opts) {
    this.match?.dispose();
    this.audio?.ensure();
    this.audio?.menuMusic(false);
    this.match = new Match(this, opts);
    this.state = 'playing';
    this.menus.show(null);
    this.hud.setVisible(true);
    this.input.clear();
    this.input.setTouchVisible(true);
    this.input.requestLock();
  }

  pauseMatch() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.input.releaseLock();
    this.input.clear();
    this.input.setTouchVisible(false);
    this.hud.setVisible(false);
    this.menus.show('pause');
  }

  resumeMatch() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.menus.show(null);
    this.hud.setVisible(true);
    this.input.setTouchVisible(true);
    this.input.requestLock();
  }

  /** إنهاء الماتش — إلى القائمة أو شاشة النتيجة */
  endMatch(toMenu = false) {
    if (!this.match) return;
    this.input.releaseLock();
    this.input.clear();
    this.input.setTouchVisible(false);
    this.hud.setVisible(false);
    if (toMenu) {
      this.match.dispose();
      this.match = null;
      this.state = 'menu';
      this.menus.show('main');
      this.audio?.menuMusic(true);
    }
  }

  tick() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.time += dt;

    if (this.state === 'playing' && this.match) {
      this.match.update(dt);
      this.hud.update(dt);
      this.renderer.render(this.match.scene);
    } else if (this.match && (this.state === 'paused' || this.state === 'matchend')) {
      this.renderer.render(this.match.scene);
    } else {
      this.renderer.render(this.menuScene);
    }
  }
}

window.__battah = new Game();
