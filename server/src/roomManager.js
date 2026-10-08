import { createDeck, sortHand, checkChests, refillIfEmpty } from './gameLogic.js';
import { BotBrain } from './botBrain.js';
import { handleTurn } from './turnHandler.js';

export class RoomManager {
  constructor() {
    this.rooms = new Map();
  }

  createRoom(roomId, hostId, hostName = 'Игрок 1', deckType = '36') {
    const room = {
      id: roomId,
      deckType,
      status: 'lobby',
      players: [{ id: hostId, name: hostName, isBot: false, hand: [], chests: [], isHost: true }],
      deck: [],
      ranks: [],
      turnIndex: 0,
      log: [{ text: `Комната создана игроком ${hostName}.`, time: Date.now() }],
      botBrains: new Map(),
      lastAction: null
    };
    this.rooms.set(roomId, room);
    return room;
  }

  getRoom(roomId) {
    return this.rooms.get(roomId);
  }

  addBot(roomId) {
    const room = this.rooms.get(roomId);
    if (!room || room.status !== 'lobby' || room.players.length >= 6) return null;
    const botIndex = room.players.filter(p => p.isBot).length + 1;
    const botNames = ['Бот Добрыня', 'Бот Алёша', 'Бот Илья', 'Бот Святогор', 'Бот Василиса'];
    const botName = botNames[(botIndex - 1) % botNames.length];
    const botId = `bot_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const botPlayer = { id: botId, name: botName, isBot: true, hand: [], chests: [], isHost: false };
    room.players.push(botPlayer);
    room.botBrains.set(botId, new BotBrain());
    room.log.push({ text: `${botName} присоединился к игре.`, time: Date.now() });
    return botPlayer;
  }

  joinRoom(roomId, playerId, playerName = 'Гость') {
    const room = this.rooms.get(roomId);
    if (!room) return { error: 'Комната не найдена' };
    if (room.status !== 'lobby') return { error: 'Игра уже началась' };
    if (room.players.length >= 6) return { error: 'Комната заполнена' };
    
    // Check if player already exists
    const existing = room.players.find(p => p.id === playerId);
    if (existing) {
      existing.name = playerName;
      return { room };
    }

    room.players.push({ id: playerId, name: playerName, isBot: false, hand: [], chests: [], isHost: false });
    room.log.push({ text: `${playerName} присоединился к игре.`, time: Date.now() });
    return { room };
  }

  removePlayer(roomId, playerId) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    const pIndex = room.players.findIndex(p => p.id === playerId);
    if (pIndex === -1) return;
    const player = room.players[pIndex];
    room.players.splice(pIndex, 1);
    room.botBrains.delete(playerId);
    room.log.push({ text: `${player.name} покинул игру.`, time: Date.now() });
    if (room.players.filter(p => !p.isBot).length === 0) {
      this.rooms.delete(roomId);
      return;
    }
    if (player.isHost && room.players.length > 0) {
      const nextHuman = room.players.find(p => !p.isBot) || room.players[0];
      nextHuman.isHost = true;
    }
  }

  startGame(roomId) {
    const room = this.rooms.get(roomId);
    if (!room || room.players.length < 2) return { error: 'Нужно минимум 2 игрока' };
    const { deck, ranks } = createDeck(room.deckType);
    room.deck = deck;
    room.ranks = ranks;
    room.status = 'playing';
    room.turnIndex = 0;

    // Deal 4 cards to each player
    for (const p of room.players) {
      p.hand = [];
      p.chests = [];
      for (let i = 0; i < 4; i++) {
        if (room.deck.length > 0) p.hand.push(room.deck.pop());
      }
      p.hand = sortHand(p.hand, room.ranks);
      const initialChests = checkChests(p, room.ranks);
      if (initialChests.length > 0) {
        room.log.push({ text: `${p.name} сразу собрал сундучок из ${initialChests.join(', ')}!`, time: Date.now() });
      }
    }
    room.log.push({ text: `Игра началась! Раздали по 4 карты. Первый ход: ${room.players[0].name}.`, time: Date.now() });
    return { room };
  }

  playTurn(roomId, playerId, targetId, rank) {
    const room = this.rooms.get(roomId);
    if (!room || room.status !== 'playing') return { error: 'Игра не активна' };
    return handleTurn(room, playerId, targetId, rank);
  }

  getSanitizedState(roomId, viewerId) {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    const sanitizedPlayers = room.players.map((p, idx) => {
      const isViewer = p.id === viewerId;
      return {
        id: p.id,
        name: p.name,
        isBot: p.isBot,
        isHost: p.isHost,
        cardCount: p.hand.length,
        chests: p.chests,
        isTurn: room.turnIndex === idx,
        // Hand is only visible to the player themselves!
        hand: isViewer ? p.hand : []
      };
    });

    return {
      id: room.id,
      status: room.status,
      deckType: room.deckType,
      deckCount: room.deck.length,
      turnIndex: room.turnIndex,
      activePlayerName: room.players[room.turnIndex]?.name || '',
      activePlayerId: room.players[room.turnIndex]?.id || '',
      players: sanitizedPlayers,
      log: room.log.slice(-15),
      ranks: room.ranks
    };
  }
}
