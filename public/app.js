import { sounds } from './sound.js';
import { switchView, renderOpponents, renderMyHand, showToast, animateStolenCards } from './ui.js';
import { renderCardBack } from './cardRenderer.js';
import { LocalGame } from './localGame.js';

let game = null;
let gameState = null;
let selectedTargetId = null;
let selectedRank = null;
let currentTheme = 'royal';

const soundBtn = document.getElementById('btn-sound-toggle');
const themeSelect = document.getElementById('theme-selector');
const newGameBtn = document.getElementById('btn-new-game');
const startBtn = document.getElementById('btn-start-bot-game');
const countPickerBar = document.getElementById('count-picker-bar');
const countPillsRow = document.getElementById('count-pills-row');

soundBtn.addEventListener('click', () => {
  const muted = sounds.toggleMute();
  soundBtn.textContent = muted ? '🔇' : '🔊';
});

themeSelect.addEventListener('change', (e) => {
  currentTheme = e.target.value;
  document.body.className = `theme-${currentTheme}`;
  if (gameState) renderTable();
});

newGameBtn.addEventListener('click', () => {
  switchView('welcome');
  newGameBtn.classList.add('hidden');
});

startBtn.addEventListener('click', () => {
  const playerName = document.getElementById('input-player-name').value.trim() || 'Игрок';
  const deckType = document.getElementById('select-deck-type').value;
  const botCount = parseInt(document.getElementById('select-bot-count').value, 10) || 3;

  selectedTargetId = null;
  selectedRank = null;
  newGameBtn.classList.remove('hidden');

  game = new LocalGame((state) => handleGameState(state));
  game.start({ playerName, deckType, botCount });
  switchView('game');
});

function handleGameState(state) {
  gameState = state;

  if (state.gameEvent) {
    const ev = state.gameEvent;
    if (ev.type === 'chest') {
      if (ev.playerId === 'me') {
        showToast(`👑 Вы собрали сундучок из «${ev.rank}»! (+1 балл, ход продолжается!)`, 'chest', 4000);
      } else {
        showToast(`📦 ${ev.playerName} собрал сундучок из «${ev.rank}»!`, 'info', 3000);
      }
      sounds.playChest();
    } else if (ev.type === 'rank_no') {
      if (ev.activeId === 'me') {
        showToast(`💨 ${ev.targetName}: «НЕТ, таких карт нет!»`, 'miss', 2500);
      }
      sounds.playMiss();
    } else if (ev.type === 'rank_yes') {
      if (ev.activeId === 'me') {
        showToast(`💬 ${ev.targetName}: «ДА, у меня есть «${ev.rank}»! Назовите количество!»`, 'chest', 3500);
      } else {
        showToast(`💬 ${ev.targetName}: «ДА, у меня есть «${ev.rank}»!»`, 'info', 2500);
      }
      sounds.playSuccess();
    } else if (ev.type === 'count_success') {
      if (ev.targetId === 'me') {
        showToast(`⚠️ ${ev.activeName} забрал у вас ${ev.count} шт. «${ev.rank}»!`, 'danger', 3500);
        animateStolenCards(ev.rank);
        sounds.playMiss();
        setTimeout(() => renderTable(), 750);
        return;
      } else if (ev.activeId === 'me') {
        showToast(`🎉 Вы угадали количество! Забрали ${ev.count} шт. «${ev.rank}» у ${ev.targetName}!`, 'success', 3500);
        sounds.playSuccess();
      }
    } else if (ev.type === 'count_fail') {
      if (ev.activeId === 'me') {
        showToast(`❌ Вы назвали ${ev.guessedCount} шт., но ошиблись! Карты остаются у соперника.`, 'miss', 3000);
      } else {
        showToast(`❌ ${ev.activeName} не угадал количество! Карты остаются у ${ev.targetName}.`, 'miss', 2500);
      }
      sounds.playMiss();
    }
  }

  renderTable();
  if (state.status === 'finished') showGameOverModal();
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

  const banner = document.getElementById('turn-banner');
  const hint = document.getElementById('hand-hint');

  if (isMyTurn && pending && pending.askingId === 'me') {
    // Stage 2: Prompt for count!
    banner.textContent = `🎯 Угадайте количество «${pending.rank}»!`;
    banner.style.borderColor = '#22c55e';
    hint.textContent = `Бот подтвердил наличие! Выберите сколько карт спросить:`;
    renderCountPicker(me.hand, pending.rank);
  } else if (isMyTurn) {
    // Stage 1: Prompt for rank & target
    countPickerBar.classList.add('hidden');
    banner.textContent = '⭐ Ваш ход!';
    banner.style.borderColor = '#f59e0b';
    if (selectedRank) {
      hint.textContent = `Карта «${selectedRank}» выбрана! Теперь кликните по боту.`;
    } else if (selectedTargetId) {
      hint.textContent = `Бот выбран! Теперь кликните по карте в руке.`;
    } else {
      hint.textContent = 'Кликните по своей карте и выберите бота для вопроса';
    }
  } else {
    countPickerBar.classList.add('hidden');
    banner.textContent = `Ходит: ${gameState.activePlayerName}`;
    banner.style.borderColor = 'rgba(255,255,255,0.2)';
    hint.textContent = 'Ожидайте хода соперников...';
    selectedTargetId = null;
    selectedRank = null;
  }

  renderOpponents(gameState.players, 'me', isMyTurn && !pending, (targetId) => {
    onSelectOpponent(targetId);
  }, selectedTargetId);

  renderMyHand(me.hand, (rank) => {
    onSelectRank(rank);
  }, selectedRank, currentTheme);

  const logEl = document.getElementById('game-log');
  logEl.innerHTML = gameState.log.map(item => `
    <div class="log-item ${item.type || ''}">${item.text}</div>
  `).join('');
  logEl.scrollTop = logEl.scrollHeight;
}

