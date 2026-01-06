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
                relative w-13 h-17 rounded-lg shadow-inner flex items-center justify-center
                ${isOver ? 'bg-green-500/30 ring-4 ring-green-400 scale-110 z-20 shadow-2xl transition-transform duration-150' : 'bg-black/15 border border-black/10'}
            `}
        >
            {tile && (
                <div
                    ref={setDraggableRef}
                    {...attributes}
                    {...listeners}
                    className={`relative z-10 touch-none ${isDragging ? 'opacity-20' : ''}`}
                    style={{ willChange: isDragging ? 'transform' : 'auto' }}
                >
                    <OkeyTile
                        tile={tile}
                        okeyTile={okeyTile}
                        isJoker={isJoker}
                        dragging={isDragging}
                    />
                </div>
            )}

            {/* Slot depth effect */}
            {!tile && !isOver && (
                <div className="w-1.5 h-1.5 rounded-full bg-black/5" />
            )}
        </div>
    );
});

export const PlayerRack: React.FC<PlayerRackProps> = ({ tiles, isCurrentPlayer, okeyTile }) => {

    if (!isCurrentPlayer) {
        // Opponents still see a condensed view for UI space
        const actualTiles = tiles.filter(t => t !== null);
        return (
            <div className="flex flex-col gap-1 items-center">
                <div className="flex justify-center items-center gap-1 bg-[#2a1b0e] p-2 rounded border border-[#3d2a1a] shadow-2xl">
                    {Array.from({ length: Math.min(actualTiles.length, 11) }).map((_, i) => (
                        <div
                            key={i}
                            className="w-6 h-8 bg-[#f5f5f5] rounded-sm transform -skew-x-2 border-b-2 border-slate-400 shadow-sm"
                        />
                    ))}
                </div>
                <div className="flex justify-center items-center gap-1 bg-[#2a1b0e] p-2 rounded border border-[#3d2a1a] shadow-2xl -mt-1 scale-95 opacity-80">
                    {Array.from({ length: Math.max(0, actualTiles.length - 11) }).map((_, i) => (
                        <div
                            key={i}
                            className="w-6 h-8 bg-[#f5f5f5] rounded-sm transform -skew-x-1 border-b-2 border-slate-400 shadow-sm"
                        />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="relative w-full max-w-none mx-auto flex flex-col items-center select-none">
            {/* The Wooden Rack Structure */}
            <div className="relative w-[85%] bg-[#8d5b3e] rounded-sm shadow-[0_20px_40px_rgba(0,0,0,0.6)] border-b-8 border-[#3d251e] p-4 flex flex-col gap-1">
                {/* Wood Texture Overlay */}
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')] opacity-20 pointer-events-none mix-blend-overlay scale-x-150" />
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-black/30 pointer-events-none" />

                {/* Top Shelf (Slots 0-14) */}
                <div className="relative flex justify-center gap-1 pb-2 min-h-[5.5rem] border-b-4 border-black/20 z-10">
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

                {/* Bottom Shelf (Slots 15-29) */}
                <div className="relative flex justify-center gap-1 pt-2 min-h-[5.5rem] z-10">
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

            {/* Shelf label */}
            <div className="mt-4 px-6 py-1 bg-amber-500/20 rounded-full border border-amber-500/30 text-[10px] font-black text-amber-500 uppercase tracking-widest animate-pulse">
                Taşları Sürükleyerek Düzenleyebilirsiniz
            </div>
        </div>
    );
};
