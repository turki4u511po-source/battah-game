// «بطه» — كل قيم الموازنة والألوان في مكان واحد.

export const CONFIG = {
  arena: {
    size: 84,          // طول ضلع الساحة
    wallHeight: 4.5,
    margin: 1.4,       // أقرب مسافة يصلها اللاعب من السور
  },

  player: {
    eyeHeight: 1.7,
    radius: 0.55,
    walkSpeed: 6.2,
    sprintSpeed: 9.5,
    accel: 62,
    damping: 11,
    jumpSpeed: 8.6,
    gravity: 25,
    maxHealth: 100,
    regenDelay: 6,     // ثوانٍ بلا ضرر قبل بدء التجدد
    regenRate: 6,      // صحة في الثانية
  },

  weapon: {
    damage: 25,
    headshotMult: 2,
    magSize: 12,
    reloadTime: 1.15,
    fireInterval: 0.16,
    range: 130,
    kickPitch: 0.016,  // ارتداد الكاميرا لكل طلقة
  },

  ducks: {
    poolSize: 34,
    maxAlive: 26,
    separationRadius: 1.5,
    quackIntervalMin: 3,
    quackIntervalMax: 9,
    heartDropChance: 0.1,
    heartDropChanceLowHp: 0.25, // عندما تكون صحة اللاعب أقل من 40
  },

  waves: {
    breakTime: 5,      // استراحة بين الموجات
    firstDelay: 3,     // قبل الموجة الأولى
    baseCount: 6,
    perWave: 2,
    maxCount: 30,
    bossEvery: 5,
    clearHeal: 15,
    clearBonusPerWave: 50,
    spawnIntervalMin: 0.7,
    spawnIntervalMax: 1.4,
  },

  score: {
    comboWindow: 2.5,  // ثوانٍ بين القتلات لاستمرار السلسلة
    comboStep: 0.25,   // زيادة المضاعف لكل قتلة في السلسلة
    comboMax: 4,
  },

  colors: {
    sky: 0x7ec8f7,
    horizon: 0xf2d9a8,
    fog: 0xf2d9a8,
    sand1: '#e3c07f',
    sand2: '#d2a85f',
    wall: 0xcfa86b,
    wood: '#9a6b3a',
    palmTrunk: 0x8a5a33,
    palmLeaf: 0x3e8f3e,
    water: 0x3aa7d9,
    rock: 0x9b8a72,
  },

  storage: {
    highScore: 'battah.highscore',
    settings: 'battah.settings',
  },
};
