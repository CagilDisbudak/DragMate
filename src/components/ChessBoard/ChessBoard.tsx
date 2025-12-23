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

                squares.push(
                    <Square key={squareName} id={squareName} isLight={isLight} isHighlighted={isHighlighted}>
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
                className="p-3 bg-slate-900 rounded-[2.5rem] shadow-2xl border border-slate-800 ring-1 ring-white/5"
                style={{ touchAction: 'none' }}
            >
                <div
                    className="grid grid-cols-8 gap-0 rounded-3xl overflow-hidden border border-slate-900/50"
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
