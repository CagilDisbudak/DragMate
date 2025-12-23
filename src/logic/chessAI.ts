import { Chess } from 'chess.js';

const PIECE_VALUES: Record<string, number> = {
    p: 10,
    n: 30,
    b: 30,
    r: 50,
    q: 90,
    k: 900,
};

// Simplified Position Tables (targeting center control)
const PAWN_TABLE = [
    [0, 0, 0, 0, 0, 0, 0, 0],
    [5, 5, 5, 5, 5, 5, 5, 5],
    [1, 1, 2, 3, 3, 2, 1, 1],
    [0.5, 0.5, 1, 2.5, 2.5, 1, 0.5, 0.5],
    [0, 0, 0, 2, 2, 0, 0, 0],
    [0.5, -0.5, -1, 0, 0, -1, -0.5, 0.5],
    [0.5, 1, 1, -2, -2, 1, 1, 0.5],
    [0, 0, 0, 0, 0, 0, 0, 0]
];

const KNIGHT_TABLE = [
    [-5, -4, -3, -3, -3, -3, -4, -5],
    [-4, -2, 0, 0, 0, 0, -2, -4],
    [-3, 0, 1, 1.5, 1.5, 1, 0, -3],
    [-3, 0.5, 1.5, 2, 2, 1.5, 0.5, -3],
    [-3, 0, 1.5, 2, 2, 1.5, 0, -3],
    [-3, 0.5, 1, 1.5, 1.5, 1, 0.5, -3],
    [-4, -2, 0, 0.5, 0.5, 0, -2, -4],
    [-5, -4, -3, -3, -3, -3, -4, -5]
];

const evaluateBoard = (game: Chess): number => {
    let score = 0;
    const board = game.board();

    for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
            const piece = board[i][j];
            if (piece) {
                const value = PIECE_VALUES[piece.type];
                // Positional Score handling
                let posScore = 0;
                if (piece.type === 'p') posScore = piece.color === 'w' ? PAWN_TABLE[i][j] : PAWN_TABLE[7 - i][j];
                if (piece.type === 'n') posScore = piece.color === 'w' ? KNIGHT_TABLE[i][j] : KNIGHT_TABLE[7 - i][j];

                if (piece.color === 'w') {
                    score += value + posScore * 0.1;
                } else {
                    score -= value + posScore * 0.1;
                }
            }
        }
    }
    return score;
};

const minimax = (game: Chess, depth: number, alpha: number, beta: number, isMaximizingPlayer: boolean): number => {
    if (depth === 0 || game.isGameOver()) {
        return -evaluateBoard(game); // Black maximizes negative scores typically, but let's standard to: +White, -Black
    }

    const moves = game.moves();

    if (isMaximizingPlayer) {
        let maxEval = -Infinity;
        for (const move of moves) {
            game.move(move);
            const ev = minimax(game, depth - 1, alpha, beta, false);
            game.undo();
            maxEval = Math.max(maxEval, ev);
            alpha = Math.max(alpha, ev);
            if (beta <= alpha) break;
        }
        return maxEval;
    } else {
        let minEval = Infinity;
        for (const move of moves) {
            game.move(move);
            const ev = minimax(game, depth - 1, alpha, beta, true);
            game.undo();
            minEval = Math.min(minEval, ev);
            beta = Math.min(beta, ev);
            if (beta <= alpha) break;
        }
        return minEval;
    }
};

export const getBestMove = (game: Chess, difficulty: 'Easy' | 'Normal' | 'Hard' = 'Normal'): string | null => {
    const moves = game.moves();
    if (moves.length === 0) return null;

    // Easy Mode: 80% chance of random move
    if (difficulty === 'Easy' && Math.random() > 0.2) {
        return moves[Math.floor(Math.random() * moves.length)];
    }

    let bestMove = null;
    let bestValue = Infinity; // Black wants to Minimize

    // Sort moves to improving pruning (captures first)
    moves.sort((a, b) => {
        const isCaptureA = a.includes('x') ? 1 : 0;
        const isCaptureB = b.includes('x') ? 1 : 0;
        return isCaptureB - isCaptureA;
    });

    const depth = difficulty === 'Easy' ? 1 : (difficulty === 'Hard' ? 3 : 2);

    for (const move of moves) {
        game.move(move);
        const boardValue = minimax(game, depth, -Infinity, Infinity, true);
        game.undo();

        if (boardValue < bestValue) {
            bestValue = boardValue;
            bestMove = move;
        }
    }

    return bestMove || moves[0];
};
