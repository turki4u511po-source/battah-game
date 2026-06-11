// نموذج جندي بشري low-poly بزي عسكري مبسط — يُبنى من primitives فقط.
// أزرق للحلفاء وأحمر للأعداء (تمييز واضح من بعيد): خوذة + سترة + أكتاف بلون الفريق.

import * as THREE from 'three';

export const TEAM_COLORS = {
  blue: { main: 0x2f6fd4, light: 0x5b97f0, dark: 0x1f4c96 },
  red: { main: 0xd43b2f, light: 0xf06a5b, dark: 0x96231f },
};

const UNIFORM = 0x8a7d5e; // كاكي
const SKIN = 0xd8a47f;
const BOOTS = 0x3b332a;

// هندسات مشتركة بين كل الجنود
let G = null;
function geos() {
  if (G) return G;
  G = {
    torso: new THREE.BoxGeometry(0.42, 0.52, 0.24),
    vest: new THREE.BoxGeometry(0.46, 0.34, 0.3),
    hips: new THREE.BoxGeometry(0.38, 0.16, 0.22),
    head: new THREE.SphereGeometry(0.135, 12, 10),
    helmet: new THREE.SphereGeometry(0.16, 12, 8, 0, Math.PI * 2, 0, Math.PI / 1.9),
    upperArm: new THREE.BoxGeometry(0.11, 0.3, 0.11),
    foreArm: new THREE.BoxGeometry(0.1, 0.28, 0.1),
    shoulder: new THREE.BoxGeometry(0.14, 0.1, 0.14),
    thigh: new THREE.BoxGeometry(0.15, 0.4, 0.16),
    shin: new THREE.BoxGeometry(0.13, 0.36, 0.14),
    boot: new THREE.BoxGeometry(0.14, 0.09, 0.24),
  };
  return G;
}

/**
 * يبني جنديًا ويعيد مقابض التحريك. كل الخامات مستنسخة لكل جندي
 * (مطلوبة لتلاشي الجثة خلال ثانيتين).
 */
export function buildSoldier(team) {
  const g = geos();
  const tc = TEAM_COLORS[team];
  const mats = [];
  const mat = (color) => {
    const m = new THREE.MeshLambertMaterial({ color });
    mats.push(m);
    return m;
  };
  const uniformMat = mat(UNIFORM);
  const teamMat = mat(tc.main);
  const teamDarkMat = mat(tc.dark);
  const skinMat = mat(SKIN);
  const bootsMat = mat(BOOTS);

  const root = new THREE.Group();

  // الوركان — محور القرفصاء
  const hips = new THREE.Group();
  hips.position.y = 0.86;
  root.add(hips);

  const hipsMesh = new THREE.Mesh(g.hips, uniformMat);
  hips.add(hipsMesh);

  // الجذع — محور ميل التصويب
  const torso = new THREE.Group();
  torso.position.y = 0.08;
  hips.add(torso);

  const torsoMesh = new THREE.Mesh(g.torso, uniformMat);
  torsoMesh.position.y = 0.34;
  torsoMesh.castShadow = true;
  torso.add(torsoMesh);

  const vest = new THREE.Mesh(g.vest, teamMat);
  vest.position.y = 0.36;
  torso.add(vest);

  // الرأس + الخوذة
  const headG = new THREE.Group();
  headG.position.y = 0.72;
  torso.add(headG);
  const head = new THREE.Mesh(g.head, skinMat);
  head.castShadow = true;
  headG.add(head);
  const helmet = new THREE.Mesh(g.helmet, teamDarkMat);
  helmet.position.y = 0.045;
  helmet.scale.setScalar(1.05);
  headG.add(helmet);

  // الذراعان (محور عند الكتف)
  const mkArm = (side) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(0.27 * side, 0.58, 0);
    torso.add(shoulder);
    const pad = new THREE.Mesh(g.shoulder, teamMat);
    pad.position.y = 0.02;
    shoulder.add(pad);
    const upper = new THREE.Mesh(g.upperArm, uniformMat);
    upper.position.y = -0.17;
    shoulder.add(upper);
    const elbow = new THREE.Group();
    elbow.position.y = -0.32;
    shoulder.add(elbow);
    const fore = new THREE.Mesh(g.foreArm, skinMat);
    fore.position.y = -0.13;
    elbow.add(fore);
    return { shoulder, elbow };
  };
  const armR = mkArm(-1); // يمين الشخصية (سالب X محليًا مع مواجهة +Z)
  const armL = mkArm(1);

  // مرساة السلاح بيد اليمنى
  const weaponAnchor = new THREE.Group();
  weaponAnchor.position.set(-0.27, -0.42, 0.12);
  armR.shoulder.add(weaponAnchor);

  // الساقان (محور عند الورك)
  const mkLeg = (side) => {
    const hip = new THREE.Group();
    hip.position.set(0.11 * side, -0.06, 0);
    hips.add(hip);
    const thigh = new THREE.Mesh(g.thigh, uniformMat);
    thigh.position.y = -0.2;
    thigh.castShadow = true;
    hip.add(thigh);
    const knee = new THREE.Group();
    knee.position.y = -0.4;
    hip.add(knee);
    const shin = new THREE.Mesh(g.shin, uniformMat);
    shin.position.y = -0.18;
    knee.add(shin);
    const boot = new THREE.Mesh(g.boot, bootsMat);
    boot.position.set(0, -0.36, 0.04);
    knee.add(boot);
    return { hip, knee };
  };
  const legR = mkLeg(-1);
  const legL = mkLeg(1);

  return {
    root,
    hips,
    torso,
    headG,
    armL,
    armR,
    legL,
    legR,
    weaponAnchor,
    mats,
    setOpacity(o) {
      for (const m of mats) {
        m.transparent = o < 1;
        m.opacity = o;
        m.depthWrite = o >= 0.55;
      }
    },
  };
}

/** لافتة اسم فوق الرأس (للحلفاء فقط) — نص عربي عبر Canvas */
export function makeNameSprite(name) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext('2d');
  ctx.font = '600 34px "IBM Plex Sans Arabic", "Segoe UI", Tahoma, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.9)';
  ctx.shadowBlur = 6;
  ctx.fillStyle = '#9ec9ff';
  ctx.fillText(name, 128, 32);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex, transparent: true, depthWrite: false,
  }));
  sprite.scale.set(1.6, 0.4, 1);
  sprite.renderOrder = 5;
  return sprite;
}
