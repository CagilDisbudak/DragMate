
import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Checker } from './Checker';

interface PointProps {
    index: number; // 0-23
    count: number; // >0 white, <0 black
    isTop: boolean; // Top row (12-23) vs Bottom row (0-11)
    isHighlighted?: boolean;
    onDragStart?: (id: string) => void;
    playerColor: 'white' | 'black';
    canDragFrom: boolean;
}

export const Point: React.FC<PointProps> = ({ index, count, isTop, isHighlighted, playerColor, canDragFrom }) => {
    const { setNodeRef, isOver } = useDroppable({
        id: index.toString(),
    });

    // Triangle Visuals
    // Top row triangles point DOWN. Bottom row triangles point UP.
    // Colors alternate. Even index might be one color, odd another.
    // Standard: Point 1 (index 0) is usually Black's home, so color depends on setup.
    // Let's stick to alternating colors.
    const isDark = index % 2 === 1; // Arbitrary pattern

    // const triangleColor = isDark ? 'border-b-slate-700/80' : 'border-b-indigo-500/20'; // Unused
    // const triangleColorTop = isDark ? 'border-t-slate-700/80' : 'border-t-indigo-500/20'; // Unused

    const highlightClass = (isOver || isHighlighted) ? 'bg-indigo-500/20 ring-2 ring-indigo-400/50' : '';

    const checkersList = [];
    const absCount = Math.abs(count);
    const checkerColor = count > 0 ? 'white' : 'black';

    // We only render up to X checkers, or handle stacking logic
    // const MAX_STACK = 5; // Unused for now

    // Create checker elements
    for (let i = 0; i < absCount; i++) {
        // Only the TOP checker is draggable
        const isTopChecker = i === absCount - 1;
        const isDraggable = canDragFrom && isTopChecker && checkerColor === playerColor;

        // Stacking visual offset
        // For bottom row, stack goes UP. For top row, stack goes DOWN.
        // We can just use flex traverse or absolute positioning.
        // Let's use flex-col-reverse for bottom, flex-col for top

        checkersList.push(
            <div key={`${index}-${i}`} className="w-[80%] max-w-[40px] -my-1 z-10 relative">
                <Checker
                    id={`checker-${index}-${i}`}
                    color={checkerColor}
                    isDraggable={isDraggable}
                />
            </div>
        );
    }

    return (
        <div
            ref={setNodeRef}
            className={`relative flex-1 h-full flex ${isTop ? 'flex-col items-center justify-start' : 'flex-col-reverse items-center justify-start'} ${highlightClass} transition-colors rounded-sm`}
        >
            {/* The Triangle Background */}
            <div
                className={`absolute inset-0 pointer-events-none w-full h-full opacity-60`}
                style={{
                    // CSS Triangle hack or Clip Path
                    // Clip path is better for responsive
                    clipPath: isTop
                        ? 'polygon(0 0, 50% 100%, 100% 0)'
                        : 'polygon(0 100%, 50% 0, 100% 100%)',
                    backgroundColor: isDark ? '#334155' : '#818cf8', // Slate-700 vs Indigo-400
                    opacity: isDark ? 0.4 : 0.15
                }}
            />

            {/* Checkers Container */}
            <div className={`z-10 w-full h-full flex ${isTop ? 'flex-col pt-2' : 'flex-col-reverse pb-2'} items-center`}>
                {checkersList}
            </div>

            {/* Point Number (Optional debugging or visual aid) */}
            <span className={`absolute ${isTop ? 'top-0' : 'bottom-0'} text-[8px] text-slate-600 font-mono opacity-50`}>
                {index + 1}
            </span>
        </div>
    );
};
