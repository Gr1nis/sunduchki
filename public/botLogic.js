// Bot intelligence with randomized variety and memory of taken cards
export class LocalBotBrain {
  constructor() {
    this.memory = new Map(); // targetId -> Set of known ranks
    this.lastAskedRank = null;
    this.recentSuccessRanks = new Set();
  }

  recordCardTransfer(targetId, rank) {
    // Target lost this rank, so target has 0 of this rank
    if (this.memory.has(targetId)) {
      this.memory.get(targetId).delete(rank);
    }
    this.recentSuccessRanks.add(rank);
  }

  recordChest(rank) {
    for (const ranks of this.memory.values()) {
      ranks.delete(rank);
    }
    this.recentSuccessRanks.delete(rank);
  }

  chooseAction(botPlayer, allPlayers, allRanks) {
    if (!botPlayer.hand || botPlayer.hand.length === 0) return null;

    const validTargets = allPlayers.filter(p => p.id !== botPlayer.id && p.hand.length > 0);
    if (validTargets.length === 0) return null;

    // Distinct ranks bot has in hand and their counts
    const rankCounts = {};
    for (const c of botPlayer.hand) {
      rankCounts[c.rank] = (rankCounts[c.rank] || 0) + 1;
    }
    const myRanks = Object.keys(rankCounts);

    // 1. Check memory: does any target have a rank I hold?
    const memoryCandidates = [];
    for (const target of validTargets) {
      const known = this.memory.get(target.id);
      if (known) {
        for (const rank of myRanks) {
          if (known.has(rank)) {
            memoryCandidates.push({ targetId: target.id, rank });
          }
        }
      }
    }

    if (memoryCandidates.length > 0) {
      // Pick randomly among memory candidates
      const pick = memoryCandidates[Math.floor(Math.random() * memoryCandidates.length)];
      const maxPossible = 4 - (rankCounts[pick.rank] || 1);
      const askedCount = Math.max(1, Math.min(maxPossible, Math.random() < 0.7 ? 1 : 2));
      return { targetId: pick.targetId, rank: pick.rank, count: askedCount };
    }

    // 2. Select rank with randomness (do not always spam the same rank)
    // Filter out ranks bot recently successfully took unless it has only 1 rank left
    let candidateRanks = myRanks.filter(r => !this.recentSuccessRanks.has(r) || r !== this.lastAskedRank);
    if (candidateRanks.length === 0) candidateRanks = myRanks;

    // Shuffle candidate ranks for natural unpredictability
    candidateRanks.sort(() => Math.random() - 0.5);
    const chosenRank = candidateRanks[0];
    this.lastAskedRank = chosenRank;

    // Pick random target
    const chosenTarget = validTargets[Math.floor(Math.random() * validTargets.length)];

    // Choose asked count: usually 1, sometimes 2 if bot only has 1 or 2
    const myCount = rankCounts[chosenRank] || 1;
    const maxAsk = Math.max(1, 4 - myCount);
    let askedCount = 1;
    if (maxAsk >= 2 && Math.random() < 0.35) {
      askedCount = 2;
    }

    return { targetId: chosenTarget.id, rank: chosenRank, count: askedCount };
  }
}
