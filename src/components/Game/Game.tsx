import React, { useState, useEffect } from 'react';
import { Chess } from 'chess.js';
import { ChessBoard } from '../ChessBoard/ChessBoard';
import { useGameRoom } from '../../hooks/useGameRoom';
import { ArrowLeft, Loader2, Users, Flag, RotateCcw, Copy, Check, Crown, Trophy, XCircle, Handshake, Home, Bot, TriangleAlert } from 'lucide-react';
import { createGame } from '../../logic/chessLogic';
import { getBestMove } from '../../logic/chessAI';

interface GameProps {
    roomId?: string;
    mode?: 'online' | 'local';
    aiDifficulty?: 'Easy' | 'Normal' | 'Hard';
    onExit: () => void;
}

const ClockCell: React.FC<{ label: string; value: string; active?: boolean }> = ({ label, value, active = false }) => (
    <div className={`space-y-1 rounded-xl py-2 transition-colors ${active ? 'bg-emerald-500/10' : ''}`}>
        <div className={`text-[9px] lg:text-[10px] font-black uppercase tracking-widest ${active ? 'text-emerald-400' : 'text-slate-500'}`}>
            {label}
        </div>
        <div className={`font-display text-lg lg:text-xl font-bold tabular-nums ${active ? 'text-emerald-300' : 'text-slate-200'}`}>
            {value}
        </div>
    </div>
);

