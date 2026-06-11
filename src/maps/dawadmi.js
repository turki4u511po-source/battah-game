// الماب 3 — الدوادمي | ظهيرة ☀️ (القسم 8)
// وسط البلد القديم: شارعا سوق متقاطعان بمحلات رولات حديد بعضها
// نصف مفتوح، مظلات قماش وصناديق بضاعة — تطل عليه تلال جرانيت
// قابلة للصعود بمسارات طبيعية (مواقع قنص) وبينهما أرض ترابية
// مكشوفة. الأوسع: 130×130.

import * as THREE from 'three';
import {
  MapBase, flatMat, skyDome, standardLights, kitMats,
  makeShop, makeAwning, makeRock, crateStack, makeBarrel, bush,
  groundPatch, makeCar, makeDumpster, buildTerrainMesh,
} from './common.js';
import { rand } from '../engine/utils.js';

const OLD_SHOPS = [
  ['قماش الديرة', '#5a4a3a'],
  ['عطارة أبو سالم', '#3a5a4a'],
  ['أواني البركة', '#4a3a5a'],
  ['ساعات الوقت', '#2a4a6a'],
  ['مفروشات الراحة', '#6a3a2a'],
  ['بشوت الأصايل', '#3a3a3a'],
  ['تمور المجد', '#7a5a1a'],
  ['حراج الدوادمي', '#4a5a2a'],
];

