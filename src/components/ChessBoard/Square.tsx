import React from 'react';
import { useDroppable } from '@dnd-kit/core';

interface SquareProps {
    id: string;
    isLight: boolean;
    isHighlighted?: boolean;
    children?: React.ReactNode;
}

export const Square: React.FC<SquareProps> = ({ id, isLight, isHighlighted = false, children }) => {
    const { isOver, setNodeRef } = useDroppable({
        id,
    });

    return (
        <div
            ref={setNodeRef}
            className={`chess-square relative transition-all duration-200 ${
                isOver
                    ? 'bg-indigo-500/40 scale-95 z-10 rounded-xl shadow-[0_0_40px_rgba(99,102,241,0.5)]'
                    : isHighlighted
                    ? (isLight ? 'bg-emerald-300/70' : 'bg-emerald-500/70')
                    : isLight
                        ? 'bg-slate-200'
                        : 'bg-slate-400'
            }`}
        >
            <div className={`absolute top-1 left-1 text-[10px] font-black uppercase tracking-tighter opacity-20 pointer-events-none ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                {id}
            </div>
            {children}
        </div>
    );
};
