import React, { useState } from 'react';
import { Plus, LogIn, Users, User, Trophy, ArrowLeft, Dices, LayoutGrid, Bot, Play, Copy, Check, Hash } from 'lucide-react';
import { useGlobalActivePlayers } from '../../hooks/useGlobalActivePlayers';
import type { Room101 } from '../../hooks/use101Room';

interface LobbyProps {
    onCreateRoom: () => void;
    onJoinRoom: (id: string) => void;
    onStartLocal: (difficulty: 'Easy' | 'Normal' | 'Hard') => void;
    isAuthLoading: boolean;
    onSelectGame: (game: 'chess' | 'backgammon' | 'okey' | '101') => void;
    // Okey multiplayer props
    selectedGame?: 'chess' | 'backgammon' | 'okey' | '101';
    onCreateOkeyRoom?: (playerName: string) => Promise<string | null>;
    onJoinOkeyRoom?: (roomId: string, playerName: string) => Promise<boolean>;
    onStartOkeyGame?: () => void;
    okeyRoom?: any | null;
    okeyUserId?: string | null;
    // 101 multiplayer props
    onCreate101Room?: (playerName: string) => Promise<string | null>;
    onJoin101Room?: (roomId: string, playerName: string) => Promise<boolean>;
    onStart101Game?: () => void;
    room101?: Room101 | null;
    user101Id?: string | null;
}

type LobbyStep = 'game-select' | 'mode-select' | 'difficulty-select' | 'connection' | 'okey-name' | 'okey-waiting' | '101-name' | '101-waiting';