export function makeDawadmi(scene) {
  const map = new MapBase(scene, 130);
  map.id = 'dawadmi';
  map.defaultSurface = 'dirt';
  map.nightWindows = false;
  map.echo = 0.2;
  const m = kitMats();

  // ---------- ظهيرة قاسية: شمس عمودية وظلال قصيرة حادة ----------
  skyDome(scene, [
    [0, '#7ab0dd'], [0.5, '#a8cce8'], [0.8, '#d8dfd2'], [1, '#e8dcc0'],
  ]);
  scene.fog = new THREE.Fog(0xd8d2bc, 95, 330);
  standardLights(scene, {
    hemiSky: 0xcfe0f0, hemiGround: 0xb09a72, hemiInt: 1.05,
    sunColor: 0xfff6e0, sunInt: 1.7, sunPos: [10, 120, 6], // عمودية = ظلال قصيرة
    shadowArea: 80,
  });

  // ---------- التلال الصخرية (ضلعان: غرب وشرق) ----------
  map.hill(-52, -20, 19, 6.5);
  map.hill(-54, 8, 17, 7.2);
  map.hill(-48, 32, 15, 5.5);
  map.hill(52, -14, 18, 7);
  map.hill(50, 14, 16, 6.2);
  map.hill(46, 38, 13, 5);
  map.surface(-65, -45, -32, 50, 'stone');
  map.surface(30, -40, 65, 52, 'stone');

  // ---------- الأرضية: تضاريس مُزاحة — تراب يتحول جرانيت مع الارتفاع ----------
  const dirtC = new THREE.Color(0xc9ab78);
  const graniteC = new THREE.Color(0x55493d);
  buildTerrainMesh(map, (c, x, z, h) => {
    const t = Math.min(h / 4.5, 1);
    c.copy(dirtC).lerp(graniteC, t * t);
    // تنويع خفيف
    const n = Math.sin(x * 0.6 + z * 0.4) * 0.04;
    c.offsetHSL(0, 0, n);
  }, 110);
  // منحوتات الجرانيت البنية-السوداء
  const hillTops = [[-52, -20], [-54, 8], [-48, 32], [52, -14], [50, 14], [46, 38]];
  for (const [hx, hz] of hillTops) {
    makeRock(map, hx + rand(-3, 3), hz + rand(-3, 3), rand(1.6, 2.4), { dark: true });
    makeRock(map, hx + rand(-8, 8), hz + rand(-8, 8), rand(1, 1.6), { dark: true });
  }
  // صخور السفوح والغطاء السفلي
  for (const [x, z, r] of [
    [-34, -16, 1.5], [-30, 6, 1.2], [-36, 26, 1.4], [-28, -30, 1.1],
    [32, -22, 1.4], [28, 4, 1.3], [34, 24, 1.5], [26, 40, 1],
    [-20, 44, 1.2], [18, -44, 1.3],
  ]) makeRock(map, x, z, r, { dark: Math.random() < 0.5 });

  // ---------- السوق القديم: شارعان متقاطعان ----------
  groundPatch(map, 0, 0, 9, 88, flatMat(0x9a8f7c), 0.02);
  groundPatch(map, 0, 0, 88, 9, flatMat(0x9a8f7c), 0.03);
  map.surface(-5, -44, 5, 44, 'stone');
  map.surface(-44, -5, 44, 5, 'stone');

  // محلات الشارع الرأسي
  const vShops = [-34, -25, -16, 11, 20, 29];
  vShops.forEach((z, i) => {
    const [name, bg] = OLD_SHOPS[i % OLD_SHOPS.length];
    makeShop(map, -8.5, z, Math.PI / 2, {
      name, signBg: bg, old: true, rollup: true, rollupHalf: i % 3 === 0, w: 6.5, d: 5.5,
    });
    if (i % 2 === 1) makeAwning(map, -5.6, z, Math.PI / 2, 4.5, [m.awning1, m.fabric, m.awning3][i % 3]);
  });
  vShops.forEach((z, i) => {
    const [name, bg] = OLD_SHOPS[(i + 3) % OLD_SHOPS.length];
    makeShop(map, 8.5, z - 4, -Math.PI / 2, {
      name, signBg: bg, old: true, rollup: true, rollupHalf: i % 3 === 2, w: 6.5, d: 5.5,
    });
  });
  // محلات الشارع الأفقي
  const hShops = [-36, -27, -18, 14, 23, 32];
  hShops.forEach((x, i) => {
    const [name, bg] = OLD_SHOPS[(i + 5) % OLD_SHOPS.length];
    makeShop(map, x, -8.5, 0, {
      name, signBg: bg, old: true, rollup: true, rollupHalf: i % 3 === 1, w: 6.5, d: 5.5,
    });
    if (i % 2 === 0) makeAwning(map, x, -5.6, 0, 4.5, [m.fabric, m.awning2][i % 2]);
  });
  hShops.forEach((x, i) => {
    const [name, bg] = OLD_SHOPS[(i + 1) % OLD_SHOPS.length];
    makeShop(map, x - 3, 8.5, Math.PI, {
      name, signBg: bg, old: true, rollup: true, w: 6.5, d: 5.5,
    });
  });

  // بضائع السوق: صناديق وبراميل كغطاء
  crateStack(map, -3, -20, 2);
  crateStack(map, 4, 16, 2);
  crateStack(map, -16, 3, 1);
  crateStack(map, 22, -3, 2);
  makeBarrel(map, 3, -30);
  makeBarrel(map, -4, 26);
  makeBarrel(map, 30, 3);
  makeBarrel(map, -24, -3);
  makeDumpster(map, 12, 12, 0);
  makeCar(map, -14, 36, 0, 'pickup');
  makeCar(map, 16, -36, Math.PI, 'pickup');

  // ---------- المنطقة الترابية الفاصلة: شجيرات وحطام ----------
  for (const [x, z] of [
    [-24, 14], [-20, -12], [-26, 30], [-18, -34], [22, 18], [24, -16],
    [18, 34], [-44, -38], [42, -34], [-40, 44], [38, 46], [14, 44], [-14, -44],
  ]) bush(map, x + rand(-1, 1), z + rand(-1, 1));
  crateStack(map, -26, 8, 1);
  makeBarrel(map, 24, 26);

  // أسوار طينية قصيرة على الحدين الشمالي والجنوبي
  const mudWall = flatMat(0xb09468);
  for (const z of [-63, 63]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(132, 2.2, 1.4), mudWall);
    wall.position.set(0, 1.1, z);
    wall.receiveShadow = true;
    map.group.add(wall);
    map.addSolid(-66, 0, z - 0.7, 66, 2.2, z + 0.7);
  }

  // ---------- نقاط الاستحواذ ----------
  map.domPoints = [
    { id: 'A', x: 0, z: 0 },      // تقاطع السوق
    { id: 'B', x: -26, z: 8 },    // الساحة الترابية الفاصلة
    { id: 'C', x: 34, z: -6 },    // سفح التلال
  ];

  // ---------- نقاط الظهور ----------
  map.spawns.blue = [[-30, 56], [-12, 57], [0, 58], [14, 57], [30, 56], [44, 54]]
    .map(([x, z]) => ({ x, z, yaw: Math.PI }));
  map.spawns.red = [[-30, -56], [-12, -57], [0, -58], [14, -57], [30, -56], [-44, -54]]
    .map(([x, z]) => ({ x, z, yaw: 0 }));

  // ---------- waypoints ----------
  // الشارع الرأسي
  for (let z = -52; z <= 52; z += 8.5) {
    map.wp(0, z, { hot: Math.abs(z) < 8, cover: Math.abs(z) > 12 && Math.abs(z) < 36 });
  }
  // الشارع الأفقي
  for (let x = -40; x <= 40; x += 8.5) {
    if (Math.abs(x) < 4) continue;
    map.wp(x, 0, { hot: Math.abs(x) < 10, cover: Math.abs(x) > 10 && Math.abs(x) < 38 });
  }
  // داخل محلات نصف المفتوحة (غطاء)
  map.wp(-8, -34, { cover: true });
  map.wp(8, 16, { cover: true });
  map.wp(-27, -8, { cover: true });
  // الساحات الترابية
  for (const [x, z] of [
    [-26, 8], [-22, -18], [-24, 32], [-18, -38], [22, 20], [26, -12],
    [20, 38], [16, -40], [-16, 44], [34, -6], [-34, -26],
  ]) map.wp(x, z, { hot: (x === -26 && z === 8) || (x === 34 && z === -6), cover: true });
  // مسارات التلال وقممها (مواقع قنص)
  for (const [x, z] of [
    [-38, -20], [-48, -18], [-54, 6], [-44, 10], [-42, 30],
    [36, -14], [48, -12], [44, 16], [52, 12], [40, 36],
  ]) map.wp(x, z, { cover: true });
  // وصلات السباون
  for (const x of [-26, 0, 26]) {
    map.wp(x, 52, {});
    map.wp(x, -52, {});
  }

  map.bakeWaypoints(14);
  return map;
}
