
import React, { useState, useEffect } from 'react';
import { BackgammonBoard } from '../BackgammonBoard/BackgammonBoard';
import { useBackgammonGame } from '../../hooks/useBackgammonGame';
import {
    type BackgammonState,
    type Move,
    createBackgammonGame,
    getValidMoves,
    rollDice,
    applyMove
} from '../../logic/backgammonLogic';
import { getBestBackgammonMove } from '../../logic/backgammonAI';
import { ArrowLeft, RotateCcw, Copy, Check, Flag, Users, Loader2, Trophy, XCircle, Home, Bot } from 'lucide-react';

interface BackgammonGameProps {
    roomId?: string;
    mode?: 'online' | 'local';
    aiDifficulty?: 'Easy' | 'Normal' | 'Hard';
    onExit: () => void;
}

export const BackgammonGame: React.FC<BackgammonGameProps> = ({ roomId = '', mode = 'online', aiDifficulty = 'Normal', onExit }) => {
    const gameRoom = useBackgammonGame(mode === 'online' ? roomId : null);

    // Local State (single-player vs AI stays fully client-side)
    const [localGame, setLocalGame] = useState<BackgammonState>(() => createBackgammonGame());
    const [copied, setCopied] = useState(false);

    // Unified Access
    const isLocal = mode === 'local';

    // Online: the server is authoritative and pushes the full state — no optimistic
    // layer needed. Local: the client engine is the authority.
    const gameState = React.useMemo(() => {
        if (isLocal) return localGame;
        if (!gameRoom.room) return null;
        return {
            ...gameRoom.room,
            validMoves: []
        } as unknown as BackgammonState;
    }, [isLocal, localGame, gameRoom.room]);

    // Compute Valid Moves (only if gameState exists)
    const validMoves = React.useMemo(() => {
        return gameState ? getValidMoves(gameState) : [];
    }, [gameState]);

    // Player Identity
    const currentUserId = isLocal ? (gameState?.turn === 'white' ? 'local-white' : 'local-black') : gameRoom.userId;
    // In Local: Human is White. AI is Black.
    const playerColor = isLocal ? 'white' : (
        gameRoom.room?.whitePlayer === currentUserId ? 'white' : 'black'
    );

    const isOurTurn = playerColor === gameState?.turn;

    useEffect(() => {
        if (!isLocal && roomId && gameRoom.joinRoom) {
            gameRoom.joinRoom(roomId);
        }
    }, [roomId, isLocal]);

    const copyRoomId = () => {
        navigator.clipboard.writeText(roomId);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
    };
    // ... (skip to Timer)
    const isWhite = gameRoom.room?.whitePlayer === currentUserId || isLocal;
    const isBlack = gameRoom.room?.blackPlayer === currentUserId;
    const isGameOver = gameState?.winner ? true : false;

    // Apply a move locally (single-player), replicating the old end-of-turn logic.
    const applyLocalMove = (move: Move) => {
        let finalState = applyMove(localGame, move);
        if (!finalState.winner) {
            const endTurn =
                finalState.movesLeft.length === 0 || getValidMoves(finalState).length === 0;
            if (endTurn) {
                const dice = rollDice();
                finalState = {
                    ...finalState,
                    turn: finalState.turn === 'white' ? 'black' : 'white',
                    dice,
                    movesLeft: [...dice],
                };
            }
        }
        setLocalGame(finalState);
    };

    // Handler: the board emits a move intent. Local applies it via the engine;
    // online sends it to the authoritative server (which owns dice + turns).
    const handleMove = (move: Move) => {
        if (isLocal) {
            applyLocalMove(move);
        } else {
            gameRoom.makeMove({ from: move.from, to: move.to });
        }
    };

    // Auto-skip turn if no moves possible — LOCAL only (server handles this online).
    useEffect(() => {
        if (!gameState || !isLocal || !isOurTurn || gameState.winner) return;

        if (gameState.movesLeft.length > 0 && validMoves.length === 0) {
            const timer = setTimeout(() => {
                const dice = rollDice();
                setLocalGame({
                    ...gameState,
                    turn: gameState.turn === 'white' ? 'black' : 'white',
                    dice,
                    movesLeft: [...dice],
                });
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, [gameState?.movesLeft, validMoves.length, gameState?.winner, gameState?.turn, isLocal, gameState, isOurTurn]);

    // AI Trigger — LOCAL single-player only. Online AI (if any) runs server-side.
    useEffect(() => {
        if (!gameState) return;
        if (isLocal && gameState.turn === 'black' && !gameState.winner) {
            const timer = setTimeout(() => {
                const bestMove = getBestBackgammonMove(gameState, aiDifficulty);
                if (bestMove) {
                    applyLocalMove(bestMove);
                } else {
                    // No moves possible for AI? Force turn switch back to the human.
                    const dice = rollDice();
                    setLocalGame({ ...gameState, turn: 'white', dice, movesLeft: [...dice] });
                }
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, [gameState, isLocal, aiDifficulty]);

    // Early returns AFTER all hooks
    if (!isLocal && gameRoom.loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[80vh] gap-6">
                <div className="relative rounded-full p-5 liquid-glass shadow-[0_0_60px_-12px_rgba(16,185,129,0.4)]">
                    <Loader2 className="w-14 h-14 text-emerald-400 animate-spin" />
                </div>
                <div className="text-center space-y-2 anim-fade-up">
                    <h2 className="font-display text-xl font-bold text-gradient uppercase tracking-widest">Entering Arena</h2>
                    <p className="text-slate-500 font-medium">Synchronizing with the global lattice...</p>
                </div>
            </div>
        );
    }

    if (!gameState) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[80vh] gap-8">
                <div className="text-center space-y-4 anim-fade-up">
                    <h2 className="font-display text-5xl font-bold text-gradient">Room Dissolved</h2>
                    <p className="text-slate-400 text-lg">The arena you seek no longer exists or the link is expired.</p>
                </div>
                <button onClick={onExit} className="btn-premium px-10 py-4 text-xl">Return to Lobby</button>
            </div>
        );
    }

    const statusLabel = (() => {
        if (gameState.winner) return `${gameState.winner === 'white' ? 'White' : 'Black'} Wins!`;
        return isOurTurn ? 'Your Turn' : 'Waiting...';
    })();

    const connectedCount = gameRoom.room?.whitePlayer && gameRoom.room?.blackPlayer
        ? '2/2'
        : (gameRoom.room?.whitePlayer || gameRoom.room?.blackPlayer ? '1/2' : '0/2');

    return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-8 lg:gap-12 py-6 lg:py-10 w-full anim-fade-up">
            <header className="w-full max-w-6xl flex items-center justify-between gap-3 px-4 lg:px-6">
                <button
                    onClick={() => {
                        if (!isLocal && gameRoom.leaveRoom) gameRoom.leaveRoom();
                        onExit();
                    }}
                    className="group flex items-center gap-3 text-slate-500 hover:text-white transition-all font-bold uppercase tracking-widest text-xs"
                >
                    <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 group-hover:border-emerald-500/40 group-hover:-translate-x-1 transition-all">
                        <ArrowLeft size={18} />
                    </div>
                    Back
                </button>

                {!isLocal && (
                    <div className="liquid-glass px-4 lg:px-6 py-2.5 lg:py-3 flex items-center gap-4 lg:gap-6">
                        <div className="flex flex-col gap-0.5 min-w-0">
                            <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-black">Arena ID</span>
                            <code className="font-display text-emerald-300 font-bold truncate">{roomId}</code>
                        </div>
                        <div className="h-8 w-px bg-slate-800 shrink-0" />
                        <button
                            onClick={copyRoomId}
                            aria-label="Copy room code"
                            className={`flex items-center gap-2 p-2 rounded-lg transition-all ${copied
                                ? 'text-emerald-300 bg-emerald-500/10'
                                : 'text-slate-500 hover:text-white hover:bg-slate-800'}`}
                        >
                            {copied ? <Check size={18} /> : <Copy size={18} />}
                            <span className="hidden sm:inline text-[10px] font-black uppercase tracking-widest">
                                {copied ? 'Copied' : 'Copy'}
                            </span>
                        </button>
                    </div>
                )}
                {isLocal && (
                    <div className="glass-chip text-emerald-300 border-emerald-500/30">
                        <Bot size={14} className="text-emerald-400" />
                        Single Player Mode
                    </div>
                )}
            </header>

            <div className="flex flex-col lg:flex-row items-center justify-center gap-6 lg:gap-16 w-full max-w-7xl px-0 lg:px-6">
                <div className="relative group w-full flex justify-center max-w-full overflow-visible">
                    <div className="absolute -inset-4 bg-linear-to-r from-emerald-500 via-teal-500 to-emerald-400 rounded-[2.5rem] blur-2xl opacity-10 group-hover:opacity-20 transition-opacity" />
                    <BackgammonBoard
                        gameState={gameState}
                        playerColor={playerColor}
                        onMove={handleMove}
                        onRollDice={() => { }} // Auto handled for now
                        validMoves={validMoves}
                    />

                    {isGameOver && (
                        <GameOverOverlay
                            winner={gameState.winner}
                            playerColor={playerColor}
                            onRematch={() => {
                                const newGame = createBackgammonGame();
                                if (isLocal) setLocalGame(newGame);
                                else gameRoom.resetGame();
                            }}
                            onExit={() => {
                                if (!isLocal && gameRoom.leaveRoom) gameRoom.leaveRoom();
                                onExit();
                            }}
                        />
                    )}
                </div>

                <div className="w-full lg:w-96 flex flex-col gap-3 lg:gap-6 mt-0 lg:mt-0 stagger-children">
                    <div className="liquid-glass p-4 lg:p-8 space-y-4 lg:space-y-8 border-l-4 border-l-emerald-500/70">
                        <div className="flex items-center justify-between gap-3">
                            <h3 className="text-xs lg:text-sm font-black text-slate-500 uppercase tracking-[0.3em]">
                                Game Status
                            </h3>
                            <div
                                className={`glass-chip text-[10px] ${gameState.winner
                                    ? 'chip-game-over'
                                    : (isOurTurn ? 'chip-turn-active' : 'chip-turn-waiting')
                                    }`}
                            >
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${gameState.winner
                                    ? 'bg-indigo-400'
                                    : (isOurTurn ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500')}`} />
                                {isLocal && !gameState.winner
                                    ? (gameState.turn === 'white' ? '⚪ White Turn' : '⚫ Black Turn')
                                    : statusLabel}
                            </div>
                        </div>

                        {isGameOver && (
                            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-100 text-sm lg:text-base font-bold anim-pop-in">
                                {statusLabel}
                            </div>
                        )}

                        <div className="space-y-2 lg:space-y-4">
                            <GameTimer gameState={gameState} />

                            {!isLocal && (
                                <>
                                    <div className={`flex items-center gap-3 lg:gap-4 p-2.5 lg:p-4 rounded-2xl border transition-colors ${isWhite
                                        ? 'bg-emerald-500/10 border-emerald-500/30'
                                        : 'bg-slate-900/50 border-slate-800/80'}`}>
                                        <div
                                            className="w-9 h-9 lg:w-12 lg:h-12 rounded-full flex items-center justify-center font-display text-base lg:text-xl font-bold text-slate-900 shrink-0"
                                            style={{
                                                background: 'radial-gradient(circle at 32% 28%, #ffffff 0%, #f0ebdc 45%, #cfc5a8 100%)',
                                                boxShadow: 'inset 0 -2px 4px rgba(94,77,44,0.35), 0 2px 5px rgba(0,0,0,0.4)',
                                            }}
                                        >
                                            W
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs lg:text-sm font-bold text-white uppercase tracking-wide">White Player</div>
                                            <div className={`text-[10px] lg:text-xs font-medium ${gameRoom.room?.whitePlayer === currentUserId ? 'text-emerald-300' : 'text-slate-500'}`}>
                                                {gameRoom.room?.whitePlayer === currentUserId ? 'Connected (You)' : (gameRoom.room?.whitePlayer ? 'Opponent Ready' : 'Awaiting Entry...')}
                                            </div>
                                        </div>
                                        {isWhite && <span className="glass-chip text-[9px] text-emerald-300 border-emerald-500/30 shrink-0">You</span>}
                                    </div>

                                    <div className={`flex items-center gap-3 lg:gap-4 p-2.5 lg:p-4 rounded-2xl border transition-colors ${isBlack
                                        ? 'bg-emerald-500/10 border-emerald-500/30'
                                        : 'bg-slate-900/50 border-slate-800/80'}`}>
                                        <div
                                            className="w-9 h-9 lg:w-12 lg:h-12 rounded-full flex items-center justify-center font-display text-base lg:text-xl font-bold text-slate-200 shrink-0"
                                            style={{
                                                background: 'radial-gradient(circle at 32% 28%, #414c60 0%, #1c2331 50%, #05070c 100%)',
                                                boxShadow: 'inset 0 -2px 4px rgba(0,0,0,0.7), 0 2px 5px rgba(0,0,0,0.4)',
                                            }}
                                        >
                                            B
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs lg:text-sm font-bold text-white uppercase tracking-wide">Black Player</div>
                                            <div className={`text-[10px] lg:text-xs font-medium ${gameRoom.room?.blackPlayer === currentUserId ? 'text-emerald-300' : 'text-slate-500'}`}>
                                                {gameRoom.room?.blackPlayer === currentUserId ? 'Connected (You)' : (gameRoom.room?.blackPlayer ? 'Opponent Ready' : 'Awaiting Entry...')}
                                            </div>
                                        </div>
                                        {isBlack && <span className="glass-chip text-[9px] text-emerald-300 border-emerald-500/30 shrink-0">You</span>}
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="flex flex-col sm:flex-row gap-2 lg:gap-3">
                            <button
                                disabled={isGameOver}
                                onClick={() => {
                                    if (isLocal) {
                                        const finalState = { ...gameState };
                                        finalState.winner = playerColor === 'white' ? 'black' : 'white';
                                        setLocalGame(finalState);
                                    } else {
                                        gameRoom.resignGame(playerColor as 'white' | 'black');
                                    }
                                }}
                                className="btn-danger flex-1 flex items-center justify-center gap-2 text-sm lg:text-base uppercase tracking-wide disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-red-500/10"
                            >
                                <Flag size={16} className="lg:w-[18px] lg:h-[18px]" />
                                Resign
                            </button>
                            <button
                                disabled={!isGameOver && !isLocal}
                                onClick={() => {
                                    const newGame = createBackgammonGame();
                                    if (isLocal) setLocalGame(newGame);
                                    else gameRoom.resetGame();
                                }}
                                className="btn-ghost flex-1 flex items-center justify-center gap-2 text-sm lg:text-base uppercase tracking-wide disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <RotateCcw size={16} className="lg:w-[18px] lg:h-[18px]" />
                                Rematch
                            </button>
                        </div>
                    </div>

                    {!isLocal && (
                        <div className="hidden lg:grid grid-cols-2 gap-4">
                            <div className="liquid-glass p-6 text-center space-y-2">
                                <Users size={20} className="mx-auto text-emerald-400/70" />
                                <div className="font-display text-xl font-bold text-white tabular-nums">
                                    {connectedCount}
                                </div>
                                <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Connected</div>
                            </div>
                            <button
                                onClick={copyRoomId}
                                aria-label="Copy room code"
                                className="liquid-glass p-6 text-center space-y-2 group transition-all hover:border-emerald-500/40 active:scale-[0.98] cursor-pointer"
                            >
                                {copied
                                    ? <Check size={20} className="mx-auto text-emerald-400" />
                                    : <Copy size={20} className="mx-auto text-slate-600 group-hover:text-emerald-300 transition-colors" />}
                                <div className="font-display text-xl font-bold text-white truncate">{roomId}</div>
                                <div className={`text-[10px] font-black uppercase tracking-widest transition-colors ${copied ? 'text-emerald-400' : 'text-slate-500'}`}>
                                    {copied ? 'Copied!' : 'Copy Code'}
                                </div>
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <footer className="text-slate-600 font-bold uppercase tracking-[0.4em] text-[10px] pt-10 flex flex-col items-center gap-1">
                <span>Transparent Strategy Arena</span>
                <span className="text-slate-700 text-[8px]">v1.1.0</span>
            </footer>
        </div>
    );
};

const GameTimer: React.FC<{ gameState: BackgammonState }> = ({ gameState }) => {
    const [totalSeconds, setTotalSeconds] = useState(0);
    const [whiteSeconds, setWhiteSeconds] = useState(0);
    const [blackSeconds, setBlackSeconds] = useState(0);
    const prevWinner = React.useRef(gameState?.winner);

    useEffect(() => {
        // Detect reset: Winner was set, now it is not.
        if (prevWinner.current && !gameState?.winner) {
            setTotalSeconds(0);
            setWhiteSeconds(0);
            setBlackSeconds(0);
        }
        prevWinner.current = gameState?.winner;
    }, [gameState?.winner]);

    useEffect(() => {
        if (!gameState || gameState.winner) {
            // If game is over or not loaded, stop timer.
            // But we don't reset here (handled by reset detection above).
            return;
        }

        const interval = window.setInterval(() => {
            setTotalSeconds((s) => s + 1);
            setWhiteSeconds((s) => s + (gameState.turn === 'white' ? 1 : 0));
            setBlackSeconds((s) => s + (gameState.turn === 'black' ? 1 : 0));
        }, 1000);

        return () => window.clearInterval(interval);
    }, [gameState?.turn, gameState?.winner]);

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    return (
        <div className="grid grid-cols-3 gap-2 md:gap-3 p-3 md:p-4 glass-inset text-[9px] lg:text-[10px] font-bold uppercase tracking-widest">
            <div className="space-y-1">
                <div className="text-slate-500">Time</div>
                <div className="font-display tabular-nums text-white text-base lg:text-lg">{formatTime(totalSeconds)}</div>
            </div>
            <div className="space-y-1">
                <div className="text-slate-500">White</div>
                <div className={`font-display tabular-nums text-base lg:text-lg ${gameState.turn === 'white' && !gameState.winner ? 'text-emerald-300' : 'text-slate-400'}`}>{formatTime(whiteSeconds)}</div>
            </div>
            <div className="space-y-1">
                <div className="text-slate-500">Black</div>
                <div className={`font-display tabular-nums text-base lg:text-lg ${gameState.turn === 'black' && !gameState.winner ? 'text-emerald-300' : 'text-slate-400'}`}>{formatTime(blackSeconds)}</div>
            </div>
        </div>
    );
};

const GameOverOverlay: React.FC<{
    winner: 'white' | 'black' | null | undefined;
    playerColor: 'white' | 'black';
    onRematch: () => void;
    onExit: () => void;
}> = ({ winner, playerColor, onRematch, onExit }) => {
    const isWin = winner === playerColor;

    return (
        <div className="overlay-backdrop rounded-[2rem] overflow-hidden anim-pop-in">
            {/* Ambient glow behind the icon */}
            <div className="relative mb-6">
                <div className={`absolute -inset-6 rounded-full blur-2xl ${isWin ? 'bg-amber-400/30' : 'bg-red-500/25'}`} />
                <div className={`relative p-6 rounded-full border anim-float ${isWin
                    ? 'bg-amber-500/15 border-amber-400/40 text-amber-300 shadow-[0_0_60px_-10px_rgba(245,158,11,0.6)]'
                    : 'bg-red-500/15 border-red-400/30 text-red-400 shadow-[0_0_60px_-10px_rgba(239,68,68,0.5)]'}`}>
                    {isWin ? <Trophy size={64} /> : <XCircle size={64} />}
                </div>
            </div>

            <h2 className={`font-display text-4xl md:text-5xl font-bold uppercase tracking-widest mb-2 ${isWin
                ? 'text-transparent bg-clip-text bg-linear-to-b from-amber-200 via-amber-300 to-amber-600'
                : 'text-gradient'}`}>
                {isWin ? 'Victory!' : 'Defeat'}
            </h2>

            <p className="text-slate-400 font-bold text-base md:text-lg mb-8 uppercase tracking-widest">
                {isWin ? 'You conquered the board.' : 'Better luck next time.'}
            </p>

            <div className="flex flex-col gap-3 w-full max-w-xs stagger-children">
                <button
                    onClick={onRematch}
                    className="btn-premium w-full flex items-center justify-center gap-3 py-4 uppercase tracking-widest"
                >
                    <RotateCcw size={20} />
                    Rematch
                </button>
                <button
                    onClick={onExit}
                    className="btn-ghost w-full flex items-center justify-center gap-3 py-4 uppercase tracking-widest"
                >
                    <Home size={20} />
                    Return to Lobby
                </button>
            </div>
        </div>
    );
};
