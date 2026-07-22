import React, { useCallback, useMemo, useState } from 'react';
import { Board101 } from '../101Board/Board101';
import { use101Game } from '../../hooks/use101Game';
import { use101Room } from '../../hooks/use101Room';
import type { Room101 } from '../../hooks/use101Room';
import type { Game101State, Meld } from '../../logic/101Logic';
import { AlertTriangle, Bot, Check, Copy, Crown, LogOut, Play, User, Users } from 'lucide-react';

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

    // Copy-to-clipboard visual feedback for the room code
    const [copied, setCopied] = useState(false);

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

    const boardPlayerInfo = useMemo(() =>
        isOnline && room ? room.players.map((_, i) => getPlayerInfo(i)) : undefined,
        [isOnline, room, getPlayerInfo]
    );

    const handleCopyRoomId = useCallback(() => {
        if (!room?.roomId || !navigator.clipboard) return;
        navigator.clipboard.writeText(room.roomId).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }).catch(() => { });
    }, [room?.roomId]);

    // Loading states
    if (isOnline && (roomHook.loading || roomHook.isAuthLoading)) {
        return (
            <div className="flex items-center justify-center min-h-[85vh] px-4">
                <div className="liquid-glass px-10 py-8 flex flex-col items-center gap-4 anim-pop-in">
                    <div className="w-10 h-10 rounded-full border-[3px] border-rose-400/25 border-t-rose-400 animate-spin" />
                    <span className="font-display text-lg font-bold tracking-wide text-slate-200">Bağlanıyor...</span>
                </div>
            </div>
        );
    }

    if (isOnline && roomHook.error) {
        return (
            <div className="flex items-center justify-center min-h-[85vh] px-4">
                <div className="liquid-glass w-full max-w-md p-8 flex flex-col items-center gap-5 text-center anim-pop-in">
                    <div className="w-16 h-16 rounded-full bg-red-500/15 border border-red-400/40 flex items-center justify-center shadow-[0_0_30px_-8px_rgba(239,68,68,0.6)]">
                        <AlertTriangle size={28} className="text-red-400" />
                    </div>
                    <div className="space-y-1">
                        <h2 className="font-display text-xl font-bold text-slate-100">Bir sorun oluştu</h2>
                        <p className="text-red-300/90 text-sm">{roomHook.error}</p>
                    </div>
                    <button onClick={onExit} className="btn-ghost flex items-center gap-2">
                        <LogOut size={16} />
                        Geri Dön
                    </button>
                </div>
            </div>
        );
    }

    // Waiting room
    if (isOnline && room && room.phase === 'waiting') {
        const emptySeats = Math.max(0, 4 - room.players.length);

        return (
            <div className="relative flex flex-col items-center justify-center min-h-[85vh] gap-6 px-4 py-10 overflow-hidden">
                <div className="bg-blob w-[420px] h-[420px] bg-rose-500/15 -top-24 -left-24" />
                <div className="bg-blob w-[360px] h-[360px] bg-violet-500/10 bottom-0 -right-20" style={{ animationDelay: '-8s' }} />

                {/* Header */}
                <div className="text-center space-y-3 anim-fade-up">
                    <div className="glass-chip text-rose-300 border-rose-400/30">Çevrimiçi Oda</div>
                    <h2 className="font-display text-3xl sm:text-4xl font-bold text-gradient">101 Odası</h2>
                    <div className="flex flex-col items-center gap-1">
                        <button
                            onClick={handleCopyRoomId}
                            title="Oda kodunu kopyala"
                            aria-label="Oda kodunu kopyala"
                            className="group inline-flex items-center gap-2.5 px-4 py-2 rounded-xl border border-white/10 bg-slate-900/60 backdrop-blur-md transition-all duration-200 hover:border-rose-400/40 hover:bg-slate-900/80 active:scale-[0.98]"
                        >
                            <span className="font-display font-bold tracking-[0.2em] text-rose-200">{room.roomId}</span>
                            {copied ? (
                                <Check size={15} className="text-emerald-400" />
                            ) : (
                                <Copy size={15} className="text-slate-400 group-hover:text-rose-300 transition-colors" />
                            )}
                        </button>
                        <div className="h-4 text-[11px] font-bold text-emerald-400">
                            {copied ? 'Kopyalandı!' : ''}
                        </div>
                    </div>
                </div>

                {/* Players card */}
                <div className="liquid-glass w-full max-w-md p-5 sm:p-7 space-y-4 anim-fade-up" style={{ animationDelay: '0.08s' }}>
                    <div className="flex items-center justify-between">
                        <h3 className="font-display font-bold text-slate-100 flex items-center gap-2">
                            <Users size={18} className="text-rose-300" />
                            Oyuncular
                        </h3>
                        <span className="glass-chip text-rose-200">{room.players.length}/4</span>
                    </div>

                    <div className="space-y-2 stagger-children">
                        {room.players.map((player, idx) => {
                            const isMe = player.odaUserId === roomHook.userId;
                            const isRoomHost = player.odaUserId === room.hostUserId;
                            return (
                                <div key={idx} className="glass-inset flex items-center gap-3 px-4 py-3">
                                    <div className={`
                                        w-9 h-9 rounded-full flex items-center justify-center border shrink-0
                                        ${isMe
                                            ? 'bg-rose-500/20 border-rose-400/50 text-rose-300'
                                            : 'bg-slate-800/80 border-white/10 text-slate-300'}
                                    `}>
                                        {player.adIsAI ? <Bot size={18} /> : <User size={18} />}
                                    </div>
                                    <span className={`font-bold truncate ${isMe ? 'text-rose-200' : 'text-slate-200'}`}>
                                        {player.adPlayerName}
                                    </span>
                                    {isMe && (
                                        <span className="shrink-0 px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-400/40 text-rose-300 text-[10px] font-black uppercase tracking-wider">
                                            Sen
                                        </span>
                                    )}
                                    {isRoomHost && (
                                        <Crown size={16} className="text-amber-400 shrink-0 ml-auto" aria-label="Oda sahibi" />
                                    )}
                                </div>
                            );
                        })}
                        {Array.from({ length: emptySeats }).map((_, i) => (
                            <div key={`empty-${i}`} className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-dashed border-white/10 text-slate-500">
                                <div className="w-9 h-9 rounded-full border border-dashed border-white/15 flex items-center justify-center shrink-0">
                                    <Bot size={16} className="opacity-40" />
                                </div>
                                <span className="text-sm font-semibold">Boş koltuk</span>
                            </div>
                        ))}
                    </div>

                    {room.players.length < 4 && (
                        <p className="text-slate-500 text-xs text-center">
                            Boş slotlar AI ile doldurulacak
                        </p>
                    )}
                </div>

                {/* Actions */}
                <div className="flex flex-col items-center gap-3 anim-fade-up" style={{ animationDelay: '0.16s' }}>
                    {isHost ? (
                        <button
                            onClick={() => roomHook.startGame()}
                            className="btn-premium flex items-center gap-3 text-lg"
                        >
                            <Play size={20} />
                            Oyunu Başlat
                        </button>
                    ) : (
                        <div className="flex items-center gap-2 text-slate-400 text-sm font-semibold py-2">
                            <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
                            Host'un oyunu başlatmasını bekleyin...
                        </div>
                    )}
                    <button onClick={onExit} className="btn-ghost flex items-center gap-2 text-sm">
                        <LogOut size={16} />
                        Odadan Ayrıl
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full flex flex-col items-center justify-center min-h-[85vh] px-1 sm:px-4 py-4 fade-in animate-in duration-700">
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
                playerInfo={boardPlayerInfo}
                mySlot={isOnline ? mySlot : 0}
            />
        </div>
    );
};
