
export type PlayerColor = 'white' | 'black';

export interface BackgammonState {
    board: number[]; // 0-23: points. >0 white pieces, <0 black pieces.
    bar: { white: number; black: number };
    off: { white: number; black: number };
    turn: PlayerColor;
    dice: number[];
    validMoves: Move[]; // Cache of valid moves for current turn
    winner: PlayerColor | null;
    movesLeft: number[]; // Dice values left to use
}

export interface Move {
    from: number | 'bar'; // 0-23 or 'bar'
    to: number | 'off';   // 0-23 or 'off'
    roll: number;         // The dice value used
    isHit?: boolean;      // Does this move hit a blot?
}

export const INITIAL_BOARD = [
    2, 0, 0, 0, 0, -5, // 0-5
    0, -3, 0, 0, 0, 5, // 6-11
    -5, 0, 0, 0, 3, 0, // 12-17
    5, 0, 0, 0, 0, -2  // 18-23
];

// White moves 0 -> 23
// Black moves 23 -> 0

export const rollDice = (): number[] => {
    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    if (d1 === d2) return [d1, d1, d1, d1];
    return [d1, d2];
};

export const createBackgammonGame = (): BackgammonState => {
    const dice = rollDice();
    return {
        board: [...INITIAL_BOARD],
        bar: { white: 0, black: 0 },
        off: { white: 0, black: 0 },
        turn: 'white', // Standard is often roll for start, but let's simple start white
        dice: dice,
        movesLeft: [...dice],
        validMoves: [], // Calculated externally or right after
        winner: null,
    };
};

export const isValidMove = (state: BackgammonState, move: Move): boolean => {
    // Basic validation logic placeholder
    // This function can be used to sanity check, but usually we generate all valid moves
    return true;
};

export const canBearOff = (state: BackgammonState, player: PlayerColor): boolean => {
    const board = state.board;
    if (player === 'white') {
        if (state.bar.white > 0) return false;
        // Check if all pieces are in home board (18-23)
        for (let i = 0; i < 18; i++) {
            if (board[i] > 0) return false;
        }
        return true;
    } else {
        if (state.bar.black > 0) return false;
        // Check if all pieces are in home board (0-5)
        for (let i = 6; i < 24; i++) {
            if (board[i] < 0) return false;
        }
        return true;
    }
};

export const getValidMoves = (state: BackgammonState): Move[] => {
    const moves: Move[] = [];
    if (state.winner) return [];

    // Simplification for the first pass:
    // This is complex because moves can be sequential.
    // Ideally we return ALL legal sequences, but UI often handles one checker at a time.
    // So we return valid single moves for the CURRENT state and CURRENT available dice.

    const { turn, board, bar, movesLeft } = state;
    const uniqueRolls = Array.from(new Set(movesLeft));

    if (movesLeft.length === 0) return [];

    const isWhite = turn === 'white';
    const direction = isWhite ? 1 : -1;
    const homeStart = isWhite ? 18 : 0;
    const homeEnd = isWhite ? 23 : 5;

    // 1. Check Bar first
    const barCount = isWhite ? bar.white : bar.black;
    if (barCount > 0) {
        // Must enter from bar
        // White enters at 0-5 (index = roll - 1)
        // Black enters at 23-18 (index = 24 - roll)
        for (const roll of uniqueRolls) {
            const targetIndex = isWhite ? roll - 1 : 24 - roll;
            const targetContent = board[targetIndex];

            // Can enter if empty, own color, or singly occupied by opponent (hit)
            const isOwnColor = isWhite ? targetContent >= 0 : targetContent <= 0;
            const isOpponentMulti = isWhite ? targetContent < -1 : targetContent > 1;

            if (!isOpponentMulti) {
                moves.push({
                    from: 'bar',
                    to: targetIndex,
                    roll,
                    isHit: isWhite ? targetContent === -1 : targetContent === 1 // Hit validation
                });
            }
        }
        return moves; // If on bar, MUST move from bar.
    }

    // 2. Normal moves
    for (let i = 0; i < 24; i++) {
        const pieceCount = board[i];
        if (isWhite && pieceCount <= 0) continue;
        if (!isWhite && pieceCount >= 0) continue;

        for (const roll of uniqueRolls) {
            const targetIndex = i + (direction * roll);

            // Bearing off
            const bearingOffAllowed = canBearOff(state, turn);
            if (bearingOffAllowed) {
                // Exact bear off
                if (isWhite && targetIndex === 24) {
                    moves.push({ from: i, to: 'off', roll });
                    continue;
                }
                if (!isWhite && targetIndex === -1) {
                    moves.push({ from: i, to: 'off', roll });
                    continue;
                }

                // Overshoot bear off (only allowed if no pieces further away)
                if (isWhite && targetIndex > 24) {
                    // Check if this is the furthest piece
                    let isFurthest = true;
                    for (let k = 18; k < i; k++) { if (board[k] > 0) isFurthest = false; }
                    if (isFurthest) moves.push({ from: i, to: 'off', roll });
                }
                if (!isWhite && targetIndex < -1) {
                    let isFurthest = true;
                    for (let k = 5; k > i; k--) { if (board[k] < 0) isFurthest = false; }
                    if (isFurthest) moves.push({ from: i, to: 'off', roll });
                }
            }

            // Normal move bounds check
            if (targetIndex < 0 || targetIndex > 23) continue;

            const targetContent = board[targetIndex];
            const isOpponentMulti = isWhite ? targetContent < -1 : targetContent > 1;

            if (!isOpponentMulti) {
                moves.push({
                    from: i,
                    to: targetIndex,
                    roll,
                    isHit: isWhite ? targetContent === -1 : targetContent === 1
                });
            }
        }
    }

    return moves;
};

export const applyMove = (state: BackgammonState, move: Move): BackgammonState => {
    const newState = {
        ...state,
        board: [...state.board],
        bar: { ...state.bar },
        off: { ...state.off },
        movesLeft: [...state.movesLeft]
    };

    const isWhite = state.turn === 'white';

    // Remove from source
    if (move.from === 'bar') {
        if (isWhite) newState.bar.white--;
        else newState.bar.black--;
    } else {
        newState.board[move.from as number] -= (isWhite ? 1 : -1);
    }

    // Add to dest
    if (move.to === 'off') {
        if (isWhite) newState.off.white++;
        else newState.off.black++;
    } else {
        const destIdx = move.to as number;
        // Hit logic
        if (move.isHit) {
            const existing = newState.board[destIdx]; // Should be -1 (if white moving) or 1 (if black moving)
            // Send opponent to bar
            if (isWhite) newState.bar.black++;
            else newState.bar.white++;

            // Reset checking to 0 before placing new piece (not strictly needed if we just overwrite, but cleaner)
            newState.board[destIdx] = 0;
        }

        newState.board[destIdx] += (isWhite ? 1 : -1);
    }

    // Consume dice
    const diceIdx = newState.movesLeft.indexOf(move.roll);
    if (diceIdx > -1) {
        newState.movesLeft.splice(diceIdx, 1);
    }

    // Check win condition
    if (isWhite && newState.off.white === 15) newState.winner = 'white';
    if (!isWhite && newState.off.black === 15) newState.winner = 'black';

    // End turn if no moves left
    // Note: This is simplified. Real BG requires checking if ANY moves are possible.
    // If movesLeft > 0 but no validMoves exist, we must also switch turn. The UI should handle "No Moves" state.

    return newState;
};
