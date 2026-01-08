import React, { useCallback, useMemo } from 'react';
import { Board101 } from '../101Board/Board101';
import { use101Game } from '../../hooks/use101Game';
import { use101Room } from '../../hooks/use101Room';
import type { Room101 } from '../../hooks/use101Room';
import type { Game101State, Meld } from '../../logic/101Logic';

interface Game101Props {
    roomId: string | null;
    mode: 'local' | 'online';
    aiDifficulty?: 'easy' | 'medium' | 'hard';
    onExit: () => void;
}

// Convert Room101 to Game101State
const roomToGameState = (room: Room101): Game101State => {
    // Convert MeldMap to proper format for Game101State
    const tableMelds: { [key: string]: Meld } = {};
    if (room.tableMelds) {
        Object.entries(room.tableMelds).forEach(([key, meld]) => {
            tableMelds[key] = meld as Meld;
        });
    }

    // Convert discardPiles map to array format
    const discardPiles = [
        room.discardPiles?.['0'] || [],
        room.discardPiles?.['1'] || [],
        room.discardPiles?.['2'] || [],
        room.discardPiles?.['3'] || [],
    ] as Game101State['discardPiles'];

    return {
        phase: room.phase === 'waiting' ? 'dealing' : room.phase as Game101State['phase'],
        players: room.players.map(p => ({
            tiles: p.tiles,
            score: p.score,
            hasLaidDown: p.hasLaidDown
        })),
        centerStack: room.centerStack,
        discardPiles: discardPiles,
        indicatorTile: room.indicatorTile ?? null,
        okeyTile: room.okeyTile ?? null,
        tableMelds: tableMelds,
        currentTurn: room.currentTurn,
        roundWinner: room.roundWinner,
        gameWinner: room.gameWinner,
        roundNumber: room.roundNumber
    };
};

