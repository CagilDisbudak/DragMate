import { useState } from 'react';
import { Background } from './components/Background';
import { Lobby } from './components/Lobby/Lobby';
import { Game } from './components/Game/Game';
import { useGameRoom } from './hooks/useGameRoom';

import { BackgammonGame } from './components/Game/BackgammonGame';

type GameMode = 'menu' | 'local' | 'online';
type GameType = 'chess' | 'backgammon';

function App() {
  const [gameMode, setGameMode] = useState<GameMode>('menu');
  const [selectedGame, setSelectedGame] = useState<GameType>('chess');
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
      // If ID starts with certain prefix or valid room check could set game type, 
      // but for now let's assume Chess unless logic later says otherwise?
      // Actually we need to know what game type to join.
      // Simplify: Let user pick game type likely, OR auto-detect. 
      // For now, let's just default Chess for existing flow, or if we want generic support we need metadata.
      // But Backgammon rooms are separate collection 'rooms_bg'.
      // TODO: Better room handling. For now assuming Lobby sets game type before join?
      // Actually handleJoinRoom is called from Lobby.
    }
  };

  const handleSelectGame = (game: GameType) => {
    setSelectedGame(game);
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

          selectedGame === 'chess' ? (
            <Game
              roomId={currentRoomId || ''}
              mode={gameMode === 'online' ? 'online' : 'local'}
              aiDifficulty={aiDifficulty}
              onExit={handleExitGame}
            />
          ) : (
            <BackgammonGame
              roomId={currentRoomId || ''}
              mode={gameMode === 'online' ? 'online' : 'local'}
              aiDifficulty={aiDifficulty}
              onExit={handleExitGame}
            />
          )
        ) : (
          <Lobby
            onCreateRoom={handleCreateRoom}
            onJoinRoom={handleJoinRoom}
            onStartLocal={handleStartLocal}
            isAuthLoading={isAuthLoading}
            onSelectGame={handleSelectGame}
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
