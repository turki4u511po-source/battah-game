// تدفق القوائم والتنقل بين الشاشات.
// المرحلة 1: رئيسية بسيطة تبدأ ماتش اختبار + إيقاف مؤقت.
// تدفق «العب» الكامل والشاشات الأخرى في مرحلة القوائم.

import { buildMainMenu, buildPause, buildRotateNote, buildLoading, buildMatchEnd } from './screens.js';
import { STR } from '../data/strings-ar.js';

export class Menus {
  constructor(game) {
    this.game = game;
    this.root = document.getElementById('ui-root');

    this.screens = {
      loading: buildLoading(),
      main: buildMainMenu(),
      pause: buildPause(),
      end: buildMatchEnd(),
      rotate: buildRotateNote(),
    };
    for (const s of Object.values(this.screens)) this.root.appendChild(s);

    this.bind();
    this.show('loading');

    // إلزام الشاشة العرضية على الجوال
    if (game.input.isTouch) {
      const check = () => {
        const portrait = window.matchMedia('(orientation: portrait)').matches;
        this.screens.rotate.classList.toggle('hidden', !portrait);
      };
      window.addEventListener('resize', check);
      check();
    }
  }

  bind() {
    const game = this.game;
    this.screens.main.addEventListener('click', (e) => {
      const nav = e.target.dataset?.nav;
      if (!nav) return;
      game.audio?.ensure();
      if (nav === 'play') {
        // المرحلة 1: بدء مباشر على ماب الاختبار
        game.startMatch({ mode: 'tdm', mapId: 'test', difficulty: 'mid', weapon: 'alnimr' });
      }
      // بقية الفروع (weapons/maps/record/settings) في مرحلة القوائم
    });

    this.screens.pause.addEventListener('click', (e) => {
      const act = e.target.dataset?.act;
      if (!act) return;
      if (act === 'resume') game.resumeMatch();
      else if (act === 'end') game.endMatch(true);
    });

    this.screens.end.addEventListener('click', (e) => {
      const act = e.target.dataset?.act;
      if (!act) return;
      if (act === 'replay') game.startMatch(game.match.opts);
      else if (act === 'menu') game.endMatch(true);
      else if (act === 'change-weapon') {
        // يكتمل بفتح شاشة الأسلحة في مرحلة القوائم
        game.endMatch(true);
      }
    });
  }

  /** شاشة نهاية الماتش: فزت/خسرت + سكوربورد كامل */
  showEnd(winnerTeam) {
    const game = this.game;
    const match = game.match;
    const won = winnerTeam === 'blue';
    const title = this.screens.end.querySelector('#end-title');
    title.textContent = winnerTeam === null ? STR.draw : won ? STR.win : STR.lose;
    title.className = `end-title ${won ? 'win' : 'lose'}`;
    this.screens.end.querySelector('#end-team-score').innerHTML =
      `<b class="blue">${STR.teamBlue} ${match.teamScores.blue}</b> ${STR.vs} ` +
      `<b class="red">${match.teamScores.red} ${STR.teamRed}</b>`;
    game.hud.renderScoreboard();
    const sb = game.hud.els.scoreboard;
    this.screens.end.querySelector('#end-scoreboard').innerHTML = sb.innerHTML;
    this.show('end');
  }

  /** إظهار شاشة واحدة فقط (أو لا شيء) */
  show(name) {
    for (const [k, s] of Object.entries(this.screens)) {
      if (k === 'rotate') continue; // تُدار باتجاه الجهاز
      s.classList.toggle('hidden', k !== name);
    }
  }
}
