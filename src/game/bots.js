// البوتات (القسم 6): ملاحة شبكة waypoints مخبوزة + A* بسيط،
// إدراك (رؤية مخروطية/سمع)، قتال برشقات ونموذج دقة بالنسب المحددة،
// ومستويات سهل/وسط/صعب بسلوكياتها (غطاء، مراوغة، انبطاح، تعاون).

import { Combatant, SPEEDS } from './player.js';
import { WeaponRig } from './weapons.js';
import { losClear } from '../engine/physics.js';
import { clamp, rand, choose, turnToward, angleDiff } from '../engine/utils.js';

export const DIFFICULTY = {
  easy: {
    accuracy: 0.30, reaction: 0.8, vision: 40,
    cover: false, strafe: false, prone: false, coop: false,
    turnRate: 4.5, burst: [2, 4], burstPause: [0.55, 0.9],
  },
  mid: {
    accuracy: 0.55, reaction: 0.45, vision: 60,
    cover: true, strafe: false, prone: false, coop: false,
    turnRate: 6.5, burst: [3, 6], burstPause: [0.35, 0.6],
  },
  hard: {
    accuracy: 0.78, reaction: 0.25, vision: 80,
    cover: true, strafe: true, prone: true, coop: true,
    turnRate: 9, burst: [5, 8], burstPause: [0.2, 0.4],
  },
};

const FOV_COS = Math.cos(0.96); // مخروط رؤية ~110°

export class Bot extends Combatant {
  constructor(match, { team, name, weaponId, difficulty }) {
    super(match, { team, name });
    this.diff = DIFFICULTY[difficulty] || DIFFICULTY.mid;
    this.rig = new WeaponRig(this, weaponId);

    // ملاحة
    this.path = [];
    this.pathIdx = 0;
    this.goal = null;
    this.goalKind = 'roam';
    this.repathT = 0;
    this.stuckT = 0;
    this.lastPos = { x: 0, z: 0 };

    // إدراك وقتال
    this.target = null;
    this.reactT = 0;
    this.lastSeen = { x: 0, z: 0, t: -99 };
    this.perceiveT = rand(0, 0.15);
    this.burstLeft = 0;
    this.burstPauseT = 0;
    this.strafeDir = Math.random() < 0.5 ? -1 : 1;
    this.strafeT = 0;
    this.coverWp = -1;
    this.coverUntil = 0;
    this.proneUntil = 0;
    this.decideT = 0;
  }