export const Lobby: React.FC<LobbyProps> = ({
    onCreateRoom,
    onJoinRoom,
    onStartLocal,
    isAuthLoading,
    onSelectGame,
    selectedGame,
    onCreateOkeyRoom,
    onJoinOkeyRoom,
    onStartOkeyGame,
    okeyRoom,
    okeyUserId,
    // 101 props
    onCreate101Room,
    onJoin101Room,
    onStart101Game,
    room101,
    user101Id
}) => {
    const [step, setStep] = useState<LobbyStep>('game-select');
    const [roomIdInput, setRoomIdInput] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [playerName, setPlayerName] = useState('');
    const [isJoining, setIsJoining] = useState(false);
    const [joinRoomId, setJoinRoomId] = useState('');
    const [copied, setCopied] = useState(false);
    const { count: activeCount, loading: activeLoading, isSupported } = useGlobalActivePlayers();

    const handleCreate = async () => {
        setIsCreating(true);
        try {
            await onCreateRoom();
        } finally {
            setIsCreating(false);
        }
    };

    const handleCreateOkeyRoom = async () => {
        console.log('handleCreateOkeyRoom called, playerName:', playerName, 'onCreateOkeyRoom:', !!onCreateOkeyRoom);
        if (!playerName.trim() || !onCreateOkeyRoom) {
            console.log('Early return - playerName empty or onCreateOkeyRoom missing');
            return;
        }
        setIsCreating(true);
        try {
            console.log('Calling onCreateOkeyRoom...');
            const roomId = await onCreateOkeyRoom(playerName.trim());
            console.log('Room created, roomId:', roomId);
            if (roomId) {
                setStep('okey-waiting');
            }
        } catch (error) {
            console.error('Error in handleCreateOkeyRoom:', error);
        } finally {
            setIsCreating(false);
        }
    };

    const handleJoinOkeyRoom = async () => {
        if (!playerName.trim() || !joinRoomId.trim() || !onJoinOkeyRoom) return;
        setIsJoining(true);
        try {
            const success = await onJoinOkeyRoom(joinRoomId.trim().toUpperCase(), playerName.trim());
            if (success) {
                setStep('okey-waiting');
            }
        } finally {
            setIsJoining(false);
        }
    };

    const copyRoomId = () => {
        if (okeyRoom?.roomId) {
            navigator.clipboard.writeText(okeyRoom.roomId);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const isOkeyHost = okeyRoom?.hostUserId === okeyUserId;
    const is101Host = room101?.hostUserId === user101Id;

    // 101 Room handlers
    const handleCreate101Room = async () => {
        if (!playerName.trim() || !onCreate101Room) return;
        setIsCreating(true);
        try {
            const roomId = await onCreate101Room(playerName.trim());
            if (roomId) {
                setStep('101-waiting');
            }
        } finally {
            setIsCreating(false);
        }
    };

    const handleJoin101Room = async () => {
        if (!playerName.trim() || !joinRoomId.trim() || !onJoin101Room) return;
        setIsJoining(true);
        try {
            const success = await onJoin101Room(joinRoomId.trim().toUpperCase(), playerName.trim());
            if (success) {
                setStep('101-waiting');
            }
        } finally {
            setIsJoining(false);
        }
    };

    const copy101RoomId = () => {
        if (room101?.roomId) {
            navigator.clipboard.writeText(room101.roomId);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const renderGameSelect = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-500">
            <h2 className="text-2xl font-bold text-white text-center">Choose Your Game</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                    onClick={() => { onSelectGame('chess'); setStep('mode-select'); }}
                    className="group relative w-full aspect-square sm:aspect-[4/5] bg-linear-to-br from-slate-800 to-slate-900 rounded-3xl border border-slate-700/50 hover:border-indigo-500/50 transition-all hover:-translate-y-1 hover:shadow-2xl hover:shadow-indigo-500/20 overflow-hidden text-left p-4 sm:p-6 flex flex-col justify-between"
                >
                    <div>
                        <Trophy className="w-8 h-8 sm:w-10 sm:h-10 text-indigo-400 mb-2 sm:mb-3 group-hover:scale-110 transition-transform" />
                        <h3 className="text-xl sm:text-2xl font-black text-white">CHESS</h3>
                        <p className="text-slate-400 text-xs sm:text-sm font-medium mt-1">Classic strategy.</p>
                    </div>
                </button>

                <button
                    onClick={() => { onSelectGame('backgammon'); setStep('mode-select'); }}
                    className="group relative w-full aspect-square sm:aspect-[4/5] bg-linear-to-br from-slate-800 to-slate-900 rounded-3xl border border-slate-700/50 hover:border-emerald-500/50 transition-all hover:-translate-y-1 hover:shadow-2xl hover:shadow-emerald-500/20 overflow-hidden text-left p-4 sm:p-6 flex flex-col justify-between"
                >
                    <div className="absolute top-0 right-0 p-1.5 sm:p-2 bg-emerald-500/10 text-emerald-300 rounded-bl-2xl text-[8px] sm:text-[10px] font-black uppercase tracking-widest border-b border-l border-emerald-500/20">
                        New
                    </div>
                    <div>
                        <Dices className="w-8 h-8 sm:w-10 sm:h-10 text-emerald-400 mb-2 sm:mb-3 group-hover:scale-110 transition-transform" />
                        <h3 className="text-xl sm:text-2xl font-black text-white">TAVLA</h3>
                        <p className="text-slate-400 text-xs sm:text-sm font-medium mt-1">Persian legacy.</p>
                    </div>
                </button>

                <button
                    onClick={() => { onSelectGame('okey'); setStep('mode-select'); }}
                    className="group relative w-full aspect-square sm:aspect-[4/5] bg-linear-to-br from-slate-800 to-slate-900 rounded-3xl border border-slate-700/50 hover:border-amber-500/50 transition-all hover:-translate-y-1 hover:shadow-2xl hover:shadow-amber-500/20 overflow-hidden text-left p-4 sm:p-6 flex flex-col justify-between"
                >
                    <div className="absolute top-0 right-0 p-1.5 sm:p-2 bg-amber-500/10 text-amber-300 rounded-bl-2xl text-[8px] sm:text-[10px] font-black uppercase tracking-widest border-b border-l border-amber-500/20">
                        Top
                    </div>
                    <div>
                        <LayoutGrid className="w-8 h-8 sm:w-10 sm:h-10 text-amber-400 mb-2 sm:mb-3 group-hover:scale-110 transition-transform" />
                        <h3 className="text-xl sm:text-2xl font-black text-white">OKEY</h3>
                        <p className="text-slate-400 text-xs sm:text-sm font-medium mt-1">Turkish Rummy.</p>
                    </div>
                </button>

                <button
                    onClick={() => { onSelectGame('101'); setStep('mode-select'); }}
                    className="group relative w-full aspect-square sm:aspect-[4/5] bg-linear-to-br from-slate-800 to-slate-900 rounded-3xl border border-slate-700/50 hover:border-rose-500/50 transition-all hover:-translate-y-1 hover:shadow-2xl hover:shadow-rose-500/20 overflow-hidden text-left p-4 sm:p-6 flex flex-col justify-between"
                >
                    <div className="absolute top-0 right-0 p-1.5 sm:p-2 bg-rose-500/10 text-rose-300 rounded-bl-2xl text-[8px] sm:text-[10px] font-black uppercase tracking-widest border-b border-l border-rose-500/20">
                        New
                    </div>
                    <div>
                        <Hash className="w-8 h-8 sm:w-10 sm:h-10 text-rose-400 mb-2 sm:mb-3 group-hover:scale-110 transition-transform" />
                        <h3 className="text-xl sm:text-2xl font-black text-white">101</h3>
                        <p className="text-slate-400 text-xs sm:text-sm font-medium mt-1">Card Rummy.</p>
                    </div>
                </button>
            </div>
        </div>
    );

    const renderDifficultySelect = () => (
        <div className="space-y-10 animate-in fade-in slide-in-from-right-8 duration-500">
            <div className="flex items-center gap-4 mb-2">
                <button
                    onClick={() => setStep('mode-select')}
                    className="p-2 -ml-2 text-slate-500 hover:text-white transition-colors"
                >
                    <ArrowLeft size={20} />
                </button>
                <h2 className="text-2xl font-bold text-white">Select Threat Level</h2>
            </div>

            <div className="grid grid-cols-1 gap-3">
                <button
                    onClick={() => onStartLocal('Easy')}
                    className="group flex items-center justify-between p-4 bg-slate-800/50 rounded-xl border border-slate-700 hover:border-green-500/50 hover:bg-slate-800 transition-all"
                >
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-full bg-green-500/10 text-green-400">
                            <User size={20} />
                        </div>
                        <div className="text-left">
                            <div className="text-lg font-bold text-white">Easy</div>
                            <div className="text-xs text-slate-500">Casual play</div>
                        </div>
                    </div>
                </button>

                <button
                    onClick={() => onStartLocal('Normal')}
                    className="group flex items-center justify-between p-4 bg-slate-800/50 rounded-xl border border-slate-700 hover:border-indigo-500/50 hover:bg-slate-800 transition-all"
                >
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-full bg-indigo-500/10 text-indigo-400">
                            <User size={20} />
                        </div>
                        <div className="text-left">
                            <div className="text-lg font-bold text-white">Normal</div>
                            <div className="text-xs text-slate-500">Balanced opponent</div>
                        </div>
                    </div>
                </button>

                <button
                    onClick={() => onStartLocal('Hard')}
                    className="group flex items-center justify-between p-4 bg-slate-800/50 rounded-xl border border-slate-700 hover:border-red-500/50 hover:bg-slate-800 transition-all"
                >
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-full bg-red-500/10 text-red-400">
                            <Trophy size={20} />
                        </div>
                        <div className="text-left">
                            <div className="text-lg font-bold text-white">Hard</div>
                            <div className="text-xs text-slate-500">Ruthless tactics</div>
                        </div>
                    </div>
                </button>
            </div>
        </div>
    );

    const renderModeSelect = () => (
        <div className="space-y-10 animate-in fade-in slide-in-from-right-8 duration-500">
            <div className="flex items-center gap-4 mb-2">
                <button
                    onClick={() => setStep('game-select')}
                    className="p-2 -ml-2 text-slate-500 hover:text-white transition-colors"
                >
                    <ArrowLeft size={20} />
                </button>
                <h2 className="text-2xl font-bold text-white">Select Mode</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                    onClick={() => setStep('difficulty-select')}
                    className="group flex flex-col items-center justify-center gap-4 p-8 bg-slate-800/50 rounded-2xl border border-slate-700 hover:border-emerald-500/50 hover:bg-slate-800 transition-all"
                >
                    <div className="p-4 rounded-full bg-emerald-500/10 text-emerald-400 group-hover:scale-110 transition-transform">
                        <User size={32} />
                    </div>
                    <div className="text-center">
                        <div className="text-xl font-bold text-white">Single Player</div>
                        <div className="text-sm text-slate-500 mt-1">Vs Computer</div>
                    </div>
                </button>

                <button
                    onClick={() => {
                        if (selectedGame === 'okey') setStep('okey-name');
                        else if (selectedGame === '101') setStep('101-name');
                        else setStep('connection');
                    }}
                    className="group flex flex-col items-center justify-center gap-4 p-8 bg-slate-800/50 rounded-2xl border border-slate-700 hover:border-indigo-500/50 hover:bg-slate-800 transition-all"
                >
                    <div className="p-4 rounded-full bg-indigo-500/10 text-indigo-400 group-hover:scale-110 transition-transform">
                        <Users size={32} />
                    </div>
                    <div className="text-center">
                        <div className="text-xl font-bold text-white">Multiplayer</div>
                        <div className="text-sm text-slate-500 mt-1">{(selectedGame === 'okey' || selectedGame === '101') ? '1-4 Players' : 'Online PvP'}</div>
                    </div>
                </button>
            </div>
        </div>
    );

    const renderConnection = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
            <div className="flex items-center gap-4 mb-2">
                <button
                    onClick={() => setStep('mode-select')}
                    className="p-2 -ml-2 text-slate-500 hover:text-white transition-colors"
                >
                    <ArrowLeft size={20} />
                </button>
                <h2 className="text-2xl font-bold text-white">Multiplayer</h2>
            </div>

            <div className="space-y-6">
                <button
                    onClick={handleCreate}
                    disabled={isCreating || isAuthLoading}
                    className="w-full btn-premium flex items-center justify-center gap-3 sm:gap-4 text-lg py-4 group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isCreating || isAuthLoading ? (
                        <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    ) : (
                        <Plus size={24} className="transition-transform group-hover:rotate-90" />
                    )}
                    <span>{isAuthLoading ? 'Initializing...' : (isCreating ? 'Creating Arena...' : 'Create New Room')}</span>
                </button>

                <div className="relative flex items-center gap-6">
                    <div className="flex-1 h-px bg-slate-800"></div>
                    <span className="text-slate-600 text-xs font-black uppercase tracking-[0.2em]">OR JOIN</span>
                    <div className="flex-1 h-px bg-slate-800"></div>
                </div>

                <div className="flex gap-3">
                    <input
                        type="text"
                        placeholder="Enter Room ID"
                        value={roomIdInput}
                        onChange={(e) => setRoomIdInput(e.target.value)}
                        className="flex-1 bg-slate-900/40 border border-slate-800/50 rounded-xl px-4 py-4 text-lg placeholder:text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all"
                    />
                    <button
                        onClick={() => onJoinRoom(roomIdInput)}
                        disabled={!roomIdInput.trim() || isAuthLoading}
                        className="bg-slate-800 hover:bg-slate-700 text-white disabled:opacity-50 px-6 rounded-xl transition-all font-bold shadow-lg"
                    >
                        <LogIn size={24} />
                    </button>
                </div>
            </div>
        </div>
    );

    // Okey specific screens
    const renderOkeyNameInput = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
            <div className="flex items-center gap-4 mb-2">
                <button
                    onClick={() => setStep('mode-select')}
                    className="p-2 -ml-2 text-slate-500 hover:text-white transition-colors"
                >
                    <ArrowLeft size={20} />
                </button>
                <h2 className="text-2xl font-bold text-white">Okey Multiplayer</h2>
            </div>

            <div className="space-y-6">
                {/* Name input */}
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-400">Your Name</label>
                    <input
                        type="text"
                        placeholder="Enter your name..."
                        value={playerName}
                        onChange={(e) => setPlayerName(e.target.value)}
                        maxLength={20}
                        className="w-full bg-slate-900/40 border border-slate-800/50 rounded-xl px-4 py-4 text-lg placeholder:text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-all"
                    />
                </div>

                {/* Create room button */}
                <button
                    onClick={handleCreateOkeyRoom}
                    disabled={!playerName.trim() || isCreating || isAuthLoading}
                    className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold flex items-center justify-center gap-3 text-lg py-4 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-amber-500/20"
                >
                    {isCreating ? (
                        <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    ) : (
                        <Plus size={24} />
                    )}
                    <span>{isCreating ? 'Creating Room...' : 'Create New Room'}</span>
                </button>

                <div className="relative flex items-center gap-6">
                    <div className="flex-1 h-px bg-slate-800"></div>
                    <span className="text-slate-600 text-xs font-black uppercase tracking-[0.2em]">OR JOIN</span>
                    <div className="flex-1 h-px bg-slate-800"></div>
                </div>

                {/* Join room */}
                <div className="flex gap-3">
                    <input
                        type="text"
                        placeholder="Room ID"
                        value={joinRoomId}
                        onChange={(e) => setJoinRoomId(e.target.value.toUpperCase())}
                        maxLength={10}
                        className="flex-1 bg-slate-900/40 border border-slate-800/50 rounded-xl px-4 py-4 text-lg placeholder:text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-all uppercase"
                    />
                    <button
                        onClick={handleJoinOkeyRoom}
                        disabled={!playerName.trim() || !joinRoomId.trim() || isJoining || isAuthLoading}
                        className="bg-slate-800 hover:bg-slate-700 text-white disabled:opacity-50 px-6 rounded-xl transition-all font-bold shadow-lg"
                    >
                        {isJoining ? (
                            <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        ) : (
                            <LogIn size={24} />
                        )}
                    </button>
                </div>

                <p className="text-xs text-slate-600 text-center">
                    Create a room and share the ID with friends. Empty slots will be filled with AI.
                </p>
            </div>
        </div>
    );

    const renderOkeyWaitingRoom = () => {
        if (!okeyRoom) {
            return (
                <div className="flex items-center justify-center py-20">
                    <div className="w-8 h-8 border-2 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
                </div>
            );
        }

        const playerCount = okeyRoom.players.filter((p: any) => p.odaUserId && !p.adIsAI).length;

        return (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
                <div className="flex items-center gap-4 mb-2">
                    <button
                        onClick={() => setStep('okey-name')}
                        className="p-2 -ml-2 text-slate-500 hover:text-white transition-colors"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <h2 className="text-2xl font-bold text-white">Waiting Room</h2>
                </div>

                {/* Room ID display */}
                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-slate-500 uppercase tracking-wider font-bold">Room ID</p>
                            <p className="text-2xl font-black text-amber-400 tracking-widest">{okeyRoom.roomId}</p>
                        </div>
                        <button
                            onClick={copyRoomId}
                            className="p-3 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors"
                        >
                            {copied ? <Check size={20} className="text-green-400" /> : <Copy size={20} className="text-slate-400" />}
                        </button>
                    </div>
                </div>

                {/* Players list */}
                <div className="space-y-3">
                    <p className="text-sm font-medium text-slate-400">Players ({playerCount}/4)</p>
                    <div className="grid grid-cols-2 gap-3">
                        {okeyRoom.players.map((player: any, index: number) => {
                            const isCurrentUser = player.odaUserId === okeyUserId;
                            const isEmpty = !player.odaUserId;
                            const isHost = player.odaUserId === okeyRoom.hostUserId;

                            return (
                                <div
                                    key={index}
                                    className={`p-4 rounded-xl border transition-all ${isEmpty
                                            ? 'bg-slate-900/30 border-slate-800 border-dashed'
                                            : isCurrentUser
                                                ? 'bg-amber-500/10 border-amber-500/50'
                                                : 'bg-slate-800/50 border-slate-700'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-full ${isEmpty ? 'bg-slate-800' : isCurrentUser ? 'bg-amber-500/20' : 'bg-slate-700'
                                            }`}>
                                            {isEmpty ? (
                                                <Bot size={18} className="text-slate-600" />
                                            ) : (
                                                <User size={18} className={isCurrentUser ? 'text-amber-400' : 'text-slate-400'} />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`font-bold truncate ${isEmpty ? 'text-slate-600' : isCurrentUser ? 'text-amber-400' : 'text-white'
                                                }`}>
                                                {isEmpty ? 'Waiting...' : player.adPlayerName}
                                            </p>
                                            <p className="text-xs text-slate-500">
                                                {isHost ? '👑 Host' : isEmpty ? 'Will be AI' : `Seat ${index + 1}`}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Start game button (host only) */}
                {isOkeyHost && (
                    <button
                        onClick={onStartOkeyGame}
                        className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold flex items-center justify-center gap-3 text-lg py-4 rounded-xl transition-all shadow-lg shadow-green-500/20"
                    >
                        <Play size={24} />
                        <span>Start Game</span>
                    </button>
                )}

                {!isOkeyHost && (
                    <div className="text-center py-4">
                        <div className="flex items-center justify-center gap-2 text-slate-500">
                            <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                            <span className="text-sm">Waiting for host to start...</span>
                        </div>
                    </div>
                )}

                <p className="text-xs text-slate-600 text-center">
                    Share the Room ID with friends. Empty seats will be filled with AI players.
                </p>
            </div>
        );
    };

    // 101 Name Input
    const render101NameInput = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
            <div className="flex items-center gap-4 mb-2">
                <button
                    onClick={() => setStep('mode-select')}
                    className="p-2 -ml-2 text-slate-500 hover:text-white transition-colors"
                >
                    <ArrowLeft size={20} />
                </button>
                <h2 className="text-2xl font-bold text-white">101 Multiplayer</h2>
            </div>

            <div className="space-y-6">
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-400">Your Name</label>
                    <input
                        type="text"
                        placeholder="Enter your name..."
                        value={playerName}
                        onChange={(e) => setPlayerName(e.target.value)}
                        maxLength={20}
                        className="w-full bg-slate-900/40 border border-slate-800/50 rounded-xl px-4 py-4 text-lg placeholder:text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-500/30 transition-all"
                    />
                </div>

                <button
                    onClick={handleCreate101Room}
                    disabled={!playerName.trim() || isCreating || isAuthLoading}
                    className="w-full bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white font-bold flex items-center justify-center gap-3 text-lg py-4 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-rose-500/20"
                >
                    {isCreating ? (
                        <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    ) : (
                        <Plus size={24} />
                    )}
                    <span>{isCreating ? 'Creating Room...' : 'Create New Room'}</span>
                </button>

                <div className="relative flex items-center gap-6">
                    <div className="flex-1 h-px bg-slate-800"></div>
                    <span className="text-slate-600 text-xs font-black uppercase tracking-[0.2em]">OR JOIN</span>
                    <div className="flex-1 h-px bg-slate-800"></div>
                </div>

                <div className="flex gap-3">
                    <input
                        type="text"
                        placeholder="Room ID"
                        value={joinRoomId}
                        onChange={(e) => setJoinRoomId(e.target.value.toUpperCase())}
                        maxLength={10}
                        className="flex-1 bg-slate-900/40 border border-slate-800/50 rounded-xl px-4 py-4 text-lg placeholder:text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-500/30 transition-all uppercase"
                    />
                    <button
                        onClick={handleJoin101Room}
                        disabled={!playerName.trim() || !joinRoomId.trim() || isJoining || isAuthLoading}
                        className="bg-slate-800 hover:bg-slate-700 text-white disabled:opacity-50 px-6 rounded-xl transition-all font-bold shadow-lg"
                    >
                        {isJoining ? (
                            <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        ) : (
                            <LogIn size={24} />
                        )}
                    </button>
                </div>

                <p className="text-xs text-slate-600 text-center">
                    Create a room and share the ID with friends. Empty slots will be filled with AI.
                </p>
            </div>
        </div>
    );

    // 101 Waiting Room
    const render101WaitingRoom = () => {
        if (!room101) {
            return (
                <div className="flex items-center justify-center py-20">
                    <div className="w-8 h-8 border-2 border-rose-500/20 border-t-rose-500 rounded-full animate-spin" />
                </div>
            );
        }

        const playerCount = room101.players.filter(p => p.odaUserId && !p.adIsAI).length;

        return (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
                <div className="flex items-center gap-4 mb-2">
                    <button
                        onClick={() => setStep('101-name')}
                        className="p-2 -ml-2 text-slate-500 hover:text-white transition-colors"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <h2 className="text-2xl font-bold text-white">101 Waiting Room</h2>
                </div>

                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-slate-500 uppercase tracking-wider font-bold">Room ID</p>
                            <p className="text-2xl font-black text-rose-400 tracking-widest">{room101.roomId}</p>
                        </div>
                        <button
                            onClick={copy101RoomId}
                            className="p-3 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors"
                        >
                            {copied ? <Check size={20} className="text-green-400" /> : <Copy size={20} className="text-slate-400" />}
                        </button>
                    </div>
                </div>

                <div className="space-y-3">
                    <p className="text-sm font-medium text-slate-400">Players ({playerCount}/4)</p>
                    <div className="grid grid-cols-2 gap-3">
                        {room101.players.map((player, index) => {
                            const isCurrentUser = player.odaUserId === user101Id;
                            const isEmpty = !player.odaUserId;
                            const isHost = player.odaUserId === room101.hostUserId;

                            return (
                                <div
                                    key={index}
                                    className={`p-4 rounded-xl border transition-all ${isEmpty
                                            ? 'bg-slate-900/30 border-slate-800 border-dashed'
                                            : isCurrentUser
                                                ? 'bg-rose-500/10 border-rose-500/50'
                                                : 'bg-slate-800/50 border-slate-700'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-full ${isEmpty ? 'bg-slate-800' : isCurrentUser ? 'bg-rose-500/20' : 'bg-slate-700'
                                            }`}>
                                            {isEmpty ? (
                                                <Bot size={18} className="text-slate-600" />
                                            ) : (
                                                <User size={18} className={isCurrentUser ? 'text-rose-400' : 'text-slate-400'} />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`font-bold truncate ${isEmpty ? 'text-slate-600' : isCurrentUser ? 'text-rose-400' : 'text-white'
                                                }`}>
                                                {isEmpty ? 'Waiting...' : player.adPlayerName}
                                            </p>
                                            <p className="text-xs text-slate-500">
                                                {isHost ? '👑 Host' : isEmpty ? 'Will be AI' : `Seat ${index + 1}`}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {is101Host && (
                    <button
                        onClick={onStart101Game}
                        className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold flex items-center justify-center gap-3 text-lg py-4 rounded-xl transition-all shadow-lg shadow-green-500/20"
                    >
                        <Play size={24} />
                        <span>Start Game</span>
                    </button>
                )}

                {!is101Host && (
                    <div className="text-center py-4">
                        <div className="flex items-center justify-center gap-2 text-slate-500">
                            <div className="w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
                            <span className="text-sm">Waiting for host to start...</span>
                        </div>
                    </div>
                )}

                <p className="text-xs text-slate-600 text-center">
                    Share the Room ID with friends. Empty seats will be filled with AI players.
                </p>
            </div>
        );
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-[85vh] gap-8 lg:gap-12 relative overflow-hidden px-4">
            <div className="text-center space-y-4 lg:space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-1000">
                <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-8xl font-black tracking-normal pb-4 bg-clip-text text-transparent bg-linear-to-b from-white via-indigo-100 to-indigo-400">
                    DragMate
                </h1>
            </div>

            <div className="liquid-glass p-6 sm:p-8 w-full max-w-xl min-h-[400px] flex flex-col justify-center">
                {step === 'game-select' && renderGameSelect()}
                {step === 'mode-select' && renderModeSelect()}
                {step === 'difficulty-select' && renderDifficultySelect()}
                {step === 'connection' && renderConnection()}
                {step === 'okey-name' && renderOkeyNameInput()}
                {step === 'okey-waiting' && renderOkeyWaitingRoom()}
                {step === '101-name' && render101NameInput()}
                {step === '101-waiting' && render101WaitingRoom()}
            </div>

            <div className="flex items-center gap-10 text-slate-600 font-bold uppercase tracking-widest text-[10px] animate-in fade-in duration-1000 delay-500">
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full animate-pulse ${isSupported ? 'bg-green-500' : 'bg-slate-600'}`} />
                    {isSupported ? `${activeLoading ? '...' : (activeCount ?? 0).toLocaleString()} Online` : 'Demo Mode'}
                </div>
            </div>
        </div>
    );
};
