
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
    DndContext,
    type CollisionDetection,
    type DragEndEvent,
    type DragStartEvent,
    MouseSensor,
    TouchSensor,
    pointerWithin,
    rectIntersection,
    useSensor,
    useSensors,
    useDroppable,
    DragOverlay
} from '@dnd-kit/core';
import { type BackgammonState, type Move } from '../../logic/backgammonLogic';
import { Point } from './Point';
import { Checker, CheckerVisual } from './Checker';
import { Dice } from './Dice';

interface BackgammonBoardProps {
    gameState: BackgammonState;
    playerColor: 'white' | 'black';
    /** Emits the chosen move intent; the authority (server, or local engine) applies it. */
    onMove: (move: Move) => void;
    onRollDice: (dice: number[]) => void;
    validMoves: Move[];
}

// Prefer the actual pointer position when picking a drop target. The default
// rect-intersection uses the DragOverlay's rect, which is bigger than the
// checker and offset from the cursor — drops kept landing on the wrong point.
const pointerFirstCollision: CollisionDetection = (args) => {
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) return pointerCollisions;
    return rectIntersection(args);
};

// Dark leather/felt playing field inside the wood frame
const feltFieldStyle: React.CSSProperties = {
    background:
        'radial-gradient(ellipse at 50% 22%, rgba(255, 255, 255, 0.05), transparent 55%), linear-gradient(165deg, #0e211a 0%, #0a1811 55%, #060e0a 100%)',
    boxShadow:
        'inset 0 2px 20px rgba(0, 0, 0, 0.7), inset 0 0 70px rgba(0, 0, 0, 0.45)',
};

// Inset channel shading for the wooden bar / tray shelves
const woodInsetShadow: React.CSSProperties = {
    boxShadow:
        'inset 0 2px 10px rgba(0, 0, 0, 0.6), inset 0 0 24px rgba(0, 0, 0, 0.35), inset 0 -1px 0 rgba(255, 255, 255, 0.05)',
};

