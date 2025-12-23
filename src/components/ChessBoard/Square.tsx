import React from 'react';
import { useDroppable } from '@dnd-kit/core';

interface SquareProps {
    id: string;
    isLight: boolean;
    isHighlighted?: boolean;
    isActive?: boolean;
    children?: React.ReactNode;
}

export const Square: React.FC<SquareProps> = ({ id, isLight, isHighlighted = false, isActive = false, children }) => {
    const { isOver, setNodeRef } = useDroppable({
        id,
    });

    return (
        <div
            ref={setNodeRef}
            className={`chess-square ${isActive ? 'z-50 relative' : 'overflow-hidden'
                } ${isOver
                    ? 'bg-indigo-500/60 shadow-[inset_0_0_20px_rgba(255,255,255,0.2)] z-10'
                    : isHighlighted
                        ? (isLight ? 'bg-indigo-400/50 shadow-inner' : 'bg-indigo-600/50 shadow-inner')
                        : isLight
                            ? 'bg-[#cbd5e1] text-slate-700 shadow-[inset_0_1px_4px_rgba(255,255,255,0.3)]' /* Slate-300ish but colder */
                            : 'bg-[#334155] text-slate-400 shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]' /* Slate-700 */
                }`}
        >
            <div className={`absolute top-1 left-1 text-[10px] font-black uppercase tracking-tighter opacity-20 pointer-events-none ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                {id}
            </div>
            <div className="relative w-full h-full overflow-visible z-10">
                {children}
            </div>
        </div>
    );
};
