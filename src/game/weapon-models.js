// نماذج الأسلحة السبعة low-poly — صور ظلية مميزة لكل سلاح (القسم 3).
// الاتجاه: الفوهة نحو -Z (اصطلاح نموذج اليد في FPS).

import * as THREE from 'three';

const M = {};
function mats() {
  if (M.metal) return M;
  M.metal = new THREE.MeshLambertMaterial({ color: 0x3d4750 });
  M.metalDark = new THREE.MeshLambertMaterial({ color: 0x262e36 });
  M.metalLight = new THREE.MeshLambertMaterial({ color: 0x5a6670 });
  M.wood = new THREE.MeshLambertMaterial({ color: 0x7a5230 });
  M.woodDark = new THREE.MeshLambertMaterial({ color: 0x5c3c20 });
  M.tan = new THREE.MeshLambertMaterial({ color: 0x9c8a64 });
  M.gold = new THREE.MeshLambertMaterial({ color: 0xc9952a });
  M.glass = new THREE.MeshLambertMaterial({ color: 0x77c8e8, emissive: 0x224a5c, emissiveIntensity: 0.5 });
  M.slipper = new THREE.MeshLambertMaterial({ color: 0xc89858 });
  M.slipperSole = new THREE.MeshLambertMaterial({ color: 0x8a6438 });
  M.strap = new THREE.MeshLambertMaterial({ color: 0x6e4a26 });
  return M;
}

function box(g, w, h, d, mat, x, y, z, ry = 0, rz = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.rotation.y = ry;
  m.rotation.z = rz;
  g.add(m);
  return m;
}

function cyl(g, r1, r2, h, mat, x, y, z, rx = Math.PI / 2) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, 10), mat);
  m.position.set(x, y, z);
  m.rotation.x = rx;
  g.add(m);
  return m;
}

