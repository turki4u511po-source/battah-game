// الماتش والنمطان (القسم 7):
// عدد قتلات: 30 قتلة أو الأعلى بعد 10 دقائق، تعادل → موت مفاجئ.
// استحواذ: A/B/C، التقاط 8ث (×1.5 للاعبَين+)، تجمّد بالتنازع،
// +1 لكل نقطة مملوكة كل 3ث، الفوز عند 200.
// مشترك: ريسباون 3ث ديناميكي بعيد عن أنظار الأعداء + حماية 2ث.

import * as THREE from 'three';
import { Player, Combatant } from './player.js';
import { WeaponRig, ViewModel } from './weapons.js';
import { Bot, botLoadouts } from './bots.js';
import { Particles } from '../engine/particles.js';
import { losClear } from '../engine/physics.js';
import { makeTestMap } from '../maps/common.js';
import { makeIshbiliya } from '../maps/ishbiliya.js';
import { makeAwazem } from '../maps/awazem.js';
import { makeDawadmi } from '../maps/dawadmi.js';
import { pickNames } from '../data/bot-names.js';
import { WEAPONS } from '../data/weapons-data.js';
import { STR } from '../data/strings-ar.js';
import { rand, fmtTime } from '../engine/utils.js';

const MAP_BUILDERS = {
  test: makeTestMap,
  ishbiliya: makeIshbiliya,
  awazem: makeAwazem,
  dawadmi: makeDawadmi,
};
export const MAP_IDS = ['ishbiliya', 'awazem', 'dawadmi'];

export function registerMap(id, builder) {
  MAP_BUILDERS[id] = builder;
}

const IDLE_INTENT = { moveX: 0, moveY: 0, sprint: false, jump: false, adsHeld: false };

const TEAM_HEX = { neutral: 0x9aa3ad, blue: 0x2f6fd4, red: 0xd43b2f };

// ====================================================================
//                        نمط: عدد قتلات
// ====================================================================

class TdmMode {
  constructor(match) {
    this.match = match;
    this.id = 'tdm';
    this.killLimit = 30;
    this.timeLeft = 600; // 10 دقائق
    this.suddenDeath = false;
    this.matchPointSaid = false;
  }

  onKill(killer, victim) {
    if (!killer || killer === victim || killer.team === victim.team) return;
    const match = this.match;
    match.teamScores[killer.team]++;
    if (this.suddenDeath) {
      match.end(killer.team);
      return;
    }
    const s = match.teamScores[killer.team];
    if (s >= this.killLimit) {
      match.end(killer.team);
    } else if (s === this.killLimit - 3 && !this.matchPointSaid) {
      this.matchPointSaid = true;
      match.hud.centerMsg(STR.matchPoint, 1.6);
    }
  }

  update(dt) {
    if (this.suddenDeath) return;
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      const { blue, red } = this.match.teamScores;
      if (blue !== red) {
        this.match.end(blue > red ? 'blue' : 'red');
      } else {
        this.suddenDeath = true;
        this.match.hud.centerMsg(STR.suddenDeath, 3);
        this.match.game.audio?.countdown();
      }
    }
  }

  timerText() {
    return this.suddenDeath ? '⚡' : fmtTime(this.timeLeft);
  }

  botObjective() {
    return null; // تجوال النقاط الساخنة الافتراضي
  }
}

// ====================================================================
//                         نمط: استحواذ
// ====================================================================

const CAP_RADIUS = 3; // قطر ~6م
const CAP_TIME = 8;
const TICK_EVERY = 3;
const WIN_SCORE = 200;

class DomMode {
  constructor(match) {
    this.match = match;
    this.id = 'dom';
    this.elapsed = 0;
    this.tickT = TICK_EVERY;
    this.assignT = 0;
    this.matchPointSaid = false;

    this.points = match.map.domPoints.map((p) => ({
      id: p.id,
      x: p.x,
      z: p.z,
      y: match.map.groundHeight(p.x, p.z),
      owner: null,
      capTeam: null,
      progress: 0, // 0..1 تقدّم capTeam
      contested: false,
      occupants: { blue: 0, red: 0 },
      visual: null,
    }));
    this.buildVisuals();
  }

