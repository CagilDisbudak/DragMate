
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
    roll: number;         // The dice value used (sum if composite)
    isHit?: boolean;      // Does this move hit a blot?
    subMoves?: Move[];    // For composite moves (e.g. combined dice)
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

// function isValidMove removed or simplified if empty.
export const isValidMove = (): boolean => {
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
    if (state.winner) return [];

    // Helper to get single-step moves for a specific state
    const getSingleStepMoves = (currentState: BackgammonState): Move[] => {
        const moves: Move[] = [];
        const { turn, board, bar, movesLeft } = currentState;
        const uniqueRolls = Array.from(new Set(movesLeft));

        if (movesLeft.length === 0) return [];

        const isWhite = turn === 'white';
        const direction = isWhite ? 1 : -1;

        // 1. Check Bar first
        const barCount = isWhite ? bar.white : bar.black;
        if (barCount > 0) {
            for (const roll of uniqueRolls) {
                const targetIndex = isWhite ? roll - 1 : 24 - roll;
                const targetContent = board[targetIndex];
                const isOpponentMulti = isWhite ? targetContent < -1 : targetContent > 1;

                if (!isOpponentMulti) {
                    moves.push({
                        from: 'bar',
                        to: targetIndex,
                        roll,
                        isHit: isWhite ? targetContent === -1 : targetContent === 1
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
                const bearingOffAllowed = canBearOff(currentState, turn);

                if (bearingOffAllowed) {
                    if (isWhite && targetIndex === 24) {
                        moves.push({ from: i, to: 'off', roll });
                        continue;
                    }
                    if (!isWhite && targetIndex === -1) {
                        moves.push({ from: i, to: 'off', roll });
                        continue;
                    }
                    if (isWhite && targetIndex > 24) {
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

                if (targetIndex < 0 || targetIndex > 23) continue;

                const targetContent = board[targetIndex];
                const isOpponentMulti = isWhite ? targetContent < -1 : targetContent > 1;

                if (!isOpponentMulti) {
                    moves.push({
                        from: i,
                        to: targetIndex,
                        roll,
                        isHit: isWhite ? targetContent === -1 : targetContent === 1 // Hit validation
                    });
                }
            }
        }
        return moves;
    };

    // 1. Get Base Moves for current state
    const baseMoves = getSingleStepMoves(state);
    const allMoves = [...baseMoves];

    // 2. Try to extend each base move to form composite moves (depth 2 for now, covers sum of 2 dice)
    // Only extend if there are dice left after the first move.
    if (state.movesLeft.length > 1) {
        for (const m1 of baseMoves) {
            // Apply first move logically
            const tempState = applyMove(state, m1);

            // Get possible next steps
            const nextMoves = getSingleStepMoves(tempState);

            // Filter for moves that continue from where m1 ended
            // If m1 went to 'off', it can't continue.
            if (m1.to !== 'off') {
                const continuations = nextMoves.filter(m2 => m2.from === m1.to);

                for (const m2 of continuations) {
                    allMoves.push({
                        from: m1.from,
                        to: m2.to,
                        roll: m1.roll + m2.roll, // Sum of rolls
                        isHit: m2.isHit, // Hit check on final destination (intermediate hit is implicit in subMove action)
                        subMoves: [m1, m2]
                    });

                    // Note: We could go deeper (Depth 3/4) for doubles here by recursing, 
                    // but "sum of two dice" usually implies 2 steps. 
                    // Let's stick to 2 to avoid clutter unless requested.
                }
            }
        }
    }

    // Deduplicate? (e.g. 3 then 4 vs 4 then 3 arriving at same spot)
    // Usually in BG, 3-then-4 and 4-then-3 are distinct in *how* they get there (intermediate point might be blocked for one)
    // But if both valid, they result in same final state.
    // For UI simplicity, if we have multiple composite moves to same target from components, maybe just keep one?
    // Actually letting the user pick either path is "correct", but UI might just show one dot.
    // We'll leave all valid variations in the array. The Board UI will highlight the target 'to'.
    // If user drops on 'to', we pick the first matching valid move.

    return allMoves;
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

    // Handle Composite Moves (Recursive)
    if (move.subMoves && move.subMoves.length > 0) {
        let currentState = state;
        for (const subMove of move.subMoves) {
            currentState = applyMove(currentState, subMove);
        }
        return currentState;
    }

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
            // Send opponent to bar
            if (isWhite) newState.bar.black++;
            else newState.bar.white++;

            // Reset checking to 0 before placing new piece
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
