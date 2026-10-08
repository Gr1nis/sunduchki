// Pure client-side game engine for GitHub Pages / Offline play
const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS_36 = ['6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const RANKS_52 = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

export class LocalGame {
  constructor(onStateChange) {
    this.onStateChange = onStateChange;
    this.room = null;
    this.botBrains = new Map();
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

    // Deal 4 cards
    for (const p of this.room.players) {
      for (let i = 0; i < 4; i++) {
        if (this.room.deck.length > 0) p.hand.push(this.room.deck.pop());
      }
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
      }
    }
  }

  refillIfEmpty(player) {
    if (player.hand.length === 0 && this.room.deck.length > 0) {
      player.hand.push(this.room.deck.pop());
    }
  }

  playTurn(playerId, targetId, rank) {
    const active = this.room.players[this.room.turnIndex];
    if (active.id !== playerId) return;
    const target = this.room.players.find(p => p.id === targetId);
    if (!target) return;

    const matched = target.hand.filter(c => c.rank === rank);
    if (matched.length > 0) {
      target.hand = target.hand.filter(c => c.rank !== rank);
      active.hand.push(...matched);
      this.room.log.push({
        text: `${active.name} спросил у ${target.name} «${rank}» и забрал ${matched.length} шт.! ${active.name} ходит снова.`,
        time: Date.now(),
        type: 'success'
      });
    } else {
      let drawn = null;
      if (this.room.deck.length > 0) {
        drawn = this.room.deck.pop();
        active.hand.push(drawn);
      }
      this.room.log.push({
        text: `${active.name} спросил у ${target.name} «${rank}» — мимо! ${drawn ? `${active.name} берет карту из колоды.` : ''}`,
        time: Date.now(),
        type: 'miss'
      });
      // advance turn
      this.room.turnIndex = (this.room.turnIndex + 1) % this.room.players.length;
    }

    this.checkChests(active);
    this.checkChests(target);
    this.refillIfEmpty(active);
    this.refillIfEmpty(target);

    // check game over
    const totalChests = this.room.players.reduce((sum, p) => sum + p.chests.length, 0);
    if (totalChests >= this.room.ranks.length || (this.room.deck.length === 0 && this.room.players.every(p => p.hand.length === 0))) {
      this.room.status = 'finished';
    }

    this.emitState();
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

      const targets = this.room.players.filter(p => p.id !== cur.id && p.hand.length > 0);
      if (targets.length === 0) return;

      const chosenTarget = targets[Math.floor(Math.random() * targets.length)];
      const chosenRank = cur.hand[Math.floor(Math.random() * cur.hand.length)].rank;

      this.playTurn(cur.id, chosenTarget.id, chosenRank);
    }, 1200);
  }

  emitState() {
    const me = this.room.players.find(p => p.id === 'me');
    const sanitized = {
      id: this.room.id,
      status: this.room.status,
      deckCount: this.room.deck.length,
      turnIndex: this.room.turnIndex,
      activePlayerName: this.room.players[this.room.turnIndex]?.name || '',
      activePlayerId: this.room.players[this.room.turnIndex]?.id || '',
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
