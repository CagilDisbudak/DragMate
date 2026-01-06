import React, { useEffect, useCallback } from 'react';
import { useOkeyGame } from '../../hooks/useOkeyGame';
import { useOkeyRoom } from '../../hooks/useOkeyRoom';
import type { OkeyRoom, DiscardPilesMap } from '../../hooks/useOkeyRoom';
import { OkeyBoard } from '../OkeyBoard/OkeyBoard';
import { LogOut, Users, Bot, User } from 'lucide-react';
import type { OkeyGameState, PlayerHand } from '../../logic/okeyLogic';

interface OkeyGameProps {
    roomId: string;
    mode: 'local' | 'online';
    aiDifficulty: 'Easy' | 'Normal' | 'Hard';
    onExit: () => void;
}

// Helper to convert map to array format
const discardPilesToArray = (map: DiscardPilesMap): any[][] => [
    map.pile0 || [],
    map.pile1 || [],
    map.pile2 || [],
    map.pile3 || []
];

// Convert OkeyRoom to OkeyGameState for the board
const roomToGameState = (room: OkeyRoom): OkeyGameState => {
    return {
        phase: room.phase === 'waiting' ? 'dealing' : room.phase as any,
        players: room.players.map(p => ({ tiles: p.tiles })) as PlayerHand[],
        centerStack: room.centerStack,
        discardPiles: discardPilesToArray(room.discardPiles),
        indicatorTile: room.indicatorTile,
        okeyTile: room.okeyTile,
        currentTurn: room.currentTurn,
        winner: room.winner
    };
};

