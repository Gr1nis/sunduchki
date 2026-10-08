import { sounds } from './sound.js';
import { switchView, renderOpponents, renderMyHand, showToast, animateStolenCards, showSpeechBubble } from './ui.js';
import { renderCardBack } from './cardRenderer.js';
import { LocalGame } from './localGame.js';

let game = null, gameState = null, selectedTargetId = null, selectedRank = null, currentTheme = 'royal';
let lastActionSummary = '';
const selectedSuits = new Set();
const ALL_SUITS = [{ s: '♠', n: 'Пики' }, { s: '♥', n: 'Червы' }, { s: '♦', n: 'Бубны' }, { s: '♣', n: 'Трефы' }];

const soundBtn = document.getElementById('btn-sound-toggle');
const themeSelect = document.getElementById('theme-selector');
const newGameBtn = document.getElementById('btn-new-game');
const startBtn = document.getElementById('btn-start-bot-game');
const countPickerBar = document.getElementById('count-picker-bar');
const countPillsRow = document.getElementById('count-pills-row');
const suitsPickerBar = document.getElementById('suits-picker-bar');
const suitsPillsRow = document.getElementById('suits-pills-row');
const suitsNeededCount = document.getElementById('suits-needed-count');
const btnSubmitSuits = document.getElementById('btn-submit-suits');

soundBtn.addEventListener('click', () => { soundBtn.textContent = sounds.toggleMute() ? '🔇' : '🔊'; });
themeSelect.addEventListener('change', (e) => { currentTheme = e.target.value; document.body.className = `theme-${currentTheme}`; if (gameState) renderTable(); });
newGameBtn.addEventListener('click', () => { switchView('welcome'); newGameBtn.classList.add('hidden'); });

const toggleLogBtn = document.getElementById('btn-toggle-log');
const closeLogBtn = document.getElementById('btn-close-log');
const gameSidebar = document.getElementById('game-sidebar');
if (toggleLogBtn && gameSidebar) toggleLogBtn.addEventListener('click', () => gameSidebar.classList.toggle('open'));
if (closeLogBtn && gameSidebar) closeLogBtn.addEventListener('click', () => gameSidebar.classList.remove('open'));

const bannerEl = document.getElementById('turn-banner');
if (bannerEl && gameSidebar) {
  bannerEl.addEventListener('click', () => gameSidebar.classList.toggle('open'));
}

startBtn.addEventListener('click', () => {
  const playerName = document.getElementById('input-player-name').value.trim() || 'Игрок';
  const deckType = document.getElementById('select-deck-type').value;
  const botCount = parseInt(document.getElementById('select-bot-count').value, 10) || 3;
  selectedTargetId = null; selectedRank = null; selectedSuits.clear(); lastActionSummary = '';
  newGameBtn.classList.remove('hidden');
  game = new LocalGame(handleGameState);
  game.start({ playerName, deckType, botCount });
  switchView('game');
});

function handleGameState(state) {
  gameState = state;
  if (state.gameEvent) handleGameEvent(state.gameEvent);
  renderTable();
  if (state.status === 'finished') showGameOverModal();
}

