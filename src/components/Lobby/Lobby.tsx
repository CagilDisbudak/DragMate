import React, { useState } from 'react';
import {
    Plus, LogIn, Users, User, Trophy, ArrowLeft, Dices, LayoutGrid, Bot, Play,
    Copy, Check, Hash, Info, BookOpen, Crown, Sparkles, Swords, Flame, ChevronRight
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useGlobalActivePlayers } from '../../hooks/useGlobalActivePlayers';
import type { Room101 } from '../../hooks/use101Room';
import { RulesModal } from './RulesModal';
import type { GameKey } from '../../data/gameRules';

// Per-game accent identity (literal class strings so Tailwind keeps them in the build).
// chess = indigo · backgammon = emerald · okey = amber · 101 = rose
const ACCENT: Record<GameKey, {
    label: string;
    text: string;
    chip: string;
    iconBg: string;
    cardHover: string;
    modeHover: string;
    dotStrong: string;
    inputRing: string;
    createBtn: string;
    selfCard: string;
    avatar: string;
    glow: string;
    spinner: string;
}> = {
    chess: {
        label: 'Chess',
        text: 'text-indigo-400',
        chip: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30',
        iconBg: 'bg-indigo-500/15 text-indigo-300',
        cardHover: 'hover:border-indigo-400/60 hover:shadow-indigo-500/20',
        modeHover: 'hover:border-indigo-400/50 hover:shadow-indigo-500/10',
        dotStrong: 'bg-indigo-400',
        inputRing: 'focus:ring-indigo-500/30 focus:border-indigo-500/50',
        createBtn: 'from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 shadow-indigo-500/25 hover:shadow-indigo-500/40',
        selfCard: 'bg-indigo-500/10 border-indigo-500/40',
        avatar: 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300',
        glow: 'bg-indigo-500',
        spinner: 'border-indigo-500/20 border-t-indigo-500',
    },
    backgammon: {
        label: 'Tavla',
        text: 'text-emerald-400',
        chip: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
        iconBg: 'bg-emerald-500/15 text-emerald-300',
        cardHover: 'hover:border-emerald-400/60 hover:shadow-emerald-500/20',
        modeHover: 'hover:border-emerald-400/50 hover:shadow-emerald-500/10',
        dotStrong: 'bg-emerald-400',
        inputRing: 'focus:ring-emerald-500/30 focus:border-emerald-500/50',
        createBtn: 'from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 shadow-emerald-500/25 hover:shadow-emerald-500/40',
        selfCard: 'bg-emerald-500/10 border-emerald-500/40',
        avatar: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300',
        glow: 'bg-emerald-500',
        spinner: 'border-emerald-500/20 border-t-emerald-500',
    },
    okey: {
        label: 'Okey',
        text: 'text-amber-400',
        chip: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
        iconBg: 'bg-amber-500/15 text-amber-300',
        cardHover: 'hover:border-amber-400/60 hover:shadow-amber-500/20',
        modeHover: 'hover:border-amber-400/50 hover:shadow-amber-500/10',
        dotStrong: 'bg-amber-400',
        inputRing: 'focus:ring-amber-500/30 focus:border-amber-500/50',
        createBtn: 'from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 shadow-amber-500/25 hover:shadow-amber-500/40',
        selfCard: 'bg-amber-500/10 border-amber-500/40',
        avatar: 'bg-amber-500/20 border-amber-500/40 text-amber-300',
        glow: 'bg-amber-500',
        spinner: 'border-amber-500/20 border-t-amber-500',
    },
    '101': {
        label: '101',
        text: 'text-rose-400',
        chip: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
        iconBg: 'bg-rose-500/15 text-rose-300',
        cardHover: 'hover:border-rose-400/60 hover:shadow-rose-500/20',
        modeHover: 'hover:border-rose-400/50 hover:shadow-rose-500/10',
        dotStrong: 'bg-rose-400',
        inputRing: 'focus:ring-rose-500/30 focus:border-rose-500/50',
        createBtn: 'from-rose-500 to-pink-500 hover:from-rose-400 hover:to-pink-400 shadow-rose-500/25 hover:shadow-rose-500/40',
        selfCard: 'bg-rose-500/10 border-rose-500/40',
        avatar: 'bg-rose-500/20 border-rose-500/40 text-rose-300',
        glow: 'bg-rose-500',
        spinner: 'border-rose-500/20 border-t-rose-500',
    },
};

