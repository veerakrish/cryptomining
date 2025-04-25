const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT, 10) || 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(server, {
    path: '/api/socket',
    addTrailingSlash: false,
    transports: ['websocket', 'polling'],
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  let participants = [];
  let currentRound = null;
  let winner = null;

  io.on('connection', (socket) => {
    console.log('Client connected');

    socket.on('join', (name) => {
      participants.push(name);
      io.emit('participants', participants);
      io.emit('roundStatus', { isActive: currentRound !== null });
      if (winner) io.emit('winner', winner);
    });

    socket.on('startRound', () => {
      if (currentRound === null) {
        currentRound = Date.now();
        winner = null;
        io.emit('roundStarted');

        setTimeout(() => {
          currentRound = null;
          io.emit('roundEnded');
        }, 120000); // 2 minutes
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

  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://localhost:${port}`);
  });
});
