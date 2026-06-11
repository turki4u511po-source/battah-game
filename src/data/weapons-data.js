// جدول توازن الأسلحة السبعة — إلزامي حسب القسم 5 من المواصفات.
// rpm → فاصل الإطلاق، الضرر الأساسي قبل مضاعفات الرأس/المدى.

export const WEAPONS = {
  alnimr: {
    id: 'alnimr',
    name: 'النمر',
    kind: 'رشاش متوازن',
    desc: 'الخيار الآمن: أربع طلقات تنهي الموضوع، وما يخونك في أي مدى.',
    auto: true,
    damage: 26,
    rpm: 700,
    mag: 30,
    reserve: 90,
    reloadTime: 2.2,
    rangeMax: 45,           // بعده يبدأ الـ falloff
    falloffEnd: 75,
    falloffMin: 0.6,        // أدنى نسبة ضرر بعد نهاية الـ falloff
    headMult: 1.5,
    pellets: 1,
    adsTime: 0.22,
    adsZoom: 0.82,          // مضاعف FOV
    recoil: { v: 0.0105, h: 0.0042, recover: 9 },
    spread: { base: 1.4, ads: 0.12, move: 1.4, crouch: 0.7 }, // درجات
    moveMult: 1,
    icon: 'AR',
  },

  theeb: {
    id: 'theeb',
    name: 'ذيب',
    kind: 'رشاش ثقيل',
    desc: 'عضّة ذيب ما تحتاج غير ثلاث: ضرر ثقيل لمن يتحمّل ارتداده.',
    auto: true,
    damage: 34,
    rpm: 540,
    mag: 25,
    reserve: 75,
    reloadTime: 2.4,
    rangeMax: 55,
    falloffEnd: 85,
    falloffMin: 0.6,
    headMult: 1.5,
    pellets: 1,
    adsTime: 0.26,
    adsZoom: 0.8,
    recoil: { v: 0.017, h: 0.007, recover: 8 },
    spread: { base: 1.7, ads: 0.15, move: 1.6, crouch: 0.7 },
    moveMult: 1,
    icon: 'LMG',
  },

  saqr: {
    id: 'saqr',
    name: 'عين الصقر',
    kind: 'سنايبر',
    desc: 'نظرة وحدة تكفي: سكوب 6x، وصدر العدو أو راسه… قصة منتهية.',
    auto: false,
    bolt: true,
    damage: 95,
    fireInterval: 1.3,
    mag: 5,
    reserve: 15,
    reloadTime: 3.0,
    rangeMax: 999,          // بدون falloff
    falloffEnd: 999,
    falloffMin: 1,
    headMult: 2.5,
    chestMult: 2.5,         // قتل فوري بالصدر أيضًا
    pellets: 1,
    adsTime: 0.38,
    adsZoom: 1 / 6,         // سكوب 6x
    scope: true,            // شاشة سكوب كاملة + sway
    swayAmp: 0.0024,
    recoil: { v: 0.045, h: 0.012, recover: 5 },
    spread: { base: 5.0, ads: 0.02, move: 3.0, crouch: 0.8 }, // hip-fire عقاب
    moveMult: 0.85,
    icon: 'SR',
  },

  umhasa: {
    id: 'umhasa',
    name: 'أم حصا',
    kind: 'شوزن مضخة',
    desc: 'تحت ثمانية أمتار ما في نقاش: رشّة حصا وخلاص.',
    auto: false,
    pump: true,
    damage: 12,             // لكل خرزة
    pellets: 8,
    fireInterval: 0.7,
    mag: 6,
    reserve: 18,
    reloadTime: 0.55,       // لكل طلقة (تعبئة طلقة-طلقة قابلة للقطع)
    shellByShell: true,
    rangeMax: 8,            // مدمّر تحته
    falloffEnd: 18,         // شبه عديم الفائدة بعده
    falloffMin: 0.12,
    headMult: 1,            // بدون مضاعف رأس
    adsTime: 0.24,
    adsZoom: 0.88,
    recoil: { v: 0.05, h: 0.012, recover: 7 },
    spread: { base: 6.5, ads: 5.0, move: 1.5, crouch: 0.85 }, // انتشار واسع دائمًا
    moveMult: 1,
    icon: 'SG',
  },

  zarzoor: {
    id: 'zarzoor',
    name: 'زرزور',
    kind: 'SMG',
    desc: 'زرزور ما يهدا: رشّ سريع خفيف يفترس القريب ويعفّس البعيد.',
    auto: true,
    damage: 20,
    rpm: 950,
    mag: 32,
    reserve: 96,
    reloadTime: 1.8,
    rangeMax: 20,
    falloffEnd: 38,
    falloffMin: 0.35,       // falloff قوي
    headMult: 1.5,
    pellets: 1,
    adsTime: 0.16,
    adsZoom: 0.88,
    recoil: { v: 0.009, h: 0.006, recover: 11 },
    spread: { base: 1.6, ads: 0.25, move: 1.0, crouch: 0.8 },
    moveMult: 1.1,          // +10% سرعة حركة
    icon: 'SMG',
  },

  shadgan: {
    id: 'shadgan',
    name: 'شدقن (أم خمس)',
    kind: 'بندقية قديمة',
    desc: 'طقّتها تدوّي بالحارة: خمس رصاصات من زمن أول، والراس قتل فوري.',
    auto: false,
    bolt: true,
    damage: 65,
    fireInterval: 1.1,
    mag: 5,
    reserve: 20,
    reloadTime: 2.8,
    rangeMax: 70,
    falloffEnd: 110,
    falloffMin: 0.75,
    headMult: 1.6,          // 104 = قتل فوري
    pellets: 1,
    adsTime: 0.3,
    adsZoom: 0.7,           // مناظير حديد فقط — بدون سكوب
    ironSights: true,
    recoil: { v: 0.034, h: 0.01, recover: 6 },
    spread: { base: 3.2, ads: 0.05, move: 2.2, crouch: 0.8 },
    moveMult: 1,
    echo: true,             // «طقّة» بصدى أقوى
    icon: 'BR',
  },

  nial: {
    id: 'nial',
    name: 'النعال',
    kind: 'سلاح قريب',
    desc: 'سلاح الردع الشعبي: من قدّام توجع، ومن وراء… الله يرحمه.',
    melee: true,
    damage: 55,             // الضربة الأمامية
    fireInterval: 0.5,
    range: 1.8,
    backstabArc: 120,       // قوس خلفي بالدرجات = قتل فوري
    mag: Infinity,
    reserve: Infinity,
    reloadTime: 0,
    headMult: 1,
    adsTime: 0,
    adsZoom: 1,
    spread: { base: 0, ads: 0, move: 0, crouch: 0 },
    recoil: { v: 0, h: 0, recover: 10 },
    moveMult: 1.15,         // +15% سرعة عند حمله
    icon: '🥿',
  },
};

export const PRIMARY_IDS = ['alnimr', 'theeb', 'saqr', 'umhasa', 'zarzoor', 'shadgan'];
export const ALL_IDS = [...PRIMARY_IDS, 'nial'];

/** فاصل الإطلاق بالثواني */
export function fireInterval(w) {
  return w.fireInterval ?? 60 / w.rpm;
}

/** نسبة الضرر حسب المسافة (falloff) */
export function damageFalloff(w, dist) {
  if (dist <= w.rangeMax) return 1;
  if (dist >= w.falloffEnd) return w.falloffMin;
  const t = (dist - w.rangeMax) / (w.falloffEnd - w.rangeMax);
  return 1 + (w.falloffMin - 1) * t;
}
