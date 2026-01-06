
import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Checker } from './Checker';

interface PointProps {
    index: number; // 0-23
    count: number; // >0 white, <0 black
    isTop: boolean; // Top row (12-23) vs Bottom row (0-11)
    isHitTarget?: boolean;
    isHighlighted?: boolean;
    onDragStart?: (id: string) => void;
    playerColor: 'white' | 'black';
    canDragFrom: boolean;
}

export const Point: React.FC<PointProps> = ({ index, count, isTop, isHighlighted, playerColor, canDragFrom, isHitTarget }) => {
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

    const absCount = Math.abs(count);
    const checkerColor = count > 0 ? 'white' : 'black';

    // Limit visible checkers to prevent overflow
    const MAX_VISIBLE = 5;
    const visibleCount = Math.min(absCount, MAX_VISIBLE);
    const hasOverflow = absCount > MAX_VISIBLE;

    // Dynamic overlap based on count - more checkers = more overlap
    const getOverlapClass = () => {
        if (absCount <= 3) return '-my-0.5';
        if (absCount <= 5) return '-my-1';
        return '-my-1.5';
    };

    const checkersList = [];

    // Create checker elements (only visible ones)
    for (let i = 0; i < visibleCount; i++) {
        // Only the TOP checker is draggable (now top of visible stack)
        const isTopChecker = i === visibleCount - 1;
        const isDraggable = canDragFrom && isTopChecker && checkerColor === playerColor;

        checkersList.push(
            <div key={`${index}-${i}`} className={`w-[80%] max-w-[40px] ${getOverlapClass()} z-10 relative`}>
                <Checker
                    id={`checker-${index}-${i}`}
                    color={checkerColor}
                    isDraggable={isDraggable}
                />
            </div>
        );
    }

    // Add count badge if there's overflow
    const countBadge = hasOverflow ? (
        <div
            className={`absolute ${isTop ? 'bottom-1' : 'top-1'} left-1/2 -translate-x-1/2 z-20 
                px-1.5 py-0.5 rounded-full text-[10px] font-bold shadow-lg
                ${checkerColor === 'white'
                    ? 'bg-slate-100 text-slate-800 border border-slate-300'
                    : 'bg-slate-800 text-slate-100 border border-slate-600'
                }`}
        >
            {absCount}
        </div>
    ) : null;

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
            <div className={`z-10 w-full h-full flex ${isTop ? 'flex-col pt-2' : 'flex-col-reverse pb-2'} items-center overflow-hidden`}>
                {checkersList}
            </div>

            {/* Count Badge for stacked checkers */}
            {countBadge}

            {/* Hit Effect */}
            {/* Hit Effect - Shattering Checker */}
            {isHitTarget && (
                <div className={`absolute ${isTop ? 'top-6' : 'bottom-6'} left-1/2 -translate-x-1/2 z-50 pointer-events-none`}>
                    <style>
                        {`
                        @keyframes shatter-left {
                            0% { transform: translate(0, 0) rotate(0deg); opacity: 1; }
                            100% { transform: translate(-20px, -10px) rotate(-15deg); opacity: 0; }
                        }
                        @keyframes shatter-right {
                            0% { transform: translate(0, 0) rotate(0deg); opacity: 1; }
                            100% { transform: translate(20px, -10px) rotate(15deg); opacity: 0; }
                        }
                        @keyframes impact-flash {
                            0% { transform: scale(0.5); opacity: 0; }
                            10% { transform: scale(1.2); opacity: 1; }
                            100% { transform: scale(0); opacity: 0; }
                        }
                        `}
                    </style>
                    <div className="relative w-10 h-10 md:w-12 md:h-12">
                        {(() => {
                            const victimColor = count > 0 ? 'black' : 'white';
                            const baseClass = victimColor === 'white'
                                ? 'bg-slate-200 border-slate-300 shadow-sm'
                                : 'bg-slate-900 border-slate-700 shadow-xl';
                            const innerBorder = victimColor === 'white' ? 'border-slate-300' : 'border-slate-700';

                            return (
                                <>
                                    {/* Left Half */}
                                    <div
                                        className={`absolute inset-0 rounded-full border-4 ${baseClass} overflow-hidden`}
                                        style={{
                                            clipPath: 'polygon(0% 0%, 55% 0%, 45% 100%, 0% 100%)',
                                            animation: 'shatter-left 0.6s ease-out forwards'
                                        }}
                                    >
                                        <div className={`absolute inset-2 rounded-full border-2 ${innerBorder} opacity-30`} />
                                    </div>

                                    {/* Right Half */}
                                    <div
                                        className={`absolute inset-0 rounded-full border-4 ${baseClass} overflow-hidden`}
                                        style={{
                                            clipPath: 'polygon(55% 0%, 100% 0%, 100% 100%, 45% 100%)',
                                            animation: 'shatter-right 0.6s ease-out forwards'
                                        }}
                                    >
                                        <div className={`absolute inset-2 rounded-full border-2 ${innerBorder} opacity-30`} />
                                    </div>

                                    {/* Impact Flash */}
                                    <div className="absolute inset-0 bg-white rounded-full mix-blend-overlay" style={{ animation: 'impact-flash 0.4s ease-out forwards' }} />
                                </>
                            );
                        })()}
                    </div>
                </div>
            )}

            {/* Point Number (Optional debugging or visual aid) */}
            <span className={`absolute ${isTop ? 'top-0' : 'bottom-0'} text-[8px] text-slate-600 font-mono opacity-50`}>
                {index + 1}
            </span>
        </div>
    );
};
