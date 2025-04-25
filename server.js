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

  io.on('connection', (socket) => {
    console.log('Client connected');

    socket.on('join', (name) => {
      if (!participants.includes(name)) {
        participants.push(name);
        io.emit('participants', participants);
        io.emit('roundStatus', { isActive: currentRound !== null });
        if (winner) io.emit('winner', winner);
      }
    });

    socket.on('startRound', () => {
      if (currentRound === null) {
        currentRound = Date.now();
        winner = null;
        io.emit('roundStarted');

        setTimeout(() => {
          if (currentRound !== null) {
            currentRound = null;
            io.emit('roundEnded');
          }
        }, 120000);
      }
    });

    socket.on('submitHash', ({ name, hash }) => {
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

