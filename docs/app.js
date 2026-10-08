import { sounds } from './sound.js';
import { switchView, renderOpponents, renderMyHand } from './ui.js';
import { renderCardBack } from './cardRenderer.js';
import { LocalGame } from './localGame.js';

let game = null;
let gameState = null;
let selectedTargetId = null;
let selectedRank = null;
let currentTheme = 'royal';

// DOM Elements
const soundBtn = document.getElementById('btn-sound-toggle');
const themeSelect = document.getElementById('theme-selector');
const newGameBtn = document.getElementById('btn-new-game');
const startBtn = document.getElementById('btn-start-bot-game');
const actionDialog = document.getElementById('action-dialog');
const confirmActionBtn = document.getElementById('btn-confirm-action');
const cancelActionBtn = document.getElementById('btn-cancel-action');

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
  const prevLogLen = gameState?.log?.length || 0;
  gameState = state;

  renderTable();

  if (state.log.length > prevLogLen) {
    const latest = state.log[state.log.length - 1];
    if (latest.type === 'success') sounds.playSuccess();
    else if (latest.type === 'miss') sounds.playMiss();
    else if (latest.type === 'chest') sounds.playChest();
    else sounds.playCardDeal();
  }

  if (state.status === 'finished') {
    showGameOverModal();
  }
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
    hint.textContent = selectedRank && selectedTargetId
      ? `Готово: спросить «${selectedRank}»`
      : 'Кликните по своей карте и выберите бота для вопроса';
  } else {
    banner.textContent = `Ходит: ${gameState.activePlayerName}`;
    banner.style.borderColor = 'rgba(255,255,255,0.2)';
    hint.textContent = 'Ожидайте хода соперников...';
  }

  renderOpponents(gameState.players, 'me', isMyTurn, (targetId) => {
    selectedTargetId = targetId;
    checkPromptAction();
  }, selectedTargetId);

  renderMyHand(me.hand, (card) => {
    selectedRank = card.rank;
    checkPromptAction();
  }, selectedRank, currentTheme);

  const logEl = document.getElementById('game-log');
  logEl.innerHTML = gameState.log.map(item => `
    <div class="log-item ${item.type || ''}">${item.text}</div>
  `).join('');
  logEl.scrollTop = logEl.scrollHeight;
}

function checkPromptAction() {
  const isMyTurn = gameState.activePlayerId === 'me';
  if (!isMyTurn) return;

  if (selectedTargetId && selectedRank) {
    const target = gameState.players.find(p => p.id === selectedTargetId);
    document.getElementById('action-dialog-summary').textContent = `Спросить «${selectedRank}» у ${target?.name}?`;
    confirmActionBtn.disabled = false;
    actionDialog.classList.remove('hidden');
  }
}

confirmActionBtn.addEventListener('click', () => {
  if (selectedTargetId && selectedRank && game) {
    actionDialog.classList.add('hidden');
    game.playTurn('me', selectedTargetId, selectedRank);
    selectedTargetId = null;
    selectedRank = null;
  }
});

cancelActionBtn.addEventListener('click', () => {
  actionDialog.classList.add('hidden');
  selectedTargetId = null;
  selectedRank = null;
  renderTable();
});

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
