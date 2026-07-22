import React, { useState, useCallback } from 'react';
import type { Game101State, Meld, Tile101 } from '../../logic/101Logic';
import { OkeyTile } from '../OkeyBoard/OkeyTile';
import {
    ArrowUpNarrowWide,
    Bot,
    Check,
    CopyCheck,
    Crown,
    Layers,
    ListChecks,
    LogOut,
    PartyPopper,
    Trophy,
    User,
} from 'lucide-react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    useDroppable,
    useDraggable,
    DragOverlay,
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';

interface PlayerInfo {
    name: string;
    isAI: boolean;
    isYou: boolean;
}

const DEFAULT_PLAYER_INFO: PlayerInfo[] = [
    { name: 'Siz', isAI: false, isYou: true },
    { name: 'Bot 1', isAI: true, isYou: false },
    { name: 'Bot 2', isAI: true, isYou: false },
    { name: 'Bot 3', isAI: true, isYou: false },
];

interface Board101Props {
    gameState: Game101State | null;
    selectedTileIndices: number[];
    onToggleSelection: (index: number) => void;
    onClearSelection: () => void;
    onDraw: (index?: number) => void;
    onDrawDiscard: (index?: number) => void;
    onMoveTile: (fromIndex: number, toIndex: number) => void;
    onDiscard: (index: number) => void;
    onLayDownMeld: () => void;
    onAddToMeld: (tileIndex: number, meldId: string) => void;
    onSortByRuns: () => void;
    onSortByPairs: () => void;
    onSelectRuns: () => void;
    onSelectSets: () => void;
    onFinish?: (index: number) => void;
    onReset: () => void;
    onNewRound: () => void;
    onExit: () => void;
    playerInfo?: PlayerInfo[];
    mySlot?: number;
}

// Compact face-down opponent display: avatar, name, hidden tile backs + count, score, "Açıldı" badge
const OpponentPanel: React.FC<{
    playerInfo: PlayerInfo;
    isCurrentTurn: boolean;
    tileCount: number;
    score: number;
    hasLaidDown: boolean;
}> = React.memo(({ playerInfo, isCurrentTurn, tileCount, score, hasLaidDown }) => {
    return (
        <div className={`flex flex-col items-center gap-1.5 transition-transform duration-300 ${isCurrentTurn ? 'scale-105' : ''}`}>
            {/* Avatar */}
            <div className={`
                relative w-12 h-12 rounded-full bg-slate-900/70 backdrop-blur-sm border flex items-center justify-center
                transition-all duration-300
                ${isCurrentTurn
                    ? 'border-rose-400/80 shadow-[0_0_20px_rgba(251,113,133,0.55)]'
                    : 'border-white/10 shadow-lg'}
            `}>
                {playerInfo.isAI ? (
                    <Bot size={22} className={isCurrentTurn ? 'text-rose-300' : 'text-slate-300'} />
                ) : (
                    <User size={22} className={isCurrentTurn ? 'text-rose-300' : 'text-slate-300'} />
                )}
                {isCurrentTurn && (
                    <>
                        <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-rose-400 animate-ping" />
                        <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-rose-400 border border-rose-200/60" />
                    </>
                )}
            </div>

            {/* Name plate */}
            <div className={`
                px-2.5 py-0.5 rounded-full text-[10px] font-bold max-w-24 truncate transition-colors duration-300
                ${isCurrentTurn
                    ? 'bg-rose-500/20 text-rose-100 border border-rose-400/40'
                    : 'bg-black/30 text-emerald-50/90 border border-white/10'}
            `}>
                {playerInfo.name}
            </div>

            {/* Face-down tiles + count */}
            <div className="flex items-center gap-1.5">
                <div className="flex -space-x-1.5">
                    {[0, 1, 2].map(i => (
                        <div
                            key={i}
                            className="tile-back w-3.5 h-5 rounded-[3px] border border-black/30"
                            style={{ transform: `rotate(${(i - 1) * 7}deg)` }}
                        />
                    ))}
                </div>
                <span className="font-display text-xs font-bold tabular-nums text-emerald-100/90">{tileCount}</span>
            </div>

            {/* Score + laid-down badge */}
            <div className="flex items-center gap-1">
                <span className={`
                    px-1.5 py-0.5 rounded-md font-display text-[10px] font-bold tabular-nums border
                    ${score >= 80
                        ? 'bg-red-500/20 text-red-300 border-red-400/40'
                        : 'bg-black/30 text-slate-200 border-white/10'}
                `}>
                    {score}
                </span>
                {hasLaidDown && (
                    <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[8px] font-black uppercase tracking-wider anim-pop-in">
                        Açıldı
                    </span>
                )}
            </div>
        </div>
    );
});

