// أدوات مساعدة عامة — دوال نقية.

export const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export const rand = (min, max) => min + Math.random() * (max - min);
export const randInt = (min, max) => Math.floor(rand(min, max + 1));
export const choose = (arr) => arr[(Math.random() * arr.length) | 0];
export const deg2rad = (d) => (d * Math.PI) / 180;

export function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function turnToward(current, target, maxDelta) {
  return current + clamp(angleDiff(current, target), -maxDelta, maxDelta);
}

/** أرقام لاتينية ضمن النص العربي (أوضح للأرقام واللوحات) */
export const fmt = (n) => Math.round(n).toLocaleString('en-US');

/** تنسيق مؤقّت mm:ss */
export function fmtTime(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  const m = (s / 60) | 0;
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

/** FOV عمودي من FOV أفقي (الإعداد المعروض للاعب أفقي) */
export function verticalFov(horizontalDeg, aspect) {
  const h = deg2rad(horizontalDeg);
  return (2 * Math.atan(Math.tan(h / 2) / aspect) * 180) / Math.PI;
}
