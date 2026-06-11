// «بطه» — نقطة الدخول: المُصيّر، حلقة اللعبة، وآلة الحالات.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { Arena } from './arena.js';
import { UI } from './ui.js';
import { Input } from './input.js';
import { Player } from './player.js';
import { Particles } from './particles.js';
import { Weapon } from './weapon.js';
import { DuckManager } from './duck.js';
import { Projectiles } from './projectiles.js';
import { Pickups } from './pickups.js';

class Game {
  constructor() {
    this.params = new URLSearchParams(location.search);
    this.canvas = document.getElementById('game-canvas');

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      75, window.innerWidth / window.innerHeight, 0.1, 500,
    );
    this.camera.position.set(0, 10, 26);

    this.clock = new THREE.Clock();
    this.time = 0;
    this.state = 'menu'; // menu | playing | paused | gameover

    // تُستبدل بالقيم المحفوظة في مرحلة الواجهات
    this.settings = { sensitivity: 1, volume: 0.8, muted: false };

    this.arena = new Arena(this.scene);
    this.ui = new UI(this);
    this.input = new Input(this);
    this.player = new Player(this);
    this.particles = new Particles(this.scene);
    this.weapon = new Weapon(this);
    this.ducks = new DuckManager(this);
    this.projectiles = new Projectiles(this);
    this.pickups = new Pickups(this);

    window.addEventListener('resize', () => this.onResize());

    this.ui.showScreen('menu');
    this.renderer.setAnimationLoop(() => this.tick());

    if (this.params.has('autostart')) this.startGame();
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // ---------- تدفق الحالات ----------
  startGame() {
    this.player.reset();
    this.player.head.add(this.camera);
    this.camera.position.set(0, 0, 0);
    this.camera.rotation.set(0, 0, 0);
    this.weapon.reset();
    this.weapon.model.visible = true;
    this.particles.clear();
    this.ducks.clear();
    this.projectiles.clear();
    this.pickups.clear();

    this.state = 'playing';
    this.ui.showScreen(null);
    this.ui.setHudVisible(true);
    this.input.clear();
    this.input.requestLock();

    // ?ducks=N: نشر بط تجريبي بدون موجات (للفحص الآلي)
    if (this.params.has('ducks')) {
      const n = Number(this.params.get('ducks')) || 4;
      const types = ['normal', 'fast', 'tank', 'boss'];
      for (let i = 0; i < n; i++) {
        this.ducks.spawn(types[i % types.length], this.arena.getSpawnPoint(this.player.root.position));
      }
    }
  }

  /** يُستبدل بمدير الموجات في مرحلة النقاط */
  onDuckKilled() {}

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.input.releaseLock();
    this.input.clear();
    this.ui.setHudVisible(false);
    this.ui.showScreen('pause');
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.ui.showScreen(null);
    this.ui.setHudVisible(true);
    this.input.requestLock();
  }

  restart() {
    this.startGame();
  }

  quitToMenu() {
    this.state = 'menu';
    this.input.releaseLock();
    this.input.clear();
    this.scene.add(this.camera); // فكّ الكاميرا عن رأس اللاعب
    this.weapon.model.visible = false;
    this.ui.setHudVisible(false);
    this.ui.showScreen('menu');
  }

  gameOver() {
    // تُستكمل في مرحلة الموجات والنقاط
    this.state = 'gameover';
    this.input.releaseLock();
    this.scene.add(this.camera);
    this.weapon.model.visible = false;
    this.ui.setHudVisible(false);
    this.ui.showScreen('gameover');
  }

  /** كاميرا سينمائية تدور حول الواحة في القوائم */
  menuCamera() {
    const a = this.time * 0.07;
    this.camera.position.set(Math.sin(a) * 27, 11, Math.cos(a) * 27);
    this.camera.lookAt(0, 1.5, 0);
  }

  tick() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.time += dt;

    this.arena.update(dt, this.time);

    if (this.state === 'playing') {
      this.player.update(dt);
      this.weapon.update(dt);
      this.ducks.update(dt);
      this.projectiles.update(dt);
      this.pickups.update(dt);
    } else if (this.state === 'menu' || this.state === 'gameover') {
      this.menuCamera();
    }
    this.particles.update(dt);

    this.renderer.render(this.scene, this.camera);
  }
}

window.__battah = new Game();