// Discard Zone Component (like Okey)
const DiscardZone101: React.FC<{
    playerId: number;
    discardPile: Tile101[];
    currentTurn: number;
    userTileCount: number;
    mySlot: number;
    isDraggingRackTile: boolean;
    onDrawDiscard: () => void;
}> = React.memo(({ playerId, discardPile, currentTurn, userTileCount, mySlot, isDraggingRackTile, onDrawDiscard }) => {
    // Can drop to own discard when it's your turn and you have 15 tiles
    const canDropHere = playerId === mySlot && currentTurn === mySlot && userTileCount === 15 && isDraggingRackTile;

    // Can draw from previous player's discard (counter-clockwise)
    const prevPlayerIdx = (mySlot + 3) % 4;
    const canDrawHere = playerId === prevPlayerIdx && currentTurn === mySlot && userTileCount === 14 && discardPile.length > 0;

    const { setNodeRef, isOver } = useDroppable({
        id: `discard-${playerId}`
    });

    const { attributes, listeners, setNodeRef: setDraggableRef, isDragging } = useDraggable({
        id: `pick-discard-${playerId}`,
        disabled: !canDrawHere || discardPile.length === 0
    });

    const lastTile = discardPile.length > 0 ? discardPile[discardPile.length - 1] : null;

    // Show drop feedback when dragging over own discard zone
    const showDropFeedback = isOver && playerId === mySlot && isDraggingRackTile;

    return (
        <div
            ref={setNodeRef}
            onClick={() => canDrawHere && onDrawDiscard()}
            className={`
                w-16 h-24 rounded-xl border-2 transition-all duration-200 flex items-center justify-center relative
                ${showDropFeedback
                    ? 'bg-rose-400/25 border-rose-300 ring-4 ring-rose-400/70 scale-110 shadow-[0_0_28px_rgba(251,113,133,0.5)]'
                    : canDropHere
                        ? 'bg-rose-500/10 border-rose-400/60 ring-2 ring-rose-400/40'
                        : canDrawHere
                            ? 'bg-rose-400/10 border-rose-400/70 cursor-grab active:cursor-grabbing hover:ring-2 hover:ring-rose-400 animate-glow-pulse'
                            : 'bg-black/20 border-white/10'}
            `}
        >
            {lastTile ? (
                <div
                    ref={setDraggableRef}
                    {...attributes}
                    {...listeners}
                    className={`rotate-2 transition-transform ${canDrawHere && !isDragging ? 'hover:scale-105' : ''} ${isDragging ? 'opacity-20' : ''}`}
                >
                    <OkeyTile tile={lastTile} okeyTile={null} size="sm" />
                </div>
            ) : (
                <div className="w-12 h-16 border-2 border-white/10 border-dashed rounded-lg flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-white/10" />
                </div>
            )}

            {canDropHere && (
                <div className="absolute -inset-1 border-2 border-dashed border-rose-400 rounded-xl animate-pulse pointer-events-none">
                    <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[8px] font-black text-white uppercase tracking-wider whitespace-nowrap bg-rose-500/90 px-2 py-0.5 rounded-full shadow-lg shadow-rose-500/30">
                        BURAYA AT
                    </div>
                </div>
            )}

            {canDrawHere && lastTile && !isDragging && (
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-rose-500 text-white text-[8px] font-black px-2.5 py-1 rounded-full animate-bounce whitespace-nowrap z-50 shadow-lg shadow-rose-500/40">
                    ÇEK
                </div>
            )}

            {discardPile.length > 1 && (
                <div className="absolute -bottom-2 -right-2 min-w-5 h-5 px-1 rounded-full bg-slate-950/90 border border-white/20 text-slate-200 font-display text-[9px] font-bold tabular-nums flex items-center justify-center shadow">
                    {discardPile.length}
                </div>
            )}
        </div>
    );
});

// Rack Slot for 101
interface RackSlot101Props {
    tile: Tile101 | null;
    index: number;
    isSelected: boolean;
    onTileClick: () => void;
    okeyTile?: Tile101 | null;
}

const RackSlot101: React.FC<RackSlot101Props> = React.memo(({ tile, index, isSelected, onTileClick, okeyTile }) => {
    const slotId = `rack-${index}`;
    const { setNodeRef: setDroppableRef, isOver } = useDroppable({ id: slotId });
    const {
        attributes,
        listeners,
        setNodeRef: setDraggableRef,
        isDragging,
    } = useDraggable({
        id: slotId,
        disabled: !tile
    });

    // Check if tile is a joker
    const isJoker = tile?.isFakeOkey;

    return (
        <div
            ref={setDroppableRef}
            onClick={tile ? onTileClick : undefined}
            className={`
                relative w-[52px] h-[70px] flex items-center justify-center
                ${tile ? 'cursor-pointer' : ''}
                ${isOver ? 'scale-110 z-10' : ''}
                transition-all duration-150
            `}
        >
            {isOver && (
                <div className="absolute inset-0 rounded-lg ring-2 ring-rose-400/70 bg-rose-400/10 pointer-events-none" />
            )}
            {tile ? (
                <div
                    ref={setDraggableRef}
                    {...attributes}
                    {...listeners}
                    className={`
                        relative w-full h-full transition-all duration-150
                        ${isDragging ? 'opacity-30' : ''}
                        ${isSelected ? '-translate-y-2' : ''}
                    `}
                >
                    <div className={`w-full h-full rounded-lg ${isSelected ? 'ring-2 ring-rose-400 shadow-[0_0_16px_rgba(251,113,133,0.6)]' : ''}`}>
                        <OkeyTile tile={tile} okeyTile={okeyTile} size="md" isJoker={isJoker} />
                    </div>
                    {isSelected && !isDragging && (
                        <span className="absolute -top-2 -right-1.5 z-20 w-4 h-4 rounded-full bg-rose-500 border border-white/70 flex items-center justify-center shadow-md anim-pop-in pointer-events-none">
                            <Check size={10} strokeWidth={4} className="text-white" />
                        </span>
                    )}
                </div>
            ) : (
                <div className="w-full h-full rounded-lg bg-black/20 border border-black/25 shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)]" />
            )}
        </div>
    );
});