/** يبني نموذج سلاح، ويعيد {group, muzzle} — muzzle نقطة خروج الأثر */
export function buildWeaponModel(id) {
  const m = mats();
  const g = new THREE.Group();
  let muzzleZ = -0.5;

  switch (id) {
    case 'alnimr': { // رشاش متوازن — بندقية كلاسيكية بمخزن مائل
      box(g, 0.07, 0.1, 0.46, m.metal, 0, 0, -0.05);
      box(g, 0.06, 0.07, 0.2, m.tan, 0, -0.01, 0.27);            // أخمص
      cyl(g, 0.022, 0.022, 0.3, m.metalDark, 0, 0.01, -0.4);     // ماسورة
      box(g, 0.05, 0.16, 0.07, m.metalDark, 0, -0.11, 0.02, 0, 0.3); // مخزن مائل
      box(g, 0.05, 0.09, 0.06, m.metal, 0, -0.085, 0.14);        // قبضة
      box(g, 0.05, 0.06, 0.12, m.tan, 0, -0.012, -0.25);         // واقية يد
      box(g, 0.016, 0.045, 0.02, m.metalDark, 0, 0.07, -0.32);   // شعيرة أمامية
      box(g, 0.04, 0.035, 0.04, m.metalDark, 0, 0.065, 0.08);    // قبة خلفية
      muzzleZ = -0.56;
      break;
    }
    case 'theeb': { // رشاش ثقيل — جسم أضخم بمخزن أسطواني
      box(g, 0.085, 0.12, 0.5, m.metalDark, 0, 0, -0.04);
      box(g, 0.07, 0.085, 0.18, m.metal, 0, -0.005, 0.28);
      cyl(g, 0.028, 0.028, 0.34, m.metal, 0, 0.015, -0.44);
      cyl(g, 0.075, 0.075, 0.06, m.metalLight, 0, -0.1, 0.03, 0); // درام أسطواني
      box(g, 0.05, 0.1, 0.06, m.metal, 0, -0.095, 0.16);
      box(g, 0.06, 0.05, 0.16, m.metalLight, 0, -0.045, -0.26);
      box(g, 0.016, 0.05, 0.02, m.metalDark, 0, 0.085, -0.42);
      muzzleZ = -0.62;
      break;
    }
    case 'saqr': { // سنايبر — ماسورة طويلة وسكوب
      box(g, 0.06, 0.09, 0.5, m.metal, 0, 0, 0.05);
      box(g, 0.055, 0.1, 0.22, m.metalDark, 0, -0.005, 0.32);    // أخمص بخدّ مرتفع
      box(g, 0.05, 0.045, 0.1, m.metalDark, 0, 0.07, 0.28);
      cyl(g, 0.02, 0.02, 0.55, m.metalDark, 0, 0.012, -0.45);
      cyl(g, 0.045, 0.045, 0.2, m.metalDark, 0, 0.085, -0.02, Math.PI / 2); // سكوب
      cyl(g, 0.052, 0.052, 0.02, m.glass, 0, 0.085, -0.125, Math.PI / 2);
      box(g, 0.05, 0.09, 0.06, m.metal, 0, -0.085, 0.14);
      cyl(g, 0.012, 0.012, 0.14, m.metalDark, -0.04, -0.06, -0.5, 0); // قائمة bipod
      cyl(g, 0.012, 0.012, 0.14, m.metalDark, 0.04, -0.06, -0.5, 0);
      muzzleZ = -0.74;
      break;
    }
    case 'umhasa': { // شوزن مضخة — ماسورة عريضة ومضخة
      box(g, 0.07, 0.1, 0.3, m.wood, 0, -0.005, 0.22);           // أخمص خشبي
      box(g, 0.07, 0.09, 0.26, m.metalDark, 0, 0.005, -0.04);
      cyl(g, 0.034, 0.034, 0.4, m.metalDark, 0, 0.025, -0.32);   // ماسورة عريضة
      cyl(g, 0.026, 0.026, 0.36, m.metal, 0, -0.025, -0.3);      // أنبوب خراطيش
      box(g, 0.075, 0.055, 0.14, m.wood, 0, -0.03, -0.3);        // مضخة
      box(g, 0.05, 0.08, 0.06, m.wood, 0, -0.09, 0.1);
      muzzleZ = -0.54;
      break;
    }
    case 'zarzoor': { // SMG — مدمج بكاتم رفيع ومخزن بالقبضة
      box(g, 0.06, 0.09, 0.26, m.metal, 0, 0, -0.02);
      cyl(g, 0.024, 0.024, 0.2, m.metalDark, 0, 0.01, -0.24);    // كاتم رفيع
      box(g, 0.05, 0.14, 0.055, m.metalDark, 0, -0.1, 0.05, 0, 0.08); // مخزن بالقبضة
      box(g, 0.018, 0.05, 0.16, m.metalLight, 0, 0.0, 0.2, 0, 0); // أخمص سلكي مطوي
      box(g, 0.05, 0.045, 0.1, m.metalLight, 0, -0.035, -0.1);
      muzzleZ = -0.36;
      break;
    }
    case 'shadgan': { // بندقية قديمة — خشب طويل وترباس
      box(g, 0.06, 0.085, 0.62, m.wood, 0, -0.01, 0.0);          // جسم خشبي طويل
      box(g, 0.062, 0.09, 0.18, m.woodDark, 0, -0.005, 0.33);
      cyl(g, 0.016, 0.016, 0.4, m.metalDark, 0, 0.028, -0.46);
      box(g, 0.02, 0.02, 0.3, m.metal, 0, 0.04, -0.05);          // علبة الترباس
      cyl(g, 0.011, 0.011, 0.07, m.metal, 0.05, 0.045, 0.06, 0); // ذراع الترباس
      box(g, 0.014, 0.04, 0.016, m.metalDark, 0, 0.07, -0.6);    // شعيرة حديد
      box(g, 0.034, 0.028, 0.02, m.metalDark, 0, 0.062, 0.1);
      cyl(g, 0.02, 0.02, 0.08, m.gold, 0, -0.04, -0.6);          // حلية فوهة
      muzzleZ = -0.66;
      break;
    }
    case 'nial':
    default: { // النعال 🥿 — نعل بسيرين
      const sole = box(g, 0.11, 0.025, 0.3, m.slipperSole, 0, 0, 0);
      sole.rotation.x = 0.06;
      box(g, 0.1, 0.018, 0.28, m.slipper, 0, 0.02, 0);
      const s1 = box(g, 0.018, 0.012, 0.16, m.strap, -0.028, 0.05, -0.04);
      s1.rotation.z = 0.7;
      s1.rotation.y = 0.25;
      const s2 = box(g, 0.018, 0.012, 0.16, m.strap, 0.028, 0.05, -0.04);
      s2.rotation.z = -0.7;
      s2.rotation.y = -0.25;
      muzzleZ = -0.2;
      break;
    }
  }

  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.015, muzzleZ);
  g.add(muzzle);
  return { group: g, muzzle };
}

/** نسخة لليد الثالثة (TPS/البوتات): نفس النموذج بمقياس مناسب لليدين */
export function buildHeldModel(id) {
  const { group } = buildWeaponModel(id);
  group.scale.setScalar(1.25);
  group.rotation.y = Math.PI; // الجندي يواجه +Z
  group.position.set(0, 0, 0.06);
  return group;
}
