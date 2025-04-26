const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const hostname = '0.0.0.0';
const app = next({ dev, hostname, port });
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
  server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
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
  let hashCounts = {};
  let blockchain = [];

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
        hashCounts = {};

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

    socket.on('submitHash', ({ name, hash }) => {
      console.log('Hash submitted:', { name, hash });
      if (currentRound !== null && !winner) {
        // Update hash count for the participant
        hashCounts[name] = (hashCounts[name] || 0) + 1;
        io.emit('hashCount', { name, count: hashCounts[name] });

        // Convert hash to binary string
        const binary = Array.from(hash.substring(0, 2))
          .map(char => parseInt(char, 16).toString(2).padStart(4, '0'))
          .join('');

        // Check if first 6 bits are zero
        if (binary.substring(0, 6) === '000000') {
          winner = name;
          const block = {
            index: blockchain.length,
            timestamp: Date.now(),
            winner: name,
            hash: hash,
            previousHash: blockchain.length > 0 ? blockchain[blockchain.length - 1].hash : '0'
          };
          blockchain.push(block);
          io.emit('roundEnded', { winner: name, hash, round: currentRound, block });
          currentRound = null;
        }
      } else {
        console.log('Hash invalid or round not active. Current round:', currentRound, 'Winner:', winner);
      }
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected');
    });
  });

  server.listen(port, hostname, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://${hostname}:${port}`);
  }); 
  console.log('> Environment:', process.env.NODE_ENV);
  console.log('> WebSocket server ready');
}).catch((err) => {
  console.error('Error starting server:', err);
  process.exit(1);
});