export const Game101: React.FC<Game101Props> = ({ roomId, mode, onExit }) => {
    // Use local game hook for local mode
    const localGame = use101Game(mode === 'local' ? roomId : null);

    // Use room hook for online mode
    const roomHook = use101Room(mode === 'online' ? roomId : null);

    // Determine which state and handlers to use
    const isOnline = mode === 'online';
    const room = roomHook.room;
    const mySlot = roomHook.getMySlot();
    const isHost = roomHook.isHost();

    // Get game state
    const gameState: Game101State | null = useMemo(() => {
        return isOnline
            ? (room ? roomToGameState(room) : null)
            : localGame.gameState;
    }, [isOnline, room, localGame.gameState]);

    // Selected tiles
    const selectedTileIndices = isOnline ? roomHook.selectedTileIndices : localGame.selectedTileIndices;

    // Handlers
    const handleToggleSelection = useCallback((index: number) => {
        if (isOnline) {
            roomHook.toggleTileSelection(index);
        } else {
            localGame.toggleTileSelection(index);
        }
    }, [isOnline, roomHook, localGame]);

    const handleClearSelection = useCallback(() => {
        if (isOnline) {
            roomHook.clearSelection();
        } else {
            localGame.clearSelection();
        }
    }, [isOnline, roomHook, localGame]);

    const handleDraw = useCallback((targetSlot?: number) => {
        if (isOnline) {
            roomHook.drawFromCenter(targetSlot);
        } else {
            localGame.drawFromCenter(targetSlot);
        }
    }, [isOnline, roomHook, localGame]);

    const handleDrawDiscard = useCallback((targetSlot?: number) => {
        if (isOnline) {
            roomHook.drawFromDiscard(targetSlot);
        } else {
            localGame.drawFromDiscard(targetSlot);
        }
    }, [isOnline, roomHook, localGame]);

    const handleMoveTile = useCallback((fromIndex: number, toIndex: number) => {
        if (isOnline) {
            roomHook.moveTileInRack(fromIndex, toIndex);
        } else {
            localGame.moveTileInRack(fromIndex, toIndex);
        }
    }, [isOnline, roomHook, localGame]);

    const handleDiscard = useCallback((index: number) => {
        if (isOnline) {
            roomHook.discardTile(index);
        } else {
            localGame.discardTile(index);
        }
    }, [isOnline, roomHook, localGame]);

    const handleLayDownMeld = useCallback(() => {
        if (isOnline) {
            roomHook.layDownMeld();
        } else {
            localGame.layDownMeld();
        }
    }, [isOnline, roomHook, localGame]);

    const handleAddToMeld = useCallback((tileIndex: number, meldId: string) => {
        if (isOnline) {
            roomHook.addToMeld(tileIndex, meldId);
        } else {
            localGame.addToMeld(tileIndex, meldId);
        }
    }, [isOnline, roomHook, localGame]);

    const handleSortByRuns = useCallback(() => {
        if (isOnline) {
            roomHook.sortTilesByRuns();
        } else {
            localGame.sortTilesByRuns();
        }
    }, [isOnline, roomHook, localGame]);

    const handleSelectRuns = useCallback(() => {
        if (isOnline) {
            roomHook.selectRuns();
        } else {
            localGame.selectRuns();
        }
    }, [isOnline, roomHook, localGame]);

    const handleSelectSets = useCallback(() => {
        if (isOnline) {
            roomHook.selectSets();
        } else {
            localGame.selectSets();
        }
    }, [isOnline, roomHook, localGame]);

    const handleSortByPairs = useCallback(() => {
        if (isOnline) {
            roomHook.sortTilesByPairs();
        } else {
            localGame.sortTilesByPairs();
        }
    }, [isOnline, roomHook, localGame]);

    const handleReset = useCallback(() => {
        if (isOnline) {
            roomHook.resetGame();
        } else {
            localGame.resetGame();
        }
    }, [isOnline, roomHook, localGame]);

    const handleNewRound = useCallback(() => {
        if (isOnline) {
            roomHook.startNewRound();
        } else {
            localGame.newRound();
        }
    }, [isOnline, roomHook, localGame]);

    // Get player info for display
    const getPlayerInfo = useCallback((index: number) => {
        if (isOnline && room) {
            const player = room.players[index];
            return {
                name: player?.adPlayerName || `Player ${index + 1}`,
                isAI: player?.adIsAI || false,
                isYou: player?.odaUserId === roomHook.userId
            };
        }
        // Local mode defaults
        const defaultNames = ['Siz', 'Bot 1', 'Bot 2', 'Bot 3'];
        return {
            name: defaultNames[index],
            isAI: index !== 0,
            isYou: index === 0
        };
    }, [isOnline, room, roomHook.userId]);

    // Loading states
    if (isOnline && (roomHook.loading || roomHook.isAuthLoading)) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-white text-xl">Bağlanıyor...</div>
            </div>
        );
    }

    if (isOnline && roomHook.error) {
        return (
            <div className="flex flex-col items-center justify-center h-screen gap-4">
                <div className="text-red-400 text-xl">{roomHook.error}</div>
                <button
                    onClick={onExit}
                    className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg"
                >
                    Geri Dön
                </button>
            </div>
        );
    }

    // Waiting room
    if (isOnline && room && room.phase === 'waiting') {
        return (
            <div className="flex flex-col items-center justify-center h-screen gap-6">
                <h2 className="text-2xl font-bold text-white">101 Odası: {room.roomId}</h2>
                <div className="bg-[#1a3625]/80 rounded-lg p-6 min-w-[300px]">
                    <h3 className="text-amber-400 font-bold mb-4">Oyuncular ({room.players.length}/4)</h3>
                    {room.players.map((player, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-white py-2">
                            <span className={player.odaUserId === roomHook.userId ? 'text-amber-400' : ''}>
                                {player.adPlayerName}
                                {player.odaUserId === roomHook.userId && ' (Sen)'}
                                {player.odaUserId === room.hostUserId && ' 👑'}
                            </span>
                        </div>
                    ))}
                    {room.players.length < 4 && (
                        <div className="text-gray-400 text-sm mt-2">
                            Boş slotlar AI ile doldurulacak
                        </div>
                    )}
                </div>
                {isHost && (
                    <button
                        onClick={() => roomHook.startGame()}
                        className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg"
                    >
                        Oyunu Başlat
                    </button>
                )}
                {!isHost && (
                    <div className="text-gray-400">Host'un oyunu başlatmasını bekleyin...</div>
                )}
                <button
                    onClick={onExit}
                    className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg"
                >
                    Odadan Ayrıl
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-[85vh] fade-in animate-in duration-700">
            <Board101
                gameState={gameState}
                selectedTileIndices={selectedTileIndices}
                onToggleSelection={handleToggleSelection}
                onClearSelection={handleClearSelection}
                onDraw={handleDraw}
                onDrawDiscard={handleDrawDiscard}
                onMoveTile={handleMoveTile}
                onDiscard={handleDiscard}
                onLayDownMeld={handleLayDownMeld}
                onAddToMeld={handleAddToMeld}
                onSortByRuns={handleSortByRuns}
                onSortByPairs={handleSortByPairs}
                onSelectRuns={handleSelectRuns}
                onSelectSets={handleSelectSets}
                onReset={handleReset}
                onNewRound={handleNewRound}
                onExit={onExit}
                playerInfo={useMemo(() =>
                    isOnline && room ? room.players.map((_, i) => getPlayerInfo(i)) : undefined,
                    [isOnline, room, getPlayerInfo]
                )}
                mySlot={isOnline ? mySlot : 0}
            />
        </div>
    );
};

