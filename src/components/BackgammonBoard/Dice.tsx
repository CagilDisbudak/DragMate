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

    const isWhite = color === 'white';

    const faceStyle: React.CSSProperties = isWhite
        ? {
            background: 'linear-gradient(145deg, #fffdf6 0%, #f0ebdc 55%, #d9d1ba 100%)',
            boxShadow: 'inset 0 2px 2px rgba(255,255,255,0.9), inset 0 -3px 5px rgba(120,100,60,0.3), 0 5px 10px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.15)',
        }
        : {
            background: 'linear-gradient(145deg, #3b4457 0%, #1d2432 55%, #0d1119 100%)',
            boxShadow: 'inset 0 2px 2px rgba(148,163,184,0.3), inset 0 -3px 5px rgba(0,0,0,0.75), 0 5px 10px rgba(0,0,0,0.6), 0 1px 0 rgba(255,255,255,0.08)',
        };

    const pipStyle: React.CSSProperties = isWhite
        ? {
            background: 'radial-gradient(circle at 35% 30%, #3b4759 0%, #10182a 75%)',
            boxShadow: 'inset 0 1px 1.5px rgba(0,0,0,0.7), 0 1px 0 rgba(255,255,255,0.4)',
        }
        : {
            background: 'radial-gradient(circle at 35% 30%, #ffffff 0%, #c7d1e0 75%)',
            boxShadow: 'inset 0 -1px 1.5px rgba(0,0,0,0.35), 0 1px 1px rgba(0,0,0,0.5)',
        };

    return (
        <div
            className={`
                w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center
                border ${isWhite ? 'border-amber-100/40' : 'border-slate-500/30'}
                transition-transform duration-300 relative select-none
                ${isRolling ? '' : 'hover:scale-105'}
            `}
            style={{
                ...faceStyle,
                animation: isRolling ? 'dice-shake 0.45s ease-in-out infinite' : undefined,
                filter: isRolling ? 'blur(1.2px)' : undefined,
            }}
        >
            <style>
                {`
                @keyframes dice-shake {
                    0%   { transform: translate(0, 0) rotate(0deg) scale(1.08); }
                    20%  { transform: translate(-2px, 1px) rotate(-9deg) scale(1.08); }
                    40%  { transform: translate(2px, -2px) rotate(7deg) scale(1.08); }
                    60%  { transform: translate(-2px, -1px) rotate(-6deg) scale(1.08); }
                    80%  { transform: translate(2px, 2px) rotate(9deg) scale(1.08); }
                    100% { transform: translate(0, 0) rotate(0deg) scale(1.08); }
                }
                `}
            </style>

            <div className="grid grid-cols-3 grid-rows-3 gap-1 w-[70%] h-[70%]">
                {Array.from({ length: 9 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-center">
                        {pips[displayValue].includes(i) && (
                            <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full" style={pipStyle} />
                        )}
                    </div>
                ))}
            </div>

            {/* Glossy top-light overlay */}
            <div
                className="absolute inset-0 pointer-events-none rounded-xl"
                style={{ background: 'linear-gradient(155deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.04) 40%, transparent 55%)' }}
            />
        </div>
    );
};