export const BackgammonBoard: React.FC<BackgammonBoardProps> = ({
    gameState,
    playerColor,
    onMove,
    validMoves
}) => {
    const { board, bar, off, turn } = gameState;
    const [activeId, setActiveId] = useState<string | null>(null);
    const [highlightedPoints, setHighlightedPoints] = useState<number[]>([]);
    const [hitEffectPoint, setHitEffectPoint] = useState<number | null>(null);
    const [isRollingDice, setIsRollingDice] = useState(false);
    const prevDice = React.useRef(gameState.dice);

    // Optimized sensors for smoother drag
    const sensors = useSensors(
        useSensor(MouseSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(TouchSensor, {
            activationConstraint: {
                delay: 100, // Small delay to distinguish tap vs drag (scroll)
                tolerance: 5,
            },
        })
    );

    const handleDragStart = (event: DragStartEvent) => {
        const { active } = event;
        const fromId = active.id as string;
        let fromIndex: number | 'bar' = -1;

        if (fromId.startsWith('bar')) {
            fromIndex = 'bar';
        } else if (fromId.startsWith('checker-')) {
            const parts = fromId.split('-');
            fromIndex = parseInt(parts[1]);
        } else {
            fromIndex = parseInt(fromId);
        }

        setActiveId(fromId);

        // Find valid moves from this source
        const moves = validMoves.filter(m => {
            if (fromIndex === 'bar') return m.from === 'bar';
            return m.from === fromIndex;
        });

        const targets = moves.map(m => m.to === 'off' ? 99 : m.to as number); // 99 for off
        setHighlightedPoints(targets);
    };

    // Track previous board state to detect hits from any source (AI, Network, Local)
    const prevBoard = React.useRef(gameState.board);

    React.useEffect(() => {
        const oldBoard = prevBoard.current;
        const newBoard = gameState.board;

        // Detect changes where a single checker was replaced by opponent
        for (let i = 0; i < 24; i++) {
            const oldVal = oldBoard[i];
            const newVal = newBoard[i];

            // Case 1: White hit Black
            // Old was -1 (Black Blot), New is >= 1 (White Occupied)
            if (oldVal === -1 && newVal >= 1) {
                setHitEffectPoint(i);
                setTimeout(() => setHitEffectPoint(null), 800);
            }

            // Case 2: Black hit White
            // Old was 1 (White Blot), New is <= -1 (Black Occupied)
            if (oldVal === 1 && newVal <= -1) {
                setHitEffectPoint(i);
                setTimeout(() => setHitEffectPoint(null), 800);
            }
        }

        prevBoard.current = gameState.board;
    }, [gameState.board]);

    // Handle Dice Animation
    React.useEffect(() => {
        const hasDiceChanged = JSON.stringify(prevDice.current) !== JSON.stringify(gameState.dice);

        if (hasDiceChanged && gameState.dice.length > 0) {
            setIsRollingDice(true);
            const timer = setTimeout(() => setIsRollingDice(false), 800);
            prevDice.current = gameState.dice;
            return () => clearTimeout(timer);
        } else if (!hasDiceChanged) {
            // Keep sync if needed without triggering animation
            prevDice.current = gameState.dice;
        }
    }, [gameState.dice]);


    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);
        setHighlightedPoints([]);

        if (!over) return;

        const fromId = active.id as string;
        let fromIndex: number | 'bar' = -1;
        if (fromId.startsWith('bar')) {
            fromIndex = 'bar';
        } else if (fromId.startsWith('checker-')) {
            const parts = fromId.split('-');
            fromIndex = parseInt(parts[1]);
        } else {
            fromIndex = parseInt(fromId);
        }

        let toIndex: number | 'off' = -1;
        if (over.id === 'off') toIndex = 'off';
        else toIndex = parseInt(over.id as string);

        // Find the matching move
        const move = validMoves.find(m => m.from === fromIndex && m.to === toIndex);

        if (move) {
            // Hit effect handled by useEffect via state change. The authority applies the move.
            onMove(move);
        }
    };

    const renderQuadrant = (start: number, end: number, isTop: boolean) => {
        const points = [];
        if (start < end) {
            for (let i = start; i <= end; i++) points.push(i);
        } else {
            for (let i = start; i >= end; i--) points.push(i);
        }

        return (
            <div className={`flex-1 flex ${isTop ? 'border-b' : 'border-t'} border-white/5`}>
                {points.map(i => (
                    <Point
                        key={i}
                        index={i}
                        count={board[i]}
                        isTop={isTop}
                        isHighlighted={highlightedPoints.includes(i)}
                        playerColor={playerColor}
                        canDragFrom={playerColor === turn && (
                            (playerColor === 'white' && bar.white === 0) ||
                            (playerColor === 'black' && bar.black === 0)
                        )}
                        isHitTarget={hitEffectPoint === i}
                    />
                ))}
            </div>
        );
    };

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={pointerFirstCollision}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <div className="flex flex-col md:flex-row w-full max-w-full md:max-w-7xl mx-auto gap-2 md:gap-4 items-stretch p-1 md:p-4">

                {/* Main Board Area — wood frame around a dark felt field */}
                <div
                    className="relative flex-1 aspect-square md:aspect-[4/3] wood-surface rounded-2xl p-1.5 md:p-3 flex shadow-glass-lg"
                >
                    <div className="relative flex-1 rounded-lg md:rounded-xl overflow-hidden flex flex-col" style={feltFieldStyle}>

                        {/* Top Half */}
                        <div className="flex-1 flex">
                            {renderQuadrant(
                                playerColor === 'white' ? 11 : 12,
                                playerColor === 'white' ? 6 : 17,
                                true
                            )}

                            {/* Bar (Middle) — wooden inset channel */}
                            <div
                                className="w-12 md:w-20 wood-surface border-x border-black/50 flex flex-col items-center justify-center gap-1 py-2"
                                style={woodInsetShadow}
                            >
                                {Array.from({ length: bar.white }).map((_, i) => (
                                    <div key={`bar-w-${i}`} className="w-10 md:w-12">
                                        <Checker
                                            id={`bar-white-${i}`}
                                            color="white"
                                            isDraggable={playerColor === 'white' && turn === 'white' && i === bar.white - 1}
                                        />
                                    </div>
                                ))}
                                {Array.from({ length: bar.black }).map((_, i) => (
                                    <div key={`bar-b-${i}`} className="w-10 md:w-12">
                                        <Checker
                                            id={`bar-black-${i}`}
                                            color="black"
                                            isDraggable={playerColor === 'black' && turn === 'black' && i === bar.black - 1}
                                        />
                                    </div>
                                ))}
                            </div>

                            {renderQuadrant(
                                playerColor === 'white' ? 5 : 18,
                                playerColor === 'white' ? 0 : 23,
                                true
                            )}
                        </div>

                        {/* Bottom Half */}
                        <div className="flex-1 flex">
                            {renderQuadrant(
                                playerColor === 'white' ? 12 : 11,
                                playerColor === 'white' ? 17 : 6,
                                false
                            )}

                            <div
                                className="w-12 md:w-20 wood-surface border-x border-black/50 flex flex-col-reverse items-center justify-start gap-1 py-2"
                                style={woodInsetShadow}
                            />

                            {renderQuadrant(
                                playerColor === 'white' ? 18 : 5,
                                playerColor === 'white' ? 23 : 0,
                                false
                            )}
                        </div>

                        {/* Dice Display */}
                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-50">
                            <div className="flex gap-3 md:gap-4">
                                {(() => {
                                    // Track how many of each value we've already "marked" as used in this render
                                    const usedCounts: Record<number, number> = {};

                                    return gameState.dice.map((val, i) => {
                                        // Count how many times this value appears in current movesLeft
                                        const remainingCount = gameState.movesLeft.filter(m => m === val).length;

                                        // Increment how many times we've encountered this value in the loop
                                        usedCounts[val] = (usedCounts[val] || 0) + 1;

                                        // A die is "used" if its encounter index is greater than the remaining count
                                        // Example for double 4:
                                        // totalCount = 4, remainingCount = 2 (2 moves made)
                                        // i=0: occurrence=1, used=false (since 1 <= 2)
                                        // i=1: occurrence=2, used=false (since 2 <= 2)
                                        // i=2: occurrence=3, used=true (since 3 > 2) -> DARKEN!
                                        // i=3: occurrence=4, used=true (since 4 > 2) -> DARKEN!
                                        const isUsed = usedCounts[val] > remainingCount;

                                        return (
                                            <div
                                                key={i}
                                                className={`transition-all duration-500 ${isUsed ? 'opacity-30 saturate-0 scale-90' : 'opacity-100'}`}
                                            >
                                                <Dice
                                                    value={val}
                                                    isRolling={isRollingDice}
                                                    color={turn === 'white' ? 'white' : 'black'}
                                                />
                                            </div>
                                        );
                                    });
                                })()}
                            </div>
                        </div>

                    </div>
                </div>

                {/* Off Tray Sidebar - Bottom on Mobile, Right on Desktop */}
                <div className="w-full h-20 md:w-32 md:h-auto wood-surface rounded-2xl p-1.5 md:p-2 flex flex-row md:flex-col gap-1.5 md:gap-2 relative overflow-hidden shrink-0 shadow-glass">

                    <div
                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 md:-rotate-90 font-display text-amber-100/20 text-xs md:text-sm tracking-[0.5em] pointer-events-none whitespace-nowrap z-0"
                    >
                        COLLECT
                    </div>

                    {/* Top Collection - Opponent's color (farther from player) */}
                    <div
                        className="flex-1 w-full p-2 flex flex-col gap-1 z-10 rounded-lg bg-black/35 border border-black/40"
                        style={woodInsetShadow}
                    >
                        <OffTray
                            playerColor={playerColor === 'white' ? 'black' : 'white'}
                            count={playerColor === 'white' ? off.black : off.white}
                            isTop={true}
                        />
                    </div>

                    {/* Bottom Collection - Player's color (closer to player) */}
                    <div
                        className="flex-1 w-full p-2 flex flex-col-reverse gap-1 z-10 rounded-lg bg-black/35 border border-black/40"
                        style={woodInsetShadow}
                    >
                        <OffTray
                            playerColor={playerColor === 'white' ? 'white' : 'black'}
                            count={playerColor === 'white' ? off.white : off.black}
                            isTop={false}
                        />
                    </div>

                    {/* Shared Droppable Area */}
                    <div className={`absolute inset-0 z-20 ${activeId ? 'pointer-events-auto' : 'pointer-events-none'}`}>
                        <OffTrayDroppable isHighlighted={highlightedPoints.includes(99)} />
                    </div>
                </div>

            </div>

            {/* Portal the overlay to <body>: ancestors with transforms/animations
                (e.g. anim-fade-up) break position:fixed and made the dragged
                checker render far away from the cursor. */}
            {createPortal(
                <DragOverlay>
                    {activeId ? (
                        <div className="w-full h-full cursor-grabbing scale-110 rotate-3 drop-shadow-[0_14px_18px_rgba(0,0,0,0.55)]">
                            <CheckerVisual color={
                                (function () {
                                    if (activeId.startsWith('bar-white')) return 'white';
                                    if (activeId.startsWith('bar-black')) return 'black';
                                    if (activeId.startsWith('checker-')) {
                                        const parts = activeId.split('-');
                                        const idx = parseInt(parts[1]);
                                        return board[idx] > 0 ? 'white' : 'black';
                                    }
                                    return 'white'; // Fallback
                                })() as 'white' | 'black'
                            } />
                        </div>
                    ) : null}
                </DragOverlay>,
                document.body
            )}
        </DndContext>
    );
};

