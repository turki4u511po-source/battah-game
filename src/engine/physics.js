// الفيزياء: كبسولة اللاعب/البوت ضد عالم الماب.
// تمثيل العالم (يوفره كل ماب):
//   groundHeight(x, z) → ارتفاع الأرض القابلة للمشي (تضاريس + أسطح صلبة)
//   solids: [{min:Vector3-like, max}] صناديق AABB صادّة (سيارات/جدران/صناديق…)
//   bounds: {minX, maxX, minZ, maxZ}
// قاعدة الدرجة: فرق ارتفاع ≤ STEP_HEIGHT يُصعَد مشيًا، الأعلى منه جدار.

import { clamp } from './utils.js';

export const STEP_HEIGHT = 0.55;
export const GRAVITY = 22;

/**
 * حركة أفقية مع انزلاق على جدران الـ heightfield:
 * يحاول الإزاحة كاملة، ثم كل محور على حدة عند الانسداد.
 */
export function stepMove(map, fromX, fromZ, toX, toZ, feetY) {
  const max = feetY + STEP_HEIGHT;
  if (map.groundHeight(toX, toZ) <= max) return { x: toX, z: toZ };
  if (map.groundHeight(toX, fromZ) <= max) return { x: toX, z: fromZ };
  if (map.groundHeight(fromX, toZ) <= max) return { x: fromX, z: toZ };
  return { x: fromX, z: fromZ };
}

/** دفع دائرة الكبسولة خارج صناديق AABB (مع تجاهل ما نقف فوقه أو ما هو فوق الرأس) */
export function resolveSolids(map, x, z, feetY, capHeight, radius) {
  for (const s of map.solids) {
    if (feetY >= s.max.y - 0.12) continue;       // واقف فوقه
    if (s.min.y >= feetY + capHeight) continue;  // فوق الرأس
    const cx = clamp(x, s.min.x, s.max.x);
    const cz = clamp(z, s.min.z, s.max.z);
    const dx = x - cx;
    const dz = z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        x = cx + (dx / d) * radius;
        z = cz + (dz / d) * radius;
      } else {
        const pushL = Math.abs(x - s.min.x);
        const pushR = Math.abs(s.max.x - x);
        const pushN = Math.abs(z - s.min.z);
        const pushF = Math.abs(s.max.z - z);
        const m = Math.min(pushL, pushR, pushN, pushF);
        if (m === pushL) x = s.min.x - radius;
        else if (m === pushR) x = s.max.x + radius;
        else if (m === pushN) z = s.min.z - radius;
        else z = s.max.z + radius;
      }
    }
  }
  const b = map.bounds;
  x = clamp(x, b.minX, b.maxX);
  z = clamp(z, b.minZ, b.maxZ);
  return { x, z };
}

/** تقاطع شعاع مع AABB (slab test) — يعيد المسافة أو null */
export function rayAABB(ox, oy, oz, dx, dy, dz, min, max) {
  let tmin = 0;
  let tmax = Infinity;
  // X
  if (Math.abs(dx) < 1e-9) {
    if (ox < min.x || ox > max.x) return null;
  } else {
    let t1 = (min.x - ox) / dx;
    let t2 = (max.x - ox) / dx;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }
  // Y
  if (Math.abs(dy) < 1e-9) {
    if (oy < min.y || oy > max.y) return null;
  } else {
    let t1 = (min.y - oy) / dy;
    let t2 = (max.y - oy) / dy;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }
  // Z
  if (Math.abs(dz) < 1e-9) {
    if (oz < min.z || oz > max.z) return null;
  } else {
    let t1 = (min.z - oz) / dz;
    let t2 = (max.z - oz) / dz;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }
  return tmin;
}

/**
 * شعاع ضد هندسة الماب (صناديق + heightfield بمسح تدريجي).
 * يعيد المسافة أو null. تُستخدم للرصاص وخط نظر البوتات.
 */
export function raycastWorld(map, origin, dir, maxDist) {
  let best = null;

  for (const s of map.solids) {
    const t = rayAABB(origin.x, origin.y, origin.z, dir.x, dir.y, dir.z, s.min, s.max);
    if (t !== null && t <= maxDist && (best === null || t < best)) best = t;
  }

  // مسح الـ heightfield (يشمل المباني والتلال)
  const step = 1.0;
  const limit = best === null ? maxDist : best;
  let px = origin.x;
  let py = origin.y;
  let pz = origin.z;
  let prevAbove = py > map.groundHeight(px, pz);
  for (let t = step; t <= limit + step; t += step) {
    const tt = Math.min(t, limit);
    px = origin.x + dir.x * tt;
    py = origin.y + dir.y * tt;
    pz = origin.z + dir.z * tt;
    const g = map.groundHeight(px, pz);
    const above = py > g;
    if (prevAbove && !above) {
      // اخترقنا السطح بين tt-step و tt — تنصيف للدقة
      let lo = tt - step;
      let hi = tt;
      for (let i = 0; i < 7; i++) {
        const mid = (lo + hi) / 2;
        const my = origin.y + dir.y * mid;
        const mg = map.groundHeight(origin.x + dir.x * mid, origin.z + dir.z * mid);
        if (my > mg) lo = mid;
        else hi = mid;
      }
      const hit = (lo + hi) / 2;
      if (hit <= limit && (best === null || hit < best)) best = hit;
      break;
    }
    prevAbove = above;
    if (tt >= limit) break;
  }

  return best !== null && best <= maxDist ? best : null;
}

/** هل خط النظر سالك بين نقطتين؟ */
export function losClear(map, ax, ay, az, bx, by, bz) {
  const dx = bx - ax;
  const dy = by - ay;
  const dz = bz - az;
  const d = Math.hypot(dx, dy, dz);
  if (d < 0.001) return true;
  const inv = 1 / d;
  const hit = raycastWorld(
    map,
    { x: ax, y: ay, z: az },
    { x: dx * inv, y: dy * inv, z: dz * inv },
    d - 0.15,
  );
  return hit === null;
}

/** تقاطع شعاع/كرة — للرصاص ضد أجزاء الجسم */
export function raySphere(origin, dir, cx, cy, cz, r) {
  const ox = cx - origin.x;
  const oy = cy - origin.y;
  const oz = cz - origin.z;
  const tca = ox * dir.x + oy * dir.y + oz * dir.z;
  if (tca < 0) return null;
  const d2 = ox * ox + oy * oy + oz * oz - tca * tca;
  const r2 = r * r;
  if (d2 > r2) return null;
  return Math.max(0, tca - Math.sqrt(r2 - d2));
}

/** تقاطع شعاع مع كبسولة عمودية مبسطة (سلسلة كرات) — كافٍ للقتال */
export function rayCapsule(origin, dir, x, feetY, z, height, radius) {
  let best = null;
  const n = 4;
  for (let i = 0; i <= n; i++) {
    const y = feetY + radius + (height - radius * 2) * (i / n);
    const t = raySphere(origin, dir, x, y, z, radius);
    if (t !== null && (best === null || t < best)) best = t;
  }
  return best;
}
