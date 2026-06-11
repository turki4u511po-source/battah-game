// الماب 2 — حارة العوازم (عفيف) | ليل 🌙 (القسم 8)
// حارة شعبية على ضلع: ثلاثة مستويات ارتفاع بأزقة منحدرة ودرجات،
// بيوت طينية متلاصقة بأبواب ملونة، أسطح بدرج خارجي وسترات قصيرة
// يمكن القفز بين فجواتها (1.5–2م)، وساحة وسطية. 90×90 — جنة الشوزن.

import * as THREE from 'three';
import {
  MapBase, flatMat, skyDome, standardLights, kitMats,
  makeMudHouse, makeRock, crateStack, makeBarrel,
  groundPatch, applyLamps, buildTerrainMesh,
} from './common.js';

const T1 = 0;    // أسفل الضلع
const T2 = 2.6;  // الوسط
const T3 = 5.2;  // أعلى الحارة

export function makeAwazem(scene) {
  const map = new MapBase(scene, 90);
  map.id = 'awazem';
  map.defaultSurface = 'stone';
  map.nightWindows = true;
  map.echo = 0.42; // صدى الحارة — طقّة الشدقن تدوّي

  const m = kitMats();

  // ---------- سماء الليل: نجوم وقمر ----------
  skyDome(scene, [
    [0, '#060a18'], [0.45, '#0a1228'], [0.75, '#14203a'], [1, '#1c2c48'],
  ], { stars: 340, moon: { x: -150, y: 190, z: -240 } });
  scene.fog = new THREE.Fog(0x111c30, 48, 170);
  standardLights(scene, {
    hemiSky: 0x4a5e88, hemiGround: 0x262218, hemiInt: 0.7,
    sunColor: 0xc4d6f4, sunInt: 0.8, sunPos: [-60, 80, -95], // إضاءة قمرية باردة
    shadowArea: 60,
  });

  // ---------- التضاريس: ثلاثة مستويات ----------
  map.plateau(-45, -45, 45, -13, T3);
  map.plateau(-45, -13, 45, 17, T2);
  // المستوى الأدنى h=0 افتراضي

  // أزقة منحدرة تربط المستويات (3 لكل حد) — تبدأ من حافة المستوى تمامًا
  const rampsLow = [[-28, 1], [2, 1], [30, 1]];   // بين T2 (z=17) نزولًا إلى T1
  for (const [x] of rampsLow) {
    map.ramp(x - 2.2, 17, x + 2.2, 22.5, T2, T1, 'z');
    map.surface(x - 2.2, 17, x + 2.2, 22.5, 'dirt');
  }
  const rampsHigh = [[-30, 1], [-2, 1], [26, 1]]; // بين T3 (z=-13) نزولًا إلى T2
  for (const [x] of rampsHigh) {
    map.ramp(x - 2.2, -13, x + 2.2, -7.5, T3, T2, 'z');
    map.surface(x - 2.2, -13, x + 2.2, -7.5, 'dirt');
  }

  // ---------- الأرضية: تضاريس مُزاحة تُظهر المستويات والمنحدرات ----------
  const low = new THREE.Color(0x5e564a);
  const midc = new THREE.Color(0x6a6052);
  const high = new THREE.Color(0x776b5a);
  buildTerrainMesh(map, (c, x, z, h) => {
    if (h > T3 - 0.4) c.copy(high);
    else if (h > T2 - 0.4) c.copy(midc);
    else c.copy(low);
    const n = Math.sin(x * 0.8 + z * 0.6) * 0.03;
    c.offsetHSL(0, 0, n);
  }, 120);

  // ---------- البيوت ----------
  // المستوى الأدنى (مدخل الحارة)
  makeMudHouse(map, -34, 36, { w: 6, d: 5.5, base: T1, stairs: 'e', parapet: ['n', 'w', 's'], window: true });
  makeMudHouse(map, -26.6, 36, { w: 5, d: 5, base: T1, parapet: ['n', 'e', 's'] }); // فجوة قفز 1.6 مع الجار
  makeMudHouse(map, -12, 39, { w: 6, d: 5, base: T1, dark: true, window: true });
  makeMudHouse(map, 12, 38, { w: 5.5, d: 5.5, base: T1, stairs: 'w', parapet: ['n', 'e'], window: true });
  makeMudHouse(map, 19, 38, { w: 5, d: 5, base: T1, parapet: ['n', 'w'] }); // فجوة 1.75
  makeMudHouse(map, 36, 34, { w: 6, d: 6, base: T1, dark: true });
  makeMudHouse(map, -38, 24, { w: 5, d: 5, base: T1, window: true });
  makeMudHouse(map, 38, 22, { w: 5, d: 5, base: T1 });

  // المستوى الأوسط — الأكثف (حول الساحة)
  makeMudHouse(map, -36, 6, { w: 6, d: 6, base: T2, stairs: 's', parapet: ['n', 'w'], window: true });
  makeMudHouse(map, -24, 2, { w: 5, d: 5, base: T2, dark: true });
  makeMudHouse(map, -14, 8, { w: 5.5, d: 5, base: T2, window: true });
  makeMudHouse(map, -6, -4, { w: 5, d: 5, base: T2, stairs: 'e', parapet: ['n', 'w', 's'] });
  makeMudHouse(map, 0.8, -4, { w: 5, d: 5, base: T2, parapet: ['n', 'e', 's'], window: true }); // قفز 1.8
  makeMudHouse(map, 20, 6, { w: 6, d: 5, base: T2, window: true });
  makeMudHouse(map, 30, -2, { w: 5, d: 6, base: T2, dark: true });
  makeMudHouse(map, 38, 8, { w: 5, d: 5, base: T2 });
  makeMudHouse(map, -34, -8, { w: 5, d: 4.5, base: T2, window: true });

  // المستوى الأعلى
  makeMudHouse(map, -30, -26, { w: 6, d: 5.5, base: T3, stairs: 'e', parapet: ['s', 'w'], window: true });
  makeMudHouse(map, -22.6, -26, { w: 5, d: 5, base: T3, parapet: ['s', 'e'] }); // قفز 1.7
  makeMudHouse(map, -8, -30, { w: 5.5, d: 5, base: T3, dark: true, window: true });
  makeMudHouse(map, 8, -24, { w: 5, d: 5, base: T3, stairs: 'w', parapet: ['n', 'e'] });
  makeMudHouse(map, 22, -30, { w: 6, d: 5, base: T3, window: true });
  makeMudHouse(map, 34, -24, { w: 5, d: 5, base: T3, dark: true });
  makeMudHouse(map, -38, -36, { w: 5, d: 5, base: T3 });

  // ---------- الساحة الوسطية (B) ----------
  groundPatch(map, 8, 4, 11, 9, flatMat(0x73685a), T2 + 0.04);
  // بئر الساحة
  const well = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.1, 1, 10), m.stone);
  well.position.set(8, T2 + 0.5, 7);
  well.castShadow = true;
  map.group.add(well);
  map.addSolid(7, T2, 6, 9, T2 + 1, 8);
  crateStack(map, 3.5, 1, 2);
  makeBarrel(map, 12.5, 1.5);

  // لمبات دافئة متفرقة على الجدران
  for (const [x, z] of [[8, 2], [-24, 5], [22, 3], [-30, -22], [12, 35], [-12, 36], [30, -27], [-2, -8]]) {
    map.lamps.push({ x, y: map.groundHeight(x, z) + 2.6, z, color: 0xffb86a });
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 6, 5),
      m.lampHead,
    );
    bulb.position.set(x, map.groundHeight(x, z) + 2.6, z);
    map.group.add(bulb);
  }

  // صخور على الأطراف
  makeRock(map, -42, 42, 1.4, { dark: true });
  makeRock(map, 42, 40, 1.2, { dark: true });
  makeRock(map, -42, -42, 1.5, { dark: true });
  makeRock(map, 42, -42, 1.3, { dark: true });
  makeRock(map, 0, 43, 1.1, { dark: true });
  crateStack(map, -18, 22, 1);
  makeBarrel(map, 26, 20);
  crateStack(map, -2, -20, 2);

  // ---------- نقاط الاستحواذ ----------
  map.domPoints = [
    { id: 'A', x: -4, z: 32 },   // أسفل الضلع عند مدخل الحارة
    { id: 'B', x: 8, z: 4 },     // الساحة الوسطية
    { id: 'C', x: 2, z: -34 },   // أعلى الحارة
  ];

  // ---------- نقاط الظهور ----------
  // الأزرق أسفل الحارة، الأحمر أعلاها
  map.spawns.blue = [[-38, 41], [-20, 42], [0, 43], [24, 42], [40, 40], [-6, 38]]
    .map(([x, z]) => ({ x, z, yaw: Math.PI }));
  map.spawns.red = [[-34, -41], [-16, -40], [4, -41], [18, -40], [38, -40], [28, -38]]
    .map(([x, z]) => ({ x, z, yaw: 0 }));

  // ---------- waypoints ----------
  // أسفل
  for (const [x, z] of [
    [-34, 41], [-20, 40], [-4, 32], [10, 32], [26, 40], [38, 40],
    [-38, 30], [-20, 28], [-4, 24], [16, 28], [32, 26], [40, 28],
  ]) map.wp(x, z, { hot: Math.abs(x + 4) < 8 && Math.abs(z - 32) < 5, cover: z < 36 });
  // منحدرات T1↔T2
  for (const [x] of rampsLow) map.wp(x, 17, {});
  // الأوسط
  for (const [x, z] of [
    [-40, 2], [-30, 6], [-19, 6], [-10, 2], [-3, 8], [8, 4], [14, 0],
    [25, 4], [34, 4], [40, 0], [-28, -6], [12, -8], [24, -8], [-12, -8],
  ]) map.wp(x, z, { hot: Math.abs(x - 8) < 7 && Math.abs(z - 4) < 6, cover: true });
  // منحدرات T2↔T3
  for (const [x] of rampsHigh) map.wp(x, -13, {});
  // الأعلى
  for (const [x, z] of [
    [-36, -22], [-26, -20], [-14, -24], [-2, -28], [2, -34], [12, -28],
    [26, -22], [36, -30], [-30, -36], [-10, -38], [16, -38], [32, -38],
  ]) map.wp(x, z, { hot: Math.abs(x - 2) < 7 && Math.abs(z + 34) < 5, cover: z > -36 });
  // أسطح (تصلها البوتات عبر الدرج)
  map.wp(-34, 36, {});   // سطح بيت المدخل
  map.wp(-6, -4, {});    // سطح وسط
  map.wp(-30, -26, {});  // سطح علوي

  map.bakeWaypoints(13);
  applyLamps(map, scene, 8);
  return map;
}
