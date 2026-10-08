import { renderCardElement, renderCardBack } from './cardRenderer.js';

export function switchView(viewName) {
  ['welcome', 'lobby', 'game'].forEach(v => {
    const el = document.getElementById(`view-${v}`);
    if (el) el.classList.toggle('hidden', v !== viewName);
  });
}

export function updateLobbyUI(gameState, isHost) {
  const roomCodeEl = document.getElementById('lobby-room-code');
  const countEl = document.getElementById('lobby-player-count');
  const listEl = document.getElementById('lobby-players-list');
  const startBtn = document.getElementById('btn-start-game');
  const addBotBtn = document.getElementById('btn-add-bot');

  if (roomCodeEl) roomCodeEl.textContent = gameState.id;
  if (countEl) countEl.textContent = gameState.players.length;
  if (startBtn) startBtn.style.display = isHost ? 'block' : 'none';
  if (addBotBtn) addBotBtn.style.display = isHost ? 'block' : 'none';

  if (listEl) {
    listEl.innerHTML = gameState.players.map(p => `
      <div class="lobby-player-item">
        <span>${p.isBot ? '🤖' : '👤'} ${p.name} ${p.isHost ? '<span class="player-host-tag">ХОСТ</span>' : ''}</span>
        <span>Готов</span>
      </div>
    `).join('');
  }
}

export function renderOpponents(players, myId, isMyTurn, onSelectTarget, selectedTargetId) {
  const arena = document.getElementById('opponents-arena');
  if (!arena) return;
  arena.innerHTML = '';

  const opponents = players.filter(p => p.id !== myId);
  opponents.forEach(p => {
    const seat = document.createElement('div');
    const isSelected = selectedTargetId === p.id;
    seat.id = `seat-${p.id}`;
    seat.className = `opponent-seat ${p.isTurn ? 'is-turn' : ''} ${isMyTurn && p.cardCount > 0 ? 'selectable' : ''} ${isSelected ? 'selected' : ''}`;
    
    // Compact card stack
    const stack = document.createElement('div');
    stack.className = 'opponent-card-stack';
    const visualCards = p.cardCount > 0 ? Math.min(p.cardCount, 3) : 0;
    for (let i = 0; i < visualCards; i++) {
      const back = renderCardBack({ size: 'small' });
      back.classList.add(`stack-card-${i}`);
      stack.appendChild(back);
    }
    const countBadge = document.createElement('span');
    countBadge.className = 'stack-count-badge';
    countBadge.innerHTML = `🎴 <b>${p.cardCount}</b>`;
    stack.appendChild(countBadge);

    seat.innerHTML = `
      <div class="opponent-name">${p.isBot ? '🤖' : '👤'} ${p.name}</div>
      <div class="opponent-chests">Сундучки: ${p.chests.length} 🏆</div>
    `;
    seat.insertBefore(stack, seat.children[1]);

    if (isMyTurn && p.cardCount > 0) {
      seat.addEventListener('click', () => onSelectTarget(p.id));
    }
    arena.appendChild(seat);
  });
}

export function renderMyHand(hand, onSelectRank, selectedRank, theme) {
  const container = document.getElementById('my-cards-row');
  if (!container) return;
  container.innerHTML = '';

  const groups = {};
  hand.forEach(card => {
    if (!groups[card.rank]) groups[card.rank] = [];
    groups[card.rank].push(card);
  });

  Object.keys(groups).forEach(rank => {
    const cards = groups[rank];
    const isSelected = selectedRank === rank;
    const groupEl = document.createElement('div');
    groupEl.className = `card-rank-group ${isSelected ? 'selected-group' : ''}`;
    groupEl.dataset.rank = rank;
    groupEl.title = `Номинал: ${rank} (${cards.length} шт.)`;

    cards.forEach(card => {
      const cardEl = renderCardElement(card, {
        isSelected,
        theme,
        isInteractive: true,
        onClick: () => onSelectRank(rank)
      });
      groupEl.appendChild(cardEl);
    });

    groupEl.addEventListener('click', () => onSelectRank(rank));
    container.appendChild(groupEl);
  });
}

export function showToast(message, type = 'info', duration = 3000) {
  const existing = document.querySelector('.game-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `game-toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.4s ease';
    setTimeout(() => toast.remove(), 400);
  }, duration);
}

export function animateStolenCards(rank) {
  const cards = document.querySelectorAll(`.game-card[data-rank="${rank}"]`);
  cards.forEach(c => c.classList.add('card-stolen'));
}

export function showSpeechBubble(playerId, text, mood = 'ask', duration = 3200) {
  const seat = document.getElementById(`seat-${playerId}`);
  if (!seat) return;

  const old = seat.querySelector('.bot-speech-bubble');
  if (old) old.remove();

  const bubble = document.createElement('div');
  bubble.className = `bot-speech-bubble mood-${mood}`;
  bubble.innerHTML = `<span class="bubble-text">${text}</span>`;
  seat.appendChild(bubble);

  setTimeout(() => {
    bubble.classList.add('fading');
    setTimeout(() => bubble.remove(), 350);
  }, duration);
}
