// الماتش: مالك المشهد والماب والمقاتلين.
// (قوانين النمطين والسباون الديناميكي والسكوربورد تكتمل في مرحلة الأنماط.)

import * as THREE from 'three';
import { Player } from './player.js';
import { makeTestMap } from '../maps/common.js';

const MAP_BUILDERS = { test: makeTestMap };

export function registerMap(id, builder) {
  MAP_BUILDERS[id] = builder;
}

export class Match {
  constructor(game, opts) {
    this.game = game;
    this.opts = opts; // {mode, mapId, difficulty, weapon}
    this.time = 0;

    this.scene = new THREE.Scene();
    const builder = MAP_BUILDERS[opts.mapId] || MAP_BUILDERS.test;
    this.map = builder(this.scene);

    this.hud = game.hud;
    this.player = new Player(this);
    this.combatants = [this.player];
    this.bots = [];

    const sp = this.map.spawns.blue[0];
    this.player.spawnAt(sp.x, sp.z, sp.yaw);
  }

  update(dt) {
    this.time += dt;
    this.player.controlUpdate(dt);
    for (const bot of this.bots) bot.aiUpdate(dt);
  }

  /** حدث قتل — يكتمل في مرحلة الأنماط (كيل فيد/سكور/ريسباون) */
  onKill(killer, victim, info) {
    this.hud?.onKill(killer, victim, info);
  }

  enemiesOf(team) {
    return this.combatants.filter((c) => c.team !== team);
  }

  dispose() {
    this.map.dispose();
    this.scene.clear();
  }
}
