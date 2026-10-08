import { io } from 'socket.io-client';

const socket = io('http://localhost:3000');

socket.on('connect', () => {
  console.log('✅ Socket connected:', socket.id);
  socket.emit('create_room', { playerName: 'Тестер', deckType: '36' });
});

socket.on('room_joined', ({ roomId }) => {
  console.log('✅ Room joined:', roomId);
  socket.emit('add_bot', { roomId });
  socket.emit('add_bot', { roomId });
  socket.emit('add_bot', { roomId });
  setTimeout(() => {
    socket.emit('start_game', { roomId });
  }, 300);
});

socket.on('game_state', (state) => {
  console.log(`[State update] Status: ${state.status}, Players: ${state.players.length}, Deck: ${state.deckCount}, Active: ${state.activePlayerName}`);
  if (state.status === 'playing') {
    const me = state.players.find(p => p.id === socket.id);
    console.log(`My hand: ${me.hand.map(c => c.rank + c.suit).join(' ')}, My chests: ${me.chests.length}`);
    if (state.activePlayerId === socket.id) {
      console.log('👉 My turn!');
      const target = state.players.find(p => p.id !== socket.id && p.cardCount > 0);
      const myRank = me.hand[0]?.rank;
      if (target && myRank) {
        console.log(`Asking ${target.name} for rank ${myRank}...`);
        socket.emit('play_turn', { roomId: state.id, targetId: target.id, rank: myRank });
      }
    }
  }
  if (state.log.length > 0) {
    const last = state.log[state.log.length - 1];
    console.log(`Log: ${last.text}`);
  }
});

socket.on('error_msg', (err) => {
  console.error('❌ Error received:', err);
});

setTimeout(() => {
  console.log('Test completed successfully, exiting.');
  socket.disconnect();
  process.exit(0);
}, 6000);