// Player Rack for 101 - Wooden two-shelf rack
interface PlayerRack101Props {
    tiles: (Tile101 | null)[];
    selectedIndices: number[];
    onTileClick: (index: number) => void;
    okeyTile?: Tile101 | null;
}

const PlayerRack101: React.FC<PlayerRack101Props> = React.memo(({ tiles, selectedIndices, onTileClick, okeyTile }) => {
    const topRow = tiles.slice(0, 15);
    const bottomRow = tiles.slice(15, 30);

    const renderShelf = (row: (Tile101 | null)[], offset: number) => (
        <div className="flex gap-0.5 justify-center rounded-lg bg-black/25 px-1.5 py-1 shadow-[inset_0_2px_8px_rgba(0,0,0,0.5),0_1px_0_rgba(255,255,255,0.08)]">
            {row.map((tile, idx) => (
                <RackSlot101
                    key={idx + offset}
                    tile={tile}
                    index={idx + offset}
                    isSelected={selectedIndices.includes(idx + offset)}
                    onTileClick={() => onTileClick(idx + offset)}
                    okeyTile={okeyTile}
                />
            ))}
        </div>
    );

    return (
        <div className="relative wood-surface rounded-2xl p-2 sm:p-2.5 shadow-glass-lg">
            {/* Rack lip highlight (top) */}
            <div className="absolute inset-x-0 top-0 h-1.5 rounded-t-2xl bg-white/10 pointer-events-none" />

            {/* Two shelves */}
            <div className="flex flex-col gap-1.5">
                {renderShelf(topRow, 0)}
                {renderShelf(bottomRow, 15)}
            </div>

            {/* Rack base shadow (bottom) */}
            <div className="absolute inset-x-0 bottom-0 h-1.5 rounded-b-2xl bg-black/30 pointer-events-none" />
        </div>
    );
});

// Center Board with quadrants
const CenterBoard: React.FC<{
    melds: Meld[];
    playerInfo: PlayerInfo[];
    mySlot: number;
    isDraggingRackTile: boolean;
    playerHasLaidDown: boolean;
    getActualSlot: (displayPos: number) => number;
}> = React.memo(({ melds, playerInfo, mySlot, isDraggingRackTile, playerHasLaidDown, getActualSlot }) => {
    const getMeldsForPlayer = (playerIdx: number) => {
        return melds.filter(m => m.ownerPlayer === playerIdx);
    };

    const renderQuadrant = (slot: number, borders: string) => (
        <div className={`relative p-1.5 sm:p-2 ${borders}`}>
            <div className="flex flex-wrap gap-2 content-start overflow-y-auto h-full pt-3 pr-1">
                {getMeldsForPlayer(slot).map(meld => (
                    <MeldDisplay
                        key={meld.id}
                        meld={meld}
                        ownerName={playerInfo[slot]?.name}
                        isDraggingRackTile={isDraggingRackTile}
                        playerHasLaidDown={playerHasLaidDown}
                    />
                ))}
            </div>
        </div>
    );

    return (
        <div className="relative w-full h-full rounded-2xl border border-white/10 bg-black/15 shadow-[inset_0_2px_20px_rgba(0,0,0,0.4)] overflow-hidden">
            {/* Subtle grid pattern */}
            <div className="absolute inset-0 opacity-[0.06]" style={{
                backgroundImage: 'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
                backgroundSize: '28px 28px'
            }} />

            {melds.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-emerald-100/30 text-[10px] sm:text-xs font-bold uppercase tracking-[0.25em] text-center px-4">
                        Açılan perler burada görünür
                    </span>
                </div>
            )}

            {/* 2x2 Grid */}
            <div className="absolute inset-0 grid grid-cols-2 grid-rows-2">
                {renderQuadrant(getActualSlot(3), 'border-r border-b border-white/5')}
                {renderQuadrant(getActualSlot(2), 'border-b border-white/5')}
                {renderQuadrant(mySlot, 'border-r border-white/5')}
                {renderQuadrant(getActualSlot(1), '')}
            </div>
        </div>
    );
});

// Single meld display — a soft shadow "tray" with owner tag
const MeldDisplay: React.FC<{
    meld: Meld;
    ownerName?: string;
    isDraggingRackTile: boolean;
    playerHasLaidDown: boolean;
}> = React.memo(({ meld, ownerName, isDraggingRackTile, playerHasLaidDown }) => {
    const { setNodeRef, isOver } = useDroppable({
        id: `meld-${meld.id}`,
        data: { type: 'meld', meldId: meld.id },
        disabled: !playerHasLaidDown
    });

    const canReceive = isDraggingRackTile && playerHasLaidDown;

    return (
        <div
            ref={setNodeRef}
            className={`
                relative flex gap-1 px-2 pt-2.5 pb-1.5 rounded-xl transition-all duration-200 anim-pop-in
                bg-black/25 shadow-[inset_0_2px_8px_rgba(0,0,0,0.4),0_1px_0_rgba(255,255,255,0.06)]
                ${isOver && isDraggingRackTile
                    ? 'ring-2 ring-rose-400 bg-rose-400/20 scale-105 shadow-[0_0_20px_rgba(251,113,133,0.45)]'
                    : canReceive
                        ? 'ring-1 ring-rose-400/50'
                        : ''}
            `}
        >
            {meld.tiles.map((tile, idx) => (
                <div key={`${meld.id}-${idx}`} className="w-10 h-13">
                    <OkeyTile tile={tile} okeyTile={null} size="sm" isJoker={tile.isFakeOkey} />
                </div>
            ))}
            {ownerName && (
                <span className="absolute -top-2 left-2 px-1.5 py-px rounded-full bg-slate-950/90 border border-white/15 text-[8px] font-bold uppercase tracking-wider text-emerald-100/80 whitespace-nowrap max-w-[90%] truncate">
                    {ownerName}
                </span>
            )}
        </div>
    );
});

