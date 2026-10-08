import { LocalBotBrain } from './botLogic.js';

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS_36 = ['6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const RANKS_52 = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

export class LocalGame {
  constructor(onStateChange) {
    this.onStateChange = onStateChange;
    this.room = null;
    this.botBrains = new Map();
  }

  sortHand(cards, ranks) {
    const rankOrder = ranks.reduce((acc, r, i) => ({ ...acc, [r]: i }), {});
    const suitOrder = { '♠': 0, '♥': 1, '♦': 2, '♣': 3 };
    return [...cards].sort((a, b) => {
      if (rankOrder[a.rank] !== rankOrder[b.rank]) return (rankOrder[a.rank] || 0) - (rankOrder[b.rank] || 0);
      return (suitOrder[a.suit] || 0) - (suitOrder[b.suit] || 0);
    });
  }

  start({ playerName = 'Игрок', deckType = '36', botCount = 3 }) {
    const ranks = deckType === '52' ? RANKS_52 : RANKS_36;
    const deck = [];
    for (const r of ranks) {
      for (const s of SUITS) deck.push({ rank: r, suit: s, id: `${r}_${s}` });
    }
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    const botNames = ['Бот Добрыня', 'Бот Алёша', 'Бот Илья', 'Бот Святогор', 'Бот Василиса'];
    const players = [{ id: 'me', name: playerName, isBot: false, hand: [], chests: [], isHost: true }];
    for (let i = 0; i < botCount; i++) {
      const bId = `bot_${i + 1}`;
      players.push({ id: bId, name: botNames[i % botNames.length], isBot: true, hand: [], chests: [], isHost: false });
      this.botBrains.set(bId, new LocalBotBrain());
    }

    this.room = { id: 'LOCAL', status: 'playing', deckType, deck, ranks, players, turnIndex: 0, pendingQuestion: null, log: [{ text: `Игра началась! Раздали по 4 карты. Первый ход: ${players[0].name}.`, time: Date.now() }] };

    for (const p of this.room.players) {
      for (let i = 0; i < 4; i++) {
        if (this.room.deck.length > 0) p.hand.push(this.room.deck.pop());
      }
      p.hand = this.sortHand(p.hand, ranks);
      this.checkChests(p);
    }
    this.emitState();
    this.checkBotTurn();
  }

  checkChests(player) {
    const counts = {};
    for (const c of player.hand) counts[c.rank] = (counts[c.rank] || 0) + 1;
    let assembled = false;
    for (const r in counts) {
      if (counts[r] === 4) {
        player.chests.push(r);
        player.hand = player.hand.filter(c => c.rank !== r);
        assembled = true;
        this.room.log.push({ text: `🎉 ${player.name} собрал сундучок из «${r}»!`, time: Date.now(), type: 'chest' });
        for (const brain of this.botBrains.values()) brain.recordChest(r);
        this.emitState({ type: 'chest', playerName: player.name, playerId: player.id, rank: r });
      }
    }
    return assembled;
  }

  refillIfEmpty(player) {
    if (player.hand.length === 0 && this.room.deck.length > 0) {
      player.hand.push(this.room.deck.pop());
      player.hand = this.sortHand(player.hand, this.room.ranks);
    }
  }

  askRank(playerId, targetId, rank) {
    const active = this.room.players[this.room.turnIndex];
    if (active.id !== playerId || this.room.pendingQuestion) return;
    const target = this.room.players.find(p => p.id === targetId);
    if (!target) return;

    const matched = target.hand.filter(c => c.rank === rank);
    for (const brain of this.botBrains.values()) brain.recordAnswer(targetId, rank, matched.length > 0);

    if (matched.length === 0) {
      let drawn = this.room.deck.length > 0 ? this.room.deck.pop() : null;
      if (drawn) { active.hand.push(drawn); active.hand = this.sortHand(active.hand, this.room.ranks); }
      this.room.log.push({ text: `${active.name} спросил «${rank}» у ${target.name} — «НЕТ!» ${drawn ? `${active.name} берет карту.` : ''}`, time: Date.now(), type: 'miss' });
      const chestMade = this.checkChests(active);
      this.refillIfEmpty(active);
      if (!chestMade) this.room.turnIndex = (this.room.turnIndex + 1) % this.room.players.length;
      this.emitState({ type: 'rank_no', activeId: active.id, activeName: active.name, targetId: target.id, targetName: target.name, rank });
      this.checkBotTurn();
    } else {
      this.room.pendingQuestion = { stage: 'count', askingId: playerId, targetId, rank, actualCount: matched.length };
      this.room.log.push({ text: `💬 ${active.name} спросил «${rank}» у ${target.name} — «ДА, есть!»`, time: Date.now(), type: 'info' });
      this.emitState({ type: 'rank_yes', askingId: playerId, activeId: active.id, activeName: active.name, targetId: target.id, targetName: target.name, rank });
      if (active.isBot) {
        setTimeout(() => {
          if (!this.room?.pendingQuestion) return;
          const guess = this.botBrains.get(active.id)?.chooseCountToGuess(active, rank) || 1;
          this.guessCount(active.id, guess);
        }, 1100);
      }
    }
  }

  guessCount(playerId, count) {
    const pending = this.room.pendingQuestion;
    if (!pending || pending.askingId !== playerId || pending.stage !== 'count') return;
    const active = this.room.players[this.room.turnIndex];
    const target = this.room.players.find(p => p.id === pending.targetId);
    if (!active || !target) return;

    if (count === pending.actualCount) {
      pending.stage = 'suits';
      pending.guessedCount = count;
      this.room.log.push({ text: `🎯 ${active.name} угадал количество (${count} шт.)! Назовите масти.`, time: Date.now(), type: 'info' });
      this.emitState({ type: 'count_correct', activeId: active.id, activeName: active.name, targetId: target.id, targetName: target.name, rank: pending.rank, count });
      if (active.isBot) {
        setTimeout(() => {
          if (!this.room?.pendingQuestion || this.room.pendingQuestion.stage !== 'suits') return;
          const chosenSuits = this.botBrains.get(active.id)?.chooseSuitsToGuess(active, pending.rank, count) || ['♠'];
          this.guessSuits(active.id, chosenSuits);
        }, 1200);
      }
    } else {
      this.room.pendingQuestion = null;
      let drawn = this.room.deck.length > 0 ? this.room.deck.pop() : null;
      if (drawn) { active.hand.push(drawn); active.hand = this.sortHand(active.hand, this.room.ranks); }
      this.room.log.push({ text: `❌ ${active.name} назвал ${count} шт. «${pending.rank}» — не угадал! Карты остаются у ${target.name}. ${drawn ? `${active.name} берет карту.` : ''}`, time: Date.now(), type: 'miss' });
      const chestMade = this.checkChests(active);
      this.refillIfEmpty(active);
      if (!chestMade) this.room.turnIndex = (this.room.turnIndex + 1) % this.room.players.length;
      this.emitState({ type: 'count_fail', activeId: active.id, targetId: target.id, rank: pending.rank, guessedCount: count, activeName: active.name, targetName: target.name });
      this.checkBotTurn();
    }
  }

  guessSuits(playerId, chosenSuits) {
    const pending = this.room.pendingQuestion;
    if (!pending || pending.askingId !== playerId || pending.stage !== 'suits') return;
    const active = this.room.players[this.room.turnIndex];
    const target = this.room.players.find(p => p.id === pending.targetId);
    if (!active || !target) return;

    this.room.pendingQuestion = null;
    const matchedCards = target.hand.filter(c => c.rank === pending.rank);
    const targetSuits = matchedCards.map(c => c.suit).sort();
    const sortedChosen = [...chosenSuits].sort();
    const isMatch = sortedChosen.length === targetSuits.length && sortedChosen.every((s, i) => s === targetSuits[i]);

    if (isMatch) {
      target.hand = target.hand.filter(c => c.rank !== pending.rank);
      active.hand.push(...matchedCards);
      active.hand = this.sortHand(active.hand, this.room.ranks);
      this.room.log.push({ text: `🌟 ${active.name} угадал масти (${chosenSuits.join(' ')})! Забирает ${matchedCards.length} шт. «${pending.rank}» и ходит снова.`, time: Date.now(), type: 'success' });
      for (const b of this.botBrains.values()) b.recordCardTransfer(target.id, pending.rank);
      this.checkChests(active);
      this.checkChests(target);
      this.refillIfEmpty(active);
      this.refillIfEmpty(target);
      this.emitState({ type: 'suits_success', activeId: active.id, activeName: active.name, targetId: target.id, targetName: target.name, rank: pending.rank, count: matchedCards.length, suits: chosenSuits });
      this.checkBotTurn();
    } else {
      let drawn = this.room.deck.length > 0 ? this.room.deck.pop() : null;
      if (drawn) { active.hand.push(drawn); active.hand = this.sortHand(active.hand, this.room.ranks); }
      this.room.log.push({ text: `💨 ${active.name} назвал масти (${chosenSuits.join(' ')}), но ошибся! Карты остаются у ${target.name}. ${drawn ? `${active.name} берет карту.` : ''}`, time: Date.now(), type: 'miss' });
      const chestMade = this.checkChests(active);
      this.refillIfEmpty(active);
      if (!chestMade) this.room.turnIndex = (this.room.turnIndex + 1) % this.room.players.length;
      this.emitState({ type: 'suits_fail', activeId: active.id, targetId: target.id, rank: pending.rank, suits: chosenSuits, activeName: active.name, targetName: target.name });
      this.checkBotTurn();
    }
  }

  checkBotTurn() {
    if (!this.room || this.room.status !== 'playing' || this.room.pendingQuestion) return;
    const active = this.room.players[this.room.turnIndex];
    if (!active?.isBot) return;

    setTimeout(() => {
      if (!this.room || this.room.status !== 'playing' || this.room.pendingQuestion) return;
      const cur = this.room.players[this.room.turnIndex];
      if (!cur?.isBot || cur.hand.length === 0) return;
      const action = this.botBrains.get(cur.id)?.chooseRankToAsk(cur, this.room.players);
      if (action) this.askRank(cur.id, action.targetId, action.rank);
    }, 1200);
  }

  emitState(gameEvent = null) {
    const me = this.room.players.find(p => p.id === 'me');
    const totalChests = this.room.players.reduce((sum, p) => sum + p.chests.length, 0);
    if (totalChests >= this.room.ranks.length || (this.room.deck.length === 0 && this.room.players.every(p => p.hand.length === 0))) {
      this.room.status = 'finished';
    }
    this.onStateChange({
      id: this.room.id,
      status: this.room.status,
      deckCount: this.room.deck.length,
      turnIndex: this.room.turnIndex,
      activePlayerName: this.room.players[this.room.turnIndex]?.name || '',
      activePlayerId: this.room.players[this.room.turnIndex]?.id || '',
      pendingQuestion: this.room.pendingQuestion,
      gameEvent,
      players: this.room.players.map((p, idx) => ({ id: p.id, name: p.name, isBot: p.isBot, isHost: p.isHost, cardCount: p.hand.length, chests: p.chests, isTurn: this.room.turnIndex === idx, hand: p.id === 'me' ? p.hand : [] })),
      log: this.room.log.slice(-15),
      ranks: this.room.ranks
    });
  }
}