  buildVisuals() {
    const scene = this.match.scene;
    this.disposables = [];
    for (const p of this.points) {
      const g = new THREE.Group();
      const ringGeo = new THREE.RingGeometry(CAP_RADIUS - 0.35, CAP_RADIUS, 36);
      ringGeo.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({
        color: TEAM_HEX.neutral, transparent: true, opacity: 0.55, depthWrite: false,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.y = 0.06;
      g.add(ring);

      const poleMat = new THREE.MeshLambertMaterial({ color: 0x6a737d });
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 4.4, 8), poleMat);
      pole.position.y = 2.2;
      g.add(pole);

      const flagMat = new THREE.MeshLambertMaterial({ color: TEAM_HEX.neutral, side: THREE.DoubleSide });
      const flagGeo = new THREE.PlaneGeometry(1.0, 0.6);
      flagGeo.translate(0.5, 0, 0);
      const flag = new THREE.Mesh(flagGeo, flagMat);
      flag.position.y = 4.1;
      g.add(flag);

      const pillarMat = new THREE.MeshBasicMaterial({
        color: TEAM_HEX.neutral, transparent: true, opacity: 0.16,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      });
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 14, 12, 1, true), pillarMat);
      pillar.position.y = 7;
      g.add(pillar);

      g.position.set(p.x, p.y, p.z);
      scene.add(g);
      p.visual = { group: g, ringMat, flagMat, pillarMat, flag };
      this.disposables.push(ringGeo, ringMat, poleMat, flagGeo, flagMat, pillarMat);
    }
  }

  setOwnerColor(p) {
    const hex = TEAM_HEX[p.owner || 'neutral'];
    p.visual.ringMat.color.setHex(hex);
    p.visual.flagMat.color.setHex(hex);
    p.visual.pillarMat.color.setHex(hex);
  }

  /** القتلات لا تضيف لسكور الفريق في الاستحواذ — النقاط من الامتلاك فقط */
  onKill() {}

  update(dt) {
    const match = this.match;
    this.elapsed += dt;

    // إشغال النقاط
    for (const p of this.points) {
      p.occupants.blue = 0;
      p.occupants.red = 0;
      for (const c of match.combatants) {
        if (!c.alive) continue;
        const dx = c.pos.x - p.x;
        const dz = c.pos.z - p.z;
        if (dx * dx + dz * dz > CAP_RADIUS * CAP_RADIUS) continue;
        if (Math.abs(c.pos.y - p.y) > 2.6) continue;
        p.occupants[c.team]++;
      }
      const b = p.occupants.blue;
      const r = p.occupants.red;
      p.contested = b > 0 && r > 0;

      if (p.contested) continue; // تجمّد

      let team = null;
      let n = 0;
      if (b > 0) { team = 'blue'; n = b; }
      else if (r > 0) { team = 'red'; n = r; }
      if (!team || p.owner === team) continue;

      const rate = (1 / CAP_TIME) * (n >= 2 ? 1.5 : 1) * dt;
      if (p.capTeam !== team) {
        // أولًا يلغي تقدم الفريق الآخر/الملكية
        p.progress -= rate;
        if (p.progress <= 0) {
          p.progress = Math.abs(p.progress);
          p.capTeam = team;
          if (p.owner) {
            p.owner = null;
            this.setOwnerColor(p);
          }
        }
      } else {
        p.progress += rate;
        if (p.progress >= 1) {
          p.progress = 0;
          p.capTeam = null;
          p.owner = team;
          this.setOwnerColor(p);
          match.hud.centerMsg(`${STR.captured} ${p.id}`, 1.6);
          match.game.audio?.captureDone(team === 'blue');
          // نقاط شخصية لمن شارك بالالتقاط
          for (const c of match.combatants) {
            if (!c.alive || c.team !== team) continue;
            const dx = c.pos.x - p.x;
            const dz = c.pos.z - p.z;
            if (dx * dx + dz * dz <= CAP_RADIUS * CAP_RADIUS) {
              c.score += 150;
              c.captures++;
            }
          }
        }
      }
    }

    // التسجيل: +1 لكل نقطة مملوكة كل 3 ثوانٍ
    this.tickT -= dt;
    if (this.tickT <= 0) {
      this.tickT = TICK_EVERY;
      for (const p of this.points) {
        if (p.owner) match.teamScores[p.owner]++;
      }
      for (const team of ['blue', 'red']) {
        if (match.teamScores[team] >= WIN_SCORE) {
          match.end(team);
          return;
        }
        if (!this.matchPointSaid && match.teamScores[team] >= WIN_SCORE - 15) {
          this.matchPointSaid = true;
          match.hud.centerMsg(STR.matchPoint, 1.6);
        }
      }
    }

    // رفرفة الأعلام
    for (const p of this.points) {
      p.visual.flag.rotation.y = Math.sin(this.elapsed * 1.8 + p.x) * 0.35;
    }

    // توزيع البوتات على النقاط
    this.assignT -= dt;
    if (this.assignT <= 0) {
      this.assignT = 2.5;
      this.assignBots();
    }
  }

  /** هجوم على المفقودة، دفاع عن المملوكة، ولا تُترك نقطة بلا تغطية */
  assignBots() {
    for (const team of ['blue', 'red']) {
      const bots = this.match.bots.filter((b) => b.team === team && b.alive);
      if (!bots.length) continue;
      const enemy = team === 'blue' ? 'red' : 'blue';
      // أولويات: نقاط العدو ثم المحايدة ثم المملوكة (تغطية)
      const attack = this.points.filter((p) => p.owner === enemy);
      const neutral = this.points.filter((p) => !p.owner);
      const defend = this.points.filter((p) => p.owner === team);
      const order = [...attack, ...neutral, ...defend];
      if (!order.length) continue;

      const unassigned = [...bots];
      const give = (p) => {
        if (!unassigned.length) return;
        // الأقرب للنقطة
        unassigned.sort(
          (a, b) =>
            Math.hypot(a.pos.x - p.x, a.pos.z - p.z) - Math.hypot(b.pos.x - p.x, b.pos.z - p.z),
        );
        const bot = unassigned.shift();
        bot.domTarget = p;
      };
      // تغطية كل نقطة أولًا ثم تكديس الهجوم
      for (const p of order) give(p);
      let i = 0;
      while (unassigned.length) {
        give([...attack, ...neutral, ...defend][i % order.length]);
        i++;
      }
    }
  }

  botObjective(bot) {
    const p = bot.domTarget;
    if (!p) return null;
    // الوقوف داخل الدائرة للالتقاط أو الدفاع قربها
    const defending = p.owner === bot.team;
    const r = defending ? CAP_RADIUS + 2 : CAP_RADIUS * 0.5;
    const a = (bot.id * 2.4) % (Math.PI * 2);
    return {
      x: p.x + Math.cos(a) * r * 0.7,
      z: p.z + Math.sin(a) * r * 0.7,
      kind: 'objective',
    };
  }

  timerText() {
    return fmtTime(this.elapsed);
  }

  hudPoints() {
    return this.points;
  }

  dispose() {
    for (const p of this.points) this.match.scene.remove(p.visual.group);
    for (const d of this.disposables) d.dispose();
  }
}

