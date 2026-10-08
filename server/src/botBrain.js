export class BotBrain {
  constructor() {
    // Memory map: playerIndex -> Set of ranks they are known to have
    this.memory = {};
  }

  recordAsk(askingId, targetId, rank, success) {
    if (!this.memory[askingId]) this.memory[askingId] = new Set();
    if (!this.memory[targetId]) this.memory[targetId] = new Set();

    // The asking player definitely had this rank
    this.memory[askingId].add(rank);

    if (success) {
      // The target gave away this rank, so target no longer has it
      this.memory[targetId].delete(rank);
    } else {
      // Target did not have it
      this.memory[targetId].delete(rank);
    }
  }

  recordChest(rank) {
    // Rank is now completed, clear from all memories
    for (const id in this.memory) {
      this.memory[id].delete(rank);
    }
  }

  decideMove(botPlayer, allPlayers) {
    if (botPlayer.hand.length === 0) return null;

    // Potential targets: other players who have cards
    const validTargets = allPlayers.filter(
      p => p.id !== botPlayer.id && p.hand.length > 0
    );
    if (validTargets.length === 0) return null;

    // Ranks currently in bot's hand and their counts
    const botRankCounts = {};
    for (const card of botPlayer.hand) {
      botRankCounts[card.rank] = (botRankCounts[card.rank] || 0) + 1;
    }
    const myRanks = Object.keys(botRankCounts);

    // 1. Check memory: does any other player have a rank I own?
    for (const target of validTargets) {
      const knownRanks = this.memory[target.id];
      if (knownRanks) {
        for (const rank of myRanks) {
          if (knownRanks.has(rank)) {
            return { targetId: target.id, rank };
          }
        }
      }
    }

    // 2. Otherwise prioritize asking for rank we have the most of
    myRanks.sort((a, b) => botRankCounts[b] - botRankCounts[a]);
    const chosenRank = myRanks[0];

    // Pick target with the most cards or random valid target
    validTargets.sort((a, b) => b.hand.length - a.hand.length);
    const chosenTarget = validTargets[0];

    return { targetId: chosenTarget.id, rank: chosenRank };
  }
}
