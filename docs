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
    seat.className = `opponent-seat ${p.isTurn ? 'is-turn' : ''} ${isMyTurn && p.cardCount > 0 ? 'selectable' : ''} ${isSelected ? 'selected' : ''}`;
    
    // Mini cards fan
    const cardsFan = document.createElement('div');
    cardsFan.style.display = 'flex';
    cardsFan.style.gap = '-15px';
    cardsFan.style.margin = '4px 0';
    for (let i = 0; i < Math.min(p.cardCount, 8); i++) {
      cardsFan.appendChild(renderCardBack({ size: 'small' }));
    }

    seat.innerHTML = `
      <div class="opponent-name">${p.isBot ? '🤖' : '👤'} ${p.name}</div>
      <div class="opponent-cards-badge">Карт: ${p.cardCount}</div>
      <div class="opponent-chests">Сундучки: ${p.chests.length} 🏆</div>
    `;
    seat.insertBefore(cardsFan, seat.children[1]);

    if (isMyTurn && p.cardCount > 0) {
      seat.addEventListener('click', () => onSelectTarget(p.id));
    }
    arena.appendChild(seat);
  });
}

export function renderMyHand(hand, onSelectCard, selectedCardRank, theme) {
  const container = document.getElementById('my-cards-row');
  if (!container) return;
  container.innerHTML = '';

  hand.forEach(card => {
    const isSelected = selectedCardRank === card.rank;
    const cardEl = renderCardElement(card, {
      isSelected,
      theme,
      isInteractive: true,
      onClick: () => onSelectCard(card)
    });
    container.appendChild(cardEl);
  });
}
