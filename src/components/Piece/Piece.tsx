import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { pieceIcons } from '../../logic/pieceIcons';

interface PieceProps {
    id: string;
    type: string;
    color: string;
    isDraggable?: boolean;
}

export const Piece: React.FC<PieceProps> = ({ id, type, color, isDraggable = true }) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id,
        disabled: !isDraggable,
        data: {
            type,
            color,
        }
    });

    const style: React.CSSProperties = {
        transform: CSS.Translate.toString(transform),
        transition: isDragging ? 'none' : 'transform 120ms ease-out, scale 120ms ease-out',
        zIndex: isDragging ? 9999 : 20,
        // Inline: `.chess-piece` sets `filter` in plain CSS, which outranks utility classes.
        filter: isDragging ? 'drop-shadow(0 14px 18px rgba(2, 6, 23, 0.55))' : undefined,
    };

    // Both colors render the solid glyph so the piece body can be tinted:
    // ivory-white with a dark edge vs deep charcoal with a faint light edge.
    const glyphStyle: React.CSSProperties = color === 'w'
        ? {
            color: '#f8f4e9',
            WebkitTextStroke: '1px rgba(30, 27, 75, 0.55)',
            textShadow: '0 2px 5px rgba(2, 6, 23, 0.4)',
        }
        : {
            color: '#20222e',
            WebkitTextStroke: '1px rgba(203, 213, 225, 0.28)',
            textShadow: '0 2px 5px rgba(2, 6, 23, 0.55)',
        };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            className={`chess-piece ${
                isDragging
                    ? 'scale-115'
                    : isDraggable
                        ? 'hover:scale-107 hover:-translate-y-0.5'
                        : ''
            } ${isDraggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}`}
        >
            <span aria-hidden="true" style={glyphStyle}>
                {pieceIcons.b[type]}
            </span>
        </div>
    );
};
