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
    for (const r in counts) {
      if (counts[r] === 4) {
        player.chests.push(r);
        player.hand = player.hand.filter(c => c.rank !== r);
        this.room.log.push({ text: `🎉 ${player.name} собрал сундучок из «${r}»!`, time: Date.now(), type: 'chest' });
        for (const brain of this.botBrains.values()) brain.recordChest(r);
      }
    }
  }

  refillIfEmpty(player) {
    if (player.hand.length === 0 && this.room.deck.length > 0) {
      player.hand.push(this.room.deck.pop());
      player.hand = this.sortHand(player.hand, this.room.ranks);
    }
  }

  playTurn(playerId, targetId, rank, askedCount = 1) {
    const active = this.room.players[this.room.turnIndex];
    if (active.id !== playerId) return;
    const target = this.room.players.find(p => p.id === targetId);
    if (!target) return;

    const matched = target.hand.filter(c => c.rank === rank);
    let stolenEvent = null;

    if (matched.length >= askedCount) {
      // Transfer cards
      target.hand = target.hand.filter(c => c.rank !== rank);
      active.hand.push(...matched);
      active.hand = this.sortHand(active.hand, this.room.ranks);

      this.room.log.push({
        text: `${active.name} спросил ${askedCount} шт. «${rank}» у ${target.name} и забрал ${matched.length} шт.! ${active.name} ходит снова.`,
        time: Date.now(),
        type: 'success'
      });

      stolenEvent = { targetId, rank, count: matched.length, activeName: active.name, targetName: target.name };

      for (const brain of this.botBrains.values()) {
        brain.recordCardTransfer(targetId, rank);
      }
    } else {
      let drawn = null;
      if (this.room.deck.length > 0) {
        drawn = this.room.deck.pop();
        active.hand.push(drawn);
        active.hand = this.sortHand(active.hand, this.room.ranks);
      }
      this.room.log.push({
        text: `${active.name} спросил ${askedCount} шт. «${rank}» у ${target.name} — мимо! ${drawn ? `${active.name} берет карту.` : ''}`,
        time: Date.now(),
        type: 'miss'
      });
      this.room.turnIndex = (this.room.turnIndex + 1) % this.room.players.length;
    }

    this.checkChests(active);
    this.checkChests(target);
    this.refillIfEmpty(active);
    this.refillIfEmpty(target);

    const totalChests = this.room.players.reduce((sum, p) => sum + p.chests.length, 0);
    if (totalChests >= this.room.ranks.length || (this.room.deck.length === 0 && this.room.players.every(p => p.hand.length === 0))) {
      this.room.status = 'finished';
    }

    this.emitState(stolenEvent);
    this.checkBotTurn();
  }

  checkBotTurn() {
    if (!this.room || this.room.status !== 'playing') return;
    const active = this.room.players[this.room.turnIndex];
    if (!active || !active.isBot) return;

    setTimeout(() => {
      if (!this.room || this.room.status !== 'playing') return;
      const cur = this.room.players[this.room.turnIndex];
      if (!cur || !cur.isBot || cur.hand.length === 0) return;

      const brain = this.botBrains.get(cur.id);
      const action = brain?.chooseAction(cur, this.room.players, this.room.ranks);
      if (action) {
        this.playTurn(cur.id, action.targetId, action.rank, action.count);
      }
    }, 1300);
  }

  emitState(stolenEvent = null) {
    const me = this.room.players.find(p => p.id === 'me');
    const sanitized = {
      id: this.room.id,
      status: this.room.status,
      deckCount: this.room.deck.length,
      turnIndex: this.room.turnIndex,
      activePlayerName: this.room.players[this.room.turnIndex]?.name || '',
      activePlayerId: this.room.players[this.room.turnIndex]?.id || '',
      stolenEvent,
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