const GAME_CARDS: Array<{
    key: GameKey;
    name: string;
    desc: string;
    icon: LucideIcon;
    badge?: string;
    badgeClass?: string;
}> = [
    { key: 'chess', name: 'CHESS', desc: 'Classic strategy.', icon: Trophy },
    { key: 'backgammon', name: 'TAVLA', desc: 'Persian legacy.', icon: Dices, badge: 'New', badgeClass: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' },
    { key: 'okey', name: 'OKEY', desc: 'Turkish Rummy.', icon: LayoutGrid, badge: 'Top', badgeClass: 'bg-amber-500/10 text-amber-300 border-amber-500/20' },
    { key: '101', name: '101', desc: 'Card Rummy.', icon: Hash, badge: 'New', badgeClass: 'bg-rose-500/10 text-rose-300 border-rose-500/20' },
];

const DIFFICULTIES = [
    { level: 'Easy', desc: 'Casual play', icon: Sparkles, iconCls: 'bg-emerald-500/10 text-emerald-400', hover: 'hover:border-emerald-500/50 hover:shadow-emerald-500/10' },
    { level: 'Normal', desc: 'Balanced opponent', icon: Swords, iconCls: 'bg-indigo-500/10 text-indigo-400', hover: 'hover:border-indigo-500/50 hover:shadow-indigo-500/10' },
    { level: 'Hard', desc: 'Ruthless tactics', icon: Flame, iconCls: 'bg-red-500/10 text-red-400', hover: 'hover:border-red-500/50 hover:shadow-red-500/10' },
] as const;

// Small "Kurallar" trigger placed on each game card (span, not a nested <button>).
const RulesBadge: React.FC<{ game: GameKey; onOpen: (g: GameKey) => void }> = ({ game, onOpen }) => (
    <span
        role="button"
        tabIndex={0}
        title="Nasıl oynanır?"
        onClick={(e) => { e.stopPropagation(); onOpen(game); }}
        onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); e.preventDefault(); onOpen(game); }
        }}
        className="absolute top-2.5 left-2.5 z-10 inline-flex items-center gap-1 px-2 py-1 rounded-full border border-white/10 bg-black/45 backdrop-blur-md text-slate-300 hover:text-white hover:bg-black/65 hover:border-white/25 transition-all cursor-pointer active:scale-95"
    >
        <Info size={13} />
        <span className="text-[9px] font-black uppercase tracking-wider">Kurallar</span>
    </span>
);

// Shared step chrome
const Spinner: React.FC<{ className?: string }> = ({ className = '' }) => (
    <div className={`w-5 h-5 border-2 border-white/25 border-t-white rounded-full animate-spin ${className}`} />
);