// Score Table Component
const ScoreTable: React.FC<{
    players: { name: string; score: number; isAI: boolean; isYou: boolean }[];
    currentTurn: number;
}> = React.memo(({ players, currentTurn }) => {
    const sorted = [...players].map((p, idx) => ({ ...p, originalIndex: idx })).sort((a, b) => a.score - b.score);

    return (
        <div className="w-full rounded-2xl overflow-hidden border border-white/10 bg-slate-950/60 backdrop-blur-md shadow-glass">
            <div className="px-3 py-2 text-center bg-white/5 border-b border-white/10">
                <span className="font-display text-white font-bold text-[11px] tracking-[0.25em]">SKOR</span>
            </div>
            <div className="px-2 py-1 text-center border-b border-white/10 bg-rose-500/10">
                <span className="text-rose-300 text-[9px] font-bold">101 = Kaybet!</span>
            </div>
            <div className="divide-y divide-white/5">
                {sorted.map((player, idx) => (
                    <div
                        key={player.originalIndex}
                        className={`
                            flex items-center justify-between gap-2 px-2.5 py-1.5 transition-colors
                            ${currentTurn === player.originalIndex ? 'bg-rose-500/10' : ''}
                        `}
                    >
                        <div className="flex items-center gap-1.5 min-w-0">
                            {idx === 0 ? (
                                <Crown size={12} className="text-amber-400 shrink-0" />
                            ) : (
                                <span className="w-3 text-center text-[9px] font-bold text-slate-500 shrink-0">{idx + 1}</span>
                            )}
                            <span className={`text-[11px] font-bold truncate ${player.isYou ? 'text-rose-300' : 'text-slate-200'}`}>
                                {player.name}
                            </span>
                        </div>
                        <span className={`
                            font-display tabular-nums text-[11px] font-bold px-1.5 py-0.5 rounded-md shrink-0
                            ${player.score >= 80 ? 'bg-red-500/20 text-red-300 animate-pulse' : player.score >= 50 ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'}
                        `}>
                            {player.score}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
});

// Draw Pile Component — stacked tile backs
const DrawPile101: React.FC<{
    count: number;
    currentTurn: number;
    userTileCount: number;
    mySlot: number;
    onDraw: () => void;
}> = React.memo(({ count, currentTurn, userTileCount, mySlot, onDraw }) => {
    const canDraw = currentTurn === mySlot && userTileCount < 15;

    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: 'draw-pile',
        disabled: !canDraw
    });

    return (
        <div className="relative">
            {/* Stack layers behind */}
            <div className="absolute inset-0 tile-back rounded-lg translate-x-[5px] translate-y-[5px] opacity-70" />
            <div className="absolute inset-0 tile-back rounded-lg translate-x-[2.5px] translate-y-[2.5px] opacity-85" />

            <div
                ref={setNodeRef}
                {...attributes}
                {...listeners}
                onClick={() => canDraw && onDraw()}
                className={`
                    relative w-16 h-24 tile-back rounded-lg flex items-center justify-center transition-all duration-200 cursor-pointer
                    ${canDraw ? 'hover:scale-105 hover:-translate-y-1 ring-2 ring-rose-400/90 shadow-[0_0_24px_rgba(244,63,94,0.45)]' : 'opacity-80'}
                    ${isDragging ? 'opacity-30' : ''}
                `}
            >
                {/* Back motif */}
                <div className="w-8 h-8 rounded-full border-2 border-white/20 flex items-center justify-center">
                    <div className="w-3 h-3 rounded-full bg-white/25" />
                </div>

                <div className="absolute -top-2 -right-2 min-w-6 h-6 px-1.5 rounded-full bg-slate-950/90 border border-white/20 text-white font-display text-[11px] font-bold tabular-nums flex items-center justify-center shadow-lg">
                    {count}
                </div>

                {canDraw && !isDragging && (
                    <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 bg-rose-500 text-white text-[8px] font-black px-2.5 py-1 rounded-full animate-bounce whitespace-nowrap shadow-lg shadow-rose-500/40">
                        TAŞ ÇEK
                    </div>
                )}
            </div>
        </div>
    );
});

// Score Badge
const ScoreBadge: React.FC<{ score: number }> = ({ score }) => (
    <div className={`
        flex flex-col items-center px-4 py-1.5 rounded-xl border shadow-lg
        ${score >= 80
            ? 'bg-red-500/15 border-red-400/50 text-red-300'
            : score >= 50
                ? 'bg-amber-500/15 border-amber-400/50 text-amber-300'
                : 'bg-emerald-500/15 border-emerald-400/50 text-emerald-300'}
    `}>
        <span className="text-[8px] font-black uppercase tracking-widest opacity-70">Puan</span>
        <span className="font-display text-xl font-bold tabular-nums leading-none">{score}</span>
    </div>
);

// Segmented toolbar button
const ToolbarButton: React.FC<{
    onClick: () => void;
    title: string;
    label: string;
    icon: React.ReactNode;
}> = ({ onClick, title, label, icon }) => (
    <button
        onClick={onClick}
        title={title}
        aria-label={title}
        className="flex items-center gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-lg text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-300 transition-all duration-150 hover:bg-rose-500/15 hover:text-rose-200 active:scale-95"
    >
        {icon}
        <span>{label}</span>
    </button>
);

export const Board101: React.FC<Board101Props> = React.memo(({
    gameState,
    selectedTileIndices,
    onToggleSelection,
    onClearSelection,
    onDraw,
    onDrawDiscard,
    onMoveTile,
    onDiscard,
    onLayDownMeld,
    onAddToMeld,
    onSortByRuns,
    onSortByPairs,
    onSelectRuns,
    onSelectSets,
    onReset,
    onNewRound,
    onExit,
    playerInfo = DEFAULT_PLAYER_INFO,
    mySlot = 0
}) => {
    const [activeId, setActiveId] = useState<string | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 3 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleDragStart = useCallback((event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    }, []);

    const handleDragEnd = useCallback((event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (!over) return;

        const draggingId = active.id as string;
        const dropId = over.id as string;

        // Discard to own pile (check if dropping on any discard zone with own slot)
        if (dropId.startsWith('discard-') && draggingId.startsWith('rack-')) {
            const discardSlot = parseInt(dropId.replace('discard-', ''));
            if (discardSlot === mySlot) {
                onDiscard(parseInt(draggingId.split('-')[1]));
            }
            return;
        }
        // Draw from center stack
        if (draggingId === 'draw-pile' && dropId.startsWith('rack-')) {
            onDraw(parseInt(dropId.split('-')[1]));
            return;
        }
        // Draw from previous player's discard
        if (draggingId.startsWith('pick-discard-') && dropId.startsWith('rack-')) {
            onDrawDiscard(parseInt(dropId.split('-')[1]));
            return;
        }
        // Add to meld
        if (draggingId.startsWith('rack-') && dropId.startsWith('meld-')) {
            onAddToMeld(parseInt(draggingId.split('-')[1]), dropId.replace('meld-', ''));
            return;
        }
        // Move within rack
        if (draggingId !== dropId && draggingId.startsWith('rack-') && dropId.startsWith('rack-')) {
            onMoveTile(parseInt(draggingId.split('-')[1]), parseInt(dropId.split('-')[1]));
            return;
        }
    }, [mySlot, onDiscard, onDraw, onDrawDiscard, onAddToMeld, onMoveTile]);

    if (!gameState) {
        return (
            <div className="flex items-center justify-center p-16">
                <div className="liquid-glass px-8 py-6 flex items-center gap-3 anim-pop-in">
                    <div className="w-5 h-5 rounded-full border-2 border-rose-400/25 border-t-rose-400 animate-spin" />
                    <span className="font-display font-bold tracking-wider text-slate-200">YÜKLENİYOR...</span>
                </div>
            </div>
        );
    }

    const userTiles = gameState.players[mySlot]?.tiles || [];
    const userTileCount = userTiles.filter(t => t !== null).length;
    const currentPlayer = gameState.players[mySlot];
    const tableMelds = Object.values(gameState.tableMelds || {}) as Meld[];
    const isDraggingRackTile = activeId?.startsWith('rack-') || false;
    const isMyTurn = gameState.currentTurn === mySlot;

    const getTileCount = (playerIdx: number) => {
        return gameState.players[playerIdx]?.tiles.filter(t => t !== null).length || 0;
    };

    const getActualSlot = (displayPosition: number): number => {
        return (displayPosition + mySlot) % 4;
    };

    const renderDragOverlay = () => {
        if (!activeId) return null;
        if (activeId === 'draw-pile') return <div className="w-16 h-24 tile-back rounded-lg opacity-90" />;
        if (activeId.startsWith('pick-discard-')) {
            const playerIdx = parseInt(activeId.replace('pick-discard-', ''));
            const pile = gameState.discardPiles[playerIdx];
            const topTile = pile && pile.length > 0 ? pile[pile.length - 1] : null;
            return topTile ? <OkeyTile tile={topTile} size="sm" okeyTile={null} /> : null;
        }
        if (activeId.startsWith('rack-')) {
            const tile = userTiles[parseInt(activeId.split('-')[1])];
            return tile ? <OkeyTile tile={tile} okeyTile={null} size="md" isJoker={tile.isFakeOkey} /> : null;
        }
        return null;
    };

    // Round/Game Over Screen
    if (gameState.phase === 'roundOver' || gameState.phase === 'gameOver') {
        const winner = gameState.roundWinner !== null ? playerInfo[gameState.roundWinner] : null;
        const isGameOver = gameState.phase === 'gameOver';
        const standings = gameState.players
            .map((p, idx) => ({ score: p.score, idx }))
            .sort((a, b) => a.score - b.score);

        return (
            <div className="relative w-full max-w-[1400px] mx-auto wood-surface rounded-[2rem] p-1.5 sm:p-2.5 shadow-glass-lg anim-fade-up">
                <div className="relative felt-surface rounded-[1.5rem] sm:rounded-[1.7rem] overflow-hidden min-h-[600px] flex flex-col items-center justify-center gap-5 sm:gap-6 p-6 sm:p-10">
                    {gameState.roundWinner === mySlot && (
                        <div className="absolute inset-0 overflow-hidden pointer-events-none">
                            {[...Array(30)].map((_, i) => {
                                // Deterministic per-index jitter (render must stay pure).
                                const r = (n: number) => {
                                    const x = Math.sin((i + 1) * 12.9898 + n * 78.233) * 43758.5453;
                                    return x - Math.floor(x);
                                };
                                return (
                                    <div
                                        key={i}
                                        className="absolute w-3 h-3 rounded-sm animate-bounce"
                                        style={{
                                            left: `${r(1) * 100}%`,
                                            top: `-${r(2) * 20}%`,
                                            backgroundColor: ['#fb7185', '#fda4af', '#fbbf24', '#34d399', '#60a5fa', '#c084fc'][i % 6],
                                            animationDelay: `${r(3) * 2}s`,
                                            animationDuration: `${2 + r(4) * 2}s`,
                                        }}
                                    />
                                );
                            })}
                        </div>
                    )}

                    <div className={`
                        anim-pop-in w-20 h-20 rounded-full flex items-center justify-center border
                        ${isGameOver
                            ? 'bg-amber-500/15 border-amber-400/40 shadow-[0_0_40px_-8px_rgba(251,191,36,0.6)]'
                            : 'bg-rose-500/15 border-rose-400/40 shadow-[0_0_40px_-8px_rgba(244,63,94,0.6)]'}
                    `}>
                        {isGameOver ? (
                            <Trophy size={36} className="text-amber-300" />
                        ) : (
                            <PartyPopper size={36} className="text-rose-300" />
                        )}
                    </div>

                    <h2 className="font-display text-3xl sm:text-4xl font-bold text-gradient anim-fade-up">
                        {isGameOver ? 'OYUN BİTTİ!' : 'EL BİTTİ!'}
                    </h2>
                    {winner && (
                        <p className="text-base sm:text-lg text-slate-300">
                            {isGameOver ? 'Kazanan' : 'Bu eli kazanan'}: <span className="font-display font-bold text-rose-300">{winner.name}</span>
                        </p>
                    )}

                    {/* Score table */}
                    <div className="w-full max-w-sm rounded-2xl overflow-hidden border border-white/10 bg-slate-950/60 backdrop-blur-md shadow-glass anim-fade-up">
                        <div className="px-4 py-2.5 bg-white/5 border-b border-white/10 text-center">
                            <span className="font-display text-[11px] font-bold tracking-[0.25em] text-slate-300 uppercase">Skor Tablosu</span>
                        </div>
                        <div className="divide-y divide-white/5 stagger-children">
                            {standings.map(({ score, idx }, rank) => {
                                const info = playerInfo[idx];
                                const isWinner = gameState.roundWinner === idx;
                                return (
                                    <div key={idx} className={`flex items-center justify-between gap-3 px-4 py-2.5 ${isWinner ? 'bg-rose-500/15' : ''}`}>
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            {rank === 0 ? (
                                                <Crown size={14} className="text-amber-400 shrink-0" />
                                            ) : (
                                                <span className="w-3.5 text-center text-[10px] font-bold text-slate-500 shrink-0">{rank + 1}</span>
                                            )}
                                            <span className={`text-sm font-bold truncate ${isWinner ? 'text-rose-200' : info?.isYou ? 'text-slate-100' : 'text-slate-300'}`}>
                                                {info?.name}{info?.isYou ? ' (Sen)' : ''}
                                            </span>
                                            {isWinner && (
                                                <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-rose-500/25 border border-rose-400/40 text-rose-200 text-[9px] font-black uppercase tracking-wider">
                                                    Kazanan
                                                </span>
                                            )}
                                        </div>
                                        <span className={`font-display tabular-nums text-lg font-bold shrink-0 ${score >= 80 ? 'text-red-400' : score >= 50 ? 'text-amber-300' : 'text-emerald-300'}`}>
                                            {score}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="flex flex-wrap justify-center gap-3 mt-2 anim-fade-up">
                        {!isGameOver && (
                            <button onClick={onNewRound} className="btn-premium">
                                Yeni El
                            </button>
                        )}
                        <button onClick={onReset} className="btn-ghost">
                            Yeni Oyun
                        </button>
                        <button onClick={onExit} className="btn-danger">
                            Çıkış
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Prepare players with scores for score table
    const playersWithScores = playerInfo.map((p, idx) => ({
        ...p,
        score: gameState.players[idx]?.score || 0
    }));

    return (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="relative w-full max-w-[1400px] mx-auto wood-surface rounded-[2rem] p-1.5 sm:p-2.5 shadow-glass-lg anim-fade-up">
                <div className="relative felt-surface rounded-[1.5rem] sm:rounded-[1.7rem] overflow-hidden">
                    {/* Main game area */}
                    <div className="relative flex">
                        {/* Left side - Opponent and discard */}
                        <div className="w-20 sm:w-28 flex flex-col items-center justify-center gap-3 py-6 shrink-0">
                            <OpponentPanel
                                playerInfo={playerInfo[getActualSlot(3)] || DEFAULT_PLAYER_INFO[3]}
                                isCurrentTurn={gameState.currentTurn === getActualSlot(3)}
                                tileCount={getTileCount(getActualSlot(3))}
                                score={gameState.players[getActualSlot(3)]?.score || 0}
                                hasLaidDown={gameState.players[getActualSlot(3)]?.hasLaidDown || false}
                            />
                            <DiscardZone101
                                playerId={getActualSlot(3)}
                                discardPile={gameState.discardPiles[getActualSlot(3)] || []}
                                currentTurn={gameState.currentTurn}
                                userTileCount={userTileCount}
                                mySlot={mySlot}
                                isDraggingRackTile={isDraggingRackTile}
                                onDrawDiscard={onDrawDiscard}
                            />
                        </div>

                        {/* Center area */}
                        <div className="flex-1 flex flex-col min-w-0">
                            {/* Top area - opponent avatar/discard + gösterge + draw pile */}
                            <div className="flex flex-wrap justify-center items-center gap-3 sm:gap-6 px-2 pt-4 pb-3">
                                <OpponentPanel
                                    playerInfo={playerInfo[getActualSlot(2)] || DEFAULT_PLAYER_INFO[2]}
                                    isCurrentTurn={gameState.currentTurn === getActualSlot(2)}
                                    tileCount={getTileCount(getActualSlot(2))}
                                    score={gameState.players[getActualSlot(2)]?.score || 0}
                                    hasLaidDown={gameState.players[getActualSlot(2)]?.hasLaidDown || false}
                                />
                                <DiscardZone101
                                    playerId={getActualSlot(2)}
                                    discardPile={gameState.discardPiles[getActualSlot(2)] || []}
                                    currentTurn={gameState.currentTurn}
                                    userTileCount={userTileCount}
                                    mySlot={mySlot}
                                    isDraggingRackTile={isDraggingRackTile}
                                    onDrawDiscard={onDrawDiscard}
                                />
                                <div className="w-px h-16 bg-white/10 mx-1 hidden sm:block" />
                                {gameState.indicatorTile && (
                                    <div className="flex flex-col items-center gap-1.5">
                                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-rose-200/80">Gösterge</span>
                                        <div className="rounded-xl border border-rose-300/30 bg-black/25 p-1.5 shadow-[inset_0_2px_8px_rgba(0,0,0,0.45)]">
                                            <OkeyTile tile={gameState.indicatorTile} okeyTile={null} size="sm" />
                                        </div>
                                    </div>
                                )}
                                <div className="flex flex-col items-center gap-1.5">
                                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-rose-200/80">Deste</span>
                                    <DrawPile101
                                        count={gameState.centerStack.length}
                                        currentTurn={gameState.currentTurn}
                                        userTileCount={userTileCount}
                                        mySlot={mySlot}
                                        onDraw={() => onDraw()}
                                    />
                                </div>
                            </div>

                            {/* Center board with meld zones */}
                            <div className="flex-1 px-2 sm:px-4 pb-2">
                                <div className="h-[240px] sm:h-[300px]">
                                    <CenterBoard
                                        melds={tableMelds}
                                        playerInfo={playerInfo}
                                        mySlot={mySlot}
                                        isDraggingRackTile={isDraggingRackTile}
                                        playerHasLaidDown={currentPlayer?.hasLaidDown || false}
                                        getActualSlot={getActualSlot}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Right side - Opponent and discard */}
                        <div className="w-20 sm:w-28 flex flex-col items-center justify-center gap-3 py-6 shrink-0">
                            <OpponentPanel
                                playerInfo={playerInfo[getActualSlot(1)] || DEFAULT_PLAYER_INFO[1]}
                                isCurrentTurn={gameState.currentTurn === getActualSlot(1)}
                                tileCount={getTileCount(getActualSlot(1))}
                                score={gameState.players[getActualSlot(1)]?.score || 0}
                                hasLaidDown={gameState.players[getActualSlot(1)]?.hasLaidDown || false}
                            />
                            <DiscardZone101
                                playerId={getActualSlot(1)}
                                discardPile={gameState.discardPiles[getActualSlot(1)] || []}
                                currentTurn={gameState.currentTurn}
                                userTileCount={userTileCount}
                                mySlot={mySlot}
                                isDraggingRackTile={isDraggingRackTile}
                                onDrawDiscard={onDrawDiscard}
                            />
                        </div>

                        {/* Far right - Scoreboard (desktop) */}
                        <div className="hidden md:flex w-[150px] flex-col items-center justify-center gap-3 p-3 bg-black/20 border-l border-white/5 shrink-0">
                            <ScoreTable players={playersWithScores} currentTurn={gameState.currentTurn} />
                        </div>
                    </div>

                    {/* Bottom area - Your discard, toolbar and rack */}
                    <div className="px-2 sm:px-4 pb-4 pt-1 flex flex-col items-center gap-3">
                        {/* Turn banner */}
                        <div className={`
                            flex items-center gap-2 px-5 sm:px-6 py-2 rounded-full text-xs sm:text-sm font-black uppercase tracking-wider transition-all duration-300
                            ${isMyTurn
                                ? 'bg-rose-500/15 text-rose-200 border border-rose-400/50 shadow-[0_0_24px_-6px_rgba(244,63,94,0.6)]'
                                : 'chip-turn-waiting'}
                        `}>
                            {isMyTurn ? (
                                <>
                                    <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
                                    SIRA SENDE
                                </>
                            ) : (
                                `${playerInfo[gameState.currentTurn]?.name || 'Rakip'} oynuyor...`
                            )}
                        </div>

                        {/* Your discard zone, toolbar and controls */}
                        <div className="flex flex-wrap items-center justify-center gap-3">
                            <DiscardZone101
                                playerId={mySlot}
                                discardPile={gameState.discardPiles[mySlot] || []}
                                currentTurn={gameState.currentTurn}
                                userTileCount={userTileCount}
                                mySlot={mySlot}
                                isDraggingRackTile={isDraggingRackTile}
                                onDrawDiscard={onDrawDiscard}
                            />

                            {/* Segmented sort/select toolbar */}
                            <div className="flex items-center rounded-xl border border-white/10 bg-slate-950/70 backdrop-blur-md p-1 shadow-lg">
                                <ToolbarButton
                                    onClick={onSortByRuns}
                                    title="Serilere göre diz (aynı renk, ardışık sayılar)"
                                    label="Seri"
                                    icon={<ArrowUpNarrowWide size={14} />}
                                />
                                <ToolbarButton
                                    onClick={onSortByPairs}
                                    title="Çiftlere göre diz (aynı renk, aynı sayı gerçek çiftler)"
                                    label="Çift"
                                    icon={<Layers size={14} />}
                                />
                                <div className="w-px h-5 bg-white/10 mx-1" />
                                <ToolbarButton
                                    onClick={onSelectRuns}
                                    title="Tüm serileri seç"
                                    label="Seri Aç"
                                    icon={<ListChecks size={14} />}
                                />
                                <ToolbarButton
                                    onClick={onSelectSets}
                                    title="Tüm çiftleri seç"
                                    label="Çift Aç"
                                    icon={<CopyCheck size={14} />}
                                />
                            </div>

                            <button
                                onClick={onExit}
                                aria-label="Oyundan çık"
                                className="btn-danger flex items-center gap-2 text-xs uppercase tracking-wider"
                            >
                                <LogOut size={14} />
                                Çıkış
                            </button>

                            <div className="flex items-center gap-2">
                                <ScoreBadge score={currentPlayer?.score || 0} />
                                {currentPlayer?.hasLaidDown && (
                                    <span className="px-2 py-1 rounded-lg bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 text-[9px] font-black uppercase tracking-wider anim-pop-in">
                                        Açıldın
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Floating selection action bar */}
                        {selectedTileIndices.length > 0 && (
                            <div className="z-30 -mb-1 anim-pop-in flex items-center gap-2 sm:gap-3 rounded-2xl border border-rose-400/30 bg-slate-950/85 backdrop-blur-xl pl-4 pr-2 py-2 shadow-[0_16px_40px_-12px_rgba(244,63,94,0.45)]">
                                <span className="text-xs font-bold text-slate-300 whitespace-nowrap">
                                    <span className="font-display text-base text-rose-300 tabular-nums">{selectedTileIndices.length}</span> taş seçili
                                </span>
                                {selectedTileIndices.length >= 3 && (
                                    <button onClick={onLayDownMeld} className="btn-premium text-sm">
                                        İNDİR
                                    </button>
                                )}
                                <button onClick={onClearSelection} className="btn-ghost text-xs">
                                    Temizle
                                </button>
                            </div>
                        )}

                        {/* Player Rack */}
                        <div className="w-full max-w-full overflow-x-auto pt-3 pb-1">
                            <div className="w-max mx-auto">
                                <PlayerRack101
                                    tiles={userTiles}
                                    selectedIndices={selectedTileIndices}
                                    onTileClick={(idx: number) => {
                                        if (gameState.currentTurn === mySlot) {
                                            onToggleSelection(idx);
                                        }
                                    }}
                                    okeyTile={gameState.okeyTile}
                                />
                            </div>
                        </div>

                        {/* Instructions */}
                        <div className="text-emerald-100/70 text-xs sm:text-sm font-semibold text-center px-4">
                            {gameState.currentTurn === mySlot ? (
                                userTileCount === 14 ? (
                                    "Desteden veya soldaki oyuncunun ıskartasından çekin"
                                ) : userTileCount === 15 ? (
                                    selectedTileIndices.length >= 3 ? (
                                        "İNDİR butonuna basın veya taş seçmeye devam edin"
                                    ) : (
                                        "Per için taş seçin veya kendi ıskartanıza taş atın"
                                    )
                                ) : "Oyun devam ediyor"
                            ) : (
                                `${playerInfo[gameState.currentTurn]?.name || 'Rakip'} oynuyor...`
                            )}
                        </div>
                    </div>

                    {/* Round indicator */}
                    <div className="absolute top-3 left-3 z-20 glass-chip text-rose-200">
                        El: {gameState.roundNumber}
                    </div>

                    {/* Joker / Okey indicator */}
                    {gameState.okeyTile && (
                        <div className="absolute top-3 right-3 z-20 flex items-center gap-2 rounded-full border border-emerald-400/40 bg-slate-950/70 backdrop-blur-md pl-3 pr-1.5 py-1 shadow-[0_0_16px_-4px_rgba(16,185,129,0.5)]">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="text-emerald-200 font-bold text-[10px] uppercase tracking-widest">Okey</span>
                            <div className="w-8 h-11">
                                <OkeyTile tile={gameState.okeyTile} okeyTile={null} size="xs" />
                            </div>
                        </div>
                    )}

                    <DragOverlay dropAnimation={null}>
                        <div style={{
                            willChange: 'transform',
                            transform: 'translateZ(0)',
                            pointerEvents: 'none',
                            filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.3))',
                        }}>
                            {renderDragOverlay()}
                        </div>
                    </DragOverlay>
                </div>
            </div>
        </DndContext>
    );
});
