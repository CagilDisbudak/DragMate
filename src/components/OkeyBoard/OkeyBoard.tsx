import React, { useState } from 'react';
import type { OkeyGameState } from '../../logic/okeyLogic';
import { PlayerRack } from './PlayerRack';
import { OkeyTile } from './OkeyTile';
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
    onDraw: (index?: number) => void;
    onDrawDiscard: (index?: number) => void;
    onMoveTile: (fromIndex: number, toIndex: number) => void;
    onDiscard: (index: number) => void;
    onAutoSort: () => void;
    onFinish: (index: number) => void;
    onReset: () => void;
    onReshuffle: () => void;
    onEndTie: () => void;
    onExit: () => void;
}

const PlayerPanel = ({ playerId, currentTurn, className = '', isDragging = false }: { playerId: number, currentTurn: number, className?: string, isDragging?: boolean }) => {
    const isActive = currentTurn === playerId;
    const info = PLAYER_INFO[playerId];

    return (
        <div className={`transition-all duration-300 ${isActive && !isDragging ? 'scale-110' : 'opacity-90'} ${className}`}>
            <div className={`
                relative flex items-center min-w-[160px] h-9 px-4 bg-[#ede0d4] rounded-sm border-2 shadow-xl transition-all
                ${isActive ? (isDragging ? 'border-green-500 bg-white shadow-green-500/20' : 'border-green-500 bg-white ring-8 ring-green-500/20') : 'border-[#8d5b3e]'}
            `}>
                <div className={`flex-1 font-bold text-xs text-center uppercase tracking-tight ${isActive ? 'text-green-700' : 'text-[#3d251e]'}`}>
                    {isActive && <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-2 animate-ping" />}
                    {info.name}
                </div>
                {playerId !== 0 && (
                    <div className={`absolute -bottom-5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded text-white text-[9px] font-bold shadow-md ${isActive ? 'bg-green-600' : 'bg-[#3d251e]'}`}>
                        TAŞ: 14
                    </div>
                )}
            </div>
        </div>
    );
};

const DiscardZone = ({ playerId, position, discardPiles, currentTurn, userTileCount, onDrawDiscard, isDraggingRackTile }: any) => {
    const canDropHere = (playerId === 0 && currentTurn === 0 && userTileCount === 15 && isDraggingRackTile);
    const canDrawHere = (playerId === 3 && currentTurn === 0 && userTileCount === 14);

    const { setNodeRef, isOver } = useDroppable({
        id: `discard-${playerId}`,
        disabled: !canDropHere
    });
    const lastTile = discardPiles[playerId][discardPiles[playerId].length - 1];

    const { attributes, listeners, setNodeRef: setDraggableRef, isDragging } = useDraggable({
        id: `pick-discard-${playerId}`,
        disabled: !canDrawHere || !lastTile
    });

    const posStyle: any = {
        top: "absolute top-[22%] left-1/2 -translate-x-1/2",
        bottom: "absolute bottom-[35%] right-[10%] -translate-x-1/2",
        left: "absolute left-[12%] top-[35%]",
        right: "absolute right-[12%] top-[35%]",
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
                </div>
            ) : (
                <div className="w-16 h-24 border-2 border-white/5 border-dashed rounded-lg flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-white/5" />
                </div>
            )}

            {canDropHere && (
                <div className="absolute -inset-2 border-2 border-dashed border-green-400 rounded-xl animate-pulse flex items-center justify-center">
                    <div className="text-[8px] font-black text-green-400 mb-20 uppercase tracking-widest whitespace-nowrap">Buraya At</div>
                </div>
            )}

            {canDrawHere && lastTile && !isDragging && (
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-[8px] font-black px-2 py-1 rounded animate-bounce whitespace-nowrap z-50">
                    SÜRÜKLE VEYA TIKLA
                </div>
            )}
        </div>
    );
};

const DraggableDrawPile = ({ currentTurn, userTileCount, centerStackCount, onDraw }: any) => {
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
                    ${canDraw ? 'hover:-translate-y-2 cursor-grab active:cursor-grabbing ring-4 ring-green-500 bg-white' : 'cursor-wait opacity-60'}
                    ${isDragging ? 'opacity-20' : ''}
                `}
            >
                <div className={`absolute inset-0 bg-[#e5e3de] border border-[#ccc] rounded-sm transform translate-x-1 translate-y-1 -z-10 shadow-lg ${canDraw ? 'bg-green-100' : ''}`} />
                <div className={`absolute inset-0 bg-[#d1cfca] border border-[#bbb] rounded-sm transform translate-x-2 translate-y-2 -z-20 shadow-lg ${canDraw ? 'bg-green-200' : ''}`} />
                <div className="text-[#3d251e] font-bold text-2xl">{centerStackCount}</div>

                {canDraw && !isDragging && (
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-green-500 text-white text-[10px] font-black px-3 py-1 rounded-full animate-bounce shadow-lg whitespace-nowrap flex items-center gap-1 z-50">
                        TAŞ ÇEK
                    </div>
                )}
            </div>
        </div>
    );
};

