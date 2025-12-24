import React, { useState, useEffect } from 'react';
import { Chess } from 'chess.js';
import { ChessBoard } from '../ChessBoard/ChessBoard';
import { useGameRoom } from '../../hooks/useGameRoom';
import { Copy, Share2, ArrowLeft, Loader2, Users, Zap, Flag, RotateCcw } from 'lucide-react';
import { createGame } from '../../logic/chessLogic';
import { getBestMove } from '../../logic/chessAI';

interface GameProps {
    roomId?: string;
    mode?: 'online' | 'local';
    aiDifficulty?: 'Easy' | 'Normal' | 'Hard';
    onExit: () => void;
}

export const Game: React.FC<GameProps> = ({ roomId = '', mode = 'online', aiDifficulty = 'Normal', onExit }) => {
    // Online Hooks
    const gameRoom = useGameRoom(mode === 'online' ? roomId : null);

    // Local State
    const [localGame, setLocalGame] = useState(() => createGame());
    const [localFen, setLocalFen] = useState(localGame.fen());
    const [localStatus, setLocalStatus] = useState<'active' | 'checkmate' | 'stalemate' | 'draw'>('active');
    const [localWinner, setLocalWinner] = useState<'w' | 'b' | ''>('');

    // Unified State
    const isLocal = mode === 'local';
    const room = isLocal ? {
        fen: localFen,
        turn: localGame.turn(),
        background: '',
        whitePlayer: 'local-white',
        blackPlayer: 'local-black',
        status: localStatus,
        winner: localWinner
    } : gameRoom.room;

    const loading = isLocal ? false : gameRoom.loading;

    // Local Logic
    const handleLocalMove = (fen: string) => {
        const newGame = createGame(fen);
        setLocalGame(newGame);
        setLocalFen(fen);

        if (newGame.isCheckmate()) {
            setLocalStatus('checkmate');
            setLocalWinner(newGame.turn() === 'w' ? 'b' : 'w');
        } else if (newGame.isDraw()) {
            setLocalStatus('draw');
        } else if ((newGame as any).isStalemate && (newGame as any).isStalemate()) {
            setLocalStatus('stalemate');
        }
    };

    // AI Trigger
    useEffect(() => {
        if (isLocal && localGame.turn() === 'b' && localStatus === 'active') {
            const timer = setTimeout(() => {
                const bestMove = getBestMove(localGame, aiDifficulty);
                if (bestMove) {
                    localGame.move(bestMove);
                    handleLocalMove(localGame.fen());
                }
            }, 500); // UI delay for realism
            return () => clearTimeout(timer);
        }
    }, [localFen, isLocal, localStatus, aiDifficulty]);

    const handleLocalReset = () => {
        const newGame = createGame();
        setLocalGame(newGame);
        setLocalFen(newGame.fen());
        setLocalStatus('active');
        setLocalWinner('');
        setTotalSeconds(0);
        setWhiteSeconds(0);
        setBlackSeconds(0);
    };

    // Actions
    const updateMove = isLocal ? handleLocalMove : gameRoom.updateMove;
    const resignGame = isLocal ? (color: 'w' | 'b') => {
        setLocalStatus('active'); // Resign just ends it locally visually for now, or elaborate logic
        setLocalWinner(color === 'w' ? 'b' : 'w');
        alert(`${color === 'w' ? 'White' : 'Black'} resigned.`);
    } : gameRoom.resignGame;

    const resetGame = isLocal ? handleLocalReset : gameRoom.resetGame;
    const currentUserId = isLocal ? (room?.turn === 'w' ? 'local-white' : 'local-black') : gameRoom.userId;

    // Time counters
    const [totalSeconds, setTotalSeconds] = React.useState(0);
    const [whiteSeconds, setWhiteSeconds] = React.useState(0);
    const [blackSeconds, setBlackSeconds] = React.useState(0);

    React.useEffect(() => {
        if (!isLocal && roomId && gameRoom.joinRoom) gameRoom.joinRoom(roomId);
    }, [roomId, isLocal]);

    React.useEffect(() => {
        if (!room || (room.status && room.status !== 'active')) return;

        const interval = window.setInterval(() => {
            setTotalSeconds((s) => s + 1);
            setWhiteSeconds((s) => s + (room.turn === 'w' ? 1 : 0));
            setBlackSeconds((s) => s + (room.turn === 'b' ? 1 : 0));
        }, 1000);

        return () => window.clearInterval(interval);
    }, [room?.turn, room?.status]);

    if (loading) {
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

    if (!room) {
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

    const isWhite = room.whitePlayer === currentUserId || isLocal;
    const isBlack = room.blackPlayer === currentUserId; // In local, human isn't black

    // In local mode, human is always White (playing against AI)
    const playerColor = isLocal ? 'w' : (currentUserId === room.whitePlayer ? 'w' : (currentUserId === room.blackPlayer ? 'b' : 'w'));
    const isMyTurn = room.turn === playerColor;

    const chess = new Chess(room.fen);
    const gameState = {
        isCheck: chess.isCheck(),
        isCheckmate: chess.isCheckmate(),
        isDraw: chess.isDraw(),
        isStalemate: typeof (chess as any).isStalemate === 'function' ? (chess as any).isStalemate() : false,
        turn: chess.turn(),
    };

    const status = room.status ?? 'active';
    const winner = room.winner ?? '';
    const isGameOver = status !== 'active';

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    const statusLabel = (() => {
        if (status === 'checkmate') return `Checkmate • ${winner === 'w' ? 'White' : 'Black'} wins`;
        if (status === 'stalemate') return 'Stalemate • Draw';
        if (status === 'draw') return 'Draw';
        if (status === 'resigned') return `Resigned • ${winner === 'w' ? 'White' : 'Black'} wins`;
        if (gameState.isCheck) return `${gameState.turn === 'w' ? 'White' : 'Black'} is in check`;
        return isMyTurn ? 'Your Turn' : 'Waiting...';
    })();

    const copyRoomId = () => {
        navigator.clipboard.writeText(roomId);
        alert('Room ID copied to clipboard!');
    };

    return (
        <div className="flex flex-col items-center gap-8 lg:gap-12 py-6 lg:py-10 w-full animate-in fade-in duration-700">
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

            <div className="flex flex-col lg:flex-row items-center justify-center gap-6 lg:gap-16 w-full max-w-7xl px-4 lg:px-6">
                <div className="relative group w-full flex justify-center max-w-full overflow-visible">
                    <div className="absolute -inset-4 bg-linear-to-r from-indigo-500 to-pink-500 rounded-[2.5rem] blur-2xl opacity-10 group-hover:opacity-20 transition-opacity" />
                    <ChessBoard
                        initialFen={room.fen}
                        onMove={updateMove}
                        playerColor={playerColor}
                        isGameOver={isGameOver}
                    />
                </div>

                <div className="w-full lg:w-96 flex flex-col gap-6 lg:gap-8 mt-0 lg:mt-0">
                    <div className="liquid-glass p-5 lg:p-8 space-y-6 lg:space-y-8 border-l-4 border-l-indigo-500">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-black text-slate-500 uppercase tracking-[0.3em]">
                                Game Status
                            </h3>
                            <div
                                className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${status === 'active'
                                    ? (isMyTurn ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-slate-800 text-slate-500')
                                    : 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/30'
                                    }`}
                            >
                                <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${status === 'active' ? 'bg-green-500' : 'bg-indigo-400'}`} />
                                {isLocal
                                    ? (room.turn === 'w' ? '⚪ White Turn' : '⚫ Black Turn')
                                    : statusLabel}
                            </div>
                        </div>

                        {status === 'active' && gameState.isCheck && (
                            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-[10px] lg:text-xs font-black uppercase tracking-widest">
                                CHECK! {gameState.turn === 'w' ? 'White' : 'Black'} to move.
                            </div>
                        )}

                        {isGameOver && (
                            <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-100 text-sm lg:text-base font-bold">
                                {statusLabel}
                            </div>
                        )}

                        <div className="space-y-4">
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 text-[10px] lg:text-xs font-bold uppercase tracking-widest">
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

                            {!isLocal && (
                                <>
                                    <div className="flex items-center gap-3 lg:gap-4 p-4 rounded-2xl bg-slate-900/50 border border-slate-800/80">
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold ${isWhite ? 'bg-white text-slate-950' : 'bg-slate-800 text-slate-400'}`}>W</div>
                                        <div className="flex-1">
                                            <div className="text-sm font-bold text-white uppercase tracking-wide">White Player</div>
                                            <div className="text-xs text-slate-500 font-medium">
                                                {room.whitePlayer === currentUserId ? 'Connected (You)' : (room.whitePlayer ? 'Opponent Ready' : 'Awaiting Entry...')}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 lg:gap-4 p-4 rounded-2xl bg-slate-900/50 border border-slate-800/80">
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold ${isBlack ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-400'}`}>B</div>
                                        <div className="flex-1">
                                            <div className="text-sm font-bold text-white uppercase tracking-wide">Black Player</div>
                                            <div className="text-xs text-slate-500 font-medium">
                                                {room.blackPlayer === currentUserId ? 'Connected (You)' : (room.blackPlayer ? 'Opponent Ready' : 'Awaiting Entry...')}
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3">
                            <button
                                disabled={isGameOver}
                                onClick={() => resignGame(playerColor as 'w' | 'b')}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-slate-800 bg-slate-900/60 text-slate-200 font-bold uppercase tracking-wide disabled:opacity-40 disabled:cursor-not-allowed hover:border-red-500/50 hover:text-red-200 transition"
                            >
                                <Flag size={18} />
                                Resign
                            </button>
                            <button
                                disabled={!isGameOver && !isLocal}
                                onClick={() => resetGame()}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-indigo-500/40 bg-indigo-500/10 text-indigo-100 font-bold uppercase tracking-wide disabled:opacity-40 disabled:cursor-not-allowed hover:bg-indigo-500/20 transition"
                            >
                                <RotateCcw size={18} />
                                Rematch
                            </button>
                        </div>
                    </div>

                    {!isLocal && (
                        <div className="grid grid-cols-2 gap-4">
                            <div className="liquid-glass p-6 text-center space-y-2">
                                <Users size={20} className="mx-auto text-slate-600" />
                                <div className="text-xl font-black text-white italic">
                                    {room.whitePlayer && room.blackPlayer ? '2/2' : (room.whitePlayer || room.blackPlayer ? '1/2' : '0/2')}
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

