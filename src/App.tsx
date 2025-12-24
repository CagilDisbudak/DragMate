import { useState } from 'react';
import { Background } from './components/Background';
import { Lobby } from './components/Lobby/Lobby';
import { Game } from './components/Game/Game';
import { useGameRoom } from './hooks/useGameRoom';
import { useBackgammonGame } from './hooks/useBackgammonGame';

import { BackgammonGame } from './components/Game/BackgammonGame';

type GameMode = 'menu' | 'local' | 'online';
type GameType = 'chess' | 'backgammon';

function App() {
  const [gameMode, setGameMode] = useState<GameMode>('menu');
  const [selectedGame, setSelectedGame] = useState<GameType>('chess');
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [aiDifficulty, setAiDifficulty] = useState<'Easy' | 'Normal' | 'Hard'>('Normal'); // Default Normal
  const chessRoom = useGameRoom(null);
  const backgammonRoom = useBackgammonGame(null);

  // Use the appropriate hook's auth loading state
  const isAuthLoading = selectedGame === 'chess' ? chessRoom.isAuthLoading : backgammonRoom.isAuthLoading;

  const handleCreateRoom = async () => {
    try {
      const id = selectedGame === 'chess' 
        ? await chessRoom.createRoom()
        : await backgammonRoom.createRoom();
      if (id) {
        setCurrentRoomId(id);
        setGameMode('online');
      }
    } catch (error) {
      console.error('Failed to create room:', error);
    }
  };

  const handleJoinRoom = async (id: string) => {
    if (id.trim()) {
      try {
        if (selectedGame === 'chess') {
          await chessRoom.joinRoom(id);
        } else {
          await backgammonRoom.joinRoom(id);
        }
        setCurrentRoomId(id);
        setGameMode('online');
      } catch (error) {
        console.error('Failed to join room:', error);
        alert('Room not found or could not join');
      }
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
