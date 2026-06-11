// الماب 1 — اشبيليا (الرياض) | غروب 🌇 (القسم 8)
// حي سكني شرقي: شارع تجاري بمحلات عربية، حديقة حي مكشوفة بملعب
// أطفال، وصف فلل بأزقة خلفية ضيقة. أرض مستوية تمامًا 120×120.

import * as THREE from 'three';
import {
  MapBase, flatMat, skyDome, standardLights, kitMats,
  makeShop, makeAwning, makeVilla, compoundWall, makeCar, lamppost,
  makeDumpster, palmTree, sidrTree, playground, groundPatch, applyLamps,
} from './common.js';
import { rand } from '../engine/utils.js';

const SHOPS = [
  ['بقالة النور', '#1c6e3a'],
  ['مطعم بروست الحارة', '#a33b1e'],
  ['حلاق السديم', '#1c4f7a'],
  ['مغسلة الياسمين', '#3a7a6e'],
  ['اتصالات سريعة', '#5a2d82'],
  ['بهارات وأكثر', '#8a5a1e'],
  ['جوالات أبو متعب', '#22577a'],
  ['عصيرات جزيل', '#b8438a'],
];

export function makeIshbiliya(scene) {
  const map = new MapBase(scene, 120);
  map.id = 'ishbiliya';
  map.defaultSurface = 'asphalt';
  map.nightWindows = true; // الغروب — نوافذ مضيئة
  map.echo = 0.15;
  const m = kitMats();

  // ---------- السماء والإضاءة: غروب برتقالي→بنفسجي وشمس منخفضة ----------
  skyDome(scene, [
    [0, '#4a3a78'], [0.35, '#7a4a8a'], [0.62, '#c95f5a'],
    [0.78, '#f08a4a'], [0.92, '#f8b86a'], [1, '#f8c87a'],
  ]);
  scene.fog = new THREE.Fog(0xd98a6a, 80, 270);
  standardLights(scene, {
    hemiSky: 0xc9a0c0, hemiGround: 0x8a6a52, hemiInt: 0.75,
    sunColor: 0xff9a4a, sunInt: 1.15, sunPos: [-95, 22, 30], // شمس منخفضة = ظلال طويلة
    shadowArea: 75,
  });

  // ---------- الأرضية ----------
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(126, 126), flatMat(0xb8a384));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  map.group.add(ground);

  // ---------- الممر الأول: الشارع التجاري (غرب) ----------
  groundPatch(map, -36, 0, 11, 116, m.asphalt, 0.02);
  groundPatch(map, -43.5, 0, 3.4, 116, m.sidewalk, 0.04);
  groundPatch(map, -28.5, 0, 3.4, 116, m.sidewalk, 0.04);
  map.surface(-42, -58, -30, 58, 'asphalt');

  const westRow = [-42, -33, -13, -4, 14, 31, 40];
  westRow.forEach((z, i) => {
    const [name, bg] = SHOPS[i % SHOPS.length];
    makeShop(map, -48.5, z, Math.PI / 2, {
      name, signBg: bg, open: i % 3 === 0, w: 6.5, d: 5,
    });
    if (i % 2 === 0) makeAwning(map, -45.6, z, Math.PI / 2, 4.5, [m.awning1, m.awning2, m.awning3][i % 3]);
  });
  const eastRow = [-38, -29, -9, 0, 18, 35, 44];
  eastRow.forEach((z, i) => {
    const [name, bg] = SHOPS[(i + 4) % SHOPS.length];
    makeShop(map, -23.5, z, -Math.PI / 2, {
      name, signBg: bg, open: i % 3 === 1, w: 6.5, d: 5,
    });
  });

  // سيارات متوقفة (وانيتات وسيدانات) على الشارع
  makeCar(map, -32, -24, 0, 'pickup');
  makeCar(map, -40, -6, Math.PI, 'sedan');
  makeCar(map, -32, 10, 0, 'sedan');
  makeCar(map, -40, 28, Math.PI, 'pickup');
  makeCar(map, -32, 42, 0, 'pickup');

  // إنارة صوديوم دافئة بدأت تشتغل
  for (const z of [-40, -18, 4, 26, 46]) lamppost(map, -30.5, z, { lit: true });
  for (const z of [-30, -2, 36]) lamppost(map, -41.5, z, { lit: true });

  // ---------- الطريقان العرضيان ----------
  groundPatch(map, 0, 24, 116, 8, m.asphalt, 0.02);
  groundPatch(map, 0, -24, 116, 8, m.asphalt, 0.02);
  map.surface(-58, 20, 58, 28, 'asphalt');
  map.surface(-58, -28, 58, -20, 'asphalt');
  makeCar(map, -8, -24, Math.PI / 2, 'sedan');
  makeCar(map, 14, 24, Math.PI / 2, 'pickup');

  // ---------- الممر الأوسط: حديقة الحي ----------
  groundPatch(map, 0, 0, 28, 38, m.grass, 0.03);
  map.surface(-14, -19, 14, 19, 'dirt');
  // ممشى دائري
  const walkway = new THREE.Mesh(new THREE.RingGeometry(9.5, 12, 36), m.sidewalk);
  walkway.rotation.x = -Math.PI / 2;
  walkway.position.y = 0.05;
  walkway.receiveShadow = true;
  map.group.add(walkway);

  palmTree(map, -10, -14);
  palmTree(map, 10, -13);
  palmTree(map, -11, 12);
  palmTree(map, 11, 14);
  palmTree(map, 0, -17);
  sidrTree(map, -6, 6);
  sidrTree(map, 7, -5);
  sidrTree(map, -3, 16);
  playground(map, -2, 8);

  // مقاعد حول الممشى
  for (const a of [0.6, 2.2, 3.9, 5.5]) {
    const bx = Math.cos(a) * 10.7;
    const bz = Math.sin(a) * 10.7;
    map.box(1.6, 0.45, 0.5, m.woodOld, bx, 0, bz);
  }
  makeDumpster(map, 16, 18, 0.05);

  // ---------- الممر الثالث: الفلل والأزقة ----------
  // عمودان من المجمعات حول زقاق رأسي عند x=36
  const compounds = [
    [27, -38], [45, -38],
    [27, -8], [45, -8],
    [27, 36], [45, 36],
  ];
  compounds.forEach(([cx, cz], i) => {
    const w = 13;
    const d = 15;
    // أسوار بيج بارتفاع 2.5 وبوابة نحو الزقاق
    const gateEast = cx < 36;
    compoundWall(map, cx - w / 2, cz - d / 2, cx + w / 2, cz - d / 2, {});             // شمالي
    compoundWall(map, cx - w / 2, cz + d / 2, cx + w / 2, cz + d / 2, {});             // جنوبي
    compoundWall(map, cx - w / 2, cz - d / 2, cx - w / 2, cz + d / 2, gateEast ? {} : { gate: true });
    compoundWall(map, cx + w / 2, cz - d / 2, cx + w / 2, cz + d / 2, gateEast ? { gate: true } : {});
    makeVilla(map, cx, cz, { w: 9, d: 8, h: 6.5 });
    if (i % 2 === 0) makeDumpster(map, cx + (gateEast ? 8.2 : -8.2), cz + 4, 0);
  });
  map.surface(19, -58, 53, 58, 'stone'); // أزقة حجرية
  lamppost(map, 36, -22, { lit: true });
  lamppost(map, 36, 14, { lit: true });
  makeCar(map, 36, -47, 0, 'pickup');

  // ---------- نقاط الاستحواذ ----------
  map.domPoints = [
    { id: 'A', x: -36, z: 2 },
    { id: 'B', x: 0, z: 0 },
    { id: 'C', x: 36, z: 6 },
  ];

  // ---------- نقاط الظهور ----------
  map.spawns.blue = [-44, -36, -12, 0, 12, 36, 45].map((x) => ({ x, z: 53, yaw: Math.PI }));
  map.spawns.red = [-44, -36, -12, 0, 12, 36, 45].map((x) => ({ x, z: -53, yaw: 0 }));

  // ---------- waypoints ----------
  // الشارع التجاري
  for (let z = -48; z <= 48; z += 8) {
    map.wp(-36, z, { hot: Math.abs(z) < 10, cover: [-24, 10, 42].includes(z) });
  }
  map.wp(-31, -24, { cover: true }); // خلف سيارة
  map.wp(-41, -6, { cover: true });
  map.wp(-31, 42, { cover: true });
  map.wp(-46, -42, { cover: true }); // داخل محل مفتوح
  map.wp(-46, 14, { cover: true });
  // الحديقة
  map.wp(0, 0, { hot: true });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    map.wp(Math.cos(a) * 11, Math.sin(a) * 11, { cover: i % 3 === 0 });
  }
  map.wp(-1, 8, { cover: true }); // خلف الزحليقة
  map.wp(-18, 0, {});
  map.wp(17, 2, {});
  // الطريقان العرضيان
  for (const x of [-20, -8, 8, 20]) {
    map.wp(x, 24, {});
    map.wp(x, -24, {});
  }
  // أزقة الفلل
  for (let z = -46; z <= 46; z += 8) {
    map.wp(36, z, { hot: Math.abs(z - 6) < 8, cover: [-14, 22].includes(z) });
  }
  map.wp(27, 2, { cover: true });
  map.wp(45, 2, { cover: true });
  map.wp(27, -26, { cover: true });
  map.wp(45, -26, { cover: true });
  map.wp(27, 22, {});
  map.wp(45, 22, {});
  map.wp(20, -24, {});
  map.wp(20, 24, {});
  // وصلات السباون
  for (const x of [-36, 0, 36]) {
    map.wp(x, 50, {});
    map.wp(x, -50, {});
  }

  map.bakeWaypoints(15);
  applyLamps(map, scene, 8);
  return map;
}
