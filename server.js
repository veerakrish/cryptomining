const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const port = parseInt(process.env.PORT, 10) || 3000;
const app = next({ dev });
const handle = app.getRequestHandler();

let server = null;
let io = null;

function handleShutdown() {
  if (io) {
    console.log('Closing Socket.IO connections...');
    io.close();
  }
  if (server) {
    console.log('Closing HTTP server...');
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
    setTimeout(() => {
      console.log('Force closing server...');
      process.exit(1);
    }, 5000);
  } else {
    process.exit(0);
  }
}

process.on('SIGTERM', handleShutdown);
process.on('SIGINT', handleShutdown);

app.prepare().then(() => {
  server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  io = new Server(server, {
    path: '/api/socket',
    transports: ['websocket', 'polling'],
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    },
    pingTimeout: 60000,
    pingInterval: 25000
  });

  let participants = [];
  let currentRound = null;
  let winner = null;
  let admin = null;

  io.on('connection', (socket) => {
    console.log('Client connected');

    socket.on('join', (name) => {
      if (!participants.includes(name)) {
        participants.push(name);
        if (!admin) {
          admin = name;
          socket.emit('adminStatus', true);
        }
        io.emit('participants', participants);
        io.emit('roundStatus', { isActive: currentRound !== null, admin });
        if (winner) io.emit('winner', winner);
      }
    });

    socket.on('startRound', (name) => {
      console.log('Start round requested by:', name);
      console.log('Current admin:', admin);
      
      if (name !== admin) {
        console.log('Not admin, ignoring start request');
        return;
      }

      if (currentRound === null) {
        console.log('Starting new round...');
        currentRound = Date.now();
        const roundNumber = currentRound;
        winner = null;

        io.emit('roundStarted', { round: roundNumber });
        console.log('Round started:', roundNumber);

        setTimeout(() => {
          if (currentRound === roundNumber) {
            console.log('Round ended:', roundNumber);
            currentRound = null;
            io.emit('roundEnded', { winner: null, round: roundNumber });
          }
        }, 120000);
      } else {
        console.log('Round already in progress');
      }
    });

    socket.on('submitHash', (data) => {
      console.log('Hash submitted:', data);
      const { name, hash } = data;
      if (currentRound !== null && !winner && hash.startsWith('0')) {
        winner = { name, hash };
        io.emit('winner', winner);
        currentRound = null;
        io.emit('roundEnded');
      }
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected');
    });
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`> Server running on port ${port}`);
    console.log('> Environment:', process.env.NODE_ENV);
    console.log('> WebSocket server ready');
  });
}).catch((err) => {
  console.error('Error starting server:', err);
  process.exit(1);
});

