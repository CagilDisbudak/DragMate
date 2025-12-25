
import React, { useState, useEffect } from 'react';
import { BackgammonBoard } from '../BackgammonBoard/BackgammonBoard';
import { useBackgammonGame } from '../../hooks/useBackgammonGame';
import {
    type BackgammonState,
    createBackgammonGame,
    getValidMoves,
    rollDice,
    applyMove
} from '../../logic/backgammonLogic';
import { getBestBackgammonMove } from '../../logic/backgammonAI';
import { ArrowLeft, RotateCcw, Copy, Share2, Flag, Users, Zap, Loader2, Trophy, XCircle, Home } from 'lucide-react';

interface BackgammonGameProps {
    roomId?: string;
    mode?: 'online' | 'local';
    aiDifficulty?: 'Easy' | 'Normal' | 'Hard';
    onExit: () => void;
}

export const BackgammonGame: React.FC<BackgammonGameProps> = ({ roomId = '', mode = 'online', aiDifficulty = 'Normal', onExit }) => {
    const gameRoom = useBackgammonGame(mode === 'online' ? roomId : null);

    // Local State
    const [localGame, setLocalGame] = useState<BackgammonState>(() => createBackgammonGame());
    const [optimisticGame, setOptimisticGame] = useState<BackgammonState | null>(null);

    // Unified Access
    const isLocal = mode === 'local';

    const gameState = React.useMemo(() => {
        if (isLocal) return localGame;
        if (optimisticGame) return optimisticGame; // Prefer optimistic state if available
        if (!gameRoom.room) return null;
        return {
            ...gameRoom.room,
            validMoves: []
        } as unknown as BackgammonState;
    }, [isLocal, localGame, gameRoom.room, optimisticGame]);

    // Sync Optimistic State with Server
    useEffect(() => {
        if (!gameRoom.room || !optimisticGame) return;

        // If server state matches optimistic state, clear optimistic to relying on source of truth
        // We check turn and board state. simple board comparison is fast for 24 ints.
        const isSameTurn = gameRoom.room.turn === optimisticGame.turn;
        const isSameBoard = JSON.stringify(gameRoom.room.board) === JSON.stringify(optimisticGame.board);
        const isSameMoves = gameRoom.room.movesLeft.length === optimisticGame.movesLeft.length;

        if (isSameTurn && isSameBoard && isSameMoves) {
            setOptimisticGame(null);
        } else if (!isSameTurn) {
            // Turn changed on server (e.g. opponent moved or we finished turn), sync to server
            setOptimisticGame(null);
        }
    }, [gameRoom.room, optimisticGame]);

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
        alert('Room ID copied to clipboard!');
    };
    // ... (skip to Timer)
    const isWhite = gameRoom.room?.whitePlayer === currentUserId || isLocal;
    const isBlack = gameRoom.room?.blackPlayer === currentUserId;
    const isGameOver = gameState?.winner ? true : false;

    // Handlers
    const handleMove = (newState: BackgammonState) => {
        let finalState = { ...newState };
        if (finalState.movesLeft.length === 0) {
            // End of turn
            finalState.turn = finalState.turn === 'white' ? 'black' : 'white';
            finalState.dice = rollDice();
            finalState.movesLeft = [...finalState.dice];
        } else {
            // Check if any valid moves remain. If none, forfeiture remaining dice.
            const remainingMoves = getValidMoves(finalState);
            if (remainingMoves.length === 0) {
                finalState.turn = finalState.turn === 'white' ? 'black' : 'white';
                finalState.dice = rollDice();
                finalState.movesLeft = [...finalState.dice];
            }
        }

        if (isLocal) {
            setLocalGame(finalState);
        } else {
            setOptimisticGame(finalState); // Immediate local update
            gameRoom.updateGameState(finalState); // Network update
        }
    };

    // Auto-skip turn if no moves possible
    useEffect(() => {
        if (!gameState) return;
        if (gameState.movesLeft.length > 0 && validMoves.length === 0 && !gameState.winner) {
            const timer = setTimeout(() => {
                let finalState = { ...gameState };
                // Switch turn
                finalState.turn = finalState.turn === 'white' ? 'black' : 'white';
                finalState.dice = rollDice();
                finalState.movesLeft = [...finalState.dice];

                if (isLocal) {
                    setLocalGame(finalState);
                } else {
                    setOptimisticGame(finalState);
                    gameRoom.updateGameState(finalState);
                }
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, [gameState?.movesLeft, validMoves.length, gameState?.winner, gameState?.turn, isLocal, gameState]);

    // AI Trigger
    useEffect(() => {
        if (!gameState) return;
        if (isLocal && gameState.turn === 'black' && !gameState.winner) {
            const timer = setTimeout(() => {
                const bestMove = getBestBackgammonMove(gameState, aiDifficulty);
                if (bestMove) {
                    const stepState = applyMove(gameState, bestMove);
                    handleMove(stepState);
                } else {
                    // No moves possible for AI? Force turn switch.
                    let finalState = { ...gameState };
                    finalState.turn = 'white';
                    finalState.dice = rollDice();
                    finalState.movesLeft = [...finalState.dice];
                    setLocalGame(finalState);
                }
            }, 800);
            return () => clearTimeout(timer);
        }
    }, [gameState, isLocal, aiDifficulty]);

    // Early returns AFTER all hooks
    if (!isLocal && gameRoom.loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[80vh] gap-6 animate-pulse">
                <div className="relative shadow-2xl shadow-indigo-500/20 rounded-full p-4">
                    <Loader2 className="w-16 h-16 text-indigo-500 animate-spin" />
                </div>
                <div className="text-center space-y-2">
                    <h2 className="text-xl font-black text-white uppercase tracking-widest">Entering Arena</h2>
                    <p className="text-slate-500 font-medium">Synchronizing with the global lattice...</p>
                </div>
            </div>
        );
    }

    if (!gameState) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[80vh] gap-8">
                <div className="text-center space-y-4">
                    <h2 className="text-5xl font-black text-white italic">Room Dissolved</h2>
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

    return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-8 lg:gap-12 py-6 lg:py-10 w-full animate-in fade-in duration-700">
            <header className="w-full max-w-6xl flex items-center justify-between px-4 lg:px-6">
                <button
                    onClick={() => {
                        if (!isLocal && gameRoom.leaveRoom) gameRoom.leaveRoom();
                        onExit();
                    }}
                    className="group flex items-center gap-3 text-slate-500 hover:text-white transition-all font-bold uppercase tracking-widest text-xs"
                >
                    <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 group-hover:border-slate-700 group-hover:-translate-x-1 transition-transform">
                        <ArrowLeft size={18} />
                    </div>
                    Back
                </button>

                {!isLocal && (
                    <div className="flex items-center gap-4">
                        <div className="liquid-glass px-6 py-3 flex items-center gap-6">
                            <div className="flex flex-col gap-0.5">
                                <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-black">Arena ID</span>
                                <code className="text-indigo-300 font-mono font-bold">{roomId}</code>
                            </div>
                            <div className="h-8 w-px bg-slate-800" />
                            <div className="flex items-center gap-3">
                                <button onClick={copyRoomId} className="p-2 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg transition-all">
                                    <Copy size={18} />
                                </button>
                                <button className="p-2 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg transition-all">
                                    <Share2 size={18} />
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                {isLocal && (
                    <div className="px-6 py-3 liquid-glass text-indigo-300 font-bold uppercase tracking-widest text-xs">
                        Single Player Mode
                    </div>
                )}
            </header>

            <div className="flex flex-col lg:flex-row items-center justify-center gap-6 lg:gap-16 w-full max-w-7xl px-0 lg:px-6">
                <div className="relative group w-full flex justify-center max-w-full overflow-visible">
                    <div className="absolute -inset-4 bg-linear-to-r from-indigo-500 to-pink-500 rounded-[2.5rem] blur-2xl opacity-10 group-hover:opacity-20 transition-opacity" />
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
                                setOptimisticGame(null);
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

                <div className="w-full lg:w-96 flex flex-col gap-3 lg:gap-8 mt-0 lg:mt-0">
                    <div className="liquid-glass p-3 lg:p-8 space-y-3 lg:space-y-8 border-l-4 border-l-indigo-500">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-black text-slate-500 uppercase tracking-[0.3em]">
                                Game Status
                            </h3>
                            <div
                                className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${!gameState.winner
                                    ? (isOurTurn ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-slate-800 text-slate-500')
                                    : 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/30'
                                    }`}
                            >
                                <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${!gameState.winner ? 'bg-green-500' : 'bg-indigo-400'}`} />
                                {isLocal
                                    ? (gameState.turn === 'white' ? '⚪ White Turn' : '⚫ Black Turn')
                                    : statusLabel}
                            </div>
                        </div>

                        {isGameOver && (
                            <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-100 text-sm lg:text-base font-bold">
                                {statusLabel}
                            </div>
                        )}

                        <div className="space-y-2 lg:space-y-4">
                            <GameTimer gameState={gameState} />

                            {!isLocal && (
                                <>
                                    <div className="flex items-center gap-2 lg:gap-4 p-2 lg:p-4 rounded-2xl bg-slate-900/50 border border-slate-800/80">
                                        <div className={`w-8 h-8 lg:w-12 lg:h-12 rounded-xl flex items-center justify-center text-lg lg:text-xl font-bold ${isWhite ? 'bg-white text-slate-950' : 'bg-slate-800 text-slate-400'}`}>W</div>
                                        <div className="flex-1">
                                            <div className="text-xs lg:text-sm font-bold text-white uppercase tracking-wide">White Player</div>
                                            <div className="text-[10px] lg:text-xs text-slate-500 font-medium">
                                                {gameRoom.room?.whitePlayer === currentUserId ? 'Connected (You)' : (gameRoom.room?.whitePlayer ? 'Opponent Ready' : 'Awaiting Entry...')}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 lg:gap-4 p-2 lg:p-4 rounded-2xl bg-slate-900/50 border border-slate-800/80">
                                        <div className={`w-8 h-8 lg:w-12 lg:h-12 rounded-xl flex items-center justify-center text-lg lg:text-xl font-bold ${isBlack ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-400'}`}>B</div>
                                        <div className="flex-1">
                                            <div className="text-xs lg:text-sm font-bold text-white uppercase tracking-wide">Black Player</div>
                                            <div className="text-[10px] lg:text-xs text-slate-500 font-medium">
                                                {gameRoom.room?.blackPlayer === currentUserId ? 'Connected (You)' : (gameRoom.room?.blackPlayer ? 'Opponent Ready' : 'Awaiting Entry...')}
                                            </div>
                                        </div>
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
                                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 lg:px-4 lg:py-3 rounded-xl border border-slate-800 bg-slate-900/60 text-slate-200 text-sm lg:text-base font-bold uppercase tracking-wide disabled:opacity-40 disabled:cursor-not-allowed hover:border-red-500/50 hover:text-red-200 transition"
                            >
                                <Flag size={16} className="lg:w-[18px] lg:h-[18px]" />
                                Resign
                            </button>
                            <button
                                disabled={!isGameOver && !isLocal}
                                onClick={() => {
                                    const newGame = createBackgammonGame();
                                    setOptimisticGame(null);
                                    if (isLocal) setLocalGame(newGame);
                                    else gameRoom.resetGame();
                                }}
                                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 lg:px-4 lg:py-3 rounded-xl border border-indigo-500/40 bg-indigo-500/10 text-indigo-100 text-sm lg:text-base font-bold uppercase tracking-wide disabled:opacity-40 disabled:cursor-not-allowed hover:bg-indigo-500/20 transition"
                            >
                                <RotateCcw size={16} className="lg:w-[18px] lg:h-[18px]" />
                                Rematch
                            </button>
                        </div>
                    </div>

                    {!isLocal && (
                        <div className="hidden lg:grid grid-cols-2 gap-4">
                            <div className="liquid-glass p-6 text-center space-y-2">
                                <Users size={20} className="mx-auto text-slate-600" />
                                <div className="text-xl font-black text-white italic">
                                    {gameRoom.room?.whitePlayer && gameRoom.room?.blackPlayer ? '2/2' : (gameRoom.room?.whitePlayer || gameRoom.room?.blackPlayer ? '1/2' : '0/2')}
                                </div>
                                <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Connected</div>
                            </div>
                            <div className="liquid-glass p-6 text-center space-y-2">
                                <Zap size={20} className="mx-auto text-indigo-400" />
                                <div className="text-xl font-black text-white italic">24ms</div>
                                <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Latency</div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <footer className="text-slate-600 font-bold uppercase tracking-[0.4em] text-[10px] pt-10">
                Transparent Strategy Arena
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
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3 p-2 md:p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 text-[10px] lg:text-xs font-bold uppercase tracking-widest">
            <div className="space-y-1">
                <div className="text-slate-500">Time</div>
                <div className="text-white text-base">{formatTime(totalSeconds)}</div>
            </div>
            <div className="space-y-1">
                <div className="text-slate-500">White</div>
                <div className="text-emerald-300 text-base">{formatTime(whiteSeconds)}</div>
            </div>
            <div className="space-y-1">
                <div className="text-slate-500">Black</div>
                <div className="text-sky-300 text-base">{formatTime(blackSeconds)}</div>
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
        <div className="absolute inset-0 z-50 rounded-[2rem] bg-slate-900/80 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in duration-500">
            <div className={`p-6 rounded-full mb-6 ${isWin ? 'bg-amber-500/20 text-amber-400 shadow-[0_0_50px_-12px_rgba(245,158,11,0.5)]' : 'bg-red-500/20 text-red-400 shadow-[0_0_50px_-12px_rgba(239,68,68,0.5)]'}`}>
                {isWin ? <Trophy size={64} className="animate-bounce" /> : <XCircle size={64} />}
            </div>

            <h2 className={`text-4xl md:text-5xl font-black uppercase tracking-widest mb-2 ${isWin ? 'text-transparent bg-clip-text bg-linear-to-b from-amber-300 to-amber-600' : 'text-slate-200'}`}>
                {isWin ? 'Victory!' : 'Defeat'}
            </h2>

            <p className="text-slate-400 font-bold text-lg mb-8 uppercase tracking-widest">
                {isWin ? 'You conquered the board.' : 'Better luck next time.'}
            </p>

            <div className="flex flex-col gap-3 w-full max-w-xs">
                <button
                    onClick={onRematch}
                    className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95 shadow-lg shadow-indigo-500/30"
                >
                    <RotateCcw size={20} />
                    Rematch
                </button>
                <button
                    onClick={onExit}
                    className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold uppercase tracking-widest transition-all hover:scale-105 active:scale-95"
                >
                    <Home size={20} />
                    Return to Lobby
                </button>
            </div>
        </div>
    );
};
