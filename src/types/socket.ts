import { Server as NetServer, Socket } from 'net';
import { NextApiResponse } from 'next';
import { Server as SocketIOServer } from 'socket.io';

export interface ServerToClientEvents {
  participants: (participants: string[]) => void;
  roundStarted: (data: { round: number }) => void;
  roundEnded: (data: { winner: string | null; hash?: string; round: number }) => void;
}

export interface ClientToServerEvents {
  join: (name: string) => void;
  startRound: () => void;
  submitHash: (hash: string) => void;
}

export interface SocketServer extends NetServer {
  io?: SocketIOServer<ClientToServerEvents, ServerToClientEvents>;
}

export type ResponseWithSocket = NextApiResponse & {
  socket: Socket & {
    server: SocketServer;
  };
  end: () => void;
}
