
import React, { useState, useEffect } from 'react';
import { BackgammonBoard } from '../BackgammonBoard/BackgammonBoard';
import { useBackgammonGame } from '../../hooks/useBackgammonGame';
import {
    type BackgammonState,
    createBackgammonGame,
    getValidMoves,
    rollDice,
    applyMove
} from '../../logic/backgammonLogic';
import { getBestBackgammonMove } from '../../logic/backgammonAI';
import { ArrowLeft, RotateCcw, Trophy, X } from 'lucide-react';

interface BackgammonGameProps {
    roomId?: string;
    mode?: 'online' | 'local';
    aiDifficulty?: 'Easy' | 'Normal' | 'Hard';
    onExit: () => void;
}

export const BackgammonGame: React.FC<BackgammonGameProps> = ({ roomId = '', mode = 'online', aiDifficulty = 'Normal', onExit }) => {
    const gameRoom = useBackgammonGame(mode === 'online' ? roomId : null);

    // Local State
    const [localGame, setLocalGame] = useState<BackgammonState>(() => createBackgammonGame());

    // Unified Access
    const isLocal = mode === 'local';
    const gameState = isLocal ? localGame : (gameRoom.room ? {
        ...gameRoom.room,
        validMoves: [] // Recalculated locally usually, or sync? Let's recalc.
    } as unknown as BackgammonState : null);
    // Note: Firestore data doesn't store computed validMoves, so we compute them here.

    // If online game is loading
    if (!isLocal && gameRoom.loading) return <div className="text-white">Loading Arena...</div>;
    if (!gameState) return <div className="text-white">Game Not Found</div>;

    // Compute Valid Moves
    // In local, we trust state. In online, we define moves based on synced state.
    // If it's my turn, calculate moves.
    const validMoves = getValidMoves(gameState);

    // Player Identity
    const currentUserId = isLocal ? (gameState.turn === 'white' ? 'local-white' : 'local-black') : gameRoom.userId;
    // In Local: Human is White. AI is Black.
    const playerColor = isLocal ? 'white' : (
        gameRoom.room?.whitePlayer === currentUserId ? 'white' : 'black'
    );

    const isWhiteTurn = gameState.turn === 'white';
    const isOurTurn = playerColor === gameState.turn;

    // Auto-skip turn if no moves possible
    useEffect(() => {
        if (gameState.movesLeft.length > 0 && validMoves.length === 0 && !gameState.winner) {
            // No moves possible!
            const timer = setTimeout(() => {
                let finalState = { ...gameState };
                // Switch turn
                finalState.turn = finalState.turn === 'white' ? 'black' : 'white';
                finalState.dice = rollDice();
                finalState.movesLeft = [...finalState.dice];

                if (isLocal) {
                    setLocalGame(finalState);
                } else {
                    gameRoom.updateGameState(finalState);
                }
            }, 1500); // 1.5s delay so user sees "No Moves" or realizes
            return () => clearTimeout(timer);
        }
    }, [gameState.movesLeft, validMoves, gameState.winner, gameState.turn, isLocal]);

    // const isMyTurn = gameState.turn === playerColor; // Unused for now visually, but kept logic below

    // Handlers
    const handleMove = (newState: BackgammonState) => {
        // Check availability of next moves?
        // If movesLeft is empty, switch turn automatically? 
        // Logic: if movesLeft is empty, switch turn.

        let finalState = { ...newState };
        if (finalState.movesLeft.length === 0) {
            // End of turn
            finalState.turn = finalState.turn === 'white' ? 'black' : 'white';
            finalState.dice = rollDice(); // Roll for next player? 
            // Usually standard BG: player rolls at START of turn.
            // But for simplicity/speed: Auto-roll for next player at end of current turn
            finalState.movesLeft = [...finalState.dice];
        } else {
            // Check if any valid moves remain. If none, forfeiture remaining dice.
            const remainingMoves = getValidMoves(finalState);
            if (remainingMoves.length === 0) {
                finalState.turn = finalState.turn === 'white' ? 'black' : 'white';
                finalState.dice = rollDice();
                finalState.movesLeft = [...finalState.dice];
            }
        }

        if (isLocal) {
            setLocalGame(finalState);
        } else {
            gameRoom.updateGameState(finalState);
        }
    };

    // AI Trigger
    useEffect(() => {
        if (isLocal && gameState.turn === 'black' && !gameState.winner) {
            const timer = setTimeout(() => {
                const bestMove = getBestBackgammonMove(gameState, aiDifficulty);
                if (bestMove) {
                    const stepState = applyMove(gameState, bestMove);
                    handleMove(stepState);
                } else {
                    // No moves possible for AI? Force turn switch.
                    let finalState = { ...gameState };
                    finalState.turn = 'white';
                    finalState.dice = rollDice();
                    finalState.movesLeft = [...finalState.dice];
                    setLocalGame(finalState);
                }
            }, 800);
            return () => clearTimeout(timer);
        }
    }, [gameState, isLocal, aiDifficulty]);

    return (
        <div className="flex flex-col items-center gap-8 w-full max-w-6xl mx-auto px-4 py-8">
            <header className="w-full flex items-center justify-between">
                <button onClick={onExit} className="flex items-center gap-2 text-slate-500 hover:text-white font-bold uppercase tracking-widest text-xs">
                    <ArrowLeft size={16} /> Back
                </button>
                <div className="text-white font-black uppercase tracking-widest text-xl">
                    Backgammon / Tavla
                </div>
                <div className="w-16"></div> {/* Spacer */}
            </header>

            {/* Turn Indicator */}
            <div className="flex items-center justify-between w-full bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 backdrop-blur-sm">
                <div className={`flex items-center gap-3 ${isWhiteTurn ? 'opacity-100' : 'opacity-40'}`}>
                    <div className="w-4 h-4 rounded-full bg-slate-200 border border-slate-300 shadow-sm" />
                    <div>
                        <div className="text-sm font-bold text-white">White</div>
                        {isWhiteTurn && <div className="text-xs text-indigo-400 font-medium animate-pulse">Playing...</div>}
                    </div>
                </div>

                {/* Timer Placeholder / VS */}
                <div className="text-slate-600 font-black text-sm">VS</div>

                <div className={`flex items-center gap-3 ${!isWhiteTurn ? 'opacity-100' : 'opacity-40'}`}>
                    <div className="text-right">
                        <div className="text-sm font-bold text-white">Black</div>
                        {!isWhiteTurn && <div className="text-xs text-indigo-400 font-medium animate-pulse">Playing...</div>}
                    </div>
                    <div className="w-4 h-4 rounded-full bg-slate-900 border border-slate-700 shadow-sm" />
                </div>
            </div>

            <BackgammonBoard
                gameState={gameState}
                playerColor={playerColor}
                onMove={handleMove}
                onRollDice={() => { }} // Auto handled for now
                validMoves={validMoves}
            />

            <div className="flex gap-4">
                <button
                    onClick={() => {
                        const newGame = createBackgammonGame();
                        if (isLocal) setLocalGame(newGame);
                        else gameRoom.resetGame();
                    }}
                    className="btn-premium px-6 py-2 text-sm flex items-center gap-2"
                >
                    <RotateCcw size={16} /> Restart
                </button>
            </div>

            {/* Game Over Modal */}
            {gameState.winner && (
                <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm z-[100] flex items-center justify-center animate-in fade-in duration-300">
                    <div className="bg-slate-800 border border-slate-700 p-8 rounded-2xl shadow-2xl max-w-sm w-full text-center space-y-6">
                        <div className="mx-auto w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center">
                            <Trophy className="w-8 h-8 text-yellow-400" />
                        </div>

                        <div>
                            <h2 className="text-3xl font-black text-white mb-2">
                                {gameState.winner === 'white' ? 'White' : 'Black'} Wins!
                            </h2>
                            <p className="text-slate-400">
                                {isLocal
                                    ? (gameState.winner === 'white' ? 'You won!' : 'AI won!')
                                    : (gameState.winner === playerColor ? 'You Won!' : 'Opponent Won!')
                                }
                            </p>
                        </div>

                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => {
                                    const newGame = createBackgammonGame();
                                    if (isLocal) setLocalGame(newGame);
                                    else gameRoom.resetGame();
                                }}
                                className="btn-premium w-full py-3"
                            >
                                Play Again
                            </button>
                            <button
                                onClick={onExit}
                                className="w-full py-3 rounded-xl hover:bg-slate-700 text-slate-400 font-bold transition-colors"
                            >
                                Exit
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};