function renderCountPicker(hand, rank) {
  const myCardsOfRank = hand.filter(c => c.rank === rank).length;
  const maxAsk = Math.max(1, 4 - myCardsOfRank);

  countPillsRow.innerHTML = '';
  for (let c = 1; c <= maxAsk; c++) {
    const pill = document.createElement('button');
    pill.className = 'count-pill';
    pill.textContent = `${c} шт.`;
    pill.addEventListener('click', () => {
      game.guessCount('me', c);
    });
    countPillsRow.appendChild(pill);
  }
  countPickerBar.classList.remove('hidden');
}

function onSelectRank(rank) {
  if (gameState?.activePlayerId !== 'me' || gameState?.pendingQuestion) return;
  selectedRank = rank;

  if (selectedTargetId) {
    const target = selectedTargetId;
    selectedTargetId = null;
    selectedRank = null;
    game.askRank('me', target, rank);
  } else {
    renderTable();
  }
}

function onSelectOpponent(targetId) {
  if (gameState?.activePlayerId !== 'me' || gameState?.pendingQuestion) return;
  selectedTargetId = targetId;

  if (selectedRank) {
    const rk = selectedRank;
    selectedTargetId = null;
    selectedRank = null;
    game.askRank('me', targetId, rk);
  } else {
    renderTable();
  }
}

function showGameOverModal() {
  const modal = document.getElementById('modal-game-over');
  const scoreboard = document.getElementById('winner-scoreboard');
  const sorted = [...gameState.players].sort((a, b) => b.chests.length - a.chests.length);
  scoreboard.innerHTML = sorted.map((p, idx) => `
    <div class="score-row">
      <span>${idx === 0 ? '🥇' : '🥈'} ${p.name}</span>
      <span>${p.chests.length} сундучков</span>
    </div>
  `).join('');
  modal.classList.remove('hidden');
  sounds.playSuccess();
}

document.getElementById('btn-play-again').addEventListener('click', () => {
  document.getElementById('modal-game-over').classList.add('hidden');
  switchView('welcome');
});
