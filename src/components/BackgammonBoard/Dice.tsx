import React, { useState, useEffect } from 'react';

interface DiceProps {
    value: number;
    isRolling: boolean;
    color: 'white' | 'black';
}

const pips: Record<number, number[]> = {
    1: [4],
    2: [0, 8],
    3: [0, 4, 8],
    4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 2, 3, 5, 6, 8],
};

export const Dice: React.FC<DiceProps> = ({ value, isRolling, color }) => {
    const [displayValue, setDisplayValue] = useState(value);

    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        if (isRolling) {
            interval = setInterval(() => {
                setDisplayValue(Math.floor(Math.random() * 6) + 1);
            }, 100);
        } else {
            setDisplayValue(value);
        }
        return () => clearInterval(interval);
    }, [isRolling, value]);

    const bgClass = color === 'white'
        ? 'bg-white text-slate-900 border-slate-200 shadow-lg'
        : 'bg-slate-900 text-white border-slate-700 shadow-xl';

    const pipClass = color === 'white' ? 'bg-slate-900' : 'bg-white';

    return (
        <div
            className={`
                w-10 h-10 md:w-12 md:h-12 rounded-lg flex items-center justify-center border-2 
                transition-all duration-300 relative
                ${bgClass}
                ${isRolling ? 'animate-bounce scale-110 rotate-12' : 'hover:scale-105'}
            `}
            style={{
                perspective: '1000px',
                transformStyle: 'preserve-3d',
            }}
        >
            <div className={`grid grid-cols-3 grid-rows-3 gap-1 w-[70%] h-[70%]`}>
                {Array.from({ length: 9 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-center">
                        {pips[displayValue].includes(i) && (
                            <div className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${pipClass} shadow-sm`} />
                        )}
                    </div>
                ))}
            </div>

            {/* Glossy overlay */}
            <div className="absolute inset-0 bg-linear-to-br from-white/20 to-transparent pointer-events-none rounded-lg" />
        </div>
    );
};
