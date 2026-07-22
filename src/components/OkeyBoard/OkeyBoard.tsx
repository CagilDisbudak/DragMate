import React, { useState, useCallback } from 'react';
import type { OkeyGameState } from '../../logic/okeyLogic';
import { PlayerRack } from './PlayerRack';
import { OkeyTile } from './OkeyTile';
import { Bot, Wand2 } from 'lucide-react';
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

// Default player info for local mode
const DEFAULT_PLAYER_INFO = [
    { name: 'Siz', isAI: false, isYou: true },
    { name: 'Bot 1', isAI: true, isYou: false },
    { name: 'Bot 2', isAI: true, isYou: false },
    { name: 'Bot 3', isAI: true, isYou: false },
];

const OKEY_DOT_COLORS: Record<string, string> = {
    red: 'bg-red-500',
    black: 'bg-slate-900 ring-1 ring-white/40',
    blue: 'bg-blue-500',
    yellow: 'bg-amber-400',
};

interface PlayerInfo {
    name: string;
    isAI: boolean;
    isYou: boolean;
}

interface OkeyBoardProps {
    gameState: OkeyGameState | null;
    onDraw: (index?: number) => void;
    onDrawDiscard: (index?: number) => void;
    onMoveTile: (fromIndex: number, toIndex: number) => void;
    onDiscard: (index: number) => void;
    onAutoSort: () => void;
    onFinish: (index: number) => void;
    onReset: () => void;
    onReshuffle: () => void;
    onEndTie: () => void;
    onExit: () => void;
    // Multiplayer props
    playerInfo?: PlayerInfo[];
    mySlot?: number;
}

interface PlayerPanelProps {
    playerId: number;
    currentTurn: number;
    className?: string;
    isDragging?: boolean;
    playerInfo: PlayerInfo;
    tileCount?: number;
    /** Narrow side-column variant: hides the name on small screens. */
    compact?: boolean;
}

