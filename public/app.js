import { sounds } from './sound.js';
import { switchView, updateLobbyUI, renderOpponents, renderMyHand } from './ui.js';
import { renderCardBack } from './cardRenderer.js';
import { LocalGame } from './localGame.js';

let socket = null;
try {
  socket = io();
} catch (e) {
  console.log('Socket.io offline mode');
}

let myId = null;
let currentRoomId = null;
let isHost = false;
let gameState = null;
let selectedTargetId = null;
let selectedRank = null;
let currentTheme = 'royal';
let isLocalMode = false;
let localEngine = null;

// DOM Elements
const soundBtn = document.getElementById('btn-sound-toggle');
const themeSelect = document.getElementById('theme-selector');
const leaveBtn = document.getElementById('btn-leave-room');
const roomBadge = document.getElementById('room-badge');
const headerRoomCode = document.getElementById('header-room-code');

soundBtn.addEventListener('click', () => {
  const muted = sounds.toggleMute();
  soundBtn.textContent = muted ? '🔇' : '🔊';
});

themeSelect.addEventListener('change', (e) => {
  currentTheme = e.target.value;
  document.body.className = `theme-${currentTheme}`;
  if (gameState) renderTable();
});

// URL Param Check
const urlParams = new URLSearchParams(window.location.search);
const roomParam = urlParams.get('room');
if (roomParam) {
  document.getElementById('input-room-code').value = roomParam.toUpperCase();
}

// Welcome Screen Handlers
document.getElementById('btn-create-room').addEventListener('click', () => {
  const playerName = document.getElementById('input-player-name').value.trim() || 'Игрок';
  const deckType = document.getElementById('select-deck-type').value;
  socket.emit('create_room', { playerName, deckType });
});

document.getElementById('btn-join-room').addEventListener('click', () => {
  const playerName = document.getElementById('input-player-name').value.trim() || 'Игрок';
  const roomId = document.getElementById('input-room-code').value.trim();
  if (!roomId) return alert('Пожалуйста, введите код комнаты');
  socket.emit('join_room', { roomId, playerName });
});

document.getElementById('btn-quick-bot').addEventListener('click', () => {
  const playerName = document.getElementById('input-player-name').value.trim() || 'Игрок';
  const deckType = document.getElementById('select-deck-type').value;

  if (!socket || !socket.connected) {
    isLocalMode = true;
    myId = 'me';
    currentRoomId = 'SOLO';
    isHost = true;
    roomBadge.classList.remove('hidden');
    leaveBtn.classList.remove('hidden');
    headerRoomCode.textContent = 'ОФФЛАЙН';
    localEngine = new LocalGame((state) => handleGameState(state));
    localEngine.start({ playerName, deckType, botCount: 3 });
    return;
  }

  socket.emit('create_room', { playerName, deckType });
  socket.once('room_joined', ({ roomId }) => {
    socket.emit('add_bot', { roomId });
    socket.emit('add_bot', { roomId });
    socket.emit('add_bot', { roomId });
    setTimeout(() => socket.emit('start_game', { roomId }), 300);
  });
});

// Lobby Handlers
document.getElementById('btn-add-bot').addEventListener('click', () => {
  if (currentRoomId && socket?.connected) socket.emit('add_bot', { roomId: currentRoomId });
});

document.getElementById('btn-start-game').addEventListener('click', () => {
  if (currentRoomId && socket?.connected) socket.emit('start_game', { roomId: currentRoomId });
});

document.getElementById('btn-copy-link').addEventListener('click', () => {
  const link = `${window.location.origin}${window.location.pathname}?room=${currentRoomId}`;
  navigator.clipboard.writeText(link).then(() => alert('Ссылка скопирована в буфер обмена!'));
});

