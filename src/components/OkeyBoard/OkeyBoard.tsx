import React, { useState } from 'react';
import type { OkeyGameState } from '../../logic/okeyLogic';
import { PlayerRack } from './PlayerRack';
import { OkeyTile } from './OkeyTile';
// No Lucide imports needed for now
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    useDroppable,
    useDraggable,
    DragOverlay,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
const PLAYER_INFO = [
    { name: 'Siz', color: 'from-blue-400 to-indigo-600', avatar: 'https://api.dicebear.com/7.x/lorelei/svg?seed=Felix&backgroundColor=b6e3f4' },
    { name: 'Esat', color: 'from-emerald-400 to-teal-600', avatar: 'https://api.dicebear.com/7.x/lorelei/svg?seed=Cuddles&backgroundColor=c0aede' },
    { name: 'Zeynep', color: 'from-amber-400 to-orange-600', avatar: 'https://api.dicebear.com/7.x/lorelei/svg?seed=Shadow&backgroundColor=ffdfbf' },
    { name: 'Emirhan', color: 'from-rose-400 to-pink-600', avatar: 'https://api.dicebear.com/7.x/lorelei/svg?seed=Fluffy&backgroundColor=ffd5dc' },
];

interface OkeyBoardProps {
    gameState: OkeyGameState | null;
    onDraw: () => void;
    onDrawDiscard: () => void;
    onMoveTile: (fromIndex: number, toIndex: number) => void;
    onDiscard: (index: number) => void;
    onAutoSort: () => void;
}

const PlayerPanel = ({ playerId, currentTurn, className = '' }: { playerId: number, currentTurn: number, className?: string, position?: 'top' | 'left' | 'right' | 'bottom', name?: string, tileCount?: number }) => {
    const isActive = currentTurn === playerId;
    const info = PLAYER_INFO[playerId];

    return (
        <div className={`transition-all duration-300 ${isActive ? 'scale-110' : 'opacity-90'} ${className}`}>
            <div className={`
                relative flex items-center min-w-[160px] h-9 px-4 bg-[#ede0d4] rounded-sm border-2 shadow-xl transition-all
                ${isActive ? 'border-green-500 bg-white ring-8 ring-green-500/20' : 'border-[#8d5b3e]'}
            `}>
                <div className={`flex-1 font-bold text-xs text-center uppercase tracking-tight ${isActive ? 'text-green-700' : 'text-[#3d251e]'}`}>
                    {isActive && <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-2 animate-ping" />}
                    {info.name}
                </div>
                {/* Hand size indicator stack - only for AI or if needed */}
                {playerId !== 0 && (
                    <div className={`absolute -bottom-5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded text-white text-[9px] font-bold shadow-md ${isActive ? 'bg-green-600' : 'bg-[#3d251e]'}`}>
                        TAŞ: {PLAYER_INFO[playerId].name === 'Esat' || PLAYER_INFO[playerId].name === 'Emirhan' || PLAYER_INFO[playerId].name === 'Zeynep' ? 14 : 14} {/* This will be updated by parent */}
                    </div>
                )}
            </div>
        </div>
    );
};

interface DiscardZoneProps {
    playerId: number;
    position: 'top' | 'left' | 'right' | 'bottom';
    discardPiles: any[][];
    currentTurn: number;
    userTileCount: number;
    onDrawDiscard: () => void;
}

const DiscardZone = ({ playerId, position, discardPiles, currentTurn, userTileCount, onDrawDiscard }: DiscardZoneProps) => {
    const { setNodeRef, isOver } = useDroppable({ id: `discard-${playerId}` });
    const lastTile = discardPiles[playerId][discardPiles[playerId].length - 1];

    const canDropHere = (playerId === 1 && currentTurn === 0 && userTileCount === 15);
    const canDrawHere = (playerId === 3 && currentTurn === 0 && userTileCount === 14);

    const { attributes, listeners, setNodeRef: setDraggableRef, isDragging } = useDraggable({
        id: `pick-discard-${playerId}`,
        disabled: !canDrawHere || !lastTile
    });

    const posStyle = {
        top: "absolute top-[18%] left-1/2 -translate-x-1/2",
        bottom: "absolute bottom-[35%] right-[22%]", // Move user's pile to the right
        left: "absolute left-[20%] top-1/2 -translate-y-1/2",
        right: "absolute right-[20%] top-1/2 -translate-y-1/2",
    };

    return (
        <div
            ref={setNodeRef}
            onClick={() => canDrawHere && onDrawDiscard()}
            className={`
                ${posStyle[position]} w-20 h-28 rounded-lg transition-all duration-300 flex items-center justify-center
                ${isOver ? 'bg-green-400/20 scale-110 ring-4 ring-green-400 shadow-2xl' : ''}
                ${canDrawHere ? 'cursor-grab active:cursor-grabbing hover:ring-4 hover:ring-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.3)] bg-amber-400/10' : ''}
            `}
        >
            {lastTile ? (
                <div
                    ref={setDraggableRef}
                    {...attributes}
                    {...listeners}
                    className={`rotate-3 shadow-xl transform transition-transform ${canDrawHere && !isDragging ? 'hover:scale-110 -translate-y-2' : ''} ${isDragging ? 'opacity-20' : ''}`}
                >
                    <OkeyTile tile={lastTile} size="sm" />
                    {canDrawHere && !isDragging && (
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-[8px] font-black px-2 py-1 rounded animate-bounce whitespace-nowrap">
                            SÜRÜKLE VEYA TIKLA
                        </div>
                    )}
                </div>
            ) : (
                <div className="w-16 h-24 border-2 border-white/10 rounded-lg flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-white/5" />
                </div>
            )}
            {canDropHere && (
                <div className="absolute -inset-2 border-2 border-dashed border-green-400 rounded-xl animate-pulse" />
            )}
        </div>
    );
};

const DraggableDrawPile = ({ currentTurn, userTileCount, centerStackCount, onDraw }: { currentTurn: number, userTileCount: number, centerStackCount: number, onDraw: () => void }) => {
    const canDraw = currentTurn === 0 && userTileCount < 15;
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: 'draw-pile',
        disabled: !canDraw
    });

    return (
        <div className="relative group">
            <div
                ref={setNodeRef}
                {...attributes}
                {...listeners}
                onClick={() => canDraw && onDraw()}
                className={`
                    relative w-16 h-20 bg-[#fffdfa] rounded-sm shadow-2xl flex items-center justify-center transition-all
                    ${canDraw
                        ? 'hover:-translate-y-2 cursor-grab active:cursor-grabbing ring-4 ring-green-500 bg-white'
                        : 'cursor-wait opacity-60'}
                    ${isDragging ? 'opacity-20' : ''}
                `}
            >
                <div className={`absolute inset-0 bg-[#e5e3de] border border-[#ccc] rounded-sm transform translate-x-1 translate-y-1 -z-10 shadow-lg ${canDraw ? 'bg-green-100' : ''}`} />
                <div className={`absolute inset-0 bg-[#d1cfca] border border-[#bbb] rounded-sm transform translate-x-2 translate-y-2 -z-20 shadow-lg ${canDraw ? 'bg-green-200' : ''}`} />
                <div className="text-[#3d251e] font-bold text-2xl">{centerStackCount}</div>

                {canDraw && !isDragging && (
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-green-500 text-white text-[10px] font-black px-3 py-1 rounded-full animate-bounce shadow-lg flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                        TAŞI SÜRÜKLE
                    </div>
                )}
            </div>
        </div>
    );
};


