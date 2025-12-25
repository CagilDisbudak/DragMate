
import React, { useState } from 'react';
import {
    DndContext,
    type DragEndEvent,
    type DragStartEvent,
    MouseSensor,
    TouchSensor,
    useSensor,
    useSensors,
    useDroppable,
    DragOverlay
} from '@dnd-kit/core';
import { type BackgammonState, type Move, applyMove } from '../../logic/backgammonLogic';
import { Point } from './Point';
import { Checker, CheckerVisual } from './Checker';

interface BackgammonBoardProps {
    gameState: BackgammonState;
    playerColor: 'white' | 'black';
    onMove: (newState: BackgammonState) => void;
    onRollDice: (dice: number[]) => void;
    validMoves: Move[];
}

export const BackgammonBoard: React.FC<BackgammonBoardProps> = ({
    gameState,
    playerColor,
    onMove,
    validMoves
}) => {
    const { board, bar, off, turn } = gameState;
    const [activeId, setActiveId] = useState<string | null>(null);
    const [highlightedPoints, setHighlightedPoints] = useState<number[]>([]);

    // Optimized sensors for smoother drag
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
            const nextState = applyMove(gameState, move);
            onMove(nextState);
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
            <div className={`flex-1 flex ${isTop ? 'border-b-2' : 'border-t-2'} border-slate-700/30`}>
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
                    />
                ))}
            </div>
        );
    };

    return (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="flex flex-col md:flex-row w-full max-w-full md:max-w-7xl mx-auto gap-2 md:gap-4 items-stretch p-1 md:p-4">

                {/* Main Board Area */}
                <div className="relative flex-1 aspect-square md:aspect-[4/3] bg-slate-800/80 rounded-xl border-4 md:border-[12px] border-slate-900 shadow-2xl flex flex-col overflow-hidden">

                    {/* Top Half (12-23) */}
                    <div className="flex-1 flex">
                        {renderQuadrant(12, 17, true)}

                        {/* Bar (Middle) */}
                        <div className="w-12 md:w-20 bg-slate-900/50 border-x-4 border-slate-900 flex flex-col items-center justify-center gap-1 py-2">
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

                        {renderQuadrant(18, 23, true)}
                    </div>

                    {/* Bottom Half (11-0) */}
                    <div className="flex-1 flex">
                        {renderQuadrant(11, 6, false)}

                        <div className="w-12 md:w-20 bg-slate-900/50 border-x-4 border-slate-900 flex flex-col-reverse items-center justify-start gap-1 py-2">
                        </div>

                        {renderQuadrant(5, 0, false)}
                    </div>

                    {/* Dice Display */}
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-50">
                        <div className="flex gap-3">
                            {gameState.movesLeft.map((val, i) => (
                                <div
                                    key={`${turn}-${i}-${val}`}
                                    className={`w-12 h-12 md:w-14 md:h-14 rounded-lg shadow-xl flex items-center justify-center text-xl md:text-2xl font-black border-2 animate-in zoom-in spin-in-3 duration-300 ${turn === 'white'
                                        ? 'bg-white text-slate-900 border-slate-200'
                                        : 'bg-slate-900 text-white border-slate-700'
                                        }`}
                                >
                                    {val}
                                </div>
                            ))}
                        </div>
                    </div>

                </div>

                {/* Off Tray Sidebar - Bottom on Mobile, Right on Desktop */}
                <div className="w-full h-20 md:w-32 md:h-auto bg-slate-900/40 rounded-xl border-4 border-slate-800 flex flex-row md:flex-col relative overflow-hidden shrink-0">
                    {/* Background Pattern or Label */}
                    <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[2px] bg-slate-800/50 hidden md:block" />
                    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[2px] bg-slate-800/50 md:hidden" />

                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 md:-rotate-90 text-slate-700 font-bold text-xs md:text-sm tracking-[0.5em] pointer-events-none whitespace-nowrap opacity-50 z-0">
                        COLLECT
                    </div>

                    {/* Top Collection (White) - Left on Mobile, Top on Desktop */}
                    <div className="flex-1 w-full p-2 flex flex-col gap-1 z-10 border-r md:border-r-0 md:border-b border-slate-800/50">
                        <OffTray
                            playerColor="white"
                            count={off.white}
                            isTop={true}
                        />
                    </div>

                    {/* Bottom Collection (Black) - Right on Mobile, Bottom on Desktop */}
                    <div className="flex-1 w-full p-2 flex flex-col-reverse gap-1 z-10">
                        <OffTray
                            playerColor="black"
                            count={off.black}
                            isTop={false}
                        />
                    </div>

                    {/* Shared Droppable Area */}
                    <div className={`absolute inset-0 z-20 ${activeId ? 'pointer-events-auto' : 'pointer-events-none'}`}>
                        <OffTrayDroppable isHighlighted={highlightedPoints.includes(99)} />
                    </div>
                </div>

            </div>

            <DragOverlay>
                {activeId ? (
                    <div className="w-12 h-12 md:w-14 md:h-14 cursor-grabbing">
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
            </DragOverlay>
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
            className={`w-full h-full flex items-center justify-center transition-all duration-300 ${isActive ? 'bg-indigo-500/30 backdrop-blur-sm border-2 border-dashed border-indigo-400' : ''}`}
        >
            {isActive && (
                <div className="text-indigo-200 font-bold text-xs rotate-90 whitespace-nowrap animate-pulse">
                    COLLECT
                </div>
            )}
        </div>
    );
};

const OffTray: React.FC<{ playerColor: string; count: number, isTop: boolean }> = ({ playerColor, count, isTop }) => {
    // This is purely visual now, droppable is separate
    return (
        <div
            className={`w-full flex ${isTop ? 'flex-col' : 'flex-col-reverse'} gap-[2px] transition-colors rounded-lg p-1`}
        >
            {/* Show count if many? */}
            {count > 0 && <div className={`text-[10px] text-center mb-1 font-bold ${playerColor === 'white' ? 'text-slate-400' : 'text-slate-600'}`}>{count}</div>}

            {Array.from({ length: Math.min(count, 15) }).map((_, i) => (
                <div key={i} className={`h-2 w-full rounded-sm opacity-80 ${playerColor === 'white' ? 'bg-slate-200 shadow-sm' : 'bg-slate-900 border border-slate-700 shadow-sm'}`} />
            ))}
        </div>
    );
};
