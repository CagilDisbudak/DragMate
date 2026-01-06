import React, { useState, useCallback } from 'react';
import type { OkeyGameState } from '../../logic/okeyLogic';
import { PlayerRack } from './PlayerRack';
import { OkeyTile } from './OkeyTile';
import { Bot, User } from 'lucide-react';
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
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';

// Default player info for local mode
const DEFAULT_PLAYER_INFO = [
    { name: 'Siz', isAI: false, isYou: true },
    { name: 'Bot 1', isAI: true, isYou: false },
    { name: 'Bot 2', isAI: true, isYou: false },
    { name: 'Bot 3', isAI: true, isYou: false },
];

interface PlayerInfo {
    name: string;
    isAI: boolean;
    isYou: boolean;
}

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
    // Multiplayer props
    playerInfo?: PlayerInfo[];
    mySlot?: number;
    isOnline?: boolean;
}

interface PlayerPanelProps {
    playerId: number;
    currentTurn: number;
    className?: string;
    isDragging?: boolean;
    playerInfo: PlayerInfo;
    tileCount?: number;
}

const PlayerPanel: React.FC<PlayerPanelProps> = ({
    playerId,
    currentTurn,
    className = '',
    isDragging = false,
    playerInfo,
    tileCount = 14
}) => {
    const isActive = currentTurn === playerId;

    return (
        <div className={`transition-all duration-300 ${isActive && !isDragging ? 'scale-110' : 'opacity-90'} ${className}`}>
            <div className={`
                relative flex items-center min-w-[160px] h-9 px-4 bg-[#ede0d4] rounded-sm border-2 shadow-xl transition-all
                ${isActive ? (isDragging ? 'border-green-500 bg-white shadow-green-500/20' : 'border-green-500 bg-white ring-8 ring-green-500/20') : 'border-[#8d5b3e]'}
            `}>
                {/* Player icon */}
                <div className={`mr-2 ${isActive ? 'text-green-600' : 'text-[#8d5b3e]'}`}>
                    {playerInfo.isAI ? (
                        <Bot size={14} />
                    ) : playerInfo.isYou ? (
                        <User size={14} className="text-amber-600" />
                    ) : (
                        <User size={14} />
                    )}
                </div>

                <div className={`flex-1 font-bold text-xs text-center uppercase tracking-tight ${isActive ? 'text-green-700' : 'text-[#3d251e]'}`}>
                    {isActive && <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-2 animate-ping" />}
                    {playerInfo.name}
                    {playerInfo.isYou && !playerInfo.isAI && (
                        <span className="ml-1 text-[9px] text-amber-600">(Sen)</span>
                    )}
                </div>

                {playerId !== 0 && (
                    <div className={`absolute -bottom-5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded text-white text-[9px] font-bold shadow-md flex items-center gap-1 ${isActive ? 'bg-green-600' : 'bg-[#3d251e]'}`}>
                        {playerInfo.isAI && <Bot size={10} />}
                        TAŞ: {tileCount}
                    </div>
                )}
            </div>
        </div>
    );
};

const DiscardZone = ({ playerId, position, discardPiles, currentTurn, userTileCount, onDrawDiscard, isDraggingRackTile, mySlot = 0 }: any) => {
    // Adjust logic for multiplayer - "user" is whoever's turn it is at mySlot
    const canDropHere = (playerId === mySlot && currentTurn === mySlot && userTileCount === 15 && isDraggingRackTile);
    const prevPlayerIdx = (mySlot + 3) % 4;
    const canDrawHere = (playerId === prevPlayerIdx && currentTurn === mySlot && userTileCount === 14);

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
        bottom: "absolute bottom-[36%] right-[12%]",
        left: "absolute left-[12%] top-[35%]",
        right: "absolute right-[12%] top-[35%]",
    };

    return (
        <div
            ref={setNodeRef}
            onClick={() => canDrawHere && onDrawDiscard()}
            className={`
                ${posStyle[position]} w-16 h-24 rounded-lg transition-all duration-200 flex items-center justify-center z-20
                ${isOver ? 'bg-green-400/30 scale-110 ring-4 ring-green-400 shadow-xl' : ''}
                ${canDropHere && !isOver ? 'bg-green-500/10 ring-2 ring-green-400/50' : ''}
                ${canDrawHere ? 'cursor-grab active:cursor-grabbing hover:ring-2 hover:ring-amber-400 bg-amber-400/10' : ''}
            `}
        >
            {lastTile ? (
                <div
                    ref={setDraggableRef}
                    {...attributes}
                    {...listeners}
                    className={`rotate-2 shadow-lg transform ${canDrawHere && !isDragging ? 'hover:scale-105' : ''} ${isDragging ? 'opacity-20' : ''}`}
                >
                    <OkeyTile tile={lastTile} size="sm" />
                </div>
            ) : (
                <div className="w-12 h-18 border-2 border-white/10 border-dashed rounded-lg flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-white/10" />
                </div>
            )}

            {canDropHere && (
                <div className="absolute -inset-2 border-2 border-dashed border-green-400 rounded-xl animate-pulse pointer-events-none">
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[8px] font-black text-green-400 uppercase tracking-wider whitespace-nowrap bg-black/70 px-2 py-1 rounded">BURAYA AT</div>
                </div>
            )}

            {canDrawHere && lastTile && !isDragging && (
                <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-[8px] font-black px-2 py-1 rounded animate-bounce whitespace-nowrap z-50">
                    ÇEK
                </div>
            )}
        </div>
    );
};

