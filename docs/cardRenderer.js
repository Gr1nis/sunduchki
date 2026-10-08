export const SUIT_SYMBOLS = {
  '♠': { char: '♠', name: 'spades', colorClass: 'suit-dark' },
  '♥': { char: '♥', name: 'hearts', colorClass: 'suit-red' },
  '♦': { char: '♦', name: 'diamonds', colorClass: 'suit-red' },
  '♣': { char: '♣', name: 'clubs', colorClass: 'suit-dark' }
};

export const FACE_ICONS = {
  'J': '⚔️',
  'Q': '👑',
  'K': '🏰',
  'A': '⚜️'
};

export function renderCardElement(card, options = {}) {
  const { isSelected = false, onClick = null, theme = 'classic', isInteractive = true } = options;
  const suitInfo = SUIT_SYMBOLS[card.suit] || { char: card.suit, colorClass: 'suit-dark' };
  const faceIcon = FACE_ICONS[card.rank] || suitInfo.char;

  const cardEl = document.createElement('div');
  cardEl.className = `game-card theme-${theme} ${suitInfo.colorClass} ${isSelected ? 'selected' : ''} ${isInteractive ? 'interactive' : ''}`;
  cardEl.dataset.rank = card.rank;
  cardEl.dataset.suit = card.suit;

  cardEl.innerHTML = `
    <div class="card-corner top-left">
      <span class="card-rank">${card.rank}</span>
      <span class="card-suit">${suitInfo.char}</span>
    </div>
    <div class="card-center">
      <span class="card-center-icon">${faceIcon}</span>
      <span class="card-center-rank">${card.rank}</span>
    </div>
    <div class="card-corner bottom-right">
      <span class="card-rank">${card.rank}</span>
      <span class="card-suit">${suitInfo.char}</span>
    </div>
  `;

  if (onClick && isInteractive) {
    cardEl.addEventListener('click', () => onClick(card));
  }

  return cardEl;
}

export function renderCardBack(options = {}) {
  const { backStyle = 'back-royal-blue', size = 'normal' } = options;
  const backEl = document.createElement('div');
  backEl.className = `game-card-back ${backStyle} size-${size}`;
  backEl.innerHTML = `
    <div class="card-back-pattern">
      <div class="card-back-emblem">🎴</div>
    </div>
  `;
  return backEl;
}
