import { Server as SocketIOServer } from 'socket.io';
import type { NextApiRequest } from 'next';
import type { Socket } from 'socket.io';
import {
  ServerToClientEvents,
  ClientToServerEvents,
  ResponseWithSocket
} from '@/types/socket';

interface GameState {
  isActive: boolean;
  startTime: number | null;
  participants: Map<string, string>;
  hashes: Array<{ hash: string; participant: string; timestamp: number }>;
  winners: Array<{ participant: string; hash: string; round: number }>;
  currentRound: number;
}

const state: GameState = {
  isActive: false,
  startTime: null,
  participants: new Map(),
  hashes: [],
  winners: [],
  currentRound: 0,
};

const ROUND_DURATION = 120000; // 2 minutes in milliseconds

export default function SocketHandler(
  req: NextApiRequest,
  res: ResponseWithSocket
) {
  if (res.socket.server.io) {
    console.log('Socket is already running');
    res.end();
    return;
  }

  console.log('Socket is initializing');
  const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(res.socket.server as any, {
    path: '/api/socket',
    transports: ['websocket', 'polling'],
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });
  res.socket.server.io = io;

  io.on('connection', (socket: Socket<ClientToServerEvents, ServerToClientEvents>) => {
    console.log('Client connected');

    socket.on('join', (name: string) => {
      state.participants.set(socket.id, name);
      io.emit('participants', Array.from(state.participants.values()));
    });

    socket.on('startRound', () => {
      if (state.isActive) return;
      
      state.isActive = true;
      state.startTime = Date.now();
      state.currentRound++;
      state.hashes = [];
      io.emit('roundStarted', { round: state.currentRound });

      setTimeout(() => {
        state.isActive = false;
        const validHashes = state.hashes
          .sort((a, b) => a.timestamp - b.timestamp)
          .filter(h => h.hash.startsWith('0'));

        if (validHashes.length > 0) {
          const winner = validHashes[0];
          state.winners.push({
            participant: winner.participant,
            hash: winner.hash,
            round: state.currentRound
          });
          io.emit('roundEnded', {
            winner: winner.participant,
            hash: winner.hash,
            round: state.currentRound
          });
        } else {
          io.emit('roundEnded', { 
            winner: null,
            round: state.currentRound 
          });
        }
      }, ROUND_DURATION);
    });

    socket.on('submitHash', (hash: string) => {
      if (state.isActive && state.participants.has(socket.id)) {
        state.hashes.push({
          hash,
          participant: state.participants.get(socket.id)!,
          timestamp: Date.now()
        });
      }
    });

    socket.on('disconnect', () => {
      state.participants.delete(socket.id);
      io.emit('participants', Array.from(state.participants.values()));
    });
  });

  res.end();
}
