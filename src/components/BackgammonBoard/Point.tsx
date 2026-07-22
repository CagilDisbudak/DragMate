
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

    // Triangle tones — alternating deep emerald and warm sand, base-to-tip gradient.
    const isDark = index % 2 === 1;
    const tone = isDark
        ? { from: '#13462f', to: '#0a231a', stroke: 'rgba(110, 231, 183, 0.14)' }
        : { from: '#a89060', to: '#5c4e33', stroke: 'rgba(255, 244, 214, 0.16)' };

    const isTargeted = isOver || isHighlighted;

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
                min-w-[20px] px-1.5 py-0.5 rounded-full text-[10px] font-display font-bold text-center
                shadow-[0_2px_5px_rgba(0,0,0,0.5)] anim-pop-in
                ${checkerColor === 'white'
                    ? 'bg-linear-to-b from-white to-slate-200 text-slate-900 border border-amber-200/60'
                    : 'bg-linear-to-b from-slate-700 to-slate-900 text-slate-100 border border-slate-500/60'
                }`}
        >
            {absCount}
        </div>
    ) : null;

    return (
        <div
            ref={setNodeRef}
            className={`relative flex-1 h-full flex ${isTop ? 'flex-col items-center justify-start' : 'flex-col-reverse items-center justify-start'} transition-colors duration-200 rounded-sm`}
        >
            {/* The Triangle — SVG for crisp gradient fill + thin outline */}
            <svg
                className="absolute inset-0 w-full h-full pointer-events-none"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                aria-hidden="true"
            >
                <defs>
                    <linearGradient
                        id={`pt-grad-${index}`}
                        x1="0" x2="0"
                        y1={isTop ? '0' : '1'}
                        y2={isTop ? '1' : '0'}
                    >
                        <stop offset="0%" stopColor={tone.from} />
                        <stop offset="100%" stopColor={tone.to} />
                    </linearGradient>
                </defs>
                <polygon
                    points={isTop ? '2,0 50,96 98,0' : '2,100 50,4 98,100'}
                    fill={`url(#pt-grad-${index})`}
                    stroke={tone.stroke}
                    strokeWidth="1.5"
                    vectorEffect="non-scaling-stroke"
                />
            </svg>

            {/* Valid-target highlight: soft emerald glow + pulsing ring */}
            {isTargeted && (
                <>
                    <div
                        className={`absolute inset-0 z-0 pointer-events-none rounded-sm ${isOver ? 'bg-emerald-400/20' : 'bg-emerald-500/10'}`}
                        style={{ boxShadow: 'inset 0 0 22px rgba(16, 185, 129, 0.3)' }}
                    />
                    <div
                        className={`absolute inset-0.5 z-20 pointer-events-none rounded-md border-2 animate-pulse ${isOver ? 'border-emerald-300/90' : 'border-emerald-400/60'}`}
                        style={{ boxShadow: '0 0 20px -4px rgba(16, 185, 129, 0.6)' }}
                    />
                    <div
                        className={`absolute ${isTop ? 'bottom-2' : 'top-2'} left-1/2 -translate-x-1/2 z-20 w-2 h-2 rounded-full bg-emerald-400/90 animate-ping pointer-events-none`}
                    />
                </>
            )}

            {/* Checkers Container */}
            <div className={`z-10 w-full h-full flex ${isTop ? 'flex-col pt-2' : 'flex-col-reverse pb-2'} items-center overflow-hidden`}>
                {checkersList}
            </div>

            {/* Count Badge for stacked checkers */}
            {countBadge}

            {/* Hit Effect - Shattering Checker + emerald/red impact pulse */}
            {isHitTarget && (
                <div className={`absolute ${isTop ? 'top-6' : 'bottom-6'} left-1/2 -translate-x-1/2 z-50 pointer-events-none`}>
                    <style>
                        {`
                        @keyframes shatter-left {
                            0% { transform: translate(0, 0) rotate(0deg); opacity: 1; }
                            100% { transform: translate(-22px, -12px) rotate(-18deg); opacity: 0; }
                        }
                        @keyframes shatter-right {
                            0% { transform: translate(0, 0) rotate(0deg); opacity: 1; }
                            100% { transform: translate(22px, -12px) rotate(18deg); opacity: 0; }
                        }
                        @keyframes impact-flash {
                            0% { transform: scale(0.4); opacity: 0; }
                            15% { transform: scale(1.25); opacity: 1; }
                            100% { transform: scale(1.6); opacity: 0; }
                        }
                        @keyframes impact-ring {
                            0% { transform: scale(0.5); opacity: 1; }
                            100% { transform: scale(2); opacity: 0; }
                        }
                        `}
                    </style>
                    <div className="relative w-10 h-10 md:w-12 md:h-12">
                        {(() => {
                            const victimColor = count > 0 ? 'black' : 'white';
                            const halfStyle: React.CSSProperties = victimColor === 'white'
                                ? {
                                    background: 'radial-gradient(circle at 32% 28%, #ffffff 0%, #f0ebdc 40%, #c9c0a4 100%)',
                                    boxShadow: 'inset 0 -3px 5px rgba(94,77,44,0.4)',
                                }
                                : {
                                    background: 'radial-gradient(circle at 32% 28%, #414c60 0%, #1c2331 45%, #05070c 100%)',
                                    boxShadow: 'inset 0 -3px 5px rgba(0,0,0,0.8)',
                                };
                            const ringBorder = victimColor === 'white' ? 'border-amber-950/25' : 'border-slate-400/25';

                            return (
                                <>
                                    {/* Left Half */}
                                    <div
                                        className="absolute inset-0 rounded-full overflow-hidden"
                                        style={{
                                            ...halfStyle,
                                            clipPath: 'polygon(0% 0%, 55% 0%, 45% 100%, 0% 100%)',
                                            animation: 'shatter-left 0.6s ease-out forwards',
                                        }}
                                    >
                                        <div className={`absolute inset-2 rounded-full border-2 ${ringBorder}`} />
                                    </div>

                                    {/* Right Half */}
                                    <div
                                        className="absolute inset-0 rounded-full overflow-hidden"
                                        style={{
                                            ...halfStyle,
                                            clipPath: 'polygon(55% 0%, 100% 0%, 100% 100%, 45% 100%)',
                                            animation: 'shatter-right 0.6s ease-out forwards',
                                        }}
                                    >
                                        <div className={`absolute inset-2 rounded-full border-2 ${ringBorder}`} />
                                    </div>

                                    {/* Red impact flash */}
                                    <div
                                        className="absolute -inset-2 rounded-full"
                                        style={{
                                            background: 'radial-gradient(circle, rgba(239,68,68,0.6) 0%, rgba(239,68,68,0) 70%)',
                                            animation: 'impact-flash 0.5s ease-out forwards',
                                        }}
                                    />
                                    {/* Emerald shock ring */}
                                    <div
                                        className="absolute inset-0 rounded-full border-2 border-emerald-400/80"
                                        style={{ animation: 'impact-ring 0.7s ease-out forwards' }}
                                    />
                                </>
                            );
                        })()}
                    </div>
                </div>
            )}

            {/* Point Number */}
            <span className={`absolute ${isTop ? 'top-0.5' : 'bottom-0.5'} text-[8px] font-display text-white/25 pointer-events-none select-none`}>
                {index + 1}
            </span>
        </div>
    );
};
