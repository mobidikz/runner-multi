// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const PORT = process.env.PORT || 3000;
app.use(express.static('public'));

// État par salon
const rooms = new Map();
function getRoom(name = 'room1') {
  if (!rooms.has(name)) {
    rooms.set(name, {
      players: new Map(),
      round: { seed: Math.floor(Math.random() * 1e9), startAt: Date.now() + 3000 },
      aliveCount: 0,
    });
  }
  return rooms.get(name);
}

function startNewRound(room) {
  room.round = { seed: Math.floor(Math.random() * 1e9), startAt: Date.now() + 3000 };
  room.aliveCount = 0;
  for (const p of room.players.values()) p.alive = true;
  io.to(room.name).emit('round', room.round);
}

io.on('connection', (socket) => {
  const roomName = 'room1';
  const room = getRoom(roomName);
  room.name = roomName;

  const player = {
    id: socket.id,
    name: `Joueur-${(Math.random() * 1000) | 0}`,
    color: `hsl(${(Math.random() * 360) | 0} 80% 55%)`,
    x: 120,
    y: 0,
    alive: true,
    distance: 0,
  };

  room.players.set(socket.id, player);
  socket.join(roomName);

  if (room.players.size === 1) startNewRound(room);
  else socket.emit('round', room.round);

  io.to(roomName).emit('players', Array.from(room.players.values()));

  socket.on('ready', () => {
    const r = getRoom(roomName);
    const p = r.players.get(socket.id);
    if (p && !p.alive) p.alive = true;
  });

  socket.on('state', (data) => {
    const r = getRoom(roomName);
    const p = r.players.get(socket.id);
    if (!p) return;
    p.x = data.x;
    p.y = data.y;
    p.distance = data.distance;
    p.alive = data.alive;
    socket.to(roomName).emit('state', { id: socket.id, x: p.x, y: p.y, distance: p.distance, alive: p.alive });
  });

  socket.on('dead', () => {
    const r = getRoom(roomName);
    const p = r.players.get(socket.id);
    if (!p) return;
    p.alive = false;
    const anyAlive = Array.from(r.players.values()).some((pl) => pl.alive);
    if (!anyAlive) setTimeout(() => startNewRound(r), 2500);
  });

  socket.on('disconnect', () => {
    const r = getRoom(roomName);
    r.players.delete(socket.id);
    io.to(roomName).emit('players', Array.from(r.players.values()));
    if (r.players.size === 0) rooms.delete(roomName);
  });
});

server.listen(PORT, () => console.log(`✅ Server on http://localhost:${PORT}`));