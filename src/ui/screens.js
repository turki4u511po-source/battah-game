// بناة شاشات DOM — كل النصوص من strings-ar (القسم 9).
// المرحلة 1: الرئيسية والإيقاف فقط؛ بقية الشاشات تكتمل في مرحلة القوائم.

import { STR } from '../data/strings-ar.js';

export function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

export function buildMainMenu() {
  const s = el('div', 'screen overlay hidden');
  s.id = 'screen-main';
  s.innerHTML = `
    <div class="menu-wrap">
      <h1 class="wordmark">${STR.gameTitle}</h1>
      <p class="wordmark-sub">${STR.gameSubtitle}</p>
      <nav class="main-buttons">
        <button class="btn primary" data-nav="play">${STR.play}</button>
        <button class="btn" data-nav="weapons">${STR.weapons}</button>
        <button class="btn" data-nav="maps">${STR.maps}</button>
        <button class="btn" data-nav="record">${STR.record}</button>
        <button class="btn" data-nav="settings">${STR.settings}</button>
      </nav>
    </div>`;
  return s;
}

export function buildPause() {
  const s = el('div', 'screen overlay hidden');
  s.id = 'screen-pause';
  s.innerHTML = `
    <div class="card">
      <h2>${STR.pause}</h2>
      <div class="col-buttons">
        <button class="btn primary" data-act="resume">${STR.resume}</button>
        <button class="btn" data-act="settings">${STR.settings}</button>
        <button class="btn" data-act="end">${STR.endMatch}</button>
      </div>
    </div>`;
  return s;
}

export function buildMatchEnd() {
  const s = el('div', 'screen overlay hidden');
  s.id = 'screen-end';
  s.innerHTML = `
    <div class="card end-card">
      <h1 id="end-title" class="end-title"></h1>
      <div id="end-team-score" class="end-team-score"></div>
      <div id="end-scoreboard"></div>
      <div class="row-buttons">
        <button class="btn primary" data-act="replay">${STR.replay}</button>
        <button class="btn" data-act="change-weapon">${STR.changeWeapon}</button>
        <button class="btn" data-act="menu">${STR.mainMenu}</button>
      </div>
    </div>`;
  return s;
}

export function buildRotateNote() {
  const s = el('div', 'screen overlay hidden');
  s.id = 'screen-rotate';
  s.innerHTML = `<div class="card"><h2>📱↻</h2><p>${STR.rotateDevice}</p></div>`;
  return s;
}

export function buildLoading() {
  const s = el('div', 'screen overlay');
  s.id = 'screen-loading';
  s.innerHTML = `<div class="card"><p class="pulse">${STR.loading}</p></div>`;
  return s;
}
