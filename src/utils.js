// أدوات مساعدة عامة — دوال نقية بلا حالة.

export const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);

export const lerp = (a, b, t) => a + (b - a) * t;

// تخميد أُسّي مستقل عن معدل الإطارات
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));

export const rand = (min, max) => min + Math.random() * (max - min);

export const randInt = (min, max) => Math.floor(rand(min, max + 1));

export const choose = (arr) => arr[(Math.random() * arr.length) | 0];

// اختيار عنصر بحسب وزنه من قائمة [{w, v}]
export function weightedChoose(items) {
  let total = 0;
  for (const it of items) total += it.w;
  let r = Math.random() * total;
  for (const it of items) {
    r -= it.w;
    if (r <= 0) return it.v;
  }
  return items[items.length - 1].v;
}

/**
 * تصادم دائرة (لاعب/بطة) مع قائمة عوائق على المستوى الأفقي + حدود الساحة.
 * obstacles: {kind:'box', minX,maxX,minZ,maxZ} أو {kind:'circle', x,z,r}
 * يعيد الموضع المُصحَّح {x, z}.
 */
export function collideCircle(x, z, r, obstacles, half) {
  // حدود السور
  x = clamp(x, -half, half);
  z = clamp(z, -half, half);

  for (const ob of obstacles) {
    if (ob.kind === 'box') {
      const cx = clamp(x, ob.minX, ob.maxX);
      const cz = clamp(z, ob.minZ, ob.maxZ);
      let dx = x - cx;
      let dz = z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2);
          x = cx + (dx / d) * r;
          z = cz + (dz / d) * r;
        } else {
          // المركز داخل الصندوق: ادفع نحو أقرب حافة
          const left = Math.abs(x - ob.minX), right = Math.abs(ob.maxX - x);
          const near = Math.abs(z - ob.minZ), far = Math.abs(ob.maxZ - z);
          const m = Math.min(left, right, near, far);
          if (m === left) x = ob.minX - r;
          else if (m === right) x = ob.maxX + r;
          else if (m === near) z = ob.minZ - r;
          else z = ob.maxZ + r;
        }
      }
    } else {
      let dx = x - ob.x;
      let dz = z - ob.z;
      const minD = r + ob.r;
      const d2 = dx * dx + dz * dz;
      if (d2 < minD * minD) {
        const d = Math.sqrt(d2) || 1e-4;
        x = ob.x + (dx / d) * minD;
        z = ob.z + (dz / d) * minD;
      }
    }
  }
  return { x, z };
}

/** زاوية لف (yaw) نحو هدف مع التفاف صحيح حول ±π */
export function turnToward(current, target, maxDelta) {
  let diff = target - current;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return current + clamp(diff, -maxDelta, maxDelta);
}

/** تنسيق الأرقام للعرض (أرقام لاتينية ضمن نص عربي — أوضح للقراءة) */
export const fmt = (n) => Math.round(n).toLocaleString('en-US');