const OffTrayDroppable: React.FC<{ isHighlighted: boolean }> = ({ isHighlighted }) => {
    const { setNodeRef, isOver } = useDroppable({ id: 'off' });

    // Derived state for clearer visuals
    const isActive = isOver || isHighlighted;

    return (
        <div
            ref={setNodeRef}
            className={`w-full h-full flex items-center justify-center rounded-2xl transition-all duration-300 ${isActive
                ? 'bg-emerald-500/25 backdrop-blur-sm border-2 border-dashed border-emerald-400/80 shadow-[inset_0_0_30px_rgba(16,185,129,0.25)]'
                : ''}`}
        >
            {isActive && (
                <div className="font-display text-emerald-200 font-bold text-xs tracking-[0.3em] md:rotate-90 whitespace-nowrap animate-pulse">
                    COLLECT
                </div>
            )}
        </div>
    );
};

const OffTray: React.FC<{ playerColor: string; count: number, isTop: boolean }> = ({ playerColor, count, isTop }) => {
    const isWhite = playerColor === 'white';

    // Stacked side-view pucks resting on the shelf
    const puckStyle: React.CSSProperties = isWhite
        ? {
            background: 'linear-gradient(180deg, #fdfbf3 0%, #e6dfca 60%, #bfb494 100%)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 2px rgba(0,0,0,0.5)',
        }
        : {
            background: 'linear-gradient(180deg, #39435a 0%, #171c29 60%, #05070c 100%)',
            boxShadow: 'inset 0 1px 0 rgba(148,163,184,0.3), 0 1px 2px rgba(0,0,0,0.6)',
        };

    return (
        <div
            className={`w-full flex ${isTop ? 'flex-col' : 'flex-col-reverse'} gap-[2px] rounded-lg`}
        >
            {count > 0 && (
                <div className={`text-[10px] text-center mb-1 font-display font-bold ${isWhite ? 'text-amber-100/70' : 'text-slate-400/80'}`}>
                    {count}
                </div>
            )}

            {Array.from({ length: Math.min(count, 15) }).map((_, i) => (
                <div key={i} className="h-2 w-full rounded-[3px] anim-deal-in" style={puckStyle} />
            ))}
        </div>
    );
};
