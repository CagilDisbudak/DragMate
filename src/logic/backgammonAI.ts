
import { type BackgammonState, type Move, getValidMoves, applyMove } from './backgammonLogic';

export const getBestBackgammonMove = (state: BackgammonState, difficulty: 'Easy' | 'Normal' | 'Hard' = 'Normal'): Move | null => {
    const validMoves = getValidMoves(state);
    if (validMoves.length === 0) return null;

    // Easy: Random move
    if (difficulty === 'Easy') {
        const randomIndex = Math.floor(Math.random() * validMoves.length);
        return validMoves[randomIndex];
    }

    // Normal/Hard: Heuristic based
    // We want to evaluate the resulting state of each move
    let bestMove = validMoves[0];
    let bestScore = -Infinity;

    for (const move of validMoves) {
        // Simple 1-ply lookahead (greedy)
        // In real BG AI, we process the whole turn (all dice), but here we pick one die move at a time for the UI loop
        const score = evaluateMove(state, move, difficulty);
        if (score > bestScore) {
            bestScore = score;
            bestMove = move;
        }
    }

    return bestMove;
};

const evaluateMove = (state: BackgammonState, move: Move, difficulty: string): number => {
    let score = 0;

    // 1. Hitting is good
    if (move.isHit) {
        score += 100;
    }

    // 2. Bearing off is very good
    if (move.to === 'off') {
        score += 200;
    }

    // 3. Making a point (secure 2+ pieces) is good
    // We need to peek at the resulting board state for this
    const newState = applyMove({ ...state }, move); // Shallow copy enough for logic, deep copy inside applyMove
    const isWhite = state.turn === 'white';

    if (typeof move.to === 'number') {
        const destCount = newState.board[move.to];
        if (isWhite && destCount === 2) score += 50; // Made a new point
        if (!isWhite && destCount === -2) score += 50;
    }

    // 4. Leaving a blot (single piece) is bad, especially in home board
    // Vulnerability check
    if (typeof move.to === 'number') {
        // Check if we left a blot at destination (unlikely if we made a point, but possible if we just moved)
        const destCount = newState.board[move.to];
        if (Math.abs(destCount) === 1) {
            score -= 30;
        }
    }

    // Check if we left a blot at source (broke a point)
    if (typeof move.from === 'number') {
        const srcCount = newState.board[move.from];
        if (Math.abs(srcCount) === 1) {
            score -= 40; // Breaking a point is dangerous
        }
    }

    // Hard mode could have deeper eval or more nuanced weights
    if (difficulty === 'Hard') {
        // Prioritize home board points
        if (typeof move.to === 'number') {
            const isHome = isWhite ? move.to >= 18 : move.to <= 5;
            if (isHome && Math.abs(newState.board[move.to]) > 1) {
                score += 30;
            }
        }
    }

    // Random noise to make it not robotic
    score += Math.random() * 5;

    return score;
};
