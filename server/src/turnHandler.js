import { sortHand, checkChests, refillIfEmpty } from './gameLogic.js';

export function handleTurn(room, askingPlayerId, targetPlayerId, rank) {
  const activePlayer = room.players[room.turnIndex];
  if (!activePlayer || activePlayer.id !== askingPlayerId) {
    return { error: 'Сейчас не ваш ход' };
  }

  const targetPlayer = room.players.find(p => p.id === targetPlayerId);
  if (!targetPlayer || targetPlayer.id === askingPlayerId) {
    return { error: 'Неверно выбран оппонент' };
  }

  // Active player must have at least one card of the requested rank
  const hasRank = activePlayer.hand.some(c => c.rank === rank);
  if (!hasRank) {
    return { error: `У вас нет карты номинала ${rank}!` };
  }

  const matchedCards = targetPlayer.hand.filter(c => c.rank === rank);
  let turnResult = { success: false, cardsTaken: 0, drawnCard: null };

  if (matchedCards.length > 0) {
    // Transfer cards
    targetPlayer.hand = targetPlayer.hand.filter(c => c.rank !== rank);
    activePlayer.hand.push(...matchedCards);
    activePlayer.hand = sortHand(activePlayer.hand, room.ranks);

    turnResult.success = true;
    turnResult.cardsTaken = matchedCards.length;

    room.log.push({
      text: `${activePlayer.name} спросил у ${targetPlayer.name} «${rank}» и забрал ${matchedCards.length} шт.! ${activePlayer.name} ходит снова.`,
      time: Date.now(),
      type: 'success'
    });

    // Notify bot brains
    for (const brain of room.botBrains.values()) {
      brain.recordAsk(askingPlayerId, targetPlayerId, rank, true);
    }
  } else {
    // "Рыба" / No cards
    let drawn = null;
    if (room.deck.length > 0) {
      drawn = room.deck.pop();
      activePlayer.hand.push(drawn);
      activePlayer.hand = sortHand(activePlayer.hand, room.ranks);
      turnResult.drawnCard = drawn;
    }

    room.log.push({
      text: `${activePlayer.name} спросил у ${targetPlayer.name} «${rank}» — мимо! ${drawn ? `${activePlayer.name} берет карту из колоды.` : ''}`,
      time: Date.now(),
      type: 'miss'
    });

    // Notify bot brains
    for (const brain of room.botBrains.values()) {
      brain.recordAsk(askingPlayerId, targetPlayerId, rank, false);
    }

    // Move turn to next player
    advanceTurn(room);
  }

  // Check chests for both players
  const activeChests = checkChests(activePlayer, room.ranks);
  for (const c of activeChests) {
    room.log.push({ text: `🎉 ${activePlayer.name} собрал сундучок из «${c}»!`, time: Date.now(), type: 'chest' });
    for (const brain of room.botBrains.values()) brain.recordChest(c);
  }

  const targetChests = checkChests(targetPlayer, room.ranks);
  for (const c of targetChests) {
    room.log.push({ text: `🎉 ${targetPlayer.name} собрал сундучок из «${c}»!`, time: Date.now(), type: 'chest' });
    for (const brain of room.botBrains.values()) brain.recordChest(c);
  }

  // Check empty hand refills
  refillIfEmpty(activePlayer, room.deck);
  refillIfEmpty(targetPlayer, room.deck);

  // Check game over
  checkGameOver(room);

  return { ok: true, turnResult };
}

export function advanceTurn(room) {
  const total = room.players.length;
  if (total === 0) return;
  for (let i = 1; i <= total; i++) {
    const nextIdx = (room.turnIndex + i) % total;
    const nextPlayer = room.players[nextIdx];
    // Can play if has cards or deck has cards
    if (nextPlayer.hand.length > 0 || room.deck.length > 0) {
      room.turnIndex = nextIdx;
      return;
    }
  }
}

export function checkGameOver(room) {
  const totalChests = room.players.reduce((sum, p) => sum + p.chests.length, 0);
  const totalPossible = room.ranks.length;
  const cardsInHands = room.players.reduce((sum, p) => sum + p.hand.length, 0);

  if (totalChests >= totalPossible || (room.deck.length === 0 && cardsInHands === 0)) {
    room.status = 'finished';
    // Calculate winners
    let maxChests = -1;
    let winners = [];
    for (const p of room.players) {
      if (p.chests.length > maxChests) {
        maxChests = p.chests.length;
        winners = [p.name];
      } else if (p.chests.length === maxChests) {
        winners.push(p.name);
      }
    }
    room.log.push({
      text: `🏆 Игра окончена! Победитель: ${winners.join(', ')} (${maxChests} сундучков)!`,
      time: Date.now(),
      type: 'winner'
    });
  }
}
