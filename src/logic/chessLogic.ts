import { Chess } from 'chess.js';

export const createGame = (fen?: string) => new Chess(fen);

export const validateMove = (game: Chess, from: string, to: string, promotion?: string) => {
    try {
        const move = game.move({ from, to, promotion: promotion || 'q' });
        return move;
    } catch (e) {
        return null;
    }
};

/** True when moving from→to is a legal pawn promotion in the current position. */
export const isPromotionMove = (game: Chess, from: string, to: string): boolean => {
    try {
        return game
            .moves({ square: from, verbose: true } as any)
            .some((m: any) => m.to === to && typeof m.promotion === 'string');
    } catch (e) {
        return false;
    }
};

export const getGameState = (game: Chess) => ({
    fen: game.fen(),
    turn: game.turn(),
    isCheck: game.isCheck(),
    isCheckmate: game.isCheckmate(),
    isDraw: game.isDraw(),
    isGameOver: game.isGameOver(),
});

export type Square = {
    square: string;
    type: string;
    color: string;
};

export const getBoard = (game: Chess) => {
    const board = game.board();
    return board.flat().filter((s): s is any => s !== null);
};
