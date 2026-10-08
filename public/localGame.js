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
    return [...cards].sort((a, b) => (rankOrder[a.rank] || 0) - (rankOrder[b.rank] || 0));
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

    this.room = {
      id: 'LOCAL',
      status: 'playing',
      deckType,
      deck,
      ranks,
      players,
      turnIndex: 0,
      pendingQuestion: null,
      log: [{ text: `Игра началась! Раздали по 4 карты. Первый ход: ${players[0].name}.`, time: Date.now() }]
    };

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
      let drawn = null;
      if (this.room.deck.length > 0) {
        drawn = this.room.deck.pop();
        active.hand.push(drawn);
        active.hand = this.sortHand(active.hand, this.room.ranks);
      }
      this.room.log.push({
        text: `${active.name} спросил «${rank}» у ${target.name} — «НЕТ!» ${drawn ? `${active.name} берет карту.` : ''}`,
        time: Date.now(),
        type: 'miss'
      });
      const chestMade = this.checkChests(active);
      this.refillIfEmpty(active);
      if (!chestMade) {
        this.room.turnIndex = (this.room.turnIndex + 1) % this.room.players.length;
      }
      this.emitState({ type: 'rank_no', activeId: active.id, activeName: active.name, targetId: target.id, targetName: target.name, rank });
      this.checkBotTurn();
    } else {
      this.room.pendingQuestion = { askingId: playerId, targetId, rank, actualCount: matched.length };
      this.room.log.push({
        text: `💬 ${active.name} спросил «${rank}» у ${target.name} — «ДА, есть!»`,
        time: Date.now(),
        type: 'info'
      });
      this.emitState({ type: 'rank_yes', askingId: playerId, activeId: active.id, activeName: active.name, targetId: target.id, targetName: target.name, rank });
      
      if (active.isBot) {
        setTimeout(() => {
          if (!this.room || !this.room.pendingQuestion) return;
          const brain = this.botBrains.get(active.id);
          const guess = brain ? brain.chooseCountToGuess(active, rank) : 1;
          this.guessCount(active.id, guess);
        }, 1100);
      }
    }
  }

  guessCount(playerId, count) {
    const pending = this.room.pendingQuestion;
    if (!pending || pending.askingId !== playerId) return;
    const active = this.room.players[this.room.turnIndex];
    const target = this.room.players.find(p => p.id === pending.targetId);
    if (!active || !target) return;

    this.room.pendingQuestion = null;

    if (count === pending.actualCount) {
      const matched = target.hand.filter(c => c.rank === pending.rank);
      target.hand = target.hand.filter(c => c.rank !== pending.rank);
      active.hand.push(...matched);
      active.hand = this.sortHand(active.hand, this.room.ranks);

      this.room.log.push({
        text: `🎯 ${active.name} угадал количество (${count} шт. «${pending.rank}»)! Забирает карты и ходит снова.`,
        time: Date.now(),
        type: 'success'
      });
      for (const brain of this.botBrains.values()) brain.recordCardTransfer(target.id, pending.rank);

      const chestMade = this.checkChests(active);
      this.checkChests(target);
      this.refillIfEmpty(active);
      this.refillIfEmpty(target);

      this.emitState({
        type: 'count_success',
        activeId: active.id,
        targetId: target.id,
        rank: pending.rank,
        count,
        activeName: active.name,
        targetName: target.name
      });
      this.checkBotTurn();
    } else {
      let drawn = null;
      if (this.room.deck.length > 0) {
        drawn = this.room.deck.pop();
        active.hand.push(drawn);
        active.hand = this.sortHand(active.hand, this.room.ranks);
      }
      this.room.log.push({
        text: `❌ ${active.name} назвал ${count} шт. «${pending.rank}» — не угадал! Карты остаются у ${target.name}. ${drawn ? `${active.name} берет карту.` : ''}`,
        time: Date.now(),
        type: 'miss'
      });
      const chestMade = this.checkChests(active);
      this.refillIfEmpty(active);
      if (!chestMade) {
        this.room.turnIndex = (this.room.turnIndex + 1) % this.room.players.length;
      }
      this.emitState({
        type: 'count_fail',
        activeId: active.id,
        targetId: target.id,
        rank: pending.rank,
        guessedCount: count,
        activeName: active.name,
        targetName: target.name
      });
      this.checkBotTurn();
    }
  }

  checkBotTurn() {
    if (!this.room || this.room.status !== 'playing' || this.room.pendingQuestion) return;
    const active = this.room.players[this.room.turnIndex];
    if (!active || !active.isBot) return;

    setTimeout(() => {
      if (!this.room || this.room.status !== 'playing' || this.room.pendingQuestion) return;
      const cur = this.room.players[this.room.turnIndex];
      if (!cur || !cur.isBot || cur.hand.length === 0) return;

      const brain = this.botBrains.get(cur.id);
      const action = brain?.chooseRankToAsk(cur, this.room.players);
      if (action) {
        this.askRank(cur.id, action.targetId, action.rank);
      }
    }, 1200);
  }

  emitState(gameEvent = null) {
    const me = this.room.players.find(p => p.id === 'me');
    const totalChests = this.room.players.reduce((sum, p) => sum + p.chests.length, 0);
    if (totalChests >= this.room.ranks.length || (this.room.deck.length === 0 && this.room.players.every(p => p.hand.length === 0))) {
      this.room.status = 'finished';
    }

    const sanitized = {
      id: this.room.id,
      status: this.room.status,
      deckCount: this.room.deck.length,
      turnIndex: this.room.turnIndex,
      activePlayerName: this.room.players[this.room.turnIndex]?.name || '',
      activePlayerId: this.room.players[this.room.turnIndex]?.id || '',
      pendingQuestion: this.room.pendingQuestion,
      gameEvent,
      players: this.room.players.map((p, idx) => ({
        id: p.id,
        name: p.name,
        isBot: p.isBot,
        isHost: p.isHost,
        cardCount: p.hand.length,
        chests: p.chests,
        isTurn: this.room.turnIndex === idx,
        hand: p.id === 'me' ? p.hand : []
      })),
      log: this.room.log.slice(-15),
      ranks: this.room.ranks
    };
    this.onStateChange(sanitized);
  }
}