const SeatCard: React.FC<{
    color: 'w' | 'b';
    title: string;
    subtitle: string;
    seated: boolean;
    isYou: boolean;
    toMove: boolean;
    isAI?: boolean;
}> = ({ color, title, subtitle, seated, isYou, toMove, isAI = false }) => (
    <div className={`flex items-center gap-3 p-3 lg:p-3.5 rounded-2xl border transition-colors ${
        isYou ? 'border-indigo-500/40 bg-indigo-500/10' : 'border-slate-800/80 bg-slate-900/50'
    }`}>
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
            color === 'w'
                ? 'bg-slate-100 text-slate-900 shadow-[inset_0_-2px_4px_rgba(0,0,0,0.15)]'
                : 'bg-slate-950 text-slate-100 border border-slate-700/70'
        }`}>
            {isAI ? <Bot size={22} /> : <span className="font-display text-2xl leading-none">{color === 'w' ? '♔' : '♚'}</span>}
        </div>
        <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white uppercase tracking-wide truncate">{title}</span>
                {toMove && (
                    <span className="px-1.5 py-0.5 rounded-md bg-indigo-500/20 border border-indigo-500/30 text-indigo-200 text-[8px] font-black uppercase tracking-widest shrink-0">
                        To Move
                    </span>
                )}
            </div>
            <div className="text-xs text-slate-500 font-medium truncate">{subtitle}</div>
        </div>
        <span
            className={`w-2 h-2 rounded-full shrink-0 ${
                seated ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse' : 'bg-slate-600'
            }`}
            aria-hidden="true"
        />
    </div>
);

export const Game: React.FC<GameProps> = ({ roomId = '', mode = 'online', aiDifficulty = 'Normal', onExit }) => {
    // Online Hooks
    const gameRoom = useGameRoom(mode === 'online' ? roomId : null);

    // Local State
    const [localGame, setLocalGame] = useState(() => createGame());
    const [localFen, setLocalFen] = useState(localGame.fen());
    const [localStatus, setLocalStatus] = useState<'active' | 'checkmate' | 'stalemate' | 'draw' | 'resigned'>('active');
    const [localWinner, setLocalWinner] = useState<'w' | 'b' | ''>('');
    const [localLastMove, setLocalLastMove] = useState<{ from: string; to: string } | null>(null);
    // Bumped when the server rejects an optimistic move, forcing the board to roll back.
    const [resyncSignal, setResyncSignal] = useState(0);
    // Inline "copied" feedback for the room-code tile.
    const [copiedCode, setCopiedCode] = useState(false);

    // Unified State
    const isLocal = mode === 'local';
    const room = isLocal ? {
        fen: localFen,
        turn: localGame.turn(),
        whitePlayer: 'local-white',
        blackPlayer: 'local-black',
        status: localStatus,
        winner: localWinner,
        lastMove: localLastMove
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
                    const played = localGame.move(bestMove);
                    if (played) setLocalLastMove({ from: played.from, to: played.to });
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
        setLocalLastMove(null);
        setTotalSeconds(0);
        setWhiteSeconds(0);
        setBlackSeconds(0);
    };

    // Actions
    const updateMove = isLocal
        ? (fen: string, move?: { from: string; to: string; promotion?: string }) => {
            handleLocalMove(fen);
            if (move) setLocalLastMove({ from: move.from, to: move.to });
        }
        : async (_fen: string, move: { from: string; to: string; promotion?: string }) => {
            const ok = await gameRoom.makeMove(move);
            if (!ok) setResyncSignal((n) => n + 1); // server rejected → roll back the board
        };
    const resignGame = isLocal ? (color: 'w' | 'b') => {
        setLocalStatus('resigned');
        setLocalWinner(color === 'w' ? 'b' : 'w');
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

    // Reset the "copied" badge shortly after showing it.
    React.useEffect(() => {
        if (!copiedCode) return;
        const timer = window.setTimeout(() => setCopiedCode(false), 1800);
        return () => window.clearTimeout(timer);
    }, [copiedCode]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[80vh] gap-6">
                <div className="liquid-glass p-6 rounded-full shadow-[0_0_60px_-12px_rgba(99,102,241,0.4)] anim-pop-in">
                    <Loader2 className="w-14 h-14 text-indigo-400 animate-spin" />
                </div>
                <div className="text-center space-y-2 anim-fade-up">
                    <h2 className="font-display text-xl font-black text-white uppercase tracking-widest">Entering Arena</h2>
                    <p className="text-slate-500 font-medium">Synchronizing with the global lattice...</p>
                </div>
            </div>
        );
    }

    if (!room) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[80vh] gap-8 anim-fade-up">
                <div className="text-center space-y-4">
                    <h2 className="font-display text-4xl lg:text-5xl font-black text-gradient">Room Dissolved</h2>
                    <p className="text-slate-400 text-lg">The arena you seek no longer exists or the link is expired.</p>
                </div>
                <button onClick={onExit} className="btn-premium px-10 py-4 text-lg">Return to Lobby</button>
            </div>
        );
    }

    // In local mode, human is always White (playing against AI)
    const playerColor = isLocal ? 'w' : (currentUserId === room.whitePlayer ? 'w' : (currentUserId === room.blackPlayer ? 'b' : 'w'));
    const isMyTurn = room.turn === playerColor;

    const chess = new Chess(room.fen);
    const gameState = {
        isCheck: chess.isCheck(),
        turn: chess.turn(),
    };

    const status = room.status ?? 'active';
    const winner = room.winner ?? '';
    const isGameOver = status !== 'active';

    // Last played move (server-provided online, tracked locally vs AI) — purely visual.
    const rawLastMove = room.lastMove as { from?: unknown; to?: unknown } | null | undefined;
    const lastMove = rawLastMove && typeof rawLastMove.from === 'string' && typeof rawLastMove.to === 'string'
        ? { from: rawLastMove.from, to: rawLastMove.to }
        : null;

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

    const statusText = isLocal && status === 'active' && !gameState.isCheck
        ? (room.turn === 'w' ? 'Your Turn' : 'AI Thinking...')
        : statusLabel;

    const overlayResult: 'win' | 'loss' | 'draw' = winner === '' ? 'draw' : winner === playerColor ? 'win' : 'loss';

    const connectedCount = (room.whitePlayer ? 1 : 0) + (room.blackPlayer ? 1 : 0);
    const rematchDisabled = !isGameOver && !isLocal;

    const copyRoomId = () => {
        navigator.clipboard.writeText(roomId);
        setCopiedCode(true);
    };

    const handleExit = () => {
        if (!isLocal && gameRoom.leaveRoom) gameRoom.leaveRoom();
        onExit();
    };

    return (
        <div className="flex flex-col items-center gap-6 lg:gap-10 py-6 lg:py-10 w-full">
            <header className="w-full max-w-7xl flex items-center justify-between gap-3 px-4 lg:px-6 anim-fade-up">
                <button
                    onClick={handleExit}
                    className="group flex items-center gap-3 text-slate-500 hover:text-white transition-colors font-bold uppercase tracking-widest text-xs"
                    aria-label="Back to lobby"
                >
                    <span className="p-2 rounded-xl bg-slate-900 border border-slate-800 group-hover:border-slate-600 group-hover:-translate-x-1 transition-all">
                        <ArrowLeft size={18} />
                    </span>
                    Back
                </button>

                <div className="glass-chip text-indigo-200">
                    <Crown size={14} className="text-indigo-300" />
                    {isLocal ? `Single Player • ${aiDifficulty}` : 'Chess • Online Arena'}
                </div>
            </header>

            <div className="flex flex-col lg:flex-row items-center lg:items-start justify-center gap-6 lg:gap-12 w-full max-w-7xl px-4 lg:px-6">
                <div className="relative group w-full lg:w-auto flex justify-center max-w-full overflow-visible anim-fade-up">
                    <div className="absolute -inset-4 bg-linear-to-br from-indigo-500 via-violet-500 to-indigo-600 rounded-[2.5rem] blur-2xl opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none" />
                    <div className="relative">
                        <ChessBoard
                            initialFen={room.fen}
                            onMove={updateMove}
                            playerColor={playerColor}
                            isGameOver={isGameOver}
                            resyncSignal={resyncSignal}
                            lastMove={lastMove}
                        />

                        {isGameOver && (
                            <div className="overlay-backdrop rounded-[1.75rem] lg:rounded-[2.5rem] anim-pop-in">
                                <div className={`p-5 lg:p-6 rounded-full mb-5 ${
                                    overlayResult === 'win'
                                        ? 'bg-amber-500/20 text-amber-400 shadow-[0_0_50px_-12px_rgba(245,158,11,0.5)]'
                                        : overlayResult === 'loss'
                                            ? 'bg-red-500/20 text-red-400 shadow-[0_0_50px_-12px_rgba(239,68,68,0.5)]'
                                            : 'bg-slate-500/20 text-slate-300 shadow-[0_0_50px_-12px_rgba(148,163,184,0.5)]'
                                }`}>
                                    {overlayResult === 'win' && <Trophy size={56} className="animate-bounce" />}
                                    {overlayResult === 'loss' && <XCircle size={56} />}
                                    {overlayResult === 'draw' && <Handshake size={56} />}
                                </div>

                                <h2 className={`font-display text-4xl lg:text-5xl font-black uppercase tracking-widest mb-2 ${
                                    overlayResult === 'win'
                                        ? 'text-transparent bg-clip-text bg-linear-to-b from-amber-300 to-amber-600'
                                        : 'text-slate-100'
                                }`}>
                                    {overlayResult === 'win' ? 'Victory!' : overlayResult === 'loss' ? 'Defeat' : 'Draw'}
                                </h2>

                                <p className="text-slate-400 font-bold text-sm lg:text-base mb-8 uppercase tracking-widest">
                                    {statusLabel}
                                </p>

                                <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
                                    <button
                                        onClick={() => resetGame()}
                                        className="btn-premium flex-1 flex items-center justify-center gap-2 uppercase tracking-widest text-sm"
                                    >
                                        <RotateCcw size={18} />
                                        Rematch
                                    </button>
                                    <button
                                        onClick={handleExit}
                                        className="btn-ghost flex-1 flex items-center justify-center gap-2 uppercase tracking-widest text-sm"
                                    >
                                        <Home size={18} />
                                        Lobby
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="w-full lg:w-96 lg:shrink-0 flex flex-col gap-5 stagger-children">
                    <div className="liquid-glass p-5 lg:p-6 space-y-5 border-l-4 border-l-indigo-500">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-[0.25em]">
                                Game Status
                            </h3>
                            <div className={`glass-chip ${
                                isGameOver ? 'chip-game-over' : isMyTurn ? 'chip-turn-active' : 'chip-turn-waiting'
                            }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${
                                    isGameOver ? 'bg-indigo-400' : isMyTurn ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                                }`} />
                                {statusText}
                            </div>
                        </div>

                        {status === 'active' && gameState.isCheck && (
                            <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-[10px] lg:text-xs font-black uppercase tracking-widest anim-pop-in">
                                <TriangleAlert size={16} className="shrink-0 text-amber-300" />
                                Check! {gameState.turn === 'w' ? 'White' : 'Black'} to move.
                            </div>
                        )}

                        <div className="glass-inset p-3 lg:p-4 grid grid-cols-3 gap-2 text-center">
                            <ClockCell label="Time" value={formatTime(totalSeconds)} />
                            <ClockCell label="White" value={formatTime(whiteSeconds)} active={!isGameOver && room.turn === 'w'} />
                            <ClockCell label="Black" value={formatTime(blackSeconds)} active={!isGameOver && room.turn === 'b'} />
                        </div>

                        <div className="space-y-3">
                            {isLocal ? (
                                <>
                                    <SeatCard
                                        color="w"
                                        title="White"
                                        subtitle="Connected (You)"
                                        seated
                                        isYou
                                        toMove={!isGameOver && room.turn === 'w'}
                                    />
                                    <SeatCard
                                        color="b"
                                        title="Black"
                                        subtitle={`AI Opponent • ${aiDifficulty}`}
                                        seated
                                        isYou={false}
                                        isAI
                                        toMove={!isGameOver && room.turn === 'b'}
                                    />
                                </>
                            ) : (
                                <>
                                    <SeatCard
                                        color="w"
                                        title="White Player"
                                        subtitle={room.whitePlayer === currentUserId ? 'Connected (You)' : (room.whitePlayer ? 'Opponent Ready' : 'Awaiting Entry...')}
                                        seated={!!room.whitePlayer}
                                        isYou={room.whitePlayer === currentUserId}
                                        toMove={!isGameOver && room.turn === 'w'}
                                    />
                                    <SeatCard
                                        color="b"
                                        title="Black Player"
                                        subtitle={room.blackPlayer === currentUserId ? 'Connected (You)' : (room.blackPlayer ? 'Opponent Ready' : 'Awaiting Entry...')}
                                        seated={!!room.blackPlayer}
                                        isYou={room.blackPlayer === currentUserId}
                                        toMove={!isGameOver && room.turn === 'b'}
                                    />
                                </>
                            )}
                        </div>

                        <div className="flex items-stretch gap-3">
                            <button
                                disabled={isGameOver}
                                onClick={() => resignGame(playerColor as 'w' | 'b')}
                                className="btn-danger flex-1 flex items-center justify-center gap-2 uppercase tracking-wide text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                                aria-label="Resign game"
                            >
                                <Flag size={16} />
                                Resign
                            </button>
                            <button
                                disabled={rematchDisabled}
                                onClick={() => resetGame()}
                                className={`flex-1 flex items-center justify-center gap-2 uppercase tracking-wide text-sm ${
                                    rematchDisabled
                                        ? 'btn-ghost opacity-40 cursor-not-allowed'
                                        : 'btn-premium'
                                }`}
                                aria-label="Start a rematch"
                            >
                                <RotateCcw size={16} />
                                Rematch
                            </button>
                        </div>
                    </div>

                    {!isLocal && (
                        <div className="grid grid-cols-2 gap-4">
                            <div className="rounded-2xl lg:rounded-3xl border border-glass-border bg-white/5 backdrop-blur-xl p-4 lg:p-5 text-center space-y-1.5">
                                <Users size={18} className="mx-auto text-slate-500" />
                                <div className="font-display text-xl font-bold text-white tabular-nums">
                                    {connectedCount}/2
                                </div>
                                <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Connected</div>
                            </div>
                            <button
                                onClick={copyRoomId}
                                className="rounded-2xl lg:rounded-3xl border border-glass-border bg-white/5 backdrop-blur-xl p-4 lg:p-5 text-center space-y-1.5 transition-all duration-200 hover:border-indigo-400/50 hover:bg-indigo-500/10 hover:-translate-y-0.5 active:scale-[0.98] group"
                                aria-label="Copy room code to clipboard"
                            >
                                {copiedCode
                                    ? <Check size={18} className="mx-auto text-emerald-400" />
                                    : <Copy size={18} className="mx-auto text-slate-500 group-hover:text-indigo-300 transition-colors" />}
                                <div className="font-display text-xl font-bold text-indigo-200 truncate">{roomId}</div>
                                <div className={`text-[10px] font-black uppercase tracking-widest ${copiedCode ? 'text-emerald-400' : 'text-slate-500 group-hover:text-slate-400'}`}>
                                    {copiedCode ? 'Copied!' : 'Tap to Copy'}
                                </div>
                            </button>
                        </div>
                    )}

                </div>
            </div>

            <footer className="text-slate-600 font-bold uppercase tracking-[0.4em] text-[10px] pt-8 flex flex-col items-center gap-1">
                <span>Transparent Strategy Arena</span>
                <span className="text-slate-700 text-[8px]">v1.2.0</span>
            </footer>
        </div>
    );
};
