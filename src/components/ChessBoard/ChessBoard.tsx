import React, { useState, useCallback } from 'react';
import {
    DndContext,
    type DragEndEvent,
    MouseSensor,
    TouchSensor,
    useSensor,
    useSensors,
    PointerSensor
} from '@dnd-kit/core';
import { createGame, validateMove, isPromotionMove } from '../../logic/chessLogic';
import { Square } from './Square';
import { Piece } from '../Piece/Piece';
import { pieceIcons } from '../../logic/pieceIcons';

interface ChessBoardProps {
    onMove?: (fen: string, move: { from: string; to: string; promotion?: string }) => void;
    initialFen?: string;
    playerColor?: 'w' | 'b';
    isGameOver?: boolean;
    /** Bumped by the parent when a move is rejected, forcing a rollback to `initialFen`. */
    resyncSignal?: number;
    /** Optional last played move — tinted on the board when provided. */
    lastMove?: { from: string; to: string } | null;
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

const PROMOTION_PIECES = ['q', 'r', 'b', 'n'] as const;
type PromotionPiece = (typeof PROMOTION_PIECES)[number];

const PROMOTION_LABELS: Record<PromotionPiece, string> = {
    q: 'Queen',
    r: 'Rook',
    b: 'Bishop',
    n: 'Knight'
};

export const ChessBoard: React.FC<ChessBoardProps> = ({
    onMove,
    initialFen,
    playerColor = 'w',
    isGameOver = false,
    resyncSignal = 0,
    lastMove = null
}) => {
    const [game, setGame] = useState(() => createGame(initialFen));
    const [highlightedSquares, setHighlightedSquares] = useState<string[]>([]);
    const [activeSquare, setActiveSquare] = useState<string | null>(null);
    // A legal promotion drop waiting for the player to pick a piece.
    const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string; color: 'w' | 'b' } | null>(null);

    // Sync local game state with the authoritative server FEN.
    React.useEffect(() => {
        if (initialFen && initialFen !== game.fen()) {
            setGame(createGame(initialFen));
            setPendingPromotion(null); // position changed under the picker → discard it
        }
    }, [initialFen]);

    // Roll back an optimistic move the server rejected.
    React.useEffect(() => {
        if (resyncSignal && initialFen) {
            setGame(createGame(initialFen));
            setHighlightedSquares([]);
            setActiveSquare(null);
            setPendingPromotion(null);
        }
    }, [resyncSignal]);

