// Basic Dnd-kit imports
import { useDraggable, useDroppable } from '@dnd-kit/core';

import React from 'react';
import type { OkeyTile as OkeyTileType } from '../../logic/okeyLogic';
import { OkeyTile } from './OkeyTile';

interface PlayerRackProps {
    tiles: (OkeyTileType | null)[];
    playerId: number;
    isCurrentPlayer?: boolean;
    okeyTile: OkeyTileType | null;
}

interface RackSlotProps {
    tile: OkeyTileType | null;
    isJoker: boolean;
    index: number;
    okeyTile: OkeyTileType | null;
}

const RackSlot: React.FC<RackSlotProps> = React.memo(({ tile, isJoker, index, okeyTile }) => {
    const slotId = `slot-${index}`;
    const { setNodeRef: setDroppableRef, isOver } = useDroppable({ id: slotId });

    const {
        attributes,
        listeners,
        setNodeRef: setDraggableRef,
        isDragging,
    } = useDraggable({
        id: slotId,
        disabled: !tile
    });

    return (
        <div
            ref={setDroppableRef}
            className={`
                relative w-[clamp(1.3rem,5.6vw,3.25rem)] h-[clamp(1.8rem,7.5vw,4.25rem)] rounded-lg flex items-center justify-center transition-all duration-150
                ${isOver
                    ? 'bg-amber-400/25 ring-2 ring-amber-400 scale-105 z-20 shadow-[0_0_18px_rgba(251,191,36,0.45)]'
                    : 'bg-black/25 ring-1 ring-black/30 shadow-[inset_0_2px_5px_rgba(0,0,0,0.45),inset_0_-1px_0_rgba(255,255,255,0.05)]'}
            `}
        >
            {tile && (
                <div
                    ref={setDraggableRef}
                    {...attributes}
                    {...listeners}
                    className={`relative z-10 w-full h-full p-px touch-none ${isDragging ? 'opacity-20' : 'cursor-grab active:cursor-grabbing transition-transform duration-150 hover:-translate-y-1'}`}
                    style={{ willChange: isDragging ? 'transform' : 'auto' }}
                >
                    <OkeyTile
                        tile={tile}
                        okeyTile={okeyTile}
                        isJoker={isJoker}
                        dragging={isDragging}
                        size="fit"
                    />
                </div>
            )}

            {/* Slot depth effect */}
            {!tile && !isOver && (
                <div className="w-1.5 h-1.5 rounded-full bg-white/10 shadow-[0_1px_0_rgba(255,255,255,0.08)]" />
            )}
        </div>
    );
});

export const PlayerRack: React.FC<PlayerRackProps> = ({ tiles, isCurrentPlayer, okeyTile }) => {

    if (!isCurrentPlayer) {
        // Opponents see a compact face-down fan (tile faces stay hidden)
        const actualTiles = tiles.filter(t => t !== null);
        const fanAngle = (i: number, count: number) => (i - (count - 1) / 2) * 2;
        const topCount = Math.min(actualTiles.length, 11);
        const bottomCount = Math.max(0, actualTiles.length - 11);
        return (
            <div className="flex flex-col gap-1 items-center">
                <div className="flex justify-center items-end gap-0.5 wood-surface px-2.5 py-2 rounded-lg border-b-4 border-black/50 drop-shadow-lg">
                    {Array.from({ length: topCount }).map((_, i) => (
                        <div
                            key={i}
                            className="w-6 h-8 tile-back rounded-sm"
                            style={{ transform: `rotate(${fanAngle(i, topCount)}deg)` }}
                        />
                    ))}
                </div>
                {bottomCount > 0 && (
                    <div className="flex justify-center items-end gap-0.5 wood-surface px-2.5 py-2 rounded-lg border-b-4 border-black/50 drop-shadow-lg -mt-1 scale-95 opacity-80">
                        {Array.from({ length: bottomCount }).map((_, i) => (
                            <div
                                key={i}
                                className="w-6 h-8 tile-back rounded-sm"
                                style={{ transform: `rotate(${fanAngle(i, bottomCount)}deg)` }}
                            />
                        ))}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="relative w-full max-w-none mx-auto flex flex-col items-center select-none">
            {/* The wooden istaka */}
            <div className="relative w-full sm:w-[92%] max-w-[900px] wood-surface rounded-xl border-b-8 border-[#2a180c] p-1.5 sm:p-4 flex flex-col gap-1.5 sm:gap-2 drop-shadow-[0_20px_28px_rgba(0,0,0,0.55)]">
                {/* Rim highlight */}
                <div className="absolute inset-0 rounded-xl ring-1 ring-white/10 pointer-events-none" />

                {/* Top shelf (slots 0-14) */}
                <div className="relative flex justify-center gap-0.5 sm:gap-1 rounded-lg bg-black/20 px-1 py-1 sm:px-1.5 sm:py-1.5 shadow-[inset_0_3px_8px_rgba(0,0,0,0.5)] border-b-4 border-black/35 z-10">
                    {tiles.slice(0, 15).map((tile, i) => {
                        const isActualOkey = okeyTile && tile && tile.color === okeyTile.color && tile.value === okeyTile.value;
                        return (
                            <RackSlot
                                key={i}
                                index={i}
                                tile={tile}
                                okeyTile={okeyTile}
                                isJoker={isActualOkey || false}
                            />
                        );
                    })}
                </div>

                {/* Bottom shelf (slots 15-29) */}
                <div className="relative flex justify-center gap-0.5 sm:gap-1 rounded-lg bg-black/20 px-1 py-1 sm:px-1.5 sm:py-1.5 shadow-[inset_0_3px_8px_rgba(0,0,0,0.5)] border-b-4 border-black/35 z-10">
                    {tiles.slice(15, 30).map((tile, i) => {
                        const actualIndex = i + 15;
                        const isActualOkey = okeyTile && tile && tile.color === okeyTile.color && tile.value === okeyTile.value;
                        return (
                            <RackSlot
                                key={actualIndex}
                                index={actualIndex}
                                tile={tile}
                                okeyTile={okeyTile}
                                isJoker={isActualOkey || false}
                            />
                        );
                    })}
                </div>
            </div>

            {/* Shelf hint */}
            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-amber-500/25 bg-amber-500/10 backdrop-blur-md text-[10px] font-bold uppercase tracking-widest text-amber-300/90">
                Taşları Sürükleyerek Düzenleyebilirsiniz
            </div>
        </div>
    );
};
