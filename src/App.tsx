import { useState } from 'react';
import { Background } from './components/Background';
import { Lobby } from './components/Lobby/Lobby';
import { Game } from './components/Game/Game';
import { useGameRoom } from './hooks/useGameRoom';

function App() {
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const { createRoom, isAuthLoading } = useGameRoom(null);

  const handleCreateRoom = async () => {
    const id = await createRoom();
    if (id) setCurrentRoomId(id);
  };

  const handleJoinRoom = (id: string) => {
    if (id.trim()) setCurrentRoomId(id);
  };

  const handleExitGame = () => {
    setCurrentRoomId(null);
  };

  return (
    <main className="relative min-h-screen w-full flex flex-col items-center">
      <Background />

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {currentRoomId ? (
          <Game roomId={currentRoomId} onExit={handleExitGame} />
        ) : (
          <Lobby
            onCreateRoom={handleCreateRoom}
            onJoinRoom={handleJoinRoom}
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
