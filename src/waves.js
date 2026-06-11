// مدير الموجات والنقاط: تركيبة الأنواع المتصاعدة، موجات الزعيم،
// سلاسل القتل (Combo)، مكافآت إنهاء الموجة.

import { CONFIG } from './config.js';
import { rand, weightedChoose, fmt } from './utils.js';

const W = CONFIG.waves;
const S = CONFIG.score;

export class Waves {
  constructor(game) {
    this.game = game;
    this.reset();
  }

  reset() {
    this.wave = 0;
    this.score = 0;
    this.kills = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.state = 'idle'; // idle | break | active
    this.breakT = 0;
    this.queue = [];
    this.spawnT = 0;
    this.lastCountdown = -1;
  }

  start() {
    this.reset();
    this.state = 'break';
    this.breakT = W.firstDelay;
    const ui = this.game.ui;
    ui.setScore(0);
    ui.setWave(0);
    ui.setLeft(-1);
    ui.setCombo(1);
    ui.banner('استعد! البط الآلي قادم…', 2);
  }

  buildWave(n) {
    let count = Math.min(W.baseCount + W.perWave * (n - 1), W.maxCount);
    const q = [];
    if (n % W.bossEvery === 0) {
      q.push('boss');
      count = Math.ceil(count / 2);
    }
    for (let i = 0; i < count; i++) {
      const items = [{ w: 10, v: 'normal' }];
      if (n >= 2) items.push({ w: 2 + n, v: 'fast' });
      if (n >= 4) items.push({ w: Math.min(n - 2, 8), v: 'tank' });
      q.push(weightedChoose(items));
    }
    return q;
  }

  hpScale(n) {
    return 1 + 0.05 * Math.max(0, n - 3);
  }

  speedScale(n) {
    return Math.min(1 + 0.02 * (n - 1), 1.35);
  }

  totalLeft() {
    return this.queue.length + this.game.ducks.aliveCount();
  }

  startWave() {
    const game = this.game;
    this.wave++;
    this.queue = this.buildWave(this.wave);
    this.state = 'active';
    this.spawnT = 0.4;
    const isBoss = this.wave % W.bossEvery === 0;
    game.ui.setWave(this.wave);
    game.ui.setLeft(this.totalLeft());
    game.ui.banner(isBoss ? `⚠️ الموجة ${fmt(this.wave)} — الزعيم البطّوط!` : `الموجة ${fmt(this.wave)}`, 2.2);
    game.audio?.fanfare(isBoss);
  }

  update(dt) {
    const game = this.game;

    // مؤقّت السلسلة
    if (this.combo > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.combo = 0;
        game.ui.setCombo(1);
      }
    }

    if (this.state === 'break') {
      this.breakT -= dt;
      const remaining = Math.ceil(this.breakT);
      if (this.wave > 0 && remaining !== this.lastCountdown && remaining >= 1) {
        this.lastCountdown = remaining;
        game.ui.banner(`الموجة ${fmt(this.wave + 1)} بعد ${fmt(remaining)}…`, 1.05);
        game.audio?.tickTock();
      }
      if (this.breakT <= 0) {
        this.lastCountdown = -1;
        this.startWave();
      }
    } else if (this.state === 'active') {
      if (this.queue.length && game.ducks.aliveCount() < CONFIG.ducks.maxAlive) {
        this.spawnT -= dt;
        if (this.spawnT <= 0) {
          this.spawnT = rand(W.spawnIntervalMin, W.spawnIntervalMax);
          const type = this.queue.shift();
          game.ducks.spawn(
            type,
            game.arena.getSpawnPoint(game.player.root.position),
            type === 'boss' ? 1 + 0.12 * (this.wave / W.bossEvery - 1) : this.hpScale(this.wave),
            this.speedScale(this.wave),
          );
          game.ui.setLeft(this.totalLeft());
        }
      }
      if (!this.queue.length && game.ducks.aliveCount() === 0) {
        const bonus = W.clearBonusPerWave * this.wave;
        this.score += bonus;
        game.ui.setScore(this.score);
        game.ui.banner(`انتهت الموجة! ‎+${fmt(bonus)}‎ نقطة`, 2);
        game.player.heal(W.clearHeal);
        game.audio?.waveClear();
        this.state = 'break';
        this.breakT = W.breakTime;
      }
    }
  }

  onDuckKilled(duck, isHead, center) {
    const game = this.game;
    this.kills++;
    this.combo++;
    this.comboTimer = S.comboWindow;
    const mult = Math.min(1 + (this.combo - 1) * S.comboStep, S.comboMax);
    const pts = Math.round(duck.conf.score * (isHead ? 2 : 1) * mult);
    this.score += pts;
    game.ui.setScore(this.score);
    game.ui.setCombo(mult);
    game.ui.setLeft(this.totalLeft());
    game.ui.popupAtWorld(
      center,
      isHead ? `‎+${fmt(pts)}‎ 🎯` : `‎+${fmt(pts)}‎`,
      isHead ? 'pop-head' : '',
    );
  }
}
