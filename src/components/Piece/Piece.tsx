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

    const style = {
        transform: CSS.Translate.toString(transform),
        transition: 'transform 120ms ease-out',
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            className={`chess-piece relative z-20 transition-transform duration-150 ease-out ${
                isDragging ? 'scale-115 z-50 drop-shadow-2xl' : 'hover:scale-103'
            } ${isDraggable ? 'cursor-grab active:cursor-grabbing' : 'grayscale-[0.2] opacity-90 cursor-default'
            } ${color === 'w' ? 'text-slate-950 drop-shadow-sm' : 'text-slate-950 drop-shadow-sm'
            }`}
        >
            <div className={`
        flex items-center justify-center w-full h-full 
        ${color === 'w' ? 'drop-shadow-[0_2px_0_rgba(255,255,255,0.8)]' : 'drop-shadow-[0_2px_0_rgba(0,0,0,0.5)]'}
      `}>
                {pieceIcons[color][type]}
            </div>
        </div>
    );
};
