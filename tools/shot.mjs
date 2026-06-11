// أداة فحص آلي: تفتح اللعبة في Chromium بلا واجهة، ترصد أخطاء Console، وتلتقط لقطات.
// الاستخدام: node tools/shot.mjs [url-suffix] [out.png] [waitMs] [clicks...]
import { chromium } from 'playwright-core';

const suffix = process.argv[2] || '';
const out = process.argv[3] || 'tools/shots/shot.png';
const waitMs = Number(process.argv[4] || 2500);
const actions = process.argv.slice(5);

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const [vw, vh] = (process.env.VIEW || '1280x720').split('x').map(Number);
const page = await browser.newPage({ viewport: { width: vw, height: vh } });

const errors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text());
});
page.on('pageerror', (err) => errors.push(String(err)));
page.on('requestfailed', (req) => errors.push(`REQUEST FAILED: ${req.url()}`));

const externalRequests = [];
page.on('request', (req) => {
  const url = req.url();
  if (!url.startsWith('http://127.0.0.1') && !url.startsWith('data:')) externalRequests.push(url);
});

await page.goto(`http://127.0.0.1:8765/index.html${suffix}`, { waitUntil: 'load' });
await page.waitForTimeout(1200);

for (const act of actions) {
  if (act.startsWith('click:')) await page.click(act.slice(6));
  else if (act.startsWith('key:')) await page.keyboard.press(act.slice(4));
  else if (act.startsWith('keydown:')) await page.keyboard.down(act.slice(8));
  else if (act.startsWith('keyup:')) await page.keyboard.up(act.slice(6));
  else if (act.startsWith('mouse:')) {
    const [x, y] = act.slice(6).split(',').map(Number);
    await page.mouse.move(x, y);
  } else if (act === 'shoot') {
    await page.mouse.down();
    await page.waitForTimeout(120);
    await page.mouse.up();
  } else if (act === 'down') await page.mouse.down();
  else if (act === 'up') await page.mouse.up();
  else if (act.startsWith('wait:')) await page.waitForTimeout(Number(act.slice(5)));
  else if (act.startsWith('eval:')) await page.evaluate(act.slice(5));
  else if (act.startsWith('gametime:')) {
    // انتظار حتى يبلغ زمن اللعبة قيمة معيّنة (مستقل عن سرعة التصيير)
    const target = Number(act.slice(9));
    await page.waitForFunction(
      (t) => window.__battah && window.__battah.time >= t,
      target,
      { timeout: 180000, polling: 300 },
    );
  }
}

await page.waitForTimeout(waitMs);
await page.screenshot({ path: out });

const state = await page.evaluate(() => {
  const g = window.__battah;
  return g ? {
    state: g.state,
    time: Math.round(g.time * 10) / 10,
    score: g.waves ? g.waves.score : null,
    wave: g.waves ? g.waves.wave : null,
    hp: g.player ? Math.round(g.player.health) : null,
    ammo: g.weapon ? g.weapon.ammo : null,
    ducksAlive: g.ducks ? g.ducks.aliveCount() : null,
  } : null;
});

console.log('STATE:', JSON.stringify(state));
console.log('EXTERNAL REQUESTS:', externalRequests.length, externalRequests.slice(0, 5));
if (errors.length) {
  console.log('ERRORS:');
  for (const e of errors.slice(0, 12)) console.log(' -', e);
  process.exitCode = 1;
} else {
  console.log('NO CONSOLE ERRORS');
}
await browser.close();
