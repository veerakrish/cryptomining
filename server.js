const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const port = parseInt(process.env.PORT, 10) || 3000;

const app = next({ dev });
const handle = app.getRequestHandler();

// Store server instance globally so we can access it in signal handlers
let serverInstance = null;

// Handle shutdown gracefully
function handleShutdown() {
  console.log('Received shutdown signal');
  if (serverInstance) {
    console.log('Closing server...');
    serverInstance.close(() => {
      console.log('Server closed');
      process.exit(0);
    });

    // Force close after 10s
    setTimeout(() => {
      console.log('Forcing server close...');
      process.exit(1);
    }, 10000);
  } else {
    process.exit(0);
  }
}

process.on('SIGTERM', handleShutdown);
process.on('SIGINT', handleShutdown);

// Handle uncaught errors
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  handleShutdown();
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
  handleShutdown();
});

app.prepare().then(() => {
  try {
    const server = createServer((req, res) => {
      try {
        const parsedUrl = parse(req.url, true);
        
        // Add health check endpoint
        if (parsedUrl.pathname === '/health') {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ status: 'ok' }));
        }

        handle(req, res, parsedUrl);
      } catch (err) {
        console.error('Error handling request:', err);
        res.statusCode = 500;
        res.end('Internal server error');
      }
    });

    serverInstance = server;

    const io = new Server(server, {
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

    server.listen(port, '0.0.0.0', (err) => {
      if (err) {
        console.error('Failed to start server:', err);
        throw err;
      }
      console.log(`> Server started successfully on port ${port}`);
      console.log('> Environment:', process.env.NODE_ENV);
      console.log('> WebSocket enabled and ready for connections');
    });
  } catch (err) {
    console.error('Error starting server:', err);
    process.exit(1);
  }
}).catch((err) => {
  console.error('Error preparing Next.js:', err);
  process.exit(1);
});