const DraggableDrawPile = ({ currentTurn, userTileCount, centerStackCount, onDraw, mySlot = 0 }: any) => {
    const canDraw = currentTurn === mySlot && userTileCount < 15;
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

export const OkeyBoard: React.FC<OkeyBoardProps> = ({
    gameState,
    onDraw,
    onDrawDiscard,
    onMoveTile,
    onDiscard,
    onAutoSort,
    onFinish,
    onReset,
    onReshuffle,
    onEndTie,
    onExit,
    playerInfo = DEFAULT_PLAYER_INFO,
    mySlot = 0,
    isOnline = false
}) => {
    const [activeId, setActiveId] = useState<string | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 3 }
        }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    // All hooks must be called before any conditional returns
    const handleDragStart = useCallback((event: DragStartEvent) => setActiveId(event.active.id as string), []);
    const handleDragEnd = useCallback((event: DragEndEvent) => {
        setActiveId(null);
        const { active, over } = event;
        if (!over) return;

        const draggingId = active.id as string;
        const dropId = over.id as string;

        // Adjust for mySlot in multiplayer
        if (dropId === `discard-${mySlot}` && draggingId.startsWith('slot-')) {
            onDiscard(parseInt(draggingId.split('-')[1]));
        } else if (dropId === 'finish-zone' && draggingId.startsWith('slot-')) {
            onFinish(parseInt(draggingId.split('-')[1]));
        } else if (draggingId === 'draw-pile' && dropId.startsWith('slot-')) {
            onDraw(parseInt(dropId.split('-')[1]));
        } else if (draggingId.startsWith('pick-discard-') && dropId.startsWith('slot-')) {
            onDrawDiscard(parseInt(dropId.split('-')[1]));
        } else if (draggingId !== dropId && draggingId.startsWith('slot-') && dropId.startsWith('slot-')) {
            onMoveTile(parseInt(draggingId.split('-')[1]), parseInt(dropId.split('-')[1]));
        }
    }, [mySlot, onDiscard, onFinish, onDraw, onDrawDiscard, onMoveTile]);

    // Early return AFTER all hooks
    if (!gameState) return <div className="text-white text-center p-10 font-bold">YÜKLENİYOR...</div>;

    const renderDragOverlay = () => {
        if (!activeId) return null;
        if (activeId === 'draw-pile') return <div className="w-16 h-20 bg-white rounded shadow-2xl opacity-80" />;
        if (activeId.startsWith('pick-discard-')) {
            const prevPlayerIdx = (mySlot + 3) % 4;
            const lastTile = gameState.discardPiles[prevPlayerIdx][gameState.discardPiles[prevPlayerIdx].length - 1];
            return lastTile ? <OkeyTile tile={lastTile} size="sm" okeyTile={gameState.okeyTile} /> : null;
        }
        if (activeId.startsWith('slot-')) {
            const tile = gameState.players[mySlot].tiles[parseInt(activeId.split('-')[1])];
            return tile ? <OkeyTile tile={tile} okeyTile={gameState.okeyTile} /> : null;
        }
        return null;
    };

    // Get tile counts for each player
    const getTileCount = (playerIdx: number) => {
        return gameState.players[playerIdx].tiles.filter(t => t !== null).length;
    };

    // Map display positions based on mySlot
    // In multiplayer, the current user (mySlot) should always appear at the bottom
    const getActualSlot = (displayPosition: number): number => {
        return (displayPosition + mySlot) % 4;
    };

    const userTileCount = getTileCount(mySlot);

    // Get player info in display order
    const getPlayerInfoForDisplay = (displayPos: number) => {
        const actualSlot = getActualSlot(displayPos);
        return playerInfo[actualSlot] || DEFAULT_PLAYER_INFO[actualSlot];
    };

    return (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="relative w-full aspect-[16/10] bg-[#357a38] overflow-hidden mx-auto font-sans shadow-2xl rounded-lg border-x-[12px] border-y-[6px] border-[#3d251e]">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')] opacity-30 pointer-events-none" />

                {/* Top player (display position 2) */}
                <PlayerPanel
                    playerId={getActualSlot(2)}
                    currentTurn={gameState.currentTurn}
                    isDragging={!!activeId}
                    className="absolute top-4 left-1/2 -translate-x-1/2 z-30"
                    playerInfo={getPlayerInfoForDisplay(2)}
                    tileCount={getTileCount(getActualSlot(2))}
                />

                {/* Left player (display position 3) */}
                <PlayerPanel
                    playerId={getActualSlot(3)}
                    currentTurn={gameState.currentTurn}
                    isDragging={!!activeId}
                    className="absolute left-4 top-1/2 -translate-y-1/2 -rotate-90 origin-center z-30"
                    playerInfo={getPlayerInfoForDisplay(3)}
                    tileCount={getTileCount(getActualSlot(3))}
                />

                {/* Right player (display position 1) */}
                <PlayerPanel
                    playerId={getActualSlot(1)}
                    currentTurn={gameState.currentTurn}
                    isDragging={!!activeId}
                    className="absolute right-4 top-1/2 -translate-y-1/2 rotate-90 origin-center z-30"
                    playerInfo={getPlayerInfoForDisplay(1)}
                    tileCount={getTileCount(getActualSlot(1))}
                />

                {/* Discard zones */}
                <DiscardZone playerId={getActualSlot(2)} position="top" {...gameState} userTileCount={userTileCount} onDrawDiscard={onDrawDiscard} isDraggingRackTile={activeId?.startsWith('slot-')} mySlot={mySlot} />
                <DiscardZone playerId={getActualSlot(3)} position="left" {...gameState} userTileCount={userTileCount} onDrawDiscard={onDrawDiscard} isDraggingRackTile={activeId?.startsWith('slot-')} mySlot={mySlot} />
                <DiscardZone playerId={getActualSlot(1)} position="right" {...gameState} userTileCount={userTileCount} onDrawDiscard={onDrawDiscard} isDraggingRackTile={activeId?.startsWith('slot-')} mySlot={mySlot} />
                <DiscardZone playerId={mySlot} position="bottom" {...gameState} userTileCount={userTileCount} onDrawDiscard={onDrawDiscard} isDraggingRackTile={activeId?.startsWith('slot-')} mySlot={mySlot} />

                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-12">
                    <div className="relative">
                        <OkeyTile tile={gameState.indicatorTile!} size="md" okeyTile={gameState.okeyTile} />
                        <FinishZone isDraggingRackTile={activeId?.startsWith('slot-') || false} canFinish={gameState.currentTurn === mySlot && userTileCount === 15} />
                    </div>
                    <DraggableDrawPile {...gameState} userTileCount={userTileCount} centerStackCount={gameState.centerStack.length} onDraw={onDraw} mySlot={mySlot} />
                </div>

                <div className="absolute bottom-0 left-0 right-0 z-40 p-2 flex flex-col items-center gap-3">
                    <div className="flex items-center gap-6">
                        <PlayerPanel
                            playerId={mySlot}
                            currentTurn={gameState.currentTurn}
                            isDragging={!!activeId}
                            playerInfo={playerInfo[mySlot] || DEFAULT_PLAYER_INFO[0]}
                        />
                        <button onClick={onAutoSort} className="px-8 py-2 bg-[#ede0d4] text-[#3d251e] border-2 border-[#8d5b3e] rounded shadow-lg text-[11px] font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95">Düzenle</button>
                    </div>
                    <PlayerRack tiles={gameState.players[mySlot].tiles} playerId={mySlot} isCurrentPlayer okeyTile={gameState.okeyTile} />
                </div>

                {/* Turn indicator for online mode when it's not your turn */}
                {isOnline && gameState.currentTurn !== mySlot && (
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none">
                        <div className="bg-black/60 backdrop-blur-sm px-6 py-3 rounded-xl">
                            <p className="text-white text-sm font-bold flex items-center gap-2">
                                <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                                {playerInfo[gameState.currentTurn]?.name || `Player ${gameState.currentTurn + 1}`}'in sırası...
                            </p>
                        </div>
                    </div>
                )}

                {gameState.phase === 'roundOver' && (
                    <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-500">
                        {/* Confetti animation for winner */}
                        {gameState.winner === mySlot && (
                            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                                {[...Array(30)].map((_, i) => (
                                    <div
                                        key={i}
                                        className="absolute w-3 h-3 rounded-sm animate-bounce"
                                        style={{
                                            left: `${Math.random() * 100}%`,
                                            top: `-${Math.random() * 20}%`,
                                            backgroundColor: ['#ffd700', '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7'][i % 6],
                                            animationDelay: `${Math.random() * 2}s`,
                                            animationDuration: `${2 + Math.random() * 2}s`,
                                            transform: `rotate(${Math.random() * 360}deg)`
                                        }}
                                    />
                                ))}
                            </div>
                        )}

                        <div className={`
                            relative p-10 rounded-3xl shadow-2xl flex flex-col items-center gap-6 
                            transform transition-all duration-500 animate-in zoom-in-95
                            ${gameState.winner === null
                                ? 'bg-gradient-to-br from-slate-100 to-slate-200 border-4 border-slate-400'
                                : gameState.winner === mySlot
                                    ? 'bg-gradient-to-br from-amber-100 via-yellow-100 to-amber-200 border-4 border-amber-400 ring-8 ring-amber-300/50'
                                    : 'bg-gradient-to-br from-slate-100 to-red-100 border-4 border-red-300'
                            }
                        `}>
                            {/* Trophy/Icon */}
                            <div className={`text-7xl ${gameState.winner === mySlot ? 'animate-bounce' : ''}`}>
                                {gameState.winner === null ? '🤝' : gameState.winner === mySlot ? '🏆' : '😢'}
                            </div>

                            <h2 className={`text-4xl font-black uppercase tracking-tight ${gameState.winner === null
                                ? 'text-slate-700'
                                : gameState.winner === mySlot
                                    ? 'text-amber-600'
                                    : 'text-slate-700'
                                }`}>
                                {gameState.winner === null ? 'BERABERE!' : (gameState.winner === mySlot ? 'KAZANDINIZ!' : 'KAYBETTİNİZ')}
                            </h2>

                            <p className="text-lg font-bold text-slate-600 text-center max-w-xs">
                                {gameState.winner === null
                                    ? 'Kimse kazanamadı. Taşlar tükendi!'
                                    : (gameState.winner === mySlot
                                        ? 'Tebrikler! Harika bir oyun oynadınız! 🎉'
                                        : `${playerInfo[gameState.winner]?.name || `Player ${gameState.winner + 1}`} oyunu kazandı.`
                                    )
                                }
                            </p>

                            <div className="flex gap-4 mt-4">
                                <button
                                    onClick={onReset}
                                    className="px-10 py-4 bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-black rounded-xl shadow-lg transition-all hover:scale-105 active:scale-95 uppercase tracking-wide"
                                >
                                    🔄 Tekrar Oyna
                                </button>
                                <button
                                    onClick={onExit}
                                    className="px-10 py-4 bg-gradient-to-br from-slate-600 to-slate-700 hover:from-slate-500 hover:to-slate-600 text-white font-black rounded-xl shadow-lg transition-all hover:scale-105 active:scale-95 uppercase tracking-wide"
                                >
                                    🚪 Çıkış
                                </button>
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

                <DragOverlay
                    dropAnimation={null}
                    style={{
                        cursor: 'grabbing',
                        touchAction: 'none',
                    }}
                    modifiers={[]}
                >
                    <div
                        style={{
                            willChange: 'transform',
                            transform: 'translateZ(0)',
                            pointerEvents: 'none',
                            filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.25))',
                        }}
                    >
                        {renderDragOverlay()}
                    </div>
                </DragOverlay>
            </div>
        </DndContext>
    );
};
