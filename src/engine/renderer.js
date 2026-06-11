// المُصيّر: WebGL واحد لكل اللعبة + تطبيق جودة الجرافيكس (منخفض/متوسط/عالي).

import * as THREE from 'three';
import { verticalFov } from './utils.js';

export const QUALITY = {
  low: { shadows: false, shadowSize: 1024, pixelRatio: 1, particles: 0.5 },
  mid: { shadows: true, shadowSize: 1024, pixelRatio: 1.5, particles: 1 },
  high: { shadows: true, shadowSize: 2048, pixelRatio: 2, particles: 1 },
};

export class Renderer {
  constructor(canvas, settings) {
    this.canvas = canvas;
    this.settings = settings;

    this.gl = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.gl.shadowMap.type = THREE.PCFSoftShadowMap;
    this.gl.toneMapping = THREE.ACESFilmicToneMapping;
    this.gl.toneMappingExposure = 1.05;

    this.camera = new THREE.PerspectiveCamera(70, 1, 0.08, 600);
    this.baseFov = settings.fov; // أفقي — يُحوَّل لعمودي حسب الأبعاد
    this.fovMult = 1;            // مضاعف ADS

    this.applyQuality();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  get quality() {
    return QUALITY[this.settings.graphics] || QUALITY.mid;
  }

  applyQuality() {
    const q = this.quality;
    this.gl.shadowMap.enabled = q.shadows;
    this.gl.setPixelRatio(Math.min(window.devicePixelRatio, q.pixelRatio));
    this.gl.setSize(window.innerWidth, window.innerHeight);
    // إجبار إعادة تجميع المواد عند تبديل الظلال
    this.gl.shadowMap.needsUpdate = true;
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.gl.setSize(w, h);
    this.camera.aspect = w / h;
    this.updateFov();
  }

  setBaseFov(horizontalDeg) {
    this.baseFov = horizontalDeg;
    this.updateFov();
  }

  setFovMult(m) {
    this.fovMult = m;
    this.updateFov();
  }

  updateFov() {
    this.camera.fov = verticalFov(this.baseFov, this.camera.aspect) * this.fovMult;
    this.camera.updateProjectionMatrix();
  }

  render(scene) {
    this.gl.render(scene, this.camera);
  }
}