export const OkeyBoard: React.FC<OkeyBoardProps> = ({ gameState, onDraw, onDrawDiscard, onMoveTile, onDiscard, onAutoSort }) => {
    const [activeId, setActiveId] = useState<string | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    if (!gameState) return (
        <div className="w-full aspect-[4/3] flex items-center justify-center text-white text-2xl font-black font-sans">
            ARENA HAZIRLANIYOR...
        </div>
    );

    const handleDragStart = (event: any) => {
        setActiveId(event.active.id);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        setActiveId(null);
        const { active, over } = event;
        if (!over) return;

        const draggingId = active.id as string;
        const dropId = over.id as string;

        // Player 0 (User) discards to the next player (Player 1)
        if (dropId === 'discard-1' || dropId === 'discard-area') {
            if (draggingId.startsWith('slot-')) {
                const index = parseInt(draggingId.split('-')[1]);
                onDiscard(index);
            }
        }
        // Drawing from center stack
        else if (draggingId === 'draw-pile') {
            if (dropId.startsWith('slot-')) {
                onDraw();
            }
        }
        // Drawing from predecessor's discard pile
        else if (draggingId === 'pick-discard-3') {
            if (dropId.startsWith('slot-')) {
                onDrawDiscard();
            }
        }
        // Moving within rack
        else if (draggingId !== dropId && draggingId.startsWith('slot-') && dropId.startsWith('slot-')) {
            const fromIndex = parseInt(draggingId.split('-')[1]);
            const toIndex = parseInt(dropId.split('-')[1]);
            onMoveTile(fromIndex, toIndex);
        }
    };

    const renderDragOverlay = () => {
        if (!activeId) return null;

        if (activeId === 'draw-pile') {
            return (
                <div className="opacity-90 scale-110 shadow-2xl rotate-3">
                    <div className="w-16 h-20 bg-[#fffdfa] rounded-sm flex items-center justify-center border border-[#ccc]">
                        <div className="text-[#3d251e] font-bold text-2xl opacity-20">?</div>
                    </div>
                </div>
            );
        }

        if (activeId === 'pick-discard-3') {
            const lastTile = gameState?.discardPiles[3][gameState.discardPiles[3].length - 1];
            if (!lastTile) return null;
            return <div className="opacity-90 scale-110 shadow-2xl rotate-3"><OkeyTile tile={lastTile} size="sm" /></div>;
        }

        if (activeId.startsWith('slot-')) {
            const index = parseInt(activeId.split('-')[1]);
            const tile = gameState?.players[0].tiles[index];
            if (!tile) return null;
            return <div className="opacity-90 scale-110 shadow-2xl rotate-3"><OkeyTile tile={tile} /></div>;
        }

        return null;
    };

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <div className="relative w-full aspect-[16/10] bg-[#357a38] overflow-hidden mx-auto font-sans shadow-2xl rounded-lg border-x-[12px] border-y-[6px] border-[#3d251e]">
                {/* Felt Texture Pattern */}
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')] opacity-30 pointer-events-none" />
                <div className="absolute inset-0 bg-gradient-to-b from-black/10 to-transparent pointer-events-none" />
                <div className="absolute inset-0 border-[40px] border-black/5 pointer-events-none" />

                {/* Player Panels */}
                <PlayerPanel playerId={2} currentTurn={gameState.currentTurn} className="absolute top-4 left-1/2 -translate-x-1/2 z-30" />
                <PlayerPanel playerId={3} currentTurn={gameState.currentTurn} className="absolute left-4 top-1/2 -translate-y-1/2 -rotate-90 origin-center z-30" />
                <PlayerPanel playerId={1} currentTurn={gameState.currentTurn} className="absolute right-4 top-1/2 -translate-y-1/2 rotate-90 origin-center z-30" />

                {/* Individual Discard Piles */}
                <DiscardZone playerId={2} position="top" discardPiles={gameState.discardPiles} currentTurn={gameState.currentTurn} userTileCount={gameState.players[0].tiles.filter(t => t !== null).length} onDrawDiscard={onDrawDiscard} />
                <DiscardZone playerId={3} position="left" discardPiles={gameState.discardPiles} currentTurn={gameState.currentTurn} userTileCount={gameState.players[0].tiles.filter(t => t !== null).length} onDrawDiscard={onDrawDiscard} />
                <DiscardZone playerId={1} position="right" discardPiles={gameState.discardPiles} currentTurn={gameState.currentTurn} userTileCount={gameState.players[0].tiles.filter(t => t !== null).length} onDrawDiscard={onDrawDiscard} />
                <DiscardZone playerId={0} position="bottom" discardPiles={gameState.discardPiles} currentTurn={gameState.currentTurn} userTileCount={gameState.players[0].tiles.filter(t => t !== null).length} onDrawDiscard={onDrawDiscard} />

                {/* CENTER AREA */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-12">
                    {/* Indicator Tile */}
                    <div className="flex flex-col items-center gap-2">
                        <OkeyTile tile={gameState.indicatorTile!} size="md" className="shadow-2xl" />
                    </div>

                    {/* Draw Pile */}
                    <DraggableDrawPile currentTurn={gameState.currentTurn} userTileCount={gameState.players[0].tiles.filter(t => t !== null).length} centerStackCount={gameState.centerStack.length} onDraw={onDraw} />
                </div>

                {/* User Rack & Control (Fixed at Bottom) */}
                <div className="absolute bottom-0 left-0 right-0 z-40 p-2 flex flex-col items-center gap-3">
                    <div className="flex items-center gap-6">
                        <PlayerPanel playerId={0} currentTurn={gameState.currentTurn} className="scale-105" />
                        <button
                            onClick={onAutoSort}
                            className="px-8 py-2 bg-[#ede0d4] hover:bg-white text-[#3d251e] border-2 border-[#8d5b3e] rounded shadow-lg text-[11px] font-black tracking-widest uppercase transition-all hover:scale-105 active:scale-95"
                        >
                            Düzenle
                        </button>
                    </div>
                    <PlayerRack
                        tiles={gameState.players[0].tiles}
                        playerId={0}
                        isCurrentPlayer
                        okeyTile={gameState.okeyTile}
                    />
                </div>

                {/* HUD Elements */}
                <div className="absolute top-4 left-4 flex gap-2">
                    <div className="w-10 h-10 bg-white rounded shadow-md flex items-center justify-center text-xl text-[#3d251e] cursor-pointer hover:bg-slate-50">🔊</div>
                    <div className="w-10 h-10 bg-white rounded shadow-md flex items-center justify-center text-xl text-[#3d251e] cursor-pointer hover:bg-slate-50">?</div>
                    <div className="w-10 h-10 bg-white rounded shadow-md flex items-center justify-center text-xl text-[#3d251e] cursor-pointer hover:bg-slate-50">📊</div>
                </div>
                <div className="absolute top-4 right-4">
                    <div className="w-10 h-10 bg-[#e53935] rounded shadow-md flex items-center justify-center text-white text-xl font-bold cursor-pointer hover:bg-red-600">✕</div>
                </div>
                <DragOverlay dropAnimation={null}>
                    {renderDragOverlay()}
                </DragOverlay>
            </div>
        </DndContext>
    );
};
