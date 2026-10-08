const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS_36 = ['6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const RANKS_52 = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

export function createDeck(deckType = '36') {
  const ranks = deckType === '52' ? RANKS_52 : RANKS_36;
  const deck = [];
  for (const rank of ranks) {
    for (const suit of SUITS) {
      deck.push({ rank, suit, id: `${rank}_${suit}` });
    }
  }
  // Fisher-Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return { deck, ranks };
}

export function sortHand(cards, ranks) {
  const rankOrder = ranks.reduce((acc, r, i) => ({ ...acc, [r]: i }), {});
  const suitOrder = { '♠': 0, '♥': 1, '♦': 2, '♣': 3 };
  return [...cards].sort((a, b) => {
    if (rankOrder[a.rank] !== rankOrder[b.rank]) {
      return rankOrder[a.rank] - rankOrder[b.rank];
    }
    return (suitOrder[a.suit] || 0) - (suitOrder[b.suit] || 0);
  });
}

export function checkChests(player, ranks) {
  const counts = {};
  for (const card of player.hand) {
    counts[card.rank] = (counts[card.rank] || 0) + 1;
  }
  const completedRanks = Object.keys(counts).filter(r => counts[r] === 4);
  if (completedRanks.length > 0) {
    for (const rank of completedRanks) {
      player.chests.push(rank);
      player.hand = player.hand.filter(c => c.rank !== rank);
    }
  }
  return completedRanks;
}

export function refillIfEmpty(player, drawPile) {
  if (player.hand.length === 0 && drawPile.length > 0) {
    const card = drawPile.pop();
    player.hand.push(card);
    return card;
  }
  return null;
}
