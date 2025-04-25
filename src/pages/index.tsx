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

  useEffect(() => {
    socketInitializer();
  }, []);

  const socketInitializer = async () => {
    await fetch('/api/socket');
    socket = socketIO();

    socket.on('participants', (updatedParticipants: string[]) => {
      setParticipants(updatedParticipants);
    });

    socket.on('roundStarted', ({ round }: { round: number }) => {
      setIsActive(true);
      setTimeLeft(120);
      setWinner(null);
      setCurrentRound(round);
    });

    socket.on('roundEnded', ({ winner, hash, round }: { winner: string | null; hash?: string; round: number }) => {
      setIsActive(false);
      setTimeLeft(0);
      if (winner) {
        setWinner({ name: winner, hash: hash || '' });
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
    if (isAdmin) {
      socket.emit('startRound');
    }
  };

  const handleMining = () => {
    if (isActive) {
      const timestamp = Date.now().toString();
      const hash = CryptoJS.SHA256(timestamp + name).toString();
      socket.emit('submitHash', hash);
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
          >
            Join Game
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8 bg-gray-100">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
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
            <h2 className="text-xl font-bold mb-4">Mining Area</h2>
            {isActive ? (
              <button
                onClick={handleMining}
                className="w-full bg-blue-500 text-white p-4 rounded-lg text-xl font-bold hover:bg-blue-600 active:bg-blue-700"
              >
                TAP TO MINE!
              </button>
            ) : (
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
          <div className="mt-6 bg-yellow-100 border-yellow-400 border rounded-lg p-6">
            <h2 className="text-xl font-bold mb-2">Round Winner!</h2>
            <p>Winner: {winner.name}</p>
            <p className="text-sm text-gray-600">Winning Hash: {winner.hash}</p>
          </div>
        )}
      </div>
    </div>
  );
}
