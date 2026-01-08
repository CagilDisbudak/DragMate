import { useState, useEffect } from 'react';
import { Background } from './components/Background';
import { Lobby } from './components/Lobby/Lobby';
import { Game } from './components/Game/Game';
import { useGameRoom } from './hooks/useGameRoom';
import { useBackgammonGame } from './hooks/useBackgammonGame';
import { use101Room } from './hooks/use101Room';

import { BackgammonGame } from './components/Game/BackgammonGame';
import { OkeyGame } from './components/Game/OkeyGame';
import { Game101 } from './components/Game/Game101';

type GameMode = 'menu' | 'local' | 'online' | 'okey-lobby' | '101-lobby';
type GameType = 'chess' | 'backgammon' | 'okey' | '101';

function App() {
  const [gameMode, setGameMode] = useState<GameMode>('menu');
  const [selectedGame, setSelectedGame] = useState<GameType>('chess');
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [aiDifficulty, setAiDifficulty] = useState<'Easy' | 'Normal' | 'Hard'>('Normal');

  const chessRoom = useGameRoom(null);
  const backgammonRoom = useBackgammonGame(null);

  // Okey online su an devre disi, sadece local Okey kullaniliyor
  const okeyRoomHook: any = {
    room: null,
    isAuthLoading: false,
    createRoom: async (_name: string) => null,
    joinRoom: async (_roomId: string, _name: string) => false,
    startGame: async () => {},
    leaveRoom: async () => {},
  };
  // 101 room with roomId for real-time sync
  const room101Hook = use101Room(selectedGame === '101' ? currentRoomId : null);

  // Use the appropriate hook's auth loading state
  const isAuthLoading =
    selectedGame === 'chess' ? chessRoom.isAuthLoading :
      selectedGame === 'backgammon' ? backgammonRoom.isAuthLoading :
        selectedGame === '101' ? room101Hook.isAuthLoading :
          okeyRoomHook.isAuthLoading;

  // Watch for Okey game start
  useEffect(() => {
    if (okeyRoomHook.room?.phase === 'playing' && gameMode === 'okey-lobby') {
      setGameMode('online');
    }
  }, [okeyRoomHook.room?.phase, gameMode]);

  // Watch for 101 game start
  useEffect(() => {
    if (room101Hook.room?.phase === 'playing' && gameMode === '101-lobby') {
      setGameMode('online');
    }
  }, [room101Hook.room?.phase, gameMode]);

  const handleCreateRoom = async () => {
    try {
      if (selectedGame === 'chess') {
        const id = await chessRoom.createRoom();
        if (id) {
          setCurrentRoomId(id);
          setGameMode('online');
        }
      } else if (selectedGame === 'backgammon') {
        const id = await backgammonRoom.createRoom();
        if (id) {
          setCurrentRoomId(id);
          setGameMode('online');
        }
      }
      // Okey uses different flow (handleCreateOkeyRoom)
    } catch (error) {
      console.error('Failed to create room:', error);
    }
  };

  const handleJoinRoom = async (id: string) => {
    if (id.trim()) {
      try {
        if (selectedGame === 'chess') {
          await chessRoom.joinRoom(id);
          setCurrentRoomId(id);
          setGameMode('online');
        } else if (selectedGame === 'backgammon') {
          await backgammonRoom.joinRoom(id);
          setCurrentRoomId(id);
          setGameMode('online');
        }
        // Okey uses different flow (handleJoinOkeyRoom)
      } catch (error) {
        console.error('Failed to join room:', error);
        alert('Room not found or could not join');
      }
    }
  };

  // Okey specific handlers
  const handleCreateOkeyRoom = async (playerName: string): Promise<string | null> => {
    try {
      console.log('Creating Okey room for player:', playerName);
      const id = await okeyRoomHook.createRoom(playerName);
      console.log('Okey room created with ID:', id);
      setCurrentRoomId(id);
      setGameMode('okey-lobby');
      return id;
    } catch (error) {
      console.error('Failed to create Okey room:', error);
      alert('Oda oluşturulamadı: ' + (error instanceof Error ? error.message : 'Bilinmeyen hata'));
      return null;
    }
  };

  const handleJoinOkeyRoom = async (roomId: string, playerName: string): Promise<boolean> => {
    try {
      const success = await okeyRoomHook.joinRoom(roomId, playerName);
      if (success) {
        setCurrentRoomId(roomId);
        setGameMode('okey-lobby');
      }
      return success;
    } catch (error) {
      console.error('Failed to join Okey room:', error);
      return false;
    }
  };

  const handleStartOkeyGame = async () => {
    try {
      await okeyRoomHook.startGame();
    } catch (error) {
      console.error('Failed to start Okey game:', error);
    }
  };

  // 101 specific handlers
  const handleCreate101Room = async (playerName: string): Promise<string | null> => {
    try {
      const id = await room101Hook.createRoom(playerName);
      setCurrentRoomId(id);
      setGameMode('101-lobby');
      return id;
    } catch (error) {
      console.error('Failed to create 101 room:', error);
      alert('Oda oluşturulamadı: ' + (error instanceof Error ? error.message : 'Bilinmeyen hata'));
      return null;
    }
  };

  const handleJoin101Room = async (roomId: string, playerName: string): Promise<boolean> => {
    try {
      const success = await room101Hook.joinRoom(roomId, playerName);
      if (success) {
        setCurrentRoomId(roomId);
        setGameMode('101-lobby');
      }
      return success;
    } catch (error) {
      console.error('Failed to join 101 room:', error);
      return false;
    }
  };

  const handleStart101Game = async () => {
    try {
      await room101Hook.startGame();
    } catch (error) {
      console.error('Failed to start 101 game:', error);
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

  const handleExitGame = async () => {
    if (selectedGame === 'okey' && currentRoomId) {
      await okeyRoomHook.leaveRoom();
    }
    setCurrentRoomId(null);
    setGameMode('menu');
  };

  // Determine if we should show lobby or game
  const showLobby = gameMode === 'menu' || gameMode === 'okey-lobby' || gameMode === '101-lobby';

  return (
    <main className="relative min-h-screen w-full flex flex-col items-center overflow-x-hidden">
      <Background />

      <div className="container mx-auto px-4 py-8 max-w-7xl w-full overflow-visible">
        {!showLobby ? (
          selectedGame === 'chess' ? (
            <Game
              roomId={currentRoomId || ''}
              mode={gameMode === 'online' ? 'online' : 'local'}
              aiDifficulty={aiDifficulty}
              onExit={handleExitGame}
            />
          ) : selectedGame === 'backgammon' ? (
            <BackgammonGame
              roomId={currentRoomId || ''}
              mode={gameMode === 'online' ? 'online' : 'local'}
              aiDifficulty={aiDifficulty}
              onExit={handleExitGame}
            />
          ) : selectedGame === '101' ? (
            <Game101
              roomId={currentRoomId || ''}
              mode={gameMode === 'online' ? 'online' : 'local'}
              onExit={handleExitGame}
            />
          ) : (
            <OkeyGame
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
            // Okey multiplayer props
            selectedGame={selectedGame}
            onCreateOkeyRoom={handleCreateOkeyRoom}
            onJoinOkeyRoom={handleJoinOkeyRoom}
            onStartOkeyGame={handleStartOkeyGame}
            okeyRoom={okeyRoomHook.room}
            okeyUserId={okeyRoomHook.userId}
            // 101 multiplayer props
            onCreate101Room={handleCreate101Room}
            onJoin101Room={handleJoin101Room}
            onStart101Game={handleStart101Game}
            room101={room101Hook.room}
            user101Id={room101Hook.userId}
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