function handleGameEvent(ev) {
  if (ev.type === 'chest') {
    showToast(ev.playerId === 'me' ? `👑 Вы собрали сундучок «${ev.rank}»! (+1 очко)` : `📦 ${ev.playerName} собрал сундучок «${ev.rank}»!`, 'chest', 3500);
    lastActionSummary = `👑 ${ev.playerName} собрал сундучок «${ev.rank}»!`;
    if (ev.playerId !== 'me') showSpeechBubble(ev.playerId, `Сундучок «${ev.rank}» мой! 🏆`, 'steal', 3500);
    sounds.playChest();
  } else if (ev.type === 'rank_no') {
    if (ev.activeId === 'me') {
      showToast(`💨 ${ev.targetName}: «НЕТ, таких карт нет!»`, 'miss', 2500);
      showSpeechBubble(ev.targetId, `«${ev.rank}» нет!`, 'no');
      lastActionSummary = `Вы спросили «${ev.rank}» у ${ev.targetName} ➔ «НЕТ» (Мимо)`;
    } else {
      showSpeechBubble(ev.activeId, `Есть ли «${ev.rank}»?`, 'ask');
      setTimeout(() => showSpeechBubble(ev.targetId, 'Нет!', 'no'), 600);
      lastActionSummary = `${ev.activeName} спросил «${ev.rank}» у ${ev.targetName} ➔ «НЕТ» (Мимо)`;
    }
    sounds.playMiss();
  } else if (ev.type === 'rank_yes') {
    if (ev.activeId === 'me') {
      showToast(`💬 ${ev.targetName}: «ДА, у меня есть «${ev.rank}»! Назовите количество!»`, 'chest', 3200);
      showSpeechBubble(ev.targetId, `Да, есть «${ev.rank}»!`, 'yes');
      lastActionSummary = `Вы спросили «${ev.rank}» у ${ev.targetName} ➔ «ДА, есть!»`;
    } else {
      showSpeechBubble(ev.activeId, `Есть ли «${ev.rank}»?`, 'ask');
      setTimeout(() => showSpeechBubble(ev.targetId, `Да, есть «${ev.rank}»!`, 'yes'), 600);
      lastActionSummary = `${ev.activeName} спросил «${ev.rank}» у ${ev.targetName} ➔ «ДА, есть!»`;
    }
    sounds.playSuccess();
  } else if (ev.type === 'count_correct') {
    if (ev.activeId === 'me') {
      showToast(`🎯 Вы угадали количество (${ev.count} шт.)! Теперь назовите масти!`, 'chest', 3500);
      showSpeechBubble(ev.targetId, `В точку (${ev.count} шт.)!`, 'yes');
      lastActionSummary = `Вы угадали кол-во «${ev.rank}» (${ev.count} шт.)! Назовите масти`;
    } else {
      showToast(`🎯 ${ev.activeName} угадал количество (${ev.count} шт.)! Называет масти...`, 'chest', 3500);
      showSpeechBubble(ev.activeId, `У тебя их ${ev.count} шт.?`, 'ask');
      setTimeout(() => showSpeechBubble(ev.targetId, `В точку! Назови масти.`, 'yes'), 700);
      lastActionSummary = `${ev.activeName} угадал кол-во «${ev.rank}» (${ev.count} шт.)!`;
    }
    sounds.playSuccess();
  } else if (ev.type === 'count_fail') {
    if (ev.activeId === 'me') {
      showToast(`❌ Вы ошиблись с количеством (${ev.guessedCount} шт.)!`, 'miss', 3000);
      showSpeechBubble(ev.targetId, `Не угадал количество!`, 'no');
      lastActionSummary = `Вы назвали ${ev.guessedCount} шт. «${ev.rank}» ➔ ❌ Не угадали`;
    } else {
      showToast(`❌ ${ev.activeName} ошибся с количеством!`, 'miss', 3000);
      showSpeechBubble(ev.activeId, `У тебя их ${ev.guessedCount} шт.?`, 'ask');
      setTimeout(() => showSpeechBubble(ev.targetId, `Не угадал!`, 'no'), 700);
      lastActionSummary = `${ev.activeName} назвал ${ev.guessedCount} шт. «${ev.rank}» ➔ ❌ Мимо`;
    }
    sounds.playMiss();
  } else if (ev.type === 'suits_success') {
    const suitsStr = ev.suits.join(' ');
    if (ev.targetId === 'me') {
      showToast(`⚠️ ${ev.activeName} угадал масти (${suitsStr}) и забрал ${ev.count} шт. «${ev.rank}»!`, 'danger', 3500);
      showSpeechBubble(ev.activeId, `Масти: ${suitsStr}! Забираю!`, 'steal', 3800);
      lastActionSummary = `⚠️ ${ev.activeName} угадал (${suitsStr}) и забрал ${ev.count} шт. «${ev.rank}» у Вас!`;
      animateStolenCards(ev.rank);
      sounds.playMiss();
      setTimeout(() => renderTable(), 750);
    } else if (ev.activeId === 'me') {
      showToast(`🌟 Вы угадали масти (${suitsStr})! Забрали ${ev.count} шт. «${ev.rank}»!`, 'success', 3500);
      showSpeechBubble(ev.targetId, `Верно (${suitsStr})... Забирай!`, 'steal', 3500);
      lastActionSummary = `🌟 Вы угадали (${suitsStr}) и забрали ${ev.count} шт. «${ev.rank}»!`;
      sounds.playSuccess();
    } else {
      showSpeechBubble(ev.activeId, `Масти: ${suitsStr}! Забираю!`, 'steal', 3500);
      lastActionSummary = `${ev.activeName} забрал ${ev.count} шт. «${ev.rank}» (${suitsStr}) у ${ev.targetName}`;
      sounds.playSuccess();
    }
  } else if (ev.type === 'suits_fail') {
    const suitsStr = ev.suits.join(' ');
    if (ev.activeId === 'me') {
      showToast(`💨 Ошибка в мастях (${suitsStr})! Карты остаются у соперника.`, 'miss', 3000);
      showSpeechBubble(ev.targetId, `Масти не те!`, 'no');
      lastActionSummary = `Вы назвали (${suitsStr}) ➔ 💨 Не угадали масти`;
    } else {
      showToast(`💨 ${ev.activeName} ошибся в мастях!`, 'miss', 3000);
      showSpeechBubble(ev.activeId, `Масти: ${suitsStr}?`, 'ask');
      setTimeout(() => showSpeechBubble(ev.targetId, `Масти не те!`, 'no'), 700);
      lastActionSummary = `${ev.activeName} назвал (${suitsStr}) ➔ 💨 Ошибка в мастях`;
    }
    sounds.playMiss();
  }
}