  // ---------------- الإدراك ----------------
  canSee(e, omni = false) {
    const dx = e.pos.x - this.pos.x;
    const dz = e.pos.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist > this.diff.vision) return false;
    if (!omni && dist > 3) {
      const f = this.forward2D();
      if ((dx * f.x + dz * f.z) / dist < FOV_COS) return false;
    }
    return losClear(
      this.match.map,
      this.pos.x, this.eyeY, this.pos.z,
      e.pos.x, e.pos.y + e.curHeight * 0.7, e.pos.z,
    );
  }

  perceive(dt) {
    this.perceiveT -= dt;
    if (this.perceiveT > 0) return;
    this.perceiveT = 0.14 + rand(0, 0.06);

    // التحقق من الهدف الحالي
    if (this.target && (!this.target.alive || !this.canSee(this.target, true))) {
      if (this.target.alive && this.match.time - this.lastSeen.t < 2.5) {
        // فقد الرؤية لتوّه — يتذكر آخر مكان
      } else {
        this.target = null;
      }
    }

    // البحث عن أقرب عدو مرئي
    let best = null;
    let bestD = Infinity;
    for (const e of this.match.combatants) {
      if (!e.alive || e.team === this.team) continue;
      const d = (e.pos.x - this.pos.x) ** 2 + (e.pos.z - this.pos.z) ** 2;
      if (d < bestD && this.canSee(e)) {
        best = e;
        bestD = d;
      }
    }
    if (best) {
      if (this.target !== best) {
        if (this.reactT <= 0) this.reactT = this.diff.reaction * rand(0.85, 1.2);
        // زمن رد الفعل قبل تثبيت الهدف
        this.pendingTarget = best;
      } else {
        this.lastSeen.x = best.pos.x;
        this.lastSeen.z = best.pos.z;
        this.lastSeen.t = this.match.time;
      }
      // تعاون: مشاركة الهدف مع الحلفاء القريبين (صعب)
      if (this.diff.coop && this.target === best) {
        for (const ally of this.match.combatants) {
          if (ally.team !== this.team || ally === this || !ally.alive || !ally.aiUpdate) continue;
          if (!ally.target && Math.hypot(ally.pos.x - this.pos.x, ally.pos.z - this.pos.z) < 30) {
            ally.investigate(best.pos.x, best.pos.z);
          }
        }
      }
    }
  }

  /** توجيه البوت لفحص موقع (سمع إطلاق/تعاون) */
  investigate(x, z) {
    if (this.target) return;
    this.goal = { x, z };
    this.goalKind = 'investigate';
    this.repathT = 0;
  }

  onDamaged(attacker) {
    if (!attacker || attacker.team === this.team) return;
    // وعي شامل عند الإصابة
    this.lastSeen.x = attacker.pos.x;
    this.lastSeen.z = attacker.pos.z;
    this.lastSeen.t = this.match.time;
    if (!this.target && this.canSee(attacker, true)) {
      this.pendingTarget = attacker;
      this.reactT = this.diff.reaction * 0.5;
    } else if (!this.target) {
      this.investigate(attacker.pos.x, attacker.pos.z);
      // التفت نحو مصدر الضرر
      this.yaw = Math.atan2(attacker.pos.x - this.pos.x, attacker.pos.z - this.pos.z);
    }
    // الصعب ينبطح أحيانًا عند الإصابة
    if (this.diff.prone && this.health < 55 && Math.random() < 0.35) {
      this.stance = 'prone';
      this.proneUntil = this.match.time + rand(1.2, 2.4);
    }
    // الوسط/الصعب يكسر الاشتباك للغطاء عند صحة منخفضة
    if (this.diff.cover && this.health < 32 && Math.random() < 0.5) {
      this.seekCover();
    }
  }

  // ---------------- الملاحة ----------------
  /** A* بسيط فوق شبكة waypoints */
  findPath(fromIdx, toIdx) {
    const wps = this.match.map.waypoints;
    if (fromIdx === toIdx || fromIdx < 0 || toIdx < 0) return [toIdx];
    const open = new Set([fromIdx]);
    const came = new Map();
    const gScore = new Map([[fromIdx, 0]]);
    const fScore = new Map([[fromIdx, 0]]);
    const h = (i) => Math.hypot(wps[i].x - wps[toIdx].x, wps[i].z - wps[toIdx].z);

    let guard = 0;
    while (open.size && guard++ < 400) {
      let cur = -1;
      let curF = Infinity;
      for (const i of open) {
        const f = fScore.get(i) ?? Infinity;
        if (f < curF) { curF = f; cur = i; }
      }
      if (cur === toIdx) {
        const path = [cur];
        while (came.has(cur)) {
          cur = came.get(cur);
          path.unshift(cur);
        }
        return path;
      }
      open.delete(cur);
      for (const nb of wps[cur].links) {
        const g = (gScore.get(cur) ?? Infinity)
          + Math.hypot(wps[nb].x - wps[cur].x, wps[nb].z - wps[cur].z);
        if (g < (gScore.get(nb) ?? Infinity)) {
          came.set(nb, cur);
          gScore.set(nb, g);
          fScore.set(nb, g + h(nb));
          open.add(nb);
        }
      }
    }
    return [toIdx];
  }

  setGoal(x, z, kind = 'roam') {
    this.goal = { x, z };
    this.goalKind = kind;
    this.repathT = 0;
  }

  repath() {
    const map = this.match.map;
    const from = map.nearestWaypoint(this.pos.x, this.pos.z);
    const to = map.nearestWaypoint(this.goal.x, this.goal.z);
    this.path = this.findPath(from, to);
    this.pathIdx = 0;
    this.repathT = 2.5 + rand(0, 1);
  }

  /** الوجهة الحالية للحركة (عقدة المسار أو الهدف النهائي) */
  navTarget() {
    const wps = this.match.map.waypoints;
    while (this.pathIdx < this.path.length) {
      const wp = wps[this.path[this.pathIdx]];
      if (Math.hypot(wp.x - this.pos.x, wp.z - this.pos.z) < 1.4) {
        this.pathIdx++;
        continue;
      }
      return wp;
    }
    return this.goal;
  }

  seekCover() {
    const map = this.match.map;
    const wps = map.waypoints;
    const threat = this.target || (this.match.time - this.lastSeen.t < 3 ? { pos: { x: this.lastSeen.x, y: 1.5, z: this.lastSeen.z } } : null);
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < wps.length; i++) {
      const w = wps[i];
      if (!w.cover) continue;
      const d = Math.hypot(w.x - this.pos.x, w.z - this.pos.z);
      if (d > 22 || d >= bestD) continue;
      if (threat) {
        const hidden = !losClear(
          map,
          w.x, w.y + 1.1, w.z,
          threat.pos.x, (threat.pos.y ?? 0) + 1.5, threat.pos.z,
        );
        if (!hidden) continue;
      }
      best = i;
      bestD = d;
    }
    if (best >= 0) {
      this.coverWp = best;
      this.coverUntil = this.match.time + rand(2.5, 4);
      this.setGoal(wps[best].x, wps[best].z, 'cover');
    }
  }

  // ---------------- اتخاذ القرار ----------------
  think(dt) {
    const match = this.match;
    this.reactT -= dt;
    this.decideT -= dt;
    this.repathT -= dt;

    // تثبيت الهدف بعد رد الفعل
    if (this.pendingTarget && this.reactT <= 0) {
      if (this.pendingTarget.alive) {
        this.target = this.pendingTarget;
        this.lastSeen.x = this.target.pos.x;
        this.lastSeen.z = this.target.pos.z;
        this.lastSeen.t = match.time;
      }
      this.pendingTarget = null;
    }

    // العودة من الانبطاح
    if (this.stance === 'prone' && match.time > this.proneUntil) this.stance = 'stand';

    // إنهاء وضع الغطاء
    if (this.goalKind === 'cover' && match.time > this.coverUntil
      && !this.rig.curState.reloading && this.health > 55) {
      this.goalKind = 'roam';
      this.decideT = 0;
    }

    // اختيار وجهة
    if (this.decideT <= 0 || !this.goal) {
      this.decideT = rand(6, 12);
      if (this.goalKind !== 'cover') {
        const obj = match.mode?.botObjective?.(this);
        if (obj) {
          this.setGoal(obj.x, obj.z, obj.kind || 'objective');
        } else {
          // تجوال بين النقاط الساخنة
          const wps = match.map.waypoints;
          const hot = wps.filter((w) => w.hot);
          const pick = hot.length && Math.random() < 0.7 ? choose(hot) : choose(wps);
          this.setGoal(pick.x + rand(-1.5, 1.5), pick.z + rand(-1.5, 1.5), 'roam');
        }
      }
    }

    // ملاحقة آخر موقع معروف للهدف (الصعب يطارد)
    if (this.target && !this.canSee(this.target, true)) {
      if (this.diff.strafe || this.goalKind === 'investigate') {
        this.setGoal(this.lastSeen.x, this.lastSeen.z, 'investigate');
      }
    }

    if (this.goal && this.repathT <= 0) this.repath();

    // التلقيم خلف الغطاء (وسط/صعب) أو فورًا (سهل)
    const st = this.rig.curState;
    if (!st.reloading && st.ammo === 0) {
      this.rig.startReload();
      if (this.diff.cover && this.target) this.seekCover();
    } else if (!st.reloading && !this.target && st.ammo < this.rig.current.mag * 0.4) {
      this.rig.startReload();
    }
  }

  // ---------------- التنفيذ ----------------
  act(dt) {
    const match = this.match;
    const intent = { moveX: 0, moveY: 0, sprint: false, jump: false, adsHeld: false };
    const engaged = !!this.target && this.target.alive;

    // الاتجاه المطلوب للحركة
    let moveDirX = 0;
    let moveDirZ = 0;
    const nav = this.goal ? this.navTarget() : null;
    if (nav) {
      const dx = nav.x - this.pos.x;
      const dz = nav.z - this.pos.z;
      const d = Math.hypot(dx, dz);
      const arrived = this.goalKind !== 'objective' ? d < 1.2 : d < 2.2;
      if (!arrived) {
        moveDirX = dx / d;
        moveDirZ = dz / d;
      } else if (this.goalKind === 'roam' || this.goalKind === 'investigate') {
        this.goal = null;
        this.decideT = Math.min(this.decideT, rand(0.5, 2));
      }
    }

    if (engaged) {
      const t = this.target;
      const dx = t.pos.x - this.pos.x;
      const dz = t.pos.z - this.pos.z;
      const dist = Math.hypot(dx, dz);

      // مواجهة الهدف
      const wantYaw = Math.atan2(dx, dz);
      this.yaw = turnToward(this.yaw, wantYaw, this.diff.turnRate * dt);
      const targetY = t.pos.y + t.curHeight * 0.62;
      const wantPitch = Math.atan2(targetY - this.eyeY, dist);
      this.pitch = turnToward(this.pitch, clamp(wantPitch, -1.2, 1.2), this.diff.turnRate * dt);

      // مراوغة جانبية (صعب) أو ثبات
      if (this.diff.strafe && dist < 35 && this.stance !== 'prone') {
        this.strafeT -= dt;
        if (this.strafeT <= 0) {
          this.strafeT = rand(0.6, 1.2);
          this.strafeDir *= -1;
        }
        intent.moveX = this.strafeDir;
        // يحافظ على مدى مناسب
        if (dist > this.rig.current.rangeMax * 0.9) intent.moveY = 0.6;
        else if (dist < 7) intent.moveY = -0.5;
      } else if (this.goalKind === 'cover' && nav) {
        // متابعة الانسحاب للغطاء أثناء المواجهة
        const f = this.forward2D();
        intent.moveY = clamp(moveDirX * f.x + moveDirZ * f.z, -1, 1);
        intent.moveX = clamp(moveDirX * f.z - moveDirZ * f.x, -1, 1);
      } else if (!this.diff.cover) {
        // السهل: خط مستقيم نحو الهدف
        if (dist > 9) intent.moveY = 1;
      } else if (dist > this.rig.current.rangeMax) {
        intent.moveY = 1;
      }

      // ADS للمدى (وسط/صعب)
      intent.adsHeld = this.diff.cover && dist > 14 && this.stance !== 'prone';

      this.combat(dt, dist);
    } else {
      // مواجهة اتجاه الحركة
      if (moveDirX || moveDirZ) {
        const wantYaw = Math.atan2(moveDirX, moveDirZ);
        this.yaw = turnToward(this.yaw, wantYaw, this.diff.turnRate * 0.8 * dt);
        if (Math.abs(angleDiff(this.yaw, wantYaw)) < 0.7) {
          intent.moveY = 1;
          const navd = nav ? Math.hypot(nav.x - this.pos.x, nav.z - this.pos.z) : 0;
          intent.sprint = navd > 10 && this.goalKind !== 'cover';
        }
      }
      this.burstLeft = 0;
    }

    // كشف الانحشار
    const moved = Math.hypot(this.pos.x - this.lastPos.x, this.pos.z - this.lastPos.z);
    if ((intent.moveY || intent.moveX) && moved < 0.35 * dt * 4) {
      this.stuckT += dt;
      if (this.stuckT > 1.4) {
        intent.jump = true;
        this.stuckT = 0;
        this.repathT = 0;
        if (Math.random() < 0.5) this.decideT = 0;
      }
    } else {
      this.stuckT = 0;
    }
    this.lastPos.x = this.pos.x;
    this.lastPos.z = this.pos.z;

    return intent;
  }

  /** إدارة الرشقات والإطلاق بنموذج الدقة */
  combat(dt, dist) {
    const w = this.rig.current;
    const st = this.rig.curState;
    if (st.reloading || !this.target) return;

    // داخل قوس التصويب؟
    const dx = this.target.pos.x - this.pos.x;
    const dz = this.target.pos.z - this.pos.z;
    const aimErr = Math.abs(angleDiff(this.yaw, Math.atan2(dx, dz)));
    if (aimErr > 0.12 || dist > this.diff.vision) return;

    this.burstPauseT -= dt;
    if (this.burstLeft <= 0) {
      if (this.burstPauseT > 0) return;
      this.burstLeft = Math.round(rand(...this.diff.burst));
      if (!w.auto) this.burstLeft = 1;
    }

    if (this.rig.cooldown > 0) return;

    // نموذج الدقة: احتمال إصابة لكل طلقة حسب المستوى والوضعيات
    let acc = this.diff.accuracy;
    const t = this.target;
    if (t.stance === 'crouch') acc *= 0.85;
    else if (t.stance === 'prone') acc *= 0.6;
    if (Math.hypot(t.vel.x, t.vel.z) > 4) acc *= 0.85;
    if (Math.hypot(this.vel.x, this.vel.z) > 2) acc *= 0.92;
    if (dist > w.rangeMax) acc *= 0.75;
    if (this.stance === 'crouch') acc *= 1.08;

    if (Math.random() < acc) {
      this.swayY = rand(-0.004, 0.004);
      this.swayP = rand(-0.004, 0.004);
    } else {
      // إخطاء حقيقي: زاوية تتجاوز عرض الكبسولة عند هذه المسافة
      const missBase = Math.atan2(0.8, Math.max(dist, 2));
      this.swayY = (missBase + rand(0.005, 0.04)) * (Math.random() < 0.5 ? 1 : -1);
      this.swayP = rand(-0.6, 1.2) * missBase;
    }
    this.rig.tryFire(true);
    this.swayY = 0;
    this.swayP = 0;

    this.burstLeft--;
    if (this.burstLeft <= 0) {
      this.burstPauseT = rand(...this.diff.burstPause) + (w.auto ? 0 : w.fireInterval * 0.3);
    }
  }

  aiUpdate(dt) {
    if (!this.alive) {
      this.update(dt, { moveX: 0, moveY: 0, sprint: false, jump: false, adsHeld: false });
      return;
    }
    this.perceive(dt);
    this.think(dt);
    const intent = this.act(dt);
    this.update(dt, intent);
  }
}

/** توزيع منطقي لأسلحة البوتات (القسم 6) */
export function botLoadouts(count) {
  const base = ['alnimr', 'theeb', 'zarzoor', 'umhasa', 'shadgan', 'saqr'];
  const out = [];
  for (let i = 0; i < count; i++) out.push(base[i % base.length]);
  // خلطة خفيفة مع ضمان التنوع
  for (let i = out.length - 1; i > 0; i--) {
    if (Math.random() < 0.4) {
      const j = (Math.random() * (i + 1)) | 0;
      [out[i], out[j]] = [out[j], out[i]];
    }
  }
  return out;
}