const FinishZone = ({ isDraggingRackTile, canFinish }: { isDraggingRackTile: boolean, canFinish: boolean }) => {
    const { setNodeRef, isOver } = useDroppable({
        id: 'finish-zone',
        disabled: !canFinish
    });

    return (
        <div
            ref={setNodeRef}
            className={`
                absolute -inset-4 rounded-2xl transition-all duration-300 pointer-events-none
                ${canFinish && isDraggingRackTile ? 'border-4 border-dashed border-amber-400 animate-[pulse_1.5s_infinite] bg-amber-400/10' : ''}
                ${isOver ? 'bg-amber-400/30 scale-110' : ''}
            `}
        />
    );
};

export const OkeyBoard: React.FC<OkeyBoardProps> = ({ gameState, onDraw, onDrawDiscard, onMoveTile, onDiscard, onAutoSort, onFinish, onReset, onReshuffle, onEndTie, onExit }) => {
    const [activeId, setActiveId] = useState<string | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    if (!gameState) return <div className="text-white text-center p-10 font-bold">YÜKLENİYOR...</div>;

    const handleDragStart = (event: any) => setActiveId(event.active.id);
    const handleDragEnd = (event: DragEndEvent) => {
        setActiveId(null);
        const { active, over } = event;
        if (!over) return;

        const draggingId = active.id as string;
        const dropId = over.id as string;

        if (dropId === 'discard-0' && draggingId.startsWith('slot-')) {
            onDiscard(parseInt(draggingId.split('-')[1]));
        } else if (dropId === 'finish-zone' && draggingId.startsWith('slot-')) {
            onFinish(parseInt(draggingId.split('-')[1]));
        } else if (draggingId === 'draw-pile' && dropId.startsWith('slot-')) {
            onDraw(parseInt(dropId.split('-')[1]));
        } else if (draggingId === 'pick-discard-3' && dropId.startsWith('slot-')) {
            onDrawDiscard(parseInt(dropId.split('-')[1]));
        } else if (draggingId !== dropId && draggingId.startsWith('slot-') && dropId.startsWith('slot-')) {
            onMoveTile(parseInt(draggingId.split('-')[1]), parseInt(dropId.split('-')[1]));
        }
    };

    const renderDragOverlay = () => {
        if (!activeId) return null;
        if (activeId === 'draw-pile') return <div className="w-16 h-20 bg-white rounded shadow-2xl opacity-80" />;
        if (activeId === 'pick-discard-3') {
            const lastTile = gameState.discardPiles[3][gameState.discardPiles[3].length - 1];
            return lastTile ? <OkeyTile tile={lastTile} size="sm" okeyTile={gameState.okeyTile} /> : null;
        }
        if (activeId.startsWith('slot-')) {
            const tile = gameState.players[0].tiles[parseInt(activeId.split('-')[1])];
            return tile ? <OkeyTile tile={tile} okeyTile={gameState.okeyTile} /> : null;
        }
        return null;
    };

    const userTileCount = gameState.players[0].tiles.filter(t => t !== null).length;

    return (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="relative w-full aspect-[16/10] bg-[#357a38] overflow-hidden mx-auto font-sans shadow-2xl rounded-lg border-x-[12px] border-y-[6px] border-[#3d251e]">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')] opacity-30 pointer-events-none" />

                <PlayerPanel playerId={2} currentTurn={gameState.currentTurn} isDragging={!!activeId} className="absolute top-4 left-1/2 -translate-x-1/2 z-30" />
                <PlayerPanel playerId={3} currentTurn={gameState.currentTurn} isDragging={!!activeId} className="absolute left-4 top-1/2 -translate-y-1/2 -rotate-90 origin-center z-30" />
                <PlayerPanel playerId={1} currentTurn={gameState.currentTurn} isDragging={!!activeId} className="absolute right-4 top-1/2 -translate-y-1/2 rotate-90 origin-center z-30" />

                <DiscardZone playerId={2} position="top" {...gameState} userTileCount={userTileCount} onDrawDiscard={onDrawDiscard} isDraggingRackTile={activeId?.startsWith('slot-')} />
                <DiscardZone playerId={3} position="left" {...gameState} userTileCount={userTileCount} onDrawDiscard={onDrawDiscard} isDraggingRackTile={activeId?.startsWith('slot-')} />
                <DiscardZone playerId={1} position="right" {...gameState} userTileCount={userTileCount} onDrawDiscard={onDrawDiscard} isDraggingRackTile={activeId?.startsWith('slot-')} />
                <DiscardZone playerId={0} position="bottom" {...gameState} userTileCount={userTileCount} onDrawDiscard={onDrawDiscard} isDraggingRackTile={activeId?.startsWith('slot-')} />

                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-12">
                    <div className="relative">
                        <OkeyTile tile={gameState.indicatorTile!} size="md" okeyTile={gameState.okeyTile} />
                        <FinishZone isDraggingRackTile={activeId?.startsWith('slot-') || false} canFinish={gameState.currentTurn === 0 && userTileCount === 15} />
                    </div>
                    <DraggableDrawPile {...gameState} userTileCount={userTileCount} centerStackCount={gameState.centerStack.length} onDraw={onDraw} />
                </div>

                <div className="absolute bottom-0 left-0 right-0 z-40 p-2 flex flex-col items-center gap-3">
                    <div className="flex items-center gap-6">
                        <PlayerPanel playerId={0} currentTurn={gameState.currentTurn} isDragging={!!activeId} />
                        <button onClick={onAutoSort} className="px-8 py-2 bg-[#ede0d4] text-[#3d251e] border-2 border-[#8d5b3e] rounded shadow-lg text-[11px] font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95">Düzenle</button>
                    </div>
                    <PlayerRack tiles={gameState.players[0].tiles} playerId={0} isCurrentPlayer okeyTile={gameState.okeyTile} />
                </div>

                {gameState.phase === 'roundOver' && (
                    <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
                        <div className="bg-[#ede0d4] p-10 rounded-2xl shadow-2xl flex flex-col items-center gap-6 text-[#3d251e]">
                            <h2 className="text-4xl font-black uppercase">
                                {gameState.winner === null ? 'DOSTLUK KAZANDI' : (gameState.winner === 0 ? 'TEBRİKLER!' : 'OYUN BİTTİ')}
                            </h2>
                            <p className="text-xl font-bold">
                                {gameState.winner === null ? 'Berabere! Taşlar bitti.' : (gameState.winner === 0 ? 'Kazandınız!' : `${PLAYER_INFO[gameState.winner!].name} Kazandı!`)}
                            </p>
                            <div className="flex gap-4">
                                <button onClick={onReset} className="px-10 py-4 bg-emerald-600 text-white font-black rounded-xl">Tekrar Oyna</button>
                                <button onClick={onExit} className="px-10 py-4 bg-slate-800 text-white font-black rounded-xl">Çıkış</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Stack Empty Prompt Overlay */}
                {gameState.phase === 'stackEmpty' && (
                    <div className="absolute inset-0 z-[110] flex items-center justify-center bg-black/70 backdrop-blur-md fade-in">
                        <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-8 rounded-2xl shadow-2xl border-4 border-amber-500 max-w-md text-center flex flex-col gap-6">
                            <div className="text-5xl">🪹</div>
                            <div>
                                <h3 className="text-2xl font-black text-amber-900 uppercase">ORTADA TAŞ BİTTİ!</h3>
                                <p className="text-amber-800 font-medium mt-2">Iskartadaki taşları karıştırıp devam mı edelim, yoksa oyunu bitirelim mi?</p>
                            </div>
                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={onReshuffle}
                                    className="w-full py-4 bg-amber-600 hover:bg-amber-500 text-white font-black uppercase tracking-widest rounded-xl shadow-lg transition-all hover:scale-105 active:scale-95"
                                >
                                    Taşları Karıştır (Devam Et)
                                </button>
                                <button
                                    onClick={onEndTie}
                                    className="w-full py-4 bg-slate-700 hover:bg-slate-600 text-white font-black uppercase tracking-widest rounded-xl shadow-lg transition-all hover:scale-105 active:scale-95"
                                >
                                    Oyunu Bitir (Berabere)
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <DragOverlay dropAnimation={null}>{renderDragOverlay()}</DragOverlay>
            </div>
        </DndContext>
    );
};
