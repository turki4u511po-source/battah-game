// أسماء البوتات — سعودية بروح القيمرز (القسم 6 من المواصفات).

export const BOT_NAMES = [
  'رعد',
  'ذيب الشمال',
  'أبو شعيل',
  'صقر الجنوب',
  'مفحط الحارة',
  'هجّام',
  'نشمي',
  'برق',
  'سهيل',
  'خيّال',
  'عاصف',
  'الدبّاس',
];

/** خلط واختيار n اسمًا بدون تكرار */
export function pickNames(n) {
  const pool = [...BOT_NAMES];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, n);
}
