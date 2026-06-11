// الماتش: مالك المشهد والماب والمقاتلين والجسيمات.
// (قوانين النمطين والسباون الديناميكي والسكوربورد تكتمل في مرحلة الأنماط.)

import * as THREE from 'three';
import { Player, Combatant } from './player.js';
import { WeaponRig, ViewModel } from './weapons.js';
import { Particles } from '../engine/particles.js';
import { makeTestMap } from '../maps/common.js';

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

    // ?dummies=N: أهداف ساكنة لاختبار الأسلحة (فحص آلي)
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
    this.particles.update(dt);
  }

  /** حدث قتل — يكتمل في مرحلة الأنماط (سكور/ريسباون ديناميكي) */
  onKill(killer, victim, info) {
    this.hud?.killfeed(killer, victim, info);
    if (killer && killer !== victim) {
      this.teamScores[killer.team] = (this.teamScores[killer.team] || 0);
    }
  }

  enemiesOf(team) {
    return this.combatants.filter((c) => c.team !== team);
  }

  dispose() {
    this.map.dispose();
    this.scene.clear();
  }
}
