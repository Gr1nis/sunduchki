// Bot intelligence with 2-stage question logic and memory
export class LocalBotBrain {
  constructor() {
    this.memory = new Map(); // targetId -> Map(rank -> knownCount)
    this.lastAskedRank = null;
    this.recentSuccessRanks = new Set();
  }

  recordAnswer(targetId, rank, hasCards) {
    if (!this.memory.has(targetId)) this.memory.set(targetId, new Map());
    const targetMap = this.memory.get(targetId);
    if (!hasCards) {
      targetMap.delete(rank);
    } else {
      targetMap.set(rank, true);
    }
  }

  recordCardTransfer(targetId, rank) {
    if (this.memory.has(targetId)) {
      this.memory.get(targetId).delete(rank);
    }
    this.recentSuccessRanks.add(rank);
  }

  recordChest(rank) {
    for (const targetMap of this.memory.values()) {
      targetMap.delete(rank);
    }
    this.recentSuccessRanks.delete(rank);
  }

  chooseRankToAsk(botPlayer, allPlayers) {
    if (!botPlayer.hand || botPlayer.hand.length === 0) return null;
    const validTargets = allPlayers.filter(p => p.id !== botPlayer.id && p.hand.length > 0);
    if (validTargets.length === 0) return null;

    const rankCounts = {};
    for (const c of botPlayer.hand) {
      rankCounts[c.rank] = (rankCounts[c.rank] || 0) + 1;
    }
    const myRanks = Object.keys(rankCounts);

    // 1. Check memory: does any target have a rank I hold?
    for (const target of validTargets) {
      const known = this.memory.get(target.id);
      if (known) {
        for (const rank of myRanks) {
          if (known.has(rank)) {
            return { targetId: target.id, rank };
          }
        }
      }
    }

    // 2. Otherwise pick rank with randomness and variety
    let candidates = myRanks.filter(r => !this.recentSuccessRanks.has(r) || r !== this.lastAskedRank);
    if (candidates.length === 0) candidates = myRanks;
    candidates.sort(() => Math.random() - 0.5);
    const chosenRank = candidates[0];
    this.lastAskedRank = chosenRank;

    const chosenTarget = validTargets[Math.floor(Math.random() * validTargets.length)];
    return { targetId: chosenTarget.id, rank: chosenRank };
  }

  chooseCountToGuess(botPlayer, rank) {
    const myCount = botPlayer.hand.filter(c => c.rank === rank).length;
    const maxAsk = Math.max(1, 4 - myCount);
    // Weighted guess: usually 1 or 2
    if (maxAsk === 1) return 1;
    const rand = Math.random();
    if (maxAsk === 2) return rand < 0.65 ? 1 : 2;
    if (rand < 0.5) return 1;
    if (rand < 0.85) return 2;
    return 3;
  }

  chooseSuitsToGuess(botPlayer, rank, count) {
    const ALL_SUITS = ['♠', '♥', '♦', '♣'];
    const mySuits = new Set(botPlayer.hand.filter(c => c.rank === rank).map(c => c.suit));
    const available = ALL_SUITS.filter(s => !mySuits.has(s));
    available.sort(() => Math.random() - 0.5);
    return available.slice(0, count);
  }
}