// Socket Events
if (socket) {
  socket.on('connect', () => { myId = socket.id; });

  socket.on('room_joined', (data) => {
    currentRoomId = data.roomId;
    isHost = data.isHost;
    roomBadge.classList.remove('hidden');
    leaveBtn.classList.remove('hidden');
    headerRoomCode.textContent = currentRoomId;
    switchView('lobby');
  });

  socket.on('error_msg', (msg) => alert(msg));
  socket.on('game_state', (state) => handleGameState(state));
}

function handleGameState(state) {
  const prevTurn = gameState?.turnIndex;
  const prevLogLen = gameState?.log?.length || 0;
  gameState = state;

  if (state.status === 'lobby') {
    switchView('lobby');
    updateLobbyUI(state, isHost);
  } else if (state.status === 'playing') {
    switchView('game');
    renderTable();
    if (state.log.length > prevLogLen) {
      const latest = state.log[state.log.length - 1];
      if (latest.type === 'success') sounds.playSuccess();
      else if (latest.type === 'miss') sounds.playMiss();
      else if (latest.type === 'chest') sounds.playChest();
      else sounds.playCardDeal();
    }
  } else if (state.status === 'finished') {
    renderTable();
    showGameOverModal();
  }
}

function renderTable() {
  const me = gameState.players.find(p => p.id === myId) || { hand: [], chests: [] };
  const isMyTurn = gameState.activePlayerId === myId;

  document.getElementById('my-player-name').textContent = me.name || 'Вы';
  document.getElementById('my-chests-badge').textContent = `Сундучки: ${me.chests.length} 🏆`;
  document.getElementById('deck-count-badge').textContent = `Колода: ${gameState.deckCount}`;

  // Visual stack of cards
  const deckStack = document.getElementById('deck-visual-stack');
  deckStack.innerHTML = '';
  if (gameState.deckCount > 0) deckStack.appendChild(renderCardBack());

  // Turn banner
  const banner = document.getElementById('turn-banner');
  if (isMyTurn) {
    banner.textContent = '⭐ Ваш ход! Выберите оппонента и карту';
    banner.style.borderColor = '#f59e0b';
  } else {
    banner.textContent = `Ходит: ${gameState.activePlayerName}`;
    banner.style.borderColor = 'rgba(255,255,255,0.2)';
  }

  renderOpponents(gameState.players, myId, isMyTurn, (targetId) => {
    selectedTargetId = targetId;
    checkShowActionDialog();
  }, selectedTargetId);

  renderMyHand(me.hand, (card) => {
    selectedRank = card.rank;
    checkShowActionDialog();
  }, selectedRank, currentTheme);

  // Render log
  const logEl = document.getElementById('game-log');
  logEl.innerHTML = gameState.log.map(item => `
    <div class="log-item ${item.type || ''}">${item.text}</div>
  `).join('');
  logEl.scrollTop = logEl.scrollHeight;
}

function checkShowActionDialog() {
  const isMyTurn = gameState.activePlayerId === myId;
  if (!isMyTurn) return;
  const dialog = document.getElementById('action-dialog');
  const target = gameState.players.find(p => p.id === selectedTargetId);

  if (selectedTargetId && selectedRank) {
    document.getElementById('action-dialog-summary').textContent = `Спросить «${selectedRank}» у игрока ${target?.name}?`;
    document.getElementById('btn-confirm-action').disabled = false;
    dialog.classList.remove('hidden');
  }
}

document.getElementById('btn-confirm-action').addEventListener('click', () => {
  if (selectedTargetId && selectedRank) {
    if (isLocalMode && localEngine) {
      localEngine.playTurn('me', selectedTargetId, selectedRank);
    } else if (socket?.connected) {
      socket.emit('play_turn', { roomId: currentRoomId, targetId: selectedTargetId, rank: selectedRank });
    }
    document.getElementById('action-dialog').classList.add('hidden');
    selectedTargetId = null;
    selectedRank = null;
  }
});

document.getElementById('btn-cancel-action').addEventListener('click', () => {
  document.getElementById('action-dialog').classList.add('hidden');
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
  window.location.reload();
});

leaveBtn.addEventListener('click', () => {
  window.location.href = window.location.origin;
});
