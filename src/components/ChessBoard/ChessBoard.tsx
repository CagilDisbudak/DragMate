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
import { createGame, validateMove } from '../../logic/chessLogic';
import { Square } from './Square';
import { Piece } from '../Piece/Piece';

interface ChessBoardProps {
    onMove?: (fen: string) => void;
    initialFen?: string;
    playerColor?: 'w' | 'b';
    isGameOver?: boolean;
}

export const ChessBoard: React.FC<ChessBoardProps> = ({
    onMove,
    initialFen,
    playerColor = 'w',
    isGameOver = false
}) => {
    const [game, setGame] = useState(() => createGame(initialFen));
    const [highlightedSquares, setHighlightedSquares] = useState<string[]>([]);
    const [activeSquare, setActiveSquare] = useState<string | null>(null);

    // Sync local game state with server FEN
    React.useEffect(() => {
        if (initialFen && initialFen !== game.fen()) {
            setGame(createGame(initialFen));
        }
    }, [initialFen]);

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

        // Work on a cloned game instance so we don't mutate state before validation
        const nextGame = createGame(game.fen());
        const move = validateMove(nextGame, from, to);

        if (move) {
            setGame(nextGame);
            if (onMove) onMove(nextGame.fen());
        }
    }, [game, onMove]);

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
        [game, playerColor]
    );

    const renderSquares = () => {
        const squares = [];
        const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
        const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];

        const displayRanks = playerColor === 'w' ? ranks : [...ranks].reverse();
        const displayFiles = playerColor === 'w' ? files : [...files].reverse();

        for (const rank of displayRanks) {
            for (const file of displayFiles) {
                const squareName = `${file}${rank}`;
                const piece = game.get(squareName as any);
                const isLight = (files.indexOf(file) + ranks.indexOf(rank)) % 2 === 0;

                // Only allow dragging your own pieces, and only when it's your turn
                const isDraggablePiece =
                    !!piece &&
                    piece.color === playerColor &&
                    game.turn() === playerColor &&
                    !isGameOver;

                const isHighlighted = highlightedSquares.includes(squareName);
                const isActive = squareName === activeSquare;

                squares.push(
                    <Square
                        key={squareName}
                        id={squareName}
                        isLight={isLight}
                        isHighlighted={isHighlighted}
                        isActive={isActive}
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

    return (
        <DndContext
            sensors={sensors}
            onDragEnd={handleDragEnd}
            onDragStart={(event) => handleDragStart(event.active.id as string)}
        >
            <div
                className="p-3 lg:p-4 bg-slate-800 rounded-[2rem] lg:rounded-[2.5rem] shadow-[0_0_50px_-12px_rgba(99,102,241,0.25)] border-4 border-slate-700/50 ring-4 ring-slate-900/50"
                style={{ touchAction: 'none' }}
            >
                <div
                    className="grid grid-cols-8 gap-0 rounded-2xl lg:rounded-3xl overflow-hidden border border-slate-700/30 shadow-inner"
                    style={{
                        // Mobilde ekrana göre, masaüstünde daha büyük tahta
                        width: 'min(92vw, 720px)',
                        height: 'min(92vw, 720px)',
                        gridTemplateColumns: 'repeat(8, 1fr)'
                    }}
                >
                    {renderSquares()}
                </div>
            </div>
        </DndContext>
    );
};
