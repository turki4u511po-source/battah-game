// كل نصوص الواجهة العربية في مكان واحد (القسم 9 من المواصفات).

export const STR = {
  gameTitle: 'بطه',
  gameSubtitle: 'شوتر سعودي 3D',
  loading: 'جارٍ التجهيز…',

  // القائمة الرئيسية
  play: 'العب',
  weapons: 'الأسلحة',
  maps: 'المابات',
  record: 'الريكورد',
  settings: 'الإعدادات',
  back: 'رجوع',

  // تدفق «العب»
  chooseMode: 'اختر النمط',
  chooseMap: 'اختر الماب',
  chooseDifficulty: 'صعوبة البوتات',
  chooseWeapon: 'اختر سلاحك',
  startMatch: 'ابدأ',
  randomMap: 'عشوائي 🎲',
  modeTdm: 'عدد قتلات',
  modeTdmDesc: 'أول فريق يوصل 30 قتلة يفوز — أو الأعلى بعد 10 دقائق.',
  modeDom: 'استحواذ',
  modeDomDesc: 'سيطروا على النقاط A·B·C — أول فريق يوصل 200 نقطة يفوز.',
  diffEasy: 'سهل',
  diffMid: 'وسط',
  diffHard: 'صعب',
  diffEasyDesc: 'بوتات مبتدئة تمشي بخطوط مستقيمة.',
  diffMidDesc: 'بوتات تستخدم الغطاء وتلقّم خلف الجدران.',
  diffHardDesc: 'بوتات شرسة تراوغ وتطارد وتتعاون.',

  // الأسلحة
  adopt: 'اعتمده',
  adopted: 'سلاحك الحالي ✓',
  statDamage: 'الضرر',
  statRate: 'معدل الإطلاق',
  statRange: 'المدى',
  statReload: 'سرعة التلقيم',
  bestHere: 'أفضل الأسلحة هنا:',

  // الريكورد
  recordTitle: 'الريكورد',
  totalKills: 'إجمالي القتلات',
  totalDeaths: 'الموتات',
  kd: 'K/D',
  matchesPlayed: 'عدد المباريات',
  winsLosses: 'انتصارات / خسائر',
  resetRecord: 'تصفير الريكورد',
  resetConfirm: 'متأكد؟ سيُمسح كل شيء!',
  resetYes: 'نعم، صفّره',
  resetNo: 'إلغاء',

  // الإعدادات
  mouseSens: 'حساسية الماوس',
  touchSens: 'حساسية اللمس',
  fov: 'زاوية الرؤية FOV',
  sfxVolume: 'صوت المؤثرات',
  musicVolume: 'صوت الموسيقى',
  graphics: 'جودة الجرافيكس',
  gfxLow: 'منخفض',
  gfxMid: 'متوسط',
  gfxHigh: 'عالي',
  defaultView: 'المنظور الافتراضي',
  viewFps: 'منظور أول FPS',
  viewTps: 'منظور ثالث TPS',
  restoreDefaults: 'استعادة الافتراضي',

  // أثناء اللعب
  pause: 'إيقاف مؤقت',
  resume: 'استئناف',
  endMatch: 'إنهاء الماتش',
  scoreboard: 'السكوربورد',
  you: 'أنت',
  teamBlue: 'الأزرق',
  teamRed: 'الأحمر',
  kills: 'قتلات',
  deaths: 'موتات',
  points: 'نقاط',
  respawnIn: 'تعود بعد',
  killedBy: 'قتلك',
  changeWeapon: 'تغيير السلاح',
  spawnProtected: 'حماية سباون',
  suddenDeath: '⚡ الموت المفاجئ — أول قتلة تحسم!',
  matchPoint: 'نقطة الحسم!',
  captured: 'تم الاستحواذ على',
  losing: 'تخسرون',
  capturing: 'جارٍ الاستحواذ…',
  contested: 'نقطة متنازع عليها!',

  // نهاية الماتش
  win: 'فزت! 🏆',
  lose: 'خسرت',
  draw: 'تعادل',
  replay: 'إعادة',
  mainMenu: 'القائمة الرئيسية',
  yourStats: 'إحصاءاتك',

  // الجوال
  rotateDevice: 'أدر جهازك — اللعبة تحتاج شاشة عرضية',
  fire: 'إطلاق',
  adsBtn: 'تصويب',
  jumpBtn: 'قفز',
  crouchBtn: 'انحناء',
  reloadBtn: 'تلقيم',
  slipperBtn: '🥿',
  switchViewBtn: 'منظور',

  // عام
  ok: 'تم',
  cancel: 'إلغاء',
  vs: 'ضد',
  meters: 'م',
};

export const MODE_NAMES = { tdm: STR.modeTdm, dom: STR.modeDom };

export const MAP_INFO = {
  ishbiliya: {
    name: 'اشبيليا (الرياض)',
    time: 'غروب 🌇',
    desc: 'حي سكني شرق الرياض: شارع تجاري، حديقة مكشوفة، وأزقة فلل ضيقة.',
    best: 'النمر · ذيب · الشدقن',
  },
  awazem: {
    name: 'حارة العوازم (عفيف)',
    time: 'ليل 🌙',
    desc: 'حارة شعبية على ضلع: أزقة متاهة، أسطح يُقفز بينها، وساحة وسط.',
    best: 'أم حصا · زرزور · النعال',
  },
  dawadmi: {
    name: 'الدوادمي',
    time: 'ظهيرة ☀️',
    desc: 'سوق قديم بشوارع متقاطعة تطل عليه تلال جرانيت صالحة للقنص.',
    best: 'عين الصقر · الشدقن · النمر',
  },
};
