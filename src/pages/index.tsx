import { useEffect, useState } from 'react';
import { default as socketIO } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import CryptoJS from 'crypto-js';
import type { ClientToServerEvents, ServerToClientEvents } from '@/types/socket';

let socket: ReturnType<typeof socketIO>;

export default function Home() {
  const [name, setName] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [participants, setParticipants] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(false);
  const [timeLeft, setTimeLeft] = useState(120);
  const [winner, setWinner] = useState<{ name: string; hash: string } | null>(null);
  const [currentRound, setCurrentRound] = useState(0);
  const [hashCounts, setHashCounts] = useState<Record<string, number>>({});
  const [blockchain, setBlockchain] = useState<Array<{
    index: number;
    timestamp: number;
    winner: string;
    hash: string;
    previousHash: string;
  }>>([]);

  useEffect(() => {
    socketInitializer();
  }, []);

  const socketInitializer = async () => {
    await fetch('/api/socket');
    socket = socketIO(typeof window !== 'undefined' ? window.location.origin : '', {
      path: '/api/socket',

      transports: ['websocket', 'polling']
    });

    socket.on('participants', (updatedParticipants: string[]) => {
      setParticipants(updatedParticipants);
    });

    socket.on('adminStatus', (isAdmin: boolean) => {
      setIsAdmin(isAdmin);
    });

    socket.on('roundStatus', ({ isActive, admin }: { isActive: boolean; admin: string }) => {
      setIsActive(isActive);
      if (admin === name) {
        setIsAdmin(true);
      }
    });

    socket.on('roundStarted', ({ round }: { round: number }) => {
      setIsActive(true);
      setTimeLeft(120);
      setWinner(null);
      setCurrentRound(round);
      setHashCounts({});
    });

    socket.on('hashCount', ({ name, count }: { name: string; count: number }) => {
      setHashCounts(prev => ({ ...prev, [name]: count }));
    });

    socket.on('roundEnded', ({ winner, hash, round, block }: { winner: string | null; hash?: string; round: number; block?: any }) => {
      console.log('Round ended with winner:', winner, 'hash:', hash);
      setIsActive(false);
      setTimeLeft(0);
      if (winner) {
        setWinner({ name: winner, hash: hash || '' });
        if (block) {
          setBlockchain(prev => [...prev, block]);
        }
        console.log('Setting winner state:', { name: winner, hash: hash || '' });
      }
    });
  };

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((time: number) => time - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft]);

  const handleJoin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (name) {
      socket.emit('join', name);
      setIsJoined(true);
      if (participants.length === 0) {
        setIsAdmin(true);
      }
    }
  };

  const handleStartRound = () => {
    console.log('Attempting to start round as:', name, 'isAdmin:', isAdmin);
    if (isAdmin && name) {
      console.log('Emitting startRound event');
      socket.emit('startRound', name);
    }
  };

  const handleMining = () => {
    if (isActive && name) {
      const timestamp = Date.now().toString();
      const hash = CryptoJS.SHA256(timestamp + name).toString();
      console.log('Submitting hash:', { name, hash });
      socket.emit('submitHash', { name, hash });
    }
  };

  if (!isJoined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <form onSubmit={handleJoin} className="bg-white p-8 rounded-lg shadow-md">
          <h1 className="text-2xl font-bold mb-4">Join Bitcoin Mining Game</h1>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name"
            className="w-full p-2 border rounded mb-4"
            required
          />
          <button
            type="submit"
            className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600"
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-6 flex flex-col justify-center sm:py-12">
      <div className="relative py-3 sm:max-w-4xl sm:mx-auto">
        <div className="relative px-4 py-10 bg-white shadow-lg sm:rounded-3xl sm:p-20">
          <h1 className="text-2xl font-bold mb-4">Bitcoin Mining Game</h1>
          <div className="flex justify-between items-center mb-4">
            <div>
              <p className="font-semibold">Current Round: {currentRound}</p>
              <p>Time Left: {timeLeft} seconds</p>
            </div>
            {isAdmin && !isActive && (
              <button
                onClick={handleStartRound}
                className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
              >
                Start Round
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="mt-4">
              <p>Time Left: {timeLeft} seconds</p>
              <div className="mt-2">
                <h3 className="font-bold">Hash Counts:</h3>
                <div className="space-y-1">
                  {Object.entries(hashCounts).map(([player, count]) => (
                    <div key={player} className="flex justify-between">
                      <span>{player}:</span>
                      <span className="font-mono">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
              <button
                onClick={handleMining}
                disabled={!isActive}
                className={`mt-4 px-4 py-2 rounded ${isActive ? 'bg-blue-500 hover:bg-blue-700' : 'bg-gray-400'} text-white`}
              >
                Mine
              </button>
            </div>

            {blockchain.length > 0 && (
              <div className="mt-8">
                <h3 className="font-bold mb-4">Blockchain:</h3>
                <div className="space-y-4">
                  {blockchain.map((block, index) => (
                    <div key={block.index} className="p-4 border rounded-lg bg-gray-50">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold">Block #{block.index}</p>
                          <p className="text-sm">Winner: {block.winner}</p>
                          <p className="text-xs font-mono truncate">
                            Hash: {block.hash.substring(0, 16)}...
                          </p>
                        </div>
                        {index < blockchain.length - 1 && (
                          <div className="text-gray-400 text-2xl">↓</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {!isActive && (
              <div className="text-center text-gray-500">
                Waiting for round to start...
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold mb-4">Participants</h2>
            <ul className="space-y-2">
              {participants.map((participant, index) => (
                <li
                  key={index}
                  className="p-2 bg-gray-50 rounded flex justify-between items-center"
                >
                  <span>{participant}</span>
                  {winner?.name === participant && (
                    <span className="text-yellow-500">👑 Winner!</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {winner && (
          <div className="mt-4 p-4 bg-green-100 rounded">
            <h3 className="text-xl font-bold text-green-800">🏆 Winner: {winner.name}</h3>
            <p className="text-green-600">Winning Hash: <span className="font-mono">{winner.hash}</span></p>
            <p className="text-sm text-green-700 mt-2">Found valid hash starting with '0'!</p>
          </div>
        )}
      </div>
    </div>
  );
}