const StepDots: React.FC<{ current: number; activeClass: string }> = ({ current, activeClass }) => (
    <div className="hidden sm:flex items-center gap-1.5" aria-hidden="true">
        {[1, 2, 3].map((i) => (
            <span
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${i === current ? `w-5 ${activeClass}` : 'w-1.5 bg-slate-700'}`}
            />
        ))}
    </div>
);

const StepHeader: React.FC<{
    onBack: () => void;
    title: string;
    chip?: React.ReactNode;
    right?: React.ReactNode;
    dots?: React.ReactNode;
}> = ({ onBack, title, chip, right, dots }) => (
    <div className="flex items-center gap-3">
        <button
            onClick={onBack}
            aria-label="Geri dön"
            className="p-2 -ml-1 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all active:scale-90"
        >
            <ArrowLeft size={20} />
        </button>
        <h2 className="font-display text-xl sm:text-2xl font-bold text-white leading-none">{title}</h2>
        {chip}
        <div className="ml-auto flex items-center gap-3">
            {right}
            {dots}
        </div>
    </div>
);

const OrDivider: React.FC = () => (
    <div className="relative flex items-center gap-4">
        <div className="flex-1 h-px bg-linear-to-r from-transparent to-slate-700/80" />
        <span className="text-slate-600 text-[10px] font-black uppercase tracking-[0.3em]">OR JOIN</span>
        <div className="flex-1 h-px bg-linear-to-l from-transparent to-slate-700/80" />
    </div>
);

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
    const [rulesGameType, setRulesGameType] = useState<GameKey | null>(null);
    const [roomIdInput, setRoomIdInput] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [playerName, setPlayerName] = useState('');
    const [isJoining, setIsJoining] = useState(false);
    const [joinRoomId, setJoinRoomId] = useState('');
    const [copied, setCopied] = useState(false);
    const { count: activeCount, loading: activeLoading, isSupported } = useGlobalActivePlayers();

    const currentAccent = ACCENT[selectedGame ?? 'chess'];

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

    const accentChip = (a: typeof currentAccent) => (
        <span className={`hidden sm:inline-flex items-center px-2.5 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest ${a.chip}`}>
            {a.label}
        </span>
    );

    const renderGameSelect = () => (
        <div className="space-y-5 sm:space-y-6 anim-fade-up">
            <div className="text-center space-y-1.5">
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-white">Choose Your Game</h2>
                <p className="text-[10px] sm:text-xs text-slate-500 font-bold uppercase tracking-[0.3em]">Solo &amp; Online Tables</p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 stagger-children">
                {GAME_CARDS.map((g) => {
                    const a = ACCENT[g.key];
                    const Icon = g.icon;
                    return (
                        <button
                            key={g.key}
                            onClick={() => { onSelectGame(g.key); setStep('mode-select'); }}
                            className={`group relative w-full aspect-square sm:aspect-[4/3] rounded-2xl sm:rounded-3xl border border-slate-700/60 bg-linear-to-br from-slate-800/90 to-slate-900 overflow-hidden text-left p-4 sm:p-5 flex flex-col justify-end transition-all duration-300 hover:-translate-y-1.5 active:translate-y-0 active:scale-[0.98] hover:shadow-2xl ${a.cardHover}`}
                        >
                            <div className={`pointer-events-none absolute -top-12 -right-12 w-36 h-36 rounded-full blur-3xl opacity-20 group-hover:opacity-40 transition-opacity duration-500 ${a.glow}`} />
                            <Icon aria-hidden className={`pointer-events-none absolute -bottom-4 -right-4 w-24 h-24 sm:w-28 sm:h-28 opacity-[0.05] group-hover:opacity-10 group-hover:-rotate-6 transition-all duration-500 ${a.text}`} />
                            <RulesBadge game={g.key} onOpen={setRulesGameType} />
                            {g.badge && (
                                <div className={`absolute top-0 right-0 px-2 py-1.5 rounded-bl-2xl text-[8px] sm:text-[10px] font-black uppercase tracking-widest border-b border-l ${g.badgeClass}`}>
                                    {g.badge}
                                </div>
                            )}
                            <div className="relative">
                                <div className={`inline-flex p-2.5 sm:p-3 rounded-2xl mb-2.5 sm:mb-3 ${a.iconBg} group-hover:scale-110 transition-transform duration-300`}>
                                    <Icon className="w-6 h-6 sm:w-7 sm:h-7" />
                                </div>
                                <h3 className="font-display text-lg sm:text-2xl font-bold text-white">{g.name}</h3>
                                <p className="text-slate-400 text-[11px] sm:text-sm font-medium mt-0.5">{g.desc}</p>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );

    const renderModeSelect = () => (
        <div className="space-y-6 sm:space-y-8 anim-fade-up">
            <StepHeader
                onBack={() => setStep('game-select')}
                title="Select Mode"
                chip={accentChip(currentAccent)}
                right={selectedGame && (
                    <button
                        onClick={() => setRulesGameType(selectedGame)}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl border border-glass-border bg-glass hover:bg-white/10 text-slate-300 hover:text-white text-sm font-bold transition-all active:scale-95"
                    >
                        <BookOpen size={16} />
                        Kurallar
                    </button>
                )}
                dots={<StepDots current={2} activeClass={currentAccent.dotStrong} />}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 stagger-children">
                <button
                    onClick={() => setStep('difficulty-select')}
                    className={`group flex flex-col items-center justify-center gap-3 sm:gap-4 p-6 sm:p-8 rounded-2xl border border-slate-700/70 bg-slate-900/50 transition-all duration-300 hover:bg-slate-800/60 hover:-translate-y-1 hover:shadow-xl active:translate-y-0 active:scale-[0.98] ${currentAccent.modeHover}`}
                >
                    <div className={`p-4 rounded-2xl ${currentAccent.iconBg} group-hover:scale-110 transition-transform duration-300`}>
                        <Bot size={30} />
                    </div>
                    <div className="text-center">
                        <div className="font-display text-lg sm:text-xl font-bold text-white">Single Player</div>
                        <div className="text-xs sm:text-sm text-slate-500 mt-1">Vs Computer</div>
                    </div>
                </button>

                <button
                    onClick={() => {
                        if (selectedGame === 'okey') setStep('okey-name');
                        else if (selectedGame === '101') setStep('101-name');
                        else setStep('connection');
                    }}
                    className={`group flex flex-col items-center justify-center gap-3 sm:gap-4 p-6 sm:p-8 rounded-2xl border border-slate-700/70 bg-slate-900/50 transition-all duration-300 hover:bg-slate-800/60 hover:-translate-y-1 hover:shadow-xl active:translate-y-0 active:scale-[0.98] ${currentAccent.modeHover}`}
                >
                    <div className={`p-4 rounded-2xl ${currentAccent.iconBg} group-hover:scale-110 transition-transform duration-300`}>
                        <Users size={30} />
                    </div>
                    <div className="text-center">
                        <div className="font-display text-lg sm:text-xl font-bold text-white">Multiplayer</div>
                        <div className="text-xs sm:text-sm text-slate-500 mt-1">{(selectedGame === 'okey' || selectedGame === '101') ? '1-4 Players' : 'Online PvP'}</div>
                    </div>
                </button>
            </div>
        </div>
    );

    const renderDifficultySelect = () => (
        <div className="space-y-6 sm:space-y-8 anim-fade-up">
            <StepHeader
                onBack={() => setStep('mode-select')}
                title="Select Threat Level"
                chip={accentChip(currentAccent)}
                dots={<StepDots current={3} activeClass={currentAccent.dotStrong} />}
            />

            <div className="grid grid-cols-1 gap-3 stagger-children">
                {DIFFICULTIES.map((d) => {
                    const Icon = d.icon;
                    return (
                        <button
                            key={d.level}
                            onClick={() => onStartLocal(d.level)}
                            className={`group flex items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl border border-slate-700/70 bg-slate-900/50 transition-all duration-200 hover:bg-slate-800/70 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:scale-[0.99] ${d.hover}`}
                        >
                            <div className="flex items-center gap-4">
                                <div className={`p-3 rounded-xl ${d.iconCls} group-hover:scale-110 transition-transform duration-200`}>
                                    <Icon size={20} />
                                </div>
                                <div className="text-left">
                                    <div className="font-display text-lg font-bold text-white">{d.level}</div>
                                    <div className="text-xs text-slate-500">{d.desc}</div>
                                </div>
                            </div>
                            <ChevronRight size={18} className="text-slate-600 group-hover:text-white group-hover:translate-x-1 transition-all duration-200" />
                        </button>
                    );
                })}
            </div>
        </div>
    );

    const renderConnection = () => (
        <div className="space-y-6 anim-fade-up">
            <StepHeader
                onBack={() => setStep('mode-select')}
                title="Multiplayer"
                chip={accentChip(currentAccent)}
                dots={<StepDots current={3} activeClass={currentAccent.dotStrong} />}
            />

            <div className="space-y-6">
                <button
                    onClick={handleCreate}
                    disabled={isCreating || isAuthLoading}
                    className="w-full btn-premium flex items-center justify-center gap-3 text-lg group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isCreating || isAuthLoading ? (
                        <Spinner />
                    ) : (
                        <Plus size={22} className="transition-transform duration-300 group-hover:rotate-90" />
                    )}
                    <span>{isAuthLoading ? 'Initializing...' : (isCreating ? 'Creating Arena...' : 'Create New Room')}</span>
                </button>

                <OrDivider />

                <div className="flex gap-3">
                    <input
                        type="text"
                        placeholder="Enter Room ID"
                        value={roomIdInput}
                        onChange={(e) => setRoomIdInput(e.target.value)}
                        aria-label="Room ID"
                        className={`flex-1 min-w-0 bg-slate-950/50 border border-slate-700/60 rounded-xl px-4 py-3.5 font-mono text-lg tracking-wider placeholder:font-sans placeholder:tracking-normal placeholder:text-slate-600 focus:outline-none focus:ring-2 transition-all ${currentAccent.inputRing}`}
                    />
                    <button
                        onClick={() => onJoinRoom(roomIdInput)}
                        disabled={!roomIdInput.trim() || isAuthLoading}
                        aria-label="Odaya katıl"
                        className="btn-ghost flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        <LogIn size={22} />
                    </button>
                </div>
            </div>
        </div>
    );

    // Okey / 101 shared name-entry screen
    const renderNameEntry = (game: 'okey' | '101') => {
        const isOkey = game === 'okey';
        const a = ACCENT[game];
        const onCreate = isOkey ? handleCreateOkeyRoom : handleCreate101Room;
        const onJoin = isOkey ? handleJoinOkeyRoom : handleJoin101Room;

        return (
            <div className="space-y-6 anim-fade-up">
                <StepHeader
                    onBack={() => setStep('mode-select')}
                    title={isOkey ? 'Okey Multiplayer' : '101 Multiplayer'}
                    chip={accentChip(a)}
                    dots={<StepDots current={3} activeClass={a.dotStrong} />}
                />

                <div className="space-y-6">
                    {/* Name input */}
                    <div className="space-y-2">
                        <label htmlFor={`${game}-player-name`} className="flex items-center gap-1.5 text-sm font-medium text-slate-400">
                            <User size={14} />
                            Your Name
                        </label>
                        <input
                            id={`${game}-player-name`}
                            type="text"
                            placeholder="Enter your name..."
                            value={playerName}
                            onChange={(e) => setPlayerName(e.target.value)}
                            maxLength={20}
                            className={`w-full bg-slate-950/50 border border-slate-700/60 rounded-xl px-4 py-3.5 text-lg placeholder:text-slate-600 focus:outline-none focus:ring-2 transition-all ${a.inputRing}`}
                        />
                    </div>

                    {/* Create room button */}
                    <button
                        onClick={onCreate}
                        disabled={!playerName.trim() || isCreating || isAuthLoading}
                        className={`w-full flex items-center justify-center gap-3 text-lg py-4 rounded-xl text-white font-bold bg-linear-to-r transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${a.createBtn}`}
                    >
                        {isCreating ? <Spinner /> : <Plus size={24} />}
                        <span>{isCreating ? 'Creating Room...' : 'Create New Room'}</span>
                    </button>

                    <OrDivider />

                    {/* Join room */}
                    <div className="flex gap-3">
                        <input
                            type="text"
                            placeholder="Room ID"
                            value={joinRoomId}
                            onChange={(e) => setJoinRoomId(e.target.value.toUpperCase())}
                            maxLength={10}
                            aria-label="Room ID"
                            className={`flex-1 min-w-0 bg-slate-950/50 border border-slate-700/60 rounded-xl px-4 py-3.5 font-mono text-lg tracking-[0.25em] uppercase placeholder:font-sans placeholder:tracking-normal placeholder:normal-case placeholder:text-slate-600 focus:outline-none focus:ring-2 transition-all ${a.inputRing}`}
                        />
                        <button
                            onClick={onJoin}
                            disabled={!playerName.trim() || !joinRoomId.trim() || isJoining || isAuthLoading}
                            aria-label="Odaya katıl"
                            className="btn-ghost flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {isJoining ? <Spinner /> : <LogIn size={22} />}
                        </button>
                    </div>

                    <p className="text-xs text-slate-600 text-center">
                        Create a room and share the ID with friends. Empty slots will be filled with AI.
                    </p>
                </div>
            </div>
        );
    };

    // Okey / 101 shared waiting room
    const renderWaitingRoom = (game: 'okey' | '101') => {
        const isOkey = game === 'okey';
        const room: any = isOkey ? okeyRoom : room101;
        const userId = isOkey ? okeyUserId : user101Id;
        const isHost = isOkey ? isOkeyHost : is101Host;
        const onStart = isOkey ? onStartOkeyGame : onStart101Game;
        const onCopy = isOkey ? copyRoomId : copy101RoomId;
        const a = ACCENT[game];

        if (!room) {
            return (
                <div className="flex items-center justify-center py-20">
                    <div className={`w-8 h-8 border-2 rounded-full animate-spin ${a.spinner}`} />
                </div>
            );
        }

        const playerCount = room.players.filter((p: any) => p.odaUserId && !p.adIsAI).length;

        return (
            <div className="space-y-5 sm:space-y-6 anim-fade-up">
                <StepHeader
                    onBack={() => setStep(isOkey ? 'okey-name' : '101-name')}
                    title={isOkey ? 'Waiting Room' : '101 Waiting Room'}
                    chip={accentChip(a)}
                    dots={<StepDots current={3} activeClass={a.dotStrong} />}
                />

                {/* Room code */}
                <div className="glass-inset p-4 sm:p-5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                        <p className="text-[10px] text-slate-500 uppercase tracking-[0.25em] font-black">Room ID</p>
                        <p className={`font-display text-2xl sm:text-3xl font-bold tracking-[0.2em] truncate ${a.text}`}>{room.roomId}</p>
                    </div>
                    <button
                        onClick={onCopy}
                        aria-label="Oda kodunu kopyala"
                        className={`shrink-0 flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-sm font-bold transition-all active:scale-95 ${copied
                            ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                            : 'border-slate-700/80 bg-slate-800/60 text-slate-300 hover:text-white hover:border-slate-500'}`}
                    >
                        {copied ? <Check size={16} /> : <Copy size={16} />}
                        <span className="hidden sm:inline">{copied ? 'Copied!' : 'Copy'}</span>
                    </button>
                </div>

                {/* Players list */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <p className="flex items-center gap-2 text-sm font-bold text-slate-400">
                            <Users size={15} />
                            Players ({playerCount}/4)
                        </p>
                        <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                            <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${a.dotStrong}`} />
                            Waiting
                        </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 stagger-children">
                        {room.players.map((player: any, index: number) => {
                            const isCurrentUser = player.odaUserId === userId;
                            const isEmpty = !player.odaUserId;
                            const isPlayerHost = player.odaUserId === room.hostUserId;
                            const initial = isEmpty ? '' : String(player.adPlayerName || '?').charAt(0).toUpperCase();

                            return (
                                <div
                                    key={index}
                                    className={`p-3 sm:p-3.5 rounded-2xl border transition-all ${isEmpty
                                        ? 'bg-slate-900/30 border-slate-800 border-dashed'
                                        : isCurrentUser
                                            ? a.selfCard
                                            : 'bg-slate-800/50 border-slate-700/70'}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="relative shrink-0">
                                            {isEmpty ? (
                                                <div className="w-10 h-10 rounded-full border border-dashed border-slate-700 bg-slate-900/50 flex items-center justify-center text-slate-600">
                                                    <Bot size={17} />
                                                </div>
                                            ) : (
                                                <div className={`w-10 h-10 rounded-full border flex items-center justify-center font-display text-base font-bold ${isCurrentUser ? a.avatar : 'bg-slate-700/70 border-slate-600/60 text-slate-200'}`}>
                                                    {initial}
                                                </div>
                                            )}
                                            {isPlayerHost && !isEmpty && (
                                                <span className="absolute -top-1.5 -right-1.5 p-0.5 rounded-full bg-slate-900 border border-yellow-500/40" title="Host">
                                                    <Crown size={10} className="text-yellow-400" />
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`font-bold truncate text-sm ${isEmpty ? 'text-slate-600' : isCurrentUser ? a.text : 'text-white'}`}>
                                                {isEmpty ? 'Waiting...' : player.adPlayerName}
                                            </p>
                                            <p className="text-[11px] text-slate-500">
                                                {isPlayerHost ? 'Host' : isEmpty ? 'Will be AI' : `Seat ${index + 1}`}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Start game button (host only) */}
                {isHost ? (
                    <button
                        onClick={onStart}
                        className="w-full btn-premium flex items-center justify-center gap-3 text-lg"
                    >
                        <Play size={22} />
                        <span>Start Game</span>
                    </button>
                ) : (
                    <div className="flex justify-center py-2">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-glass-border bg-glass backdrop-blur-md text-sm text-slate-400">
                            <span className={`w-2 h-2 rounded-full animate-pulse ${a.dotStrong}`} />
                            Waiting for host to start...
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
        <div className="flex flex-col items-center justify-center min-h-[85vh] gap-8 lg:gap-10 relative px-4">
            {/* Hero */}
            <header className="text-center space-y-4 anim-fade-up">
                <h1 className="font-display text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold pb-2 text-gradient-brand">
                    DragMate
                </h1>
                <p className="text-slate-400 text-sm sm:text-base font-medium max-w-md mx-auto">
                    Premium multiplayer board gaming — Chess, Tavla, Okey &amp; 101.
                </p>
                <div className="flex justify-center pt-1">
                    <div className="glass-chip text-slate-300">
                        <span className={`w-2 h-2 rounded-full ${isSupported ? 'bg-emerald-400 animate-glow-pulse' : 'bg-slate-600'}`} />
                        {isSupported ? `${activeLoading ? '...' : (activeCount ?? 0).toLocaleString()} Online` : 'Demo Mode'}
                    </div>
                </div>
            </header>

            {/* Step panel */}
            <section className={`liquid-glass w-full p-5 sm:p-8 min-h-[420px] flex flex-col justify-center transition-all duration-500 ${step === 'game-select' ? 'max-w-2xl' : 'max-w-xl'}`}>
                {step === 'game-select' && renderGameSelect()}
                {step === 'mode-select' && renderModeSelect()}
                {step === 'difficulty-select' && renderDifficultySelect()}
                {step === 'connection' && renderConnection()}
                {step === 'okey-name' && renderNameEntry('okey')}
                {step === 'okey-waiting' && renderWaitingRoom('okey')}
                {step === '101-name' && renderNameEntry('101')}
                {step === '101-waiting' && renderWaitingRoom('101')}
            </section>

            <RulesModal gameType={rulesGameType} onClose={() => setRulesGameType(null)} />
        </div>
    );
};
