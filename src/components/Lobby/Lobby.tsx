import React, { useState } from 'react';
import { Plus, LogIn, Users, User, Trophy, ArrowRight, ArrowLeft } from 'lucide-react';
import { useGlobalActivePlayers } from '../../hooks/useGlobalActivePlayers';

interface LobbyProps {
    onCreateRoom: () => void;
    onJoinRoom: (id: string) => void;
    onStartLocal: (difficulty: 'Easy' | 'Normal' | 'Hard') => void;
    isAuthLoading: boolean;
}

type LobbyStep = 'game-select' | 'mode-select' | 'difficulty-select' | 'connection';

export const Lobby: React.FC<LobbyProps> = ({ onCreateRoom, onJoinRoom, onStartLocal, isAuthLoading }) => {
    const [step, setStep] = useState<LobbyStep>('game-select');
    const [roomIdInput, setRoomIdInput] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const { count: activeCount, loading: activeLoading, isSupported } = useGlobalActivePlayers();

    const handleCreate = async () => {
        setIsCreating(true);
        try {
            await onCreateRoom();
        } finally {
            setIsCreating(false);
        }
    };

    const renderGameSelect = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-500">
            <h2 className="text-2xl font-bold text-white text-center">Choose Your Game</h2>
            <button
                onClick={() => setStep('mode-select')}
                className="group relative w-full aspect-video bg-linear-to-br from-slate-800 to-slate-900 rounded-3xl border border-slate-700/50 hover:border-indigo-500/50 transition-all hover:-translate-y-1 hover:shadow-2xl hover:shadow-indigo-500/20 overflow-hidden text-left p-8"
            >
                <div className="absolute top-0 right-0 p-3 bg-indigo-500/10 text-indigo-300 rounded-bl-2xl text-xs font-black uppercase tracking-widest border-b border-l border-indigo-500/20">
                    Featured
                </div>
                <Trophy className="w-12 h-12 text-indigo-400 mb-4 group-hover:scale-110 transition-transform" />
                <h3 className="text-3xl font-black text-white mb-2">CHESS</h3>
                <p className="text-slate-400 font-medium max-w-[200px]">The classic game of strategy. Multiplayer & Local.</p>
                <div className="absolute bottom-6 right-6 p-3 rounded-full bg-indigo-500 text-white opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                    <ArrowRight size={20} />
                </div>
            </button>
        </div>
    );

    const renderDifficultySelect = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
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
        <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
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
                    onClick={() => setStep('connection')}
                    className="group flex flex-col items-center justify-center gap-4 p-8 bg-slate-800/50 rounded-2xl border border-slate-700 hover:border-indigo-500/50 hover:bg-slate-800 transition-all"
                >
                    <div className="p-4 rounded-full bg-indigo-500/10 text-indigo-400 group-hover:scale-110 transition-transform">
                        <Users size={32} />
                    </div>
                    <div className="text-center">
                        <div className="text-xl font-bold text-white">Multiplayer</div>
                        <div className="text-sm text-slate-500 mt-1">Online PvP</div>
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

    return (
        <div className="flex flex-col items-center justify-center min-h-[85vh] gap-8 lg:gap-12 relative overflow-hidden px-4">
            <div className="text-center space-y-4 lg:space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-1000">
                <div className="inline-flex items-center px-3 sm:px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs sm:text-sm font-semibold tracking-wide">
                    PREMIUM MULTIPLAYER CHESS
                </div>
                <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-8xl font-black tracking-tight bg-clip-text text-transparent bg-linear-to-b from-white via-indigo-100 to-indigo-400">
                    DragMate
                </h1>
            </div>

            <div className="liquid-glass p-6 sm:p-8 w-full max-w-xl min-h-[400px]">
                {step === 'game-select' && renderGameSelect()}
                {step === 'mode-select' && renderModeSelect()}
                {step === 'difficulty-select' && renderDifficultySelect()}
                {step === 'connection' && renderConnection()}
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