export const OkeyGame: React.FC<OkeyGameProps> = ({ roomId, mode, aiDifficulty, onExit }) => {
    // Use local game hook for local mode
    const localGame = useOkeyGame(mode === 'local' ? roomId : null);
    
    // Use room hook for online mode
    const roomHook = useOkeyRoom(mode === 'online' ? roomId : null);

    // Determine which state and handlers to use
    const isOnline = mode === 'online';
    const room = roomHook.room;
    const mySlot = roomHook.getMySlot();
    const isHost = roomHook.isHost();

    // Get game state - either from local or room
    const gameState: OkeyGameState | null = isOnline 
        ? (room ? roomToGameState(room) : null)
        : localGame.gameState;

    // AI turn handler for online mode
    const handleAITurn = useCallback(async () => {
        if (!room || !isHost) return;
        if (room.phase !== 'playing') return;

        const currentPlayer = room.players[room.currentTurn];
        if (!currentPlayer?.adIsAI) return;

        // AI logic: draw from center, then discard first tile
        const newStack = [...room.centerStack];
        const drawn = newStack.pop();

        if (!drawn) return;

        const newPlayers = [...room.players];
        const rack = [...newPlayers[room.currentTurn].tiles];
        const emptyIdx = rack.findIndex(s => s === null);
        if (emptyIdx !== -1) rack[emptyIdx] = drawn;

        // Discard first available tile
        const firstTileIdx = rack.findIndex(s => s !== null);
        const discarded = rack[firstTileIdx];
        rack[firstTileIdx] = null;

        newPlayers[room.currentTurn] = { ...newPlayers[room.currentTurn], tiles: rack };

        // Update discard piles using map format
        const pileKey = `pile${room.currentTurn}` as keyof DiscardPilesMap;
        const currentPile = room.discardPiles[pileKey] || [];
        const newDiscardPiles: DiscardPilesMap = {
            ...room.discardPiles,
            [pileKey]: discarded ? [...currentPile, discarded] : currentPile
        };

        const nextTurn = (room.currentTurn + 1) % 4;
        const finalPhase = newStack.length === 0 ? 'stackEmpty' : 'playing';

        await roomHook.updateGameState({
            centerStack: newStack,
            players: newPlayers,
            discardPiles: newDiscardPiles,
            currentTurn: nextTurn,
            phase: finalPhase as any
        });
    }, [room, isHost, roomHook]);

    // Run AI turns
    useEffect(() => {
        if (!isOnline || !room || !isHost) return;
        if (room.phase !== 'playing') return;

        const currentPlayer = room.players[room.currentTurn];
        if (!currentPlayer?.adIsAI) return;

        const timer = setTimeout(() => {
            handleAITurn();
        }, 1500);

        return () => clearTimeout(timer);
    }, [isOnline, room?.currentTurn, room?.phase, isHost, handleAITurn]);

    // Handlers - route to appropriate hook
    const handleDraw = useCallback((index?: number) => {
        if (isOnline) {
            roomHook.drawFromCenter(index);
        } else {
            localGame.drawFromCenter(index);
        }
    }, [isOnline, roomHook, localGame]);

    const handleDrawDiscard = useCallback((index?: number) => {
        if (isOnline) {
            roomHook.drawFromDiscard(index);
        } else {
            localGame.drawFromDiscard(index);
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

    const handleFinish = useCallback((index: number) => {
        if (isOnline) {
            roomHook.finishGame(index);
        } else {
            localGame.finishGame(index);
        }
    }, [isOnline, roomHook, localGame]);

    const handleReset = useCallback(() => {
        if (isOnline) {
            roomHook.resetGame();
        } else {
            localGame.resetGame();
        }
    }, [isOnline, roomHook, localGame]);

    const handleReshuffle = useCallback(() => {
        if (isOnline) {
            roomHook.reshuffleDiscards();
        } else {
            localGame.reshuffleDiscards();
        }
    }, [isOnline, roomHook, localGame]);

    const handleEndTie = useCallback(() => {
        if (isOnline) {
            roomHook.endInTie();
        } else {
            localGame.endInTie();
        }
    }, [isOnline, roomHook, localGame]);

    const handleAutoSort = useCallback(() => {
        if (isOnline) {
            roomHook.autoSortTiles();
        } else {
            localGame.autoSortTiles();
        }
    }, [isOnline, roomHook, localGame]);

    // Get player info for display
    const getPlayerInfo = (index: number) => {
        if (isOnline && room) {
            const player = room.players[index];
            return {
                name: player.adPlayerName || `Player ${index + 1}`,
                isAI: player.adIsAI,
                isYou: player.odaUserId === roomHook.userId
            };
        }
        // Local mode defaults
        const defaultNames = ['Siz', 'Bot 1', 'Bot 2', 'Bot 3'];
        return {
            name: defaultNames[index],
            isAI: index !== 0,
            isYou: index === 0
        };
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-[85vh] fade-in animate-in duration-700">
            <div className="w-full max-w-6xl mb-6 flex justify-between items-center text-white px-4">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onExit}
                        className="p-3 bg-slate-800/80 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-xl transition-all border border-slate-700 hover:border-red-500/50"
                        title="Leave Game"
                    >
                        <LogOut size={20} />
                    </button>
                    <div>
                        <h2 className="text-2xl font-black tracking-tight">Okey Arena</h2>
                        <div className="text-xs font-medium text-emerald-400 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            {mode === 'online' ? `Room: ${roomId}` : `Local • ${aiDifficulty} AI`}
                        </div>
                    </div>
                </div>

                {/* Online player indicators */}
                {isOnline && room && (
                    <div className="flex items-center gap-2">
                        {room.players.map((player, idx: number) => (
                            <div
                                key={idx}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                    room.currentTurn === idx
                                        ? 'bg-amber-500/20 border border-amber-500/50 text-amber-400'
                                        : 'bg-slate-800/50 border border-slate-700 text-slate-400'
                                }`}
                            >
                                {player.adIsAI ? (
                                    <Bot size={14} />
                                ) : player.odaUserId === roomHook.userId ? (
                                    <User size={14} className="text-emerald-400" />
                                ) : (
                                    <Users size={14} />
                                )}
                                <span className="truncate max-w-[60px]">
                                    {player.adPlayerName || (player.adIsAI ? `Bot ${idx + 1}` : 'Empty')}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <OkeyBoard
                gameState={gameState}
                onDraw={handleDraw}
                onDrawDiscard={handleDrawDiscard}
                onMoveTile={handleMoveTile}
                onDiscard={handleDiscard}
                onAutoSort={handleAutoSort}
                onFinish={handleFinish}
                onReset={handleReset}
                onReshuffle={handleReshuffle}
                onEndTie={handleEndTie}
                onExit={onExit}
                // Pass multiplayer info
                playerInfo={isOnline && room ? room.players.map((_, i) => getPlayerInfo(i)) : undefined}
                mySlot={isOnline ? mySlot : 0}
            />

            <footer className="text-slate-600 font-bold uppercase tracking-[0.4em] text-[10px] pt-10 flex flex-col items-center gap-1">
                <span>Transparent Strategy Arena</span>
                <span className="text-slate-700 text-[8px]">v0.1.0</span>
            </footer>
        </div>
    );
};
