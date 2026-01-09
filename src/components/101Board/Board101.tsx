import React, { useState, useCallback } from 'react';
import type { Game101State, Meld, Tile101 } from '../../logic/101Logic';
import { OkeyTile } from '../OkeyBoard/OkeyTile';
import { Bot, User } from 'lucide-react';
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

// Avatar colors for different players
const AVATAR_COLORS = [
    { bg: 'bg-emerald-500', ring: 'ring-emerald-400' },
    { bg: 'bg-amber-500', ring: 'ring-amber-400' },
    { bg: 'bg-rose-500', ring: 'ring-rose-400' },
    { bg: 'bg-purple-500', ring: 'ring-purple-400' },
];

// Player Avatar Component
const PlayerAvatar: React.FC<{
    playerInfo: PlayerInfo;
    isCurrentTurn: boolean;
    tileCount: number;
    colorIndex: number;
    position: 'top' | 'left' | 'right';
}> = React.memo(({ playerInfo, isCurrentTurn, tileCount, colorIndex, position }) => {
    const colors = AVATAR_COLORS[colorIndex % AVATAR_COLORS.length];

    const positionClasses = {
        top: 'flex-col',
        left: 'flex-col',
        right: 'flex-col',
    };

    return (
        <div className={`flex ${positionClasses[position]} items-center gap-2`}>
            {/* Avatar Circle */}
            <div className={`
                relative w-14 h-14 rounded-full ${colors.bg} 
                flex items-center justify-center shadow-xl
                ${isCurrentTurn ? `ring-4 ${colors.ring} ring-offset-2 ring-offset-[#2d5a3d]` : ''}
                transition-all duration-300
            `}>
                {playerInfo.isAI ? (
                    <Bot size={28} className="text-white" />
                ) : (
                    <User size={28} className="text-white" />
                )}

                {/* Tile count badge */}
                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#1a3625] text-white text-[10px] font-bold flex items-center justify-center border-2 border-[#2d5a3d]">
                    {tileCount}
                </div>
            </div>

            {/* Name plate */}
            <div className={`
                px-3 py-1 rounded-lg shadow-lg
                ${isCurrentTurn ? 'bg-emerald-600 ring-2 ring-emerald-400' : 'bg-[#1a3625]/90'}
                transition-all duration-300
            `}>
                <span className="text-white font-bold text-xs">{playerInfo.name}</span>
                {isCurrentTurn && (
                    <div className="flex justify-center gap-1 mt-0.5">
                        <span className="w-1 h-1 rounded-full bg-amber-400 animate-pulse" />
                        <span className="w-1 h-1 rounded-full bg-amber-400 animate-pulse" style={{ animationDelay: '0.2s' }} />
                        <span className="w-1 h-1 rounded-full bg-amber-400 animate-pulse" style={{ animationDelay: '0.4s' }} />
                    </div>
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
    position: 'top' | 'bottom' | 'left' | 'right';
}> = React.memo(({ playerId, discardPile, currentTurn, userTileCount, mySlot, isDraggingRackTile, onDrawDiscard, position }) => {
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

    const positionClasses = {
        top: 'w-16 h-24',
        bottom: 'w-16 h-24',
        left: 'w-16 h-24',
        right: 'w-16 h-24',
    };

    // Show drop feedback when dragging over own discard zone
    const showDropFeedback = isOver && playerId === mySlot && isDraggingRackTile;

    return (
        <div
            ref={setNodeRef}
            onClick={() => canDrawHere && onDrawDiscard()}
            className={`
                ${positionClasses[position]} rounded-lg transition-all duration-200 flex items-center justify-center relative
                ${showDropFeedback ? 'bg-amber-400/30 scale-110 ring-4 ring-amber-400 shadow-xl' : 'bg-[#1a3625]/50'}
                ${canDropHere && !showDropFeedback ? 'bg-amber-500/10 ring-2 ring-amber-400/50' : ''}
                ${canDrawHere ? 'cursor-grab active:cursor-grabbing hover:ring-2 hover:ring-amber-400 bg-amber-400/10' : ''}
                border-2 ${canDropHere || canDrawHere ? 'border-amber-400/50' : 'border-[#4a7c59]/30'}
            `}
        >
            {lastTile ? (
                <div
                    ref={setDraggableRef}
                    {...attributes}
                    {...listeners}
                    className={`rotate-2 shadow-lg transform ${canDrawHere && !isDragging ? 'hover:scale-105' : ''} ${isDragging ? 'opacity-20' : ''}`}
                >
                    <OkeyTile tile={lastTile} okeyTile={null} size="sm" />
                </div>
            ) : (
                <div className="w-12 h-16 border-2 border-white/10 border-dashed rounded-lg flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-white/10" />
                </div>
            )}

            {canDropHere && (
                <div className="absolute -inset-1 border-2 border-dashed border-amber-400 rounded-xl animate-pulse pointer-events-none">
                    <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[8px] font-black text-amber-400 uppercase tracking-wider whitespace-nowrap bg-[#1a3625] px-2 py-0.5 rounded">
                        BURAYA AT
                    </div>
                </div>
            )}

            {canDrawHere && lastTile && !isDragging && (
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-[8px] font-black px-2 py-1 rounded animate-bounce whitespace-nowrap z-50">
                    ÇEK
                </div>
            )}

            {discardPile.length > 1 && (
                <div className="absolute -bottom-2 -right-2 w-5 h-5 rounded-full bg-[#2a4a3a] text-white text-[9px] font-bold flex items-center justify-center shadow">
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
                relative w-[52px] h-[70px] flex items-center justify-center cursor-pointer
                ${isOver ? 'scale-110 z-10' : ''}
                ${isSelected ? 'ring-2 ring-amber-400 rounded-lg bg-amber-400/20' : ''}
                ${isJoker && !isSelected ? 'ring-2 ring-emerald-400 rounded-lg' : ''}
                transition-all duration-150
            `}
        >
            {tile ? (
                <div
                    ref={setDraggableRef}
                    {...attributes}
                    {...listeners}
                    className={`w-full h-full ${isDragging ? 'opacity-30' : ''} ${isSelected ? 'scale-105' : ''}`}
                >
                    <OkeyTile tile={tile} okeyTile={okeyTile} size="md" isJoker={isJoker} />
                </div>
            ) : (
                <div className="w-full h-full bg-[#5a3825]/20 rounded-lg border border-[#8d5b3e]/10" />
            )}
        </div>
    );
});

// Player Rack for 101 - Wooden style with two rows
interface PlayerRack101Props {
    tiles: (Tile101 | null)[];
    selectedIndices: number[];
    onTileClick: (index: number) => void;
    okeyTile?: Tile101 | null;
}

const PlayerRack101: React.FC<PlayerRack101Props> = React.memo(({ tiles, selectedIndices, onTileClick, okeyTile }) => {
    const topRow = tiles.slice(0, 15);
    const bottomRow = tiles.slice(15, 30);

    return (
        <div className="relative">
            {/* Wooden rack background */}
            <div className="absolute inset-0 bg-gradient-to-b from-[#c9a66b] via-[#b8915a] to-[#8b6914] rounded-lg shadow-2xl" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/10 via-transparent to-black/10 rounded-lg" />

            {/* Rack edge (top) */}
            <div className="absolute top-0 left-0 right-0 h-3 bg-gradient-to-b from-[#dbb978] to-[#c9a66b] rounded-t-lg border-b border-[#a07830]" />

            {/* Tiles container */}
            <div className="relative pt-4 pb-3 px-3">
                {/* Top row */}
                <div className="flex gap-0.5 justify-center mb-1">
                    {topRow.map((tile, idx) => (
                        <RackSlot101
                            key={idx}
                            tile={tile}
                            index={idx}
                            isSelected={selectedIndices.includes(idx)}
                            onTileClick={() => onTileClick(idx)}
                            okeyTile={okeyTile}
                        />
                    ))}
                </div>

                {/* Divider */}
                <div className="w-full h-1 bg-gradient-to-r from-transparent via-[#8b6914] to-transparent mb-1" />

                {/* Bottom row */}
                <div className="flex gap-0.5 justify-center">
                    {bottomRow.map((tile, idx) => (
                        <RackSlot101
                            key={idx + 15}
                            tile={tile}
                            index={idx + 15}
                            isSelected={selectedIndices.includes(idx + 15)}
                            onTileClick={() => onTileClick(idx + 15)}
                            okeyTile={okeyTile}
                        />
                    ))}
                </div>
            </div>

            {/* Rack edge (bottom) */}
            <div className="absolute bottom-0 left-0 right-0 h-3 bg-gradient-to-t from-[#6b4c10] to-[#8b6914] rounded-b-lg border-t border-[#a07830]" />
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

    const quadrantNames = [
        { pos: 'bottom-left', label: playerInfo[mySlot]?.name || 'Siz' },
        { pos: 'bottom-right', label: playerInfo[getActualSlot(1)]?.name || 'Bot 1' },
        { pos: 'top-left', label: playerInfo[getActualSlot(3)]?.name || 'Bot 3' },
        { pos: 'top-right', label: playerInfo[getActualSlot(2)]?.name || 'Bot 2' },
    ];

    return (
        <div className="relative w-full h-full border-2 border-[#4a7c59] rounded-lg overflow-hidden">
            {/* Grid pattern */}
            <div className="absolute inset-0 opacity-30" style={{
                backgroundImage: 'linear-gradient(#4a7c59 1px, transparent 1px), linear-gradient(90deg, #4a7c59 1px, transparent 1px)',
                backgroundSize: '25px 25px'
            }} />

            {/* 2x2 Grid */}
            <div className="absolute inset-0 grid grid-cols-2 grid-rows-2">
                {/* Top-left quadrant */}
                <div className="border-r border-b border-[#4a7c59]/50 p-2 relative">
                    <div className="flex flex-wrap gap-1 content-start">
                        {getMeldsForPlayer(getActualSlot(3)).map(meld => (
                            <MeldDisplay key={meld.id} meld={meld} isDraggingRackTile={isDraggingRackTile} playerHasLaidDown={playerHasLaidDown} />
                        ))}
                    </div>
                </div>

                {/* Top-right quadrant */}
                <div className="border-b border-[#4a7c59]/50 p-2 relative">
                    <div className="flex flex-wrap gap-1 content-start">
                        {getMeldsForPlayer(getActualSlot(2)).map(meld => (
                            <MeldDisplay key={meld.id} meld={meld} isDraggingRackTile={isDraggingRackTile} playerHasLaidDown={playerHasLaidDown} />
                        ))}
                    </div>
                </div>

                {/* Bottom-left quadrant */}
                <div className="border-r border-[#4a7c59]/50 p-2 relative">
                    <div className="flex flex-wrap gap-1 content-start">
                        {getMeldsForPlayer(mySlot).map(meld => (
                            <MeldDisplay key={meld.id} meld={meld} isDraggingRackTile={isDraggingRackTile} playerHasLaidDown={playerHasLaidDown} />
                        ))}
                    </div>
                </div>

                {/* Bottom-right quadrant */}
                <div className="p-2 relative">
                    <div className="flex flex-wrap gap-1 content-start">
                        {getMeldsForPlayer(getActualSlot(1)).map(meld => (
                            <MeldDisplay key={meld.id} meld={meld} isDraggingRackTile={isDraggingRackTile} playerHasLaidDown={playerHasLaidDown} />
                        ))}
                    </div>
                </div>
            </div>

            {/* Player name labels at corners */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex">
                <div className="px-3 py-1 bg-[#c5d5c5] text-[#2a4a3a] font-bold text-xs border-r border-[#4a7c59]/50">
                    {quadrantNames[0].label}
                </div>
                <div className="px-3 py-1 bg-[#c5d5c5] text-[#2a4a3a] font-bold text-xs">
                    {quadrantNames[1].label}
                </div>
            </div>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 flex">
                <div className="px-3 py-1 bg-[#c5d5c5] text-[#2a4a3a] font-bold text-xs border-r border-[#4a7c59]/50">
                    {quadrantNames[2].label}
                </div>
                <div className="px-3 py-1 bg-[#c5d5c5] text-[#2a4a3a] font-bold text-xs">
                    {quadrantNames[3].label}
                </div>
            </div>
        </div>
    );
});

// Single meld display
const MeldDisplay: React.FC<{
    meld: Meld;
    isDraggingRackTile: boolean;
    playerHasLaidDown: boolean;
}> = React.memo(({ meld, isDraggingRackTile, playerHasLaidDown }) => {
    const { setNodeRef, isOver } = useDroppable({
        id: `meld-${meld.id}`,
        data: { type: 'meld', meldId: meld.id },
        disabled: !playerHasLaidDown
    });

    return (
        <div
            ref={setNodeRef}
            className={`
                flex gap-0.5 p-1 rounded transition-all
                ${isOver && isDraggingRackTile ? 'bg-amber-400/30 scale-105' : ''}
                ${isDraggingRackTile && playerHasLaidDown ? 'ring-1 ring-amber-400/30' : ''}
            `}
        >
            {meld.tiles.map((tile, idx) => (
                <div key={`${meld.id}-${idx}`} className="w-7 h-10">
                    <OkeyTile tile={tile} okeyTile={null} size="xs" isJoker={tile.isFakeOkey} />
                </div>
            ))}
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
        <div className="bg-[#1a3625] rounded-lg border-2 border-[#4a7c59] overflow-hidden w-[130px]">
            <div className="bg-[#4a7c59] px-2 py-1 text-center">
                <span className="text-white font-black text-[10px] tracking-wider">SKOR</span>
            </div>
            <div className="bg-red-600/20 px-2 py-0.5 text-center border-b border-[#4a7c59]/50">
                <span className="text-red-400 text-[9px] font-bold">101 = Kaybet!</span>
            </div>
            <div className="divide-y divide-[#4a7c59]/30">
                {sorted.map((player, idx) => (
                    <div
                        key={player.originalIndex}
                        className={`
                            flex items-center justify-between px-2 py-1 transition-all
                            ${currentTurn === player.originalIndex ? 'bg-amber-500/20' : ''}
                            ${idx === 0 ? 'bg-emerald-500/10' : ''}
                        `}
                    >
                        <div className="flex items-center gap-1">
                            <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${idx === 0 ? 'bg-amber-400 text-black' : 'bg-[#2d5a3d] text-white'}`}>
                                {idx + 1}
                            </span>
                            <span className={`text-[10px] font-bold ${player.isYou ? 'text-amber-400' : 'text-white'}`}>
                                {player.name.length > 6 ? player.name.substring(0, 6) + '..' : player.name}
                            </span>
                        </div>
                        <div className={`px-1.5 py-0.5 rounded text-[10px] font-black ${player.score >= 80 ? 'bg-red-600 text-white animate-pulse' : player.score >= 50 ? 'bg-amber-500 text-white' : 'bg-emerald-600 text-white'}`}>
                            {player.score}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
});

// Draw Pile Component
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
        <div
            ref={setNodeRef}
            {...attributes}
            {...listeners}
            onClick={() => canDraw && onDraw()}
            className={`
                relative w-16 h-24 bg-white rounded-lg shadow-xl flex items-center justify-center transition-all cursor-pointer
                ${canDraw ? 'hover:scale-105 ring-4 ring-amber-400' : 'opacity-70'}
                ${isDragging ? 'opacity-30' : ''}
            `}
        >
            <div className="absolute inset-0 bg-gray-100 rounded-lg transform translate-x-1 translate-y-1 -z-10" />
            <div className="absolute inset-0 bg-gray-200 rounded-lg transform translate-x-2 translate-y-2 -z-20" />
            <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-[#2a4a3a] text-white text-[10px] font-bold flex items-center justify-center">
                {count}
            </div>
            {canDraw && !isDragging && (
                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-[8px] font-black px-2 py-0.5 rounded animate-bounce whitespace-nowrap">
                    TAŞ ÇEK
                </div>
            )}
        </div>
    );
});

// Score Badge
const ScoreBadge: React.FC<{ score: number }> = ({ score }) => (
    <div className={`
        px-4 py-2 rounded-lg font-black text-xl text-white shadow-lg
        ${score >= 80 ? 'bg-red-600' : score >= 50 ? 'bg-amber-500' : 'bg-emerald-600'}
    `}>
        {score}
    </div>
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
        return <div className="text-white text-center p-10 font-bold">YÜKLENİYOR...</div>;
    }

    const userTiles = gameState.players[mySlot]?.tiles || [];
    const userTileCount = userTiles.filter(t => t !== null).length;
    const currentPlayer = gameState.players[mySlot];
    const tableMelds = Object.values(gameState.tableMelds || {}) as Meld[];
    const isDraggingRackTile = activeId?.startsWith('rack-') || false;

    const getTileCount = (playerIdx: number) => {
        return gameState.players[playerIdx]?.tiles.filter(t => t !== null).length || 0;
    };

    const getActualSlot = (displayPosition: number): number => {
        return (displayPosition + mySlot) % 4;
    };

    const renderDragOverlay = () => {
        if (!activeId) return null;
        if (activeId === 'draw-pile') return <div className="w-14 h-18 bg-white rounded shadow-2xl opacity-80" />;
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

        return (
            <div className="relative w-full min-h-[600px] bg-[#2d5a3d] flex flex-col items-center justify-center gap-6 rounded-xl p-8">
                {gameState.roundWinner === mySlot && (
                    <div className="absolute inset-0 overflow-hidden pointer-events-none">
                        {[...Array(30)].map((_, i) => (
                            <div
                                key={i}
                                className="absolute w-3 h-3 rounded-sm animate-bounce"
                                style={{
                                    left: `${Math.random() * 100}%`,
                                    top: `-${Math.random() * 20}%`,
                                    backgroundColor: ['#ffd700', '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7'][i % 6],
                                    animationDelay: `${Math.random() * 2}s`,
                                    animationDuration: `${2 + Math.random() * 2}s`,
                                }}
                            />
                        ))}
                    </div>
                )}

                <div className="text-6xl">{isGameOver ? '🏆' : '🎉'}</div>
                <h2 className="text-3xl font-bold text-white">
                    {isGameOver ? 'OYUN BİTTİ!' : 'EL BİTTİ!'}
                </h2>
                {winner && (
                    <p className="text-xl text-amber-400">
                        {isGameOver ? 'Kazanan' : 'Bu eli kazanan'}: {winner.name}
                    </p>
                )}

                <div className="flex gap-4">
                    {gameState.players.map((p, idx) => (
                        <div key={idx} className="flex flex-col items-center gap-2">
                            <span className="text-white font-bold">{playerInfo[idx]?.name}</span>
                            <ScoreBadge score={p.score} />
                        </div>
                    ))}
                </div>

                <div className="flex gap-4 mt-4">
                    {!isGameOver && (
                        <button onClick={onNewRound} className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition-all shadow-lg">
                            Yeni El
                        </button>
                    )}
                    <button onClick={onReset} className="px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg transition-all shadow-lg">
                        Yeni Oyun
                    </button>
                    <button onClick={onExit} className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded-lg transition-all shadow-lg">
                        Çıkış
                    </button>
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
            <div className="relative w-full bg-[#2d5a3d] rounded-xl overflow-hidden">
                {/* Main game area */}
                <div className="relative flex">
                    {/* Left side - Avatar and discard */}
                    <div className="w-28 flex flex-col items-center justify-center gap-3 py-6">
                        <PlayerAvatar
                            playerInfo={playerInfo[getActualSlot(3)] || DEFAULT_PLAYER_INFO[3]}
                            isCurrentTurn={gameState.currentTurn === getActualSlot(3)}
                            tileCount={getTileCount(getActualSlot(3))}
                            colorIndex={getActualSlot(3)}
                            position="left"
                        />
                        <DiscardZone101
                            playerId={getActualSlot(3)}
                            discardPile={gameState.discardPiles[getActualSlot(3)] || []}
                            currentTurn={gameState.currentTurn}
                            userTileCount={userTileCount}
                            mySlot={mySlot}
                            isDraggingRackTile={isDraggingRackTile}
                            onDrawDiscard={onDrawDiscard}
                            position="left"
                        />
                    </div>

                    {/* Center area */}
                    <div className="flex-1 flex flex-col">
                        {/* Top area - avatar and discard */}
                        <div className="flex justify-center items-center gap-6 py-3">
                            <PlayerAvatar
                                playerInfo={playerInfo[getActualSlot(2)] || DEFAULT_PLAYER_INFO[2]}
                                isCurrentTurn={gameState.currentTurn === getActualSlot(2)}
                                tileCount={getTileCount(getActualSlot(2))}
                                colorIndex={getActualSlot(2)}
                                position="top"
                            />
                            <DiscardZone101
                                playerId={getActualSlot(2)}
                                discardPile={gameState.discardPiles[getActualSlot(2)] || []}
                                currentTurn={gameState.currentTurn}
                                userTileCount={userTileCount}
                                mySlot={mySlot}
                                isDraggingRackTile={isDraggingRackTile}
                                onDrawDiscard={onDrawDiscard}
                                position="top"
                            />
                        </div>

                        {/* Center board with meld zones */}
                        <div className="flex-1 px-4">
                            <div className="h-[240px]">
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

                    {/* Right side - Avatar, discard and controls */}
                    <div className="w-28 flex flex-col items-center justify-center gap-3 py-6">
                        <PlayerAvatar
                            playerInfo={playerInfo[getActualSlot(1)] || DEFAULT_PLAYER_INFO[1]}
                            isCurrentTurn={gameState.currentTurn === getActualSlot(1)}
                            tileCount={getTileCount(getActualSlot(1))}
                            colorIndex={getActualSlot(1)}
                            position="right"
                        />
                        <DiscardZone101
                            playerId={getActualSlot(1)}
                            discardPile={gameState.discardPiles[getActualSlot(1)] || []}
                            currentTurn={gameState.currentTurn}
                            userTileCount={userTileCount}
                            mySlot={mySlot}
                            isDraggingRackTile={isDraggingRackTile}
                            onDrawDiscard={onDrawDiscard}
                            position="right"
                        />
                    </div>

                    {/* Far right - Draw pile and score */}
                    <div className="w-[150px] flex flex-col items-center justify-center gap-3 p-3 bg-[#1a3625]/30">
                        <DrawPile101
                            count={gameState.centerStack.length}
                            currentTurn={gameState.currentTurn}
                            userTileCount={userTileCount}
                            mySlot={mySlot}
                            onDraw={() => onDraw()}
                        />
                        <ScoreTable players={playersWithScores} currentTurn={gameState.currentTurn} />
                    </div>
                </div>

                {/* Bottom area - Your discard, buttons and rack */}
                <div className="p-4 flex flex-col items-center gap-3">
                    {/* Your discard zone and buttons */}
                    <div className="flex items-center gap-4">
                        <DiscardZone101
                            playerId={mySlot}
                            discardPile={gameState.discardPiles[mySlot] || []}
                            currentTurn={gameState.currentTurn}
                            userTileCount={userTileCount}
                            mySlot={mySlot}
                            isDraggingRackTile={isDraggingRackTile}
                            onDrawDiscard={onDrawDiscard}
                            position="bottom"
                        />

                        {/* Sorting buttons group */}
                        <div className="flex items-center gap-1 bg-[#1a3625]/50 rounded-lg p-1 border border-[#4a7c59]/50">
                            <button
                                onClick={onSortByRuns}
                                className="px-3 py-1.5 bg-blue-600 text-white rounded-md shadow text-xs font-bold uppercase tracking-wider transition-all hover:bg-blue-700 hover:scale-105 active:scale-95"
                                title="Serilere göre diz (aynı renk, ardışık sayılar)"
                            >
                                Seri
                            </button>
                            <button
                                onClick={onSortByPairs}
                                className="px-3 py-1.5 bg-purple-600 text-white rounded-md shadow text-xs font-bold uppercase tracking-wider transition-all hover:bg-purple-700 hover:scale-105 active:scale-95"
                                title="Çiftlere göre diz (aynı renk, aynı sayı gerçek çiftler)"
                            >
                                Çift
                            </button>
                        </div>

                        {/* Open/Select buttons group */}
                        <div className="flex items-center gap-1 bg-[#1a3625]/50 rounded-lg p-1 border border-[#4a7c59]/50">
                            <button
                                onClick={onSelectRuns}
                                className="px-3 py-1.5 bg-amber-600 text-white rounded-md shadow text-xs font-bold uppercase tracking-wider transition-all hover:bg-amber-700 hover:scale-105 active:scale-95"
                                title="Tüm serileri seç"
                            >
                                Seri Aç
                            </button>
                            <button
                                onClick={onSelectSets}
                                className="px-3 py-1.5 bg-rose-600 text-white rounded-md shadow text-xs font-bold uppercase tracking-wider transition-all hover:bg-rose-700 hover:scale-105 active:scale-95"
                                title="Tüm çiftleri seç"
                            >
                                Çift Aç
                            </button>
                        </div>

                        {selectedTileIndices.length >= 3 && (
                            <button
                                onClick={onLayDownMeld}
                                className="px-5 py-2 bg-emerald-600 text-white border-2 border-emerald-400 rounded-lg shadow-lg text-sm font-bold uppercase tracking-wider transition-all hover:bg-emerald-700 hover:scale-105 active:scale-95 animate-pulse"
                            >
                                İNDİR ({selectedTileIndices.length})
                            </button>
                        )}

                        {selectedTileIndices.length > 0 && (
                            <button
                                onClick={onClearSelection}
                                className="px-4 py-2 bg-gray-600 text-white border-2 border-gray-500 rounded-lg shadow-lg text-sm font-bold uppercase tracking-wider transition-all hover:bg-gray-700 hover:scale-105 active:scale-95"
                            >
                                Temizle
                            </button>
                        )}

                        <button
                            onClick={onExit}
                            className="px-4 py-2 bg-red-600/80 text-white border-2 border-red-500 rounded-lg shadow-lg text-sm font-bold uppercase tracking-wider transition-all hover:bg-red-700 hover:scale-105 active:scale-95"
                        >
                            Çıkış
                        </button>

                        <ScoreBadge score={currentPlayer?.score || 0} />
                    </div>

                    {/* Player Rack */}
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

                    {/* Instructions */}
                    <div className="text-amber-400/90 text-sm font-bold">
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
                <div className="absolute top-2 left-2 bg-[#1a3625]/90 px-3 py-1 rounded border border-[#4a7c59]">
                    <span className="text-amber-400 font-bold text-sm">El: {gameState.roundNumber}</span>
                </div>

                {/* Joker / Okey indicator */}
                {gameState.okeyTile && (
                    <div className="absolute top-2 right-[160px] bg-emerald-600/90 px-3 py-1 rounded border border-emerald-400 flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-white font-bold text-xs">OKEY</span>
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
        </DndContext>
    );
});
