
import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

interface CheckerProps {
    id: string;
    color: 'white' | 'black';
    isDraggable?: boolean;
    style?: React.CSSProperties;
}

// Visual only component
export const CheckerVisual: React.FC<{ color: 'white' | 'black'; style?: React.CSSProperties; className?: string }> = ({ color, style, className = '' }) => {
    const bgClass = color === 'white'
        ? 'bg-slate-200 shadow-[inset_0_-4px_4px_rgba(0,0,0,0.2),0_4px_6px_rgba(0,0,0,0.3)] border-slate-300'
        : 'bg-slate-900 shadow-[inset_0_-4px_4px_rgba(0,0,0,0.5),0_4px_6px_rgba(0,0,0,0.4)] border-slate-700';

    const innerClass = color === 'white'
        ? 'border-slate-300'
        : 'border-slate-700';

    return (
        <div
            style={style}
            className={`w-full h-full rounded-full border-4 ${bgClass} relative flex items-center justify-center ${className}`}
        >
            <div className={`w-[70%] h-[70%] rounded-full border-2 ${innerClass} opacity-30`} />
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
            className={`w-full aspect-square relative cursor-grab active:cursor-grabbing`}
        >
            <CheckerVisual color={color} />
        </div>
    );
};
