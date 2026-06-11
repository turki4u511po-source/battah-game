// الماتش: مالك المشهد والماب والمقاتلين والجسيمات.
// (قوانين النمطين والسباون الديناميكي والسكوربورد تكتمل في مرحلة الأنماط.)

import * as THREE from 'three';
import { Player, Combatant } from './player.js';
import { WeaponRig, ViewModel } from './weapons.js';
import { Bot, botLoadouts } from './bots.js';
import { Particles } from '../engine/particles.js';
import { makeTestMap } from '../maps/common.js';
import { pickNames } from '../data/bot-names.js';
import { WEAPONS } from '../data/weapons-data.js';
import { rand } from '../engine/utils.js';

const MAP_BUILDERS = { test: makeTestMap };

export function registerMap(id, builder) {
  MAP_BUILDERS[id] = builder;
}

const IDLE_INTENT = { moveX: 0, moveY: 0, sprint: false, jump: false, adsHeld: false };

export class Match {
  constructor(game, opts) {
    this.game = game;
    this.opts = opts; // {mode, mapId, difficulty, weapon}
    this.time = 0;
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

    const sp = this.map.spawns.blue[0];
    this.player.spawnAt(sp.x, sp.z, sp.yaw);

    // ?dummies=N: أهداف ساكنة لاختبار الأسلحة (فحص آلي — بدون بوتات)
    if (game.params.has('dummies')) {
      const n = Number(game.params.get('dummies')) || 3;
      for (let i = 0; i < n; i++) {
        const d = new Combatant(this, { team: 'red', name: `هدف ${i + 1}` });
        d.rig = new WeaponRig(d, 'alnimr');
        const x = -4 + i * 4;
        const z = this.player.pos.z - 14 - i * 4;
        d.spawnAt(x, z, 0);
        d.protT = 0;
        this.combatants.push(d);
        this.dummies ??= [];
        this.dummies.push(d);
      }
    } else {
      this.spawnBots(opts.difficulty || 'mid');
    }
  }

  /** 11 بوت: 5 حلفاء + 6 أعداء بأسماء سعودية وأسلحة موزعة منطقيًا */
  spawnBots(difficulty) {
    const names = pickNames(11);
    const blueW = botLoadouts(5);
    const redW = botLoadouts(6);
    for (let i = 0; i < 5; i++) {
      this.bots.push(new Bot(this, {
        team: 'blue', name: names[i], weaponId: blueW[i], difficulty,
      }));
    }
    for (let i = 0; i < 6; i++) {
      this.bots.push(new Bot(this, {
        team: 'red', name: names[5 + i], weaponId: redW[i], difficulty,
      }));
    }
    this.combatants.push(...this.bots);
    for (const bot of this.bots) this.respawn(bot, true);
  }

  /** ريسباون أساسي عند نقاط الفريق (يصبح ديناميكيًا في مرحلة الأنماط) */
  respawn(c, initial = false) {
    const list = this.map.spawns[c.team];
    const s = list[(Math.random() * list.length) | 0];
    c.spawnAt(s.x + rand(-1.5, 1.5), s.z + rand(-1.5, 1.5), s.yaw);
    if (initial) c.protT = 0.5;
  }

  /** سمع إطلاق النار: دعم الحلفاء وتحري مصدر النيران (القسم 6) */
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

  update(dt) {
    this.time += dt;
    this.player.controlUpdate(dt);
    for (const bot of this.bots) bot.aiUpdate(dt);
    if (this.dummies) {
      for (const d of this.dummies) {
        d.update(dt, IDLE_INTENT);
        // إعادة نشر الدمية بعد موتها (للاختبار المتكرر)
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

    this.particles.update(dt);
  }

  /** حدث قتل — السكور حسب النمط يكتمل في مرحلة الأنماط */
  onKill(killer, victim, info) {
    this.hud?.killfeed(killer, victim, info);
    this.game.audio?.killConfirm?.();
  }

  enemiesOf(team) {
    return this.combatants.filter((c) => c.team !== team);
  }

  dispose() {
    this.map.dispose();
    this.scene.clear();
  }
}