const PlayerPanel: React.FC<PlayerPanelProps> = React.memo(({
    playerId,
    currentTurn,
    className = '',
    isDragging = false,
    playerInfo,
    tileCount = 14,
    compact = false
}) => {
    const isActive = currentTurn === playerId;
    const initial = (playerInfo.name || '?').trim().charAt(0).toUpperCase();

    return (
        <div className={`transition-all duration-300 ${isActive && !isDragging ? 'scale-105' : 'opacity-90'} ${className}`}>
            <div className={`
                relative flex items-center gap-2 h-9 pl-1.5 pr-2.5 rounded-full border backdrop-blur-md transition-all duration-300
                ${compact ? 'min-w-0' : 'min-w-[130px] sm:min-w-[160px]'}
                ${isActive
                    ? 'border-amber-400/70 bg-amber-500/15 shadow-[0_0_22px_-2px_rgba(251,191,36,0.55)]'
                    : 'border-white/10 bg-black/45 shadow-lg'}
            `}>
                {/* Avatar: bot icon or name initial */}
                <div className={`
                    flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-black shrink-0 transition-colors
                    ${isActive ? 'bg-amber-400 text-amber-950' : 'bg-white/10 text-slate-300'}
                    ${playerInfo.isYou && !playerInfo.isAI ? 'ring-2 ring-amber-400/60' : ''}
                `}>
                    {playerInfo.isAI ? <Bot size={13} /> : initial}
                </div>

                <div className={`flex-1 items-center justify-center gap-1.5 font-bold text-[11px] uppercase tracking-wide min-w-0 ${compact ? 'hidden md:flex' : 'flex'} ${isActive ? 'text-amber-100' : 'text-slate-300'}`}>
                    {isActive && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping shrink-0" />}
                    <span className="truncate">{playerInfo.name}</span>
                    {playerInfo.isYou && !playerInfo.isAI && (
                        <span className="text-[9px] text-amber-400/90 shrink-0">(Sen)</span>
                    )}
                </div>

                {/* Tile-count badge lives INSIDE the pill (no overflow → no overlap) */}
                {!playerInfo.isYou && (
                    <div className={`
                        px-1.5 py-0.5 rounded-full text-[9px] font-bold flex items-center gap-1 border whitespace-nowrap shrink-0
                        ${isActive ? 'bg-amber-500/90 border-amber-300/60 text-amber-950' : 'bg-black/60 border-white/10 text-slate-300'}
                    `}>
                        {tileCount}
                    </div>
                )}
            </div>
        </div>
    );
});

const DiscardZone = ({ playerId, discardPiles, okeyTile, currentTurn, userTileCount, onDrawDiscard, isDraggingRackTile, mySlot = 0 }: any) => {
    // Adjust logic for multiplayer - "user" is whoever's turn it is at mySlot
    const canDropHere = (playerId === mySlot && currentTurn === mySlot && userTileCount === 15 && isDraggingRackTile);
    const prevPlayerIdx = (mySlot + 3) % 4;
    const canDrawHere = (playerId === prevPlayerIdx && currentTurn === mySlot && userTileCount === 14);

    const { setNodeRef, isOver } = useDroppable({
        id: `discard-${playerId}`,
        disabled: !canDropHere
    });
    const pile = discardPiles[playerId];
    const lastTile = pile[pile.length - 1];
    const underTiles = pile.slice(Math.max(0, pile.length - 3), Math.max(0, pile.length - 1));

    const { attributes, listeners, setNodeRef: setDraggableRef, isDragging } = useDraggable({
        id: `pick-discard-${playerId}`,
        disabled: !canDrawHere || !lastTile
    });

    const jitterRots = [-7, 5];

    // Positioned by the parent flex rows — no absolute placement, so zones can
    // never overlap other table elements regardless of viewport size.
    return (
        <div
            ref={setNodeRef}
            onClick={() => canDrawHere && onDrawDiscard()}
            className={`
                relative w-14 h-20 sm:w-16 sm:h-24 shrink-0 rounded-xl transition-all duration-200 flex items-center justify-center
                ${isOver ? 'bg-emerald-400/30 scale-110 ring-4 ring-emerald-400 shadow-[0_0_24px_rgba(52,211,153,0.5)]' : ''}
                ${canDropHere && !isOver ? 'bg-emerald-500/10 ring-2 ring-emerald-400/50' : ''}
                ${canDrawHere ? 'cursor-grab active:cursor-grabbing bg-amber-400/10' : ''}
            `}
        >
            {/* Pulsing amber halo when this pile can be drawn from */}
            {canDrawHere && (
                <div className="absolute -inset-1 rounded-xl ring-2 ring-amber-400/80 shadow-[0_0_20px_rgba(251,191,36,0.4)] animate-pulse pointer-events-none" />
            )}

            {/* Older discards peeking out with slight rotation jitter */}
            {underTiles.map((t: any, i: number) => (
                <div
                    key={t.id ?? `under-${i}`}
                    className="absolute left-1/2 top-1/2 pointer-events-none opacity-90"
                    style={{ transform: `translate(-50%, -50%) translate(${i % 2 === 0 ? -3 : 3}px, ${-2 + i * 2}px) rotate(${jitterRots[i % 2]}deg)` }}
                >
                    <OkeyTile tile={t} size="sm" okeyTile={okeyTile} />
                </div>
            ))}

            {lastTile ? (
                <div
                    ref={setDraggableRef}
                    {...attributes}
                    {...listeners}
                    className={`relative z-10 rotate-2 ${canDrawHere && !isDragging ? 'transition-transform duration-150 hover:scale-105 hover:-translate-y-0.5' : ''} ${isDragging ? 'opacity-20' : ''}`}
                >
                    <OkeyTile tile={lastTile} size="sm" okeyTile={okeyTile} />
                </div>
            ) : (
                <div className="w-12 h-18 border-2 border-white/15 border-dashed rounded-lg bg-black/10 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-white/15" />
                </div>
            )}

            {canDropHere && (
                <div className="absolute -inset-2 border-2 border-dashed border-emerald-400 rounded-2xl animate-pulse pointer-events-none">
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[8px] font-black text-emerald-300 uppercase tracking-wider whitespace-nowrap bg-black/80 border border-emerald-500/40 px-2 py-1 rounded-full">BURAYA AT</div>
                </div>
            )}

            {canDrawHere && lastTile && !isDragging && (
                <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-linear-to-b from-amber-400 to-amber-500 text-amber-950 text-[8px] font-black px-2.5 py-1 rounded-full animate-bounce whitespace-nowrap z-50 shadow-lg shadow-amber-500/40">
                    ÇEK
                </div>
            )}
        </div>
    );
};

const DraggableDrawPile = ({ currentTurn, userTileCount, centerStackCount, onDraw, mySlot = 0 }: any) => {
    const canDraw = currentTurn === mySlot && userTileCount < 15;
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: 'draw-pile',
        disabled: !canDraw
    });

    return (
        <div className="relative">
            <div
                ref={setNodeRef}
                {...attributes}
                {...listeners}
                onClick={() => canDraw && onDraw()}
                aria-label="Taş çek"
                className={`
                    relative w-16 h-21 rounded-lg transition-all duration-200
                    ${canDraw ? 'cursor-grab active:cursor-grabbing hover:-translate-y-1.5' : 'cursor-wait opacity-70'}
                    ${isDragging ? 'opacity-20' : ''}
                `}
            >
                {/* Neat stack of face-down tiles */}
                <div className="absolute inset-0 tile-back rounded-lg translate-x-2 translate-y-2 rotate-2" />
                <div className="absolute inset-0 tile-back rounded-lg translate-x-1 translate-y-1 -rotate-1" />
                <div className="absolute inset-0 tile-back rounded-lg flex items-center justify-center">
                    <div className="w-9 h-12 rounded-md border border-white/20 flex items-center justify-center">
                        <div className="w-3.5 h-3.5 rotate-45 rounded-[3px] border border-white/25 bg-white/10" />
                    </div>
                    {canDraw && (
                        <div className="absolute inset-0 rounded-lg ring-2 ring-amber-400/90 shadow-[0_0_18px_rgba(251,191,36,0.45)] pointer-events-none" />
                    )}
                </div>

                {/* Remaining-tile count badge */}
                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 z-10 px-2.5 py-0.5 rounded-full bg-black/75 border border-amber-500/40 text-amber-300 font-display font-bold text-[11px] shadow-md whitespace-nowrap">
                    {centerStackCount}
                </div>

                {canDraw && !isDragging && (
                    <div className="absolute -top-9 left-1/2 -translate-x-1/2 bg-linear-to-b from-amber-400 to-amber-500 text-amber-950 text-[10px] font-black px-3 py-1 rounded-full animate-bounce shadow-lg shadow-amber-500/40 whitespace-nowrap z-50">
                        TAŞ ÇEK
                    </div>
                )}
            </div>
        </div>
    );
};