// ====================================================================
//                            الماتش
// ====================================================================

export class Match {
  constructor(game, opts) {
    this.game = game;
    this.opts = opts; // {mode, mapId, difficulty, weapon}
    this.time = 0;
    this.finished = false;
    this.teamScores = { blue: 0, red: 0 };

    this.scene = new THREE.Scene();
    const builder = MAP_BUILDERS[opts.mapId] || MAP_BUILDERS.test;
    this.map = builder(this.scene);

    this.particles = new Particles(this.scene, game.renderer.quality.particles);

    this.hud = game.hud;
    this.player = new Player(this);
    this.player.initLoadout(opts.weapon || 'alnimr', WeaponRig, ViewModel);
    this.combatants = [this.player];
    this.bots = [];

    this.respawn(this.player, true);

    if (game.params.has('dummies')) {
      const n = Number(game.params.get('dummies')) || 3;
      for (let i = 0; i < n; i++) {
        const d = new Combatant(this, { team: 'red', name: `هدف ${i + 1}` });
        d.rig = new WeaponRig(d, 'alnimr');
        d.spawnAt(-4 + i * 4, this.player.pos.z - 14 - i * 4, 0);
        d.protT = 0;
        this.combatants.push(d);
        (this.dummies ??= []).push(d);
      }
    } else {
      this.spawnBots(opts.difficulty || 'mid');
    }

    this.mode = opts.mode === 'dom' ? new DomMode(this) : new TdmMode(this);
    this.hud.setDomVisible(this.mode.id === 'dom');
  }

