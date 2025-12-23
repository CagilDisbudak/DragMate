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
}

export const ChessBoard: React.FC<ChessBoardProps> = ({
    onMove,
    initialFen,
    playerColor = 'w'
}) => {
    const [game, setGame] = useState(() => createGame(initialFen));

    // Sync local game state with server FEN
    React.useEffect(() => {
        if (initialFen && initialFen !== game.fen()) {
            setGame(createGame(initialFen));
        }
    }, [initialFen]);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(MouseSensor),
        useSensor(TouchSensor)
    );

    const handleDragEnd = useCallback((event: DragEndEvent) => {
        const { active, over } = event;

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
                    game.turn() === playerColor;

                squares.push(
                    <Square key={squareName} id={squareName} isLight={isLight}>
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
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <div className="p-3 bg-slate-900 rounded-[2.5rem] shadow-2xl border border-slate-800 ring-1 ring-white/5">
                <div
                    className="grid grid-cols-8 gap-0 rounded-3xl overflow-hidden border border-slate-900/50"
                    style={{
                        width: 'min(90vw, 640px)',
                        height: 'min(90vw, 640px)',
                        gridTemplateColumns: 'repeat(8, 1fr)'
                    }}
                >
                    {renderSquares()}
                </div>
            </div>
        </DndContext>
    );
};