const FinishZone = React.memo(({ isDraggingRackTile, canFinish }: { isDraggingRackTile: boolean, canFinish: boolean }) => {
    const { setNodeRef, isOver } = useDroppable({
        id: 'finish-zone',
        disabled: !canFinish
    });
    const highlighted = canFinish && isDraggingRackTile;

    return (
        <div
            ref={setNodeRef}
            className={`
                absolute -inset-4 rounded-2xl transition-all duration-300 pointer-events-none
                ${highlighted ? 'border-2 border-dashed border-amber-400 animate-[pulse_1.5s_infinite] bg-amber-400/10' : ''}
                ${isOver ? 'bg-amber-400/30 scale-110 shadow-[0_0_28px_rgba(251,191,36,0.5)]' : ''}
            `}
        >
            {highlighted && (
                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[8px] font-black text-amber-300 uppercase tracking-wider whitespace-nowrap bg-black/80 border border-amber-500/40 px-2 py-1 rounded-full">BİTİR</div>
            )}
        </div>
    );
});

export const OkeyBoard: React.FC<OkeyBoardProps> = React.memo(({
    gameState,
    onDraw,
    onDrawDiscard,
    onMoveTile,
    onDiscard,
    onAutoSort,
    onFinish,
    onReset,
    onReshuffle,
    onEndTie,
    onExit,
    playerInfo = DEFAULT_PLAYER_INFO,
    mySlot = 0
}) => {
    const [activeId, setActiveId] = useState<string | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 3 }
        }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    // All hooks must be called before any conditional returns
    const handleDragStart = useCallback((event: DragStartEvent) => setActiveId(event.active.id as string), []);
    const handleDragEnd = useCallback((event: DragEndEvent) => {
        setActiveId(null);
        const { active, over } = event;
        if (!over) return;

        const draggingId = active.id as string;
        const dropId = over.id as string;

        // Adjust for mySlot in multiplayer
        if (dropId === `discard-${mySlot}` && draggingId.startsWith('slot-')) {
            onDiscard(parseInt(draggingId.split('-')[1]));
        } else if (dropId === 'finish-zone' && draggingId.startsWith('slot-')) {
            onFinish(parseInt(draggingId.split('-')[1]));
        } else if (draggingId === 'draw-pile' && dropId.startsWith('slot-')) {
            onDraw(parseInt(dropId.split('-')[1]));
        } else if (draggingId.startsWith('pick-discard-') && dropId.startsWith('slot-')) {
            onDrawDiscard(parseInt(dropId.split('-')[1]));
        } else if (draggingId !== dropId && draggingId.startsWith('slot-') && dropId.startsWith('slot-')) {
            onMoveTile(parseInt(draggingId.split('-')[1]), parseInt(dropId.split('-')[1]));
        }
    }, [mySlot, onDiscard, onFinish, onDraw, onDrawDiscard, onMoveTile]);

    // Early return AFTER all hooks
    if (!gameState) return (
        <div className="flex flex-col items-center justify-center gap-4 p-14 text-white anim-fade-up">
            <div className="w-10 h-10 rounded-full border-2 border-amber-400/25 border-t-amber-400 animate-spin" />
            <div className="font-display font-bold tracking-[0.3em] text-sm text-slate-300">YÜKLENİYOR...</div>
        </div>
    );

    const renderDragOverlay = () => {
        if (!activeId) return null;
        if (activeId === 'draw-pile') return <div className="w-16 h-21 tile-back rounded-lg rotate-2 opacity-90" />;
        if (activeId.startsWith('pick-discard-')) {
            const prevPlayerIdx = (mySlot + 3) % 4;
            const lastTile = gameState.discardPiles[prevPlayerIdx][gameState.discardPiles[prevPlayerIdx].length - 1];
            return lastTile ? <OkeyTile tile={lastTile} size="sm" okeyTile={gameState.okeyTile} dragging /> : null;
        }
        if (activeId.startsWith('slot-')) {
            const tile = gameState.players[mySlot].tiles[parseInt(activeId.split('-')[1])];
            return tile ? <OkeyTile tile={tile} okeyTile={gameState.okeyTile} dragging /> : null;
        }
        return null;
    };

    // Get tile counts for each player
    const getTileCount = (playerIdx: number) => {
        return gameState.players[playerIdx].tiles.filter(t => t !== null).length;
    };

    // Map display positions based on mySlot
    // In multiplayer, the current user (mySlot) should always appear at the bottom
    const getActualSlot = (displayPosition: number): number => {
        return (displayPosition + mySlot) % 4;
    };

    const userTileCount = getTileCount(mySlot);

    // Get player info in display order
    const getPlayerInfoForDisplay = (displayPos: number) => {
        const actualSlot = getActualSlot(displayPos);
        return playerInfo[actualSlot] || DEFAULT_PLAYER_INFO[actualSlot];
    };

    return (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            {/* Wooden table rim */}
            <div className="relative w-full mx-auto rounded-[24px] shadow-glass-lg anim-fade-up">
                <div className="wood-surface rounded-[24px] p-1.5 sm:p-2.5">
                    {/* Flex-row table: rows can never overlap each other, at any viewport size */}
                    <div className="relative w-full felt-surface rounded-[16px] overflow-hidden font-sans flex flex-col gap-3 sm:gap-4 px-2 sm:px-5 pt-3 pb-2 sm:pb-3">
                        {/* Felt vignette */}
                        <div className="absolute inset-0 rounded-[16px] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.4),inset_0_0_80px_rgba(0,0,0,0.3)] pointer-events-none" />

                        {/* Row 1: top opponent + their discard pile */}
                        <div className="relative z-10 flex flex-col items-center gap-2.5">
                            <PlayerPanel
                                playerId={getActualSlot(2)}
                                currentTurn={gameState.currentTurn}
                                isDragging={!!activeId}
                                playerInfo={getPlayerInfoForDisplay(2)}
                                tileCount={getTileCount(getActualSlot(2))}
                            />
                            <DiscardZone playerId={getActualSlot(2)} {...gameState} userTileCount={userTileCount} onDrawDiscard={onDrawDiscard} isDraggingRackTile={activeId?.startsWith('slot-')} mySlot={mySlot} />
                        </div>

                        {/* Row 2: left opponent | center (indicator + draw pile) | right opponent */}
                        <div className="relative z-10 flex-1 flex items-center justify-between gap-2 sm:gap-6 min-h-[11rem]">
                            <div className="flex flex-col items-center gap-8 shrink-0">
                                <PlayerPanel
                                    playerId={getActualSlot(3)}
                                    currentTurn={gameState.currentTurn}
                                    isDragging={!!activeId}
                                    playerInfo={getPlayerInfoForDisplay(3)}
                                    tileCount={getTileCount(getActualSlot(3))}
                                    compact
                                />
                                <DiscardZone playerId={getActualSlot(3)} {...gameState} userTileCount={userTileCount} onDrawDiscard={onDrawDiscard} isDraggingRackTile={activeId?.startsWith('slot-')} mySlot={mySlot} />
                            </div>

                            <div className="flex items-center gap-6 sm:gap-12">
                                <div className="relative flex flex-col items-center gap-1.5 rounded-2xl border border-amber-400/35 bg-linear-to-b from-[#4a2f10]/90 to-[#2c1b08]/95 px-3.5 py-2.5 shadow-[inset_0_1px_0_rgba(251,191,36,0.25),0_10px_28px_rgba(0,0,0,0.55)]">
                                    <span className="font-display text-[9px] font-bold uppercase tracking-[0.3em] text-amber-300/90">Gösterge</span>
                                    <OkeyTile tile={gameState.indicatorTile!} size="md" okeyTile={gameState.okeyTile} />
                                    {gameState.okeyTile && (
                                        <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-amber-200/80">
                                            Okey:
                                            <span className={`w-2 h-2 rounded-full ${gameState.okeyTile.color ? OKEY_DOT_COLORS[gameState.okeyTile.color] : 'bg-slate-400'}`} />
                                            <span className="font-display">{gameState.okeyTile.value}</span>
                                        </span>
                                    )}
                                    <FinishZone isDraggingRackTile={activeId?.startsWith('slot-') || false} canFinish={gameState.currentTurn === mySlot && userTileCount === 15} />
                                </div>
                                <DraggableDrawPile {...gameState} userTileCount={userTileCount} centerStackCount={gameState.centerStack.length} onDraw={onDraw} mySlot={mySlot} />
                            </div>

                            <div className="flex flex-col items-center gap-8 shrink-0">
                                <PlayerPanel
                                    playerId={getActualSlot(1)}
                                    currentTurn={gameState.currentTurn}
                                    isDragging={!!activeId}
                                    playerInfo={getPlayerInfoForDisplay(1)}
                                    tileCount={getTileCount(getActualSlot(1))}
                                    compact
                                />
                                <DiscardZone playerId={getActualSlot(1)} {...gameState} userTileCount={userTileCount} onDrawDiscard={onDrawDiscard} isDraggingRackTile={activeId?.startsWith('slot-')} mySlot={mySlot} />
                            </div>
                        </div>

                        {/* Row 3: me — my discard target + identity + sort, then the rack */}
                        <div className="relative z-10 flex flex-col items-center gap-2.5">
                            <div className="flex items-center justify-center gap-3 sm:gap-5 flex-wrap">
                                <PlayerPanel
                                    playerId={mySlot}
                                    currentTurn={gameState.currentTurn}
                                    isDragging={!!activeId}
                                    playerInfo={playerInfo[mySlot] || DEFAULT_PLAYER_INFO[0]}
                                />
                                <button onClick={onAutoSort} aria-label="Taşları otomatik düzenle" className="btn-ghost flex items-center gap-2 text-[11px] uppercase tracking-widest">
                                    <Wand2 size={14} className="text-amber-400" />
                                    Düzenle
                                </button>
                                <DiscardZone playerId={mySlot} {...gameState} userTileCount={userTileCount} onDrawDiscard={onDrawDiscard} isDraggingRackTile={activeId?.startsWith('slot-')} mySlot={mySlot} />
                            </div>
                            <PlayerRack tiles={gameState.players[mySlot].tiles} playerId={mySlot} isCurrentPlayer okeyTile={gameState.okeyTile} />
                        </div>

                        {gameState.phase === 'roundOver' && (
                            <div className="overlay-backdrop">
                                {/* Confetti animation for winner */}
                                {gameState.winner === mySlot && (
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
                                                        backgroundColor: ['#ffd700', '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7'][i % 6],
                                                        animationDelay: `${r(3) * 2}s`,
                                                        animationDuration: `${2 + r(4) * 2}s`,
                                                        transform: `rotate(${r(5) * 360}deg)`
                                                    }}
                                                />
                                            );
                                        })}
                                    </div>
                                )}

                                <div className="relative w-full max-w-md liquid-glass px-6 py-8 sm:px-10 sm:py-10 flex flex-col items-center gap-5 anim-pop-in">
                                    {gameState.winner === mySlot && (
                                        <div className="absolute inset-0 rounded-3xl ring-1 ring-amber-400/40 shadow-[0_0_60px_-10px_rgba(251,191,36,0.45)] pointer-events-none" />
                                    )}
                                    {/* Trophy / Icon */}
                                    <div className={`text-6xl sm:text-7xl ${gameState.winner === mySlot ? 'animate-bounce' : 'anim-float'}`}>
                                        {gameState.winner === null ? '🤝' : gameState.winner === mySlot ? '🏆' : '😢'}
                                    </div>

                                    <h2 className={`font-display text-3xl sm:text-4xl font-bold uppercase tracking-tight ${gameState.winner === mySlot
                                        ? 'text-transparent bg-clip-text bg-linear-to-r from-amber-200 via-amber-300 to-amber-500'
                                        : 'text-gradient'
                                        }`}>
                                        {gameState.winner === null ? 'BERABERE!' : (gameState.winner === mySlot ? 'KAZANDINIZ!' : 'KAYBETTİNİZ')}
                                    </h2>

                                    <p className="text-sm sm:text-base font-medium text-slate-300 text-center max-w-xs">
                                        {gameState.winner === null
                                            ? 'Kimse kazanamadı. Taşlar tükendi!'
                                            : (gameState.winner === mySlot
                                                ? 'Tebrikler! Harika bir oyun oynadınız! 🎉'
                                                : `${playerInfo[gameState.winner]?.name || `Player ${gameState.winner + 1}`} oyunu kazandı.`
                                            )
                                        }
                                    </p>

                                    <div className="flex flex-wrap justify-center gap-3 mt-2">
                                        <button
                                            onClick={onReset}
                                            className="btn-premium uppercase tracking-wide"
                                        >
                                            🔄 Tekrar Oyna
                                        </button>
                                        <button
                                            onClick={onExit}
                                            className="btn-ghost uppercase tracking-wide"
                                        >
                                            🚪 Çıkış
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Stack Empty Prompt Overlay */}
                        {gameState.phase === 'stackEmpty' && (
                            <div className="overlay-backdrop">
                                <div className="relative liquid-glass w-full max-w-md px-6 py-8 sm:px-8 flex flex-col items-center gap-6 anim-pop-in">
                                    <div className="absolute inset-0 rounded-3xl ring-1 ring-amber-500/30 pointer-events-none" />
                                    <div className="text-5xl anim-float">🪹</div>
                                    <div>
                                        <h3 className="font-display text-2xl font-bold text-amber-300 uppercase tracking-tight">ORTADA TAŞ BİTTİ!</h3>
                                        <p className="text-slate-300 text-sm font-medium mt-2">Iskartadaki taşları karıştırıp devam mı edelim, yoksa oyunu bitirelim mi?</p>
                                    </div>
                                    <div className="flex flex-col gap-3 w-full">
                                        <button
                                            onClick={onReshuffle}
                                            className="btn-premium w-full uppercase tracking-widest"
                                        >
                                            Taşları Karıştır (Devam Et)
                                        </button>
                                        <button
                                            onClick={onEndTie}
                                            className="btn-ghost w-full uppercase tracking-widest"
                                        >
                                            Oyunu Bitir (Berabere)
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <DragOverlay
                dropAnimation={null}
                style={{
                    cursor: 'grabbing',
                    touchAction: 'none',
                }}
                modifiers={[]}
            >
                <div
                    style={{
                        willChange: 'transform',
                        transform: 'translateZ(0)',
                        pointerEvents: 'none',
                        filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.25))',
                    }}
                >
                    {renderDragOverlay()}
                </div>
            </DragOverlay>
        </DndContext>
    );
});
