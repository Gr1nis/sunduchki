import { sounds } from './sound.js';
import { switchView, renderOpponents, renderMyHand, showToast, animateStolenCards } from './ui.js';
import { renderCardBack } from './cardRenderer.js';
import { LocalGame } from './localGame.js';

let game = null;
let gameState = null;
let selectedTargetId = null;
let selectedRank = null;
let selectedCount = 1;
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
  selectedCount = 1;
  newGameBtn.classList.remove('hidden');

  game = new LocalGame((state) => handleGameState(state));
  game.start({ playerName, deckType, botCount });
  switchView('game');
});

function handleGameState(state) {
  const prevLogLen = gameState?.log?.length || 0;
  gameState = state;

  if (state.stolenEvent) {
    const ev = state.stolenEvent;
    if (ev.targetId === 'me') {
      showToast(`⚠️ ${ev.activeName} забрал у вас ${ev.count} шт. «${ev.rank}»!`, 'danger', 3500);
      animateStolenCards(ev.rank);
      sounds.playMiss();
    } else if (state.activePlayerId === 'me') {
      showToast(`🎉 Вы забрали ${ev.count} шт. «${ev.rank}» у ${ev.targetName}!`, 'success', 3000);
      sounds.playSuccess();
    }
  }

  renderTable();

  if (state.log.length > prevLogLen && !state.stolenEvent) {
    const latest = state.log[state.log.length - 1];
    if (latest.type === 'success') sounds.playSuccess();
    else if (latest.type === 'miss') sounds.playMiss();
    else if (latest.type === 'chest') sounds.playChest();
    else sounds.playCardDeal();
  }

  if (state.status === 'finished') showGameOverModal();
}

function renderTable() {
  const me = gameState.players.find(p => p.id === 'me') || { hand: [], chests: [] };
  const isMyTurn = gameState.activePlayerId === 'me';

  document.getElementById('my-player-name').textContent = me.name || 'Вы';
  document.getElementById('my-chests-badge').textContent = `Сундучки: ${me.chests.length} 🏆`;
  document.getElementById('deck-count-badge').textContent = `Колода: ${gameState.deckCount}`;

  const deckStack = document.getElementById('deck-visual-stack');
  deckStack.innerHTML = '';
  if (gameState.deckCount > 0) deckStack.appendChild(renderCardBack());

  const banner = document.getElementById('turn-banner');
  const hint = document.getElementById('hand-hint');

  if (isMyTurn) {
    banner.textContent = '⭐ Ваш ход!';
    banner.style.borderColor = '#f59e0b';
    if (selectedRank && selectedTargetId) {
      hint.textContent = `Спрашиваем «${selectedRank}» (${selectedCount} шт.)...`;
    } else if (selectedRank) {
      hint.textContent = `Карта «${selectedRank}» выбрана! Теперь кликните по боту, у кого спросить.`;
    } else if (selectedTargetId) {
      hint.textContent = `Бот выбран! Теперь кликните по карте в руке.`;
    } else {
      hint.textContent = 'Кликните по своей карте и выберите бота для вопроса';
    }
  } else {
    banner.textContent = `Ходит: ${gameState.activePlayerName}`;
    banner.style.borderColor = 'rgba(255,255,255,0.2)';
    hint.textContent = 'Ожидайте хода соперников...';
    selectedTargetId = null;
    selectedRank = null;
  }

  updateCountPicker(me.hand, isMyTurn);

  renderOpponents(gameState.players, 'me', isMyTurn, (targetId) => {
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

function updateCountPicker(hand, isMyTurn) {
  if (!isMyTurn || !selectedRank) {
    countPickerBar.classList.add('hidden');
    return;
  }
  const myCardsOfRank = hand.filter(c => c.rank === selectedRank).length;
  const maxAsk = Math.max(1, 4 - myCardsOfRank);

  countPillsRow.innerHTML = '';
  for (let c = 1; c <= maxAsk; c++) {
    const pill = document.createElement('button');
    pill.className = `count-pill ${c === selectedCount ? 'active' : ''}`;
    pill.textContent = `${c} шт.`;
    pill.addEventListener('click', (e) => {
      e.stopPropagation();
      selectedCount = c;
      updateCountPicker(hand, isMyTurn);
    });
    countPillsRow.appendChild(pill);
  }
  countPickerBar.classList.remove('hidden');
}

function onSelectRank(rank) {
  if (gameState?.activePlayerId !== 'me') return;
  selectedRank = rank;
  selectedCount = 1;

  if (selectedTargetId) {
    fireTurn(selectedTargetId, selectedRank, selectedCount);
  } else {
    renderTable();
  }
}

function onSelectOpponent(targetId) {
  if (gameState?.activePlayerId !== 'me') return;
  selectedTargetId = targetId;

  if (selectedRank) {
    fireTurn(selectedTargetId, selectedRank, selectedCount);
  } else {
    renderTable();
  }
}

function fireTurn(targetId, rank, count) {
  if (!game) return;
  const tId = targetId;
  const rk = rank;
  const cnt = count;
  selectedTargetId = null;
  selectedRank = null;
  selectedCount = 1;
  countPickerBar.classList.add('hidden');
  game.playTurn('me', tId, rk, cnt);
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
