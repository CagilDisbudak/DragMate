import React, { useState } from 'react';
import { Plus, LogIn } from 'lucide-react';
import { useGlobalActivePlayers } from '../../hooks/useGlobalActivePlayers';

interface LobbyProps {
    onCreateRoom: () => void;
    onJoinRoom: (id: string) => void;
    isAuthLoading: boolean;
}

export const Lobby: React.FC<LobbyProps> = ({ onCreateRoom, onJoinRoom, isAuthLoading }) => {
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

    return (
        <div className="flex flex-col items-center justify-center min-h-[85vh] gap-12 relative overflow-hidden">
            <div className="text-center space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-1000">
                <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-sm font-semibold tracking-wide">
                    PREMIUM MULTIPLAYER CHESS
                </div>
                <h1 className="text-8xl font-black tracking-tight bg-clip-text text-transparent bg-linear-to-b from-white via-indigo-100 to-indigo-400">
                    DragMate
                </h1>
                <p className="text-xl text-slate-400 max-w-xl mx-auto leading-relaxed font-medium">
                    Master the board with friends in a fluid, minimalist arena.
                    Zero friction. Pure strategy.
                </p>
            </div>

            <div className="liquid-glass p-12 w-full max-w-xl space-y-10 animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-200">
                <div className="space-y-6">
                    <button
                        onClick={handleCreate}
                        disabled={isCreating || isAuthLoading}
                        className="w-full btn-premium flex items-center justify-center gap-4 text-2xl py-5 group disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isCreating || isAuthLoading ? (
                            <div className="w-7 h-7 border-3 border-white/20 border-t-white rounded-full animate-spin" />
                        ) : (
                            <Plus size={28} className="transition-transform group-hover:rotate-90" />
                        )}
                        <span>{isAuthLoading ? 'Initializing...' : (isCreating ? 'Creating Arena...' : 'New Game')}</span>
                    </button>

                    <div className="relative flex items-center gap-6">
                        <div className="flex-1 h-px bg-slate-800"></div>
                        <span className="text-slate-600 text-xs font-black uppercase tracking-[0.2em]">OR</span>
                        <div className="flex-1 h-px bg-slate-800"></div>
                    </div>

                    <div className="flex gap-4">
                        <div className="relative flex-1 group">
                            <input
                                type="text"
                                placeholder="Enter Room ID"
                                value={roomIdInput}
                                onChange={(e) => setRoomIdInput(e.target.value)}
                                className="w-full bg-slate-900/40 border border-slate-800/50 rounded-2xl px-8 py-5 text-xl placeholder:text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all group-hover:border-slate-700"
                            />
                        </div>
                        <button
                            onClick={() => onJoinRoom(roomIdInput)}
                            disabled={!roomIdInput.trim() || isAuthLoading}
                            className="bg-white text-slate-950 hover:bg-slate-100 disabled:opacity-20 disabled:grayscale px-8 py-5 rounded-2xl transition-all duration-300 font-black active:scale-95 shadow-2xl hover:shadow-white/10"
                        >
                            <LogIn size={28} />
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-6 pt-6 border-t border-slate-800/40">
                    <div className="space-y-1">
                        <div className="text-sm font-bold text-slate-500 uppercase tracking-widest">Active Players</div>
                        <div className="text-3xl font-bold text-white tracking-tight">
                            {isSupported
                                ? (activeLoading ? '—' : (activeCount ?? 0).toLocaleString())
                                : 'Demo'}
                        </div>
                    </div>
                    <div className="space-y-1 text-right">
                        <div className="text-sm font-bold text-slate-500 uppercase tracking-widest">Global Sync</div>
                        <div className="text-3xl font-bold text-green-400 tracking-tight flex items-center justify-end gap-2">
                            <span className={`w-2 h-2 rounded-full animate-pulse ${isSupported ? 'bg-green-500' : 'bg-slate-600'}`} />
                            {isSupported ? 'Live' : 'Demo'}
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-10 text-slate-600 font-bold uppercase tracking-widest text-[10px] animate-in fade-in duration-1000 delay-500">
                <a href="#" className="hover:text-indigo-400 transition-colors">Documentation</a>
                <a href="#" className="hover:text-indigo-400 transition-colors">Leaderboard</a>
                <a href="#" className="hover:text-indigo-400 transition-colors">Source Code</a>
            </div>
        </div>
    );
};
