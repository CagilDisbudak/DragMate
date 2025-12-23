import { useState } from 'react';
import { Background } from './components/Background';
import { Lobby } from './components/Lobby/Lobby';
import { Game } from './components/Game/Game';
import { useGameRoom } from './hooks/useGameRoom';

type GameMode = 'menu' | 'local' | 'online';

function App() {
  const [gameMode, setGameMode] = useState<GameMode>('menu');
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [aiDifficulty, setAiDifficulty] = useState<'Easy' | 'Normal' | 'Hard'>('Normal'); // Default Normal
  const { createRoom, isAuthLoading } = useGameRoom(null);

  const handleCreateRoom = async () => {
    const id = await createRoom();
    if (id) {
      setCurrentRoomId(id);
      setGameMode('online');
    }
  };

  const handleJoinRoom = (id: string) => {
    if (id.trim()) {
      setCurrentRoomId(id);
      setGameMode('online');
    }
  };

  const handleStartLocal = (difficulty: 'Easy' | 'Normal' | 'Hard') => {
    setAiDifficulty(difficulty);
    setGameMode('local');
    setCurrentRoomId(null);
  };

  const handleExitGame = () => {
    setCurrentRoomId(null);
    setGameMode('menu');
  };

  return (
    <main className="relative min-h-screen w-full flex flex-col items-center overflow-x-hidden">
      <Background />

      <div className="container mx-auto px-4 py-8 max-w-7xl w-full overflow-visible">
        {gameMode !== 'menu' ? (
          <Game
            roomId={currentRoomId || ''}
            mode={gameMode === 'online' ? 'online' : 'local'}
            aiDifficulty={aiDifficulty}
            onExit={handleExitGame}
          />
        ) : (
          <Lobby
            onCreateRoom={handleCreateRoom}
            onJoinRoom={handleJoinRoom}
            onStartLocal={handleStartLocal}
            isAuthLoading={isAuthLoading}
          />
        )}
      </div>

      <footer className="mt-auto py-8 text-slate-500 text-sm">
        DragMate — Premium Multiplayer Board Gaming
      </footer>
    </main>
  );
}

export default App;
