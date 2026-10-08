import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { RoomManager } from './roomManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, '../../public');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.static(publicDir));
app.use((req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

const roomManager = new RoomManager();

function broadcastState(roomId) {
  const room = roomManager.getRoom(roomId);
  if (!room) return;
  for (const p of room.players) {
    if (!p.isBot) {
      const sanitized = roomManager.getSanitizedState(roomId, p.id);
      io.to(p.id).emit('game_state', sanitized);
    }
  }
}

function processBotTurns(roomId) {
  const room = roomManager.getRoom(roomId);
  if (!room || room.status !== 'playing') return;

  const activePlayer = room.players[room.turnIndex];
  if (!activePlayer || !activePlayer.isBot) return;

  setTimeout(() => {
    const r = roomManager.getRoom(roomId);
    if (!r || r.status !== 'playing') return;
    const bot = r.players[r.turnIndex];
    if (!bot || !bot.isBot) return;

    const brain = r.botBrains.get(bot.id);
    if (!brain) return;

    const move = brain.decideMove(bot, r.players);
    if (move) {
      roomManager.playTurn(roomId, bot.id, move.targetId, move.rank);
      broadcastState(roomId);
      processBotTurns(roomId);
    }
  }, 1400);
}

io.on('connection', (socket) => {
  let currentRoomId = null;

  socket.on('create_room', ({ playerName, deckType }) => {
    const roomId = Math.random().toString(36).substring(2, 6).toUpperCase();
    currentRoomId = roomId;
    roomManager.createRoom(roomId, socket.id, playerName || 'Игрок 1', deckType || '36');
    socket.join(roomId);
    socket.emit('room_joined', { roomId, playerId: socket.id, isHost: true });
    broadcastState(roomId);
  });

  socket.on('join_room', ({ roomId, playerName }) => {
    const code = roomId?.toUpperCase();
    const result = roomManager.joinRoom(code, socket.id, playerName || 'Игрок');
    if (result.error) return socket.emit('error_msg', result.error);
    currentRoomId = code;
    socket.join(code);
    socket.emit('room_joined', { roomId: code, playerId: socket.id, isHost: false });
    broadcastState(code);
  });

  socket.on('add_bot', ({ roomId }) => {
    const room = roomManager.getRoom(roomId);
    if (!room) return;
    const host = room.players.find(p => p.id === socket.id);
    if (!host || !host.isHost) return;
    roomManager.addBot(roomId);
    broadcastState(roomId);
  });

  socket.on('start_game', ({ roomId }) => {
    const res = roomManager.startGame(roomId);
    if (res.error) return socket.emit('error_msg', res.error);
    broadcastState(roomId);
    processBotTurns(roomId);
  });

  socket.on('play_turn', ({ roomId, targetId, rank }) => {
    const res = roomManager.playTurn(roomId, socket.id, targetId, rank);
    if (res.error) return socket.emit('error_msg', res.error);
    broadcastState(roomId);
    processBotTurns(roomId);
  });

  socket.on('disconnect', () => {
    if (currentRoomId) {
      roomManager.removePlayer(currentRoomId, socket.id);
      broadcastState(currentRoomId);
      processBotTurns(currentRoomId);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Сундучки сервер запущен на http://localhost:${PORT}`);
});
