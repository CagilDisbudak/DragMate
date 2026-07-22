import React, { useCallback, useMemo, useState } from 'react';
import { useOkeyGame } from '../../hooks/useOkeyGame';
import { useOkeyRoom } from '../../hooks/useOkeyRoom';
import type { OkeyRoom, DiscardPilesMap } from '../../hooks/useOkeyRoom';
import { OkeyBoard } from '../OkeyBoard/OkeyBoard';
import { LogOut, Bot, Copy, Check } from 'lucide-react';
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

// Convert OkeyRoom to OkeyGameState for the board - memoized
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

    // Inline "copied" feedback for the room code chip (visual only)
    const [copied, setCopied] = useState(false);

    // Determine which state and handlers to use
    const isOnline = mode === 'online';
    const room = roomHook.room;
    const mySlot = roomHook.getMySlot();

    // Get game state - either from local or room - memoized
    const gameState: OkeyGameState | null = useMemo(() => {
        return isOnline
            ? (room ? roomToGameState(room) : null)
            : localGame.gameState;
    }, [isOnline, room, localGame.gameState]);

    // AI turns are driven entirely by the authoritative server now (no host-side
    // timer), so a host disconnect no longer stalls bot players.

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

    const handleCopyRoom = useCallback(() => {
        navigator.clipboard?.writeText(roomId).catch(() => {});
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
    }, [roomId]);

    // Get player info for display - memoized
    const getPlayerInfo = useCallback((index: number) => {
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
    }, [isOnline, room, roomHook.userId]);

    return (
        // justify-start + padding (not justify-center): tall content must not clip the header
        <div className="relative isolate flex flex-col items-center min-h-[85vh] pt-2">
            {/* Ambient amber table glow */}
            <div className="bg-blob w-[42rem] h-[42rem] bg-amber-500/10 top-[-10%] left-[15%]" aria-hidden="true" />

            <div className="w-full max-w-6xl mb-5 flex flex-wrap items-center justify-between gap-3 text-white px-4 anim-fade-up">
                <div className="flex items-center gap-3 sm:gap-4">
                    <button
                        onClick={onExit}
                        className="p-3 rounded-xl border border-slate-700/80 bg-slate-900/70 text-slate-400 transition-all duration-200 hover:border-red-500/50 hover:bg-red-500/15 hover:text-red-400 active:scale-95"
                        title="Leave Game"
                        aria-label="Leave Game"
                    >
                        <LogOut size={20} />
                    </button>
                    <div>
                        <h2 className="font-display text-2xl font-bold tracking-tight">
                            Okey <span className="text-transparent bg-clip-text bg-linear-to-r from-amber-300 via-amber-400 to-amber-600">Arena</span>
                        </h2>
                        <div className="mt-1 text-xs font-medium text-emerald-400 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            {mode === 'online' ? (
                                <span className="flex items-center gap-1.5">
                                    Room:
                                    <button
                                        onClick={handleCopyRoom}
                                        aria-label="Copy room code"
                                        className="group flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-amber-500/30 bg-amber-500/10 font-display font-bold tracking-widest text-amber-300 transition-all duration-200 hover:border-amber-400/60 hover:bg-amber-500/20 active:scale-95"
                                    >
                                        {roomId}
                                        {copied
                                            ? <Check size={12} className="text-emerald-400" />
                                            : <Copy size={12} className="opacity-60 group-hover:opacity-100 transition-opacity" />}
                                    </button>
                                    {copied && <span className="text-[10px] font-bold text-emerald-400 anim-pop-in">Kopyalandı!</span>}
                                </span>
                            ) : (
                                <span>Local • {aiDifficulty} AI</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Online player indicators */}
                {isOnline && room && (
                    <div className="flex flex-wrap items-center gap-2 stagger-children">
                        {room.players.map((player, idx: number) => {
                            const isTurn = room.currentTurn === idx;
                            const isYou = player.odaUserId === roomHook.userId;
                            const name = player.adPlayerName || (player.adIsAI ? `Bot ${idx + 1}` : 'Empty');
                            return (
                                <div
                                    key={idx}
                                    className={`flex items-center gap-2 pl-1 pr-3 py-1 rounded-full text-xs font-bold transition-all duration-300 ${
                                        isTurn ? 'chip-turn-active scale-105' : 'chip-turn-waiting'
                                    }`}
                                >
                                    <span className={`flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-black shrink-0 transition-colors ${
                                        isTurn ? 'bg-emerald-400/90 text-emerald-950' : 'bg-white/10 text-slate-300'
                                    } ${isYou ? 'ring-2 ring-amber-400/70' : ''}`}>
                                        {player.adIsAI ? <Bot size={13} /> : name.trim().charAt(0).toUpperCase()}
                                    </span>
                                    <span className="truncate max-w-[64px]">{name}</span>
                                    {isYou && <span className="text-[9px] text-amber-400 shrink-0">Sen</span>}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <div className="w-full max-w-6xl px-1 sm:px-4">
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
                    // Pass multiplayer info - memoized
                    playerInfo={useMemo(() =>
                        isOnline && room ? room.players.map((_, i) => getPlayerInfo(i)) : undefined,
                        [isOnline, room, getPlayerInfo]
                    )}
                    mySlot={isOnline ? mySlot : 0}
                />
            </div>

            <footer className="text-slate-600 font-bold uppercase tracking-[0.4em] text-[10px] pt-10 flex flex-col items-center gap-1.5">
                <span className="flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-amber-500/50" />
                    Transparent Strategy Arena
                    <span className="w-1 h-1 rounded-full bg-amber-500/50" />
                </span>
                <span className="text-slate-700 text-[8px] font-display tracking-[0.3em]">v0.1.0</span>
            </footer>
        </div>
    );
};