function renderTable() {
  const me = gameState.players.find(p => p.id === 'me') || { hand: [], chests: [] };
  const isMyTurn = gameState.activePlayerId === 'me';
  const pending = gameState.pendingQuestion;

  document.getElementById('my-player-name').textContent = me.name || 'Вы';
  document.getElementById('my-chests-badge').textContent = `Сундучки: ${me.chests.length} 🏆`;
  document.getElementById('deck-count-badge').textContent = `Колода: ${gameState.deckCount}`;
  const deckStack = document.getElementById('deck-visual-stack');
  deckStack.innerHTML = '';
  if (gameState.deckCount > 0) deckStack.appendChild(renderCardBack());

  const banner = document.getElementById('turn-banner'), hint = document.getElementById('hand-hint');
  let bannerStatus = '';
  if (isMyTurn && pending?.askingId === 'me') {
    if (pending.stage === 'count') {
      bannerStatus = `🎯 <b>Угадайте количество</b> «${pending.rank}»!`;
      hint.textContent = `Бот подтвердил наличие! Сколько карт спросить?`;
      renderCountPicker(me.hand, pending.rank);
      suitsPickerBar.classList.add('hidden');
    } else if (pending.stage === 'suits') {
      bannerStatus = `🃏 <b>Назовите масти</b> «${pending.rank}» (${pending.guessedCount} шт.)!`;
      hint.textContent = `Выберите ровно ${pending.guessedCount} масти и нажмите «Назвать!»:`;
      countPickerBar.classList.add('hidden');
      renderSuitsPicker(me.hand, pending.rank, pending.guessedCount);
    }
  } else if (isMyTurn) {
    countPickerBar.classList.add('hidden'); suitsPickerBar.classList.add('hidden');
    bannerStatus = '⭐ <b>Ваш ход!</b>';
    hint.textContent = selectedRank ? `Карта «${selectedRank}» выбрана! Теперь кликните по боту.` : (selectedTargetId ? `Бот выбран! Теперь кликните по карте в руке.` : 'Кликните по своей карте и выберите бота для вопроса');
  } else {
    countPickerBar.classList.add('hidden'); suitsPickerBar.classList.add('hidden');
    bannerStatus = `⏳ Ходит: <b>${gameState.activePlayerName}</b>`;
    hint.textContent = 'Ожидайте хода соперников...';
    selectedTargetId = null; selectedRank = null; selectedSuits.clear();
  }

  banner.innerHTML = `
    <div class="banner-title">${bannerStatus}</div>
    ${lastActionSummary ? `<div class="banner-last-action" title="Нажмите, чтобы открыть полную историю">${lastActionSummary}</div>` : ''}
  `;

  renderOpponents(gameState.players, 'me', isMyTurn && !pending, onSelectOpponent, selectedTargetId);
  renderMyHand(me.hand, onSelectRank, selectedRank, currentTheme);
  const logEl = document.getElementById('game-log');
  logEl.innerHTML = gameState.log.map(item => `<div class="log-item ${item.type || ''}">${item.text}</div>`).join('');
  logEl.scrollTop = logEl.scrollHeight;
}

