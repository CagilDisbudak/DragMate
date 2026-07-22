import React from 'react';
import { useDroppable } from '@dnd-kit/core';

interface SquareProps {
    id: string;
    isLight: boolean;
    isHighlighted?: boolean;
    isActive?: boolean;
    /** Highlighted square contains an enemy piece → render a capture ring instead of a dot. */
    isCapture?: boolean;
    /** Part of the last played move → soft accent tint. */
    isLastMove?: boolean;
    children?: React.ReactNode;
}

export const Square: React.FC<SquareProps> = ({
    id,
    isLight,
    isHighlighted = false,
    isActive = false,
    isCapture = false,
    isLastMove = false,
    children
}) => {
    const { isOver, setNodeRef } = useDroppable({
        id,
    });

    return (
        <div
            ref={setNodeRef}
            className={`chess-square ${isActive ? 'z-50' : 'overflow-hidden'} ${
                isLight ? 'bg-[#ebe5d5]' : 'bg-[#4a5578]'
            }`}
        >
            {/* Last-move tint */}
            {isLastMove && (
                <div className={`absolute inset-0 pointer-events-none ${isLight ? 'bg-indigo-500/25' : 'bg-indigo-400/30'}`} />
            )}

            {/* Active (drag source) glow */}
            {isActive && (
                <div className="absolute inset-0 pointer-events-none bg-indigo-400/30 shadow-[inset_0_0_20px_rgba(129,140,248,0.55)]" />
            )}

            {/* Drop-target ring while hovering a drag over this square */}
            {isOver && (
                <div className="absolute inset-[5%] z-10 pointer-events-none rounded-xl bg-indigo-400/25 ring-2 lg:ring-[3px] ring-indigo-300/90 shadow-[inset_0_0_16px_rgba(165,180,252,0.45)]" />
            )}

            {/* Legal-move markers: centered dot for quiet moves, ring for captures */}
            {isHighlighted && !isOver && (
                isCapture ? (
                    <div className="absolute inset-[5%] z-10 pointer-events-none rounded-full border-[3px] lg:border-4 border-indigo-500/60" />
                ) : (
                    <div
                        className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none w-[26%] h-[26%] rounded-full ${
                            isLight ? 'bg-indigo-950/25' : 'bg-indigo-200/35'
                        }`}
                    />
                )
            )}

            <div className="relative w-full h-full overflow-visible z-20">
                {children}
            </div>
        </div>
    );
};
