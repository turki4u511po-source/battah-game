// «بطه» — نقطة الدخول: المُصيّر، حلقة اللعبة، وآلة الحالات.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { Arena } from './arena.js';
import { UI } from './ui.js';

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

    this.arena = new Arena(this.scene);
    this.ui = new UI(this);

    window.addEventListener('resize', () => this.onResize());

    this.ui.showScreen('menu');
    this.renderer.setAnimationLoop(() => this.tick());
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
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

    if (this.state === 'menu' || this.state === 'gameover') {
      this.menuCamera();
    }

    this.renderer.render(this.scene, this.camera);
  }
}

window.__battah = new Game();