function renderCountPicker(hand, rank) {
  const maxAsk = Math.max(1, 4 - hand.filter(c => c.rank === rank).length);
  countPillsRow.innerHTML = '';
  for (let c = 1; c <= maxAsk; c++) {
    const pill = document.createElement('button');
    pill.className = 'count-pill'; pill.textContent = `${c} шт.`;
    pill.addEventListener('click', () => game.guessCount('me', c));
    countPillsRow.appendChild(pill);
  }
  countPickerBar.classList.remove('hidden');
}

function renderSuitsPicker(hand, rank, needed) {
  suitsNeededCount.textContent = needed;
  const mySuits = new Set(hand.filter(c => c.rank === rank).map(c => c.suit));
  suitsPillsRow.innerHTML = '';
  ALL_SUITS.forEach(({ s, n }) => {
    const isOwned = mySuits.has(s);
    const pill = document.createElement('button');
    pill.className = `count-pill ${selectedSuits.has(s) ? 'active' : ''} ${isOwned ? 'disabled' : ''}`;
    pill.textContent = `${s} ${n}`;
    if (!isOwned) {
      pill.addEventListener('click', () => {
        if (selectedSuits.has(s)) selectedSuits.delete(s);
        else if (selectedSuits.size < needed) selectedSuits.add(s);
        renderSuitsPicker(hand, rank, needed);
      });
    }
    suitsPillsRow.appendChild(pill);
  });
  btnSubmitSuits.disabled = selectedSuits.size !== needed;
  btnSubmitSuits.onclick = () => {
    if (selectedSuits.size === needed) {
      const suitsArr = Array.from(selectedSuits);
      selectedSuits.clear();
      suitsPickerBar.classList.add('hidden');
      game.guessSuits('me', suitsArr);
    }
  };
  suitsPickerBar.classList.remove('hidden');
}

function onSelectRank(rank) {
  if (gameState?.activePlayerId !== 'me' || gameState?.pendingQuestion) return;
  selectedRank = rank;
  if (selectedTargetId) { const t = selectedTargetId; selectedTargetId = null; selectedRank = null; game.askRank('me', t, rank); }
  else renderTable();
}

function onSelectOpponent(targetId) {
  if (gameState?.activePlayerId !== 'me' || gameState?.pendingQuestion) return;
  selectedTargetId = targetId;
  if (selectedRank) { const r = selectedRank; selectedTargetId = null; selectedRank = null; game.askRank('me', targetId, r); }
  else renderTable();
}

function showGameOverModal() {
  const modal = document.getElementById('modal-game-over'), scoreboard = document.getElementById('winner-scoreboard');
  const sorted = [...gameState.players].sort((a, b) => b.chests.length - a.chests.length);
  scoreboard.innerHTML = sorted.map((p, idx) => `<div class="score-row"><span>${idx === 0 ? '🥇' : '🥈'} ${p.name}</span><span>${p.chests.length} сундучков</span></div>`).join('');
  modal.classList.remove('hidden'); sounds.playSuccess();
}

document.getElementById('btn-play-again').addEventListener('click', () => { document.getElementById('modal-game-over').classList.add('hidden'); switchView('welcome'); });
