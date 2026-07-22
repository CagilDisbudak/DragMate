
import React from 'react';
import { useDraggable } from '@dnd-kit/core';

interface CheckerProps {
    id: string;
    color: 'white' | 'black';
    isDraggable?: boolean;
    style?: React.CSSProperties;
}

// Visual only component — glossy radial-gradient puck with rim light + groove ring.
export const CheckerVisual: React.FC<{ color: 'white' | 'black'; style?: React.CSSProperties; className?: string }> = ({ color, style, className = '' }) => {
    const isWhite = color === 'white';

    return (
        <div
            style={{
                background: isWhite
                    ? 'radial-gradient(circle at 32% 28%, #ffffff 0%, #f4f0e4 35%, #ddd5bf 68%, #b4a988 100%)'
                    : 'radial-gradient(circle at 32% 28%, #4b5568 0%, #272e40 40%, #131722 75%, #05070c 100%)',
                boxShadow: isWhite
                    ? 'inset 0 2px 3px rgba(255,255,255,0.95), inset 0 -3px 6px rgba(94,77,44,0.45), 0 3px 7px rgba(0,0,0,0.5)'
                    : 'inset 0 2px 3px rgba(148,163,184,0.35), inset 0 -3px 6px rgba(0,0,0,0.85), 0 3px 7px rgba(0,0,0,0.6)',
                ...style,
            }}
            className={`w-full h-full rounded-full relative flex items-center justify-center ${className}`}
        >
            {/* Lathe groove ring */}
            <div
                className={`w-[66%] h-[66%] rounded-full border ${isWhite ? 'border-amber-950/25' : 'border-slate-400/25'}`}
                style={{
                    boxShadow: isWhite
                        ? 'inset 0 1px 2px rgba(110,88,46,0.3), 0 1px 0 rgba(255,255,255,0.5)'
                        : 'inset 0 1px 2px rgba(0,0,0,0.7), 0 1px 0 rgba(148,163,184,0.15)',
                }}
            />
            {/* Rim light sweep */}
            <div
                className="absolute inset-0 rounded-full pointer-events-none"
                style={{
                    background: 'linear-gradient(155deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.05) 30%, transparent 45%)',
                    opacity: isWhite ? 0.55 : 0.3,
                }}
            />
        </div>
    );
};

export const Checker: React.FC<CheckerProps> = ({ id, color, isDraggable = false, style }) => {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id,
        disabled: !isDraggable,
    });

    const combinedStyle: React.CSSProperties = {
        // If using DragOverlay, we typically hide the source or keep it static.
        // We want 'lift' behavior, so source is invisible but takes space.
        opacity: isDragging ? 0 : 1,
        touchAction: 'none',
        ...style,
    };

    return (
        <div
            ref={setNodeRef}
            style={combinedStyle}
            {...listeners}
            {...attributes}
            // Ensure wrapper creates a proper context for size
            className={`w-full aspect-square relative transition-transform duration-150 ${isDraggable ? 'cursor-grab active:cursor-grabbing hover:scale-105 hover:-translate-y-0.5' : 'cursor-default'}`}
        >
            <CheckerVisual color={color} />
        </div>
    );
};