    // Escape cancels the promotion picker (board stays unchanged).
    React.useEffect(() => {
        if (!pendingPromotion) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setPendingPromotion(null);
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [pendingPromotion]);

    const sensors = useSensors(
        // TouchSensor öne alınarak mobilde daha tutarlı sürükleme
        useSensor(TouchSensor, { activationConstraint: { delay: 80, tolerance: 8 } }),
        useSensor(PointerSensor),
        useSensor(MouseSensor)
    );

    const handleDragEnd = useCallback((event: DragEndEvent) => {
        const { active, over } = event;

        setHighlightedSquares([]);
        setActiveSquare(null);

        if (!over) return;

        const from = active.id as string;
        const to = over.id as string;

        // Legal promotion → pause the move and let the player pick the piece.
        // (validateMove would silently auto-queen it otherwise.)
        if (isPromotionMove(game, from, to)) {
            setPendingPromotion({ from, to, color: game.turn() });
            return;
        }

        // Work on a cloned game instance so we don't mutate state before validation
        const nextGame = createGame(game.fen());
        const move = validateMove(nextGame, from, to);

        if (move) {
            setGame(nextGame); // optimistic; server confirms or the parent triggers a resync
            if (onMove) onMove(nextGame.fen(), { from, to, promotion: (move as { promotion?: string }).promotion });
        }
    }, [game, onMove]);

    const applyPromotion = useCallback((piece: PromotionPiece) => {
        if (!pendingPromotion) return;
        const { from, to } = pendingPromotion;
        setPendingPromotion(null);

        // Same optimistic path as a regular move, with the chosen piece.
        const nextGame = createGame(game.fen());
        const move = validateMove(nextGame, from, to, piece);

        if (move) {
            setGame(nextGame); // optimistic; server confirms or the parent triggers a resync
            if (onMove) onMove(nextGame.fen(), { from, to, promotion: piece });
        }
    }, [pendingPromotion, game, onMove]);

    const cancelPromotion = useCallback(() => setPendingPromotion(null), []);

    const handleDragStart = useCallback(
        (activeId: string) => {
            setActiveSquare(activeId);
            const from = activeId as string;
            const piece = game.get(from as any);

            // Sadece kendi taşınsa ve sıran ise legal kareleri göster
            if (isGameOver || !piece || piece.color !== playerColor || game.turn() !== playerColor) {
                setHighlightedSquares([]);
                return;
            }

            const legalTargets = game
                .moves({ square: from, verbose: true } as any)
                .map((m: any) => m.to as string);

            setHighlightedSquares(legalTargets);
        },
        [game, playerColor, isGameOver]
    );

    // Orientation-aware order (flipped when playing black)
    const displayRanks = playerColor === 'w' ? RANKS : [...RANKS].reverse();
    const displayFiles = playerColor === 'w' ? FILES : [...FILES].reverse();

    const renderSquares = () => {
        const squares = [];

        for (const rank of displayRanks) {
            for (const file of displayFiles) {
                const squareName = `${file}${rank}`;
                const piece = game.get(squareName as any);
                const isLight = (FILES.indexOf(file) + RANKS.indexOf(rank)) % 2 === 0;

                // Only allow dragging your own pieces, and only when it's your turn
                const isDraggablePiece =
                    !!piece &&
                    piece.color === playerColor &&
                    game.turn() === playerColor &&
                    !isGameOver;

                const isHighlighted = highlightedSquares.includes(squareName);
                const isActive = squareName === activeSquare;
                const isLastMove = !!lastMove && (squareName === lastMove.from || squareName === lastMove.to);

                squares.push(
                    <Square
                        key={squareName}
                        id={squareName}
                        isLight={isLight}
                        isHighlighted={isHighlighted}
                        isActive={isActive}
                        isCapture={isHighlighted && !!piece}
                        isLastMove={isLastMove}
                    >
                        {piece && (
                            <Piece
                                id={squareName}
                                type={piece.type}
                                color={piece.color}
                                isDraggable={isDraggablePiece}
                            />
                        )}
                    </Square>
                );
            }
        }
        return squares;
    };

    const coordClass = 'font-display text-[9px] lg:text-[11px] font-bold uppercase text-slate-500';

    return (
        <DndContext
            sensors={sensors}
            onDragEnd={handleDragEnd}
            onDragStart={(event) => handleDragStart(event.active.id as string)}
        >
            <div
                className="p-2.5 lg:p-4 rounded-[1.75rem] lg:rounded-[2.5rem] bg-linear-to-br from-slate-800/90 via-slate-900 to-slate-950 border border-slate-700/60 ring-1 ring-slate-950/70 shadow-[0_24px_64px_-16px_rgba(2,6,23,0.8),0_0_70px_-24px_rgba(99,102,241,0.4)]"
                style={{ touchAction: 'none' }}
            >
                <div
                    className="grid"
                    style={{
                        gridTemplateColumns: 'auto minmax(0, 1fr)',
                        gridTemplateRows: 'minmax(0, 1fr) auto'
                    }}
                >
                    {/* Rank coordinates (flip-aware) */}
                    <div className="flex flex-col pr-1.5 lg:pr-2.5 select-none" aria-hidden="true">
                        {displayRanks.map((rank) => (
                            <div key={rank} className={`flex-1 flex items-center justify-center ${coordClass}`}>
                                {rank}
                            </div>
                        ))}
                    </div>

                    {/* Board */}
                    <div
                        className="relative grid grid-cols-8 gap-0 rounded-xl lg:rounded-2xl overflow-hidden ring-1 ring-slate-950/60 shadow-[inset_0_2px_16px_rgba(0,0,0,0.45)]"
                        style={{
                            // Mobilde ekrana göre, masaüstünde daha büyük tahta
                            // (92vw eksi çerçeve + koordinat sütunu payı)
                            width: 'min(92vw - 44px, 720px)',
                            height: 'min(92vw - 44px, 720px)',
                            gridTemplateColumns: 'repeat(8, 1fr)'
                        }}
                    >
                        {renderSquares()}

                        {/* Promotion picker — scrim limited to the board, click-outside cancels */}
                        {pendingPromotion && !isGameOver && (
                            <div
                                className="absolute inset-0 z-[70] flex items-center justify-center p-4"
                                style={{
                                    background: 'rgba(2, 6, 23, 0.78)',
                                    backdropFilter: 'blur(14px)',
                                    WebkitBackdropFilter: 'blur(14px)'
                                }}
                                onClick={cancelPromotion}
                                role="dialog"
                                aria-modal="true"
                                aria-label="Choose promotion piece"
                            >
                                <div
                                    className="anim-pop-in flex flex-col items-center gap-3 p-4 lg:p-5 rounded-2xl lg:rounded-3xl bg-slate-900/90 border border-indigo-500/40 ring-1 ring-slate-950/70 shadow-[0_18px_50px_-12px_rgba(2,6,23,0.85),0_0_50px_-16px_rgba(99,102,241,0.55)]"
                                    onClick={(event) => event.stopPropagation()}
                                >
                                    <div className="text-[10px] lg:text-[11px] font-black text-indigo-300 uppercase tracking-[0.25em] select-none">
                                        Promotion
                                    </div>
                                    <div className="flex items-center gap-2 lg:gap-3">
                                        {PROMOTION_PIECES.map((piece) => (
                                            <button
                                                key={piece}
                                                type="button"
                                                onClick={() => applyPromotion(piece)}
                                                aria-label={`Promote to ${PROMOTION_LABELS[piece]}`}
                                                className="w-14 h-14 lg:w-20 lg:h-20 rounded-xl lg:rounded-2xl flex items-center justify-center bg-indigo-500/10 border border-indigo-500/30 hover:bg-indigo-500/25 hover:border-indigo-400/60 hover:-translate-y-0.5 active:scale-95 transition-all"
                                            >
                                                <span
                                                    aria-hidden="true"
                                                    className="leading-none text-4xl lg:text-6xl"
                                                    style={pendingPromotion.color === 'w'
                                                        ? {
                                                            color: '#f8f4e9',
                                                            WebkitTextStroke: '1px rgba(30, 27, 75, 0.55)',
                                                            textShadow: '0 2px 5px rgba(2, 6, 23, 0.4)'
                                                        }
                                                        : {
                                                            color: '#20222e',
                                                            WebkitTextStroke: '1px rgba(203, 213, 225, 0.28)',
                                                            textShadow: '0 2px 5px rgba(2, 6, 23, 0.55)'
                                                        }}
                                                >
                                                    {pieceIcons.b[piece]}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Corner spacer */}
                    <div />

                    {/* File coordinates (flip-aware) */}
                    <div className="flex pt-1 lg:pt-1.5 select-none" aria-hidden="true">
                        {displayFiles.map((file) => (
                            <div key={file} className={`flex-1 text-center ${coordClass}`}>
                                {file}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </DndContext>
    );
};