  /** 11 بوت: 5 حلفاء + 6 أعداء بأسماء سعودية وأسلحة موزعة منطقيًا */
  spawnBots(difficulty) {
    const names = pickNames(11);
    const blueW = botLoadouts(5);
    const redW = botLoadouts(6);
    for (let i = 0; i < 5; i++) {
      this.bots.push(new Bot(this, { team: 'blue', name: names[i], weaponId: blueW[i], difficulty }));
    }
    for (let i = 0; i < 6; i++) {
      this.bots.push(new Bot(this, { team: 'red', name: names[5 + i], weaponId: redW[i], difficulty }));
    }
    this.combatants.push(...this.bots);
    for (const bot of this.bots) this.respawn(bot, true);
  }

  /**
   * ريسباون ديناميكي: مرشحات جهة الفريق تُقيَّم بُعدًا عن الأعداء
   * وغياب خط نظر مباشر (القسم 7).
   */
  respawn(c, initial = false) {
    const list = this.map.spawns[c.team];
    const enemies = this.combatants.filter((e) => e.alive && e.team !== c.team);
    let best = null;
    let bestScore = -Infinity;
    for (const s of list) {
      let score = rand(0, 6);
      const gy = this.map.groundHeight(s.x, s.z);
      let nearest = Infinity;
      for (const e of enemies) {
        const d = Math.hypot(e.pos.x - s.x, e.pos.z - s.z);
        nearest = Math.min(nearest, d);
        if (d < 45 && losClear(this.map, s.x, gy + 1.6, s.z, e.pos.x, e.eyeY, e.pos.z)) {
          score -= 60; // مرئي لعدو — سيئ جدًا
        }
      }
      score += Math.min(nearest, 40);
      if (score > bestScore) {
        bestScore = score;
        best = s;
      }
    }
    const s = best || list[0];
    c.spawnAt(s.x + rand(-1.2, 1.2), s.z + rand(-1.2, 1.2), s.yaw);
    if (initial) c.protT = 1;
  }

  update(dt) {
    if (this.finished) return;
    this.time += dt;
    this.player.controlUpdate(dt);
    for (const bot of this.bots) bot.aiUpdate(dt);
    if (this.dummies) {
      for (const d of this.dummies) {
        d.update(dt, IDLE_INTENT);
        if (!d.alive && d.deathT < 0) {
          d.spawnAt(d.pos.x, d.pos.z, d.yaw);
          d.protT = 0;
        }
      }
    }

    // الريسباون بعد 3 ثوانٍ
    for (const c of this.combatants) {
      if (c.alive || this.dummies?.includes(c)) continue;
      c.respawnT -= dt;
      if (c.respawnT <= 0) this.respawn(c);
    }

    // عدّاد ريسباون اللاعب
    if (!this.player.alive) {
      const killer = this.player.lastKiller;
      this.hud.setRespawn(
        Math.max(0, this.player.respawnT),
        killer && killer !== this.player ? killer.name : null,
        WEAPONS[this.player.lastKillerWeapon]?.name,
      );
    } else {
      this.hud.setRespawn(null);
    }

    this.mode.update(dt);
    this.hud.setTopbar(this.teamScores.blue, this.teamScores.red, this.mode.timerText());

    this.particles.update(dt);
  }

  onKill(killer, victim, info) {
    this.hud?.killfeed(killer, victim, info);
    this.mode?.onKill(killer, victim, info);
    if (killer?.isPlayer) this.game.audio?.killConfirm();
  }

  /** سمع إطلاق النار: دعم الحلفاء وتحرّي مصدر النيران (القسم 6) */
  notifyShot(shooter) {
    for (const bot of this.bots) {
      if (!bot.alive || bot === shooter || bot.target) continue;
      const d = Math.hypot(bot.pos.x - shooter.pos.x, bot.pos.z - shooter.pos.z);
      if (d > 26) continue;
      if (shooter.team === bot.team) {
        if (shooter.target) bot.investigate(shooter.target.pos.x, shooter.target.pos.z);
      } else {
        bot.investigate(shooter.pos.x, shooter.pos.z);
      }
    }
  }

  /** نهاية الماتش */
  end(winnerTeam) {
    if (this.finished) return;
    this.finished = true;
    this.winner = winnerTeam;
    this.game.matchEnded(winnerTeam);
  }

  enemiesOf(team) {
    return this.combatants.filter((c) => c.team !== team);
  }

  dispose() {
    this.mode?.dispose?.();
    this.map.dispose();
    this.scene.clear();
  }
}
